import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const alerts = await sql`
      SELECT * FROM cancellation_alerts
      WHERE tenant_id = 1
      AND read_at IS NULL
      ORDER BY created_at DESC
    `;
    return Response.json({ alerts });
  } catch (err) {
    console.error("[cancellation-alerts] GET error:", err);
    return Response.json({ alerts: [] });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      appointment_id,
      booking_number,
      passenger_name,
      driver_name,
      cancellation_reason,
      trip_date,
    } = body;

    const [alert] = await sql`
      INSERT INTO cancellation_alerts (
        tenant_id, appointment_id, booking_number, passenger_name,
        driver_name, cancellation_reason, trip_date
      ) VALUES (
        1, ${appointment_id}, ${booking_number}, ${passenger_name},
        ${driver_name || null}, ${cancellation_reason || null}, ${trip_date || null}
      )
      RETURNING *
    `;

    return Response.json({ alert });
  } catch (err) {
    console.error("[cancellation-alerts] POST error:", err);
    return Response.json({ error: "Failed to create alert" }, { status: 500 });
  }
}
