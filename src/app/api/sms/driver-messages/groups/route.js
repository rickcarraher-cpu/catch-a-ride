import sql from "@/app/api/utils/sql";

// E.164 phone number normalizer
function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * GET /api/sms/driver-messages/groups
 * Fetch all driver group conversations
 */
export async function GET(request) {
  try {
    // Get all conversations without appointment_id (standalone driver groups)
    const groups = await sql`
      SELECT 
        c.id as conversation_id,
        c.created_at,
        c.last_message_at,
        json_agg(
          json_build_object(
            'id', cp.employee_id,
            'name', cp.name,
            'phone', cp.phone,
            'type', cp.participant_type
          ) ORDER BY cp.name
        ) as participants
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE c.tenant_id = 1 
        AND c.appointment_id IS NULL
        AND cp.participant_type = 'driver'
      GROUP BY c.id, c.created_at, c.last_message_at
      HAVING COUNT(cp.id) >= 2
      ORDER BY c.last_message_at DESC
    `;

    // For each group, get latest message and unread count
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        const [latest] = await sql`
          SELECT message, direction, sent_at
          FROM sms_messages
          WHERE conversation_id = ${group.conversation_id}
          ORDER BY sent_at DESC
          LIMIT 1
        `;

        const [unreadRow] = await sql`
          SELECT COUNT(*) as unread_count
          FROM sms_messages
          WHERE conversation_id = ${group.conversation_id}
            AND direction = 'inbound'
            AND read_at IS NULL
        `;

        const participantNames = group.participants
          .map((p) => p.name)
          .join(", ");

        return {
          conversation_id: group.conversation_id,
          name: participantNames,
          participants: group.participants,
          last_message: latest?.message || null,
          last_direction: latest?.direction || null,
          last_sent_at: latest?.sent_at || group.last_message_at,
          unread_count: parseInt(unreadRow?.unread_count || 0),
          created_at: group.created_at,
        };
      }),
    );

    return Response.json({ group_conversations: groupsWithDetails });
  } catch (error) {
    console.error("[DriverMessages→Groups] GET error:", error);
    return Response.json(
      { error: "Failed to fetch group conversations" },
      { status: 500 },
    );
  }
}
