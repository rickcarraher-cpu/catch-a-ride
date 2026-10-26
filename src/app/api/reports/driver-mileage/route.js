import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const driverId = searchParams.get("driverId");

    if (!startDate || !endDate) {
      return Response.json(
        { error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    // Build query with optional driver filter - ALL COMPLETED TRIPS (not just paid)
    let tripQuery;
    if (driverId && driverId !== "all") {
      tripQuery = sql`
        SELECT 
          a.id,
          a.booking_number,
          a.start_time,
          a.pickup_address,
          a.dropoff_address,
          a.distance_miles,
          a.pickup_street,
          a.pickup_city,
          a.pickup_state,
          a.dropoff_street,
          a.dropoff_city,
          a.dropoff_state,
          a.payment_amount,
          a.original_amount,
          a.payment_status,
          a.payment_method,
          a.balance_due,
          a.payments_total,
          a.driver_paid,
          a.driver_paid_at,
          a.driver_paid_by,
          a.services_total,
          a.driver_commission,
          a.tips_total,
          e.id as employee_id,
          e.name as driver_name,
          e.salary_rate,
          c.name as client_name,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM driver_mileage_approvals dma
              WHERE dma.employee_id = a.employee_id
                AND dma.start_date = ${startDate}::date
                AND dma.end_date = ${endDate}::date
                AND dma.approval_status = 'approved'
                AND dma.approved_trip_ids @> to_jsonb(a.id)
            ) THEN true
            ELSE false
          END as is_approved
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE DATE(a.start_time AT TIME ZONE 'America/Chicago') >= ${startDate}::date
          AND DATE(a.start_time AT TIME ZONE 'America/Chicago') <= ${endDate}::date
          AND a.status NOT IN ('cancelled', 'canceled', 'deleted')
          AND a.employee_id = ${parseInt(driverId)}
        ORDER BY e.name, a.start_time
      `;
    } else {
      tripQuery = sql`
        SELECT 
          a.id,
          a.booking_number,
          a.start_time,
          a.pickup_address,
          a.dropoff_address,
          a.distance_miles,
          a.pickup_street,
          a.pickup_city,
          a.pickup_state,
          a.dropoff_street,
          a.dropoff_city,
          a.dropoff_state,
          a.payment_amount,
          a.original_amount,
          a.payment_status,
          a.payment_method,
          a.balance_due,
          a.payments_total,
          a.driver_paid,
          a.driver_paid_at,
          a.driver_paid_by,
          a.services_total,
          a.driver_commission,
          a.tips_total,
          e.id as employee_id,
          e.name as driver_name,
          e.salary_rate,
          c.name as client_name,
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM driver_mileage_approvals dma
              WHERE dma.employee_id = a.employee_id
                AND dma.start_date = ${startDate}::date
                AND dma.end_date = ${endDate}::date
                AND dma.approval_status = 'approved'
                AND dma.approved_trip_ids @> to_jsonb(a.id)
            ) THEN true
            ELSE false
          END as is_approved
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE DATE(a.start_time AT TIME ZONE 'America/Chicago') >= ${startDate}::date
          AND DATE(a.start_time AT TIME ZONE 'America/Chicago') <= ${endDate}::date
          AND a.status NOT IN ('cancelled', 'canceled', 'deleted')
        ORDER BY e.name, a.start_time
      `;
    }

    const trips = await tripQuery;

    // Get transaction IDs for the fetched trips only
    const tripIds = trips.map((t) => t.id);

    // NO LONGER NEEDED - services_total is now stored on appointments
    // Fetch appointment_services for all trips to calculate base revenue (without CC fees)
    // let servicesQuery;
    // if (tripIds.length === 0) {
    //   servicesQuery = Promise.resolve([]);
    // } else {
    //   servicesQuery = sql`
    //     SELECT
    //       appointment_id,
    //       SUM(service_price * COALESCE(quantity, 1)) as services_total
    //     FROM appointment_services
    //     WHERE appointment_id = ANY(${tripIds})
    //     GROUP BY appointment_id
    //   `;
    // }

    // const services = await servicesQuery;
    // const servicesByTrip = services.reduce((acc, s) => {
    //   acc[s.appointment_id] = parseFloat(s.services_total) || 0;
    //   return acc;
    // }, {});

    // Get transactions (tips, expenses) ONLY for the trips we fetched
    let transactionsQuery;
    if (tripIds.length === 0) {
      // No trips, no transactions to fetch
      transactionsQuery = Promise.resolve([]);
    } else if (driverId && driverId !== "all") {
      transactionsQuery = sql`
        SELECT 
          t.employee_id,
          t.category,
          t.amount,
          t.tip_amount,
          t.description,
          t.transaction_date,
          t.appointment_id
        FROM transactions t
        WHERE (
          t.appointment_id = ANY(${tripIds})
        )
        OR (
          t.employee_id = ${parseInt(driverId)}
          AND t.appointment_id IS NULL
          AND t.transaction_date >= ${startDate}::date
          AND t.transaction_date <= ${endDate}::date
        )
      `;
    } else {
      transactionsQuery = sql`
        SELECT 
          t.employee_id,
          t.category,
          t.amount,
          t.tip_amount,
          t.description,
          t.transaction_date,
          t.appointment_id
        FROM transactions t
        WHERE t.appointment_id = ANY(${tripIds})
           OR (t.appointment_id IS NULL AND t.transaction_date >= ${startDate}::date AND t.transaction_date <= ${endDate}::date)
      `;
    }

    const transactions = await transactionsQuery;

    // Build per-trip tip map
    const tipsByTrip = {};
    transactions.forEach((txn) => {
      if (
        (txn.category === "tip" || parseFloat(txn.tip_amount) > 0) &&
        txn.appointment_id
      ) {
        const tipAmt =
          parseFloat(txn.tip_amount) || parseFloat(txn.amount) || 0;
        tipsByTrip[txn.appointment_id] =
          (tipsByTrip[txn.appointment_id] || 0) + tipAmt;
      }
    });

    // Group trips by driver and calculate summaries
    const driverMap = {};
    let totalTrips = 0;
    let totalMileage = 0;
    let totalRevenue = 0;
    let totalCompensation = 0;
    let totalTips = 0;

    trips.forEach((trip) => {
      const driverId = trip.employee_id || "unassigned";
      const driverName = trip.driver_name || "Unassigned";
      // Use distance_miles directly from the stored trip record
      const miles = parseFloat(trip.distance_miles) || 0;

      // Use CACHED services_total (base amount WITHOUT credit card fees) for driver revenue/commission
      // Driver commission is calculated on services_total, NOT including CC fees
      const revenue =
        parseFloat(trip.services_total) ||
        parseFloat(trip.original_amount) ||
        0;

      const salaryRate = parseFloat(trip.salary_rate) || 0.75;
      const isPaid = trip.payment_status === "paid";
      const isApproved = trip.is_approved;
      const isDriverPaid = trip.driver_paid === true;

      // Use STORED driver_commission — the trip record is the source of truth.
      // Do NOT fall back to revenue * salaryRate; if the stored value is 0, it is 0.
      const commission = parseFloat(trip.driver_commission) || 0;
      const compensation =
        isPaid || isApproved || isDriverPaid ? commission : 0;

      if (!driverMap[driverId]) {
        driverMap[driverId] = {
          id: driverId,
          name: driverName,
          salaryRate: salaryRate,
          trips: [],
          totalTrips: 0,
          totalMiles: 0,
          totalRevenue: 0,
          totalCompensation: 0,
          totalTips: 0,
          expenses: [],
          standalone_tips: [], // Add array to track standalone tips
        };
      }

      driverMap[driverId].trips.push({
        id: trip.id,
        bookingNumber: trip.booking_number,
        date: trip.start_time,
        clientName: trip.client_name,
        pickup:
          trip.pickup_address ||
          `${trip.pickup_street || ""}, ${trip.pickup_city || ""}, ${trip.pickup_state || ""}`
            .trim()
            .replace(/^,\s*|,\s*$/g, ""),
        dropoff:
          trip.dropoff_address ||
          `${trip.dropoff_street || ""}, ${trip.dropoff_city || ""}, ${trip.dropoff_state || ""}`
            .trim()
            .replace(/^,\s*|,\s*$/g, ""),
        miles: miles,
        revenue: revenue,
        tips: parseFloat(trip.tips_total) || tipsByTrip[trip.id] || 0,
        compensation: compensation,
        paymentStatus: trip.payment_status,
        isApproved: isApproved,
        driverPaid: isDriverPaid,
        driverPaidAt: trip.driver_paid_at,
        driverPaidBy: trip.driver_paid_by,
      });

      driverMap[driverId].totalTrips += 1;
      driverMap[driverId].totalMiles += miles;
      driverMap[driverId].totalRevenue += revenue;
      driverMap[driverId].totalCompensation += compensation;

      // Count tips toward totals only when the trip qualifies (same as compensation)
      const tripTips = parseFloat(trip.tips_total) || tipsByTrip[trip.id] || 0;
      if (tripTips > 0) {
        driverMap[driverId].totalTips += tripTips;
        driverMap[driverId].totalCompensation += tripTips;
        totalCompensation += tripTips;
        totalTips += tripTips;
      }

      totalTrips += 1;
      totalMileage += miles;
      totalRevenue += revenue;
      totalCompensation += compensation;
    });

    // Add transactions (standalone tips and expenses) to drivers
    // NOTE: trip-linked tips are already counted above via tipsByTrip — only process standalone ones here
    transactions.forEach((txn) => {
      const empId = txn.employee_id;
      if (empId && driverMap[empId]) {
        if (
          (txn.category === "tip" || parseFloat(txn.tip_amount) > 0) &&
          !txn.appointment_id
        ) {
          // Only standalone tips (not linked to an appointment) to avoid double-counting
          const tipAmount =
            parseFloat(txn.tip_amount) || parseFloat(txn.amount) || 0;
          // Standalone tip - add to standalone_tips array for display
          driverMap[empId].standalone_tips.push({
            date: txn.transaction_date,
            amount: tipAmount,
            description: txn.description || "Tip (not linked to specific trip)",
          });
          driverMap[empId].totalTips += tipAmount;
          driverMap[empId].totalCompensation += tipAmount;
          totalCompensation += tipAmount;
          totalTips += tipAmount;
        } else if (txn.category === "expense") {
          // Track expenses for display but DO NOT subtract from compensation
          driverMap[empId].expenses.push({
            date: txn.transaction_date,
            description: txn.description,
            amount: parseFloat(txn.amount) || 0,
          });
        } else if (txn.category === "commission_reversal") {
          // Track commission reversals for display but DO NOT subtract from compensation
          const reversalAmount = parseFloat(txn.amount) || 0;
          driverMap[empId].expenses.push({
            date: txn.transaction_date,
            description: txn.description || "Commission reversal (refund)",
            amount: reversalAmount,
          });
        }
      }
    });

    // Convert map to array and sort by driver name
    const drivers = Object.values(driverMap).sort((a, b) => {
      if (a.id === "unassigned") return 1;
      if (b.id === "unassigned") return -1;
      return a.name.localeCompare(b.name);
    });

    return Response.json({
      drivers,
      summary: {
        totalDrivers: drivers.length,
        totalTrips,
        totalMileage: parseFloat(totalMileage.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCompensation: parseFloat(totalCompensation.toFixed(2)),
        totalTips: parseFloat(totalTips.toFixed(2)), // Add this line to include total tips in summary
      },
      dateRange: {
        start: startDate,
        end: endDate,
      },
    });
  } catch (error) {
    console.error("Error fetching driver mileage report:", error);
    return Response.json(
      { error: "Failed to fetch driver mileage report" },
      { status: 500 },
    );
  }
}
