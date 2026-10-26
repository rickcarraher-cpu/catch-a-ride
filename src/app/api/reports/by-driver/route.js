import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return Response.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    // Fetch all trips in the date range (CDT), including cancelled
    const trips = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.status,
        a.payment_status,
        a.payment_amount,
        a.original_amount,
        a.services_total,
        a.tips_total,
        a.balance_due,
        a.payments_total,
        a.payment_method,
        a.display_payment_method,
        a.pickup_street,
        a.pickup_address,
        a.dropoff_street,
        a.dropoff_address,
        a.destination,
        a.display_short_date,
        a.display_time,
        a.employee_id,
        a.client_id,
        e.name as driver_name,
        e.color as driver_color,
        e.is_active as driver_is_active,
        c.name as client_name
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE DATE(a.start_time AT TIME ZONE 'America/Chicago') >= ${startDate}::date
        AND DATE(a.start_time AT TIME ZONE 'America/Chicago') <= ${endDate}::date
      ORDER BY a.start_time ASC
    `;

    if (trips.length === 0) {
      return Response.json({
        drivers: [],
        weekTotalFare: 0,
        weekTotalTip: 0,
        weekTotalAddons: 0,
      });
    }

    // Fetch per-trip add-on totals — ALL add-ons (is_addon = true)
    const tripIds = trips.map((t) => t.id);
    const addonRows = await sql`
      SELECT
        aps.appointment_id,
        SUM(aps.service_price * COALESCE(aps.quantity, 1)) AS addons_total
      FROM appointment_services aps
      JOIN services s ON s.id = aps.service_id
      WHERE s.is_addon = true
        AND aps.appointment_id = ANY(${tripIds})
      GROUP BY aps.appointment_id
    `;
    const addonsByTrip = {};
    addonRows.forEach((r) => {
      addonsByTrip[r.appointment_id] = parseFloat(r.addons_total || 0);
    });

    // Also fetch regular add-ons (is_addon=true AND is_tip_addon=false).
    // These ARE included in services_total (commission base), so we need to
    // subtract them from fare in the display to avoid double-counting.
    const regularAddonRows = await sql`
      SELECT
        aps.appointment_id,
        SUM(aps.service_price * COALESCE(aps.quantity, 1)) AS regular_addons_total
      FROM appointment_services aps
      JOIN services s ON s.id = aps.service_id
      WHERE s.is_addon = true AND s.is_tip_addon = false
        AND aps.appointment_id = ANY(${tripIds})
      GROUP BY aps.appointment_id
    `;
    const regularAddonsByTrip = {};
    regularAddonRows.forEach((r) => {
      regularAddonsByTrip[r.appointment_id] = parseFloat(
        r.regular_addons_total || 0,
      );
    });

    // Fare and tip totals are read directly from the cached appointments fields below.

    // Also get all active drivers to show sections for everyone with trips
    const employees = await sql`
      SELECT id, name, color, is_active
      FROM employees
      WHERE is_active = true
      ORDER BY name ASC
    `;

    // Group trips by driver
    const driverMap = {};
    let grandTotalFare = 0;
    let grandTotalTip = 0;
    let grandTotalAddons = 0;

    trips.forEach((trip) => {
      const driverId = trip.employee_id || "unassigned";
      const driverName = trip.driver_name || "Unassigned";
      const driverColor = trip.driver_color || "#FCD34D";

      if (!driverMap[driverId]) {
        driverMap[driverId] = {
          id: driverId,
          name: driverName,
          color: driverColor,
          trips: [],
          totalFare: 0,
          totalTip: 0,
          totalAddons: 0,
        };
      }

      // Use cached fields instead of re-aggregating from transactions
      // services_total includes regular add-ons (is_addon=true, is_tip_addon=false)
      // but excludes gas/tip-addon services. To show a clean base fare we subtract
      // the regular add-ons; those are captured in the addons column instead.
      const regularAddons = regularAddonsByTrip[trip.id] || 0;
      const fare = Math.max(
        0,
        parseFloat(trip.services_total || 0) - regularAddons,
      );
      const tip = parseFloat(trip.tips_total || 0);
      const addons = addonsByTrip[trip.id] || 0;

      driverMap[driverId].trips.push({
        id: trip.id,
        booking_number: trip.booking_number,
        start_time: trip.start_time,
        status: trip.status,
        payment_status: trip.payment_status || "unpaid",
        payment_method: trip.payment_method,
        display_payment_method: trip.display_payment_method,
        balance_due: trip.balance_due,
        payments_total: trip.payments_total,
        services_total: trip.services_total,
        client_name: trip.client_name,
        pickup_street: trip.pickup_street,
        pickup_address: trip.pickup_address,
        dropoff_street: trip.dropoff_street,
        dropoff_address: trip.dropoff_address,
        destination: trip.destination,
        display_short_date: trip.display_short_date,
        display_time: trip.display_time,
        fare,
        tip,
        addons,
        regularAddons,
      });

      driverMap[driverId].totalFare += fare;
      driverMap[driverId].totalTip += tip;
      driverMap[driverId].totalAddons += addons;
      grandTotalFare += fare;
      grandTotalTip += tip;
      grandTotalAddons += addons;
    });

    // Convert to sorted array
    const drivers = Object.values(driverMap).sort((a, b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.name.localeCompare(b.name);
    });

    return Response.json({
      drivers,
      weekTotalFare: parseFloat(grandTotalFare.toFixed(2)),
      weekTotalTip: parseFloat(grandTotalTip.toFixed(2)),
      weekTotalAddons: parseFloat(grandTotalAddons.toFixed(2)),
    });
  } catch (error) {
    console.error("Error in by-driver report:", error);
    return Response.json(
      { error: "Failed to fetch by-driver report" },
      { status: 500 },
    );
  }
}
