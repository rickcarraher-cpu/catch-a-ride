import sql from "@/app/api/utils/sql";

/**
 * Write-off small balances endpoint:
 * Finds all trips on or before a cutoff date where balance_due is between $0.01 and a threshold (default $9)
 * Creates a write-off transaction and marks the trip as paid.
 *
 * GET /api/appointments/write-off-small-balances?threshold=9&cutoffDate=2026-10-13
 * POST /api/appointments/write-off-small-balances  { threshold, cutoffDate }
 */

function getDefaultCutoff() {
  // Default to today in US Central time
  const now = new Date();
  const central = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Chicago" }),
  );
  const y = central.getFullYear();
  const m = String(central.getMonth() + 1).padStart(2, "0");
  const d = String(central.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawThreshold = searchParams.get("threshold") || "9";
    const threshold = parseFloat(rawThreshold);
    const cutoffDate = searchParams.get("cutoffDate") || getDefaultCutoff();

    if (isNaN(threshold) || threshold <= 0) {
      return Response.json(
        { error: "Invalid threshold value" },
        { status: 400 },
      );
    }

    const rows = await sql(
      `SELECT 
        a.id,
        a.booking_number,
        a.payment_status,
        a.balance_due,
        a.payments_total,
        a.original_amount,
        a.start_time,
        c.name as client_name
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.start_time < ($1::date + INTERVAL '1 day')
        AND COALESCE(a.balance_due, 0) > 0
        AND COALESCE(a.balance_due, 0) <= $2
        AND COALESCE(a.status, '') != 'cancelled'
      ORDER BY a.start_time DESC`,
      [cutoffDate, threshold],
    );

    return Response.json({
      message: `Found ${rows.length} trip(s) with balance due between $0.01 and $${threshold.toFixed(2)} on or before ${cutoffDate}`,
      trips: rows,
      threshold,
      cutoffDate,
    });
  } catch (error) {
    console.error("[write-off-small-balances] GET error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const threshold = parseFloat(body.threshold || "9");
    const cutoffDate = body.cutoffDate || getDefaultCutoff();

    if (isNaN(threshold) || threshold <= 0) {
      return Response.json(
        { error: "Invalid threshold value" },
        { status: 400 },
      );
    }

    // Get affected trips first for the audit log
    const affected = await sql(
      `SELECT 
        a.id,
        a.booking_number,
        a.balance_due,
        a.original_amount,
        a.payments_total,
        a.start_time,
        c.name as client_name
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      WHERE a.start_time < ($1::date + INTERVAL '1 day')
        AND COALESCE(a.balance_due, 0) > 0
        AND COALESCE(a.balance_due, 0) <= $2
        AND COALESCE(a.status, '') != 'cancelled'
      ORDER BY a.start_time DESC`,
      [cutoffDate, threshold],
    );

    if (affected.length === 0) {
      return Response.json({
        success: true,
        adjusted: 0,
        message: "No trips needed adjustment — all clear!",
        trips: [],
      });
    }

    const adjustedTrips = [];

    for (const trip of affected) {
      const writeOffAmount = Number(trip.balance_due);
      const description =
        "Small balance write-off (under $" + threshold.toFixed(2) + ")";

      // Create write-off transaction
      await sql(
        `INSERT INTO transactions (
          appointment_id,
          category,
          method,
          amount,
          description,
          transaction_date
        ) VALUES ($1, 'payment', 'Write-off', $2, $3, CURRENT_DATE)`,
        [trip.id, writeOffAmount, description],
      );

      // Update trip: set balance to 0 and mark as paid
      const newPaymentsTotal =
        Number(trip.payments_total || 0) + writeOffAmount;

      await sql(
        `UPDATE appointments
        SET 
          payments_total = $1,
          balance_due = 0,
          payment_status = 'paid',
          payment_date = CURRENT_TIMESTAMP
        WHERE id = $2`,
        [newPaymentsTotal, trip.id],
      );

      adjustedTrips.push({
        id: trip.id,
        booking_number: trip.booking_number,
        client_name: trip.client_name,
        write_off_amount: writeOffAmount,
        start_time: trip.start_time,
      });
    }

    console.log(
      "[write-off-small-balances] Adjusted " +
        adjustedTrips.length +
        " trip(s)",
    );

    return Response.json({
      success: true,
      adjusted: adjustedTrips.length,
      message:
        "Successfully wrote off " +
        adjustedTrips.length +
        " trip(s) with small balances.",
      trips: adjustedTrips,
      threshold,
    });
  } catch (error) {
    console.error("[write-off-small-balances] POST error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
