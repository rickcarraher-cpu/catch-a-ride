import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Helper: compute timesheet data for a single driver over a date range
// This is copied and adapted from earnings/route.js
async function getDriverTimesheetData(driver, start, end) {
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
      a.driver_paid,
      a.payroll_processed,
      c.name AS client_name,
      CASE
        WHEN a.driver_paid = true THEN true
        WHEN a.payment_status = 'paid' THEN true
        WHEN COALESCE(a.balance_due, 0) <= 0 AND COALESCE(a.payments_total, 0) > 0 THEN true
        WHEN COALESCE(a.services_total, 0) = 0 AND COALESCE(a.balance_due, 0) <= 0 THEN true
        ELSE false
      END as is_paid
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

  // Query cash transactions not yet deducted in payroll
  let cashTransactions = [];
  if (tripIds.length > 0) {
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

  // ── Add-on queries ──────────────────────────────────────────────────────────
  // 1. ALL add-ons (is_addon = true) — populates the Add-ons column
  let addonsByTrip = {};
  if (tripIds.length > 0) {
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
    addonRows.forEach((r) => {
      addonsByTrip[r.appointment_id] = parseFloat(r.addons_total || 0);
    });
  }

  // 2. Regular (non-tip) add-ons (is_addon = true AND is_tip_addon = false).
  //    These ARE baked into services_total (the commission base), so we subtract
  //    them from the displayed Fare to prevent double-counting.
  let regularAddonsByTrip = {};
  if (tripIds.length > 0) {
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
    regularAddonRows.forEach((r) => {
      regularAddonsByTrip[r.appointment_id] = parseFloat(
        r.regular_addons_total || 0,
      );
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  // ── 3. Gas / tip-reimbursement add-ons (is_tip_addon = true) ──────────────
  // Driver earns 100% of these — shown separately from commission
  let gasAddonByTrip = {};
  if (tripIds.length > 0) {
    const gasRows = await sql`
      SELECT
        aps.appointment_id,
        COALESCE(SUM(aps.service_price * COALESCE(aps.quantity, 1)), 0) AS gas_total
      FROM appointment_services aps
      JOIN services s ON s.id = aps.service_id
      WHERE s.is_tip_addon = true
        AND aps.appointment_id = ANY(${tripIds})
      GROUP BY aps.appointment_id
    `;
    gasRows.forEach((r) => {
      gasAddonByTrip[r.appointment_id] = parseFloat(r.gas_total || 0);
    });
  }
  // ────────────────────────────────────────────────────────────────────────────

  const paymentMap = new Map();
  payments.forEach((p) => {
    paymentMap.set(p.appointment_id, {
      amount: Number(p.amount || 0),
      tip_amount: Number(p.tip_amount || 0),
      methods: p.payment_methods || "",
      has_cash_tip: p.has_cash_tip || false,
    });
  });

  const cashMap = new Map();
  cashTransactions.forEach((c) => {
    const existing = cashMap.get(c.appointment_id) || 0;
    cashMap.set(
      c.appointment_id,
      existing + Number(c.amount || 0) + Number(c.tip_amount || 0),
    );
  });

  const enrichedTrips = trips.map((t) => {
    const pmtData = paymentMap.get(t.id) || {
      amount: 0,
      tip_amount: 0,
      methods: "",
      has_cash_tip: false,
    };
    const cash_amount = cashMap.get(t.id) || 0;

    // services_total = commission base (fare + non-gas addons, no gas)
    const commissionBase = Number(t.services_total || 0);
    // original_amount = true revenue (fare + all addons including gas)
    const revenue = Number(t.original_amount || t.services_total || 0);

    const gas_addon = gasAddonByTrip[t.id] || 0;

    // Calculate commission_rate first so we can compute commission live
    const commission_rate = Number(
      t.trip_commission_rate !== null && t.trip_commission_rate !== undefined
        ? t.trip_commission_rate
        : driver.salary_rate || 0.75,
    );

    // Recalculate commission live from commissionBase × rate (gas excluded, shown separately)
    // This ensures Commission always equals Fare × Rate shown on screen
    const commission = Number((commissionBase * commission_rate).toFixed(2));

    const tips = Number(t.tips_total || 0);
    const addons = addonsByTrip[t.id] || 0;

    // Total Comp = Commission (excl gas) + Gas Fee + Tips
    // This equals driver_commission + tips — same value as before, just displayed differently
    const total_compensation = Number(
      (commission + gas_addon + tips).toFixed(2),
    );

    const isPaid = t.is_paid === true || t.driver_paid === true;
    const isCash = (t.payment_method || "").toLowerCase() === "cash";

    return {
      id: t.id,
      booking_number: t.booking_number,
      bookingNumber: t.booking_number,
      start_time: t.start_time,
      status: t.status,
      destination: t.destination,
      distance_miles: Number(t.distance_miles || 0),
      client_name: t.client_name,
      clientName: t.client_name,
      date: t.start_time,
      pickup: t.pickup_address,
      dropoff: t.dropoff_address,
      miles: Number(t.distance_miles || 0),
      // revenue = true revenue (fare + all addons incl. gas) = original_amount
      revenue: Number(revenue.toFixed(2)),
      // commission_base = services_total (used for rate-edit preview)
      commission_base: Number(commissionBase.toFixed(2)),
      commission_rate: Number(commission_rate.toFixed(2)),
      // commission = services_total × rate only (gas stripped out for display)
      commission: Number(commission.toFixed(2)),
      // gas_addon = gas reimbursement shown in its own column
      gas_addon: Number(gas_addon.toFixed(2)),
      tips: Number(tips.toFixed(2)),
      tipsStored: Number(tips.toFixed(2)),
      cash_amount: Number(cash_amount.toFixed(2)),
      cashCollected: Number(cash_amount.toFixed(2)),
      total_compensation,
      paid: isPaid,
      isPaid: isPaid,
      isTrulyUnpaid: !isPaid,
      driverPaid: t.driver_paid || false,
      payroll_processed: t.payroll_processed || false,
      isCash: isCash,
      hasCashTip: pmtData.has_cash_tip || false,
      payment_status: t.payment_status,
      paymentStatus: t.payment_status,
      payment_method: t.payment_method,
      paymentMethod: t.payment_method,
      balance_due: t.balance_due,
      payments_total: t.payments_total,
      client: { name: t.client_name },
      addons: addonsByTrip[t.id] || 0,
      regularAddons: regularAddonsByTrip[t.id] || 0,
      // Fare = services_total minus regular (non-tip) add-ons
      fare: Math.max(0, commissionBase - (regularAddonsByTrip[t.id] || 0)),
    };
  });

  const paidTrips = enrichedTrips.filter((t) => t.paid);
  const unpaidTrips = enrichedTrips.filter((t) => !t.paid);

  const total_revenue = enrichedTrips.reduce((s, t) => s + t.revenue, 0);
  const total_commission = enrichedTrips.reduce((s, t) => s + t.commission, 0);
  const total_gas_addons = enrichedTrips.reduce(
    (s, t) => s + (t.gas_addon || 0),
    0,
  );
  const total_tips = enrichedTrips.reduce((s, t) => s + t.tips, 0);
  // Total Comp = Commission (excl gas) + Gas Fee + Tips
  const total_compensation = total_commission + total_gas_addons + total_tips;
  const total_cash_collected = enrichedTrips.reduce(
    (s, t) => s + t.cash_amount,
    0,
  );
  const net_payroll = total_compensation - total_cash_collected;

  const paid_revenue = paidTrips.reduce((s, t) => s + t.revenue, 0);
  const paid_commission = paidTrips.reduce((s, t) => s + t.commission, 0);
  const paid_tips = paidTrips.reduce((s, t) => s + t.tips, 0);

  const unpaid_revenue = unpaidTrips.reduce((s, t) => s + t.revenue, 0);
  const unpaid_commission = unpaidTrips.reduce((s, t) => s + t.commission, 0);
  const unpaid_tips = unpaidTrips.reduce((s, t) => s + t.tips, 0);

  return {
    driver: {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phone: driver.phone,
      color: driver.color,
      salary_rate: Number(driver.salary_rate || 0.75),
      adp_worker_id: driver.adp_worker_id,
    },
    summary: {
      total_trips: enrichedTrips.length,
      paid_trips: paidTrips.length,
      unpaid_trips: unpaidTrips.length,
      total_revenue: Number(total_revenue.toFixed(2)),
      driver_commission: Number(total_commission.toFixed(2)),
      tips_total: Number(total_tips.toFixed(2)),
      total_compensation: Number(total_compensation.toFixed(2)),
      cash_collected: Number(total_cash_collected.toFixed(2)),
      net_payroll: Number(net_payroll.toFixed(2)),
      paid_revenue: Number(paid_revenue.toFixed(2)),
      paid_commission: Number(paid_commission.toFixed(2)),
      paid_tips: Number(paid_tips.toFixed(2)),
      unpaid_revenue: Number(unpaid_revenue.toFixed(2)),
      unpaid_commission: Number(unpaid_commission.toFixed(2)),
      unpaid_tips: Number(unpaid_tips.toFixed(2)),
    },
    trips: enrichedTrips,
  };
}

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Support both old and new parameter names
    const start = searchParams.get("start") || searchParams.get("startDate");
    const end = searchParams.get("end") || searchParams.get("endDate");
    const employee_id =
      searchParams.get("employee_id") || searchParams.get("driverId");

    if (!start || !end) {
      return Response.json(
        { error: "start and end dates are required" },
        { status: 400 },
      );
    }

    // ALL DRIVERS mode
    if (!employee_id || employee_id === "all") {
      const drivers = await sql`
        SELECT id, name, email, phone, color, salary_rate, adp_worker_id, is_active
        FROM employees
        WHERE tenant_id = 1 AND is_active = true
        ORDER BY name ASC
      `;

      const driverReports = await Promise.all(
        drivers.map((d) => getDriverTimesheetData(d, start, end)),
      );

      // ── Fetch approval status for each driver ──
      const approvals = await sql`
        SELECT employee_id, driver_status, admin_status, driver_reason, admin_reason,
               driver_responded_at, admin_responded_at, admin_responded_by
        FROM timesheet_approvals
        WHERE start_date = ${start}::date
          AND end_date = ${end}::date
          AND employee_id = ANY(${drivers.map((d) => d.id)})
      `;
      const approvalMap = new Map();
      approvals.forEach((a) => {
        approvalMap.set(a.employee_id, {
          driver_status: a.driver_status,
          admin_status: a.admin_status,
          driver_reason: a.driver_reason,
          admin_reason: a.admin_reason,
          driver_responded_at: a.driver_responded_at,
          admin_responded_at: a.admin_responded_at,
          admin_responded_by: a.admin_responded_by,
        });
      });

      // Attach approval to each driver report
      const reportsWithApproval = driverReports.map((report) => ({
        ...report,
        approval: approvalMap.get(report.driver.id) || null,
      }));

      // Compute aggregate summary
      const aggregate = reportsWithApproval.reduce(
        (acc, report) => ({
          total_trips: acc.total_trips + report.summary.total_trips,
          paid_trips: acc.paid_trips + report.summary.paid_trips,
          unpaid_trips: acc.unpaid_trips + report.summary.unpaid_trips,
          total_revenue: acc.total_revenue + report.summary.total_revenue,
          total_commission:
            acc.total_commission + report.summary.driver_commission,
          total_compensation:
            acc.total_compensation + report.summary.total_compensation,
          paid_revenue: acc.paid_revenue + report.summary.paid_revenue,
          paid_tips: acc.paid_tips + report.summary.paid_tips,
          paid_commission: acc.paid_commission + report.summary.paid_commission,
          unpaid_revenue: acc.unpaid_revenue + report.summary.unpaid_revenue,
          unpaid_tips: acc.unpaid_tips + report.summary.unpaid_tips,
          unpaid_commission:
            acc.unpaid_commission + report.summary.unpaid_commission,
          total_cash_collected:
            acc.total_cash_collected + report.summary.cash_collected,
          cash_payment_count:
            acc.cash_payment_count +
            (report.summary.cash_collected > 0 ? 1 : 0),
          net_payroll: acc.net_payroll + report.summary.net_payroll,
        }),
        {
          total_trips: 0,
          paid_trips: 0,
          unpaid_trips: 0,
          total_revenue: 0,
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
        summary: {
          total_trips: aggregate.total_trips,
          paid_trips: aggregate.paid_trips,
          unpaid_trips: aggregate.unpaid_trips,
          total_revenue: Number(aggregate.total_revenue.toFixed(2)),
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
        drivers: reportsWithApproval,
      });
    }

    // SINGLE DRIVER mode
    const [driver] = await sql`
      SELECT id, name, email, phone, color, salary_rate, adp_worker_id
      FROM employees
      WHERE id = ${employee_id} AND tenant_id = 1
    `;

    if (!driver) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const report = await getDriverTimesheetData(driver, start, end);

    // ── Fetch approval status for single driver ──
    const approvals = await sql`
      SELECT driver_status, admin_status, driver_reason, admin_reason,
             driver_responded_at, admin_responded_at, admin_responded_by
      FROM timesheet_approvals
      WHERE employee_id = ${parseInt(employee_id)}
        AND start_date = ${start}::date
        AND end_date = ${end}::date
      LIMIT 1
    `;

    // Wrap in same structure as all-drivers mode for consistency
    return Response.json({
      summary: report.summary,
      drivers: [
        {
          ...report,
          approval: approvals[0] || null,
        },
      ],
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch timesheets" },
      { status: 500 },
    );
  }
}
