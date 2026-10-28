/**
 * SMS Message Builders
 * Builds SMS messages for passengers and drivers
 */

import { buildContactAdvisorySms } from "./settingsHelpers.js";
import { formatSmsDateTime } from "../notifications/formatters.js";

const DO_NOT_REPLY = "Do Not Reply Directly To This Text. ";

/**
 * Build passenger SMS message
 */
export function buildPassengerSms(data, urls, eventType, changedFields = []) {
  const { trip, balance, paymentUrl } = data;
  const settings = data.settings;
  const businessName = settings.business_name || "Catch A Ride";
  const businessPhone = settings.business_phone || "";
  const advisory = buildContactAdvisorySms(settings);

  // Detect if this was a passenger-submitted booking request
  const isPassengerBooking =
    trip.booked_by === "Passenger" || trip.status === "needs_review";

  // Simplified SMS for passenger-submitted bookings
  if (isPassengerBooking && eventType === "booking_created") {
    let message = `${DO_NOT_REPLY}${businessName}: Your booking request has been received. Once we review it, you will hear back from us.`;
    if (businessPhone) {
      message += ` Questions? Please call ${businessPhone}`;
    }
    return message + advisory;
  }

  // Cancellation — keep short
  if (eventType === "booking_cancelled" || eventType === "booking_deleted") {
    return (
      `${DO_NOT_REPLY}${businessName}: #${trip.booking_number || trip.id} cancelled. Questions? Contact ${businessName}.` +
      advisory
    );
  }

  // === SHORTER FORMAT for admin-created trips ===
  const dateStr = formatSmsDateTime(trip.start_time);
  const passengerName = trip.client_name ? ` ${trip.client_name}` : "";

  // Line 1: business, event context, trip number, passenger name, date
  let message = `${DO_NOT_REPLY}`;
  if (eventType === "driver_assigned") {
    message += `${businessName}: ${trip.employee_name || "Driver"} #${trip.booking_number || trip.id}${passengerName}`;
  } else if (eventType === "booking_changed") {
    message += `${businessName}: #${trip.booking_number || trip.id}${passengerName} UPDATED`;
    if (changedFields && changedFields.length > 0) {
      message += ` (${changedFields.join(", ")})`;
    }
  } else {
    // booking_created or fallback
    message += `${businessName}: #${trip.booking_number || trip.id}${passengerName}`;
  }
  message += `\n${dateStr}`;

  // Single link — no label prefix, just the URL
  const link = urls.passengerTrip || urls.passengerConfirm || urls.tripDetails;
  message += `\n${link}`;

  // Include payment link when balance is due and not cash
  const isPaid =
    trip.payment_status === "paid" ||
    ((trip.balance_due ?? 0) <= 0 && (trip.payments_total ?? 0) > 0);
  const isCashPayment = (trip.payment_method || "").toLowerCase() === "cash";
  if (!isPaid && !isCashPayment && paymentUrl) {
    message += `\nPay: ${paymentUrl}`;
  }

  return message + advisory;
}

/**
 * Build driver SMS message
 */
export function buildDriverSms(data, urls, eventType, changedFields = []) {
  const { trip, services } = data;
  const settings = data.settings;
  const businessName = settings.business_name || "Catch A Ride";
  const advisory = buildContactAdvisorySms(settings);

  // Handle driver_removed event type
  if (eventType === "driver_removed") {
    const dateStr = formatSmsDateTime(trip.start_time);
    const passengerName = trip.client_name || "Unknown";
    const pickup = trip.pickup_street
      ? [trip.pickup_city, trip.pickup_state].filter(Boolean).join(", ")
      : trip.pickup_address || trip.departure_location || "TBD";
    const dropoff = trip.dropoff_street
      ? [trip.dropoff_city, trip.dropoff_state].filter(Boolean).join(", ")
      : trip.dropoff_address || trip.destination || "TBD";

    return (
      `${businessName}: You have been REMOVED from trip #${trip.booking_number || trip.id}. ${dateStr} - ${passengerName} (${pickup} → ${dropoff}). This trip has been reassigned.` +
      advisory
    );
  }

  const dateStr = formatSmsDateTime(trip.start_time);

  const passengerName = trip.client_name || "Unknown";

  // Build short message with single combined link
  let message = `#${trip.booking_number || trip.id}: ${dateStr} ${passengerName}`;

  // Add changed fields summary for booking_changed
  if (
    eventType === "booking_changed" &&
    changedFields &&
    changedFields.length > 0
  ) {
    message += `\nChanged: ${changedFields.join(", ")}`;
  }

  // Include balance due if available
  const { balance } = data;
  if (balance > 0) {
    message += ` $${balance.toFixed(2)}`;
  }

  // Single combined link — has trip details, accept/decline, and calendar
  const link = urls.driverTrip || urls.driverConfirm || urls.tripDetails;
  message += ` → ${link}`;

  return message + advisory;
}
