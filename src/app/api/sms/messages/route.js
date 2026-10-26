import sql from "@/app/api/utils/sql";

/**
 * Normalize phone to 10 digits for matching
 * Strips +1 country code and non-digit characters
 */
function normalizePhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Get all SMS messages (inbox view)
 * GET /api/sms/messages
 * Query params: ?unread_only=true
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "5000", 10),
      10000,
    );

    let messages;
    if (unreadOnly) {
      messages = await sql`
        SELECT DISTINCT ON (m.id)
          m.*,
          COALESCE(
            c.name,
            c2.name,
            e.name,
            e2.name
          ) as client_name,
          c.email as client_email,
          a.booking_number,
          a.start_time as trip_date
        FROM sms_messages m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN LATERAL (
          SELECT c2.name FROM clients c2
          WHERE m.client_id IS NULL
            AND c2.phone IS NOT NULL
            AND REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') != ''
            AND RIGHT(REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g'), 10)
          LIMIT 1
        ) c2 ON true
        LEFT JOIN LATERAL (
          SELECT e.name FROM employees e
          WHERE m.client_id IS NULL
            AND c2.name IS NULL
            AND e.phone IS NOT NULL
            AND REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') != ''
            AND RIGHT(REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g'), 10)
          LIMIT 1
        ) e ON true
        LEFT JOIN appointments a ON m.appointment_id = a.id
        LEFT JOIN employees e2 ON a.employee_id = e2.id
        WHERE m.tenant_id = 1 
          AND m.direction = 'inbound'
          AND m.read_at IS NULL
          AND m.sent_at >= NOW() - INTERVAL '30 days'
        ORDER BY m.id, m.sent_at DESC
      `;
    } else {
      messages = await sql`
        SELECT DISTINCT ON (m.id)
          m.*,
          COALESCE(
            c.name,
            c2.name,
            e.name,
            e2.name
          ) as client_name,
          c.email as client_email,
          a.booking_number,
          a.start_time as trip_date
        FROM sms_messages m
        LEFT JOIN clients c ON m.client_id = c.id
        LEFT JOIN LATERAL (
          SELECT c2.name FROM clients c2
          WHERE m.client_id IS NULL
            AND c2.phone IS NOT NULL
            AND REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g') != ''
            AND RIGHT(REGEXP_REPLACE(c2.phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g'), 10)
          LIMIT 1
        ) c2 ON true
        LEFT JOIN LATERAL (
          SELECT e.name FROM employees e
          WHERE m.client_id IS NULL
            AND c2.name IS NULL
            AND e.phone IS NOT NULL
            AND REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') != ''
            AND RIGHT(REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(m.phone, '[^0-9]', '', 'g'), 10)
          LIMIT 1
        ) e ON true
        LEFT JOIN appointments a ON m.appointment_id = a.id
        LEFT JOIN employees e2 ON a.employee_id = e2.id
        WHERE m.tenant_id = 1
          AND m.sent_at >= NOW() - INTERVAL '30 days'
        ORDER BY m.id, m.sent_at DESC
        LIMIT ${limit}
      `;
    }

    // Re-sort by sent_at descending since DISTINCT ON requires ordering by m.id first
    messages.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

    return Response.json({ messages });
  } catch (error) {
    console.error("[SMS Messages] Error fetching messages:", error);
    return Response.json(
      { error: "Failed to fetch messages" },
      { status: 500 },
    );
  }
}
