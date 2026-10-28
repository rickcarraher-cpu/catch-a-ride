import sql from "@/app/api/utils/sql";
import { sendSmsAndLog, loadSmsConfig } from "@/app/api/utils/sms-sender";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendAfterHoursAlert } from "@/app/api/utils/afterHoursAlert";

export async function POST(req) {
  try {
    const { name, phone, email, message, is_urgent } = await req.json();

    console.log("[Message-Only] Received request:", {
      name,
      phone: phone ? "***" : null,
      email,
      hasMessage: !!message,
      is_urgent,
    });

    // Validate required fields
    if (!name?.trim()) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    if (!phone?.trim() && !email?.trim()) {
      return Response.json(
        { error: "Phone or email is required" },
        { status: 400 },
      );
    }

    if (!message?.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Check if a client with this phone or email already exists
    let clientId = null;
    let clientName = name.trim();

    if (phone?.trim()) {
      const phoneClean = phone.replace(/\D/g, "");
      if (phoneClean.length >= 10) {
        const existingByPhone = await sql`
          SELECT id, name FROM clients 
          WHERE phone LIKE ${"%" + phoneClean.slice(-10)}
          LIMIT 1
        `;
        if (existingByPhone.length > 0) {
          clientId = existingByPhone[0].id;
          clientName = existingByPhone[0].name;
        }
      }
    }

    if (!clientId && email?.trim()) {
      const existingByEmail = await sql`
        SELECT id, name FROM clients 
        WHERE LOWER(email) = ${email.trim().toLowerCase()}
        LIMIT 1
      `;
      if (existingByEmail.length > 0) {
        clientId = existingByEmail[0].id;
        clientName = existingByEmail[0].name;
      }
    }

    if (!clientId) {
      const newClient = await sql`
        INSERT INTO clients (name, phone, email, notes)
        VALUES (
          ${name.trim()},
          ${phone?.trim() || null},
          ${email?.trim() || null},
          ${"Message-only inquiry"}
        )
        RETURNING id, name
      `;
      clientId = newClient[0].id;
      clientName = newClient[0].name;
      console.log("[Message-Only] Created new client:", clientId);
    } else {
      console.log("[Message-Only] Found existing client:", clientId);
    }

    // ✅ Store the message as an INBOUND SMS — no appointment created
    let normalizedPhone = null;
    if (phone?.trim()) {
      const phoneClean = phone.replace(/\D/g, "");
      if (phoneClean.length >= 10) {
        normalizedPhone =
          phoneClean.length === 11 && phoneClean.startsWith("1")
            ? `+${phoneClean}`
            : `+1${phoneClean.slice(-10)}`;

        await sql`
          INSERT INTO sms_messages (
            tenant_id,
            appointment_id,
            client_id,
            direction,
            phone,
            message,
            sender_name,
            provider,
            is_urgent,
            metadata
          ) VALUES (
            1,
            NULL,
            ${clientId},
            'inbound',
            ${normalizedPhone},
            ${message.trim()},
            ${name.trim()},
            'BookingForm',
            ${is_urgent || false},
            ${JSON.stringify({ from_booking_form: true, email: email?.trim() || null })}
          )
        `;
        console.log(
          "[Message-Only] ✅ Stored inbound message (no appointment)",
        );
      }
    }

    // Get settings for notifications
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = {};
    settingsRows.forEach((row) => {
      settings[row.key] = row.value;
    });

    const ownerPhone = settings.owner_phone;
    const ownerEmail = settings.owner_email;
    const fromEmail = settings.from_email || "noreply@catcharide.com";
    const businessName = settings.business_name || "Catch A Ride";

    const smsConfig = await loadSmsConfig(settings);

    const urgentPrefix = is_urgent ? "🔴 URGENT MESSAGE: " : "";
    const notificationMessage = `${urgentPrefix}New message inquiry from online booking

Name: ${name}
Phone: ${phone || "Not provided"}
Email: ${email || "Not provided"}

Message:
${message.trim()}

${is_urgent ? "⚠️ This message was marked as URGENT by the sender." : ""}`;

    const notificationPromises = [];

    if (ownerPhone && smsConfig.ready) {
      notificationPromises.push(
        (async () => {
          try {
            const result = await sendSmsAndLog({
              to: ownerPhone,
              message: notificationMessage,
              config: smsConfig,
              label: "Message-Only→Owner",
              appointmentId: null,
              conversationId: null,
              senderName: "System",
              recipientType: "owner",
              notificationType: "message_inquiry",
              metadata: { is_urgent: is_urgent || false },
            });

            if (result.success) {
              console.log(
                `[Message-Only→Owner SMS] ✅ Sent to ${ownerPhone}${is_urgent ? " (URGENT)" : ""}`,
              );
            } else {
              console.error("[Message-Only→Owner SMS] Failed:", result.error);
            }
          } catch (smsErr) {
            console.error("[Message-Only→Owner SMS] Failed:", smsErr.message);
          }
        })(),
      );
    }

    if (ownerEmail && process.env.RESEND_API_KEY) {
      notificationPromises.push(
        (async () => {
          try {
            const emailSubject = `${is_urgent ? "🔴 URGENT: " : ""}New Message Inquiry — ${name}`;
            const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${businessName} — Message Inquiry</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="background:${is_urgent ? "#dc2626" : "#2563eb"};border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</p>
          <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">${is_urgent ? "🔴 URGENT " : ""}Message Inquiry</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
          <div style="padding:24px;">
            ${
              is_urgent
                ? `<div style="background:#fee2e2;border:2px solid #dc2626;border-radius:12px;padding:16px;margin-bottom:20px;text-align:center;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px;">⚠️ URGENT MESSAGE — NEEDS IMMEDIATE ATTENTION</p>
            </div>`
                : ""
            }
            <p style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:600;">New Message from ${name}</p>
            <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Name:</td>
                  <td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${name}</td>
                </tr>
                ${
                  phone
                    ? `<tr>
                  <td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Phone:</td>
                  <td style="padding:5px 0;font-size:14px;color:#2563eb;font-weight:700;text-align:right;"><a href="tel:${phone}" style="color:#2563eb;text-decoration:none;">${phone}</a></td>
                </tr>`
                    : ""
                }
                ${
                  email
                    ? `<tr>
                  <td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Email:</td>
                  <td style="padding:5px 0;font-size:13px;color:#2563eb;font-weight:500;text-align:right;"><a href="mailto:${email}" style="color:#2563eb;text-decoration:none;">${email}</a></td>
                </tr>`
                    : ""
                }
              </table>
            </div>
            <div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:12px;padding:20px 24px;">
              <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Message:</p>
              <p style="margin:0;font-size:16px;color:#111827;font-weight:700;line-height:1.8;white-space:pre-wrap;">${message.trim()}</p>
            </div>
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
              to: ownerEmail,
              from: fromEmail,
              subject: emailSubject,
              text: notificationMessage,
              html: emailHtml,
            });

            console.log(
              `[Message-Only→Owner Email] ✅ Sent to ${ownerEmail}${is_urgent ? " (URGENT)" : ""}`,
            );
          } catch (emailErr) {
            console.error(
              "[Message-Only→Owner Email] Failed:",
              emailErr.message,
            );
          }
        })(),
      );
    }

    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 10000));
    await Promise.race([
      Promise.allSettled(notificationPromises),
      timeoutPromise,
    ]);

    // After-hours alert
    try {
      await sendAfterHoursAlert({
        name,
        email,
        phone,
        type: "message",
        message: message.trim(),
        settings,
      });
    } catch (alertErr) {
      console.error(
        "[AfterHoursAlert] Message alert failed:",
        alertErr.message,
      );
    }

    console.log(
      "[Message-Only] Returning success response (no appointment created)",
    );

    return Response.json({
      success: true,
      client_name: clientName,
    });
  } catch (err) {
    console.error("Error handling message-only request:", err);
    return Response.json(
      { error: "Failed to submit message" },
      { status: 500 },
    );
  }
}
