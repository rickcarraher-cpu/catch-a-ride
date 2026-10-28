/**
 * Passenger Email Builder
 * Builds HTML email for passenger confirmations
 */

import { getAllPassengerEmails } from "./emailHelpers.js";
import { buildContactAdvisoryHtml } from "./settingsHelpers.js";

/**
 * Build a simplified "request received" email for passenger-submitted bookings.
 * No pricing, no confirm/cancel, no trip #.
 * Just informational with trip details and a message to expect follow-up.
 * If a paymentUrl is provided, include a payment button.
 */
function buildPassengerRequestReceivedEmail(
  trip,
  settings,
  businessName,
  businessPhone,
  paymentUrl = null,
) {
  // ALWAYS compute date/time fresh from start_time — never trust pre-computed display fields
  const computedDatetime = trip.start_time
    ? new Date(trip.start_time).toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
      " at " +
      new Date(trip.start_time).toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : trip.display_full_datetime || "TBD";

  const pickupDisplay = trip.pickup_street
    ? [trip.pickup_street, trip.pickup_city, trip.pickup_state, trip.pickup_zip]
        .filter(Boolean)
        .join(", ")
    : trip.pickup_address || trip.departure_location || "TBD";

  const dropoffDisplay = trip.dropoff_street
    ? [
        trip.dropoff_street,
        trip.dropoff_city,
        trip.dropoff_state,
        trip.dropoff_zip,
      ]
        .filter(Boolean)
        .join(", ")
    : trip.dropoff_address || trip.destination || "TBD";

  const bagParts = [];
  if (trip.num_bags_checked) bagParts.push(trip.num_bags_checked + " Checked");
  if (trip.num_bags_carry_on)
    bagParts.push(trip.num_bags_carry_on + " Carry-on");

  // Build payment button if link exists and balance > 0
  const balance = Math.max(0, Number(trip.balance_due || 0));
  const isPaid = trip.payment_status === "paid" || balance <= 0;
  const paymentMethodLower = (trip.payment_method || "").toLowerCase();
  const payButtonEmoji = paymentMethodLower.includes("venmo")
    ? "💰"
    : paymentMethodLower.includes("zelle")
      ? "💸"
      : "💳";
  const paymentProviderNote = paymentMethodLower.includes("venmo")
    ? "Pay securely via Venmo"
    : paymentMethodLower.includes("zelle")
      ? "Pay securely via Zelle"
      : "Secure online payment";

  const paymentButtonHtml =
    paymentUrl && !isPaid
      ? `
    <div style="text-align: center; margin: 20px 0;">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;display:inline-block;min-width:260px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#15803d;letter-spacing:1px;text-transform:uppercase;">Payment Due</p>
        <p style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:700;">$${balance.toFixed(2)}</p>
        <a href="${paymentUrl}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">${payButtonEmoji} Click Here to Pay Now or When you are taking your trip. Thank you.</a>
        <p style="margin:10px 0 0;font-size:11px;color:#6b7280;">${paymentProviderNote}</p>
      </div>
    </div>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .trip-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; font-size: 14px; }
    .value { color: #333; font-size: 14px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    .message-box { background: #f0f9ff; border: 2px solid #bae6fd; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">${businessName}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Transportation Partner</p>
  </div>
  
  <div class="content">
    <p>Hello <strong>${trip.client_name || "Valued Customer"}</strong>,</p>
    
    <div class="message-box">
      <h2 style="margin: 0 0 10px 0; color: #0369a1; font-size: 20px;">✓ Your Request Has Been Received</h2>
      <p style="margin: 0; color: #475569; font-size: 15px;">Once we review your request, you will hear back from us.</p>
    </div>

    <div class="trip-details">
      <h3 style="margin-top: 0;">Trip Details</h3>
      <div class="detail-row">
        <span class="label">Date & Time:&nbsp;</span>
        <span class="value">${computedDatetime}</span>
      </div>
      <div class="detail-row">
        <span class="label">Pickup:&nbsp;</span>
        <span class="value">${pickupDisplay}</span>
      </div>
      <div class="detail-row">
        <span class="label">Dropoff:&nbsp;</span>
        <span class="value">${dropoffDisplay}</span>
      </div>
      ${
        trip.num_people
          ? `
      <div class="detail-row">
        <span class="label"># of People:&nbsp;</span>
        <span class="value">${trip.num_people}</span>
      </div>
      `
          : ""
      }
      ${
        bagParts.length > 0
          ? `
      <div class="detail-row">
        <span class="label"># of Bags:&nbsp;</span>
        <span class="value">${bagParts.join(" + ")}</span>
      </div>
      `
          : ""
      }
    </div>

    ${paymentButtonHtml}

    ${buildContactAdvisoryHtml(settings)}
    ${businessPhone ? `<p style="text-align: center; color: #666;">Questions? Call us at <strong>${businessPhone}</strong></p>` : ""}
  </div>
  
  <div class="footer">
    <p>${businessName} • Your Transportation Partner</p>
  </div>
</body>
</html>
  `;
}

