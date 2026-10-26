import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return Response.json(
        { error: "Email and verification code are required" },
        { status: 400 },
      );
    }

    // Find the employee with the matching code (admin or driver)
    const employees = await sql`
      SELECT id, name, email, password_reset_token, password_reset_expires
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND tenant_id = 1
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = employees[0];

    // Check if token exists
    if (!employee.password_reset_token) {
      return Response.json(
        {
          error:
            "No verification code was requested. Please request a new one.",
        },
        { status: 400 },
      );
    }

    // Check if token has expired
    if (
      employee.password_reset_expires &&
      new Date(employee.password_reset_expires) < new Date()
    ) {
      // Clear expired token
      await sql`
        UPDATE employees
        SET password_reset_token = NULL, password_reset_expires = NULL
        WHERE id = ${employee.id}
      `;
      return Response.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Check if code matches
    if (employee.password_reset_token !== code.trim()) {
      return Response.json(
        { error: "Invalid verification code. Please try again." },
        { status: 401 },
      );
    }

    // Code is valid — clear the token so it can't be reused
    // but keep the window open for the password reset step
    // We'll generate a one-time-use token for the actual reset
    const resetToken = `verified_${employee.id}_${Date.now()}`;
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes to set new password

    await sql`
      UPDATE employees
      SET 
        password_reset_token = ${resetToken},
        password_reset_expires = ${resetExpires.toISOString()}
      WHERE id = ${employee.id}
    `;

    return Response.json({
      success: true,
      resetToken,
      message: "Code verified successfully",
    });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    return Response.json({ error: "Failed to verify code" }, { status: 500 });
  }
}
