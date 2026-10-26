/**
 * Logs a communication failure to the database so the dispatcher
 * sees a persistent alert popup until they acknowledge it.
 */
import sql from "@/app/api/utils/sql";

export async function logCommunicationFailure({
  appointmentId,
  bookingNumber,
  passengerName,
  driverName,
  channel, // 'email' | 'sms'
  recipientType, // 'passenger' | 'driver' | 'office'
  recipientAddress, // the email or phone that failed
  eventType,
  errorMessage,
  tripDate,
}) {
  try {
    await sql`
      INSERT INTO communication_failures
        (appointment_id, booking_number, passenger_name, driver_name,
         channel, recipient_type, recipient_address, event_type,
         error_message, trip_date)
      VALUES
        (${appointmentId || null}, ${bookingNumber || null}, ${passengerName || null},
         ${driverName || null}, ${channel}, ${recipientType},
         ${recipientAddress || null}, ${eventType || null},
         ${errorMessage || null}, ${tripDate || null})
    `;
    console.log(
      `[FailureLogger] ⚠️ Recorded ${channel} failure for ${recipientType} on trip #${bookingNumber || appointmentId}`,
    );
  } catch (logErr) {
    // Don't let logging itself crash the flow
    console.error(
      "[FailureLogger] Failed to log communication failure:",
      logErr,
    );
  }
}