/**
 * Build passenger confirmation email HTML
 */
export function buildPassengerConfirmationEmail(
  data,
  urls,
  eventType,
  changedFields = [],
) {
  const {
    trip,
    services,
    balance,
    totalAmount,
    paymentUrl: rawPaymentUrl,
  } = data;
  const settings = data.settings;

  // Prefer the shortened URL from urls.paymentLink, fall back to raw data.paymentUrl
  const paymentUrl = urls?.paymentLink || rawPaymentUrl;

  const businessName = settings.business_name || "Catch A Ride";
  const businessPhone = settings.business_phone || "";

  // Detect if this was a passenger-submitted booking request (online booking wizard)
  const isPassengerBooking =
    trip.booked_by === "Passenger" || trip.status === "needs_review";

  // If this is a passenger-submitted booking, send a simplified informational email
  // Still pass the paymentUrl so the button appears if a payment link exists
  if (isPassengerBooking && eventType === "booking_created") {
    return buildPassengerRequestReceivedEmail(
      trip,
      settings,
      businessName,
      businessPhone,
      paymentUrl, // PASS paymentUrl to the simplified email
    );
  }

  // === FULL EMAIL LOGIC (for admin-created trips, updates, etc.) ===

  // === DETAILED PAYMENT DEBUG LOGGING ===
  console.log(
    `[buildPassengerConfirmationEmail] Payment Debug for trip #${trip.booking_number || trip.id}:`,
  );
  console.log(`  - trip.payment_method: "${trip.payment_method || "NULL"}"`);
  console.log(`  - trip.payment_status: "${trip.payment_status || "NULL"}"`);
  console.log(`  - paymentUrl: ${paymentUrl ? `"${paymentUrl}"` : "NULL"}`);
  console.log(`  - balance: $${balance.toFixed(2)}`);
  console.log(`  - totalAmount: $${totalAmount.toFixed(2)}`);
  console.log(`  - eventType: "${eventType}"`);

  // Determine if payment link should be shown.
  // Only consider a trip "paid" when payment_status is explicitly 'paid' —
  // do NOT auto-mark as paid based on balance_due, since balance_due may not
  // have been recalculated yet after services were added.
  const isPaid = trip.payment_status === "paid";
  const paymentMethodLower = (trip.payment_method || "").toLowerCase();
  const isPayableMethods =
    paymentMethodLower.includes("square") ||
    paymentMethodLower.includes("card") ||
    paymentMethodLower.includes("credit") ||
    paymentMethodLower.includes("venmo") ||
    paymentMethodLower.includes("zelle");

  const payButtonEmoji = paymentMethodLower.includes("venmo")
    ? "💰"
    : paymentMethodLower.includes("zelle")
      ? "💸"
      : "💳";

  const paymentProviderNote = paymentMethodLower.includes("venmo")
    ? "Pay securely via Venmo"
    : paymentMethodLower.includes("zelle")
      ? "Pay securely via Zelle"
      : "Secure online payment";

  // If a paymentUrl exists and there is a balance due, ALWAYS show the payment button.
  // Do not gate on isPayableMethods here — if a link was created, it must appear.
  // Also allow tentative trips to show the button if a link was explicitly created.
  const hasOutstandingBalance =
    balance > 0 ||
    (Number(trip.original_amount || 0) > 0 &&
      Number(trip.payments_total || 0) < Number(trip.original_amount || 0));

  const showPayButton =
    paymentUrl &&
    !isPaid &&
    !trip.is_tentative &&
    eventType !== "booking_cancelled" &&
    eventType !== "booking_deleted";

  // Calculate CC fee if applicable
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

  console.log(`  - isPaid: ${isPaid}`);
  console.log(`  - paymentMethodLower: "${paymentMethodLower}"`);
  console.log(`  - isPayableMethods: ${isPayableMethods}`);
  console.log(`  - is_tentative: ${trip.is_tentative}`);
  console.log(`  - showPayButton: ${showPayButton}`);
  console.log(`  - Payment button will ${showPayButton ? "SHOW" : "NOT SHOW"}`);
  // === END DEBUG LOGGING ===

  const serviceList = services
    .map(
      (s) =>
        `<li>${s.service_name || "Service"} ${s.quantity > 1 ? `(×${s.quantity})` : ""} - $${parseFloat(s.service_price || 0).toFixed(2)}</li>`,
    )
    .join("");

  const statusBadge =
    {
      booking_created: "📋 <strong>Booking Received</strong>",
      booking_changed: "✏️ <strong>Booking Updated</strong>",
      booking_cancelled: "❌ <strong>Booking Cancelled</strong>",
      booking_deleted: "🗑️ <strong>Booking Removed</strong>",
      driver_assigned: "✅ <strong>Driver Assigned</strong>",
    }[eventType] || "📋 <strong>Booking Confirmation</strong>";

  const needsConfirmation = !trip.passenger_response_at;

  // Format balance with payment method inline - ALWAYS show payment method
  const paymentMethodDisplay = trip.payment_method || "Not specified";
  const balanceWithPaymentMethod = `$${balance.toFixed(2)} (${paymentMethodDisplay})`;

  const paymentButtonHtml = showPayButton
    ? `
    <div style="text-align: center; margin: 20px 0;">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;display:inline-block;min-width:260px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#15803d;letter-spacing:1px;text-transform:uppercase;">Payment Due</p>
        <p style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:700;">$${balance.toFixed(2)}</p>
        <a href="${paymentUrl}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:10px;">${payButtonEmoji} Click Here to Pay Now or When you are taking your trip. Thank you.</a>
        <p style="margin:10px 0 0;font-size:11px;color:#6b7280;">${paymentProviderNote}</p>
      </div>
    </div>`
    : isPaid && !trip.is_tentative && eventType !== "booking_cancelled"
      ? `
    <div style="text-align: center; margin: 20px 0;">
      <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;display:inline-block;">
        <p style="margin:0;font-size:16px;color:#16a34a;font-weight:700;">✓ This Trip is Paid</p>
      </div>
    </div>`
      : "";

  // Helper: render "Chg" badge if field was changed (only for booking_changed)
  const chgBadge = (fieldLabel) => {
    if (eventType === "booking_changed" && changedFields.includes(fieldLabel)) {
      return ' <span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;margin-left:4px;">Chg</span>';
    }
    return "";
  };

  // Policy box for tours vs regular trips
  const policyBox = trip.is_tour
    ? `
    <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">💳 Payment Policy</h3>
      <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">Tours must be paid in full by 12:00 pm, 7 days before the tour.</p>
    </div>`
    : `
    <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">🔄 Refund Policy</h3>
      <p style="margin: 0; color: #1e3a8a; font-size: 14px; line-height: 1.6;">Refunds will be issued if the trip is cancelled by 12:00 pm, 24 hours before the trip. Costs for additional trip requests (if any) are subject to the refund policy of that provider.</p>
    </div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; }
    .status-badge { display: inline-block; padding: 8px 16px; background: #f0f0f0; border-radius: 20px; margin-bottom: 20px; }
    .trip-details { background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #666; font-size: 14px; }
    .value { color: #333; font-size: 14px; }
    .button { display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; }
    .btn-primary { background: #667eea; color: white; }
    .btn-success { background: #10b981; color: white; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-secondary { background: #6b7280; color: white; }
    .action-section { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    ul { list-style: none; padding: 0; }
    li { padding: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; font-size: 28px;">${businessName}</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Transportation Partner</p>
  </div>
  
  <div class="content">
    <div class="status-badge">${statusBadge}</div>
    
    <p>Hello <strong>${trip.client_name || "Valued Customer"}</strong>,</p>
    
    ${eventType === "booking_created" ? "<p>Thank you for your booking request. We have received your reservation and will confirm shortly.</p>" : ""}
    ${eventType === "booking_changed" ? "<p>Your booking has been updated with the latest information below.</p>" : ""}
    ${eventType === "driver_assigned" ? "<p>Great news! A driver has been assigned to your trip.</p>" : ""}
    ${eventType === "booking_cancelled" ? "<p>Your booking has been cancelled as requested.</p>" : ""}
    
    <div class="trip-details">
      <h3 style="margin-top: 0;">Trip Details</h3>
      <div class="detail-row">
        <span class="label">Booking #:&nbsp;</span>
        <span class="value">${trip.booking_number || trip.id}</span>
      </div>
      <div class="detail-row">
        <span class="label">Date & Time${chgBadge("Date")}${chgBadge("Time")}:&nbsp;</span>
        <span class="value">${
          trip.start_time
            ? new Date(trip.start_time).toLocaleDateString("en-US", {
                timeZone: "America/Chicago",
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              }) +
              " at " +
              new Date(trip.start_time).toLocaleTimeString("en-US", {
                timeZone: "America/Chicago",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : trip.display_full_datetime || "TBD"
        }</span>
      </div>
      ${
        trip.employee_name
          ? `
      <div class="detail-row">
        <span class="label">Driver${chgBadge("Driver")}:&nbsp;</span>
        <span class="value">${trip.employee_name}</span>
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
        const bagParts = [];
        if (trip.num_bags_checked)
          bagParts.push(trip.num_bags_checked + " Checked");
        if (trip.num_bags_carry_on)
          bagParts.push(trip.num_bags_carry_on + " Carry-on");
        return bagParts.length > 0
          ? `
      <div class="detail-row">
        <span class="label"># of Bags${chgBadge("# of Bags")}:&nbsp;</span>
        <span class="value">${bagParts.join(" + ")}</span>
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
                    : "Flight Info";
                return `
      <div class="detail-row">
        <span class="label">${outgoingLabel}:&nbsp;</span>
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
        <span class="label">${returningLabel}:&nbsp;</span>
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
        <span class="value">${trip.display_return_date}</span>
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
        <span class="label">Total Amount${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value"><strong>$${totalAmount.toFixed(2)}</strong></span>
      </div>
      <div class="detail-row">
        <span class="label">Amount Due${chgBadge("Pricing")}:&nbsp;</span>
        <span class="value"><strong style="color: ${balance > 0 ? "#ef4444" : "#10b981"};">${balanceWithPaymentMethod}</strong></span>
      </div>
      ${
        trip.driver_notes
          ? `
      <div class="detail-row">
        <span class="label">Driver Instructions${chgBadge("Driver Notes")}:&nbsp;</span>
        <span class="value">${trip.driver_notes}</span>
      </div>
      `
          : ""
      }
      ${
        trip.notes
          ? `
      <div class="detail-row">
        <span class="label">Notes${chgBadge("Notes")}:&nbsp;</span>
        <span class="value">${trip.notes}</span>
      </div>
      `
          : ""
      }
    </div>

    ${paymentButtonHtml}

    ${policyBox}

    ${
      needsConfirmation && urls.passengerConfirm
        ? `
    <div class="action-section" style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <h3 style="margin-top: 0; color: #92400e;">⚠️ Confirmation Required</h3>
      <p style="margin-bottom: 20px;">Please confirm or cancel this booking:</p>
      <div style="text-align: center;">
        <a href="${urls.passengerConfirm}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #10b981; color: #ffffff;">✓ Approve Booking</a>
        <a href="${urls.passengerConfirm}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #ef4444; color: #ffffff;">✗ Cancel Booking</a>
      </div>
    </div>
    `
        : ""
    }

    <div style="text-align: center; margin: 30px 0;">
      ${!trip.is_tour ? `<a href="${urls.tripDetails}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #667eea; color: #ffffff;">📋 View Full Details</a>` : ""}
      ${urls.passengerCalendar ? `<a href="${urls.passengerCalendar}" style="display: inline-block; padding: 14px 28px; margin: 10px 5px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; background: #6b7280; color: #ffffff;">📅 Add to Calendar</a>` : ""}
    </div>

    ${buildContactAdvisoryHtml(settings)}
    ${businessPhone ? `<p style="text-align: center; color: #666;">Questions? Call us at <strong>${businessPhone}</strong></p>` : ""}
  </div>
  
  <div class="footer">
    <p>${businessName} • Your Transportation Partner</p>
    <p style="font-size: 12px; color: #999;">
      <a href="${urls.tripDetails}" style="color: #667eea; text-decoration: none;">View Trip</a>
    </p>
  </div>
</body>
</html>
  `;
}
