/**
 * SMS Logging and Sending
 * Handles SMS logging to database and sending via configured provider
 */

import sql from "@/app/api/utils/sql";
import {
  sendSms as unifiedSendSms,
  loadSmsConfig,
} from "@/app/api/utils/sms-sender.js";

/**
 * Normalize phone to E.164 for logging
 */
function toE164ForLog(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Dedup window for appointment-level SMS deduplication.
 * Prevents the same notification type from being sent more than once
 * per appointment per recipient within this window.
 */
const APPOINTMENT_SMS_DEDUP_WINDOW_MINUTES = 5;

/**
 * Check if an SMS for this appointment + phone + eventType was already sent
 * within the dedup window. This catches the "rapid edit" scenario where a trip
 * is changed multiple times in quick succession — each edit would trigger a full
 * notification cycle but the recipient only needs one.
 *
 * Unlike the message-content dedup in sms-sender.js, this check works even when
 * the message content changes (e.g. time update changes the message body).
 *
 * @param {number} appointmentId
 * @param {string} phone
 * @param {string} eventType - e.g. "booking_changed"
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 * @returns {Promise<boolean>} true if a duplicate was detected (suppress the send)
 */
export async function wasRecentAppointmentSmsSent(
  appointmentId,
  phone,
  eventType,
  tenantId = 1,
) {
  if (!appointmentId || !phone || !eventType) return false;
  try {
    const normalizedPhone = toE164ForLog(phone) || phone;
    const rows = await sql(
      `SELECT id FROM sms_messages
       WHERE appointment_id = $1
         AND phone = $2
         AND direction = 'outbound'
         AND tenant_id = $3
         AND metadata->>'notification_type' = $4
         AND sent_at > NOW() - INTERVAL '${APPOINTMENT_SMS_DEDUP_WINDOW_MINUTES} minutes'
       LIMIT 1`,
      [appointmentId, normalizedPhone, tenantId, eventType],
    );
    return rows.length > 0;
  } catch (err) {
    // Fail open — if the check errors, let the message through
    console.error(
      "[wasRecentAppointmentSmsSent] Check failed (failing open):",
      err.message,
    );
    return false;
  }
}

/**
 * Log an outbound SMS to sms_messages table and notification_logs
 *
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function logSmsToDatabase({
  appointmentId,
  clientId,
  recipientType,
  recipientId,
  phone,
  message,
  senderName,
  eventType,
  provider,
  status,
  tenantId = 1,
}) {
  try {
    const normalizedPhone = toE164ForLog(phone) || phone;

    // Find conversation for this appointment
    let conversationId = null;
    if (appointmentId) {
      const convRows = await sql`
        SELECT id FROM conversations 
        WHERE appointment_id = ${appointmentId} AND tenant_id = ${tenantId}
        ORDER BY created_at DESC LIMIT 1
      `;
      if (convRows.length > 0) {
        conversationId = convRows[0].id;
      }
    }

    // Log to sms_messages table
    await sql`
      INSERT INTO sms_messages (
        tenant_id, appointment_id, client_id, conversation_id,
        direction, phone, message, sender_name, provider,
        metadata
      ) VALUES (
        ${tenantId}, ${appointmentId || null}, ${clientId || null}, ${conversationId},
        'outbound', ${normalizedPhone}, ${message}, ${senderName || "System"},
        ${provider || "ClickSend"},
        ${JSON.stringify({ notification_type: eventType, recipient: recipientType })}
      )
    `;

    // Update conversation timestamp if we have one
    if (conversationId) {
      await sql`
        UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP 
        WHERE id = ${conversationId}
      `;
    }

    // Log to notification_logs table
    await sql`
      INSERT INTO notification_logs (
        event_type, entity_type, entity_id,
        recipient_type, recipient_id,
        channel, to_address, status,
        provider, payload
      ) VALUES (
        ${eventType || "sms_sent"}, 'appointment', ${appointmentId || null},
        ${recipientType || "unknown"}, ${recipientId || null},
        'sms', ${normalizedPhone}, ${status || "sent"},
        ${provider || "ClickSend"},
        ${JSON.stringify({ message_preview: message.substring(0, 200) })}
      )
    `;

    console.log(
      `[logSmsToDatabase:tenant${tenantId}] ✅ SMS logged for ${recipientType} to ${normalizedPhone}`,
    );
  } catch (logErr) {
    console.error(
      `[logSmsToDatabase:tenant${tenantId}] Failed to log SMS:`,
      logErr,
    );
    // Don't throw — logging failure shouldn't break the flow
  }
}

/**
 * Send SMS using configured provider (now uses unified sender)
 *
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function sendSms(to, message, settings, tenantId = 1) {
  const config = await loadSmsConfig(settings, tenantId);

  console.log(
    `[sendSms:tenant${tenantId}] ========== SMS SEND ATTEMPT ==========`,
  );
  console.log(
    `[sendSms:tenant${tenantId}] Provider: "${config.provider}" (ready: ${config.ready})`,
  );
  console.log(`[sendSms:tenant${tenantId}] To: ${to}`);
  console.log(
    `[sendSms:tenant${tenantId}] Message length: ${message.length} chars`,
  );

  // Handle disabled provider
  if (config.disabled) {
    console.log(
      `[sendSms:tenant${tenantId}] ⏭️  SMS provider is disabled — skipping`,
    );
    return { success: false, skipped: true, reason: config.reason };
  }

  // Handle missing credentials — return error instead of throwing
  if (!config.ready) {
    console.error(`[sendSms:tenant${tenantId}] ❌ ${config.reason}`);
    return { success: false, skipped: false, reason: config.reason };
  }

  console.log(
    `[sendSms:tenant${tenantId}] ✅ Credentials look good — sending via unified sender...`,
  );

  const result = await unifiedSendSms({
    to,
    message,
    config,
    label: "Confirmation",
    tenantId,
  });

  if (!result.success) {
    if (result.skipped) {
      return { success: false, skipped: true, reason: result.reason };
    }
    return {
      success: false,
      skipped: false,
      reason: result.error || "SMS send failed",
    };
  }

  return { success: true, data: result.data || result };
}
