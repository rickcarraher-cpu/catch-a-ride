import sql from "@/app/api/utils/sql";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";
import crypto from "crypto";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Get driver info
    const drivers = await sql`
      SELECT id, name, email, phone
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND tenant_id = 1
        AND is_active = true
      LIMIT 1
    `;

    if (drivers.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const driver = drivers[0];

    if (!driver.phone) {
      return Response.json(
        { error: "No phone number on file for this driver" },
        { status: 400 },
      );
    }

    // Generate reset token (6-digit code for simplicity)
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store token in database with 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await sql`
      UPDATE employees
      SET 
        password_reset_token = ${resetToken},
        password_reset_expires = ${expiresAt.toISOString()}
      WHERE id = ${driver.id}
    `;

    // Load SMS config from unified sender
    const config = await loadSmsConfig();

    if (!config.ready) {
      return Response.json(
        { error: config.reason || "SMS provider not configured" },
        { status: 500 },
      );
    }

    // Build reset link
    const rawBaseUrl =
      config.settings.app_url ||
      process.env.NEXT_PUBLIC_CREATE_APP_URL ||
      process.env.AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      "";
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");
    const resetLink = `${baseUrl}/driver/reset-password?token=${resetToken}`;

    const message = `Password reset requested for your driver account. Click to reset: ${resetLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, please ignore.`;

    // Send SMS via unified sender
    const result = await sendSms({
      to: driver.phone,
      message,
      config,
      label: "Password Reset",
    });

    if (!result.success) {
      console.error("[Password Reset] SMS failed:", result.error);
      return Response.json(
        { error: "Failed to send reset SMS" },
        { status: 500 },
      );
    }

    console.log(
      `[Password Reset] ✅ SMS sent via ${result.provider} to ${driver.phone}`,
    );

    return Response.json({
      success: true,
      message: "Reset link sent via text message",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return Response.json(
      { error: "Failed to request password reset" },
      { status: 500 },
    );
  }
}
