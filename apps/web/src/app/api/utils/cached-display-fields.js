/**
 * Cached Display Fields
 * ────────────────────────────────────────────────────────────────────────
 * Computes and SAVES all display/formatted fields to the appointments table.
 *
 * ✅ This is called ONCE when a trip is created or updated
 * ✅ All downstream consumers (emails, SMS, reports, UI) read these pre-computed values
 * ✅ NO recalculation happens at runtime — the trip record is the single source of truth
 */

import sql from "@/app/api/utils/sql";
import {
  formatLongDate,
  formatShortDate,
  formatTime,
  formatFullDateTime,
  formatSmsDateTime,
  formatOfficeDateTime,
  toGCalDate,
  formatDateOnly,
  formatPaymentMethod,
} from "@/app/api/utils/notifications/formatters";

/**
 * Build formatted pickup address from structured fields
 */
function buildPickupAddress(trip) {
  const parts = [];
  if (trip.pickup_street) parts.push(trip.pickup_street);
  if (trip.pickup_city) parts.push(trip.pickup_city);
  if (trip.pickup_state) parts.push(trip.pickup_state);
  if (trip.pickup_zip) parts.push(trip.pickup_zip);
  if (parts.length > 0) return parts.join(", ");
  return trip.pickup_address || null;
}

/**
 * Build formatted dropoff address from structured fields
 */
function buildDropoffAddress(trip) {
  const parts = [];
  if (trip.dropoff_street) parts.push(trip.dropoff_street);
  if (trip.dropoff_city) parts.push(trip.dropoff_city);
  if (trip.dropoff_state) parts.push(trip.dropoff_state);
  if (trip.dropoff_zip) parts.push(trip.dropoff_zip);
  if (parts.length > 0) return parts.join(", ");
  return trip.dropoff_address || null;
}

/**
 * Compute and save ALL display fields for a trip
 * This runs ONCE when the trip is created or updated, and stores the results in the database
 */
export async function recalculateDisplayFields(appointmentId) {
  // Fetch current trip data
  const [trip] = await sql`
    SELECT * FROM appointments WHERE id = ${appointmentId}
  `;

  if (!trip) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  // Compute all display values from start_time
  const displayLongDate = formatLongDate(trip.start_time);
  const displayShortDate = formatShortDate(trip.start_time);
  const displayTime = formatTime(trip.start_time);
  const displayFullDatetime = formatFullDateTime(trip.start_time);
  const displaySmsDatetime = formatSmsDateTime(trip.start_time);
  const displayOfficeDatetime = formatOfficeDateTime(trip.start_time);
  const displayGcalDate = toGCalDate(trip.start_time);

  // Compute return date display if present
  const displayReturnDate = trip.return_date
    ? formatDateOnly(trip.return_date)
    : null;

  // Compute tour end time if present
  const displayTourEndTime = trip.tour_end_time
    ? formatTime(trip.tour_end_time)
    : null;

  // Format payment method
  const displayPaymentMethod = trip.payment_method
    ? formatPaymentMethod(trip.payment_method)
    : null;

  // Build formatted addresses
  const displayPickupAddress = buildPickupAddress(trip);
  const displayDropoffAddress = buildDropoffAddress(trip);

  // Save all display fields to the database in a single UPDATE
  await sql`
    UPDATE appointments
    SET 
      display_long_date = ${displayLongDate},
      display_short_date = ${displayShortDate},
      display_time = ${displayTime},
      display_full_datetime = ${displayFullDatetime},
      display_sms_datetime = ${displaySmsDatetime},
      display_office_datetime = ${displayOfficeDatetime},
      display_gcal_date = ${displayGcalDate},
      display_return_date = ${displayReturnDate},
      display_tour_end_time = ${displayTourEndTime},
      display_payment_method = ${displayPaymentMethod},
      display_pickup_address = ${displayPickupAddress},
      display_dropoff_address = ${displayDropoffAddress}
    WHERE id = ${appointmentId}
  `;

  console.log(
    `[Cached Display Fields] Saved display fields for trip #${appointmentId}`,
  );
}
