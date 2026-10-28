import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the authenticated employee
    const employees = await sql`
      SELECT id, name, email, is_active
      FROM employees
      WHERE LOWER(email) = LOWER(${session.user.email})
        AND tenant_id = 1
        AND is_active = true
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const employee = employees[0];

    // Get all pending trips for this driver
    const trips = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.driver_accepted,
        a.driver_response_at,
        a.status,
        a.pickup_address,
        a.dropoff_address,
        a.destination,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.num_car_seats,
        a.num_golf_bags,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.notes,
        a.driver_notes,
        a.original_amount,
        a.balance_due,
        a.payments_total,
        a.payment_method,
        a.display_long_date,
        a.display_time,
        a.display_pickup_address,
        a.display_dropoff_address,
        c.name AS passenger_name,
        c.phone AS passenger_phone,
        c.email AS passenger_email,
        v.name AS vehicle_name,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'service_name', s.name,
                'service_price', aps.service_price,
                'quantity', aps.quantity,
                'duration_minutes', aps.duration_minutes,
                'is_addon', s.is_addon
              )
            )
            FROM appointment_services aps
            LEFT JOIN services s ON aps.service_id = s.id
            WHERE aps.appointment_id = a.id
          ),
          '[]'::json
        ) AS services
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.employee_id = ${employee.id}
        AND a.tenant_id = 1
        AND (a.driver_accepted IS NULL OR a.driver_accepted = 'pending')
        AND a.status NOT IN ('cancelled', 'canceled', 'deleted')
        AND a.start_time >= NOW()
      ORDER BY a.start_time ASC
    `;

    return Response.json({ trips });
  } catch (error) {
    console.error("Error fetching pending trips:", error);
    return Response.json(
      { error: "Failed to fetch pending trips" },
      { status: 500 },
    );
  }
}
