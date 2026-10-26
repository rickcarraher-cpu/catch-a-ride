import sql from "@/app/api/utils/sql";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Get employee info (admin or driver)
    const employees = await sql`
      SELECT id, name, email, phone
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND tenant_id = 1
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = employees[0];

    if (!employee.phone) {
      return Response.json(
        {
          error:
            "No phone number on file for this employee. Please contact your administrator.",
        },
        { status: 400 },
      );
    }

    // Generate a random 4-digit code
    const code = String(Math.floor(1000 + Math.random() * 9000));

    // Store the code as the reset token with 10-minute expiration
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sql`
      UPDATE employees
      SET 
        password_reset_token = ${code},
        password_reset_expires = ${expiresAt.toISOString()}
      WHERE id = ${employee.id}
    `;

    // Load SMS config
    const config = await loadSmsConfig();

    if (!config.ready) {
      return Response.json(
        { error: config.reason || "SMS provider not configured" },
        { status: 500 },
      );
    }

    const message = `Your driver portal verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore.`;

    // Send SMS
    const result = await sendSms({
      to: employee.phone,
      message,
      config,
      label: "Driver Reset Code",
    });

    if (!result.success) {
      console.error("[Driver Reset Code] SMS failed:", result.error);
      return Response.json(
        { error: "Failed to send verification code" },
        { status: 500 },
      );
    }

    // Mask phone for response (show last 4 digits)
    const maskedPhone = employee.phone.replace(/\d(?=\d{4})/g, "*");

    console.log(
      `[Driver Reset Code] ✅ Code sent to ${maskedPhone} for ${employee.email}`,
    );

    return Response.json({
      success: true,
      maskedPhone,
      message: "Verification code sent via text message",
    });
  } catch (error) {
    console.error("Error sending driver reset code:", error);
    return Response.json(
      { error: "Failed to send verification code" },
      { status: 500 },
    );
  }
}
