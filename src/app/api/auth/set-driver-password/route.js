import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { email, password, resetToken, employee_id, confirm_password } =
      await request.json();

    // New flow: first-time password creation with employee_id
    if (employee_id && confirm_password !== undefined) {
      if (!password || !confirm_password) {
        return Response.json(
          { error: "Password and confirmation are required" },
          { status: 400 },
        );
      }

      const trimmedPassword = password.trim();
      const trimmedConfirm = confirm_password.trim();

      if (trimmedPassword.length < 4) {
        return Response.json(
          { error: "Password must be at least 4 characters." },
          { status: 400 },
        );
      }

      if (trimmedPassword !== trimmedConfirm) {
        return Response.json(
          {
            error: "Passwords do not match. Please retype both and try again.",
          },
          { status: 400 },
        );
      }

      // Look up employee
      const employees = await sql`
        SELECT id, name, email, password, is_admin, is_active
        FROM employees
        WHERE id = ${employee_id}
          AND tenant_id = 1
        LIMIT 1
      `;

      if (employees.length === 0) {
        return Response.json({ error: "Employee not found" }, { status: 404 });
      }

      const employee = employees[0];

      // Store password as plain text
      await sql`
        UPDATE employees
        SET password = ${trimmedPassword},
            force_password_reset = false
        WHERE id = ${employee_id}
      `;

      console.log("✅ Password created for employee:", employee.email);

      return Response.json({
        success: true,
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email.toLowerCase(),
          isAdmin: Boolean(employee.is_admin),
          isDriver: Boolean(employee.is_active),
        },
      });
    }

    // If resetToken is provided, verify it first
    if (resetToken) {
      const tokenDrivers = await sql`
        SELECT id, name, email, password_reset_token, password_reset_expires
        FROM employees
        WHERE password_reset_token = ${resetToken}
          AND tenant_id = 1
        LIMIT 1
      `;

      if (tokenDrivers.length === 0) {
        return Response.json(
          { error: "Invalid or expired reset token" },
          { status: 400 },
        );
      }

      const tokenDriver = tokenDrivers[0];

      if (
        tokenDriver.password_reset_expires &&
        new Date(tokenDriver.password_reset_expires) < new Date()
      ) {
        await sql`
          UPDATE employees
          SET password_reset_token = NULL, password_reset_expires = NULL
          WHERE id = ${tokenDriver.id}
        `;
        return Response.json(
          { error: "Reset token has expired. Please request a new code." },
          { status: 400 },
        );
      }

      // Token valid — set the password (plain text) and clear token
      await sql`
        UPDATE employees
        SET password = ${password},
            force_password_reset = false,
            password_reset_token = NULL,
            password_reset_expires = NULL
        WHERE id = ${tokenDriver.id}
      `;

      return Response.json({
        driver: {
          id: tokenDriver.id,
          name: tokenDriver.name,
          email: tokenDriver.email,
        },
      });
    }

    // Original flow: email-based password set
    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if driver exists
    const drivers = await sql`
      SELECT id, name, email
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND tenant_id = 1
      LIMIT 1
    `;

    if (drivers.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const driver = drivers[0];

    // Store password as plain text
    await sql`
      UPDATE employees
      SET password = ${password},
          force_password_reset = false
      WHERE id = ${driver.id}
    `;

    return Response.json({
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
      },
    });
  } catch (error) {
    console.error("Error setting driver password:", error);
    return Response.json({ error: "Failed to set password" }, { status: 500 });
  }
}
