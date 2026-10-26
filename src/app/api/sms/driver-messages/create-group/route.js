import sql from "@/app/api/utils/sql";

// E.164 phone number normalizer (duplicated locally for simplicity)
function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * POST /api/sms/driver-messages/create-group
 * Creates a group conversation with multiple drivers
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { employee_ids } = body;

    if (
      !employee_ids ||
      !Array.isArray(employee_ids) ||
      employee_ids.length < 2
    ) {
      return Response.json(
        { error: "At least 2 driver IDs are required" },
        { status: 400 },
      );
    }

    // Fetch driver details
    const placeholders = employee_ids.map((_, i) => `$${i + 1}`).join(", ");
    const drivers = await sql(
      `SELECT id, name, phone FROM employees WHERE id IN (${placeholders})`,
      employee_ids,
    );

    if (drivers.length < 2) {
      return Response.json(
        { error: "Could not find enough drivers with the provided IDs" },
        { status: 404 },
      );
    }

    // Validate all drivers have phone numbers
    const driversWithoutPhone = drivers.filter((d) => !d.phone);
    if (driversWithoutPhone.length > 0) {
      return Response.json(
        {
          error: `The following drivers have no phone number: ${driversWithoutPhone.map((d) => d.name).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Create conversation (no appointment_id for standalone driver groups)
    const [conversation] = await sql`
      INSERT INTO conversations (tenant_id, appointment_id, created_at, last_message_at)
      VALUES (1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id
    `;

    console.log(
      `[DriverMessages→CreateGroup] Created conversation ${conversation.id} for ${drivers.length} drivers`,
    );

    // Add each driver to the conversation
    for (const driver of drivers) {
      const e164Phone = toE164(driver.phone);
      if (!e164Phone) {
        console.error(
          `[DriverMessages→CreateGroup] Invalid phone for driver ${driver.name}: ${driver.phone}`,
        );
        continue;
      }

      await sql`
        INSERT INTO conversation_participants 
        (conversation_id, participant_type, employee_id, phone, name)
        VALUES (${conversation.id}, 'driver', ${driver.id}, ${e164Phone}, ${driver.name})
      `;

      console.log(
        `[DriverMessages→CreateGroup] Added driver ${driver.name} (${e164Phone}) to conversation ${conversation.id}`,
      );
    }

    // Generate group name from driver names
    const groupName = drivers.map((d) => d.name).join(", ");

    return Response.json({
      success: true,
      conversation_id: conversation.id,
      name: groupName,
      participants: drivers.map((d) => ({
        id: d.id,
        name: d.name,
        phone: d.phone,
        type: "driver",
      })),
    });
  } catch (error) {
    console.error("[DriverMessages→CreateGroup] Error:", error);
    return Response.json(
      { error: "Failed to create group conversation", detail: error.message },
      { status: 500 },
    );
  }
}
