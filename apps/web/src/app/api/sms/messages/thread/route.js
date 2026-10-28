import sql from "@/app/api/utils/sql";

/**
 * Get conversation thread - supports both conversation_id and phone lookup
 * GET /api/sms/messages/thread?conversation_id=123
 * GET /api/sms/messages/thread?phone=+1234567890
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get("conversation_id");
    const phone = searchParams.get("phone");

    if (!conversationId && !phone) {
      return Response.json(
        { error: "conversation_id or phone is required" },
        { status: 400 },
      );
    }

    let messages;

    // Prefer conversation_id over phone for accurate group conversation support
    if (conversationId) {
      // DISTINCT ON (m.id) prevents JOIN fanout when multiple clients/employees
      // match the same phone pattern — each message row is returned exactly once.
      const rows = await sql`
        SELECT DISTINCT ON (m.id)
          m.*,
          COALESCE(
            c.name,
            c2.name,
            e.name,
            e2.name
          ) as client_name,
          a.booking_number,
          a.start_time as trip_date
        FROM sms_messages m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN clients c2 ON REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') || '%'
          OR REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') || '%'
        LEFT JOIN employees e ON REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') || '%'
          OR REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') || '%'
        LEFT JOIN appointments a ON m.appointment_id = a.id
        LEFT JOIN employees e2 ON a.employee_id = e2.id
        WHERE m.tenant_id = 1 AND m.conversation_id = ${conversationId}
        ORDER BY m.id
      `;
      // Re-sort by sent_at after deduplication
      messages = rows.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
    } else {
      // Fallback to phone-based lookup for backward compatibility
      const rows = await sql`
        SELECT DISTINCT ON (m.id)
          m.*,
          COALESCE(
            c.name,
            c2.name,
            e.name,
            e2.name
          ) as client_name,
          a.booking_number,
          a.start_time as trip_date
        FROM sms_messages m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN clients c2 ON REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') || '%'
          OR REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') || '%'
        LEFT JOIN employees e ON REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') || '%'
          OR REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') || '%'
        LEFT JOIN appointments a ON m.appointment_id = a.id
        LEFT JOIN employees e2 ON a.employee_id = e2.id
        WHERE m.tenant_id = 1 AND m.phone = ${phone}
        ORDER BY m.id
      `;
      // Re-sort by sent_at after deduplication
      messages = rows.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
    }

    return Response.json({ messages });
  } catch (error) {
    console.error("[SMS Thread] Error fetching thread:", error);
    return Response.json(
      { error: "Failed to fetch conversation thread" },
      { status: 500 },
    );
  }
}

/**
 * Delete entire conversation thread for a specific phone number
 * DELETE /api/sms/messages/thread
 * Body: { phone: "+1234567890" }
 */
export async function DELETE(request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return Response.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    const result = await sql`
      DELETE FROM sms_messages
      WHERE tenant_id = 1 AND phone = ${phone}
    `;

    console.log(`[SMS Thread] Deleted all messages for phone: ${phone}`);

    return Response.json({
      success: true,
      deleted: result.count || 0,
    });
  } catch (error) {
    console.error("[SMS Thread] Error deleting thread:", error);
    return Response.json(
      { error: "Failed to delete conversation thread" },
      { status: 500 },
    );
  }
}
