import sql from "@/app/api/utils/sql";

// GET — return all unread alerts
export async function GET(request) {
  try {
    const alerts = await sql`
      SELECT id, appointment_id, booking_number, passenger_name, cancellation_reason, trip_date, driver_name, is_read, created_at
      FROM passenger_cancellation_alerts
      WHERE is_read = false
      ORDER BY created_at DESC
    `;
    return Response.json({ alerts });
  } catch (error) {
    console.error("Error fetching cancellation alerts:", error);
    return Response.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

// POST — mark an alert as read
export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "Alert ID required" }, { status: 400 });
    }

    await sql`
      UPDATE passenger_cancellation_alerts
      SET is_read = true
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error marking alert as read:", error);
    return Response.json(
      { error: "Failed to mark alert as read" },
      { status: 500 },
    );
  }
}
