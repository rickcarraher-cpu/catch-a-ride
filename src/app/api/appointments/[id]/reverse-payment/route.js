import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const apptId = parseInt(id);

    if (!apptId || isNaN(apptId)) {
      return Response.json(
        { error: "Invalid appointment ID" },
        { status: 400 },
      );
    }

    // Verify appointment exists
    const [appt] = await sql`
      SELECT id, payment_status FROM appointments WHERE id = ${apptId} AND tenant_id = 1
    `;

    if (!appt) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Delete all payment, tip, and cc_fee transactions
    await sql`
      DELETE FROM transactions
      WHERE appointment_id = ${apptId}
        AND tenant_id = 1
        AND category IN ('payment', 'tip', 'cc_fee')
    `;

    // Delete auto-created commission expense transactions
    await sql`
      DELETE FROM transactions
      WHERE appointment_id = ${apptId}
        AND tenant_id = 1
        AND category = 'expense'
        AND method = 'Commission'
    `;

    // Delete from payments table
    await sql`
      DELETE FROM payments
      WHERE appointment_id = ${apptId}
    `;

    // Reset appointment payment fields to unpaid
    await sql`
      UPDATE appointments
      SET
        payment_status = 'unpaid',
        payment_amount = 0,
        payment_date = NULL,
        payment_method = NULL,
        square_payment_id = NULL,
        square_checkout_id = NULL
      WHERE id = ${apptId}
        AND tenant_id = 1
    `;

    return Response.json({
      success: true,
      message: "Payment reversed successfully",
    });
  } catch (error) {
    console.error("Error reversing payment:", error);
    return Response.json(
      { error: "Failed to reverse payment" },
      { status: 500 },
    );
  }
}
