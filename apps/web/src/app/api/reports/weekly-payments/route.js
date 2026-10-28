import sql from "@/app/api/utils/sql";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

function getSunday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekRange(weekType) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }),
  );

  if (weekType === "last_week") {
    const lastSunday = getSunday(now);
    lastSunday.setDate(lastSunday.getDate() - 7);
    const lastSaturday = new Date(lastSunday);
    lastSaturday.setDate(lastSaturday.getDate() + 6);
    return {
      start: lastSunday.toISOString().split("T")[0],
      end: lastSaturday.toISOString().split("T")[0],
      label: "Last Week",
    };
  } else {
    const thisSunday = getSunday(now);
    return {
      start: thisSunday.toISOString().split("T")[0],
      end: now.toISOString().split("T")[0],
      label: "This Week",
    };
  }
}

export async function GET(request) {
  try {
    const tenantId = await resolveTenantFromSession(request);
    const { searchParams } = new URL(request.url);
    const weekType = searchParams.get("week") || "this_week";

    const { start, end, label } = getWeekRange(weekType);

    const trips = await sql`
      SELECT
        a.id,
        a.booking_number,
        a.start_time,
        a.status,
        a.payment_status,
        a.payment_method,
        a.payment_date,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.pickup_street,
        a.pickup_city,
        a.dropoff_street,
        a.dropoff_city,
        a.notes,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.balance_due,
        a.original_amount,
        a.services_total,
        a.payments_total,
        a.tips_total,
        a.created_at,
        c.name AS client_name,
        c.phone AS client_phone,
        e.name AS employee_name,
        e.color AS employee_color,
        e.id AS employee_id
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.tenant_id = ${tenantId}
        AND a.payment_date IS NOT NULL
        AND a.payment_date::date >= ${start}::date
        AND a.payment_date::date <= ${end}::date
        AND a.status != 'deleted'
      ORDER BY
        CASE
          WHEN a.payment_method = 'Square' THEN 1
          WHEN a.payment_method = 'Credit Card' THEN 2
          WHEN a.payment_method = 'Cash' THEN 3
          WHEN a.payment_method = 'Check' THEN 4
          WHEN a.payment_method = 'Venmo' THEN 5
          WHEN a.payment_method = 'Zelle' THEN 6
          WHEN a.payment_method = 'Invoice' THEN 7
          ELSE 8
        END,
        a.payment_date ASC
    `;

    // Group by payment method
    const groupedTrips = {};
    trips.forEach((trip) => {
      const method = trip.payment_method || "Not Specified";
      if (!groupedTrips[method]) groupedTrips[method] = [];
      groupedTrips[method].push(trip);
    });

    // Totals per method
    const totals = {};
    Object.keys(groupedTrips).forEach((method) => {
      const mt = groupedTrips[method];
      totals[method] = {
        count: mt.length,
        payments_total: mt.reduce(
          (s, t) => s + Number(t.payments_total || 0),
          0,
        ),
        tips_total: mt.reduce((s, t) => s + Number(t.tips_total || 0), 0),
      };
    });

    const grandTotal = {
      count: trips.length,
      payments_total: trips.reduce(
        (s, t) => s + Number(t.payments_total || 0),
        0,
      ),
      tips_total: trips.reduce((s, t) => s + Number(t.tips_total || 0), 0),
    };

    return Response.json({
      success: true,
      groupedTrips,
      totals,
      grandTotal,
      dateRange: { start, end, label },
      weekType,
    });
  } catch (error) {
    console.error("Error fetching weekly payments report:", error);
    return Response.json(
      { error: "Failed to fetch weekly payments report" },
      { status: 500 },
    );
  }
}
