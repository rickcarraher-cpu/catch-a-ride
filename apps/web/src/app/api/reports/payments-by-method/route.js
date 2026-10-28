import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start"); // ISO date string e.g. "2026-09-14"
    const end = searchParams.get("end"); // ISO date string e.g. "2026-09-20"

    if (!start || !end) {
      return Response.json(
        { error: "start and end date params required" },
        { status: 400 },
      );
    }

    // Fetch appointments paid in the date range
    // payment_date is stored as timestamp with time zone
    const trips = await sql(
      `SELECT
        a.id,
        a.booking_number,
        a.start_time,
        a.payment_status,
        a.payment_date,
        a.payment_method,
        a.original_amount,
        a.payments_total,
        a.tips_total,
        a.balance_due,
        a.services_total,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.pickup_street,
        a.pickup_city,
        a.pickup_state,
        a.dropoff_street,
        a.dropoff_city,
        a.dropoff_state,
        a.notes,
        a.status,
        a.employee_id,
        a.vehicle_id,
        a.client_id,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.driver_notes,
        a.is_tentative,
        a.requested_driver_name,
        a.booker_name,
        a.booked_by,
        a.driver_accepted,
        a.passenger_confirmed,
        a.display_long_date,
        c.name AS client_name,
        c.phone AS client_phone,
        e.name AS employee_name,
        e.color AS employee_color
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.payment_date >= $1::date
        AND a.payment_date < ($2::date + INTERVAL '1 day')
        AND a.payment_date IS NOT NULL
      ORDER BY
        COALESCE(a.payment_method, 'Unspecified'),
        a.payment_date ASC`,
      [start, end],
    );

    // Build summary totals by method
    const methodTotals = {};
    for (const trip of trips) {
      const method = trip.payment_method || "Unspecified";
      if (!methodTotals[method]) {
        methodTotals[method] = { count: 0, total: 0, tips: 0 };
      }
      methodTotals[method].count += 1;
      methodTotals[method].total += Number(trip.payments_total || 0);
      methodTotals[method].tips += Number(trip.tips_total || 0);
    }

    return Response.json({
      success: true,
      trips,
      methodTotals,
      total: trips.length,
      start,
      end,
    });
  } catch (error) {
    console.error("Error fetching payments-by-method report:", error);
    return Response.json({ error: "Failed to fetch report" }, { status: 500 });
  }
}
