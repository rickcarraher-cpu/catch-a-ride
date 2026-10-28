/**
 * Driver Email Builder
 * Builds HTML email for driver confirmations
 */

import { buildContactAdvisoryHtml } from "./settingsHelpers.js";
import {
  formatFullDateTime,
  formatDateOnly,
} from "../notifications/formatters.js";

/**
 * Build driver confirmation email HTML
 */
export function buildDriverConfirmationEmail(
  data,
  urls,
  eventType,
  changedFields = [],
) {
  const { trip, services, balance, totalAmount } = data;
  const settings = data.settings;

  const businessName = settings.business_name || "Catch A Ride";

  // Handle driver_removed event type
  if (eventType === "driver_removed") {
    return buildDriverRemovedEmail(data, businessName);
  }

  // Helper: render "Chg" badge if field was changed (only for booking_changed)
  const chgBadge = (fieldLabel) => {
    if (eventType === "booking_changed" && changedFields.includes(fieldLabel)) {
      return ' <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-left:4px;">Chg</span>';
    }
    return "";
  };

  const serviceList = services
    .map(
      (s) =>
        `<li>${s.service_name || "Service"} ${s.quantity > 1 ? `(×${s.quantity})` : ""} - $${parseFloat(s.service_price || 0).toFixed(2)}</li>`,
    )
    .join("");

  const needsConfirmation = !trip.driver_response_at;

  // Calculate CC fee if applicable
  const paymentMethodLower = (trip.payment_method || "").toLowerCase();
  const isCardMethod =
    paymentMethodLower.includes("card") ||
    paymentMethodLower.includes("credit") ||
    paymentMethodLower.includes("square");
  const ccFeePercent = isCardMethod
    ? Number(settings.credit_card_fee_percent || 4)
    : 0;

  const servicesSubtotal = services.reduce(
    (sum, s) => sum + Number(s.service_price || 0) * Number(s.quantity || 1),
    0,
  );
  const ccFeeAmount = isCardMethod
    ? Math.round((Math.ceil(servicesSubtotal) * ccFeePercent) / 100)
    : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .trip-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; font-size: 14px; }
    .value { color: #333; font-size: 14px; }
    .button { display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; }
    .btn-primary { background: #1e40af; color: white; }
    .btn-success { background: #10b981; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-secondary { background: #6b7280; color: white; }
    .action-section { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">🚗 Driver Assignment</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">${businessName}</p>
  </div>
  
  <div class="content">
    <p>Hello <strong>${trip.employee_name || "Driver"}</strong>,</p>
    
    <p>You have been assigned to a new trip. Please review the details below:</p>
    
    <div class="trip-details">
      <h3 style="margin-top: 0;">Trip Assignment</h3>
      <div class="detail-row">
        <span class="label">Booking #:&nbsp;</span>
        <span class="value">${trip.booking_number || trip.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Date & Time${chgBadge("Date")}${chgBadge("Time")}:&nbsp;</span>
        <span class="value">${formatFullDateTime(trip.start_time)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Passenger${chgBadge("Passenger")}:&nbsp;</span>
        <span class="value">${trip.client_name || "Unknown"}</span>
      </div>
      ${
        trip.client_phone
          ? `
      <div class="detail-row">
        <span class="label">Phone:&nbsp;</span>
        <span class="value">${trip.client_phone}</span>
      </div>
      `
          : ""
      }
      <div class="detail-row">
        <span class="label">Pickup${chgBadge("Pickup Location")}:&nbsp;</span>
        <span class="value">${trip.pickup_street ? [trip.pickup_street, trip.pickup_city, trip.pickup_state, trip.pickup_zip].filter(Boolean).join(", ") : trip.pickup_address || trip.departure_location || "TBD"}</span>
      </div>
      <div class="detail-row">
        <span class="label">Dropoff${chgBadge("Dropoff Location")}:&nbsp;</span>
        <span class="value">${trip.dropoff_street ? [trip.dropoff_street, trip.dropoff_city, trip.dropoff_state, trip.dropoff_zip].filter(Boolean).join(", ") : trip.dropoff_address || trip.destination || "TBD"}</span>
      </div>
      ${
        trip.num_people
          ? `
      <div class="detail-row">
        <span class="label"># of People${chgBadge("# of People")}:&nbsp;</span>
        <span class="value">${trip.num_people}</span>
      </div>
      `
          : ""
      }
      ${(() => {
        const dBagParts = [];
        if (trip.num_bags_checked)
          dBagParts.push(trip.num_bags_checked + " Checked");
        if (trip.num_bags_carry_on)
          dBagParts.push(trip.num_bags_carry_on + " Carry-on");
        return dBagParts.length > 0
          ? `
      <div class="detail-row">
        <span class="label"># of Bags${chgBadge("# of Bags")}:&nbsp;</span>
        <span class="value">${dBagParts.join(" + ")}</span>
      </div>
      `
          : "";
      })()}
      ${
        trip.num_golf_bags
          ? `
      <div class="detail-row">
        <span class="label">Golf Bags${chgBadge("Golf Bags")}:&nbsp;</span>
        <span class="value">${trip.num_golf_bags}</span>
      </div>
      `
          : ""
      }
      ${
        trip.num_car_seats
          ? `
      <div class="detail-row">
        <span class="label">Car Seats${chgBadge("Car Seats")}:&nbsp;</span>
        <span class="value">${trip.num_car_seats}</span>
      </div>
      `
          : ""
      }
      ${
        trip.outgoing_flight_info
          ? (
              () => {
                const pickupLower = (
                  trip.pickup_street ||
                  trip.pickup_address ||
                  trip.departure_location ||
                  ""
                ).toLowerCase();
                const dropoffLower = (
                  trip.dropoff_street ||
                  trip.dropoff_address ||
                  trip.destination ||
                  ""
                ).toLowerCase();
                const airportKws = ["airport", "terminal", "concourse"];
                const isPickupAtAirport =
                  trip.pickup_is_airport === true ||
                  airportKws.some((kw) => pickupLower.includes(kw));
                const isDropoffAtAirport =
                  trip.dropoff_is_airport === true ||
                  airportKws.some((kw) => dropoffLower.includes(kw));
                const outgoingLabel =
                  isPickupAtAirport && !isDropoffAtAirport
                    ? "Incoming Flight"
                    : "Outgoing Flight";
                return `
      <div class="detail-row">
        <span class="label">${outgoingLabel}${chgBadge("Outgoing Flight")}:&nbsp;</span>
        <span class="value">${trip.outgoing_flight_info}</span>
      </div>
      `;
              }
            )()
          : ""
      }
      ${
        trip.returning_flight_info
          ? (
              () => {
                const pickupLower = (
                  trip.pickup_street ||
                  trip.pickup_address ||
                  trip.departure_location ||
                  ""
                ).toLowerCase();
                const dropoffLower = (
                  trip.dropoff_street ||
                  trip.dropoff_address ||
                  trip.destination ||
                  ""
                ).toLowerCase();
                const airportKws = ["airport", "terminal", "concourse"];
                const isPickupAtAirport =
                  trip.pickup_is_airport === true ||
                  airportKws.some((kw) => pickupLower.includes(kw));
                const isDropoffAtAirport =
                  trip.dropoff_is_airport === true ||
                  airportKws.some((kw) => dropoffLower.includes(kw));
                const returningLabel =
                  isPickupAtAirport && !isDropoffAtAirport
                    ? "Incoming Flight"
                    : "Return Flight";
                return `
      <div class="detail-row">
        <span class="label">${returningLabel}${chgBadge("Return Information")}:&nbsp;</span>
        <span class="value">${trip.returning_flight_info}</span>
      </div>
      `;
              }
            )()
          : ""
      }
      ${
        trip.return_date
          ? `
      <div class="detail-row">
        <span class="label">Return Date${chgBadge("Return Date")}:&nbsp;</span>
        <span class="value">${formatDateOnly(trip.return_date)}</span>
      </div>
      `
          : ""
      }
      ${
        trip.is_international_flight
          ? `
      <div class="detail-row">
        <span class="label">International Flight:&nbsp;</span>
        <span class="value">Yes</span>
      </div>
      `
          : ""
      }
      ${
        trip.customs_clearance_location
          ? `
      <div class="detail-row">
        <span class="label">Customs Clearance:&nbsp;</span>
        <span class="value">${trip.customs_clearance_location}</span>
      </div>
      `
          : ""
      }
      ${
        trip.vehicle_name
          ? `
      <div class="detail-row">
        <span class="label">Vehicle${chgBadge("Vehicle")}:&nbsp;</span>
        <span class="value">${trip.vehicle_name}</span>
      </div>
      `
          : ""
      }
      ${
        services.length > 0
          ? `
      <div class="detail-row">
        <span class="label">Services${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value">
          <ul style="margin: 0;">
            ${serviceList}
          </ul>
        </span>
      </div>
      `
          : ""
      }
      ${
        ccFeeAmount > 0
          ? `
      <div class="detail-row">
        <span class="label">Credit Card Fee (${ccFeePercent}%)${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value">+$${ccFeeAmount.toFixed(2)}</span>
      </div>
      `
          : ""
      }
      <div class="detail-row">
        <span class="label">Total Fare${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value"><strong>$${totalAmount.toFixed(2)}</strong></span>
      </div>
      <div class="detail-row">
        <span class="label">Balance Due${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value"><strong style="color: ${balance > 0 ? "#ef4444" : "#10b981"};">$${balance.toFixed(2)}</strong></span>
      </div>
      ${
        trip.driver_notes
          ? `
      <div class="detail-row">
        <span class="label">Driver Notes${chgBadge("Driver Notes")}:&nbsp;</span>
        <span class="value">${trip.driver_notes}</span>
      </div>
      `
          : ""
      }
    </div>

    ${
      needsConfirmation && urls.driverConfirm
        ? `
    <div class="action-section" style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #1e40af;">⏰ Response Required</h3>
      <p style="margin-bottom: 20px;">Please accept or decline this trip assignment:</p>
      <div style="text-align: center;">
        <a href="${urls.driverConfirm}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #10b981; color: #ffffff;">✓ Accept Trip</a>
        <a href="${urls.driverConfirm}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #ef4444; color: #ffffff;">✗ Decline Trip</a>
      </div>
    </div>
    `
        : ""
    }

    <div style="text-align: center; margin: 30px 0;">
      <a href="${urls.tripDetails}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #1e40af; color: #ffffff;">📋 View Full Details</a>
      ${urls.driverCalendar ? `<a href="${urls.driverCalendar}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #6b7280; color: #ffffff;">📅 Add to Calendar</a>` : ""}
      ${(() => {
        // Build Google Calendar link for driver with full trip info
        const startDt = new Date(trip.start_time);
        const totalDuration = services.reduce(
          (sum, s) => sum + (s.duration_minutes || 0) * (s.quantity || 1),
          0,
        );
        // Compute proper end time using duration; fall back to 1 hour
        const gcalEndDt = new Date(
          startDt.getTime() + (totalDuration || 60) * 60000,
        );
        const gcalTitle = encodeURIComponent(
          `${businessName} — Trip #${trip.booking_number || trip.id}`,
        );

        // Build comprehensive details
        const detailLines = [];
        detailLines.push(`Booking: #${trip.booking_number || trip.id}`);
        detailLines.push(`Passenger: ${trip.client_name || "Unknown"}`);
        if (trip.client_phone) detailLines.push(`Phone: ${trip.client_phone}`);
        detailLines.push(
          `Pickup: ${trip.pickup_address || trip.departure_location || "TBD"}`,
        );
        detailLines.push(
          `Dropoff: ${trip.dropoff_address || trip.destination || "TBD"}`,
        );
        if (trip.num_people) detailLines.push(`Passengers: ${trip.num_people}`);
        if (trip.num_bags_checked)
          detailLines.push(`Checked Bags: ${trip.num_bags_checked}`);
        if (trip.num_bags_carry_on)
          detailLines.push(`Carry-On Bags: ${trip.num_bags_carry_on}`);
        if (trip.num_car_seats)
          detailLines.push(`Car Seats: ${trip.num_car_seats}`);
        if (trip.num_golf_bags)
          detailLines.push(`Golf Bags: ${trip.num_golf_bags}`);
        if (trip.outgoing_flight_info)
          detailLines.push(`Outgoing Flight: ${trip.outgoing_flight_info}`);
        if (trip.returning_flight_info)
          detailLines.push(`Return Flight: ${trip.returning_flight_info}`);
        if (services.length > 0) {
          detailLines.push(
            `Services: ${services.map((s) => `${s.service_name || "Service"}${s.quantity > 1 ? ` x${s.quantity}` : ""}`).join(", ")}`,
          );
        }
        detailLines.push(`Total: $${totalAmount.toFixed(2)}`);
        if (balance > 0)
          detailLines.push(`Balance Due: $${balance.toFixed(2)}`);
        if (trip.vehicle_name)
          detailLines.push(`Vehicle: ${trip.vehicle_name}`);
        if (trip.driver_notes)
          detailLines.push(`Driver Notes: ${trip.driver_notes}`);
        if (trip.notes) detailLines.push(`Notes: ${trip.notes}`);

        const gcalDetails = encodeURIComponent(detailLines.join("\n"));
        const gcalLocation = encodeURIComponent(
          trip.pickup_address || trip.departure_location || "",
        );
        const fmtGcal = (d) => {
          const f = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Chicago",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
          const parts = f.formatToParts(d);
          const v = (t) => parts.find((p) => p.type === t)?.value || "00";
          const hr = v("hour") === "24" ? "00" : v("hour");
          return `${v("year")}${v("month")}${v("day")}T${hr}${v("minute")}${v("second")}`;
        };
        const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${fmtGcal(startDt)}/${fmtGcal(gcalEndDt)}&details=${gcalDetails}&location=${gcalLocation}&ctz=America%2FChicago`;
        return `<a href="${gcalUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #6b7280; color: #ffffff;">📅 Google Calendar</a>`;
      })()}
    </div>
  </div>
  
  ${buildContactAdvisoryHtml(settings)}
  
  <div class="footer">
    <p>${businessName} • Driver Portal</p>
  </div>
</body>
</html>
  `;
}

/**
 * Build driver removed email HTML
 */
function buildDriverRemovedEmail(data, businessName) {
  const { trip, services } = data;
  const settings = data.settings || {};

  const serviceList = services
    .map(
      (s) =>
        `<li>${s.service_name || "Service"} ${s.quantity > 1 ? `(×${s.quantity})` : ""} - $${parseFloat(s.service_price || 0).toFixed(2)}</li>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .trip-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; font-size: 14px; }
    .value { color: #333; font-size: 14px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">⚠️ Trip Reassignment</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">${businessName}</p>
  </div>
  
  <div class="content">
    <p>Hello <strong>${trip.employee_name || "Driver"}</strong>,</p>
    
    <div class="trip-details">
      <h3 style="margin-top: 0; color: #dc2626;">Trip Removed from Your Schedule</h3>
      <div class="detail-row">
        <span class="label">Booking #:&nbsp;</span>
        <span class="value">${trip.booking_number || trip.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Date & Time:&nbsp;</span>
        <span class="value">${formatFullDateTime(trip.start_time)}</span>
      </div>
      <div class="detail-row">
        <span class="label">Passenger:&nbsp;</span>
        <span class="value">${trip.client_name || "Unknown"}</span>
      </div>
      <div class="detail-row">
        <span class="label">Pickup:&nbsp;</span>
        <span class="value">${trip.pickup_street ? [trip.pickup_street, trip.pickup_city, trip.pickup_state, trip.pickup_zip].filter(Boolean).join(", ") : trip.pickup_address || trip.departure_location || "TBD"}</span>
      </div>
      <div class="detail-row">
        <span class="label">Dropoff:&nbsp;</span>
        <span class="value">${trip.dropoff_street ? [trip.dropoff_street, trip.dropoff_city, trip.dropoff_state, trip.dropoff_zip].filter(Boolean).join(", ") : trip.dropoff_address || trip.destination || "TBD"}</span>
      </div>
      ${
        services.length > 0
          ? `
      <div class="detail-row">
        <span class="label">Services:&nbsp;</span>
        <span class="value">
          <ul style="margin: 0;">
            ${serviceList}
          </ul>
        </span>
      </div>
      `
          : ""
      }
    </div>

    <p>This trip has been reassigned to another driver. You are no longer responsible for this assignment.</p>
    
    ${buildContactAdvisoryHtml(settings)}
    <p style="color: #666; font-size: 14px;">If you have any questions, please contact the office.</p>
  </div>
  
  <div class="footer">
    <p>${businessName} • Driver Portal</p>
  </div>
</body>
</html>
  `;
}
