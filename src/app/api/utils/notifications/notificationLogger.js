import sql from "@/app/api/utils/sql";
import { randomBytes } from "crypto";

/**
 * Creates a notification log entry in the database
 * @param {Object} params - Log parameters
 * @param {string} params.eventType - Type of event (booking_created, booking_changed, etc.)
 * @param {number} params.entityId - Appointment/trip ID
 * @param {string} params.recipientType - passenger, driver, or admin
 * @param {number} params.recipientId - Client or employee ID
 * @param {string} params.channel - sms or email
 * @param {string} params.toAddress - Phone number or email address
 * @param {string} params.status - success, failure, suppressed, or skipped
 * @param {string} params.provider - twilio, sendgrid, clicksend, quo, etc.
 * @param {string} params.providerMessageId - Message ID from provider
 * @param {string} params.errorCode - Error code if failed
 * @param {string} params.errorMessage - Error message if failed
 * @param {Object} params.payload - Safe, redacted payload (no secrets)
 * @param {string} params.correlationId - Groups related notification attempts
 * @param {boolean} params.sendNotificationFlag - Value of send_notification flag
 * @param {Object} params.metadata - Additional context (balance_due, payment_link_included, etc.)
 */
export async function logNotificationAttempt({
  eventType,
  entityId,
  recipientType,
  recipientId,
  channel,
  toAddress,
  status,
  provider = null,
  providerMessageId = null,
  errorCode = null,
  errorMessage = null,
  payload = null,
  correlationId = null,
  sendNotificationFlag = true,
  metadata = null,
}) {
  try {
    // Generate idempotency key to prevent duplicate logs
    const idempotencyKey = `${eventType}:${entityId}:${recipientId || toAddress}:${channel}:${Date.now()}`;

    const [logEntry] = await sql`
      INSERT INTO notification_logs (
        event_type,
        entity_type,
        entity_id,
        recipient_type,
        recipient_id,
        channel,
        to_address,
        status,
        provider,
        provider_message_id,
        error_code,
        error_message,
        payload,
        idempotency_key,
        correlation_id,
        send_notification_flag,
        metadata
      ) VALUES (
        ${eventType},
        'appointment',
        ${entityId},
        ${recipientType},
        ${recipientId},
        ${channel},
        ${toAddress},
        ${status},
        ${provider},
        ${providerMessageId},
        ${errorCode},
        ${errorMessage},
        ${payload ? JSON.stringify(payload) : null},
        ${idempotencyKey},
        ${correlationId},
        ${sendNotificationFlag},
        ${metadata ? JSON.stringify(metadata) : null}
      )
      RETURNING id
    `;

    return logEntry.id;
  } catch (error) {
    // Don't let logging failures break notifications
    console.error(
      "[notificationLogger] Failed to log notification:",
      error.message,
    );
    return null;
  }
}

/**
 * Generates a correlation ID to link related notification attempts
 */
export function generateCorrelationId() {
  return randomBytes(16).toString("hex");
}

/**
 * Logs a suppressed notification (when send_notification=false)
 */
export async function logSuppressedNotification({
  eventType,
  entityId,
  recipientType,
  recipientId,
  channel,
  toAddress,
  reason = "send_notification flag set to false",
}) {
  return logNotificationAttempt({
    eventType,
    entityId,
    recipientType,
    recipientId,
    channel,
    toAddress,
    status: "suppressed",
    sendNotificationFlag: false,
    metadata: { suppression_reason: reason },
  });
}
