import sql from "@/app/api/utils/sql";

/**
 * GET /api/appointments/recalculate-tips/test-preview?mode=missing|all
 *
 * Shows what would be recalculated on first 10 trips
 * without making any changes - just a preview.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "missing";

    let rows;

    if (mode === "all") {
      // Get ALL paid Square trips (first 10)
      rows = await sql`
        SELECT DISTINCT a.id, a.booking_number, a.payment_status, 
               a.tips_total, a.payments_total, a.balance_due,
               a.original_amount, a.services_total
        FROM appointments a
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND a.payment_status = 'paid'
          AND (
            a.payment_method ILIKE '%square%'
            OR EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.appointment_id = a.id
                AND t.method = 'Square'
            )
          )
        ORDER BY a.id DESC
        LIMIT 10
      `;
    } else {
      // Only trips with tip transactions but tips_total not set (missing mode)
      rows = await sql`
        SELECT DISTINCT a.id, a.booking_number, a.payment_status, 
               a.tips_total, a.payments_total, a.balance_due,
               a.original_amount, a.services_total
        FROM appointments a
        JOIN transactions t ON t.appointment_id = a.id
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND (a.tips_total IS NULL OR a.tips_total = 0)
          AND (
            (t.category = 'tip' AND t.tip_amount > 0)
            OR (t.category = 'payment' AND t.tip_amount > 0)
          )
        ORDER BY a.id DESC
        LIMIT 10
      `;
    }

    if (rows.length === 0) {
      return Response.json({
        success: true,
        total: 0,
        trips: [],
        mode,
        message: `No trips need recalculation in "${mode}" mode.`,
      });
    }

    const preview = [];

    for (const trip of rows) {
      // Get all transactions for this trip
      const transactions = await sql`
        SELECT id, category, method, amount, tip_amount, description
        FROM transactions
        WHERE appointment_id = ${trip.id}
        ORDER BY id
      `;

      // Calculate what the NEW values would be
      let calculatedPaymentsTotal = 0;
      let calculatedTipsTotal = 0;

      for (const txn of transactions) {
        if (txn.category === "payment" || txn.category === "refund") {
          calculatedPaymentsTotal += Number(txn.amount);
          calculatedTipsTotal += Number(txn.tip_amount || 0);
        } else if (txn.category === "tip") {
          calculatedTipsTotal += Number(txn.tip_amount || 0);
        }
      }

      const calculatedBalanceDue =
        Number(trip.original_amount) - calculatedPaymentsTotal;

      preview.push({
        id: trip.id,
        bookingNumber: trip.booking_number,
        current: {
          payment_status: trip.payment_status,
          tips_total: Number(trip.tips_total || 0),
          payments_total: Number(trip.payments_total || 0),
          balance_due: Number(trip.balance_due || 0),
          original_amount: Number(trip.original_amount || 0),
        },
        wouldBecome: {
          tips_total: calculatedTipsTotal,
          payments_total: calculatedPaymentsTotal,
          balance_due: calculatedBalanceDue,
        },
        transactions: transactions.map((t) => ({
          id: t.id,
          category: t.category,
          method: t.method,
          amount: Number(t.amount),
          tip_amount: Number(t.tip_amount || 0),
          description: t.description,
        })),
      });
    }

    return Response.json({
      success: true,
      total: preview.length,
      mode,
      trips: preview,
      message: `Found ${preview.length} trips that would be recalculated in "${mode}" mode.`,
    });
  } catch (err) {
    console.error("[RecalcTips Preview] Error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/appointments/recalculate-tips/test-preview
 *
 * Actually runs the recalculation on the first 10 trips (test subset)
 * Accepts { mode: "missing" | "all" } in request body
 */
export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {}

    const mode = body.mode || "missing";

    const { recalculatePaymentsAndBalance } = await import(
      "@/app/api/utils/cached-calculations"
    );

    let rows;

    if (mode === "all") {
      // Get ALL paid Square trips (first 10)
      rows = await sql`
        SELECT DISTINCT a.id, a.booking_number
        FROM appointments a
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND a.payment_status = 'paid'
          AND (
            a.payment_method ILIKE '%square%'
            OR EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.appointment_id = a.id
                AND t.method = 'Square'
            )
          )
        ORDER BY a.id DESC
        LIMIT 10
      `;
    } else {
      // Only trips with missing tips_total
      rows = await sql`
        SELECT DISTINCT a.id, a.booking_number
        FROM appointments a
        JOIN transactions t ON t.appointment_id = a.id
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND (a.tips_total IS NULL OR a.tips_total = 0)
          AND (
            (t.category = 'tip' AND t.tip_amount > 0)
            OR (t.category = 'payment' AND t.tip_amount > 0)
          )
        ORDER BY a.id DESC
        LIMIT 10
      `;
    }

    if (rows.length === 0) {
      return Response.json({
        success: true,
        total: 0,
        fixed: 0,
        mode,
        message: `No trips needed recalculation in "${mode}" mode.`,
      });
    }

    let fixed = 0;
    let errors = 0;
    const results = [];

    for (const row of rows) {
      try {
        await recalculatePaymentsAndBalance(row.id);
        fixed++;
        results.push({
          id: row.id,
          bookingNumber: row.booking_number,
          status: "success",
        });
      } catch (err) {
        errors++;
        results.push({
          id: row.id,
          bookingNumber: row.booking_number,
          status: "error",
          error: err.message,
        });
        console.error(
          `[RecalcTips Test] Error on trip #${row.id}:`,
          err.message,
        );
      }
    }

    return Response.json({
      success: true,
      total: rows.length,
      fixed,
      errors,
      mode,
      results,
      message: `TEST RUN (${mode} mode): Processed ${fixed} trip(s) successfully. ${errors > 0 ? `${errors} error(s).` : ""}`,
    });
  } catch (err) {
    console.error("[RecalcTips Test] Fatal error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
