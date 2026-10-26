import sql from "@/app/api/utils/sql";

// GET - List third-party trips
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id") || 1;
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const partnerId = searchParams.get("partner_id");
    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("payment_status");

    let query = `
      SELECT 
        a.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        e.name as driver_name,
        pc.name as partner_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN partner_companies pc ON a.partner_company_id = pc.id
      WHERE a.tenant_id = $1 AND a.is_third_party = true
    `;
    const params = [tenantId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND a.start_time >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND a.start_time <= $${paramIndex++}`;
      params.push(endDate);
    }

    if (partnerId) {
      query += ` AND a.partner_company_id = $${paramIndex++}`;
      params.push(partnerId);
    }

    if (status) {
      query += ` AND a.status = $${paramIndex++}`;
      params.push(status);
    }

    if (paymentStatus) {
      query += ` AND a.payment_status = $${paramIndex++}`;
      params.push(paymentStatus);
    }

    query += ` ORDER BY a.start_time DESC`;

    const trips = await sql(query, params);

    return Response.json({ trips });
  } catch (error) {
    console.error("Error fetching third-party trips:", error);
    return Response.json(
      { error: "Failed to fetch third-party trips" },
      { status: 500 },
    );
  }
}

// POST - Create a new third-party trip
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      tenant_id = 1,
      partner_company_id,
      client_id,
      employee_id,
      vehicle_id,
      start_time,
      pickup_address,
      dropoff_address,
      pickup_street,
      pickup_city,
      pickup_state,
      pickup_zip,
      dropoff_street,
      dropoff_city,
      dropoff_state,
      dropoff_zip,
      num_people,
      num_bags_checked,
      num_bags_carry_on,
      notes,
      driver_notes,
      passenger_payer_name,
      passenger_payer_email,
      passenger_payer_phone,
      receipt_footer_note,
      services = [],
      payment_method,
      vehicle_category,
    } = body;

    // Validate required fields
    if (!partner_company_id) {
      return Response.json(
        { error: "Partner company is required" },
        { status: 400 },
      );
    }

    if (!start_time) {
      return Response.json(
        { error: "Start time is required" },
        { status: 400 },
      );
    }

    if (!pickup_address && !pickup_street) {
      return Response.json(
        { error: "Pickup address is required" },
        { status: 400 },
      );
    }

    if (!dropoff_address && !dropoff_street) {
      return Response.json(
        { error: "Dropoff address is required" },
        { status: 400 },
      );
    }

    // Get partner company details to snapshot
    const partnerResult = await sql`
      SELECT * FROM partner_companies WHERE id = ${partner_company_id}
    `;

    if (partnerResult.length === 0) {
      return Response.json(
        { error: "Partner company not found" },
        { status: 404 },
      );
    }

    const partner = partnerResult[0];

    // Generate booking number
    const bookingNumberResult = await sql`
      SELECT COALESCE(MAX(CAST(SUBSTRING(booking_number FROM '[0-9]+') AS INTEGER)), 0) + 1 as next_num
      FROM appointments
      WHERE tenant_id = ${tenant_id}
    `;
    const nextNum = bookingNumberResult[0].next_num;
    const booking_number = `CAR-${String(nextNum).padStart(4, "0")}`;

    // Calculate services total
    let services_total = 0;
    for (const service of services) {
      services_total +=
        parseFloat(service.service_price || 0) * (service.quantity || 1);
    }

    // Create the appointment
    const appointmentResult = await sql`
      INSERT INTO appointments (
        tenant_id, partner_company_id, client_id, employee_id, vehicle_id,
        start_time, pickup_address, dropoff_address,
        pickup_street, pickup_city, pickup_state, pickup_zip,
        dropoff_street, dropoff_city, dropoff_state, dropoff_zip,
        num_people, num_bags_checked, num_bags_carry_on,
        notes, driver_notes, booking_number, payment_method,
        vehicle_category, services_total, original_amount, balance_due,
        is_third_party, partner_company_name, partner_logo_url,
        partner_billing_email, partner_billing_phone, partner_billing_address,
        invoice_brand_name, receipt_footer_note,
        passenger_payer_name, passenger_payer_email, passenger_payer_phone,
        bill_to_passenger, internal_operator,
        status, booked_by, payment_status
      ) VALUES (
        ${tenant_id}, ${partner_company_id}, ${client_id || null}, ${employee_id || null}, ${vehicle_id || null},
        ${start_time}, ${pickup_address || null}, ${dropoff_address || null},
        ${pickup_street || null}, ${pickup_city || null}, ${pickup_state || null}, ${pickup_zip || null},
        ${dropoff_street || null}, ${dropoff_city || null}, ${dropoff_state || null}, ${dropoff_zip || null},
        ${num_people || null}, ${num_bags_checked || null}, ${num_bags_carry_on || null},
        ${notes || null}, ${driver_notes || null}, ${booking_number}, ${payment_method || null},
        ${vehicle_category || null}, ${services_total}, ${services_total}, ${services_total},
        true, ${partner.name}, ${partner.logo_url || null},
        ${partner.billing_email || null}, ${partner.billing_phone || null}, ${partner.billing_address || null},
        ${partner.name}, ${receipt_footer_note || null},
        ${passenger_payer_name || null}, ${passenger_payer_email || null}, ${passenger_payer_phone || null},
        true, 'CatchARide',
        'pending', 'Admin', 'unpaid'
      )
      RETURNING *
    `;

    const appointment = appointmentResult[0];

    // Insert services
    for (const service of services) {
      await sql`
        INSERT INTO appointment_services (
          appointment_id, service_id, service_price, duration_minutes, quantity
        ) VALUES (
          ${appointment.id}, ${service.service_id}, ${service.service_price},
          ${service.duration_minutes || 75}, ${service.quantity || 1}
        )
      `;
    }

    return Response.json({ appointment, booking_number }, { status: 201 });
  } catch (error) {
    console.error("Error creating third-party trip:", error);
    return Response.json(
      { error: "Failed to create third-party trip" },
      { status: 500 },
    );
  }
}
