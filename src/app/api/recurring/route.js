import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const recurring = await sql`
      SELECT r.*, 
             c.name as client_name, 
             e.name as employee_name,
             v.name as vehicle_name
      FROM recurring_appointments r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN employees e ON r.employee_id = e.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.tenant_id = 1
        AND (r.is_deleted = false OR r.is_deleted IS NULL)
      ORDER BY r.created_at DESC
    `;
    return Response.json(recurring);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch recurring trips" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      client_id,
      employee_id,
      start_time,
      frequency,
      notes,
      vehicle_id,
      vehicle_category,
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
      template_appointment_id,
      services_data,
      num_occurrences,
      day_of_week,
    } = await request.json();

    const result = await sql`
      INSERT INTO recurring_appointments (
        tenant_id, client_id, employee_id, start_time, frequency, notes,
        vehicle_id, vehicle_category, destination, num_people, num_bags_checked, num_bags_carry_on,
        outgoing_flight_info, returning_flight_info, return_date, driver_notes,
        is_tentative, tentative_reason, payment_method, requested_driver_name,
        template_appointment_id, services_data, num_occurrences, day_of_week
      )
      VALUES (
        1, ${client_id}, ${employee_id || null}, ${start_time}, ${frequency}, ${notes || null},
        ${vehicle_id || null}, ${vehicle_category || null}, ${destination || null}, ${num_people || null}, 
        ${num_bags_checked || null}, ${num_bags_carry_on || null},
        ${outgoing_flight_info || null}, ${returning_flight_info || null}, 
        ${return_date || null}, ${driver_notes || null},
        ${is_tentative || false}, ${tentative_reason || null}, 
        ${payment_method || null}, ${requested_driver_name || null},
        ${template_appointment_id || null}, ${JSON.stringify(services_data || [])}::jsonb,
        ${num_occurrences || 0}, ${day_of_week != null ? day_of_week : null}
      )
      RETURNING *
    `;
    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create recurring trip" },
      { status: 500 },
    );
  }
}
