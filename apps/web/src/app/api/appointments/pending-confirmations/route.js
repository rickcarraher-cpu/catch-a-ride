import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'driver' or 'passenger'
    const dateFilter = searchParams.get("date"); // 'today' or 'tomorrow'

    // Calculate date range based on filter
    let startTime, endTime;
    if (dateFilter === "tomorrow") {
      // Tomorrow: start of tomorrow to end of tomorrow (Central Time)
      startTime = `DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Chicago' + INTERVAL '1 day') AT TIME ZONE 'America/Chicago'`;
      endTime = `DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Chicago' + INTERVAL '2 days') AT TIME ZONE 'America/Chicago'`;
    } else {
      // Today (default): now to end of today (Central Time)
      startTime = `NOW()`;
      endTime = `DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Chicago' + INTERVAL '1 day') AT TIME ZONE 'America/Chicago'`;
    }

    if (type === "driver") {
      // Get trips where driver hasn't accepted
      const trips = await sql`
        SELECT 
          a.*,
          c.name AS client_name,
          c.phone AS client_phone,
          e.name AS employee_name,
          e.phone AS employee_phone,
          v.name AS vehicle_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN vehicles v ON a.vehicle_id = v.id
        WHERE a.tenant_id = 1
          AND a.employee_id IS NOT NULL
          AND (a.driver_accepted IS NULL OR a.driver_accepted IN ('pending', 'declined'))
          AND a.start_time >= ${sql.unsafe(startTime)}
          AND a.start_time < ${sql.unsafe(endTime)}
        ORDER BY a.start_time ASC
      `;
      return Response.json(trips);
    } else if (type === "passenger") {
      // Get trips where passenger hasn't confirmed
      const trips = await sql`
        SELECT 
          a.*,
          c.name AS client_name,
          c.phone AS client_phone,
          e.name AS employee_name,
          e.phone AS employee_phone,
          v.name AS vehicle_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN vehicles v ON a.vehicle_id = v.id
        WHERE a.tenant_id = 1
          AND a.client_id IS NOT NULL
          AND (a.passenger_confirmed IS NULL OR a.passenger_confirmed IN ('pending', 'cancelled'))
          AND a.start_time >= ${sql.unsafe(startTime)}
          AND a.start_time < ${sql.unsafe(endTime)}
        ORDER BY a.start_time ASC
      `;
      return Response.json(trips);
    } else {
      return Response.json(
        { error: "Invalid type parameter" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error fetching pending confirmations:", error);
    return Response.json(
      { error: "Failed to fetch pending confirmations" },
      { status: 500 },
    );
  }
}
