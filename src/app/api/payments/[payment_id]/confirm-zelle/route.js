import sql from "@/app/api/utils/sql";
import { markZellePaidManually } from "../../providers/zelle";
import { sendNotification } from "@/app/api/utils/notifications";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";

export async function POST(request, { params }) {
  const { payment_id } = params;
  const body = await request.json();
  const { confirmedBy, note, amount_received, tip_amount } = body;

  if (!confirmedBy) {
    return Response.json({ error: "confirmedBy is required" }, { status: 400 });
  }

  try {
    // Fetch payment
    const [payment] = await sql`
      SELECT * FROM payments
      WHERE id = ${payment_id} AND provider = 'zelle'
    `;

    if (!payment) {
      return Response.json(
        { error: "Zelle payment not found" },
        { status: 404 },
      );
    }

    if (payment.status === "paid") {
      return Response.json(
        { error: "Payment already marked as paid" },
        { status: 400 },
      );
    }

    const baseAmount = Number(payment.amount);
    const receivedAmount = Number(amount_received) || baseAmount;
    const tipAmount = Number(tip_amount) || 0;

    // Mark as paid
    const paidData = await markZellePaidManually({
      paymentId: payment_id,
      confirmedBy,
      note,
    });

    await sql`
      UPDATE payments
      SET status = 'paid',
          paid_at = ${paidData.paid_at},
          manually_confirmed_by = ${paidData.manually_confirmed_by},
          manually_confirmed_at = ${paidData.manually_confirmed_at},
          manual_note = ${paidData.manual_note},
          updated_at = NOW(),
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{payment_details}',
            ${JSON.stringify({
              amount_received: receivedAmount,
              tip_amount: tipAmount,
            })}::jsonb
          )
      WHERE id = ${payment_id}
    `;

    // Update trip with total amount received
    await sql`
      UPDATE appointments
      SET payment_status = 'paid',
          payment_date = ${paidData.paid_at},
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
        'Zelle',
        ${baseAmount},
        ${tipAmount},
        ${tipAmount > 0 ? `Zelle payment confirmed (includes $${tipAmount.toFixed(2)} tip) - Trip #${payment.appointment_id}` : `Zelle payment confirmed - Trip #${payment.appointment_id}`},
        CURRENT_DATE,
        1
      )
    `;

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
            `[confirm-zelle] Commission already exists for trip #${payment.appointment_id}, skipping.`,
          );
        }
      }
    } catch (commissionErr) {
      console.error(
        "[confirm-zelle] Auto-commission creation failed:",
        commissionErr,
      );
    }

    // Create audit event
    await sql`
      INSERT INTO payment_events (payment_id, provider, event_id, event_type, payload)
      VALUES (
        ${payment_id}, 'zelle',
        ${`manual-confirm-${Date.now()}`},
        'manual_confirmation',
        ${JSON.stringify({
          confirmedBy,
          note,
          timestamp: new Date().toISOString(),
          amount_received: receivedAmount,
          tip_amount: tipAmount,
        })}
      )
    `;

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
        "[confirm-zelle] Auto-complete error:",
        autoCompleteErr.message,
      );
    }

    return Response.json({
      success: true,
      message: "Zelle payment marked as paid",
      amount_received: receivedAmount,
      tip_amount: tipAmount,
    });
  } catch (error) {
    console.error("Error confirming Zelle payment:", error);
    return Response.json(
      { error: "Failed to confirm payment" },
      { status: 500 },
    );
  }
}
