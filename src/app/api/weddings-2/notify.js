import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSms } from "@/app/api/utils/sms-sender";

const COMPANY = "Catch A Ride";

// Rough per-vehicle estimate used when the customer gives us a vehicle count.
// If they pick "Not sure – help me decide", we flag for a custom quote instead.
export function estimateWeddingPrice(w) {
  if (w.vehicles_not_sure || !w.vehicles_needed) return null;
  return Number(w.vehicles_needed) * 150;
}

export function buildSummaryText(w) {
  const lines = [];
  lines.push(`Booking Reference: ${w.reference_code}`);
  lines.push(`Wedding Date: ${w.wedding_date}`);
  lines.push(
    `Ceremony: ${w.ceremony_time || "TBD"} — ${
      w.ceremony_venue_name || w.ceremony_address || "TBD"
    }`,
  );
  if (w.reception_same_as_ceremony) {
    lines.push(`Reception: Same location as ceremony`);
  } else {
    lines.push(
      `Reception: ${w.reception_time || "TBD"} — ${
        w.reception_venue_name || w.reception_address || "TBD"
      }`,
    );
  }
  lines.push(
    `Vehicles Needed: ${
      w.vehicles_not_sure ? "Not sure — help me decide" : w.vehicles_needed
    }`,
  );
  lines.push(`Estimated Passengers: ${w.estimated_passengers ?? "TBD"}`);
  lines.push(`Contact: ${w.primary_contact_name} — ${w.primary_contact_phone}`);
  return lines.join("\n");
}

function emailShell(title, bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #fce7f3;">
    <div style="background:linear-gradient(90deg,#db2777,#f43f5e);padding:24px 28px;">
      <div style="color:#ffffff;font-size:22px;font-weight:bold;">${COMPANY} 💒</div>
      <div style="color:#fbcfe8;font-size:14px;margin-top:4px;">${title}</div>
    </div>
    <div style="padding:28px;color:#374151;font-size:14px;line-height:1.6;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;background:#fdf2f8;color:#9ca3af;font-size:11px;">
      ${COMPANY} · Wedding Transportation · Reply STOP to opt out of text messages. Reply HELP for help.
    </div>
  </div>`;
}

function buildMessage(type, w) {
  const est = estimateWeddingPrice(w);
  const estStr = est ? `$${est.toFixed(0)} (estimate)` : "Custom quote";
  const summary = buildSummaryText(w);
  const summaryHtml = summary
    .split("\n")
    .map(
      (l) =>
        `<div style="padding:6px 0;border-bottom:1px solid #fce7f3;"><strong>${
          l.split(":")[0]
        }:</strong> ${l.split(":").slice(1).join(":").trim()}</div>`,
    )
    .join("");

  switch (type) {
    case "booking_received":
      return {
        subject: `Wedding Booking Received — ${w.reference_code}`,
        emailHtml: emailShell(
          "Wedding Booking Received",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Thank you! We've received your wedding transportation request. Here's what we have on file:</p>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px 16px;margin:16px 0;">${summaryHtml}</div>
           <p><strong>What happens next:</strong></p>
           <ul>
             <li>We'll review your details and prepare your quote — usually within 2 business hours.</li>
             <li>Once you approve the quote, we'll send a deposit request to lock in your date.</li>
             <li>A driver and vehicle are assigned as your date approaches.</li>
           </ul>
           <p>Questions? Just reply to this email or text us.</p>`,
        ),
        emailText: `Wedding booking received! Reference ${w.reference_code}.\n\n${summary}\n\nWe'll contact you within 2 business hours with your quote.`,
        smsText: `${COMPANY}: Wedding booking received! Ref ${w.reference_code} for ${w.wedding_date}. We'll text/email your quote within 2 business hrs. Reply STOP to opt out`,
      };
    case "quote_ready":
      return {
        subject: `Your Wedding Quote is Ready — ${w.reference_code}`,
        emailHtml: emailShell(
          "Your Wedding Quote Is Ready",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Your quote for wedding transportation on <strong>${w.wedding_date}</strong> is ready:</p>
           <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
             <div style="font-size:32px;font-weight:bold;color:#047857;">$${Number(
               w.estimated_price || 0,
             ).toFixed(2)}</div>
             <div style="color:#059669;font-size:12px;margin-top:4px;">Estimated total · ${w.vehicles_needed} vehicle(s)</div>
           </div>
           <p>To confirm your date, we require a deposit. Reply to this message or call us and we'll send your secure deposit payment link.</p>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px 16px;margin:16px 0;">${summaryHtml}</div>`,
        ),
        emailText: `Your wedding quote is ready! Reference ${w.reference_code}.\nEstimated total: $${Number(
          w.estimated_price || 0,
        ).toFixed(
          2,
        )}\n\n${summary}\n\nReply to approve and we'll send your deposit link.`,
        smsText: `${COMPANY}: Your wedding quote for ${w.wedding_date} is ready! Est $${Number(
          w.estimated_price || 0,
        ).toFixed(
          0,
        )}. Ref ${w.reference_code}. Reply or call to approve & get your deposit link. STOP to opt out`,
      };
    case "deposit_confirmed":
      return {
        subject: `Deposit Received — Your Wedding is Confirmed! ${w.reference_code}`,
        emailHtml: emailShell(
          "Booking Confirmed 🎉",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Great news — your deposit has been received and your wedding transportation is <strong>confirmed</strong> for <strong>${w.wedding_date}</strong>!</p>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px 16px;margin:16px 0;">${summaryHtml}</div>
           <p>We'll assign your driver and vehicle as the date approaches and send you their details ahead of time.</p>`,
        ),
        emailText: `Deposit received — your wedding transportation is CONFIRMED for ${w.wedding_date}. Reference ${w.reference_code}.\n\n${summary}`,
        smsText: `${COMPANY}: Deposit received — your wedding on ${w.wedding_date} is CONFIRMED! Ref ${w.reference_code}. Driver details to follow. STOP to opt out`,
      };
    case "driver_assigned":
      return {
        subject: `Your Driver is Assigned — ${w.reference_code}`,
        emailHtml: emailShell(
          "Driver Assigned",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Your driver for <strong>${w.wedding_date}</strong> has been assigned:</p>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:16px;margin:16px 0;">
             <div style="font-size:18px;font-weight:bold;color:#db2777;">${w.driver_name || "Your driver"}</div>
             ${w.vehicle_details ? `<div style="margin-top:6px;">🚗 ${w.vehicle_details}</div>` : ""}
           </div>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px 16px;margin:16px 0;">${summaryHtml}</div>
           <p>You'll receive a reminder the day before your event.</p>`,
        ),
        emailText: `Driver assigned for your wedding on ${w.wedding_date}: ${
          w.driver_name || "TBD"
        }${w.vehicle_details ? ` — ${w.vehicle_details}` : ""}. Reference ${
          w.reference_code
        }.\n\n${summary}`,
        smsText: `${COMPANY}: Driver assigned for ${w.wedding_date}: ${
          w.driver_name || "TBD"
        }${w.vehicle_details ? ` (${w.vehicle_details})` : ""}. Ref ${
          w.reference_code
        }. STOP to opt out`,
      };
    case "day_before_reminder":
      return {
        subject: `Tomorrow's the Big Day! — ${w.reference_code}`,
        emailHtml: emailShell(
          "Day-Before Reminder",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Just a friendly reminder that your wedding transportation is <strong>tomorrow</strong>, ${w.wedding_date}!</p>
           <div style="background:#fdf2f8;border:1px solid #fbcfe8;border-radius:8px;padding:12px 16px;margin:16px 0;">${summaryHtml}</div>
           <p>Your driver ${w.driver_name ? `<strong>${w.driver_name}</strong>` : ""} will arrive ahead of schedule. Congratulations!</p>`,
        ),
        emailText: `Reminder: your wedding transportation is tomorrow, ${w.wedding_date}. Reference ${w.reference_code}.\n\n${summary}`,
        smsText: `${COMPANY}: Tomorrow's the big day! Your wedding transport is set for ${w.wedding_date}. Ref ${w.reference_code}. Congratulations! STOP to opt out`,
      };
    case "thank_you":
      return {
        subject: `Thank You! — ${w.reference_code}`,
        emailHtml: emailShell(
          "Thank You 💐",
          `<p>Hi ${w.primary_contact_name || "there"},</p>
           <p>Thank you for letting ${COMPANY} be part of your special day. It was an honor to transport you and your guests.</p>
           <p>If you have a moment, we'd love a quick review — it means the world to our drivers!</p>
           <p>Wishing you a lifetime of happiness! 💐</p>`,
        ),
        emailText: `Thank you for choosing ${COMPANY} for your wedding transportation! We'd love a quick review if you have a moment.`,
        smsText: `${COMPANY}: Thank you for letting us be part of your special day! 💐 A quick review would mean the world: [review link]. STOP to opt out`,
      };
    default:
      return {
        subject: `Wedding Update — ${w.reference_code}`,
        emailHtml: emailShell("Wedding Update", `<p>${summaryHtml}</p>`),
        emailText: summary,
        smsText: `${COMPANY}: Update on your wedding booking ${w.reference_code}. STOP to opt out`,
      };
  }
}

