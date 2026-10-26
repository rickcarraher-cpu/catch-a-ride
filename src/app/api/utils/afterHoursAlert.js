/**
 * After-Hours Alert Utility
 *
 * Sends an SMS to the business phone when a passenger submits a booking
 * or message outside of configured business hours.
 */

import sql from "@/app/api/utils/sql";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

/**
 * Get current time in America/Chicago as "HH:MM" (24-hour, zero-padded).
 */
function getCurrentCentralTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = (parts.find((p) => p.type === "hour")?.value || "12").replace(
    "24",
    "00",
  );
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/**
 * Send an after-hours alert SMS to the business phone.
 *
 * @param {object} options
 * @param {string} options.name         - Passenger name
 * @param {string} [options.email]      - Passenger email
 * @param {string} [options.phone]      - Passenger phone
 * @param {'booking'|'message'} options.type - Type of submission
 * @param {string} [options.message]    - Message content (for message-type submissions)
 * @param {object} [options.settings]   - Pre-loaded settings object (avoids extra DB query)
 * @param {number} [options.appointmentId] - Appointment ID (for booking-type submissions)
 * @param {number} [options.clientId]   - Client ID (for booking-type submissions)
 * @param {number} [options.tenantId]   - Tenant ID (defaults to 1 for backward compatibility)
 */
export async function sendAfterHoursAlert({
  name,
  email,
  phone,
  type,
  message = null,
  settings = null,
  appointmentId = null,
  clientId = null,
  tenantId = 1,
}) {
  try {
    // Load settings if not provided
    if (!settings) {
      const rows =
        await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`;
      settings = {};
      rows.forEach((r) => {
        settings[r.key] = r.value;
      });
    }

    const businessHoursStart = settings.business_hours_start || "06:00";
    const businessHoursEnd = settings.business_hours_end || "20:00";
    const businessPhone = settings.business_phone;

    if (!businessPhone) {
      console.log(
        `[AfterHoursAlert:tenant${tenantId}] No business_phone configured — skipping`,
      );
      return;
    }

    // Check if currently after hours
    const currentTime = getCurrentCentralTime();
    const isAfterHours =
      currentTime < businessHoursStart || currentTime >= businessHoursEnd;

    if (!isAfterHours) {
      console.log(
        `[AfterHoursAlert:tenant${tenantId}] Within business hours (${currentTime}) — no alert needed`,
      );
      return;
    }

    console.log(
      `[AfterHoursAlert:tenant${tenantId}] 🌙 After-hours submission at ${currentTime} (hours: ${businessHoursStart}–${businessHoursEnd}). Sending alert to ${businessPhone}`,
    );

    const typeLabel = type === "message" ? "Message" : "Booking Request";

    const lines = [
      `A Passenger has sent you a message after hours.`,
      `Name: ${name || "Unknown"}`,
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null,
      `Type: ${typeLabel}`,
      message ? `\nMessage: ${message}` : null,
    ].filter(Boolean);

    const smsBody = lines.join("\n");

    const smsConfig = await loadSmsConfig(settings, tenantId);
    if (!smsConfig.ready) {
      console.log(
        `[AfterHoursAlert:tenant${tenantId}] SMS not ready — ${smsConfig.reason}. Skipping.`,
      );
      return;
    }

    await sendSms({
      to: businessPhone,
      message: smsBody,
      config: smsConfig,
      label: "AfterHours",
      tenantId,
    });

    console.log(
      `[AfterHoursAlert:tenant${tenantId}] ✅ After-hours alert sent to ${businessPhone}`,
    );

    // NEW: Create inbound SMS record for after-hours bookings so they trigger the online booking modal
    if (type === "booking" && clientId && phone) {
      try {
        // Normalize phone number
        const phoneClean = phone.replace(/\D/g, "");
        if (phoneClean.length >= 10) {
          const normalizedPhone =
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
              ${tenantId},
              ${appointmentId},
              ${clientId},
              'inbound',
              ${normalizedPhone},
              ${"After-hours online booking request"},
              ${name || "Unknown"},
              'BookingForm',
              true,
              ${JSON.stringify({
                from_booking_form: true,
                after_hours: true,
                email: email || null,
              })}
            )
          `;
          console.log(
            `[AfterHoursAlert:tenant${tenantId}] ✅ Created inbound SMS record for after-hours booking (appointment #${appointmentId})`,
          );
        }
      } catch (smsRecordErr) {
        console.error(
          `[AfterHoursAlert:tenant${tenantId}] Failed to create inbound SMS record:`,
          smsRecordErr.message,
        );
        // Don't fail the whole alert
      }
    }
  } catch (err) {
    console.error(
      `[AfterHoursAlert:tenant${tenantId}] Failed to send alert:`,
      err.message,
    );
    // Never throw — this is a best-effort notification
  }
}
