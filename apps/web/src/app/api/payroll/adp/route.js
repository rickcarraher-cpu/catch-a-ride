import sql from "@/app/api/utils/sql";

/**
 * ADP Pay Data API Integration
 *
 * This endpoint interfaces with ADP's Pay Data API to submit payroll data.
 * Reference: https://developers.adp.com/articles/api/pay-data-input-api
 */

// Helper to get ADP access token
async function getADPAccessToken() {
  const clientId = process.env.ADP_CLIENT_ID;
  const clientSecret = process.env.ADP_CLIENT_SECRET;
  const cert = process.env.ADP_SSL_CERT;
  const key = process.env.ADP_SSL_KEY;

  if (!clientId || !clientSecret) {
    throw new Error("ADP credentials not configured");
  }

  const tokenUrl = process.env.ADP_API_URL
    ? `${process.env.ADP_API_URL}/auth/oauth/v2/token`
    : "https://api.adp.com/auth/oauth/v2/token";

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ADP authentication failed: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Helper to format earnings data for ADP Pay Data API
function formatPayrollDataForADP(earningsData, payPeriod) {
  const workers = earningsData.drivers.map((driverReport) => {
    const driver = driverReport.driver;
    const summary = driverReport.summary;

    // Build earnings array with commission, tips, hourly compensation, and cash deduction
    const earnings = [
      {
        earningsCode: process.env.ADP_COMMISSION_CODE || "COMM",
        earningsCategoryCode: "regular",
        payPeriodHours: {
          hoursQuantity: summary.total_trips,
        },
        payPeriodEarnings: {
          currencyCode: "USD",
          amountValue: summary.total_commission.toFixed(2),
        },
        memo: `Commission: ${summary.total_trips} trips`,
      },
      {
        earningsCode: process.env.ADP_TIPS_CODE || "TIPS",
        earningsCategoryCode: "supplemental",
        payPeriodEarnings: {
          currencyCode: "USD",
          amountValue: summary.total_tips.toFixed(2),
        },
        memo: `Tips from ${summary.total_trips} trips`,
      },
    ];

    // Add hourly compensation if present
    if (summary.hourly_compensation && summary.hourly_compensation > 0) {
      earnings.push({
        earningsCode: process.env.ADP_HOURLY_CODE || "HOURLY",
        earningsCategoryCode: "regular",
        payPeriodHours: {
          hoursQuantity: summary.hours_worked || 0,
        },
        payPeriodEarnings: {
          currencyCode: "USD",
          amountValue: summary.hourly_compensation.toFixed(2),
        },
        memo: `Hourly compensation: ${summary.hours_worked || 0} hours`,
      });
    }

    // Add cash deduction if driver collected any cash
    if (summary.total_cash_collected > 0) {
      earnings.push({
        earningsCode: process.env.ADP_CASH_DEDUCTION_CODE || "CASHDED",
        earningsCategoryCode: "deduction",
        payPeriodEarnings: {
          currencyCode: "USD",
          amountValue: (summary.total_cash_collected * -1).toFixed(2),
        },
        memo: `Cash collected by driver (${summary.cash_payment_count} payment${summary.cash_payment_count !== 1 ? "s" : ""})`,
      });
    }

    return {
      workerID: {
        idValue: (driver.adp_worker_id || driver.id).toString(), // Use ADP Worker ID if available, otherwise database ID
      },
      payrollGroupCode: process.env.ADP_PAYROLL_GROUP_CODE || "DEFAULT",
      payrollFileNumber: process.env.ADP_PAYROLL_FILE_NUMBER || "001",
      payPeriod: {
        startDate: payPeriod.startDate,
        endDate: payPeriod.endDate,
      },
      earnings: earnings,
      grossPay: {
        currencyCode: "USD",
        amountValue: summary.net_payroll.toFixed(2),
      },
    };
  });

  return {
    events: [
      {
        data: {
          eventContext: {
            payrollProcessingDate: new Date().toISOString().split("T")[0],
          },
          transform: {
            payDataInput: {
              workers: workers,
            },
          },
        },
      },
    ],
  };
}

// POST: Submit payroll to ADP using APPROVED timesheet snapshots
export async function POST(request) {
  try {
    const { startDate, endDate, driverIds, testMode } = await request.json();

    if (!startDate || !endDate) {
      return Response.json(
        { error: "Start date and end date are required" },
        { status: 400 },
      );
    }

    // ── STEP 1: Fetch approved timesheets for this period ──────────────────
    let approvedTimesheets;
    if (driverIds && driverIds.length > 0) {
      approvedTimesheets = await sql`
        SELECT 
          ta.*,
          e.id as driver_id,
          e.name as driver_name,
          e.salary_rate,
          e.adp_worker_id,
          e.hourly_rate
        FROM timesheet_approvals ta
        JOIN employees e ON ta.employee_id = e.id
        WHERE ta.start_date = ${startDate}::date
          AND ta.end_date = ${endDate}::date
          AND ta.admin_status = 'approved'
          AND ta.employee_id = ANY(${driverIds})
        ORDER BY e.name
      `;
    } else {
      approvedTimesheets = await sql`
        SELECT 
          ta.*,
          e.id as driver_id,
          e.name as driver_name,
          e.salary_rate,
          e.adp_worker_id,
          e.hourly_rate
        FROM timesheet_approvals ta
        JOIN employees e ON ta.employee_id = e.id
        WHERE ta.start_date = ${startDate}::date
          AND ta.end_date = ${endDate}::date
          AND ta.admin_status = 'approved'
        ORDER BY e.name
      `;
    }

    if (approvedTimesheets.length === 0) {
      return Response.json(
        {
          error:
            "No approved timesheets found for this period. Drivers must approve their timesheets first, then admin must approve them before submitting to ADP.",
          approvedCount: 0,
        },
        { status: 400 },
      );
    }

    // ── STEP 2: Build driver reports from approved snapshot data ───────────
    const driverReports = await Promise.all(
      approvedTimesheets.map(async (timesheet) => {
        const tripIds = timesheet.trip_ids || [];

        // Fetch trip details for the snapshot
        let trips = [];
        let cashTransactions = [];

        if (tripIds.length > 0) {
          // Get trip details
          trips = await sql`
            SELECT
              a.id,
              a.start_time,
              a.status,
              a.destination,
              a.distance_miles,
              a.services_total,
              a.driver_commission,
              a.tips_total,
              a.payment_status,
              a.payment_method,
              a.balance_due,
              a.payments_total,
              c.name AS client_name
            FROM appointments a
            LEFT JOIN clients c ON a.client_id = c.id
            WHERE a.id = ANY(${tripIds})
            ORDER BY a.start_time ASC
          `;

          // Get payment details for these trips
          const payments = await sql`
            SELECT 
              appointment_id, 
              SUM(CASE WHEN category = 'payment' THEN amount ELSE 0 END) as amount, 
              SUM(COALESCE(tip_amount, 0)) as tip_amount,
              STRING_AGG(DISTINCT method, ', ') as payment_methods
            FROM transactions
            WHERE category IN ('payment', 'tip')
              AND appointment_id = ANY(${tripIds})
              AND (employee_id = ${timesheet.driver_id} OR employee_id IS NULL)
            GROUP BY appointment_id
          `;

          // Get cash transactions not yet deducted
          cashTransactions = await sql`
            SELECT 
              id,
              appointment_id,
              amount,
              tip_amount
            FROM transactions
            WHERE category = 'payment'
              AND method = 'Cash'
              AND appointment_id = ANY(${tripIds})
              AND (employee_id = ${timesheet.driver_id} OR employee_id IS NULL)
              AND (cash_deducted_in_payroll IS NULL OR cash_deducted_in_payroll = false)
          `;

          // Enrich trips with payment data
          trips = trips.map((trip) => {
            const payment = payments.find((p) => p.appointment_id === trip.id);
            const paymentAmount = payment ? Number(payment.amount) : 0;
            const tipAmount = payment ? Number(payment.tip_amount) : 0;
            const paymentMethods =
              payment?.payment_methods || trip.payment_method || "";

            // Determine if trip is paid (same logic as earnings endpoint)
            const paymentStatusIsPaid =
              (trip.payment_status || "").toLowerCase() === "paid";
            const balanceDue = parseFloat(trip.balance_due) || 0;
            const paymentsTotal = parseFloat(trip.payments_total) || 0;
            const balanceSettled = balanceDue <= 0 && paymentsTotal > 0;
            const hasTxn = !!payment;
            const isZeroCharge =
              (parseFloat(trip.services_total) || 0) === 0 && balanceDue <= 0;
            const isPaid =
              paymentStatusIsPaid || balanceSettled || hasTxn || isZeroCharge;

            return {
              id: trip.id,
              start_time: trip.start_time,
              status: trip.status,
              client_name: trip.client_name,
              destination: trip.destination,
              distance_miles: Number(trip.distance_miles) || 0,
              trip_amount: Number(trip.services_total) || 0,
              payment_amount: paymentAmount,
              tip_amount: tipAmount,
              commission: Number(trip.driver_commission) || 0,
              payment_method: paymentMethods,
              paid: isPaid,
            };
          });
        }

        // Calculate totals from snapshot trips
        const totalTrips = trips.length;
        const paidTrips = trips.filter((t) => t.paid);

        const totalRevenue = paidTrips.reduce((s, t) => s + t.trip_amount, 0);
        const totalTips = paidTrips.reduce((s, t) => s + t.tip_amount, 0);
        const totalCommission = paidTrips.reduce((s, t) => s + t.commission, 0);

        const totalCashCollected = cashTransactions.reduce(
          (sum, txn) => sum + Number(txn.amount) + Number(txn.tip_amount || 0),
          0,
        );
        const cashPaymentCount = cashTransactions.length;

        // Use hourly compensation from approved timesheet
        const hourlyCompensation = Number(timesheet.hourly_compensation || 0);
        const totalCompensation =
          totalCommission + totalTips + hourlyCompensation;
        const netPayroll = totalCompensation - totalCashCollected;

        return {
          driver: {
            id: timesheet.driver_id,
            name: timesheet.driver_name,
            salary_rate: Number(timesheet.salary_rate),
            adp_worker_id: timesheet.adp_worker_id,
            hourly_rate: Number(timesheet.hourly_rate || 0),
          },
          summary: {
            total_trips: totalTrips,
            paid_trips: paidTrips.length,
            total_revenue: totalRevenue,
            total_tips: totalTips,
            total_commission: totalCommission,
            total_compensation: totalCompensation,
            total_cash_collected: totalCashCollected,
            cash_payment_count: cashPaymentCount,
            net_payroll: netPayroll,
            hourly_compensation: hourlyCompensation,
            hours_worked: Number(timesheet.hours_worked || 0),
          },
          trips: trips,
          cashTransactions: cashTransactions,
          approvalId: timesheet.id,
        };
      }),
    );

    // Calculate aggregate summary
    const aggregateSummary = {
      total_trips: driverReports.reduce((s, r) => s + r.summary.total_trips, 0),
      paid_trips: driverReports.reduce((s, r) => s + r.summary.paid_trips, 0),
      total_revenue: driverReports.reduce(
        (s, r) => s + r.summary.total_revenue,
        0,
      ),
      total_tips: driverReports.reduce((s, r) => s + r.summary.total_tips, 0),
      total_commission: driverReports.reduce(
        (s, r) => s + r.summary.total_commission,
        0,
      ),
      total_compensation: driverReports.reduce(
        (s, r) => s + r.summary.total_compensation,
        0,
      ),
      total_cash_collected: driverReports.reduce(
        (s, r) => s + r.summary.total_cash_collected,
        0,
      ),
      cash_payment_count: driverReports.reduce(
        (s, r) => s + r.summary.cash_payment_count,
        0,
      ),
      net_payroll: driverReports.reduce((s, r) => s + r.summary.net_payroll, 0),
      hourly_compensation: driverReports.reduce(
        (s, r) => s + r.summary.hourly_compensation,
        0,
      ),
    };

    const earningsData = {
      drivers: driverReports,
      summary: aggregateSummary,
    };

    // Format data for ADP
    const adpPayload = formatPayrollDataForADP(earningsData, {
      startDate,
      endDate,
    });

    // If test mode, return the payload without sending to ADP
    if (testMode) {
      // Build detailed driver breakdown for preview UI
      const driverDetails = earningsData.drivers.map((dr) => ({
        id: dr.driver.id,
        name: dr.driver.name,
        salary_rate: dr.driver.salary_rate,
        total_trips: dr.summary.total_trips,
        paid_trips: dr.summary.paid_trips,
        total_commission: dr.summary.total_commission,
        total_tips: dr.summary.total_tips,
        total_compensation: dr.summary.total_compensation,
        total_revenue: dr.summary.total_revenue,
        total_cash_collected: dr.summary.total_cash_collected,
        cash_payment_count: dr.summary.cash_payment_count,
        net_payroll: dr.summary.net_payroll,
        hourly_compensation: dr.summary.hourly_compensation,
        hours_worked: dr.summary.hours_worked,
        trips: dr.trips.map((t) => ({
          id: t.id,
          start_time: t.start_time,
          client_name: t.client_name,
          destination: t.destination,
          trip_amount: t.trip_amount,
          payment_amount: t.payment_amount,
          tip_amount: t.tip_amount,
          commission: t.commission,
          paid: t.paid,
        })),
      }));

      return Response.json({
        success: true,
        testMode: true,
        payload: adpPayload,
        driverDetails,
        summary: {
          totalDrivers: earningsData.drivers.length,
          totalCompensation: earningsData.summary.total_compensation.toFixed(2),
          dataSource: "approved_timesheets",
        },
      });
    }

    // Get ADP access token
    const accessToken = await getADPAccessToken();

    // Submit to ADP Pay Data API
    const adpApiUrl = process.env.ADP_API_URL || "https://api.adp.com";
    const payDataUrl = `${adpApiUrl}/payroll/v1/pay-data-input`;

    const adpResponse = await fetch(payDataUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(adpPayload),
    });

    if (!adpResponse.ok) {
      const errorText = await adpResponse.text();
      throw new Error(`ADP API error: ${errorText}`);
    }

    const adpResult = await adpResponse.json();

    // Log payroll submission
    const [submissionRecord] = await sql`
      INSERT INTO payroll_submissions (
        tenant_id,
        start_date,
        end_date,
        driver_count,
        total_compensation,
        adp_response,
        submitted_at,
        submitted_by
      ) VALUES (
        1,
        ${startDate},
        ${endDate},
        ${earningsData.drivers.length},
        ${earningsData.summary.total_compensation},
        ${JSON.stringify(adpResult)},
        NOW(),
        'ADP Integration'
      )
      RETURNING id
    `;

    // Mark all cash transactions as deducted in this payroll run
    const allCashTransactionIds = earningsData.drivers
      .flatMap((d) => d.cashTransactions || [])
      .map((t) => t.id);

    if (allCashTransactionIds.length > 0) {
      await sql`
        UPDATE transactions
        SET 
          cash_deducted_in_payroll = true,
          payroll_submission_id = ${submissionRecord.id}
        WHERE id = ANY(${allCashTransactionIds})
      `;
    }

    // Mark all paid trips as payroll_processed in the appointments table
    const allPaidTripIds = earningsData.drivers
      .flatMap((d) => d.trips || [])
      .filter((t) => t.paid)
      .map((t) => t.id);

    if (allPaidTripIds.length > 0) {
      await sql`
        UPDATE appointments
        SET payroll_processed = true
        WHERE id = ANY(${allPaidTripIds})
      `;
    }

    return Response.json({
      success: true,
      message:
        "Payroll submitted to ADP successfully using approved timesheet snapshots",
      adpResponse: adpResult,
      summary: {
        totalDrivers: earningsData.drivers.length,
        totalCompensation: earningsData.summary.total_compensation.toFixed(2),
        startDate,
        endDate,
        dataSource: "approved_timesheets",
      },
    });
  } catch (error) {
    console.error("ADP payroll submission error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to submit payroll to ADP",
      },
      { status: 500 },
    );
  }
}

// The getDriverEarnings function has been removed.
// ADP payroll now uses the canonical /api/earnings endpoint
// to ensure data always matches the earnings/timesheet report.

// GET: Fetch payroll submission history
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit")) || 20;

    const submissions = await sql`
      SELECT 
        id,
        start_date,
        end_date,
        driver_count,
        total_compensation,
        submitted_at,
        adp_response
      FROM payroll_submissions
      WHERE tenant_id = 1
      ORDER BY submitted_at DESC
      LIMIT ${limit}
    `;

    return Response.json({
      success: true,
      submissions: submissions.map((s) => ({
        id: s.id,
        startDate: s.start_date,
        endDate: s.end_date,
        driverCount: s.driver_count,
        totalCompensation: Number(s.total_compensation),
        submittedAt: s.submitted_at,
        status: s.adp_response?.status || "submitted",
      })),
    });
  } catch (error) {
    console.error("Error fetching payroll history:", error);
    return Response.json(
      { success: false, error: "Failed to fetch payroll history" },
      { status: 500 },
    );
  }
}
