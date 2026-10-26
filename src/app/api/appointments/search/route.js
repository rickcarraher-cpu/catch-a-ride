import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const payment_method = (url.searchParams.get("payment_method") || "").trim(); // NEW
  const searchType = (url.searchParams.get("searchType") || "all").trim(); // NEW: Get searchType parameter
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // NEW: Handle payment_method filtering
  if (!q && payment_method) {
    try {
      const rows = await sql(
        `SELECT a.id, a.booking_number, a.start_time, a.payment_method,
                c.name AS client_name
         FROM appointments a
         LEFT JOIN clients c ON a.client_id = c.id AND c.is_active IS NOT FALSE
         WHERE a.tenant_id = 1
           AND a.status NOT IN ('deleted')
           AND (a.payment_method = $1 OR ($1 = 'Not Specified' AND (a.payment_method IS NULL OR a.payment_method = '' OR a.payment_method = 'Not Specified')))
         ORDER BY a.start_time DESC
         LIMIT $2 OFFSET $3`,
        [payment_method, limit, offset],
      );
      return Response.json({ results: rows });
    } catch (err) {
      console.error("Payment method filter error:", err);
      return Response.json(
        { error: "Failed to filter by payment method" },
        { status: 500 },
      );
    }
  }

  // Allow status-only filtering (lightweight query for polling)
  if (!q && status) {
    try {
      // Special handling for needs_review: fetch all trips with this status
      // Bug fix: Remove extra conditions on driver_response_at and passenger_response_at
      // Bug fix: Fetch full data (passenger phone/email, driver name, services)
      if (status === "needs_review") {
        const rows = await sql(
          `SELECT a.id, a.booking_number, a.start_time, a.status,
                  a.destination, a.notes, a.pickup_address, a.dropoff_address,
                  a.driver_response_at, a.passenger_response_at,
                  a.created_at,
                  c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
                  e.name AS employee_name
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id AND c.is_active IS NOT FALSE
           LEFT JOIN employees e ON a.employee_id = e.id
           WHERE a.tenant_id = 1
             AND a.status = 'needs_review'
           ORDER BY a.start_time DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset],
        );

        // Fetch services for these trips
        if (rows.length > 0) {
          const ids = rows.map((a) => a.id);
          const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
          const allServices = await sql(
            `SELECT aps.appointment_id, aps.service_id, aps.service_price, aps.duration_minutes, aps.quantity,
                    s.name AS service_name
             FROM appointment_services aps
             LEFT JOIN services s ON aps.service_id = s.id
             WHERE aps.appointment_id IN (${placeholders})`,
            ids,
          );
          const servicesByAppt = {};
          for (const svc of allServices) {
            if (!servicesByAppt[svc.appointment_id])
              servicesByAppt[svc.appointment_id] = [];
            servicesByAppt[svc.appointment_id].push(svc);
          }
          for (const appt of rows) {
            appt.appointment_services = servicesByAppt[appt.id] || [];
          }
        }

        // Bug fix: Return results in an object with results key (not a plain array)
        return Response.json({ results: rows });
      } else {
        // Normal status filtering for other statuses
        const rows = await sql(
          `SELECT a.id, a.booking_number, a.start_time, a.status,
                  c.name AS client_name
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id AND c.is_active IS NOT FALSE
           WHERE a.tenant_id = 1
             AND a.status = $1
           ORDER BY a.start_time DESC
           LIMIT $2 OFFSET $3`,
          [status, limit, offset],
        );
        return Response.json(rows);
      }
    } catch (err) {
      console.error("Status filter error:", err);
      return Response.json(
        { error: "Failed to filter by status" },
        { status: 500 },
      );
    }
  }

  if (!q || q.length < 2) {
    return Response.json(
      { error: "Search query must be at least 2 characters" },
      { status: 400 },
    );
  }

  try {
    // Optimized search using indexes - search across multiple fields
    const digits = q.replace(/\D/g, "");
    const likeLowerQ = `%${q.toLowerCase()}%`;

    // Split query into individual words for better matching
    // "Sara Herbert" → ['sara', 'herbert'] — each word must match independently
    const words = q
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);

    // Common SELECT fields for search results — includes all fields the TripsTable needs
    const selectFields = `
        a.id, a.booking_number, a.start_time, a.destination, a.status,
        a.client_id, a.employee_id, a.vehicle_id,
        a.num_people, a.payment_method, a.requested_driver_name,
        a.notes, a.driver_notes, a.outgoing_flight_info, a.returning_flight_info,
        a.return_date, a.num_bags_checked, a.num_bags_carry_on,
        a.is_tentative, a.tentative_reason, a.booked_by, a.booker_name,
        a.created_at,
        a.pickup_address, a.pickup_street, a.pickup_city, a.pickup_state, a.pickup_zip,
        a.dropoff_address, a.dropoff_street, a.dropoff_city, a.dropoff_state, a.dropoff_zip,
        a.distance_miles, a.payment_status, a.payment_amount, a.original_amount,
        a.payments_total, a.tips_total, a.balance_due,
        a.driver_accepted, a.passenger_confirmed, a.driver_response_at, a.passenger_response_at,
        a.thankyou_sent_at, a.vehicle_category,
        c.name AS client_name, c.email AS client_email, c.phone AS client_phone,
        c.notification_preference AS client_notification_preference,
        c.is_new_passenger AS client_is_new_passenger,
        c.referral_source AS referral_source,
        e.name AS employee_name, e.color AS employee_color,
        e.profile_image_url AS employee_profile_image_url,
        v.name AS vehicle_name, v.category AS vehicle_actual_category,
        COUNT(*) OVER() AS total_count`;

    // Build WHERE clause and params dynamically based on searchType
    // We use word-based matching: each word must appear in at least one of the searched fields
    let params = [];
    let paramIdx = 1;
    let whereConditions;

    if (searchType === "passenger") {
      // Only search passenger/client fields
      if (digits.length >= 4) {
        // Phone number match (single param) OR all words match name/email
        const likeDigits = `%${digits}%`;
        params.push(likeDigits);
        const phoneParamIdx = paramIdx++;

        // Each word gets its own param
        const wordParamIndices = words.map((w) => {
          params.push(`%${w}%`);
          return paramIdx++;
        });

        const wordConditions = wordParamIndices
          .map((i) => `(LOWER(c.name) LIKE $${i} OR LOWER(c.email) LIKE $${i})`)
          .join(" AND ");

        whereConditions = `(
          REPLACE(REPLACE(REPLACE(REPLACE(c.phone, '-', ''), '(', ''), ')', ''), ' ', '') LIKE $${phoneParamIdx}
          OR (${wordConditions})
        )`;
      } else {
        // All words must match name or email
        const wordParamIndices = words.map((w) => {
          params.push(`%${w}%`);
          return paramIdx++;
        });

        const wordConditions = wordParamIndices
          .map((i) => `(LOWER(c.name) LIKE $${i} OR LOWER(c.email) LIKE $${i})`)
          .join(" AND ");

        whereConditions = `(${wordConditions || "FALSE"})`;
      }
    } else if (searchType === "driver") {
      // All words must match driver/employee name
      const wordParamIndices = words.map((w) => {
        params.push(`%${w}%`);
        return paramIdx++;
      });

      const wordConditions = wordParamIndices
        .map((i) => `LOWER(e.name) LIKE $${i}`)
        .join(" AND ");

      whereConditions = `(${wordConditions || "FALSE"})`;
    } else if (searchType === "booking") {
      // Search by booking number only — exact prefix or contains match
      params.push(`%${q}%`);
      const bookingParamIdx = paramIdx++;

      whereConditions = `(LOWER(a.booking_number) LIKE $${bookingParamIdx})`;
    } else {
      // Search all fields (default behavior) — use original full-string LIKE for broad match
      if (digits.length >= 4) {
        const likeDigits = `%${digits}%`;
        params.push(likeDigits);
        const phoneParamIdx = paramIdx++;
        params.push(likeLowerQ);
        const textParamIdx = paramIdx++;

        whereConditions = `(
          REPLACE(REPLACE(REPLACE(REPLACE(c.phone, '-', ''), '(', ''), ')', ''), ' ', '') LIKE $${phoneParamIdx}
          OR LOWER(c.name) LIKE $${textParamIdx}
          OR LOWER(c.email) LIKE $${textParamIdx}
          OR LOWER(e.name) LIKE $${textParamIdx}
          OR LOWER(a.destination) LIKE $${textParamIdx}
          OR LOWER(a.booking_number) LIKE $${textParamIdx}
          OR LOWER(a.notes) LIKE $${textParamIdx}
          OR CAST(a.id AS TEXT) LIKE $${phoneParamIdx}
        )`;
      } else {
        params.push(likeLowerQ);
        const textParamIdx = paramIdx++;

        // Also add word-based matching for name fields
        const wordParamIndices = words.map((w) => {
          params.push(`%${w}%`);
          return paramIdx++;
        });

        const wordNameConditions =
          wordParamIndices.length > 0
            ? wordParamIndices
                .map(
                  (i) =>
                    `(LOWER(c.name) LIKE $${i} OR LOWER(e.name) LIKE $${i})`,
                )
                .join(" AND ")
            : null;

        whereConditions = `(
          LOWER(c.name) LIKE $${textParamIdx}
          OR LOWER(c.email) LIKE $${textParamIdx}
          OR LOWER(e.name) LIKE $${textParamIdx}
          OR LOWER(a.destination) LIKE $${textParamIdx}
          OR LOWER(a.booking_number) LIKE $${textParamIdx}
          OR LOWER(a.notes) LIKE $${textParamIdx}
          OR CAST(a.id AS TEXT) LIKE $${textParamIdx}
          ${wordNameConditions ? `OR (${wordNameConditions})` : ""}
        )`;
      }
    }

    // Add LIMIT and OFFSET params
    params.push(limit);
    const limitParamIdx = paramIdx++;
    params.push(offset);
    const offsetParamIdx = paramIdx++;

    const query = `
      SELECT ${selectFields}
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id AND c.is_active IS NOT FALSE
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.tenant_id = 1
        AND a.status NOT IN ('deleted')
        AND ${whereConditions}
      ORDER BY a.start_time DESC
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;

    const appointments = await sql(query, params);

    // For each appointment, fetch its services using optimized batch query
    if (appointments.length > 0) {
      const ids = appointments.map((a) => a.id);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      const allServices = await sql(
        `SELECT aps.appointment_id, aps.service_id, aps.service_price, aps.duration_minutes, aps.quantity, aps.stop_description,
                s.name AS service_name, s.is_addon AS is_addon
         FROM appointment_services aps
         LEFT JOIN services s ON aps.service_id = s.id
         WHERE aps.appointment_id IN (${placeholders})`,
        ids,
      );

      const servicesByAppt = {};
      for (const svc of allServices) {
        if (!servicesByAppt[svc.appointment_id]) {
          servicesByAppt[svc.appointment_id] = [];
        }
        servicesByAppt[svc.appointment_id].push(svc);
      }

      for (const appt of appointments) {
        appt.appointment_services = servicesByAppt[appt.id] || [];
      }
    }

    const totalCount =
      appointments.length > 0 ? appointments[0].total_count : 0;

    return Response.json({
      results: appointments,
      total: totalCount,
      limit,
      offset,
      query: q,
    });
  } catch (err) {
    console.error("Search error:", err);
    return Response.json(
      { error: "Failed to search bookings" },
      { status: 500 },
    );
  }
}
