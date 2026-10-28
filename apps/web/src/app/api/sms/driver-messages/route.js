import sql from "@/app/api/utils/sql";
import {
  sendSmsAndLog,
  sendSmsBatch,
  loadSmsConfig,
  toE164,
} from "@/app/api/utils/sms-sender";

/**
 * GET /api/sms/driver-messages
 * Returns conversations grouped by employee phone number
 */
export async function GET(request) {
  try {
    // Get all active employees with phone numbers
    const employees = await sql`
      SELECT id, name, phone, color
      FROM employees
      WHERE tenant_id = 1 AND is_active = true AND phone IS NOT NULL AND phone != ''
      ORDER BY name ASC
    `;

    if (employees.length === 0) {
      return Response.json({ conversations: [], employees: [] });
    }

    const employeePhones = employees
      .map((e) => toE164(e.phone))
      .filter(Boolean);

    // Build phone -> employee map
    const phoneToEmployee = {};
    for (const emp of employees) {
      const e164 = toE164(emp.phone);
      if (e164) phoneToEmployee[e164] = emp;
    }

    // Get latest message and unread count for each driver phone
    const conversations = [];

    for (const emp of employees) {
      const e164 = toE164(emp.phone);
      if (!e164) continue;

      const [latest] = await sql`
        SELECT id, message, direction, sent_at, read_at
        FROM sms_messages
        WHERE tenant_id = 1 AND phone = ${e164}
        ORDER BY sent_at DESC
        LIMIT 1
      `;

      const [unreadRow] = await sql`
        SELECT COUNT(*) as unread_count
        FROM sms_messages
        WHERE tenant_id = 1 AND phone = ${e164}
          AND direction = 'inbound' AND read_at IS NULL
      `;

      conversations.push({
        phone: e164,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_color: emp.color,
        last_message: latest?.message || null,
        last_direction: latest?.direction || null,
        last_sent_at: latest?.sent_at || null,
        unread_count: parseInt(unreadRow?.unread_count || 0),
      });
    }

    // Sort by last message time (most recent first), then by name
    conversations.sort((a, b) => {
      if (a.last_sent_at && b.last_sent_at) {
        return new Date(b.last_sent_at) - new Date(a.last_sent_at);
      }
      if (a.last_sent_at) return -1;
      if (b.last_sent_at) return 1;
      return a.employee_name.localeCompare(b.employee_name);
    });

    return Response.json({ conversations, employees });
  } catch (error) {
    console.error("[Driver Messages] GET error:", error);
    return Response.json(
      { error: "Failed to fetch driver conversations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sms/driver-messages
 * Send a message to a specific driver or all drivers
 * Body: { employee_id: number | 'all', message: string }
 */
export async function POST(request) {
  try {
    const { employee_id, message, conversation_id } = await request.json();

    if (!message) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Load settings and SMS config using unified sender
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    const smsConfig = await loadSmsConfig(settings);

    if (!smsConfig.ready) {
      return Response.json({ error: smsConfig.reason }, { status: 400 });
    }

    let targets = [];

    // Handle group conversation
    if (conversation_id) {
      const participants = await sql`
        SELECT cp.employee_id as id, cp.name, cp.phone
        FROM conversation_participants cp
        WHERE cp.conversation_id = ${conversation_id}
          AND cp.participant_type = 'driver'
      `;

      if (participants.length === 0) {
        return Response.json(
          { error: "No drivers found in this group" },
          { status: 404 },
        );
      }

      targets = participants;
    } else if (employee_id === "all") {
      // Get target employee(s)
      targets = await sql`
        SELECT id, name, phone FROM employees
        WHERE tenant_id = 1 AND is_active = true AND phone IS NOT NULL AND phone != ''
      `;
    } else {
      const [emp] = await sql`
        SELECT id, name, phone FROM employees
        WHERE tenant_id = 1 AND id = ${employee_id}
      `;
      if (!emp) {
        return Response.json({ error: "Driver not found" }, { status: 404 });
      }
      targets = [emp];
    }

    if (targets.length === 0) {
      return Response.json(
        { error: "No drivers with phone numbers found" },
        { status: 400 },
      );
    }

    const fullMessage = `${message}\n\nReply STOP to opt out.`;

    // Build valid targets with normalized phones
    const validTargets = targets
      .map((emp) => ({ ...emp, normalizedPhone: toE164(emp.phone) }))
      .filter((emp) => emp.normalizedPhone);

    // Use batched sending for multiple recipients (batches of 10)
    const jobs = validTargets.map((emp) => ({
      to: emp.normalizedPhone,
      message: fullMessage,
      config: smsConfig,
      label: "DriverMessage",
      conversationId: conversation_id || null,
      employeeId: emp.id,
      senderName: emp.name,
      recipientType: "driver",
      notificationType: "driver_message",
      metadata: { type: "driver", employee_id: emp.id },
    }));

    // Throttled sequential send — 120 ms between each message, ~8/sec (Quo allows 10/sec)
    const batchResults = await sendSmsBatch({
      jobs,
      label: "DriverMessages",
    });

    // Map results back to driver info for the response
    const results = batchResults.map((r, i) => ({
      employee: validTargets[i].name,
      phone: validTargets[i].normalizedPhone,
      success: r.success,
      error: r.success ? null : r.error,
    }));

    // Update conversation last_message_at if sending to a group
    if (conversation_id) {
      await sql`
        UPDATE conversations
        SET last_message_at = CURRENT_TIMESTAMP
        WHERE id = ${conversation_id}
      `;
    }

    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      // Include the first specific error reason in the top-level error
      const firstError = results.find((r) => r.error)?.error || "Unknown error";
      return Response.json(
        { error: `Failed to send to all drivers: ${firstError}`, results },
        { status: 500 },
      );
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error("[Driver Messages] POST error:", error);
    return Response.json(
      { error: error.message || "Failed to send" },
      { status: 500 },
    );
  }
}
