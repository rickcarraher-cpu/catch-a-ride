import sql from "@/app/api/utils/sql";
import * as argon2 from "argon2";

// Reset password for authenticated driver
export async function POST(request) {
  try {
    const { email, current_password, new_password } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (!current_password || !new_password) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 },
      );
    }

    if (new_password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 },
      );
    }

    // Get current password from employees table
    const employees = await sql`
      SELECT id, password
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND tenant_id = 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const employee = employees[0];

    // Verify current password
    if (!employee.password) {
      return Response.json(
        { error: "No password set for this driver" },
        { status: 400 },
      );
    }

    const isValid = await argon2.verify(employee.password, current_password);
    if (!isValid) {
      return Response.json(
        { error: "Current password is incorrect" },
        { status: 401 },
      );
    }

    // Hash new password
    const hashedPassword = await argon2.hash(new_password);

    // Update password and clear force_password_reset flag
    await sql`
      UPDATE employees 
      SET password = ${hashedPassword}, 
          force_password_reset = false
      WHERE id = ${employee.id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error resetting password:", error);
    return Response.json(
      { error: "Failed to reset password" },
      { status: 500 },
    );
  }
}
