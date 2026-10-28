import sql from "@/app/api/utils/sql";

/**
 * Write an entry to the change_log table.
 * Safe to call from any route — failures are swallowed so they never break the main flow.
 */
export async function logChange({
  appointmentId = null,
  bookingNumber = null,
  actionType, // 'created' | 'updated' | 'cancelled' | 'completed' | 'deleted'
  changedFields = [], // array of string labels, e.g. ['Driver', 'Date']
  changedBy = "unknown",
  passengerName = null,
  notes = null,
  tenantId = 1,
}) {
  try {
    await sql`
      INSERT INTO change_log
        (tenant_id, appointment_id, booking_number, action_type, changed_fields, changed_by, passenger_name, notes)
      VALUES
        (${tenantId}, ${appointmentId || null}, ${bookingNumber || null}, ${actionType},
         ${changedFields.length ? changedFields : null}, ${changedBy}, ${passengerName || null}, ${notes || null})
    `;
  } catch (err) {
    // Never let change-log failures break other operations
    console.error("[ChangeLog] Failed to write log entry:", err.message);
  }
}
