import sql from "@/app/api/utils/sql";

/**
 * Resend Webhook Handler
 * Receives delivery status updates from Resend
 *
 * Event types:
 * - email.sent: Email was accepted by the receiving server
 * - email.delivered: Email was successfully delivered
 * - email.delivery_delayed: Delivery is delayed
 * - email.complained: Recipient marked as spam
 * - email.bounced: Email bounced (hard or soft)
 * - email.opened: Email was opened (if tracking enabled)
 * - email.clicked: Link was clicked (if tracking enabled)
 */
export async function POST(request) {
  try {
    const event = await request.json();

    console.log("[Resend Webhook] Received event:", event.type);
    console.log(
      "[Resend Webhook] Event data:",
      JSON.stringify(event.data, null, 2),
    );

    const { type, data } = event;
    const emailId = data?.email_id;
    const recipient = data?.to?.[0] || data?.email;

    if (!emailId) {
      console.warn("[Resend Webhook] No email_id in event data");
      return Response.json({ received: true });
    }

    // Find the email log entry by Resend ID
    const [logEntry] = await sql`
      SELECT id, appointment_id, recipient_email
      FROM email_logs
      WHERE metadata->>'resend_id' = ${emailId}
      LIMIT 1
    `;

    if (!logEntry) {
      console.warn(
        `[Resend Webhook] No log entry found for Resend ID: ${emailId}`,
      );
      // Still return 200 to acknowledge receipt
      return Response.json({ received: true });
    }

    console.log(
      `[Resend Webhook] Found log entry ID: ${logEntry.id} for appointment: ${logEntry.appointment_id}`,
    );

    // Update the email log based on event type
    switch (type) {
      case "email.sent":
        await sql`
          UPDATE email_logs
          SET 
            status = 'sent',
            metadata = metadata || ${JSON.stringify({
              last_event: type,
              last_event_at: new Date().toISOString(),
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] ✅ Email ${emailId} sent to ${recipient}`,
        );
        break;

      case "email.delivered":
        await sql`
          UPDATE email_logs
          SET 
            status = 'delivered',
            metadata = metadata || ${JSON.stringify({
              last_event: type,
              last_event_at: new Date().toISOString(),
              delivered_at: new Date().toISOString(),
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] ✅ Email ${emailId} delivered to ${recipient}`,
        );
        break;

      case "email.delivery_delayed":
        await sql`
          UPDATE email_logs
          SET 
            status = 'delayed',
            metadata = metadata || ${JSON.stringify({
              last_event: type,
              last_event_at: new Date().toISOString(),
              delay_reason: data?.reason || "Unknown",
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] ⚠️ Email ${emailId} delivery delayed: ${data?.reason || "Unknown"}`,
        );
        break;

      case "email.bounced":
        const bounceType = data?.bounce_type || "unknown"; // 'hard' or 'soft'
        const bounceReason = data?.reason || data?.message || "Email bounced";

        await sql`
          UPDATE email_logs
          SET 
            status = 'bounced',
            error_message = ${bounceReason},
            metadata = metadata || ${JSON.stringify({
              last_event: type,
              last_event_at: new Date().toISOString(),
              bounce_type: bounceType,
              bounce_reason: bounceReason,
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] ❌ Email ${emailId} bounced (${bounceType}): ${bounceReason}`,
        );
        break;

      case "email.complained":
        await sql`
          UPDATE email_logs
          SET 
            status = 'complained',
            error_message = 'Recipient marked as spam',
            metadata = metadata || ${JSON.stringify({
              last_event: type,
              last_event_at: new Date().toISOString(),
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] ⚠️ Email ${emailId} marked as spam by ${recipient}`,
        );
        break;

      case "email.opened":
        await sql`
          UPDATE email_logs
          SET 
            metadata = metadata || ${JSON.stringify({
              opened: true,
              opened_at: new Date().toISOString(),
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] 👁️ Email ${emailId} opened by ${recipient}`,
        );
        break;

      case "email.clicked":
        await sql`
          UPDATE email_logs
          SET 
            metadata = metadata || ${JSON.stringify({
              clicked: true,
              clicked_at: new Date().toISOString(),
              clicked_url: data?.url || null,
            })}::jsonb
          WHERE id = ${logEntry.id}
        `;
        console.log(
          `[Resend Webhook] 🖱️ Email ${emailId} link clicked: ${data?.url || "unknown"}`,
        );
        break;

      default:
        console.log(`[Resend Webhook] Unknown event type: ${type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("[Resend Webhook] Error processing webhook:", error);
    // Return 200 anyway to prevent Resend from retrying
    return Response.json({ received: true, error: error.message });
  }
}
