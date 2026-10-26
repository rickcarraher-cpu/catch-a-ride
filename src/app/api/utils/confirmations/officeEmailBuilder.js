/**
 * Office Email Builder
 * Builds HTML email for office/company owner notifications
 */

import { formatOfficeDateTime } from "../notifications/formatters.js";
import { buildContactAdvisoryHtml } from "./settingsHelpers.js";

/**
 * Build office email (company owner notification)
 */
export function buildOfficeEmail(data, urls, eventType, changedFields = []) {
  const { trip, services, balance, totalAmount } = data;
  const settings = data.settings;
  const businessName = settings.business_name || "Catch A Ride";

  const statusLabels = {
    booking_created: "New Booking Received",
    booking_changed: "Booking Updated",
    booking_cancelled: "Booking Cancelled",
    booking_deleted: "Booking Deleted",
    driver_assigned: "Driver Assigned",
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #333; color: white; padding: 20px; }
    .content { padding: 20px; }
    .detail { background: #f5f5f5; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; }
    .label { font-weight: bold; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin: 0;">${statusLabels[eventType] || "Booking Notification"}</h2>
  </div>
  <div class="content">
    <div class="detail">
      <p><span class="label">Booking #:</span> ${trip.booking_number || trip.id}</p>
      <p><span class="label">Date/Time:</span> ${formatOfficeDateTime(trip.start_time)}</p>
      <p><span class="label">Passenger:</span> ${trip.client_name || "Unknown"}</p>
      <p><span class="label">Driver:</span> ${trip.employee_name || "Not assigned"}</p>
      <p><span class="label">Pickup:</span> ${trip.pickup_address || trip.departure_location || "TBD"}</p>
      <p><span class="label">Dropoff:</span> ${trip.dropoff_address || trip.destination || "TBD"}</p>
      <p><span class="label">Total:</span> $${totalAmount.toFixed(2)}</p>
      <p><span class="label">Balance:</span> $${balance.toFixed(2)}</p>
      <p><span class="label">Status:</span> ${trip.status || "pending"}</p>
    </div>
    <p><a href="${urls.tripDetails}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View in Dashboard</a></p>
    ${buildContactAdvisoryHtml(settings)}
  </div>
</body>
</html>
  `;
}
