import sql from "@/app/api/utils/sql";
import * as argon2 from "argon2";

export async function POST(request) {
  try {
    const { token, new_password } = await request.json();

    if (!token || !new_password) {
      return Response.json(
        { error: "Token and new password are required" },
        { status: 400 },
      );
    }

    if (new_password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 },
      );
    }

    // Find driver with valid token
    const drivers = await sql`
      SELECT id, name, email, password_reset_token, password_reset_expires
      FROM employees
      WHERE password_reset_token = ${token}
        AND tenant_id = 1
        AND is_active = true
      LIMIT 1
    `;

    if (drivers.length === 0) {
      return Response.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    const driver = drivers[0];

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(driver.password_reset_expires);

    if (now > expiresAt) {
      return Response.json(
        { error: "Reset token has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Hash new password
    const hashedPassword = await argon2.hash(new_password);

    // Update password and clear reset token
    await sql`
      UPDATE employees
      SET 
        password = ${hashedPassword},
        force_password_reset = false,
        password_reset_token = NULL,
        password_reset_expires = NULL
      WHERE id = ${driver.id}
    `;

    return Response.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password with token:", error);
    return Response.json(
      { error: "Failed to reset password" },
      { status: 500 },
    );
  }
}
