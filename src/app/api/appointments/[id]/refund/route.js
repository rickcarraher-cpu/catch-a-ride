import sql from "@/app/api/utils/sql";
import { sendNotification } from "@/app/api/utils/notifications";
import { getTodayInCDT } from "@/utils/timezone";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { amount, reason, refund_method, refunded_by } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return Response.json(
        { error: "Valid refund amount is required" },
        { status: 400 },
      );
    }

    // Fetch the appointment with driver info
    const [appt] = await sql`
      SELECT 
        a.*,
        e.name as driver_name,
        e.salary_rate,
        c.name as client_name
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${id}
    `;

    if (!appt) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    const refundAmount = Number(amount);
    const originalPayment = Number(appt.payment_amount) || 0;

    if (refundAmount > originalPayment) {
      return Response.json(
        {
          error: `Refund amount ($${refundAmount.toFixed(2)}) cannot exceed original payment ($${originalPayment.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    const today = getTodayInCDT();
    const isFullRefund = refundAmount >= originalPayment;

    // 1. Create a refund transaction (negative payment)
    await sql`
      INSERT INTO transactions (
        tenant_id, appointment_id, category, method, amount, tip_amount,
        description, transaction_date, employee_id
      ) VALUES (
        1,
        ${id},
        'refund',
        ${refund_method || appt.payment_method || "Cash"},
        ${refundAmount},
        0,
        ${reason || `Refund for Trip #${appt.booking_number || id}${refunded_by ? ` — issued by ${refunded_by}` : ""}`},
        ${today}::date,
        ${appt.employee_id || null}
      )
    `;

    // 2. If driver was assigned, reverse their commission proportionally
    if (appt.employee_id && appt.salary_rate) {
      const commissionRate = Number(appt.salary_rate);
      const commissionReversal = (refundAmount * commissionRate).toFixed(2);

      await sql`
        INSERT INTO transactions (
          tenant_id, appointment_id, category, method, amount, tip_amount,
          description, transaction_date, employee_id
        ) VALUES (
          1,
          ${id},
          'commission_reversal',
          'Adjustment',
          ${commissionReversal},
          0,
          ${`Commission reversal for refund — ${appt.driver_name || "Driver"} (${Math.round(commissionRate * 100)}%) — Trip #${appt.booking_number || id}`},
          ${today}::date,
          ${appt.employee_id}
        )
      `;
    }

    // 3. Update the appointment payment status
    const newPaymentAmount = Math.max(0, originalPayment - refundAmount);
    const newStatus = isFullRefund ? "refunded" : "partial_refund";

    await sql`
      UPDATE appointments
      SET 
        payment_status = ${newStatus},
        payment_amount = ${newPaymentAmount}
      WHERE id = ${id}
    `;

    // 4. Send refund notification to passenger
    try {
      const [fullAppt] = await sql`
        SELECT a.*, c.name as client_name, c.email as client_email, 
               c.phone as client_phone, c.notification_preference as client_notif_pref,
               c.cc_emails as cc_emails
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.id = ${id}
      `;

      if (fullAppt) {
        await sendNotification({
          type: "refund_processed",
          appointmentId: id,
          appointmentSnapshot: { ...fullAppt, refund_amount: refundAmount },
          tenantId: 1,
        });
      }
    } catch (notifErr) {
      console.error("Failed to send refund notification:", notifErr);
    }

    return Response.json({
      success: true,
      refundAmount,
      newPaymentAmount,
      newStatus,
      isFullRefund,
      message: isFullRefund
        ? `Full refund of $${refundAmount.toFixed(2)} processed`
        : `Partial refund of $${refundAmount.toFixed(2)} processed`,
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return Response.json(
      { error: "Failed to process refund" },
      { status: 500 },
    );
  }
}
