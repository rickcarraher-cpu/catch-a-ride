import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSmsAndLog, loadSmsConfig } from "@/app/api/utils/sms-sender";
import {
  findOrCreateConversationForAppointment,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

// Helper to parse comma-separated emails
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

/**
 * GET /api/followup/send
 *
 * Finds all completed appointments from 24 hours ago and sends
 * a thank-you follow-up message with Google review link.
 *
 * Protect with a secret key:
 *   /api/followup/send?secret=YOUR_FOLLOWUP_SECRET
 *
 * Set the environment variable FOLLOWUP_SECRET to any long random string.
 * Then schedule a daily GET to this URL via cron-job.org (or similar).
 * Recommended schedule: every day at 12:00 PM (server time / UTC).
 */
export async function GET(request) {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const secret = process.env.FOLLOWUP_SECRET;
  if (secret) {
    const { searchParams } = new URL(request.url);
    const provided = searchParams.get("secret");
    if (provided !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // ── Load settings ──────────────────────────────────────────────────
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    // Check if follow-up is enabled
    const followupEnabled = settings.followup_enabled === "yes";
    if (!followupEnabled) {
      return Response.json({
        success: true,
        message: "Follow-up messages disabled in settings",
        sent: 0,
      });
    }

    const businessName = settings.business_name || "Catch A Ride";
    const followupMessage =
      settings.followup_message ||
      "Thank you for choosing {business}! We hope you had a wonderful trip. We'd love to hear about your experience — please take a moment to leave us a review: {review_link}";
    const reviewLink =
      settings.google_review_link || "https://g.page/r/YOUR_REVIEW_LINK/review";

    // ── Global send toggles ────────────────────────────────────────────────
    const emailsEnabled = settings.send_emails !== "no";
    const smsEnabled = settings.send_sms !== "no";

    // ── SMS provider config ────────────────────────────────────────────────
    const smsConfig = await loadSmsConfig(settings);

    // ── Email config ───────────────────────────────────────────────────────
    const fromName = settings.from_name || businessName;
    const fromAddress = settings.from_email
      ? `${fromName} <${settings.from_email}>`
      : undefined;

    // ── Build 24 hours ago window (UTC) ────────────────────────────────────
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(now.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const today = new Date(yesterday);
    today.setUTCDate(yesterday.getUTCDate() + 1);

    const windowStart = yesterday.toISOString();
    const windowEnd = today.toISOString();

    // ── Fetch completed appointments from 24 hours ago ─────────────────────
    const appointments = await sql(
      `SELECT a.id, a.client_id, a.booking_number, a.start_time,
              c.name AS client_name, c.phone AS client_phone,
              c.email AS client_email,
              c.cc_emails AS cc_emails,
              c.notification_preference AS client_notif_pref
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       WHERE a.tenant_id = 1
         AND a.start_time >= $1
         AND a.start_time < $2
         AND a.status NOT IN ('cancelled', 'canceled')
         AND a.payment_status = 'paid'
         AND (c.phone IS NOT NULL OR c.email IS NOT NULL)
       ORDER BY a.start_time ASC`,
      [windowStart, windowEnd],
    );

    if (appointments.length === 0) {
      console.log(
        `[Followup] No eligible appointments found for window ${windowStart.split("T")[0]} (${windowStart} to ${windowEnd})`,
      );
      return Response.json({
        success: true,
        message: "No paid appointments 24 hours ago — no follow-ups sent.",
        date: windowStart.split("T")[0],
        window: { start: windowStart, end: windowEnd },
        sent: 0,
      });
    }

    console.log(
      `[Followup] Found ${appointments.length} eligible appointments for ${windowStart.split("T")[0]}`,
    );
    console.log(
      `[Followup] Appointments: ${appointments
        .map((a) => `#${a.booking_number} (${a.client_name})`)
        .join(", ")}`,
    );

    // ── Send follow-up for each appointment ────────────────────────────────
    const results = [];

    for (const app of appointments) {
      const firstName = app.client_name?.split(" ")[0] || "there";
      const clientPref = app.client_notif_pref || "both";
      const wantsSms = clientPref === "sms" || clientPref === "both";
      const wantsEmail = clientPref === "email" || clientPref === "both";

      let smsSent = false;
      let emailSent = false;
      let errors = [];

      // Build message with placeholders replaced
      // Check for custom template first, then fall back to followup_message
      const customSmsTemplate = settings.template_followup_sms;
      const smsTemplate =
        customSmsTemplate ||
        settings.followup_message ||
        "Thank you for choosing {business}! We hope you had a wonderful trip. We'd love to hear about your experience — please take a moment to leave us a review: {review_link}";

      const messageBody = smsTemplate
        .replace(/\{business\}/gi, businessName)
        .replace(/\{name\}/gi, firstName)
        .replace(/\{review_link\}/gi, reviewLink);

      // ── Send SMS using unified sender ──────────────────────────────────
      if (smsEnabled && app.client_phone && wantsSms && smsConfig.ready) {
        try {
          // Find or create conversation
          let conversationId = null;
          try {
            conversationId = await findOrCreateConversationForAppointment(
              app.id,
              1,
            );
          } catch (convErr) {
            console.error(
              "[Followup→SMS] Failed to create conversation:",
              convErr,
            );
          }

          const result = await sendSmsAndLog({
            to: app.client_phone,
            message: messageBody,
            config: smsConfig,
            label: "Followup→SMS",
            appointmentId: app.id,
            clientId: app.client_id || null,
            conversationId,
            senderName: app.client_name || "Passenger",
            recipientType: "passenger",
            notificationType: "followup",
          });

          if (result.success) {
            smsSent = true;
            console.log(
              `[Followup→SMS] ✅ Sent to ${app.client_phone} for booking #${app.booking_number}`,
            );
          } else {
            console.error(
              `[Followup→SMS] ❌ Failed for booking #${app.booking_number}: ${result.error}`,
            );
            errors.push(`SMS: ${result.error}`);
          }
        } catch (err) {
          console.error(
            `[Followup→SMS] Failed for booking #${app.booking_number}:`,
            err.message,
          );
          errors.push(`SMS: ${err.message}`);
        }
      } else if (
        smsEnabled &&
        app.client_phone &&
        wantsSms &&
        !smsConfig.ready
      ) {
        console.log(`[Followup→SMS] ⏭️  Skipped — ${smsConfig.reason}`);
      }

      // ── Send Email ─────────────────────────────────────────────────────
      if (emailsEnabled && app.client_email && wantsEmail && fromAddress) {
        try {
          const logoUrl = settings.logo_url || null;
          const servicesUrl = settings.services_url || "https://catcharide.us";

          // Build HTML email
          const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${businessName} — Thank You</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="background:#1d4ed8;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="${businessName}" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin:0 auto 10px;" />`
              : `<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</p>`
          }
          <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">Thank You</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);padding:32px 24px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;text-align:center;">Thank you for choosing ${businessName}!</h2>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;text-align:center;">
            We hope you had a wonderful trip. Your satisfaction means everything to us.
          </p>
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${reviewLink}" target="_blank" style="display:inline-block;background:#1d4ed8;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">⭐ Leave a Review</a>
          </div>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;text-align:center;">
            We'd love to hear about your experience. Your feedback helps us serve you better!
          </p>
          <div style="border-top:1px solid #f3f4f6;margin-top:24px;padding-top:20px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Need another ride?</p>
            <a href="${servicesUrl}" style="font-size:13px;color:#1d4ed8;font-weight:600;text-decoration:none;">Book with us again →</a>
          </div>
          <div style="border-top:1px solid #f3f4f6;margin-top:20px;padding-top:16px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

          // Parse all passenger emails (primary + cc)
          const passengerEmails = [];
          if (app.client_email)
            passengerEmails.push(...parseEmailAddresses(app.client_email));
          if (app.cc_emails)
            passengerEmails.push(...parseEmailAddresses(app.cc_emails));
          const uniqueEmails = [
            ...new Set(passengerEmails.map((e) => e.toLowerCase())),
          ].map((lower) =>
            passengerEmails.find((e) => e.toLowerCase() === lower),
          );

          for (const email of uniqueEmails) {
            try {
              await sendEmail({
                to: email,
                from: fromAddress,
                subject: `Thank you for choosing ${businessName}!`,
                text: messageBody,
                html: emailHtml,
              });
              emailSent = true;
              console.log(
                `[Followup→Email] ✅ Sent to ${email} for booking #${app.booking_number}`,
              );
            } catch (emailErr) {
              console.error(
                `[Followup→Email] ❌ Failed to send to ${email}:`,
                emailErr.message,
              );
            }
          }

          if (!emailSent) {
            errors.push("Email: Failed to send to all addresses");
          }
        } catch (err) {
          console.error(
            `[Followup→Email] Failed for booking #${app.booking_number}:`,
            err.message,
          );
          errors.push(`Email: ${err.message}`);
        }
      }

      results.push({
        appointmentId: app.id,
        bookingNumber: app.booking_number,
        clientName: app.client_name,
        smsSent,
        emailSent,
        errors: errors.length > 0 ? errors : null,
      });

      // Mark trip as thank you sent if either SMS or email was sent
      if (smsSent || emailSent) {
        try {
          await sql`
            UPDATE appointments 
            SET thankyou_sent_at = NOW() 
            WHERE id = ${app.id}
          `;
          console.log(
            `[Followup] Marked trip #${app.booking_number} as thank-you sent`,
          );
        } catch (err) {
          console.error(
            `[Followup] Failed to mark trip #${app.booking_number} as sent:`,
            err.message,
          );
        }
      }
    }

    const totalSent = results.filter((r) => r.smsSent || r.emailSent).length;
    const totalFailed = results.filter(
      (r) => !r.smsSent && !r.emailSent && r.errors,
    ).length;

    console.log(
      `[Followup] ${totalSent} sent, ${totalFailed} failed for ${windowStart.split("T")[0]}`,
    );

    // Return minimal response for cron (detailed info in server logs)
    return Response.json({
      success: true,
      sent: totalSent,
    });
  } catch (error) {
    console.error("[Followup] Error:", error);
    return Response.json({ success: false }, { status: 500 });
  }
}

// Also accept POST for schedulers that prefer it
export const POST = GET;
