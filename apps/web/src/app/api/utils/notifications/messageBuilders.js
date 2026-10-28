import {
  formatPaymentMethod,
  formatLongDate,
  formatTime,
  formatDateOnly,
} from "./formatters";

// ── Message builder ───────────────────────────────────────────────────────────

export function buildBookingMessage({
  action,
  app,
  services = [],
  settings = {},
  changedFields = [],
  includeDriverNotes = true, // set false for passenger-facing messages
  paymentUrl = null, // payment link URL if available
  tourParticipants = [], // For tour trips
  tourItinerary = [], // For tour trips
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const servicesUrl = settings.services_url || "https://catcharide.us";
  const modifyContact = settings.business_phone
    ? `call us at ${settings.business_phone}`
    : "reply to this message";

  // Sort: main services first, then add-ons
  const sorted = [...services].sort(
    (a, b) => (a.is_addon ? 1 : 0) - (b.is_addon ? 1 : 0),
  );

  // Split: gas fee services are treated like tips — excluded from CC fee base
  const isGasFeeService = (s) =>
    typeof s.service_name === "string" &&
    s.service_name.toLowerCase().includes("gas");
  const regularServices = sorted.filter((s) => !isGasFeeService(s));
  const gasFeeServices = sorted.filter(isGasFeeService);

  const regularSubtotal = regularServices.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );
  const gasFeeSubtotal = gasFeeServices.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );
  const grandTotal = regularSubtotal + gasFeeSubtotal;

  // Calculate credit card fee if payment method is card-based
  // CC fee applies only to regular services (not gas fees — same as tips)
  const msgPayMethod = (app.payment_method || "").toLowerCase();
  const msgIsCardPayment =
    msgPayMethod === "card" ||
    msgPayMethod === "credit card" ||
    msgPayMethod === "square" ||
    msgPayMethod === "square invoice";
  const msgFeePercent = Number(settings?.credit_card_fee_percent || 4);
  const msgCreditCardFee =
    msgIsCardPayment && regularSubtotal > 0
      ? Math.round((Math.ceil(regularSubtotal) * msgFeePercent) / 100)
      : 0;
  const msgGrandTotal =
    Math.ceil(regularSubtotal) + msgCreditCardFee + Math.ceil(gasFeeSubtotal);

  const changed = new Set(changedFields);
  const mark = (label) => (changed.has(label) ? "  ← CHANGED" : "");

  const lines = [`A ${app.is_tour ? "tour" : "trip"} has been ${action}.`, ``];

  if (app.is_tentative) {
    lines.push(
      `⚠️ TENTATIVE${app.tentative_reason ? ` — ${app.tentative_reason}` : ""}`,
    );
    lines.push(``);
  }

  // For tours, show different header
  if (app.is_tour) {
    lines.push(
      `🚐 TOUR DETAILS`,
      `Vehicle: ${app.vehicle_name || "Luxury Van"}${mark("Vehicle")}`,
      `Driver: ${app.employee_name || "—"}${mark("Driver")}`,
      `Date: ${formatLongDate(app.start_time)}${mark("Date")}`,
      `Start Time: ${formatTime(app.start_time)}${mark("Time")}`,
    );

    if (app.tour_end_time) {
      lines.push(
        `End Time: ${formatTime(app.tour_end_time)}${mark("End Time")}`,
      );
      const start = new Date(app.start_time);
      const end = new Date(app.tour_end_time);
      const durationMinutes = (end - start) / (1000 * 60);
      const durationHours = (durationMinutes / 60).toFixed(1);
      lines.push(`Duration: ${durationHours} hours`);
    }

    lines.push(`Booking Code: #${app.booking_number}`);
    lines.push(``);

    // Tour participants section
    if (tourParticipants && tourParticipants.length > 0) {
      lines.push(`--- PARTICIPANTS (${tourParticipants.length}) ---`);
      tourParticipants.forEach((p, index) => {
        lines.push(`${index + 1}. ${p.name}`);
        if (p.phone) lines.push(`   Phone: ${p.phone}`);
        if (p.email) lines.push(`   Email: ${p.email}`);
        if (p.pickup_location) lines.push(`   🟢 Pickup: ${p.pickup_location}`);
        if (p.dropoff_location)
          lines.push(`   🔴 Drop-off: ${p.dropoff_location}`);
      });
      lines.push(``);
    }

    // Tour itinerary section
    if (tourItinerary && tourItinerary.length > 0) {
      lines.push(`--- ITINERARY ---`);
      tourItinerary.forEach((stop, index) => {
        lines.push(`${index + 1}. ${stop.location}`);
        if (stop.description) lines.push(`   ${stop.description}`);
      });
      lines.push(``);
    }

    // Tour pricing section
    const flatFee = Number(app.tour_flat_fee || 0);
    if (flatFee > 0) {
      lines.push(`--- PRICING ---`);
      lines.push(`Flat Fee: $${flatFee.toFixed(2)} (no mileage calculation)`);

      if (
        app.tour_payment_split === "divided" &&
        tourParticipants &&
        tourParticipants.length > 0
      ) {
        const perPerson = Math.ceil(flatFee / tourParticipants.length);
        lines.push(
          `Payment: Split equally among ${tourParticipants.length} participants`,
        );
        lines.push(`Per Person: $${perPerson.toFixed(2)} (rounded up)`);
      } else {
        lines.push(`Payment: Paid by one passenger`);
      }

      if (msgCreditCardFee > 0) {
        lines.push(
          `FEE: +$${msgCreditCardFee.toFixed(2)} — Credit Card Fee (${msgFeePercent}%)`,
        );
      }
      lines.push(
        `TOTAL: $${(Math.ceil(flatFee) + msgCreditCardFee).toFixed(2)}`,
      );
      lines.push(``);
    }

    if (app.destination) {
      lines.push(
        `Destination (logistics only): ${app.destination}${mark("Destination")}`,
      );
      lines.push(``);
    }
  } else {
    // Standard trip format
    lines.push(
      `Passenger: ${app.client_name || "Unknown"}${mark("Passenger")}`,
      `Phone: ${app.client_phone || "N/A"}`,
      `Date: ${formatLongDate(app.start_time)}${mark("Date")}`,
      `Time: ${formatTime(app.start_time)}${mark("Time")}`,
      `Driver: ${app.employee_name || "—"}${mark("Driver")}`,
      `Vehicle: ${app.vehicle_name || "—"}${mark("Vehicle")}`,
      `Booking Code: #${app.booking_number}`,
    );

    // Check if trip is paid
    const isPaid =
      app.payment_status === "paid" ||
      ((app.balance_due ?? 0) <= 0 && (app.payments_total ?? 0) > 0);

    if (isPaid) {
      lines.push(`✓ This Trip is Paid`);
    }

    if (app.num_people)
      lines.push(`# of People: ${app.num_people}${mark("# of People")}`);
    if (app.num_bags_checked || app.num_bags_carry_on) {
      const bagParts = [];
      if (app.num_bags_checked)
        bagParts.push(`${app.num_bags_checked} Checked`);
      if (app.num_bags_carry_on)
        bagParts.push(`${app.num_bags_carry_on} Carry-on`);
      lines.push(`# of Bags: ${bagParts.join(" + ")}${mark("# of Bags")}`);
    }
    if (app.num_golf_bags)
      lines.push(`Golf Bags: ${app.num_golf_bags}${mark("Golf Bags")}`);
    if (app.num_car_seats)
      lines.push(`Car Seats: ${app.num_car_seats}${mark("Car Seats")}`);

    // ... rest of flight info and standard trip fields ...
    if (app.outgoing_flight_info) {
      // Determine direction based on pickup/dropoff locations
      const pickupLower = (
        app.pickup_street ||
        app.pickup_address ||
        ""
      ).toLowerCase();
      const dropoffLower = (
        app.dropoff_street ||
        app.dropoff_address ||
        ""
      ).toLowerCase();
      const airportKeywords = ["airport", "terminal", "concourse"];

      const isPickupAtAirport = airportKeywords.some((kw) =>
        pickupLower.includes(kw),
      );
      const isDropoffAtAirport = airportKeywords.some((kw) =>
        dropoffLower.includes(kw),
      );

      // If pickup is at airport → INCOMING (passenger arriving)
      // If dropoff is at airport → OUTGOING (passenger departing)
      const isIncomingFlight = isPickupAtAirport && !isDropoffAtAirport;
      const isOutgoingFlight = isDropoffAtAirport && !isPickupAtAirport;

      let flightLabel = "Flight Info";
      if (isIncomingFlight) {
        flightLabel = "Incoming Flight";
      } else if (isOutgoingFlight) {
        flightLabel = "Outgoing Flight";
      }

      // For round trips from airport: returning_flight_info = outgoing leg
      const returningLabel = isIncomingFlight
        ? "Outgoing Flight"
        : "Return Information";

      lines.push(
        `${flightLabel}: ${app.outgoing_flight_info}${mark(flightLabel)}`,
      );
    }
    if (app.returning_flight_info) {
      // Determine direction label for returning flight info
      const rtPickupLower = (
        app.pickup_street ||
        app.pickup_address ||
        ""
      ).toLowerCase();
      const rtDropoffLower = (
        app.dropoff_street ||
        app.dropoff_address ||
        ""
      ).toLowerCase();
      const rtAirportKws = ["airport", "terminal", "concourse"];
      const rtIsPickupAtAirport = rtAirportKws.some((kw) =>
        rtPickupLower.includes(kw),
      );
      const rtIsDropoffAtAirport = rtAirportKws.some((kw) =>
        rtDropoffLower.includes(kw),
      );
      const rtReturningLabel =
        rtIsPickupAtAirport && !rtIsDropoffAtAirport
          ? "Incoming Flight"
          : "Return Information";
      lines.push(
        `${rtReturningLabel}: ${app.returning_flight_info}${mark("Return Information")}`,
      );
    }
    if (app.return_date)
      lines.push(
        `Return Date: ${formatDateOnly(app.return_date)}${mark("Return Date")}`,
      );
    if (app.is_international_flight) lines.push(`International Flight: Yes`);
    if (app.customs_clearance_location)
      lines.push(
        `Customs Clearance: ${app.customs_clearance_location}${mark("Customs Clearance")}`,
      );

    const bookedByLabel =
      app.booked_by === "Admin" && app.booker_name
        ? `Admin — ${app.booker_name}`
        : app.booked_by || "Admin";
    lines.push(`Booked By: ${bookedByLabel}`);

    if (app.payment_method)
      lines.push(
        `Payment Method: ${formatPaymentMethod(app.payment_method)}${mark("Payment Method")}`,
      );

    // Add balance due if available
    if (app.balance_due !== undefined && app.balance_due !== null) {
      lines.push(`Balance Due: $${Number(app.balance_due).toFixed(2)}`);
    }

    if (sorted.length > 0) {
      lines.push(``);
      lines.push(`--- PRICING ---${mark("Pricing")}`);
      regularServices.forEach((s) => {
        const amt = Number(s.service_price) * Number(s.quantity || 1);
        const label = s.is_addon ? "PLUS" : "COST";
        lines.push(
          `${label}: $${amt.toFixed(2)} — ${s.service_name || "Service"}`,
        );
      });
      if (msgCreditCardFee > 0) {
        lines.push(
          `FEE: +$${msgCreditCardFee.toFixed(2)} — Credit Card Fee (${msgFeePercent}%)`,
        );
      }
      // Gas fee services — shown like tips (no commission)
      gasFeeServices.forEach((s) => {
        const amt = Number(s.service_price) * Number(s.quantity || 1);
        lines.push(
          `GAS: $${amt.toFixed(2)} — ${s.service_name || "Gas Fee"} (no commission)`,
        );
      });
      lines.push(`TOTAL: $${msgGrandTotal.toFixed(2)}`);
      lines.push(``);
    }
  }

  if (app.notes) lines.push(`Notes: ${app.notes}${mark("Notes")}`);
  if (includeDriverNotes && app.driver_notes)
    lines.push(`Driver Notes: ${app.driver_notes}${mark("Driver Notes")}`);

  // Add payment link if available and trip is not already paid
  const isPaid = app.is_tour
    ? false // Check tour payment status if needed
    : app.payment_status === "paid" ||
      ((app.balance_due ?? 0) <= 0 && (app.payments_total ?? 0) > 0);

  if (paymentUrl && !isPaid && action !== "deleted" && !app.is_tentative) {
    lines.push(``);
    lines.push(`💳 PAY ONLINE:`);
    lines.push(paymentUrl);
  }

  lines.push(``);
  lines.push(`More information about our services:`);
  lines.push(servicesUrl);
  lines.push(``);
  lines.push(`If you need to modify this booking, ${modifyContact}.`);

  return lines.join("\n");
}

// ── Build SMS message from simple template (passenger-facing) ─────────────────

export function buildSmsMessage(template, vars = {}) {
  return template
    .replace(/\{name\}/gi, vars.name || "")
    .replace(/\{date\}/gi, vars.date || "")
    .replace(/\{time\}/gi, vars.time || "")
    .replace(/\{business\}/gi, vars.business || "")
    .replace(/\{driver\}/gi, vars.driver || "");
}
