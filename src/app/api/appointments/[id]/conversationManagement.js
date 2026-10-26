import sql from "@/app/api/utils/sql";

export async function autoDeleteSmsThreadOnComplete(id, oldStatus, newStatus) {
  const statusChangedToCompleted =
    oldStatus !== "completed" && newStatus === "completed";

  if (!statusChangedToCompleted) {
    return;
  }

  try {
    const [autoDeleteSetting] = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = 1 AND key = 'sms_auto_delete_on_complete'
    `;

    if (autoDeleteSetting?.value === "true") {
      console.log(
        `[PATCH ${id}] Trip marked completed - auto-deleting SMS thread`,
      );

      const [conversation] = await sql`
        SELECT id FROM conversations WHERE appointment_id = ${id}
      `;

      if (conversation) {
        await sql`
          DELETE FROM sms_messages WHERE conversation_id = ${conversation.id}
        `;

        await sql`
          DELETE FROM conversation_participants WHERE conversation_id = ${conversation.id}
        `;

        await sql`
          DELETE FROM conversations WHERE id = ${conversation.id}
        `;

        console.log(
          `[PATCH ${id}] Deleted SMS thread for conversation ${conversation.id}`,
        );
      } else {
        console.log(`[PATCH ${id}] No conversation found for this appointment`);
      }
    }
  } catch (deleteErr) {
    console.error(`[PATCH ${id}] Failed to auto-delete SMS thread:`, deleteErr);
  }
}

export async function updateConversationParticipants(
  id,
  oldEmployeeId,
  newEmployeeId,
) {
  try {
    const driverChanged = oldEmployeeId !== newEmployeeId;

    if (!driverChanged) {
      return;
    }

    console.log(
      `[PATCH ${id}] Driver changed: ${oldEmployeeId} → ${newEmployeeId}`,
    );

    const {
      findOrCreateConversationForAppointment,
      addDriverToConversation,
      removeDriverFromConversation,
    } = await import("@/app/api/utils/conversations");

    const conversationId = await findOrCreateConversationForAppointment(id, 1);

    if (oldEmployeeId) {
      await removeDriverFromConversation(conversationId, oldEmployeeId);
    }

    if (newEmployeeId) {
      const [newDriver] = await sql`
        SELECT id, name, phone FROM employees WHERE id = ${newEmployeeId}
      `;
      if (newDriver && newDriver.phone) {
        await addDriverToConversation(
          conversationId,
          newDriver.id,
          newDriver.phone,
          newDriver.name,
        );
      }
    }
  } catch (convErr) {
    console.error(
      `[PATCH ${id}] Failed to update conversation participants:`,
      convErr,
    );
  }
}
