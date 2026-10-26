import sql from "@/app/api/utils/sql";
import {
  getDateStringInCDT,
  createDateInCDT,
  getDatePartsInCDT,
} from "@/utils/timezone";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    // Calculate tomorrow's date (or use provided date) in CDT timezone
    let targetDateStr;
    if (dateParam) {
      // Use the provided date string directly (YYYY-MM-DD in CDT)
      targetDateStr = dateParam;
    } else {
      // Get tomorrow's date in CDT
      const now = new Date();
      const nowParts = getDatePartsInCDT(now);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowParts = getDatePartsInCDT(tomorrow);
      targetDateStr = `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`;
    }

    // Parse the date parts from the target date string
    const [year, month, day] = targetDateStr.split("-").map(Number);

    // Create start of day (midnight CDT)
    const startOfDay = createDateInCDT(year, month, day, 0, 0);

    // Calculate end of day by creating a proper Date object and adding one day
    // This properly handles month boundaries (e.g., July 31 -> August 1)
    const nextDayDate = new Date(startOfDay);
    nextDayDate.setDate(nextDayDate.getDate() + 1);
    const nextDayParts = getDatePartsInCDT(nextDayDate);
    const endOfDay = createDateInCDT(
      parseInt(nextDayParts.year),
      parseInt(nextDayParts.month),
      parseInt(nextDayParts.day),
      0,
      0,
    );

    console.log("Schedule Builder - Target Date:", targetDateStr);
    console.log("Schedule Builder - Start of Day:", startOfDay.toISOString());
    console.log("Schedule Builder - End of Day:", endOfDay.toISOString());

    // Get all trips from midnight to midnight of the target date
    const allTrips = await sql`
      SELECT 
        a.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        e.name as employee_name,
        e.color as employee_color,
        v.name as vehicle_name,
        (
          SELECT json_agg(
            json_build_object(
              'service_id', s.id,
              'service_name', serv.name,
              'service_price', s.service_price,
              'duration_minutes', s.duration_minutes,
              'quantity', s.quantity,
              'is_addon', serv.is_addon
            )
          )
          FROM appointment_services s
          LEFT JOIN services serv ON s.service_id = serv.id
          WHERE s.appointment_id = a.id
        ) as services
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.start_time >= ${startOfDay.toISOString()}
        AND a.start_time < ${endOfDay.toISOString()}
        AND a.status NOT IN ('cancelled', 'canceled', 'deleted')
      ORDER BY a.start_time ASC
    `;

    console.log("Schedule Builder - Found trips:", allTrips.length);

    // Get all active drivers, excluding any placeholder "Unassigned" employee record
    const drivers = await sql`
      SELECT 
        id,
        name,
        color,
        email,
        phone
      FROM employees
      WHERE is_active = true
        AND LOWER(name) != 'unassigned'
      ORDER BY rotation_order ASC, name ASC
    `;

    // Get blocked times for the target date
    const blockedTimes = await sql`
      SELECT 
        bt.*,
        e.name as employee_name,
        e.color as employee_color
      FROM blocked_times bt
      LEFT JOIN employees e ON bt.employee_id = e.id
      WHERE bt.start_time < ${endOfDay.toISOString()}
        AND bt.end_time > ${startOfDay.toISOString()}
        AND (bt.is_deleted = false OR bt.is_deleted IS NULL)
    `;

    // Get vehicle assignments for all active drivers
    const vehicleAssignments = await sql`
      SELECT va.vehicle_id, va.employee_id,
             v.name as vehicle_name, v.year, v.color, v.plate, v.category, v.passenger_capacity
      FROM vehicle_assignments va
      JOIN vehicles v ON va.vehicle_id = v.id
      WHERE v.is_active = true
      ORDER BY v.name
    `;

    // Group vehicles by driver
    const vehiclesByDriver = {};
    for (const va of vehicleAssignments) {
      if (!vehiclesByDriver[va.employee_id]) {
        vehiclesByDriver[va.employee_id] = [];
      }
      vehiclesByDriver[va.employee_id].push({
        id: va.vehicle_id,
        name: va.vehicle_name,
        year: va.year,
        color: va.color,
        plate: va.plate,
        category: va.category,
        passenger_capacity: va.passenger_capacity,
      });
    }

    return Response.json({
      targetDate: startOfDay.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      trips: allTrips,
      drivers,
      blockedTimes,
      vehiclesByDriver,
    });
  } catch (error) {
    console.error("Error fetching tomorrow schedule data:", error);
    return Response.json(
      { error: "Failed to fetch schedule data" },
      { status: 500 },
    );
  }
}
