import sql from "@/app/api/utils/sql";
import { sendNotification } from "@/app/api/utils/notifications";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";

/**
 * POST /api/payments/:payment_id/confirm-venmo
 * Manually confirm a Venmo payment (admin marks as paid)
 * Now includes tip calculation and transaction creation
 */
export async function POST(request, { params }) {
  try {
    const { payment_id } = params;
    const body = await request.json();
    const { confirmed_by, note, amount_received, tip_amount } = body;

    // Get payment details
    const [payment] = await sql`
      SELECT * FROM payments
      WHERE id = ${payment_id}
      AND provider = 'venmo'
    `;

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "paid") {
      return Response.json({
        message: "Payment already confirmed",
        payment,
      });
    }

    const baseAmount = Number(payment.amount);
    const receivedAmount = Number(amount_received) || baseAmount;
    const tipAmount = Number(tip_amount) || 0;

    // Update payment to paid status
    const [updatedPayment] = await sql`
      UPDATE payments
      SET 
        status = 'paid',
        paid_at = CURRENT_TIMESTAMP,
        manually_confirmed_by = ${confirmed_by || "Admin"},
        manually_confirmed_at = CURRENT_TIMESTAMP,
        manual_note = ${note || null},
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{manual_confirmation}',
          ${JSON.stringify({
            confirmed_by: confirmed_by || "Admin",
            confirmed_at: new Date().toISOString(),
            note: note || null,
            amount_received: receivedAmount,
            tip_amount: tipAmount,
          })}::jsonb
        )
      WHERE id = ${payment_id}
      RETURNING *
    `;

    // Update appointment payment status
    await sql`
      UPDATE appointments
      SET 
        payment_status = 'paid',
        payment_date = CURRENT_TIMESTAMP,
        payment_amount = ${receivedAmount}
      WHERE id = ${payment.appointment_id}
    `;

    // Create transaction record for payment with tip
    await sql`
      INSERT INTO transactions (
        appointment_id,
        category,
        method,
        amount,
        tip_amount,
        description,
        transaction_date,
        tenant_id
      ) VALUES (
        ${payment.appointment_id},
        'payment',
        'Venmo',
        ${baseAmount},
        ${tipAmount},
        ${tipAmount > 0 ? `Venmo payment confirmed (includes $${tipAmount.toFixed(2)} tip) - Trip #${payment.appointment_id}` : `Venmo payment confirmed - Trip #${payment.appointment_id}`},
        CURRENT_DATE,
        1
      )
    `;

    // ✅ Recalculate cached payment totals so payments_total and tips_total are updated
    try {
      await recalculatePaymentsAndBalance(payment.appointment_id);
    } catch (calcErr) {
      console.error(
        "[confirm-venmo] Failed to recalculate payment totals:",
        calcErr,
      );
    }

    // Auto-create driver commission expense — same pattern as POST /api/transactions
    try {
      const [appt] = await sql`
        SELECT a.employee_id, a.booking_number, e.name as employee_name, e.salary_rate
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ${payment.appointment_id}
      `;

      if (appt?.employee_id && appt?.salary_rate) {
        const existingCommission = await sql`
          SELECT id FROM transactions
          WHERE appointment_id = ${payment.appointment_id}
            AND category = 'expense'
            AND method = 'Commission'
          LIMIT 1
        `;

        if (existingCommission.length === 0) {
          const [servicesRow] = await sql`
            SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
            FROM appointment_services
            WHERE appointment_id = ${payment.appointment_id}
          `;
          const servicesTotal = Number(servicesRow?.services_total || 0);
          const commissionBase = servicesTotal > 0 ? servicesTotal : baseAmount;
          const commissionAmount = (
            commissionBase * Number(appt.salary_rate)
          ).toFixed(2);
          const tripRef = appt.booking_number || `#${payment.appointment_id}`;
          const expenseDesc = `Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`;

          await sql`
            INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
            VALUES (1, ${payment.appointment_id}, 'expense', 'Commission', ${commissionAmount}, 0, ${expenseDesc}, CURRENT_DATE, ${appt.employee_id})
          `;
        } else {
          console.log(
            `[confirm-venmo] Commission already exists for trip #${payment.appointment_id}, skipping.`,
          );
        }
      }
    } catch (commissionErr) {
      console.error(
        "[confirm-venmo] Auto-commission creation failed:",
        commissionErr,
      );
    }

    // Send payment confirmation notification
    try {
      await sendNotification({
        type: "payment_confirmed",
        appointmentId: payment.appointment_id,
        tenantId: 1,
      });
    } catch (notifErr) {
      console.error(
        "Failed to send payment confirmation notification:",
        notifErr,
      );
    }

    // ✅ NEW: Auto-complete trip if date has passed
    try {
      await autoCompleteIfEligible(payment.appointment_id);
    } catch (autoCompleteErr) {
      console.error(
        "[confirm-venmo] Auto-complete error:",
        autoCompleteErr.message,
      );
    }

    return Response.json({
      success: true,
      payment: updatedPayment,
      message: "Venmo payment confirmed successfully",
      amount_received: receivedAmount,
      tip_amount: tipAmount,
    });
  } catch (error) {
    console.error("Failed to confirm Venmo payment:", error);
    return Response.json(
      { error: "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
