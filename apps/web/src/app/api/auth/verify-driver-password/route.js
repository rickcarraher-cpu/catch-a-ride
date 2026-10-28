import sql from "@/app/api/utils/sql";
import * as argon2 from "argon2";

export async function POST(request) {
  try {
    const { email, password, employee_id } = await request.json();

    // Support both email and employee_id lookup
    if ((!email && !employee_id) || !password) {
      return Response.json(
        { error: "Employee identifier and password are required" },
        { status: 400 },
      );
    }

    // Get employee and their password
    let employees;
    if (employee_id) {
      employees = await sql`
        SELECT 
          id, 
          name, 
          email,
          password,
          is_admin,
          is_active
        FROM employees
        WHERE id = ${employee_id}
          AND tenant_id = 1
        LIMIT 1
      `;
    } else {
      employees = await sql`
        SELECT 
          id, 
          name, 
          email,
          password,
          is_admin,
          is_active
        FROM employees
        WHERE LOWER(email) = LOWER(${email})
          AND tenant_id = 1
        LIMIT 1
      `;
    }

    if (employees.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = employees[0];

    if (!employee.password || !employee.password.trim()) {
      return Response.json(
        { error: "No password set for this account" },
        { status: 400 },
      );
    }

    // Try plain text comparison first
    let isValid = employee.password === password;

    // If plain text didn't match and stored password looks like an argon2 hash,
    // try argon2 verification (backward compat during migration)
    if (!isValid && employee.password.startsWith("$argon2")) {
      try {
        isValid = await argon2.verify(employee.password, password);
        // If argon2 matched, auto-migrate to plain text
        if (isValid) {
          await sql`
            UPDATE employees SET password = ${password} WHERE id = ${employee.id}
          `;
          console.log(
            `[Auth] Auto-migrated password to plain text for employee ${employee.id}`,
          );
        }
      } catch (err) {
        console.error("Argon2 verify fallback failed:", err);
      }
    }

    if (!isValid) {
      return Response.json(
        { error: "Password does not match — retry" },
        { status: 401 },
      );
    }

    console.log("✅ Password verified for employee:", employee.email);

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
  } catch (error) {
    console.error("Error verifying password:", error);
    return Response.json(
      { error: "Failed to verify password" },
      { status: 500 },
    );
  }
}
