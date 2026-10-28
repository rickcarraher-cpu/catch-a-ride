import sql from "@/app/api/utils/sql";

/**
 * GET /api/communication-failures
 * Returns unacknowledged communication failures for the alert popup
 */
export async function GET() {
  try {
    const failures = await sql`
      SELECT id, appointment_id, booking_number, passenger_name, driver_name,
             channel, recipient_type, recipient_address, event_type,
             error_message, trip_date, created_at
      FROM communication_failures
      WHERE is_acknowledged = false
      ORDER BY created_at DESC
      LIMIT 50
    `;

    return Response.json({ failures });
  } catch (error) {
    console.error("[CommunicationFailures] GET error:", error);
    return Response.json(
      { failures: [], error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/communication-failures
 * Two actions:
 *   - { action: 'acknowledge', id: <number> }   — mark a failure as read
 *   - { action: 'record', ...failure data }      — record a new failure (called from backend)
 */
export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === "acknowledge") {
      const { id } = body;
      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400 });
      }

      await sql`
        UPDATE communication_failures
        SET is_acknowledged = true,
            acknowledged_at = NOW(),
            acknowledged_by = ${body.acknowledged_by || "dispatcher"}
        WHERE id = ${id}
      `;

      return Response.json({ success: true });
    }

    if (body.action === "acknowledge_all") {
      await sql`
        UPDATE communication_failures
        SET is_acknowledged = true,
            acknowledged_at = NOW(),
            acknowledged_by = ${body.acknowledged_by || "dispatcher"}
        WHERE is_acknowledged = false
      `;

      return Response.json({ success: true });
    }

    // Default: record a new failure
    const {
      appointment_id,
      booking_number,
      passenger_name,
      driver_name,
      channel,
      recipient_type,
      recipient_address,
      event_type,
      error_message,
      trip_date,
    } = body;

    if (!channel || !recipient_type) {
      return Response.json(
        { error: "channel and recipient_type are required" },
        { status: 400 },
      );
    }

    const [inserted] = await sql`
      INSERT INTO communication_failures
        (appointment_id, booking_number, passenger_name, driver_name,
         channel, recipient_type, recipient_address, event_type,
         error_message, trip_date)
      VALUES
        (${appointment_id || null}, ${booking_number || null}, ${passenger_name || null},
         ${driver_name || null}, ${channel}, ${recipient_type},
         ${recipient_address || null}, ${event_type || null},
         ${error_message || null}, ${trip_date || null})
      RETURNING id
    `;

    return Response.json({ success: true, id: inserted.id });
  } catch (error) {
    console.error("[CommunicationFailures] POST error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
