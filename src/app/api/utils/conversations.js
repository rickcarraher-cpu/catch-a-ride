import sql from "@/app/api/utils/sql";

/**
 * Normalize phone number to E.164 format
 */
function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * Create a new conversation for an appointment
 * @param {number} appointmentId - The appointment ID
 * @param {number} tenantId - The tenant ID (default: 1)
 * @returns {Promise<number>} The conversation ID
 */
export async function createConversation(appointmentId, tenantId = 1) {
  const [conversation] = await sql`
    INSERT INTO conversations (tenant_id, appointment_id, created_at, last_message_at)
    VALUES (${tenantId}, ${appointmentId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `;
  console.log(
    `[Conversations] Created conversation ${conversation.id} for appointment ${appointmentId}`,
  );
  return conversation.id;
}

/**
 * Add a passenger to a conversation
 * @param {number} conversationId - The conversation ID
 * @param {number} clientId - The client ID
 * @param {string} phone - The client's phone number
 * @param {string} name - The client's name
 */
export async function addPassengerToConversation(
  conversationId,
  clientId,
  phone,
  name,
) {
  const e164Phone = toE164(phone);
  if (!e164Phone) {
    console.error("[Conversations] Invalid phone number for passenger:", phone);
    return;
  }

  // Check if already added
  const [existing] = await sql`
    SELECT id FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND client_id = ${clientId}
      AND participant_type = 'passenger'
  `;

  if (existing) {
    console.log(
      `[Conversations] Passenger ${name} already in conversation ${conversationId}`,
    );
    return;
  }

  await sql`
    INSERT INTO conversation_participants 
    (conversation_id, participant_type, client_id, phone, name)
    VALUES (${conversationId}, 'passenger', ${clientId}, ${e164Phone}, ${name})
  `;
  console.log(
    `[Conversations] Added passenger ${name} (${e164Phone}) to conversation ${conversationId}`,
  );
}

/**
 * Add a driver to a conversation
 * @param {number} conversationId - The conversation ID
 * @param {number} employeeId - The employee ID
 * @param {string} phone - The driver's phone number
 * @param {string} name - The driver's name
 */
export async function addDriverToConversation(
  conversationId,
  employeeId,
  phone,
  name,
) {
  const e164Phone = toE164(phone);
  if (!e164Phone) {
    console.error("[Conversations] Invalid phone number for driver:", phone);
    return;
  }

  // Check if already added
  const [existing] = await sql`
    SELECT id FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND employee_id = ${employeeId}
      AND participant_type = 'driver'
  `;

  if (existing) {
    console.log(
      `[Conversations] Driver ${name} already in conversation ${conversationId}`,
    );
    return;
  }

  await sql`
    INSERT INTO conversation_participants 
    (conversation_id, participant_type, employee_id, phone, name)
    VALUES (${conversationId}, 'driver', ${employeeId}, ${e164Phone}, ${name})
  `;
  console.log(
    `[Conversations] Added driver ${name} (${e164Phone}) to conversation ${conversationId}`,
  );
}

/**
 * Remove a driver from a conversation (when reassigned)
 * @param {number} conversationId - The conversation ID
 * @param {number} employeeId - The employee ID
 */
export async function removeDriverFromConversation(conversationId, employeeId) {
  await sql`
    DELETE FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND employee_id = ${employeeId}
      AND participant_type = 'driver'
  `;
  console.log(
    `[Conversations] Removed driver (employee ${employeeId}) from conversation ${conversationId}`,
  );
}

/**
 * Get all participants in a conversation
 * @param {number} conversationId - The conversation ID
 * @returns {Promise<Array>} Array of participants with phone, name, type
 */
export async function getConversationParticipants(conversationId) {
  const participants = await sql`
    SELECT 
      id,
      conversation_id,
      participant_type,
      client_id,
      employee_id,
      phone,
      name,
      added_at
    FROM conversation_participants
    WHERE conversation_id = ${conversationId}
    ORDER BY added_at ASC
  `;
  return participants;
}

/**
 * Find conversation by phone number (either passenger or driver)
 * Returns the most relevant active conversation for that phone number.
 * Prioritizes conversations with upcoming appointments over ones without,
 * so keyword confirmations (YES/NO) go to the right trip.
 * @param {string} phone - Phone number to search for
 * @returns {Promise<object|null>} Conversation with participants, or null
 */
export async function findConversationByPhone(phone) {
  const e164Phone = toE164(phone);
  if (!e164Phone) return null;

  // Prefer conversations with appointment_id set, ordered by:
  // 1. Future trips first (most upcoming)
  // 2. Then recent past trips
  // 3. Last resort: conversations without an appointment (orphaned threads)
  const rows = await sql`
    SELECT c.id, c.appointment_id, c.tenant_id, c.created_at, c.last_message_at,
           a.start_time as appt_start_time
    FROM conversations c
    INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
    LEFT JOIN appointments a ON c.appointment_id = a.id
    WHERE cp.phone = ${e164Phone}
    ORDER BY
      CASE WHEN c.appointment_id IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN a.start_time >= NOW() THEN 0 ELSE 1 END,
      a.start_time ASC NULLS LAST,
      c.last_message_at DESC
    LIMIT 1
  `;

  const conversation = rows.length > 0 ? rows[0] : null;
  if (!conversation) return null;

  const participants = await getConversationParticipants(conversation.id);
  return {
    id: conversation.id,
    appointment_id: conversation.appointment_id,
    tenant_id: conversation.tenant_id,
    created_at: conversation.created_at,
    last_message_at: conversation.last_message_at,
    participants,
  };
}

/**
 * Find or create conversation for an appointment
 * @param {number} appointmentId - The appointment ID
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<number>} The conversation ID
 */
export async function findOrCreateConversationForAppointment(
  appointmentId,
  tenantId = 1,
) {
  const [existing] = await sql`
    SELECT id FROM conversations
    WHERE appointment_id = ${appointmentId} AND tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (existing) {
    return existing.id;
  }

  return await createConversation(appointmentId, tenantId);
}

/**
 * Update conversation's last message timestamp
 * @param {number} conversationId - The conversation ID
 */
export async function updateConversationTimestamp(conversationId) {
  await sql`
    UPDATE conversations
    SET last_message_at = CURRENT_TIMESTAMP
    WHERE id = ${conversationId}
  `;
}

/**
 * Get other participants in a conversation (excluding the sender)
 * @param {number} conversationId - The conversation ID
 * @param {string} senderPhone - The sender's phone number (to exclude)
 * @returns {Promise<Array>} Array of other participants
 */
export async function getOtherParticipants(conversationId, senderPhone) {
  const e164SenderPhone = toE164(senderPhone);
  const participants = await sql`
    SELECT 
      id,
      conversation_id,
      participant_type,
      client_id,
      employee_id,
      phone,
      name
    FROM conversation_participants
    WHERE conversation_id = ${conversationId}
      AND phone != ${e164SenderPhone}
  `;
  return participants;
}
