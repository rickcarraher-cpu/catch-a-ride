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
 * PATCH /api/sms/driver-messages/groups/[id]
 * Update group: add/remove drivers
 * Body: { add_employee_ids?: number[], remove_employee_ids?: number[] }
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { add_employee_ids = [], remove_employee_ids = [] } = body;

    // Verify conversation exists and is a group (no appointment_id)
    const [conversation] = await sql`
      SELECT id FROM conversations
      WHERE id = ${id} AND tenant_id = 1 AND appointment_id IS NULL
    `;

    if (!conversation) {
      return Response.json(
        { error: "Group conversation not found" },
        { status: 404 },
      );
    }

    // Remove drivers
    if (remove_employee_ids.length > 0) {
      const placeholders = remove_employee_ids
        .map((_, i) => `$${i + 2}`)
        .join(", ");
      await sql(
        `DELETE FROM conversation_participants 
         WHERE conversation_id = $1 
           AND employee_id IN (${placeholders})
           AND participant_type = 'driver'`,
        [id, ...remove_employee_ids],
      );
      console.log(
        `[DriverMessages→Groups] Removed ${remove_employee_ids.length} drivers from group ${id}`,
      );
    }

    // Add drivers
    if (add_employee_ids.length > 0) {
      // Fetch driver details
      const placeholders = add_employee_ids
        .map((_, i) => `$${i + 1}`)
        .join(", ");
      const drivers = await sql(
        `SELECT id, name, phone FROM employees WHERE id IN (${placeholders})`,
        add_employee_ids,
      );

      for (const driver of drivers) {
        const e164Phone = toE164(driver.phone);
        if (!e164Phone) {
          console.error(
            `[DriverMessages→Groups] Invalid phone for driver ${driver.name}: ${driver.phone}`,
          );
          continue;
        }

        // Check if already in group
        const [existing] = await sql`
          SELECT id FROM conversation_participants
          WHERE conversation_id = ${id}
            AND employee_id = ${driver.id}
            AND participant_type = 'driver'
        `;

        if (existing) {
          console.log(
            `[DriverMessages→Groups] Driver ${driver.name} already in group ${id}`,
          );
          continue;
        }

        await sql`
          INSERT INTO conversation_participants 
          (conversation_id, participant_type, employee_id, phone, name)
          VALUES (${id}, 'driver', ${driver.id}, ${e164Phone}, ${driver.name})
        `;

        console.log(
          `[DriverMessages→Groups] Added driver ${driver.name} to group ${id}`,
        );
      }
    }

    // Update last_message_at
    await sql`
      UPDATE conversations
      SET last_message_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    // Fetch updated participants
    const participants = await sql`
      SELECT 
        employee_id as id,
        name,
        phone,
        participant_type as type
      FROM conversation_participants
      WHERE conversation_id = ${id} AND participant_type = 'driver'
      ORDER BY name
    `;

    return Response.json({
      success: true,
      conversation_id: id,
      participants,
      name: participants.map((p) => p.name).join(", "),
    });
  } catch (error) {
    console.error("[DriverMessages→Groups] PATCH error:", error);
    return Response.json(
      { error: "Failed to update group", detail: error.message },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/sms/driver-messages/groups/[id]
 * Delete a group conversation and all its messages
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Verify conversation exists and is a group
    const [conversation] = await sql`
      SELECT id FROM conversations
      WHERE id = ${id} AND tenant_id = 1 AND appointment_id IS NULL
    `;

    if (!conversation) {
      return Response.json(
        { error: "Group conversation not found" },
        { status: 404 },
      );
    }

    // Delete all messages in this conversation
    await sql`
      DELETE FROM sms_messages
      WHERE conversation_id = ${id}
    `;

    // Delete all participants
    await sql`
      DELETE FROM conversation_participants
      WHERE conversation_id = ${id}
    `;

    // Delete the conversation
    await sql`
      DELETE FROM conversations
      WHERE id = ${id}
    `;

    console.log(`[DriverMessages→Groups] Deleted group ${id}`);

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DriverMessages→Groups] DELETE error:", error);
    return Response.json(
      { error: "Failed to delete group", detail: error.message },
      { status: 500 },
    );
  }
}
