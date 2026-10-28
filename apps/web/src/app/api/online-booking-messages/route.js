import sql from "@/app/api/utils/sql";

/**
 * GET /api/online-booking-messages
 * Returns unread messages from online booking passengers
 *
 * A message is considered "from online booking" if:
 * - It's inbound
 * - metadata.from_booking_form = true OR is_urgent = true OR provider = 'BookingForm'
 * - It hasn't been acknowledged yet
 */
export async function GET(request) {
  try {
    // Get all unread online booking messages
    // These are messages that came from the online booking form
    // They can be identified by:
    // 1. metadata->>'from_booking_form' = 'true' OR
    // 2. is_urgent = true (urgent messages from booking form) OR
    // 3. provider = 'BookingForm'
    const messages = await sql`
      SELECT 
        sm.id,
        sm.message,
        sm.sender_name,
        sm.phone,
        sm.sent_at,
        sm.client_id,
        sm.is_urgent,
        c.name AS client_name,
        c.email AS client_email,
        c.phone AS client_phone
      FROM sms_messages sm
      LEFT JOIN clients c ON sm.client_id = c.id
      WHERE sm.direction = 'inbound'
        AND sm.read_at IS NULL
        AND (
          sm.metadata->>'from_booking_form' = 'true'
          OR sm.is_urgent = true
          OR sm.provider = 'BookingForm'
        )
      ORDER BY sm.sent_at DESC
    `;

    return Response.json({ messages });
  } catch (error) {
    console.error("[Online Booking Messages] Error:", error);
    return Response.json(
      { error: "Failed to fetch online booking messages" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/online-booking-messages
 * Mark a message as read
 *
 * Body: { id: number }
 */
export async function POST(request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return Response.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    // Mark the message as read
    await sql`
      UPDATE sms_messages
      SET read_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[Online Booking Messages] Error marking as read:", error);
    return Response.json(
      { error: "Failed to mark message as read" },
      { status: 500 },
    );
  }
}
