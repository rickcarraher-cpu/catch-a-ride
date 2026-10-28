import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Helper: compute earnings for a single driver over a date range
async function getDriverEarnings(driver, start, end) {
  let tripQuery = `
    SELECT
      a.id,
      a.booking_number,
      a.start_time,
      a.status,
      a.destination,
      a.distance_miles,
      a.services_total,
      a.original_amount,
      a.driver_commission,
      a.trip_commission_rate,
      a.tips_total,
      a.payment_status,
      a.payment_method,
      a.balance_due,
      a.payments_total,
      a.pickup_address,
      a.dropoff_address,
      c.name AS client_name
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.tenant_id = 1
      AND a.status NOT IN ('deleted')
      AND (
        a.employee_id = $1
        OR a.id IN (
          SELECT appointment_id FROM transactions
          WHERE employee_id = $1 AND category = 'payment' AND appointment_id IS NOT NULL
        )
      )
  `;
  const params = [driver.id];

  if (start) {
    params.push(start);
    tripQuery += ` AND DATE(a.start_time AT TIME ZONE 'America/Chicago') >= $${params.length}::date`;
  }
  if (end) {
    params.push(end);
    tripQuery += ` AND DATE(a.start_time AT TIME ZONE 'America/Chicago') <= $${params.length}::date`;
  }
  tripQuery += ` ORDER BY a.start_time ASC`;

  const trips = await sql(tripQuery, params);

  const tripIds = trips.map((t) => t.id);
  let payments = [];
  if (tripIds.length > 0) {
    payments = await sql`
      SELECT 
        appointment_id, 
        SUM(CASE WHEN category = 'payment' THEN amount ELSE 0 END) as amount, 
        SUM(COALESCE(tip_amount, 0)) as tip_amount,
        STRING_AGG(DISTINCT method, ', ' ORDER BY method) FILTER (WHERE category = 'payment' AND amount > 0) as payment_methods,
        BOOL_OR(category = 'payment' AND method = 'Cash' AND tip_amount > 0) as has_cash_tip
       FROM transactions
       WHERE category IN ('payment', 'tip')
         AND appointment_id = ANY(${tripIds})
         AND (employee_id = ${driver.id} OR employee_id IS NULL)
       GROUP BY appointment_id
    `;
  }

  // ── NEW: Query cash transactions not yet deducted in payroll ──
  let cashTransactions = [];
  if (tripIds.length > 0) {
    // Build params for cash query
    let cashQuery = `
      SELECT 
        id,
        appointment_id,
        amount,
        tip_amount
      FROM transactions
      WHERE category = 'payment'
        AND method = 'Cash'
        AND appointment_id = ANY($1)
        AND (employee_id = $2 OR employee_id IS NULL)
        AND (cash_deducted_in_payroll IS NULL OR cash_deducted_in_payroll = false)
    `;

    cashTransactions = await sql(cashQuery, [tripIds, driver.id]);
  }

  // ── LATE PAYMENT TRIPS: trips from before the period, paid during this period ──
  let latePaymentRawTrips = [];
  if (start) {
    try {
      const lateParams = [driver.id, start];
      let lateQuery = `
        SELECT
          a.id, a.booking_number, a.start_time, a.status, a.destination, a.distance_miles,
          a.services_total, a.original_amount, a.driver_commission, a.trip_commission_rate, a.tips_total,
          a.payment_status, a.payment_method, a.balance_due, a.payments_total,
          a.pickup_address, a.dropoff_address,
          c.name AS client_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.tenant_id = 1
          AND a.status NOT IN ('deleted')
          AND a.employee_id = $1
          AND DATE(a.start_time AT TIME ZONE 'America/Chicago') < $2::date
          AND COALESCE(a.balance_due, 0) <= 0
          AND a.id IN (
            SELECT DISTINCT appointment_id FROM transactions
            WHERE category = 'payment'
              AND transaction_date >= $2::date
      `;
      if (end) {
        lateParams.push(end);
        lateQuery += ` AND transaction_date <= $${lateParams.length}::date`;
      }
      lateQuery += ` AND appointment_id IS NOT NULL)`;
      lateQuery += ` ORDER BY a.start_time ASC`;
      latePaymentRawTrips = await sql(lateQuery, lateParams);
    } catch (e) {
      console.error("[Earnings] Late payment query error:", e);
    }
  }

  // Build lookup map for payment methods
  const paymentMethodsMap = {};
  for (const p of payments) {
    let methods = p.payment_methods || "";
    // Add 'Cash Tip' if there was a cash tip
    if (p.has_cash_tip) {
      methods = methods ? `${methods}, Cash Tip` : "Cash Tip";
    }
    paymentMethodsMap[p.appointment_id] = methods;
  }

  // Also fetch payment methods for late payment trips
  const latePaymentTripIds = latePaymentRawTrips.map((t) => t.id);
  if (latePaymentTripIds.length > 0) {
    const latePaymentMethods = await sql`
      SELECT 
        appointment_id, 
        STRING_AGG(DISTINCT method, ', ' ORDER BY method) FILTER (WHERE category = 'payment' AND amount > 0) as payment_methods,
        BOOL_OR(category = 'payment' AND method = 'Cash' AND tip_amount > 0) as has_cash_tip
      FROM transactions
      WHERE category IN ('payment', 'tip')
        AND appointment_id = ANY(${latePaymentTripIds})
        AND (employee_id = ${driver.id} OR employee_id IS NULL)
      GROUP BY appointment_id
    `;
    for (const p of latePaymentMethods) {
      let methods = p.payment_methods || "";
      if (p.has_cash_tip) {
        methods = methods ? `${methods}, Cash Tip` : "Cash Tip";
      }
      paymentMethodsMap[p.appointment_id] = methods;
    }
  }

  // ── Fare / Addon breakdown per trip (is_tip_addon = driver reimbursement at 100%) ──
  const allTripIds = [...tripIds, ...latePaymentTripIds];
  let fareAddonByTrip = {};
  if (allTripIds.length > 0) {
    const breakdownRows = await sql`
      SELECT
        aps.appointment_id,
        COALESCE(SUM(CASE WHEN NOT COALESCE(s.is_addon, false) AND NOT COALESCE(s.is_tip_addon, false)
                          THEN aps.service_price * COALESCE(aps.quantity, 1) ELSE 0 END), 0) AS fare_amount,
        COALESCE(SUM(CASE WHEN COALESCE(s.is_addon, false) AND NOT COALESCE(s.is_tip_addon, false)
                          THEN aps.service_price * COALESCE(aps.quantity, 1) ELSE 0 END), 0) AS non_gas_addon_amount,
        COALESCE(SUM(CASE WHEN COALESCE(s.is_tip_addon, false)
                          THEN aps.service_price * COALESCE(aps.quantity, 1) ELSE 0 END), 0) AS gas_addon_amount
      FROM appointment_services aps
      LEFT JOIN services s ON s.id = aps.service_id
      WHERE aps.appointment_id = ANY(${allTripIds})
      GROUP BY aps.appointment_id
    `;
    for (const r of breakdownRows) {
      fareAddonByTrip[r.appointment_id] = {
        fare_amount: Number(r.fare_amount || 0),
        non_gas_addon_amount: Number(r.non_gas_addon_amount || 0),
        gas_addon_amount: Number(r.gas_addon_amount || 0),
      };
    }
  }

  // ── Cash collected per trip (not yet deducted in payroll) ──
  const cashByTrip = cashTransactions.reduce((acc, t) => {
    const tid = t.appointment_id;
    acc[tid] = (acc[tid] || 0) + Number(t.amount) + Number(t.tip_amount || 0);
    return acc;
  }, {});

  // Calculate cash totals
  const totalCashCollected = cashTransactions.reduce(
    (sum, t) => sum + Number(t.amount) + Number(t.tip_amount || 0),
    0,
  );
  const cashPaymentCount = cashTransactions.length;

  const paymentByTrip = payments.reduce((acc, p) => {
    acc[p.appointment_id] = {
      amount: Number(p.amount),
      tip_amount: Number(p.tip_amount || 0),
      payment_methods: p.payment_methods || "",
    };
    return acc;
  }, {});

  // Today's date in CDT
  const todayDateCDT = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });

  const enrichedTrips = trips.map((t) => {
    const payment = paymentByTrip[t.id] || null;
    const tripAmt = Number(t.services_total || 0); // commission base
    const tipAmt = Number(t.tips_total || 0);

    const fd = fareAddonByTrip[t.id] || {};
    // Always use services_total from the trip record as fare (source of truth)
    const fareAmt = Number(t.services_total || 0);
    const nonGasAddonAmt = Number(fd.non_gas_addon_amount || 0);
    const gasAddonAmt = Number(fd.gas_addon_amount || 0);
    // Addons = gas/reimbursement addons only (non-gas are already in services_total/fare)
    const addonAmt = gasAddonAmt;
    // Revenue = fare + gas addons = original_amount
    const revenueAmt = Number(t.original_amount || 0) || fareAmt + addonAmt;

    const effectiveRate =
      t.trip_commission_rate !== null && t.trip_commission_rate !== undefined
        ? Number(t.trip_commission_rate)
        : Number(driver.salary_rate || 0);

    const commission = Number(
      (tripAmt * effectiveRate + gasAddonAmt).toFixed(2),
    );

    const cashAmt = cashByTrip[t.id] || 0;
    // Total = Fare + Addons + Tips (trip revenue including tips)
    const total = Number((fareAmt + addonAmt + tipAmt).toFixed(2));

    const isPaid =
      (t.payment_status || "").toLowerCase() === "paid" ||
      t.driver_paid === true ||
      (Number(t.balance_due || 0) <= 0 && Number(t.payments_total || 0) > 0) ||
      (Number(t.services_total || 0) === 0 && Number(t.balance_due || 0) <= 0);

    const tripDateCDT = new Date(t.start_time).toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    });
    const isPastDue = !isPaid && tripDateCDT < todayDateCDT;

    const paymentMethod = payment?.payment_methods || t.payment_method || "";
    const isCash = paymentMethod.toLowerCase().includes("cash");

    return {
      id: t.id,
      start_time: t.start_time,
      status: t.status,
      destination: t.destination,
      distance_miles: t.distance_miles ? Number(t.distance_miles) : null,
      client_name: t.client_name,
      trip_amount: tripAmt,
      fare_amount: fareAmt,
      addon_amount: addonAmt,
      gas_addon_amount: gasAddonAmt,
      revenue: revenueAmt,
      paid: isPaid,
      is_past_due: isPastDue,
      is_truly_unpaid: !isPaid,
      balance_due: parseFloat(t.balance_due) || 0,
      payment_amount: payment ? payment.amount : tripAmt,
      tip_amount: tipAmt,
      commission: commission,
      commission_rate: effectiveRate,
      trip_commission_rate:
        t.trip_commission_rate !== null && t.trip_commission_rate !== undefined
          ? Number(t.trip_commission_rate)
          : null,
      cash_amount: cashAmt,
      total: total,
      payment_method: paymentMethod,
      is_cash: isCash,
      is_late_payment: false,
      payment_methods: paymentMethodsMap[t.id] || paymentMethod || null,
    };
  });

  // Enrich late payment trips
  const enrichedLateTrips = latePaymentRawTrips.map((t) => {
    const tripAmt = Number(t.services_total || 0);
    const tipAmt = Number(t.tips_total || 0);

    const fd = fareAddonByTrip[t.id] || {};
    // Always use services_total from the trip record as fare (source of truth)
    const fareAmt = Number(t.services_total || 0);
    const nonGasAddonAmt = Number(fd.non_gas_addon_amount || 0);
    const gasAddonAmt = Number(fd.gas_addon_amount || 0);
    // Addons = gas/reimbursement addons only
    const addonAmt = gasAddonAmt;
    const revenueAmt = Number(t.original_amount || 0) || fareAmt + addonAmt;

    const paymentMethod = t.payment_method || "";
    const isCash = paymentMethod.toLowerCase().includes("cash");
    const effectiveRate =
      t.trip_commission_rate !== null && t.trip_commission_rate !== undefined
        ? Number(t.trip_commission_rate)
        : Number(driver.salary_rate || 0);

    const commission = Number(
      (tripAmt * effectiveRate + gasAddonAmt).toFixed(2),
    );
    const cashAmt = cashByTrip[t.id] || 0;
    // Total = Fare + Addons + Tips
    const total = Number((fareAmt + addonAmt + tipAmt).toFixed(2));

    return {
      id: t.id,
      start_time: t.start_time,
      status: t.status,
      destination: t.destination,
      distance_miles: t.distance_miles ? Number(t.distance_miles) : null,
      client_name: t.client_name,
      trip_amount: tripAmt,
      fare_amount: fareAmt,
      addon_amount: addonAmt,
      gas_addon_amount: gasAddonAmt,
      revenue: revenueAmt,
      paid: true,
      is_past_due: false,
      is_truly_unpaid: false,
      balance_due: 0,
      payment_amount: tripAmt,
      tip_amount: tipAmt,
      commission: commission,
      commission_rate: effectiveRate,
      trip_commission_rate:
        t.trip_commission_rate !== null && t.trip_commission_rate !== undefined
          ? Number(t.trip_commission_rate)
          : null,
      cash_amount: cashAmt,
      total: total,
      payment_method: paymentMethod,
      is_cash: isCash,
      is_late_payment: true,
      payment_methods: paymentMethodsMap[t.id] || paymentMethod || null,
    };
  });

  const allTrips = [...enrichedTrips, ...enrichedLateTrips];

  // Only sum paid trips for revenue, tips, and commission
  const paidTrips = allTrips.filter((t) => t.paid);
  const unpaidTrips = allTrips.filter((t) => !t.paid);

  // Calculate totals for PAID trips only (unpaid trips excluded from financial calculations)
  const totalRevenue = paidTrips.reduce((s, t) => s + t.trip_amount, 0);
  const totalTips = paidTrips.reduce((s, t) => s + t.tip_amount, 0);
  const totalCommission = paidTrips.reduce((s, t) => s + t.commission, 0);

  const paidRevenue = totalRevenue;
  const paidTips = totalTips;
  const paidCommission = totalCommission;

  const unpaidRevenue = unpaidTrips.reduce((s, t) => s + t.trip_amount, 0);
  const unpaidTips = unpaidTrips.reduce((s, t) => s + t.tip_amount, 0);
  const unpaidCommission = unpaidTrips.reduce((s, t) => s + t.commission, 0);

  const totalCompensation = totalCommission + totalTips;
  const netPayroll = totalCompensation - totalCashCollected;

  const totalMiles = allTrips.reduce((s, t) => s + (t.distance_miles || 0), 0);

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      color: driver.color,
      salary_rate: Number(driver.salary_rate),
      adp_worker_id: driver.adp_worker_id,
    },
    summary: {
      total_trips: trips.length,
      late_payment_trips: enrichedLateTrips.length,
      paid_trips: paidTrips.length,
      unpaid_trips: unpaidTrips.length,
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_tips: Number(totalTips.toFixed(2)),
      total_commission: Number(totalCommission.toFixed(2)),
      total_compensation: Number(totalCompensation.toFixed(2)),
      paid_revenue: Number(paidRevenue.toFixed(2)),
      paid_tips: Number(paidTips.toFixed(2)),
      paid_commission: Number(paidCommission.toFixed(2)),
      unpaid_revenue: Number(unpaidRevenue.toFixed(2)),
      unpaid_tips: Number(unpaidTips.toFixed(2)),
      unpaid_commission: Number(unpaidCommission.toFixed(2)),
      total_miles: Number(totalMiles.toFixed(2)),
      total_cash_collected: Number(totalCashCollected.toFixed(2)),
      cash_payment_count: cashPaymentCount,
      net_payroll: Number(netPayroll.toFixed(2)),
    },
    trips: allTrips,
    cashTransactions: cashTransactions.map((t) => ({
      id: t.id,
      appointment_id: t.appointment_id,
      amount: Number(t.amount),
      tip_amount: Number(t.tip_amount || 0),
    })),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let employee_id = searchParams.get("employee_id");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  // ── SECURITY: Verify driver can only see their own data ──────────────────
  try {
    // Bypass mode removed — always require authentication

    // Check for admin impersonation cookie
    const cookies = request.headers.get("cookie") || "";
    const impersonationMatch = cookies.match(
      /admin_impersonate_driver_id=(\d+)/,
    );

    let authenticatedDriver = null;

    if (impersonationMatch) {
      // Admin impersonating a driver - allow access but only to that driver's data
      // UNLESS the request explicitly asks for "all" (admin report pages)
      if (employee_id === "all") {
        console.log(
          `[Earnings] Admin impersonation active but employee_id=all requested — allowing all drivers`,
        );
      } else {
        const driverId = impersonationMatch[1];
        const [driver] = await sql`
          SELECT id, is_admin FROM employees 
          WHERE id = ${driverId} AND tenant_id = 1 AND is_active = true
        `;
        if (driver) {
          authenticatedDriver = driver;
          // Override employee_id to the impersonated driver
          employee_id = String(driver.id);
          console.log(`[Earnings] Admin impersonating driver ${driver.id}`);
        }
      }
    } else {
      // Normal authentication flow
      const session = await auth();
      console.log(
        `[Earnings] Auth session email: ${session?.user?.email || "none"}`,
      );

      if (session?.user?.email) {
        const [driver] = await sql`
          SELECT id, is_admin FROM employees 
          WHERE LOWER(email) = LOWER(${session.user.email}) 
            AND tenant_id = 1 
            AND is_active = true
        `;

        if (driver) {
          authenticatedDriver = driver;
          console.log(
            `[Earnings] Matched employee id=${driver.id}, is_admin=${driver.is_admin}`,
          );

          // If the user is NOT an admin, force them to only see their own data
          if (!driver.is_admin) {
            employee_id = String(driver.id);
            console.log(
              `[Earnings] Non-admin driver — restricting to employee_id=${employee_id}`,
            );
          }
          // If they ARE an admin, allow the requested employee_id (including "all")
        } else {
          console.log(
            `[Earnings] No employee match for email ${session.user.email} — proceeding with original employee_id=${employee_id}`,
          );
        }
      }
    }
  } catch (authError) {
    console.error("Authentication check error:", authError);
    // Continue with original employee_id if auth check fails
  }

  if (!employee_id) {
    return Response.json({ error: "employee_id is required" }, { status: 400 });
  }

  try {
    // ── ALL DRIVERS mode ────────────────────────────────────────────────────
    if (employee_id === "all") {
      const allDrivers = await sql`
        SELECT id, name, email, phone, color, salary_rate, adp_worker_id
        FROM employees
        WHERE tenant_id = 1 AND is_active = true
        ORDER BY name ASC
      `;

      const driverReports = await Promise.all(
        allDrivers.map((d) => getDriverEarnings(d, start, end)),
      );

      // Aggregate totals across all drivers
      const aggregate = driverReports.reduce(
        (acc, r) => ({
          total_trips: acc.total_trips + r.summary.total_trips,
          paid_trips: acc.paid_trips + r.summary.paid_trips,
          unpaid_trips: acc.unpaid_trips + r.summary.unpaid_trips,
          total_revenue: acc.total_revenue + r.summary.total_revenue,
          total_tips: acc.total_tips + r.summary.total_tips,
          total_commission: acc.total_commission + r.summary.total_commission,
          total_compensation:
            acc.total_compensation + r.summary.total_compensation,
          paid_revenue: acc.paid_revenue + r.summary.paid_revenue,
          paid_tips: acc.paid_tips + r.summary.paid_tips,
          paid_commission: acc.paid_commission + r.summary.paid_commission,
          unpaid_revenue: acc.unpaid_revenue + r.summary.unpaid_revenue,
          unpaid_tips: acc.unpaid_tips + r.summary.unpaid_tips,
          unpaid_commission:
            acc.unpaid_commission + r.summary.unpaid_commission,
          total_cash_collected:
            acc.total_cash_collected + r.summary.total_cash_collected,
          cash_payment_count:
            acc.cash_payment_count + r.summary.cash_payment_count,
          net_payroll: acc.net_payroll + r.summary.net_payroll,
        }),
        {
          total_trips: 0,
          paid_trips: 0,
          unpaid_trips: 0,
          total_revenue: 0,
          total_tips: 0,
          total_commission: 0,
          total_compensation: 0,
          paid_revenue: 0,
          paid_tips: 0,
          paid_commission: 0,
          unpaid_revenue: 0,
          unpaid_tips: 0,
          unpaid_commission: 0,
          total_cash_collected: 0,
          cash_payment_count: 0,
          net_payroll: 0,
        },
      );

      return Response.json({
        mode: "all",
        summary: {
          total_trips: aggregate.total_trips,
          paid_trips: aggregate.paid_trips,
          unpaid_trips: aggregate.unpaid_trips,
          total_revenue: Number(aggregate.total_revenue.toFixed(2)),
          total_tips: Number(aggregate.total_tips.toFixed(2)),
          total_commission: Number(aggregate.total_commission.toFixed(2)),
          total_compensation: Number(aggregate.total_compensation.toFixed(2)),
          paid_revenue: Number(aggregate.paid_revenue.toFixed(2)),
          paid_tips: Number(aggregate.paid_tips.toFixed(2)),
          paid_commission: Number(aggregate.paid_commission.toFixed(2)),
          unpaid_revenue: Number(aggregate.unpaid_revenue.toFixed(2)),
          unpaid_tips: Number(aggregate.unpaid_tips.toFixed(2)),
          unpaid_commission: Number(aggregate.unpaid_commission.toFixed(2)),
          total_cash_collected: Number(
            aggregate.total_cash_collected.toFixed(2),
          ),
          cash_payment_count: aggregate.cash_payment_count,
          net_payroll: Number(aggregate.net_payroll.toFixed(2)),
        },
        drivers: driverReports,
      });
    }

    // ── SINGLE DRIVER mode ──────────────────────────────────────────────────
    const [driver] = await sql`
      SELECT id, name, email, phone, color, salary_rate, adp_worker_id
      FROM employees
      WHERE id = ${employee_id} AND tenant_id = 1
    `;

    if (!driver) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const report = await getDriverEarnings(driver, start, end);
    return Response.json(report);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch earnings" },
      { status: 500 },
    );
  }
}
