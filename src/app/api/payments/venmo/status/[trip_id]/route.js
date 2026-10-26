import sql from "@/app/api/utils/sql";

/**
 * GET /api/payments/venmo/status/:trip_id
 * Check Venmo payment status for a trip
 */
export async function GET(request, { params }) {
  try {
    const { trip_id } = params;

    const payments = await sql`
      SELECT id, status, amount, payment_url, paid_at, created_at, metadata
      FROM payments
      WHERE appointment_id = ${trip_id}
      AND provider = 'venmo'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (payments.length === 0) {
      return Response.json({
        trip_id: Number(trip_id),
        payment_status: "unpaid",
        payment_url: null,
        amount: null,
      });
    }

    const payment = payments[0];
    const metadata =
      typeof payment.metadata === "string"
        ? JSON.parse(payment.metadata)
        : payment.metadata;

    return Response.json({
      trip_id: Number(trip_id),
      payment_id: payment.id,
      payment_status: payment.status,
      payment_url: payment.payment_url,
      venmo_app_url: metadata?.venmo_app_url,
      venmo_handle: metadata?.venmo_handle,
      amount: payment.amount,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
    });
  } catch (error) {
    console.error("Failed to get Venmo payment status:", error);
    return Response.json(
      { error: "Failed to get payment status" },
      { status: 500 },
    );
  }
}
