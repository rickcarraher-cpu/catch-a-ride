import sql from "@/app/api/utils/sql";
import { toIcsDateCDT } from "@/utils/timezone";
import { getAppointmentById } from "../appointmentRetrieval";

function escapeIcs(str) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// ICS spec requires lines be folded at 75 octets (CRLF + single space continuation)
// Must count bytes, not characters, because non-ASCII chars are multi-byte in UTF-8
function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);
  if (bytes.length <= 75) return line;

  const chunks = [];
  let offset = 0;
  let isFirst = true;

  while (offset < bytes.length) {
    const maxBytes = isFirst ? 75 : 74; // continuation lines lose 1 byte to the leading space
    // Find a safe cut point that doesn't split a multi-byte char
    let end = Math.min(offset + maxBytes, bytes.length);
    // If we're in the middle of a multi-byte UTF-8 sequence, back up
    while (end > offset && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
      end--;
    }
    const slice = bytes.slice(offset, end);
    const decoded = new TextDecoder().decode(slice);
    chunks.push(isFirst ? decoded : " " + decoded);
    offset = end;
    isFirst = false;
  }
  return chunks.join("\r\n");
}

// Escape HTML special characters for X-ALT-DESC
function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request, { params }) {
  const { id } = params;

  // Extract query parameter to determine recipient type
  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("recipient"); // 'passenger' or 'driver'

  try {
    // Use getAppointmentById to get enriched trip with display fields
    const app = await getAppointmentById(id);

    if (!app) {
      return new Response("Appointment not found", { status: 404 });
    }

    const services = await sql`
      SELECT aps.*, s.name AS service_name, s.is_addon, s.is_tip_addon
      FROM appointment_services aps
      LEFT JOIN services s ON aps.service_id = s.id
      WHERE aps.appointment_id = ${id}
    `;

    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
    const businessName = settings.business_name || "Catch A Ride";
    const businessPhone = settings.business_phone || "";

    // Use only the first primary (non-addon) service duration — do NOT sum multiple services
    // as that inflates the calendar end time. One trip = one duration.
    const primaryServices = services.filter(
      (s) => !s.is_addon && !s.is_tip_addon,
    );
    const firstService =
      primaryServices.length > 0
        ? primaryServices[0]
        : services.length > 0
          ? services[0]
          : null;
    const totalDuration = firstService
      ? Number(firstService.duration_minutes) || 75
      : 75;

    const startTime = new Date(app.start_time);
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);
    const serviceNames = services
      .map((s) => s.service_name || "Service")
      .join(", ");

    // Build trip details URL (always available)
    const tripDetailsUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/booking/${app.id}`;

    // Build confirmation URL based on recipient type (for description text)
    let confirmationUrl = null;
    if (recipient === "passenger" && app.passenger_confirmation_token) {
      confirmationUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/passenger/confirm/${app.passenger_confirmation_token}`;
    } else if (recipient === "driver" && app.driver_confirmation_token) {
      confirmationUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/driver/confirm/${app.driver_confirmation_token}`;
    }

    // Build address strings
    const pickupAddress =
      app.display_pickup_address ||
      app.pickup_address ||
      [app.pickup_street, app.pickup_city, app.pickup_state, app.pickup_zip]
        .filter(Boolean)
        .join(", ");
    const dropoffAddress =
      app.display_dropoff_address ||
      app.dropoff_address ||
      [app.dropoff_street, app.dropoff_city, app.dropoff_state, app.dropoff_zip]
        .filter(Boolean)
        .join(", ");

    const isDriver = recipient === "driver";

    // Format status for display
    const statusDisplay = app.status === "completed" ? "Completed" : "";

    // SUMMARY: Only show passenger name
    const summaryText = app.passenger_name || "Trip";

    // DESCRIPTION: Build detailed plain-text description
    const descLines = [
      `Booking #${app.booking_number || app.id}`,
      statusDisplay ? `Status: ${statusDisplay}` : "",
      app.is_tentative
        ? `⚠ TENTATIVE${app.tentative_reason ? ": " + app.tentative_reason : ""}`
        : "",
      app.is_tour
        ? `Tour Trip${app.tour_participant_type ? " (" + app.tour_participant_type + ")" : ""}`
        : "",
      app.is_third_party && app.partner_company_name
        ? `Third-Party Trip — ${app.partner_company_name}`
        : "",
      app.wedding_id ? `Wedding Trip (Wedding #${app.wedding_id})` : "",
      "",
      // === CORE TRIP INFO (Required Fields) ===
      // Passenger Name
      `Passenger: ${app.client_name || "Unknown"}`,
      // Passenger Phone
      app.client_phone ? `Phone: ${app.client_phone}` : "",
      app.client_email ? `Email: ${app.client_email}` : "",
      "",
      // Driver Name
      `Driver: ${app.employee_name || "TBD"}`,
      isDriver && app.requested_driver_name
        ? `Requested Driver: ${app.requested_driver_name}`
        : "",
      app.vehicle_name ? `Vehicle: ${app.vehicle_name}` : "",
      app.vehicle_category ? `Vehicle Category: ${app.vehicle_category}` : "",
      "",
      // Pickup Time (Date/Time)
      app.display_full_datetime
        ? `Date/Time: ${app.display_full_datetime}`
        : "",
      // Return Date (only if set)
      app.display_return_date ||
        (app.return_date
          ? new Date(app.return_date).toLocaleString("en-US", {
              timeZone: "America/Chicago",
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null),
      app.display_tour_end_time ||
        (app.tour_end_time
          ? new Date(app.tour_end_time).toLocaleString("en-US", {
              timeZone: "America/Chicago",
              dateStyle: "medium",
              timeStyle: "short",
            })
          : null),
      "",
      // === LOCATIONS ===
      app.departure_location
        ? `Departure Location: ${app.departure_location}`
        : "",
      // Pickup Location
      pickupAddress ? `Pickup: ${pickupAddress}` : "",
      // Dropoff Location
      dropoffAddress ? `Dropoff: ${dropoffAddress}` : "",
      app.destination ? `Destination: ${app.destination}` : "",
      app.distance_miles
        ? `Distance: ${app.distance_miles} miles${app.distance_method ? " (" + app.distance_method + ")" : ""}`
        : "",
      "",
      // === PASSENGER & BAGGAGE DETAILS ===
      // # of Passengers
      app.num_people ? `# of Passengers: ${app.num_people}` : "",
      // Baggage (Checked + Carry-on)
      app.num_bags_checked || app.num_bags_carry_on
        ? `Bags: ${app.num_bags_checked || 0} checked / ${app.num_bags_carry_on || 0} carry-on`
        : "",
      // Car Seats
      app.num_car_seats ? `Car Seats: ${app.num_car_seats}` : "",
      // Golf Bags
      app.num_golf_bags ? `Golf Bags: ${app.num_golf_bags}` : "",
      "",
      // === FLIGHT INFORMATION ===
      app.is_international_flight ? `International Flight` : "",
      // Outgoing Flight
      app.outgoing_flight_info
        ? `Outgoing Flight: ${app.outgoing_flight_info}`
        : "",
      // Return Flight Info
      app.returning_flight_info
        ? `Returning Flight: ${app.returning_flight_info}`
        : "",
      app.customs_clearance_location
        ? `Customs Clearance: ${app.customs_clearance_location}`
        : "",
      "",
      // === SERVICE & BOOKING INFO ===
      `Service: ${serviceNames || "—"}`,
      app.booker_name ? `Booked By: ${app.booker_name}` : "",
      app.booked_by_dispatcher ? `Dispatcher: ${app.booked_by_dispatcher}` : "",
      "",
      // === CONFIRMATION STATUSES ===
      isDriver && app.driver_accepted
        ? `Driver Confirmation: ${
            app.driver_accepted.charAt(0).toUpperCase() +
            app.driver_accepted.slice(1)
          }${app.driver_declined_reason ? " — " + app.driver_declined_reason : ""}`
        : "",
      app.passenger_confirmed
        ? `Passenger Confirmation: ${
            app.passenger_confirmed.charAt(0).toUpperCase() +
            app.passenger_confirmed.slice(1)
          }${app.passenger_cancelled_reason ? " — " + app.passenger_cancelled_reason : ""}`
        : "",
      "",
      // === NOTES ===
      // Passenger Notes
      app.notes ? `Notes: ${app.notes}` : "",
      // Driver Notes (DRIVER VERSION ONLY)
      isDriver && app.driver_notes ? `Driver Notes: ${app.driver_notes}` : "",
      "",
      businessPhone ? `Contact ${businessName}: ${businessPhone}` : "",
      `Trip Details: ${tripDetailsUrl}`,
      confirmationUrl ? `Confirm Trip: ${confirmationUrl}` : "",
    ]
      .filter((line) => line !== null && line !== undefined && line !== "")
      .join("\n");

    // LOCATION field lets drivers/passengers tap to open in Google Maps / Apple Maps
    const locationStr = pickupAddress ? escapeIcs(pickupAddress) : "";

    // Build HTML description for Google Calendar (X-ALT-DESC)
    // Google Calendar often only renders the HTML version, ignoring plain DESCRIPTION
    const htmlParts = [
      `<b>Booking #${escapeHtml(app.booking_number || String(app.id))}</b>`,
      statusDisplay ? `<br/><b>Status:</b> ${escapeHtml(statusDisplay)}` : "",
      app.is_tentative
        ? `<br/>⚠ <b>TENTATIVE</b>${app.tentative_reason ? ": " + escapeHtml(app.tentative_reason) : ""}`
        : "",
      app.is_tour
        ? `<br/><b>Tour Trip</b>${app.tour_participant_type ? " (" + escapeHtml(app.tour_participant_type) + ")" : ""}`
        : "",
      app.is_third_party && app.partner_company_name
        ? `<br/><b>Third-Party Trip —</b> ${escapeHtml(app.partner_company_name)}`
        : "",
      app.wedding_id
        ? `<br/><b>Wedding Trip</b> (Wedding #${app.wedding_id})`
        : "",
      `<br/>`,
      // === CORE TRIP INFO (Required Fields) ===
      // Passenger Name
      `<br/><b>Passenger:</b> ${escapeHtml(app.client_name || "Unknown")}`,
      // Passenger Phone
      app.client_phone
        ? `<br/><b>Phone:</b> ${escapeHtml(app.client_phone)}`
        : "",
      app.client_email
        ? `<br/><b>Email:</b> ${escapeHtml(app.client_email)}`
        : "",
      `<br/>`,
      // Driver Name
      `<br/><b>Driver:</b> ${escapeHtml(app.employee_name || "TBD")}`,
      isDriver && app.requested_driver_name
        ? `<br/><b>Requested Driver:</b> ${escapeHtml(app.requested_driver_name)}`
        : "",
      app.vehicle_name
        ? `<br/><b>Vehicle:</b> ${escapeHtml(app.vehicle_name)}`
        : "",
      app.vehicle_category
        ? `<br/><b>Vehicle Category:</b> ${escapeHtml(app.vehicle_category)}`
        : "",
      `<br/>`,
      // Pickup Time (Date/Time)
      app.display_full_datetime
        ? `<br/><b>Date/Time:</b> ${escapeHtml(app.display_full_datetime)}`
        : "",
      // Return Date (only if set)
      app.display_return_date ||
        (app.return_date
          ? `<br/><b>Return Date:</b> ${escapeHtml(
              new Date(app.return_date).toLocaleString("en-US", {
                timeZone: "America/Chicago",
                dateStyle: "medium",
                timeStyle: "short",
              }),
            )}`
          : ""),
      app.display_tour_end_time ||
        (app.tour_end_time
          ? `<br/><b>Tour End Time:</b> ${escapeHtml(
              new Date(app.tour_end_time).toLocaleString("en-US", {
                timeZone: "America/Chicago",
                dateStyle: "medium",
                timeStyle: "short",
              }),
            )}`
          : ""),
      `<br/>`,
      // === LOCATIONS ===
      app.departure_location
        ? `<br/><b>Departure Location:</b> ${escapeHtml(app.departure_location)}`
        : "",
      // Pickup Location
      pickupAddress ? `<br/><b>Pickup:</b> ${escapeHtml(pickupAddress)}` : "",
      // Dropoff Location
      dropoffAddress
        ? `<br/><b>Dropoff:</b> ${escapeHtml(dropoffAddress)}`
        : "",
      app.destination
        ? `<br/><b>Destination:</b> ${escapeHtml(app.destination)}`
        : "",
      app.distance_miles
        ? `<br/><b>Distance:</b> ${app.distance_miles} miles${app.distance_method ? " (" + escapeHtml(app.distance_method) + ")" : ""}`
        : "",
      `<br/>`,
      // === PASSENGER & BAGGAGE DETAILS ===
      // # of Passengers
      app.num_people ? `<br/><b># of Passengers:</b> ${app.num_people}` : "",
      // Baggage (Checked + Carry-on)
      app.num_bags_checked || app.num_bags_carry_on
        ? `<br/><b>Bags:</b> ${app.num_bags_checked || 0} checked / ${app.num_bags_carry_on || 0} carry-on`
        : "",
      // Car Seats
      app.num_car_seats ? `<br/><b>Car Seats:</b> ${app.num_car_seats}` : "",
      // Golf Bags
      app.num_golf_bags ? `<br/><b>Golf Bags:</b> ${app.num_golf_bags}` : "",
      `<br/>`,
      // === FLIGHT INFORMATION ===
      app.is_international_flight ? `<br/><b>International Flight</b>` : "",
      // Outgoing Flight
      app.outgoing_flight_info
        ? `<br/><b>Outgoing Flight:</b> ${escapeHtml(app.outgoing_flight_info)}`
        : "",
      // Return Flight Info
      app.returning_flight_info
        ? `<br/><b>Returning Flight:</b> ${escapeHtml(app.returning_flight_info)}`
        : "",
      app.customs_clearance_location
        ? `<br/><b>Customs Clearance:</b> ${escapeHtml(app.customs_clearance_location)}`
        : "",
      `<br/>`,
      // === SERVICE & BOOKING INFO ===
      `<br/><b>Service:</b> ${escapeHtml(serviceNames || "—")}`,
      app.booker_name
        ? `<br/><b>Booked By:</b> ${escapeHtml(app.booker_name)}`
        : "",
      app.booked_by_dispatcher
        ? `<br/><b>Dispatcher:</b> ${escapeHtml(app.booked_by_dispatcher)}`
        : "",
      `<br/>`,
      // === CONFIRMATION STATUSES ===
      isDriver && app.driver_accepted
        ? `<br/><b>Driver Confirmation:</b> ${escapeHtml(
            app.driver_accepted.charAt(0).toUpperCase() +
              app.driver_accepted.slice(1),
          )}${app.driver_declined_reason ? " — " + escapeHtml(app.driver_declined_reason) : ""}`
        : "",
      app.passenger_confirmed
        ? `<br/><b>Passenger Confirmation:</b> ${escapeHtml(
            app.passenger_confirmed.charAt(0).toUpperCase() +
              app.passenger_confirmed.slice(1),
          )}${app.passenger_cancelled_reason ? " — " + escapeHtml(app.passenger_cancelled_reason) : ""}`
        : "",
      `<br/>`,
      // === NOTES ===
      // Passenger Notes
      app.notes
        ? `<br/><b>Notes:</b> ${escapeHtml(app.notes).replace(/\n/g, "<br/>")}`
        : "",
      // Driver Notes (DRIVER VERSION ONLY)
      isDriver && app.driver_notes
        ? `<br/><b>Driver Notes:</b> ${escapeHtml(app.driver_notes).replace(/\n/g, "<br/>")}`
        : "",
      `<br/>`,
      businessPhone
        ? `<br/>Contact ${escapeHtml(businessName)}: ${escapeHtml(businessPhone)}`
        : "",
      `<br/><a href="${tripDetailsUrl}">View Trip Details</a>`,
      confirmationUrl
        ? `<br/><a href="${confirmationUrl}">Confirm Trip</a>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    const htmlDesc = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2//EN"><HTML><BODY>${htmlParts}</BODY></HTML>`;

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:-//${escapeIcs(businessName)}//Booking//EN`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:America/Chicago",
      "BEGIN:DAYLIGHT",
      "TZOFFSETFROM:-0600",
      "TZOFFSETTO:-0500",
      "TZNAME:CDT",
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:-0500",
      "TZOFFSETTO:-0600",
      "TZNAME:CST",
      "DTSTART:19701101T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      `UID:booking-${app.id}@catcharide`,
      `DTSTAMP:${toIcsDateCDT(new Date())}`,
      `DTSTART;TZID=America/Chicago:${toIcsDateCDT(startTime)}`,
      `DTEND;TZID=America/Chicago:${toIcsDateCDT(endTime)}`,
      `SUMMARY:${escapeIcs(summaryText)}`,
      `DESCRIPTION:${escapeIcs(descLines)}`,
      `X-ALT-DESC;FMTTYPE=text/html:${escapeIcs(htmlDesc)}`,
      locationStr ? `LOCATION:${locationStr}` : null,
      `URL:${tripDetailsUrl}`,
      `ORGANIZER;CN=${escapeIcs(businessName)}:mailto:bookings@catcharide.us`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter((line) => line !== null)
      .map(foldIcsLine)
      .join("\r\n");

    return new Response(icsLines, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="booking-${app.booking_number || app.id}.ics"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[ICS]", err);
    return new Response("Error generating calendar file", { status: 500 });
  }
}
