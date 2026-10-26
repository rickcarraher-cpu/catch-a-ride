import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  const { trip_id } = params;

  try {
    const payments = await sql`
      SELECT * FROM payments
      WHERE appointment_id = ${trip_id}
      ORDER BY created_at DESC
    `;

    const [trip] = await sql`
      SELECT id, booking_number, payment_status, payment_method, payment_amount, payment_date
      FROM appointments
      WHERE id = ${trip_id}
    `;

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const activePayment =
      payments.find((p) =>
        ["pending", "link_created", "manual_pending"].includes(p.status),
      ) || payments[0];

    return Response.json({
      trip: {
        id: trip.id,
        booking_number: trip.booking_number,
        payment_status: trip.payment_status,
        payment_method: trip.payment_method,
        payment_amount: trip.payment_amount,
        payment_date: trip.payment_date,
      },
      payments,
      activePayment,
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return Response.json(
      { error: "Failed to fetch payment status" },
      { status: 500 },
    );
  }
}
