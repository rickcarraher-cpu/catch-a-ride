import sql from "@/app/api/utils/sql";

// POST /api/weddings/[id]/payment - Mark wedding as paid and update all trips
export async function POST(request, { params }) {
  try {
    const { id: weddingId } = params;
    const body = await request.json();
    const { payment_method, amount, payment_date } = body;

    if (!payment_method) {
      return Response.json(
        { error: "payment_method is required" },
        { status: 400 },
      );
    }

    const paymentDateValue = payment_date || new Date().toISOString();
    const amountValue = amount || 0;

    // Update the wedding payment status
    await sql`
      UPDATE weddings
      SET 
        payment_status = 'paid',
        payment_method = ${payment_method},
        payment_date = ${paymentDateValue},
        package_price = ${amountValue}
      WHERE id = ${weddingId}
    `;

    // Get all trips for this wedding
    const trips = await sql`
      SELECT 
        a.id,
        a.services_total,
        a.employee_id,
        e.salary_rate
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.wedding_id = ${weddingId}
    `;

    // Mark all trips as paid and create transactions
    for (const trip of trips) {
      // Update trip payment status
      await sql`
        UPDATE appointments
        SET 
          payment_status = 'paid',
          payment_method = ${payment_method},
          payment_date = ${paymentDateValue},
          payment_amount = ${trip.services_total || 0}
        WHERE id = ${trip.id}
      `;

      // Create payment transaction for the trip
      await sql`
        INSERT INTO transactions (
          appointment_id,
          category,
          method,
          amount,
          description,
          transaction_date
        ) VALUES (
          ${trip.id},
          'payment',
          ${payment_method},
          ${trip.services_total || 0},
          'Wedding package payment',
          ${paymentDateValue}
        )
      `;

      // Pay driver commission if there's a driver
      if (trip.employee_id && trip.services_total > 0) {
        const commission =
          Number(trip.services_total) * Number(trip.salary_rate || 0.75);

        // Mark driver as paid
        await sql`
          UPDATE appointments
          SET 
            driver_paid = true,
            driver_paid_at = ${paymentDateValue},
            driver_paid_by = 'Wedding Payment',
            driver_commission = ${commission}
          WHERE id = ${trip.id}
        `;
      }
    }

    return Response.json({
      success: true,
      trips_updated: trips.length,
    });
  } catch (error) {
    console.error("Error processing wedding payment:", error);
    return Response.json(
      { error: "Failed to process wedding payment" },
      { status: 500 },
    );
  }
}
