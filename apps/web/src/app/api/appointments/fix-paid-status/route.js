import sql from "@/app/api/utils/sql";
import { recalculateAllCachedFields } from "@/app/api/utils/cached-calculations";

/**
 * Fix trips where the passenger's money was received in full but the trip
 * was never marked 'paid' — typically Venmo trips where the gas-fee portion
 * was recorded as a tip, which the old balance math ignored.
 *
 * GET  /api/appointments/fix-paid-status  → preview affected trips
 * POST /api/appointments/fix-paid-status  → recalculate each trip using the
 *                                           canonical cached-field logic,
 *                                           flip to 'paid', and supersede
 *                                           stale payment links.
 */

async function findAffectedTrips() {
  // Mirrors recalculatePaymentsAndBalance: tips count as money received when
  // settling a remaining fare balance. A trip qualifies when the new balance
  // would be <= 0, money was actually received, and it isn't already paid.
  return await sql`
    WITH txn AS (
      SELECT appointment_id,
        COALESCE(SUM(CASE WHEN category = 'payment' THEN amount ELSE 0 END), 0) AS payments,
        COALESCE(SUM(CASE WHEN category = 'cc_fee' THEN amount ELSE 0 END), 0) AS cc_fees
      FROM transactions
      WHERE appointment_id IS NOT NULL
      GROUP BY appointment_id
    ),
    sep_tips AS (
      SELECT appointment_id, COALESCE(SUM(COALESCE(tip_amount, 0)), 0) AS tips
      FROM transactions
      WHERE category = 'tip' AND appointment_id IS NOT NULL
      GROUP BY appointment_id
    ),
    pay_tips AS (
      SELECT appointment_id, COALESCE(SUM(COALESCE(tip_amount, 0)), 0) AS tips
      FROM transactions
      WHERE category = 'payment' AND appointment_id IS NOT NULL
      GROUP BY appointment_id
    )
    SELECT a.id, a.booking_number, a.payment_status, a.original_amount,
      a.payments_total, a.tips_total, a.balance_due, a.start_time,
      t.payments, t.cc_fees,
      (COALESCE(pt.tips, 0) + COALESCE(st.tips, 0)) AS tip_total,
      (t.payments + t.cc_fees + COALESCE(pt.tips, 0) + COALESCE(st.tips, 0)) AS total_received,
      c.name AS client_name
    FROM appointments a
    JOIN txn t ON t.appointment_id = a.id
    LEFT JOIN sep_tips st ON st.appointment_id = a.id
    LEFT JOIN pay_tips pt ON pt.appointment_id = a.id
    LEFT JOIN clients c ON c.id = a.client_id
    WHERE LOWER(COALESCE(a.status, '')) NOT IN ('deleted', 'cancelled')
      AND COALESCE(a.payment_status, '') NOT IN ('paid', 'partial_refund')
      AND t.payments > 0
      AND (COALESCE(a.original_amount, 0) - t.payments - t.cc_fees)
            <= (COALESCE(pt.tips, 0) + COALESCE(st.tips, 0))
    ORDER BY a.start_time DESC
  `;
}

export async function GET(request) {
  try {
    const trips = await findAffectedTrips();
    return Response.json({
      message: `Found ${trips.length} trip(s) where payment was received in full but the trip is not marked paid.`,
      trips,
    });
  } catch (error) {
    console.error("[fix-paid-status] GET error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const affected = await findAffectedTrips();

    if (affected.length === 0) {
      return Response.json({
        success: true,
        fixed: 0,
        message: "No trips needed fixing — all clear!",
        trips: [],
      });
    }

    const fixedTrips = [];

    for (const trip of affected) {
      // Run the canonical recalculation (services_total, commission,
      // payments_total, tips_total, balance_due, payment_status, display fields)
      const result = await recalculateAllCachedFields(trip.id);

      // Supersede any stale active payment links — the trip is settled.
      await sql`
        UPDATE payments
        SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
        WHERE appointment_id = ${trip.id}
          AND status IN ('pending', 'link_created', 'manual_pending')
      `;

      fixedTrips.push({
        id: trip.id,
        booking_number: trip.booking_number,
        client_name: trip.client_name,
        old_status: trip.payment_status,
        new_status: "paid",
        old_balance: Number(trip.balance_due || 0),
        new_balance: Number(result.balance_due || 0),
        total_received: Number(trip.total_received || 0),
      });
    }

    console.log(
      `[fix-paid-status] Fixed ${fixedTrips.length} trip(s):`,
      fixedTrips.map((t) => t.booking_number).join(", "),
    );

    return Response.json({
      success: true,
      fixed: fixedTrips.length,
      message: `Successfully marked ${fixedTrips.length} trip(s) as paid.`,
      trips: fixedTrips,
    });
  } catch (error) {
    console.error("[fix-paid-status] POST error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
