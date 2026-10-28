import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSmsAndLog, loadSmsConfig } from "@/app/api/utils/sms-sender";
import { findOrCreateConversationForAppointment } from "@/app/api/utils/conversations";

// POST - Generate and send individual payment links to all tour participants
export async function POST(request, { params }) {
  try {
    const { id: appointmentId } = params;
    const body = await request.json();
    const { provider = "square" } = body; // square, venmo, or zelle

    // Fetch the tour appointment
    const [trip] = await sql`
      SELECT 
        a.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        e.name as employee_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ${appointmentId}
    `;

    if (!trip) {
      return Response.json({ error: "Tour not found" }, { status: 404 });
    }

    if (!trip.is_tour) {
      return Response.json({ error: "This is not a tour" }, { status: 400 });
    }

    if (trip.tour_payment_split !== "divided") {
      return Response.json(
        { error: "This tour is not set to divided payment" },
        { status: 400 },
      );
    }

    // Fetch all tour participants
    const participants = await sql`
      SELECT * FROM tour_participants
      WHERE appointment_id = ${appointmentId}
      ORDER BY id
    `;

    if (participants.length === 0) {
      return Response.json(
        { error: "No participants found for this tour" },
        { status: 400 },
      );
    }

    // Calculate per-person share
    const flatFee = Number(trip.tour_flat_fee || 0);
    const participantCount = participants.length;
    const perPersonShare = Math.ceil(flatFee / participantCount);

    if (perPersonShare <= 0) {
      return Response.json(
        { error: "Tour flat fee must be greater than 0" },
        { status: 400 },
      );
    }

    // Fetch settings for SMS/email
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = ${trip.tenant_id || 1}`;
    const settings = Object.fromEntries(
      settingsRows.map((r) => [r.key, r.value]),
    );

    const businessName = settings.business_name || "Catch A Ride";
    const fromEmail = settings.from_email || "noreply@catcharide.us";
    const baseUrl = (
      process.env.NEXT_PUBLIC_CREATE_APP_URL ||
      process.env.AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      ""
    ).replace(/\/+$/, "");

    // Load SMS config
    const smsConfig = await loadSmsConfig();

    const results = [];

    // Generate payment link for each participant
    for (const participant of participants) {
      try {
        // Check if participant already has an active payment link
        const existingPayment = await sql`
          SELECT * FROM payments
          WHERE appointment_id = ${appointmentId}
            AND tour_participant_id = ${participant.id}
            AND status IN ('pending', 'link_created')
          ORDER BY created_at DESC
          LIMIT 1
        `;

        let paymentUrl = null;
        let paymentId = null;

        if (existingPayment.length > 0) {
          // Use existing link
          paymentUrl = existingPayment[0].payment_url;
          paymentId = existingPayment[0].id;
        } else {
          // Create new payment record
          const [newPayment] = await sql`
            INSERT INTO payments (
              appointment_id,
              tour_participant_id,
              provider,
              status,
              amount,
              currency,
              metadata
            ) VALUES (
              ${appointmentId},
              ${participant.id},
              ${provider},
              'pending',
              ${perPersonShare},
              'USD',
              ${JSON.stringify({
                participant_name: participant.name,
                per_person_share: perPersonShare,
                total_participants: participantCount,
              })}
            )
            RETURNING *
          `;

          paymentId = newPayment.id;

          // Generate payment link based on provider
          if (provider === "square") {
            // Call Square checkout API
            const squareRes = await fetch(
              `${baseUrl}/api/payments/square/checkout`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payment_id: paymentId,
                  amount: perPersonShare,
                  description: `Tour #${trip.booking_number} - ${participant.name}'s share`,
                  redirect_url: `${baseUrl}/payment-complete?payment_id=${paymentId}`,
                }),
              },
            );

            if (!squareRes.ok) {
              throw new Error("Failed to create Square checkout");
            }

            const squareData = await squareRes.json();
            paymentUrl = squareData.payment_url;

            // Update payment record with URL
            await sql`
              UPDATE payments
              SET payment_url = ${paymentUrl},
                  status = 'link_created',
                  external_reference_id = ${squareData.checkout_id || null}
              WHERE id = ${paymentId}
            `;
          } else if (provider === "venmo") {
            // Generate Venmo link
            const venmoUsername = settings.venmo_username || "Catch_A_Ride";
            paymentUrl = `https://venmo.com/${venmoUsername}?txn=pay&amount=${perPersonShare.toFixed(2)}&note=Tour%20%23${trip.booking_number}%20-%20${encodeURIComponent(participant.name)}`;

            await sql`
              UPDATE payments
              SET payment_url = ${paymentUrl},
                  status = 'link_created'
              WHERE id = ${paymentId}
            `;
          } else if (provider === "zelle") {
            // Generate Zelle payment page link
            paymentUrl = `${baseUrl}/pay/zelle/${paymentId}`;

            await sql`
              UPDATE payments
              SET payment_url = ${paymentUrl},
                  status = 'link_created'
              WHERE id = ${paymentId}
            `;
          }
        }

        // Send SMS if participant has phone
        let smsSent = false;
        if (participant.phone && smsConfig.ready) {
          const smsMessage = `${businessName}: Your share for tour #${trip.booking_number} on ${formatShortDate(trip.start_time)} is $${perPersonShare.toFixed(2)}. Pay here: ${paymentUrl}\n\nText STOP to unsub`;

          const conversationId = await findOrCreateConversationForAppointment(
            appointmentId,
            trip.tenant_id || 1,
          );

          const smsResult = await sendSmsAndLog({
            to: participant.phone,
            message: smsMessage,
            config: smsConfig,
            label: `${smsConfig.provider}→Tour Participant`,
            appointmentId,
            clientId: participant.client_id || null,
            conversationId,
            senderName: participant.name,
            recipientType: "passenger",
            notificationType: "tour_payment_link",
          });

          smsSent = smsResult.success;
        }

        // Send Email if participant has email
        let emailSent = false;
        if (participant.email) {
          const emailSubject = `Your Payment Link — Tour #${trip.booking_number}`;
          const emailBody = `Hi ${participant.name},\n\nYour share for the tour on ${formatLongDate(trip.start_time)} is $${perPersonShare.toFixed(2)}.\n\nPay online here:\n${paymentUrl}\n\nThank you!\n— ${businessName}`;

          const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><tr><td style="background:#3b82f6;border-radius:12px 12px 0 0;padding:20px;text-align:center;"><p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-top:8px;">Tour Payment</span></td></tr><tr><td style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${participant.name},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Your share for the tour on <strong>${formatLongDate(trip.start_time)}</strong> is <strong style="color:#3b82f6;">$${perPersonShare.toFixed(2)}</strong>.</p><div style="text-align:center;margin:24px 0;"><a href="${paymentUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">Pay Now</a></div><p style="margin:16px 0 0;font-size:12px;color:#6b7280;">Or copy this link: <a href="${paymentUrl}" style="color:#3b82f6;word-break:break-all;">${paymentUrl}</a></p></td></tr><tr><td style="border-top:1px solid #f3f4f6;padding:16px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName}</p></td></tr></table></td></tr></table></body></html>`;

          try {
            await sendEmail({
              to: participant.email,
              from: fromEmail,
              subject: emailSubject,
              text: emailBody,
              html: emailHtml,
            });
            emailSent = true;
          } catch (emailErr) {
            console.error(
              `Failed to send email to ${participant.email}:`,
              emailErr,
            );
          }
        }

        results.push({
          participant_id: participant.id,
          participant_name: participant.name,
          amount: perPersonShare,
          payment_url: paymentUrl,
          sms_sent: smsSent,
          email_sent: emailSent,
        });
      } catch (err) {
        console.error(`Error processing participant ${participant.id}:`, err);
        results.push({
          participant_id: participant.id,
          participant_name: participant.name,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      per_person_share: perPersonShare,
      total_participants: participantCount,
      results,
    });
  } catch (error) {
    console.error("Error sending tour payment links:", error);
    return Response.json(
      { error: "Failed to send payment links" },
      { status: 500 },
    );
  }
}

// Helper functions
function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatLongDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
