import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const url = new URL(request.url);
  const bookingNumber = url.searchParams.get("booking_number");

  if (!bookingNumber) {
    return Response.json(
      { error: "Booking number is required" },
      { status: 400 },
    );
  }

  try {
    const appointments = await sql`
      SELECT a.*,
             c.name AS client_name,
             c.email AS client_email,
             c.phone AS client_phone,
             c.notification_preference AS client_notification_preference
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.booking_number = ${bookingNumber}
        AND a.tenant_id = 1
      LIMIT 1
    `;

    if (appointments.length === 0) {
      return Response.json({ error: "Booking not found" }, { status: 404 });
    }

    const appointment = appointments[0];

    const apptServices = await sql`
      SELECT aps.service_id, aps.service_price, aps.duration_minutes, aps.quantity, aps.stop_description,
             s.name AS service_name
      FROM appointment_services aps
      LEFT JOIN services s ON aps.service_id = s.id
      WHERE aps.appointment_id = ${appointment.id}
    `;

    return Response.json({
      ...appointment,
      appointment_services: apptServices,
    });
  } catch (err) {
    console.error("Lookup error:", err);
    return Response.json(
      { error: "Failed to look up booking" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { type, value } = await request.json();

    if (!type || !value?.trim()) {
      return Response.json(
        { error: "type and value are required" },
        { status: 400 },
      );
    }

    let clients = [];

    if (type === "phone") {
      // Normalize by stripping non-digits and matching last 10 digits
      const digits = value.replace(/\D/g, "");
      clients = await sql`
        SELECT * FROM clients
        WHERE tenant_id = 1
          AND is_active IS DISTINCT FROM false
          AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE ${"%" + digits}
        ORDER BY name ASC
      `;
    } else if (type === "email") {
      const cleanEmail = value.trim().toLowerCase();
      clients = await sql`
        SELECT * FROM clients
        WHERE tenant_id = 1
          AND is_active IS DISTINCT FROM false
          AND (
            LOWER(TRIM(email)) = ${cleanEmail}
            OR LOWER(cc_emails) LIKE ${"%" + cleanEmail + "%"}
          )
        ORDER BY name ASC
      `;
    } else if (type === "name") {
      clients = await sql`
        SELECT * FROM clients
        WHERE tenant_id = 1
          AND is_active IS DISTINCT FROM false
          AND LOWER(name) LIKE LOWER(${"%" + value.trim() + "%"})
        ORDER BY name ASC
      `;
    } else if (type === "address") {
      const term = "%" + value.trim().toLowerCase() + "%";
      clients = await sql`
        SELECT * FROM clients
        WHERE tenant_id = 1
          AND is_active IS DISTINCT FROM false
          AND (
            LOWER(COALESCE(street_address, '')) LIKE ${term}
            OR LOWER(COALESCE(city, '')) LIKE ${term}
            OR LOWER(COALESCE(state, '')) LIKE ${term}
            OR LOWER(COALESCE(zip_code, '')) LIKE ${term}
            OR LOWER(COALESCE(address, '')) LIKE ${term}
          )
        ORDER BY name ASC
      `;
    } else {
      return Response.json({ error: "Invalid lookup type" }, { status: 400 });
    }

    if (clients.length === 0) {
      return Response.json({ found: false });
    }

    // Return the best match (first result) plus all matches so the client can cycle through
    return Response.json({
      found: true,
      client: clients[0],
      all_matches: clients,
    });
  } catch (err) {
    console.error("Passenger lookup error:", err);
    return Response.json(
      { error: "Failed to look up passenger" },
      { status: 500 },
    );
  }
}
