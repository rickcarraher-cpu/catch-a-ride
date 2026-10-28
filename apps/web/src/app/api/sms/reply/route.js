import sql from "@/app/api/utils/sql";
import {
  sendSmsAndLog,
  sendSmsBatch,
  loadSmsConfig,
  toE164,
} from "@/app/api/utils/sms-sender";
import {
  findConversationByPhone,
  getConversationParticipants,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

/**
 * Reply to an SMS message
 * POST /api/sms/reply
 * Body: { phone: string, message: string, messageId?: number }
 */
export async function POST(request) {
  try {
    const { phone, message, messageId } = await request.json();

    if (!phone || !message) {
      return Response.json(
        { error: "Phone number and message are required" },
        { status: 400 },
      );
    }

    // Load SMS config once
    const config = await loadSmsConfig();

    if (!config.ready) {
      return Response.json(
        {
          error:
            config.reason ||
            "SMS provider not configured. Please set credentials in Settings.",
        },
        { status: 400 },
      );
    }

    // Load business name from settings
    const businessName = config.settings.business_name || "Catch A Ride";

    const normalizedPhone = toE164(phone);

    // ── Find Conversation and Send to All Participants ─────────────────────
    const conversation = await findConversationByPhone(normalizedPhone);

    if (conversation && conversation.participants.length > 1) {
      console.log(
        `[SMS Reply] Found conversation ${conversation.id} with ${conversation.participants.length} participants`,
      );

      // Send to ALL participants using batched sending (batches of 10)
      const allParticipants = conversation.participants;

      const jobs = allParticipants.map((participant) => ({
        to: participant.phone,
        message,
        config,
        label: "Reply",
        appointmentId: conversation.appointment_id,
        clientId: participant.client_id || null,
        conversationId: conversation.id,
        senderName: businessName,
        recipientType: participant.participant_type,
        notificationType: "admin_reply",
        metadata: {
          is_admin_reply: true,
          sent_to: participant.participant_type,
          recipient_name: participant.name,
        },
      }));

      // Throttled sequential send — 120 ms between each message, ~8/sec (Quo allows 10/sec)
      const batchResults = await sendSmsBatch({
        jobs,
        label: "Reply",
      });

      const successCount = batchResults.filter((r) => r.success).length;

      // Log per-participant results
      batchResults.forEach((result, i) => {
        const participant = allParticipants[i];
        if (result.success) {
          console.log(
            `[SMS Reply] Sent to ${participant.name} (${participant.phone})`,
          );
        } else {
          console.error(
            `[SMS Reply] Failed to send to ${participant.phone}: ${result.error}`,
          );
        }
      });

      // Update conversation timestamp
      if (successCount > 0) {
        await updateConversationTimestamp(conversation.id);
      }

      // Mark the original message as read if messageId provided
      if (messageId) {
        await sql`
          UPDATE sms_messages 
          SET read_at = CURRENT_TIMESTAMP 
          WHERE id = ${messageId} AND tenant_id = 1
        `;
      }

      return Response.json({
        success: true,
        message: `Reply sent to ${successCount} participant(s)`,
        recipientCount: successCount,
      });
    } else {
      // No conversation found - fall back to sending to the single recipient (legacy behavior)
      console.log(
        `[SMS Reply] No group conversation found - sending to single recipient ${normalizedPhone}`,
      );

      // Try to match phone to a client
      const clients =
        await sql`SELECT id, name, phone FROM clients WHERE tenant_id = 1`;
      const matchedClient = clients.find(
        (c) => c.phone && toE164(c.phone) === normalizedPhone,
      );

      let appointmentId = null;
      if (matchedClient) {
        const [recentAppt] = await sql`
          SELECT id FROM appointments
          WHERE client_id = ${matchedClient.id} AND tenant_id = 1
          ORDER BY start_time DESC
          LIMIT 1
        `;
        appointmentId = recentAppt?.id || null;
      }

      const result = await sendSmsAndLog({
        to: phone,
        message,
        config,
        label: "Reply",
        appointmentId,
        clientId: matchedClient?.id || null,
        senderName: businessName,
        recipientType: "passenger",
        notificationType: "admin_reply",
        metadata: { is_admin_reply: true, recipient_name: matchedClient?.name },
      });

      if (!result.success) {
        return Response.json(
          { error: result.error || "Failed to send reply" },
          { status: 500 },
        );
      }

      console.log(`[SMS Reply] Sent to ${phone}`);

      // Mark the original message as read if messageId provided
      if (messageId) {
        await sql`
          UPDATE sms_messages 
          SET read_at = CURRENT_TIMESTAMP 
          WHERE id = ${messageId} AND tenant_id = 1
        `;
      }

      return Response.json({
        success: true,
        message: "Reply sent successfully",
      });
    }
  } catch (error) {
    console.error("[SMS Reply] Error:", error);
    return Response.json(
      { error: error.message || "Failed to send reply" },
      { status: 500 },
    );
  }
}
