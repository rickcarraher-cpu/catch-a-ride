import sql from "@/app/api/utils/sql";

// GET /api/vehicle-assignments?employee_id=X  or  ?vehicle_id=X
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employee_id = searchParams.get("employee_id");
    const vehicle_id = searchParams.get("vehicle_id");

    let query = `
      SELECT va.id as assignment_id, va.vehicle_id, va.employee_id,
             va.profile_image_url, va.profile_description,
             v.name, v.year, v.color, v.plate, v.category, v.passenger_capacity,
             e.name as employee_name
      FROM vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      JOIN employees e ON va.employee_id = e.id
      WHERE v.is_active = true
    `;
    const params = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` AND va.employee_id = $${params.length}`;
    }
    if (vehicle_id) {
      params.push(vehicle_id);
      query += ` AND va.vehicle_id = $${params.length}`;
    }

    query += ` ORDER BY v.name`;

    const assignments = await sql(query, params);
    return Response.json(assignments);
  } catch (error) {
    console.error("Failed to fetch vehicle assignments:", error);
    return Response.json(
      { error: "Failed to fetch vehicle assignments" },
      { status: 500 },
    );
  }
}

// POST /api/vehicle-assignments — assign a vehicle to a driver
export async function POST(request) {
  try {
    const { vehicle_id, employee_id } = await request.json();

    if (!vehicle_id || !employee_id) {
      return Response.json(
        { error: "vehicle_id and employee_id are required" },
        { status: 400 },
      );
    }

    // Check if assignment already exists
    const existing = await sql`
      SELECT id FROM vehicle_assignments WHERE vehicle_id = ${vehicle_id} AND employee_id = ${employee_id}
    `;
    if (existing.length > 0) {
      return Response.json(
        { error: "This vehicle is already assigned to this driver" },
        { status: 409 },
      );
    }

    const [assignment] = await sql`
      INSERT INTO vehicle_assignments (vehicle_id, employee_id)
      VALUES (${vehicle_id}, ${employee_id})
      RETURNING *
    `;

    return Response.json(assignment);
  } catch (error) {
    console.error("Failed to create vehicle assignment:", error);
    return Response.json(
      { error: "Failed to assign vehicle" },
      { status: 500 },
    );
  }
}

// DELETE /api/vehicle-assignments?vehicle_id=X&employee_id=Y — unassign a vehicle from a driver
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vehicle_id = searchParams.get("vehicle_id");
    const employee_id = searchParams.get("employee_id");

    if (!vehicle_id || !employee_id) {
      return Response.json(
        { error: "vehicle_id and employee_id are required" },
        { status: 400 },
      );
    }

    await sql`
      DELETE FROM vehicle_assignments WHERE vehicle_id = ${vehicle_id} AND employee_id = ${employee_id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to remove vehicle assignment:", error);
    return Response.json(
      { error: "Failed to remove vehicle assignment" },
      { status: 500 },
    );
  }
}
