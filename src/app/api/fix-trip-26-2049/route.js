import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch current state for trip 26-2049 (appointment ID 20366)
    const [before] = await sql`
      SELECT 
        id, booking_number,
        services_total, original_amount, 
        payments_total, balance_due, 
        cc_fee_amount, tips_total,
        payment_method, payment_status
      FROM appointments
      WHERE id = 20366
    `;

    if (!before) {
      return Response.json(
        { error: "Trip 26-2049 not found" },
        { status: 404 },
      );
    }

    // Get transaction breakdown
    const txns = await sql`
      SELECT id, category, method, amount, tip_amount, description
      FROM transactions
      WHERE appointment_id = 20366
      ORDER BY created_at
    `;

    const paymentTxns = txns.filter((t) => t.category === "payment");
    const ccFeeTxns = txns.filter((t) => t.category === "cc_fee");
    const paymentsTotal = paymentTxns.reduce(
      (sum, t) => sum + Number(t.amount),
      0,
    );
    const ccFeeTotal = ccFeeTxns.reduce((sum, t) => sum + Number(t.amount), 0);

    // The fix:
    // - services_total = $292.50 (Custom $210 + Price Adjustment $82.50) — correct, no change
    // - cc_fee should be Math.ceil(4% × $210 base) = Math.ceil($8.40) = $9
    //   (CC fee is on the base service; adjustment attracts additional cc)
    // - original_amount = $304.50 (services $292.50 + $9 base cc + $3 cc on adjustment)
    // - balance_due = $304.50 - $210 (payments) - $8 (cc_fee txn paid) = $86.50
    const newOriginalAmount = 304.5;
    const newCcFeeAmount = 9.0; // display: Math.ceil(4% × $210 base)
    const newBalanceDue = 86.5; // $304.50 - $210 - $8 cc paid

    await sql`
      UPDATE appointments
      SET 
        original_amount = ${newOriginalAmount},
        cc_fee_amount   = ${newCcFeeAmount},
        balance_due     = ${newBalanceDue}
      WHERE id = 20366
    `;

    // Fetch updated state
    const [after] = await sql`
      SELECT 
        original_amount, cc_fee_amount, balance_due,
        services_total, payments_total, payment_status
      FROM appointments
      WHERE id = 20366
    `;

    return Response.json({
      success: true,
      message: "Trip 26-2049 corrected",
      before: {
        original_amount: before.original_amount,
        cc_fee_amount: before.cc_fee_amount,
        balance_due: before.balance_due,
      },
      after: {
        original_amount: after.original_amount,
        cc_fee_amount: after.cc_fee_amount,
        balance_due: after.balance_due,
      },
      transactions: {
        payments_total: paymentsTotal,
        cc_fee_total: ccFeeTotal,
        txns: txns.map((t) => ({
          id: t.id,
          category: t.category,
          method: t.method,
          amount: Number(t.amount),
          tip_amount: Number(t.tip_amount),
          description: t.description,
        })),
      },
    });
  } catch (error) {
    console.error("[fix-trip-26-2049]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const [trip] = await sql`
      SELECT 
        id, booking_number,
        services_total, original_amount, 
        payments_total, balance_due, 
        cc_fee_amount, tips_total,
        payment_method, payment_status
      FROM appointments WHERE id = 20366
    `;

    const txns = await sql`
      SELECT id, category, method, amount, tip_amount, description
      FROM transactions
      WHERE appointment_id = 20366
      ORDER BY created_at
    `;

    return Response.json({ trip, transactions: txns });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
