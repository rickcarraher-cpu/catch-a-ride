import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const result = await sql`
      SELECT r.*, c.name as client_name, e.name as employee_name
      FROM recurring_appointments r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.id = ${id} AND r.tenant_id = 1
        AND (r.is_deleted = false OR r.is_deleted IS NULL)
    `;

    if (result.length === 0) {
      return Response.json(
        { error: "Recurring series not found" },
        { status: 404 },
      );
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch recurring series" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const {
      client_id,
      employee_id,
      start_time,
      frequency,
      notes,
      vehicle_id,
      destination,
      num_people,
      num_bags_checked,
      num_bags_carry_on,
      outgoing_flight_info,
      returning_flight_info,
      return_date,
      driver_notes,
      is_tentative,
      tentative_reason,
      payment_method,
      requested_driver_name,
      services_data,
      num_occurrences,
      day_of_week,
    } = await request.json();

    const result = await sql`
      UPDATE recurring_appointments
      SET 
        client_id = ${client_id},
        employee_id = ${employee_id || null},
        start_time = ${start_time},
        frequency = ${frequency},
        notes = ${notes || null},
        vehicle_id = ${vehicle_id || null},
        destination = ${destination || null},
        num_people = ${num_people || null},
        num_bags_checked = ${num_bags_checked || null},
        num_bags_carry_on = ${num_bags_carry_on || null},
        outgoing_flight_info = ${outgoing_flight_info || null},
        returning_flight_info = ${returning_flight_info || null},
        return_date = ${return_date || null},
        driver_notes = ${driver_notes || null},
        is_tentative = ${is_tentative || false},
        tentative_reason = ${tentative_reason || null},
        payment_method = ${payment_method || null},
        requested_driver_name = ${requested_driver_name || null},
        services_data = ${JSON.stringify(services_data || [])}::jsonb,
        num_occurrences = ${num_occurrences || 0},
        day_of_week = ${day_of_week != null ? day_of_week : null}
      WHERE id = ${id} AND tenant_id = 1
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json(
        { error: "Recurring series not found" },
        { status: 404 },
      );
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update recurring series" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await sql`
      UPDATE recurring_appointments
      SET is_deleted = true
      WHERE id = ${id} AND tenant_id = 1
    `;
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to delete recurring series" },
      { status: 500 },
    );
  }
}
