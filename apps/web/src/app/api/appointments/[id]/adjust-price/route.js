import sql from "@/app/api/utils/sql";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";

/**
 * POST /api/appointments/:id/adjust-price
 *
 * Adjusts the initial quote (original_amount) by a given amount.
 * Creates a "Price Adjustment" transaction to track the change.
 * Recalculates CC fee if payment method is card-based.
 * Recalculates balance_due.
 */
export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { adjustment_amount, reason } = body;

    if (!adjustment_amount || isNaN(adjustment_amount)) {
      return Response.json(
        { error: "adjustment_amount is required and must be a number" },
        { status: 400 },
      );
    }

    const adjustmentAmount = Number(adjustment_amount);

    // Get current trip data including payment method
    const [trip] = await sql`
      SELECT id, original_amount, services_total, balance_due, payment_method, cc_fee_amount
      FROM appointments 
      WHERE id = ${id}
    `;

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const currentServicesTotal = Number(trip.services_total || 0);
    const newServicesTotal = currentServicesTotal + adjustmentAmount;

    // Don't allow adjustments that would make services_total negative
    if (newServicesTotal < 0) {
      return Response.json(
        {
          error: `Adjustment of $${adjustmentAmount.toFixed(2)} would result in negative services total ($${newServicesTotal.toFixed(2)}). Maximum discount: $${currentServicesTotal.toFixed(2)}`,
        },
        { status: 400 },
      );
    }

    console.log(
      `[Adjust Price] Trip #${id}: services_total $${currentServicesTotal} → $${newServicesTotal} (${adjustmentAmount >= 0 ? "+" : ""}$${adjustmentAmount.toFixed(2)})`,
    );

    // Recalculate CC fee if payment method is card-based
    const cardMethods = ["Credit Card", "Square", "Square Invoice"];
    const isCardPayment = cardMethods.includes(trip.payment_method || "");

    let newCcFee = 0;
    if (isCardPayment && newServicesTotal > 0) {
      const [feeSetting] = await sql`
        SELECT value FROM settings 
        WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
      `;
      const feePercent = feeSetting?.value ? Number(feeSetting.value) : 4;
      newCcFee = Math.round((newServicesTotal * feePercent) / 100);
      console.log(
        `[Adjust Price] Trip #${id}: Recalculating CC fee (${feePercent}% of $${newServicesTotal}): $${newCcFee}`,
      );
    }

    const newOriginalAmount = newServicesTotal + newCcFee;

    // Update services_total, cc_fee_amount, and original_amount
    await sql`
      UPDATE appointments
      SET 
        services_total = ${newServicesTotal},
        cc_fee_amount = ${newCcFee},
        original_amount = ${newOriginalAmount}
      WHERE id = ${id}
    `;

    // Create a Price Adjustment transaction to track this change
    await sql`
      INSERT INTO transactions (
        appointment_id,
        category,
        method,
        amount,
        tip_amount,
        description,
        transaction_date
      ) VALUES (
        ${id},
        'adjustment',
        'Price Adjustment',
        ${adjustmentAmount},
        0,
        ${null},
        CURRENT_DATE
      )
    `;

    // Clean up any legacy price adjustment text that was previously written to notes fields
    try {
      await sql`
        UPDATE appointments
        SET notes = TRIM(
          REGEXP_REPLACE(notes, '(^|\\n)[^\\n]*Price Adjustment:[^\\n]*(\\n|$)', E'\\n', 'g')
        )
        WHERE notes LIKE '%Price Adjustment:%'
      `;
    } catch (cleanupErr) {
      console.error(
        "[Adjust Price] Failed to cleanup legacy notes:",
        cleanupErr.message,
      );
    }

    // Recalculate balance_due
    const result = await recalculatePaymentsAndBalance(id);

    console.log(
      `[Adjust Price] Trip #${id}: New breakdown: services=$${newServicesTotal}, CC fee=$${newCcFee}, total=$${newOriginalAmount}, balance_due=$${result.balance_due.toFixed(2)}`,
    );

    return Response.json({
      success: true,
      services_total: newServicesTotal,
      cc_fee_amount: newCcFee,
      original_amount: newOriginalAmount,
      total: newOriginalAmount,
      balance_due: result.balance_due,
      adjustment: adjustmentAmount,
    });
  } catch (error) {
    console.error("[Adjust Price] Error:", error);
    return Response.json(
      { error: error.message || "Failed to adjust price" },
      { status: 500 },
    );
  }
}
