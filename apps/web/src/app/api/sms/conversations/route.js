import sql from "@/app/api/utils/sql";

/**
 * Get all SMS conversations grouped by conversation_id
 * Includes all participants in each conversation
 * GET /api/sms/conversations
 * Query params: ?unread_only=true
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread_only") === "true";

    let conversations;

    if (unreadOnly) {
      conversations = await sql`
        WITH latest_messages AS (
          SELECT DISTINCT ON (COALESCE(conversation_id::text, phone))
            COALESCE(conversation_id::text, phone) as group_key,
            conversation_id,
            phone,
            id,
            message,
            direction,
            sent_at,
            client_id,
            sender_name
          FROM sms_messages
          WHERE tenant_id = 1
          ORDER BY COALESCE(conversation_id::text, phone), sent_at DESC
        ),
        unread_counts AS (
          SELECT 
            COALESCE(conversation_id::text, phone) as group_key,
            COUNT(*) as unread_count,
            BOOL_OR(is_urgent) as has_urgent_unread
          FROM sms_messages
          WHERE tenant_id = 1 
            AND direction = 'inbound'
            AND read_at IS NULL
          GROUP BY COALESCE(conversation_id::text, phone)
        ),
        conversation_participants_agg AS (
          SELECT 
            conversation_id,
            json_agg(json_build_object(
              'name', name,
              'phone', phone,
              'type', participant_type
            ) ORDER BY participant_type, name) as participants
          FROM conversation_participants
          GROUP BY conversation_id
        )
        SELECT 
          lm.conversation_id,
          lm.phone,
          lm.message as last_message,
          lm.direction as last_direction,
          lm.sent_at as last_sent_at,
          COALESCE(
            c.name,
            (SELECT e.name FROM employees e WHERE REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' AND e.is_active = true ORDER BY e.id DESC LIMIT 1),
            (SELECT cl.name FROM clients cl WHERE REGEXP_REPLACE(cl.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' AND cl.is_active = true ORDER BY cl.id DESC LIMIT 1),
            (SELECT cl2.name FROM clients cl2 WHERE REGEXP_REPLACE(cl2.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' ORDER BY cl2.is_active DESC, cl2.id DESC LIMIT 1),
            lm.sender_name,
            'Unknown'
          ) as client_name,
          COALESCE(
            c.id,
            (SELECT cl3.id FROM clients cl3 WHERE REGEXP_REPLACE(cl3.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' ORDER BY cl3.is_active DESC, cl3.id DESC LIMIT 1)
          ) as client_id,
          c.email as client_email,
          COALESCE(uc.unread_count, 0) as unread_count,
          COALESCE(uc.has_urgent_unread, false) as has_urgent_unread,
          COALESCE(cpa.participants, '[]'::json) as participants,
          a.booking_number
        FROM latest_messages lm
        LEFT JOIN clients c ON lm.client_id = c.id AND (c.is_active = true OR c.is_active IS NULL)
        LEFT JOIN unread_counts uc ON lm.group_key = uc.group_key
        LEFT JOIN conversation_participants_agg cpa ON lm.conversation_id = cpa.conversation_id
        LEFT JOIN conversations conv ON lm.conversation_id = conv.id
        LEFT JOIN appointments a ON conv.appointment_id = a.id
        WHERE uc.unread_count > 0
          AND (c.is_active = true OR c.id IS NULL)
        ORDER BY lm.sent_at DESC
      `;
    } else {
      conversations = await sql`
        WITH latest_messages AS (
          SELECT DISTINCT ON (COALESCE(conversation_id::text, phone))
            COALESCE(conversation_id::text, phone) as group_key,
            conversation_id,
            phone,
            id,
            message,
            direction,
            sent_at,
            client_id,
            sender_name
          FROM sms_messages
          WHERE tenant_id = 1
          ORDER BY COALESCE(conversation_id::text, phone), sent_at DESC
        ),
        unread_counts AS (
          SELECT 
            COALESCE(conversation_id::text, phone) as group_key,
            COUNT(*) as unread_count,
            BOOL_OR(is_urgent) as has_urgent_unread
          FROM sms_messages
          WHERE tenant_id = 1 
            AND direction = 'inbound'
            AND read_at IS NULL
          GROUP BY COALESCE(conversation_id::text, phone)
        ),
        conversation_participants_agg AS (
          SELECT 
            conversation_id,
            json_agg(json_build_object(
              'name', name,
              'phone', phone,
              'type', participant_type
            ) ORDER BY participant_type, name) as participants
          FROM conversation_participants
          GROUP BY conversation_id
        )
        SELECT 
          lm.conversation_id,
          lm.phone,
          lm.message as last_message,
          lm.direction as last_direction,
          lm.sent_at as last_sent_at,
          COALESCE(
            c.name,
            (SELECT e.name FROM employees e WHERE REGEXP_REPLACE(e.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' AND e.is_active = true ORDER BY e.id DESC LIMIT 1),
            (SELECT cl.name FROM clients cl WHERE REGEXP_REPLACE(cl.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' AND cl.is_active = true ORDER BY cl.id DESC LIMIT 1),
            (SELECT cl2.name FROM clients cl2 WHERE REGEXP_REPLACE(cl2.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' ORDER BY cl2.is_active DESC, cl2.id DESC LIMIT 1),
            lm.sender_name,
            'Unknown'
          ) as client_name,
          COALESCE(
            c.id,
            (SELECT cl3.id FROM clients cl3 WHERE REGEXP_REPLACE(cl3.phone, '[^0-9]', '', 'g') LIKE '%' || REGEXP_REPLACE(lm.phone, '[^0-9]', '', 'g') || '%' ORDER BY cl3.is_active DESC, cl3.id DESC LIMIT 1)
          ) as client_id,
          c.email as client_email,
          COALESCE(uc.unread_count, 0) as unread_count,
          COALESCE(uc.has_urgent_unread, false) as has_urgent_unread,
          COALESCE(cpa.participants, '[]'::json) as participants,
          a.booking_number
        FROM latest_messages lm
        LEFT JOIN clients c ON lm.client_id = c.id AND (c.is_active = true OR c.is_active IS NULL)
        LEFT JOIN unread_counts uc ON lm.group_key = uc.group_key
        LEFT JOIN conversation_participants_agg cpa ON lm.conversation_id = cpa.conversation_id
        LEFT JOIN conversations conv ON lm.conversation_id = conv.id
        LEFT JOIN appointments a ON conv.appointment_id = a.id
        WHERE (c.is_active = true OR c.id IS NULL)
        ORDER BY lm.sent_at DESC
      `;
    }

    return Response.json({ conversations });
  } catch (error) {
    console.error("[SMS Conversations] Error fetching conversations:", error);
    return Response.json(
      { error: "Failed to fetch conversations" },
      { status: 500 },
    );
  }
}
