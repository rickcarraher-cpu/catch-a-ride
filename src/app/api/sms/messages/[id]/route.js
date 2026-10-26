import sql from "@/app/api/utils/sql";

/**
 * Mark a message as read
 * PATCH /api/sms/messages/[id]
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;

    await sql`
      UPDATE sms_messages 
      SET read_at = CURRENT_TIMESTAMP 
      WHERE id = ${id} AND tenant_id = 1
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[SMS Messages] Error marking as read:", error);
    return Response.json(
      { error: "Failed to mark message as read" },
      { status: 500 },
    );
  }
}

/**
 * Delete a message
 * DELETE /api/sms/messages/[id]
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await sql`
      DELETE FROM sms_messages 
      WHERE id = ${id} AND tenant_id = 1
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[SMS Messages] Error deleting message:", error);
    return Response.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}

/**
 * Mark a message as unread (clears read_at)
 * PUT /api/sms/messages/[id]
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;

    await sql`
      UPDATE sms_messages 
      SET read_at = NULL 
      WHERE id = ${id} AND tenant_id = 1 AND direction = 'inbound'
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[SMS Messages] Error marking as unread:", error);
    return Response.json(
      { error: "Failed to mark message as unread" },
      { status: 500 },
    );
  }
}
