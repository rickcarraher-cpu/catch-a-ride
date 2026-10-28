import sql from "@/app/api/utils/sql";
import {
  sendSmsAndLog,
  loadSmsConfig,
  toE164,
} from "@/app/api/utils/sms-sender";
import { sendEmail } from "@/app/api/utils/send-email";
import {
  findConversationByPhone,
  findOrCreateConversationForAppointment,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

/**
 * Send custom freeform SMS/Email
 * POST /api/sms/send-custom
 *
 * Two modes:
 * 1. Booking form message (from_booking_form: true):
 *    - Stores message as INBOUND from the passenger
 *    - Notifies business owner via email and/or SMS to business phone
 *    - Does NOT text the passenger their own message back to them
 *
 * 2. Admin/dispatch message (default):
 *    - Sends SMS and/or Email to the specified passenger
 *    - Respects passenger's notification preference
 *    - Stores as OUTBOUND from dispatch/business
 *
 * Body: { phone, message, name?, email?, notification_preference?, from_booking_form?, client_id? }
 */
export async function POST(request) {
  try {
    const {
      phone,
      message,
      name,
      email,
      notification_preference,
      from_booking_form,
      client_id,
    } = await request.json();

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Load SMS config (includes settings) via unified sender
    const config = await loadSmsConfig();
    const settings = config.settings;

    const businessName = settings.business_name || "Catch A Ride";
    const businessPhone = settings.business_phone || process.env.BUSINESS_PHONE;
    const ownerEmail = settings.owner_email || process.env.OWNER_EMAIL;
    const fromName = settings.from_name || businessName;
    const fromEmail = settings.from_email;
    const fromAddress = fromEmail ? `${fromName} <${fromEmail}>` : null;

    // ── Find or create client ──────────────────────────────────────────────
    let clientId = client_id || null;
    let clientData = null;

    if (clientId) {
      const [client] = await sql`
        SELECT id, name, phone, email, notification_preference 
        FROM clients 
        WHERE id = ${clientId} AND tenant_id = 1
      `;
      clientData = client;
    } else if (name) {
      const clients =
        await sql`SELECT id, name, phone, email FROM clients WHERE tenant_id = 1`;
      const normalizedPhone = phone ? toE164(phone) : null;
      const matchedClient = clients.find(
        (c) =>
          (c.phone && normalizedPhone && toE164(c.phone) === normalizedPhone) ||
          (c.email && email && c.email.toLowerCase() === email.toLowerCase()),
      );

      if (matchedClient) {
        clientId = matchedClient.id;
        clientData = matchedClient;
        await sql`
          UPDATE clients
          SET notification_preference = ${notification_preference || "both"}
          WHERE id = ${clientId}
        `;
      } else {
        const [newClient] = await sql`
          INSERT INTO clients (tenant_id, name, email, phone, notes, notification_preference)
          VALUES (1, ${name}, ${email || null}, ${phone || null}, 'Created via booking form message', ${notification_preference || "both"})
          RETURNING id, name, phone, email, notification_preference
        `;
        clientId = newClient.id;
        clientData = newClient;
      }
    }

    const results = {
      sms: null,
      email: null,
    };

    // ══════════════════════════════════════════════════════════════════════════
    // MODE 1: BOOKING FORM MESSAGE (from passenger TO the business)
    // ══════════════════════════════════════════════════════════════════════════
    if (from_booking_form) {
      const normalizedPhone = phone ? toE164(phone) : null;

      // Store the message as INBOUND (from the passenger to the business)
      if (normalizedPhone) {
        let conversationId = null;
        const existingConversation =
          await findConversationByPhone(normalizedPhone);

        if (existingConversation) {
          conversationId = existingConversation.id;
        }

        await sql`
          INSERT INTO sms_messages (
            tenant_id, conversation_id, client_id, direction, phone, message, sender_name, provider, metadata
          ) VALUES (
            1, ${conversationId}, ${clientId}, 'inbound', ${normalizedPhone}, ${message}, ${name || "Booking Form"}, 'BookingForm', ${JSON.stringify({ from_booking_form: true, notification_preference })}
          )
        `;

        if (conversationId) {
          await updateConversationTimestamp(conversationId);
        }
      }

      // Notify business owner via SMS (using unified sender)
      const notificationMsg = `New message from ${name || "Booking Form"}${phone ? ` (${phone})` : ""}:\n${message}`;
      if (businessPhone && config.ready) {
        const smsResult = await sendSmsAndLog({
          to: businessPhone,
          message: notificationMsg,
          config,
          label: "Booking Form → Owner",
          senderName: name || "Booking Form",
          recipientType: "owner",
          notificationType: "booking_form_message",
          metadata: { from_booking_form: true },
        });
        results.sms = smsResult.success
          ? smsResult
          : { error: smsResult.error };
      }

      // Notify business owner via email
      if (ownerEmail) {
        try {
          await sendEmail({
            to: ownerEmail,
            subject: `New Message from ${name || "Booking Form"}`,
            html: `
              <h2>New Message from Booking Form</h2>
              <p><strong>From:</strong> ${name || "Unknown"}</p>
              ${email ? `<p><strong>Email:</strong> ${email}</p>` : ""}
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
              <p><strong>Preference:</strong> ${notification_preference || "N/A"}</p>
              <hr>
              <p><strong>Message:</strong></p>
              <p>${message.replace(/\n/g, "<br>")}</p>
            `,
          });

          results.email = { success: true };
          console.log(`[Booking Form] Emailed notification to ${ownerEmail}`);
        } catch (emailError) {
          console.error("[Booking Form] Error sending email:", emailError);
          results.email = { error: emailError.message };
        }
      }

      return Response.json({
        success: true,
        message: "Message sent successfully",
        results,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODE 2: ADMIN/DISPATCH MESSAGE (from business TO a passenger)
    // ══════════════════════════════════════════════════════════════════════════

    // Determine notification preference
    const notifPref =
      clientData?.notification_preference || notification_preference || "both";
    const shouldSendSms =
      (notifPref === "sms" || notifPref === "both") && phone;
    const shouldSendEmail =
      (notifPref === "email" || notifPref === "both") &&
      (clientData?.email || email);

    const passengerEmail = clientData?.email || email;
    const passengerName = clientData?.name || name || "there";
    const firstName = passengerName.split(" ")[0];

    // Send SMS if preference allows
    if (shouldSendSms) {
      if (!config.ready) {
        // Log the SMS issue but don't bail out — email may still work
        console.warn("[Custom SMS] SMS provider not ready:", config.reason);
        results.sms = { error: config.reason || "SMS provider not configured" };

        // If ONLY SMS was requested (no email channel), then return the error
        if (!shouldSendEmail) {
          return Response.json(
            {
              error:
                config.reason ||
                "SMS provider not configured. Please set credentials in Settings.",
            },
            { status: 400 },
          );
        }
      } else {
        const normalizedPhone = toE164(phone);

        // Find conversation
        let conversationId = null;
        const existingConversation =
          await findConversationByPhone(normalizedPhone);

        if (existingConversation) {
          conversationId = existingConversation.id;
        } else if (clientId) {
          const [recentAppt] = await sql`
            SELECT id FROM appointments
            WHERE client_id = ${clientId} AND tenant_id = 1
            ORDER BY start_time DESC
            LIMIT 1
          `;

          if (recentAppt) {
            conversationId = await findOrCreateConversationForAppointment(
              recentAppt.id,
              1,
            );
          }
        }

        // Find recent appointment for logging
        let appointmentId = null;
        if (clientId) {
          const [recentAppt] = await sql`
            SELECT id FROM appointments
            WHERE client_id = ${clientId} AND tenant_id = 1
            ORDER BY start_time DESC
            LIMIT 1
          `;
          appointmentId = recentAppt?.id || null;
        }

        const smsResult = await sendSmsAndLog({
          to: phone,
          message,
          config,
          label: "Custom → Passenger",
          appointmentId,
          clientId,
          conversationId,
          senderName: businessName,
          recipientType: "passenger",
          notificationType: "custom_message",
          metadata: { is_admin_message: true },
        });

        if (smsResult.success) {
          results.sms = smsResult;
          console.log(
            `[Custom SMS] Sent to ${phone} via ${smsResult.provider}`,
          );
          if (conversationId) {
            await updateConversationTimestamp(conversationId);
          }
        } else {
          console.error("[Custom SMS] Error sending SMS:", smsResult.error);
          results.sms = { error: smsResult.error };
        }
      }
    }

    // Send Email if preference allows
    // Note: sendEmail has a built-in fallback from address, so fromAddress is optional
    if (shouldSendEmail) {
      try {
        const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="background:#2563eb;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p>
          <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">💬 Message from ${businessName}</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${message}</p>
            </div>
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">If you have any questions, feel free to reply to this email or contact us directly.</p>
          </div>
          <div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await sendEmail({
          to: passengerEmail,
          from: fromAddress,
          subject: `Message from ${businessName}`,
          text: `Hi ${firstName},\n\n${message}\n\nIf you have any questions, feel free to reply to this email or contact us directly.\n\n— ${businessName}`,
          html: emailHtml,
        });

        results.email = { success: true };
        console.log(`[Custom Email] Sent to ${passengerEmail}`);

        // Log email to email_logs table
        await sql`
          INSERT INTO email_logs (
            tenant_id, appointment_id, recipient_email, recipient_name, subject, body, status, email_type, metadata
          ) VALUES (
            1, NULL, ${passengerEmail}, ${passengerName}, ${"Message from " + businessName}, ${message}, 'sent', 'custom_message', ${JSON.stringify({ is_admin_message: true, client_id: clientId })}
          )
        `;
      } catch (emailError) {
        console.error("[Custom Email] Error sending email:", emailError);
        results.email = { error: emailError.message };
      }
    }

    // Return success if at least one channel succeeded
    const hasSuccess =
      results.sms?.success !== false || results.email?.success === true;

    return Response.json({
      success: hasSuccess,
      message: hasSuccess
        ? "Message sent successfully"
        : "Failed to send message",
      results,
      channels: {
        sms: shouldSendSms,
        email: shouldSendEmail,
      },
    });
  } catch (error) {
    console.error("[Custom Message] Error:", error);
    return Response.json(
      { error: error.message || "Failed to send message" },
      { status: 500 },
    );
  }
}