/**
 * Send a wedding notification honoring the booking's contact preference.
 * preference: email_sms | email_only | sms_only | none
 */
export async function sendWeddingNotification(wedding, type) {
  const pref = wedding.contact_preference || "email_sms";
  const result = { email: false, sms: false, skipped: pref === "none" };

  if (pref === "none") {
    console.log(
      `[Weddings2] Contact preference is 'none' — skipping ${type} for ${wedding.reference_code}`,
    );
    return result;
  }

  const msg = buildMessage(type, wedding);

  try {
    if (
      (pref === "email_sms" || pref === "email_only") &&
      wedding.contact_email
    ) {
      await sendEmail({
        to: wedding.contact_email,
        subject: msg.subject,
        html: msg.emailHtml,
        text: msg.emailText,
        emailType: `wedding2_${type}`,
        recipientName: wedding.primary_contact_name,
      });
      result.email = true;
    }
  } catch (err) {
    console.error(
      `[Weddings2] Email failed for ${wedding.reference_code}:`,
      err.message,
    );
  }

  try {
    if (
      (pref === "email_sms" || pref === "sms_only") &&
      wedding.primary_contact_phone
    ) {
      await sendSms({
        to: wedding.primary_contact_phone,
        message: msg.smsText,
      });
      result.sms = true;
    }
  } catch (err) {
    console.error(
      `[Weddings2] SMS failed for ${wedding.reference_code}:`,
      err.message,
    );
  }

  // Record the send in notification_state for the admin view
  try {
    const state = wedding.notification_state || {};
    state[`${type}_${Date.now()}`] = {
      type,
      at: new Date().toISOString(),
      email: result.email,
      sms: result.sms,
      skipped: result.skipped,
    };
    await sql`UPDATE wedding_bookings_2
              SET notification_state = ${JSON.stringify(state)}::jsonb
              WHERE id = ${wedding.id}`;
  } catch (err) {
    console.error("[Weddings2] Failed to record notification state:", err);
  }

  return result;
}
