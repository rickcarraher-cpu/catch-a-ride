import {
  formatLongDate,
  formatTime,
  formatDateOnly,
  toGCalDate,
  formatPaymentMethod,
} from "./formatters";

// ── Beautiful HTML email builder ──────────────────────────────────────────────

export function buildBookingEmailHtml({
  action,
  app,
  services = [],
  settings = {},
  changedFields = [],
  isOnlineBooking = false,
  paymentUrl = null,
  paymentAmount = null,
  includeDriverNotes = true, // set false for passenger-facing emails
  includePassengerNotes = true, // set false to hide passenger notes from passengers
  includeCalendarLinks = true, // set false to hide calendar buttons
  passengerConfirmUrl = null, // passenger confirmation URL
  recipientType = "passenger", // 'passenger' or 'driver' for calendar link personalization
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const logoUrl = settings.logo_url || null;
  const servicesUrl = settings.services_url || "https://catcharide.us";
  const modifyContact = settings.business_phone
    ? `call us at ${settings.business_phone}`
    : "reply to this email";

  const changed = new Set(changedFields);
  const changedBadge = `<span style="display:inline-block;margin-left:8px;background:#fff7ed;color:#ea580c;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:2px 8px;border-radius:999px;border:1px solid #fed7aa;">✏ Changed</span>`;

  // Sort: main services first, then add-ons
  const sorted = [...services].sort(
    (a, b) => (a.is_addon ? 1 : 0) - (b.is_addon ? 1 : 0),
  );

  const totalDuration = sorted.reduce(
    (sum, s) => sum + (s.duration_minutes || 0) * (s.quantity || 1),
    0,
  );

  const servicesSubtotal = sorted.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );

  // Calculate credit card fee if payment method is Card, Credit Card, or Square
  const payMethod = (app.payment_method || "").toLowerCase();
  const isCardPayment =
    payMethod === "credit card" ||
    payMethod === "square" ||
    payMethod === "square invoice";
  const feePercent = Number(settings?.credit_card_fee_percent || 4);
  const creditCardFee =
    isCardPayment && servicesSubtotal > 0
      ? Math.round((Math.ceil(servicesSubtotal) * feePercent) / 100)
      : 0;

  const grandTotal = Math.ceil(servicesSubtotal) + creditCardFee;

  const accentColor = app.is_tentative
    ? "#d97706"
    : action === "deleted"
      ? "#dc2626"
      : isOnlineBooking
        ? "#f59e0b"
        : "#1d4ed8";
  const actionLabel = isOnlineBooking
    ? "Pending"
    : action === "created"
      ? "Confirmed"
      : action === "changed"
        ? "Updated"
        : "Cancelled";

  const startTime = new Date(app.start_time);
  const endTime = new Date(startTime.getTime() + (totalDuration || 60) * 60000);
  const baseUrl = process.env.AUTH_URL || process.env.BETTER_AUTH_URL || "";
  const icsUrl = `${baseUrl}/api/appointments/${app.id}/ics?recipient=${recipientType}`;
  const gcalTitle = encodeURIComponent(
    `${businessName} — Trip #${app.booking_number}`,
  );
  const gcalDetails = encodeURIComponent(
    `Booking Code: #${app.booking_number}\nDriver: ${app.employee_name || "TBD"}${app.vehicle_name ? `\nVehicle: ${app.vehicle_name}` : ""}${app.notes ? `\nNotes: ${app.notes}` : ""}`,
  );
  const gcalLocation = encodeURIComponent(app.pickup_address || "");
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${toGCalDate(startTime)}/${toGCalDate(endTime)}&details=${gcalDetails}&location=${gcalLocation}&ctz=America%2FChicago`;

  const calendarButtons =
    action !== "deleted" && includeCalendarLinks
      ? `
          <div style="padding:0 16px 8px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Add to My Calendar</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:8px;">
                  <a href="${gcalUrl}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">
                    <img src="https://www.google.com/favicon.ico" width="14" height="14" style="vertical-align:middle;margin-right:4px;" alt="" />Google Calendar
                  </a>
                </td>
                <td>
                  <a href="${icsUrl}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">
                    &#128197; Apple / Outlook
                  </a>
                </td>
              </tr>
            </table>
          </div>`
      : "";

  // Policy statement — shown only for passenger-facing emails
  const policySection =
    recipientType === "passenger"
      ? app.is_tour
        ? `<div style="margin:0 16px 8px;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#92400e;letter-spacing:0.8px;text-transform:uppercase;">📋 Payment Policy</p>
          <p style="margin:0;font-size:13px;color:#78350f;line-height:1.5;">Tours must be paid in full by 12:00 pm, 7 days before the tour.</p>
        </div>`
        : `<div style="margin:0 16px 8px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#1e40af;letter-spacing:0.8px;text-transform:uppercase;">📋 Refund Policy</p>
          <p style="margin:0;font-size:13px;color:#1e3a8a;line-height:1.5;">Refunds will be issued if the trip is cancelled by 12:00 pm, 24 hours before the trip. Costs for additional trip requests (if any) are subject to the refund policy of that provider.</p>
        </div>`
      : "";

  const bagParts = [];
  if (app.num_bags_checked) bagParts.push(`${app.num_bags_checked} Checked`);
  if (app.num_bags_carry_on) bagParts.push(`${app.num_bags_carry_on} Carry-on`);
  const bagsStr = bagParts.join(" + ") || null;

  // Detect trip direction: pickup at airport = INCOMING, dropoff at airport = OUTGOING
  const pickupLower = (
    app.pickup_street ||
    app.pickup_address ||
    ""
  ).toLowerCase();
  const dropoffLower = (
    app.dropoff_street ||
    app.dropoff_address ||
    app.destination ||
    ""
  ).toLowerCase();
  const airportKeywords = ["airport", "terminal", "concourse"];

  const isPickupAtAirport = airportKeywords.some((kw) =>
    pickupLower.includes(kw),
  );
  const isDropoffAtAirport = airportKeywords.some((kw) =>
    dropoffLower.includes(kw),
  );

  const isIncomingFlight = isPickupAtAirport && !isDropoffAtAirport;
  const isOutgoingFlight = isDropoffAtAirport && !isPickupAtAirport;

  // Determine flight label based on trip direction
  let flightLabel = "Flight";
  if (isIncomingFlight) {
    flightLabel = "Incoming Flight";
  } else if (isOutgoingFlight) {
    flightLabel = "Outgoing Flight";
  }

  // For round trips from airport (pickup at BNA): returning_flight_info = the outgoing leg
  const returningFlightLabel = isIncomingFlight
    ? "Outgoing Flight"
    : "Return Flight";

  // Format pickup address (combine structured fields or use legacy field)
  const pickupAddress = app.pickup_street
    ? [app.pickup_street, app.pickup_city, app.pickup_state, app.pickup_zip]
        .filter(Boolean)
        .join(", ")
    : app.pickup_address || null;

  // Format dropoff address (combine structured fields or use legacy field)
  const dropoffAddress = app.dropoff_street
    ? [app.dropoff_street, app.dropoff_city, app.dropoff_state, app.dropoff_zip]
        .filter(Boolean)
        .join(", ")
    : app.dropoff_address || app.destination || null;

  const rows = [
    ...(app.is_tentative
      ? [
          {
            label: "⚠️ Status",
            value: `<strong style="color:#d97706;">TENTATIVE${app.tentative_reason ? ` — ${app.tentative_reason}` : ""}</strong>`,
          },
        ]
      : []),
    { label: "Passenger", value: app.client_name || "Unknown" },
    { label: "Phone", value: app.client_phone || "N/A" },
    {
      label: "Date",
      value: formatLongDate(app.start_time),
    },
    { label: "Time", value: formatTime(app.start_time) },
    { label: "Driver", value: app.employee_name || "To Be Assigned" },
    ...(app.vehicle_name
      ? [{ label: "Vehicle", value: app.vehicle_name }]
      : []),
    { label: "Booking Code", value: `#${app.booking_number}` },
    // Show pickup and dropoff addresses
    ...(pickupAddress ? [{ label: "Pickup", value: pickupAddress }] : []),
    ...(dropoffAddress ? [{ label: "Dropoff", value: dropoffAddress }] : []),
    ...(app.num_people
      ? [{ label: "# of People", value: String(app.num_people) }]
      : []),
    ...(bagsStr ? [{ label: "# of Bags", value: bagsStr }] : []),
    ...(app.num_golf_bags
      ? [{ label: "Golf Bags", value: String(app.num_golf_bags) }]
      : []),
    ...(app.num_car_seats
      ? [{ label: "Car Seats", value: String(app.num_car_seats) }]
      : []),
    ...(app.outgoing_flight_info
      ? [{ label: flightLabel, value: app.outgoing_flight_info }]
      : []),
    ...(app.returning_flight_info
      ? [{ label: returningFlightLabel, value: app.returning_flight_info }] // dynamic label: "Outgoing Flight" for BNA pickups, "Return Flight" otherwise
      : []),
    ...(app.return_date
      ? [
          {
            label: "Return Date",
            value: formatDateOnly(app.return_date),
          },
        ]
      : []),
    ...(app.is_international_flight
      ? [{ label: "International Flight", value: "Yes" }]
      : []),
    ...(app.customs_clearance_location
      ? [{ label: "Customs Clearance", value: app.customs_clearance_location }]
      : []),
    {
      label: "Booked By",
      value:
        app.booked_by === "Admin" && app.booker_name
          ? `Admin — ${app.booker_name}`
          : app.booked_by || "Admin",
    },
    ...(app.payment_method
      ? [
          {
            label: "Payment Method",
            value: formatPaymentMethod(app.payment_method),
          },
        ]
      : []),
    // Add balance due if available
    ...(app.balance_due !== undefined && app.balance_due !== null
      ? [
          {
            label: "Balance Due",
            value: `<strong style="color:${app.balance_due > 0 ? "#dc2626" : "#16a34a"};">$${Number(app.balance_due).toFixed(2)}</strong>`,
          },
        ]
      : []),
  ];

  const detailRows = rows
    .map(
      ({ label, value }) => `
    <tr style="${changed.has(label) ? "background:#fffbf5;" : ""}">
      <td style="padding:5px 12px;font-size:12px;color:#6b7280;font-weight:600;width:130px;white-space:nowrap;border-bottom:1px solid #f3f4f6;text-transform:uppercase;letter-spacing:0.4px;">${label}</td>
      <td style="padding:5px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;font-weight:500;">${value}${changed.has(label) ? changedBadge : ""}</td>
    </tr>`,
    )
    .join("");

  const pricingRows =
    sorted.length > 0
      ? `
    <div style="margin:0 16px 6px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Pricing${changed.has("Pricing") ? `&nbsp;${changedBadge}` : ""}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;">
        ${sorted
          .map((s) => {
            const amt = Number(s.service_price) * Number(s.quantity || 1);
            const label = s.is_addon ? "PLUS" : "COST";
            const amtStr = s.is_addon
              ? `+$${amt.toFixed(2)}`
              : `$${amt.toFixed(2)}`;
            return `<tr>
            <td style="padding:8px 14px;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #f3f4f6;">${label}</td>
            <td style="padding:8px 14px;font-size:13px;color:#111827;font-weight:500;border-bottom:1px solid #f3f4f6;">${s.service_name || "Service"}</td>
            <td style="padding:8px 14px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">${amtStr}</td>
          </tr>`;
          })
          .join("")}
        ${
          creditCardFee > 0
            ? `<tr>
          <td style="padding:8px 14px;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #f3f4f6;">FEE</td>
          <td style="padding:8px 14px;font-size:13px;color:#6b7280;font-weight:500;border-bottom:1px solid #f3f4f6;">Credit Card Fee (${feePercent}%)</td>
          <td style="padding:8px 14px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">+$${creditCardFee.toFixed(2)}</td>
        </tr>`
            : ""
        }
        <tr style="background:#f9fafb;">
          <td colspan="2" style="padding:10px 14px;font-size:12px;color:#111827;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">TOTAL</td>
          <td style="padding:10px 14px;font-size:15px;color:#111827;font-weight:700;text-align:right;">$${grandTotal.toFixed(2)}</td>
        </tr>
      </table>
    </div>`
      : "";

  const notesEntries = [
    ...(includePassengerNotes && app.notes
      ? [{ label: "Notes", value: app.notes }]
      : []),
    ...(includeDriverNotes && app.driver_notes
      ? [{ label: "Driver Notes", value: app.driver_notes }]
      : []),
  ];

  const notesSection =
    notesEntries.length > 0
      ? `
    <div style="margin:0 16px 6px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Notes</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;">
        ${notesEntries
          .map(
            ({
              label,
              value,
            }) => `<tr${changed.has(label) ? ' style="background:#fffbf5;"' : ""}>
            <td style="padding:5px 12px;font-size:12px;color:#6b7280;font-weight:600;width:130px;white-space:nowrap;border-bottom:1px solid #f3f4f6;text-transform:uppercase;letter-spacing:0.4px;vertical-align:top;">${label}</td>
            <td style="padding:5px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;font-weight:500;white-space:pre-wrap;">${value.replace(/\n/g, "<br>")}${changed.has(label) ? changedBadge : ""}</td>
          </tr>`,
          )
          .join("")}
      </table>
    </div>`
      : "";

  // ── Payment button (auto-included when Square link exists) ──────────────
  const paymentMethodLabel = app.payment_method || "Online";
  const paymentProviderNote =
    app.payment_method === "Venmo"
      ? "Pay securely via Venmo"
      : app.payment_method === "Zelle"
        ? "Pay securely via Zelle"
        : app.payment_method === "Square"
          ? "Secure payment via Square"
          : "Secure online payment";
  const payButtonEmoji = app.payment_method === "Venmo" ? "💰" : "💳";

  const paymentButton =
    paymentUrl && action !== "deleted" && !isOnlineBooking && !app.is_tentative
      ? `
          <div style="padding:8px 24px 12px;text-align:center;">
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#15803d;letter-spacing:1px;text-transform:uppercase;">Payment Due</p>
              <p style="margin:0 0 12px;font-size:18px;color:#111827;font-weight:700;">$${Math.ceil(grandTotal || 0)}</p>
              <a href="${paymentUrl}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 48px;border-radius:10px;letter-spacing:0.3px;">${payButtonEmoji} Pay Now</a>
              <p style="margin:10px 0 0;font-size:11px;color:#6b7280;">${paymentProviderNote}</p>
            </div>
          </div>`
      : "";

  // Check if trip is paid
  const isPaid =
    app.payment_status === "paid" ||
    ((app.balance_due ?? 0) <= 0 && (app.payments_total ?? 0) > 0);

  // Paid status badge (replaces payment button when paid)
  const paidBadge =
    isPaid && action !== "deleted" && !isOnlineBooking && !app.is_tentative
      ? `
          <div style="padding:8px 24px 12px;text-align:center;">
            <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#15803d;letter-spacing:1px;text-transform:uppercase;">Payment Status</p>
              <p style="margin:0;font-size:18px;color:#16a34a;font-weight:700;">✓ This Trip is Paid</p>
            </div>
          </div>`
      : "";

  // ── Passenger confirmation section (show when confirmation is needed) ────
  const passengerConfirmSection =
    passengerConfirmUrl && action !== "deleted" && !isOnlineBooking
      ? `
          <div style="padding:20px 24px;text-align:center;background:#fef3c7;border-bottom:1px solid #fcd34d;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#92400e;letter-spacing:0.5px;">⚠️ CONFIRMATION REQUIRED</p>
            <p style="margin:0 0 16px;font-size:14px;color:#78350f;line-height:1.5;">Please confirm your trip by clicking the button below:</p>
            <a href="${passengerConfirmUrl}" style="display:inline-block;background:#10b981;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
              ✓ Confirm My Trip
            </a>
            <p style="margin:12px 0 0;font-size:11px;color:#92400e;">Click to confirm or cancel this trip</p>
          </div>`
      : "";

  // ── Driver profile section (show when driver is assigned) ────────────────
  // Use vehicle-specific profile image if available, otherwise fall back to employee profile
  const driverProfileImage =
    app.vehicle_profile_image_url || app.employee_profile_image_url;
  const driverProfileDesc = app.vehicle_profile_description;

  const driverProfileSection =
    app.employee_name && action !== "deleted" && !isOnlineBooking
      ? `
          <div style="padding:16px 24px;text-align:center;background:#fafbfc;border-bottom:1px solid #f3f4f6;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">YOUR DRIVER</p>
            ${
              driverProfileImage
                ? `<img src="${driverProfileImage}" alt="${app.employee_name}" style="width:288px;height:288px;border-radius:12px;object-fit:cover;border:4px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.1);display:block;margin:0 auto;" />`
                : `<div style="width:288px;height:288px;border-radius:12px;background:#2563EB;text-align:center;border:4px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.1);margin:0 auto;display:flex;align-items:center;justify-content:center;"><span style="color:#ffffff;font-size:120px;font-weight:700;font-family:'Inter',Arial,sans-serif;">${app.employee_name.charAt(0).toUpperCase()}</span></div>`
            }
            <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#111827;">${app.employee_name}</p>
            ${
              driverProfileDesc
                ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280;line-height:1.5;max-width:400px;margin-left:auto;margin-right:auto;">${driverProfileDesc}</p>`
                : ""
            }
            ${app.vehicle_name ? `<p style="margin:6px 0 0;font-size:12px;color:#9ca3af;font-weight:600;">Driving: ${app.vehicle_name}</p>` : ""}
          </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${businessName} — Trip ${actionLabel}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="background:${accentColor};border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="${businessName}" style="max-height:48px;max-width:160px;object-fit:contain;display:block;margin:0 auto 10px;" />`
              : `<p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</p>`
          }
          <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">${app.is_tentative ? "⚠️ TENTATIVE — " : ""}Trip ${actionLabel}</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
          <div style="padding:10px 24px 2px;">
            <p style="margin:0 0 1px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Booking Reference</p>
            <p style="margin:0;font-size:26px;font-weight:700;color:#111827;letter-spacing:-1.5px;">#${app.booking_number}</p>
          </div>
          ${passengerConfirmSection}
          ${driverProfileSection}
          <div style="margin:6px 24px;height:1px;background:#f3f4f6;"></div>
          <div style="padding:0 16px 6px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #f3f4f6;">${detailRows}</table>
          </div>
          ${pricingRows}
          ${notesSection}
          ${isPaid ? paidBadge : paymentButton}
          ${calendarButtons}
          ${policySection}
          <div style="padding:10px 24px;text-align:center;">
            <a href="${servicesUrl}" style="display:inline-block;background:${accentColor};color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">View Our Services →</a>
          </div>
          <div style="padding:0 24px 10px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">Need to make changes? ${modifyContact}.</p>
          </div>
          <div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
