import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import {
  getStartOfDayInCDT,
  getEndOfDayInCDT,
  getTodayInCDT,
} from "@/utils/timezone";

/**
 * GET /api/schedule-timeline
 * Fetch drivers and trips for the timeline view.
 * Also fetches previous-day trips (carryoverTrips) so the client can show
 * the after-midnight portion of late-night trips at the start of today's view.
 */
export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // e.g. "2025-01-15"

    // Fetch active drivers alphabetically, excluding any placeholder "Unassigned" employee
    const drivers = await sql`
      SELECT id, name, email, phone, color, salary_rate, is_active
      FROM employees
      WHERE is_active = true
        AND LOWER(name) != 'unassigned'
      ORDER BY name ASC
    `;

    // Fetch trips for the specified date using CDT day boundaries
    const currentDateStr = date || getTodayInCDT();
    const startISO = getStartOfDayInCDT(currentDateStr);
    const endISO = getEndOfDayInCDT(currentDateStr);

    // Fetch trips with their stored start_time, duration from services
    // IMPORTANT: Read stored values only - do not recalculate
    const trips = await sql`
      SELECT 
        a.id,
        a.employee_id,
        a.client_id,
        a.start_time,
        a.booking_number,
        a.status,
        a.notes,
        a.driver_notes,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.pickup_street,
        a.pickup_city,
        a.pickup_state,
        a.pickup_zip,
        a.dropoff_street,
        a.dropoff_city,
        a.dropoff_state,
        a.dropoff_zip,
        a.display_pickup_address,
        a.display_dropoff_address,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.num_car_seats,
        a.num_golf_bags,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.payment_status,
        a.payment_method,
        a.original_amount,
        a.vehicle_id,
        a.vehicle_category,
        a.is_tour,
        a.is_tentative,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        c.is_new_passenger,
        e.name as employee_name,
        e.color as employee_color,
        v.name as vehicle_name,
        COALESCE(
          (SELECT aps.duration_minutes 
           FROM appointment_services aps
           LEFT JOIN services s ON aps.service_id = s.id
           WHERE aps.appointment_id = a.id
             AND (s.is_addon = false OR s.id IS NULL)
           ORDER BY aps.id ASC
           LIMIT 1),
          75
        ) as duration_minutes
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.start_time >= ${startISO}
        AND a.start_time <= ${endISO}
        AND a.status NOT IN ('deleted', 'cancelled', 'canceled')
      ORDER BY a.start_time ASC
    `;

    // Compute previous day date string for carryover trips
    const [cy, cm, cd] = currentDateStr.split("-").map(Number);
    const prevDayUtc = new Date(Date.UTC(cy, cm - 1, cd - 1));
    const prevDayStr = prevDayUtc.toISOString().split("T")[0];
    const prevStartISO = getStartOfDayInCDT(prevDayStr);
    const prevEndISO = getEndOfDayInCDT(prevDayStr);

    // Fetch previous-day trips — filtered on the client to only include those
    // whose (CDT start_time minutes + duration_minutes) exceeds 1440 (midnight crossover)
    const carryoverTrips = await sql`
      SELECT 
        a.id,
        a.employee_id,
        a.client_id,
        a.start_time,
        a.booking_number,
        a.status,
        a.notes,
        a.driver_notes,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.pickup_street,
        a.pickup_city,
        a.pickup_state,
        a.pickup_zip,
        a.dropoff_street,
        a.dropoff_city,
        a.dropoff_state,
        a.dropoff_zip,
        a.display_pickup_address,
        a.display_dropoff_address,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.num_car_seats,
        a.num_golf_bags,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.payment_status,
        a.payment_method,
        a.original_amount,
        a.vehicle_id,
        a.vehicle_category,
        a.is_tour,
        a.is_tentative,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        c.is_new_passenger,
        e.name as employee_name,
        e.color as employee_color,
        v.name as vehicle_name,
        COALESCE(
          (SELECT aps.duration_minutes 
           FROM appointment_services aps
           LEFT JOIN services s ON aps.service_id = s.id
           WHERE aps.appointment_id = a.id
             AND (s.is_addon = false OR s.id IS NULL)
           ORDER BY aps.id ASC
           LIMIT 1),
          75
        ) as duration_minutes
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.start_time >= ${prevStartISO}
        AND a.start_time <= ${prevEndISO}
        AND a.status NOT IN ('deleted', 'cancelled', 'canceled')
      ORDER BY a.start_time ASC
    `;

    return Response.json({
      drivers,
      trips,
      carryoverTrips,
      date: currentDateStr,
    });
  } catch (error) {
    console.error("[schedule-timeline] Error:", error);
    return Response.json(
      { error: "Failed to fetch timeline data" },
      { status: 500 },
    );
  }
}
