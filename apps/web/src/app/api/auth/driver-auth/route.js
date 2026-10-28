import sql from "@/app/api/utils/sql";
import * as argon2 from "argon2";

/**
 * POST /api/auth/driver-auth
 *
 * Looks up an employee by email or employee_id,
 * then syncs the auth_users / auth_accounts tables so NextAuth
 * can create a session.
 */
export async function POST(request) {
  try {
    const { email, employee_id } = await request.json();

    if (!email && !employee_id) {
      return Response.json(
        { error: "Email or employee_id is required" },
        { status: 400 },
      );
    }

    // --- 1. Look up employee in employees table ---
    let employees;
    if (employee_id) {
      employees = await sql`
        SELECT id, name, email, is_admin, is_active
        FROM employees
        WHERE id = ${employee_id}
          AND tenant_id = 1
        LIMIT 1
      `;
    } else {
      employees = await sql`
        SELECT id, name, LOWER(email) as email, is_admin, is_active
        FROM employees
        WHERE LOWER(email) = LOWER(${email})
          AND tenant_id = 1
        LIMIT 1
      `;
    }

    if (employees.length === 0) {
      console.log("❌ Employee not found for:", email || employee_id);
      return Response.json(
        {
          error: employee_id
            ? "Employee not found"
            : "No account found with this email",
        },
        { status: 404 },
      );
    }

    const employee = employees[0];
    // Normalize email to lowercase for consistent auth
    const normalizedEmail = employee.email.toLowerCase();

    console.log("✅ Employee found:", {
      id: employee.id,
      name: employee.name,
      email: normalizedEmail,
      is_admin: employee.is_admin,
      is_active: employee.is_active,
    });

    // The internal password is deterministic — same driver.id always
    // produces the same string, so the stored hash remains valid forever.
    const internalPassword = "internal-auth-" + employee.id;

    // --- 2. Ensure auth_users entry exists with lowercase email ---
    const existingUsers = await sql`
      SELECT id FROM auth_users WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
    `;

    let authUserId;
    if (existingUsers.length === 0) {
      console.log("📝 Creating new auth_users entry for:", normalizedEmail);
      const newUser = await sql`
        INSERT INTO auth_users (name, email, "emailVerified")
        VALUES (${employee.name}, ${normalizedEmail}, NOW())
        RETURNING id
      `;
      authUserId = newUser[0].id;
    } else {
      authUserId = existingUsers[0].id;
      console.log("✓ auth_users entry exists, id:", authUserId);

      // Sync the email to lowercase and name to match the employees table
      // Using lowercase ensures case-insensitive auth works
      await sql`
        UPDATE auth_users
        SET email = ${normalizedEmail}, name = ${employee.name}
        WHERE id = ${authUserId}
      `;
      console.log("✓ Synced auth_users email to lowercase:", normalizedEmail);
    }

    // --- 3. Sync auth_accounts — always re-hash to ensure it matches current internalPassword ---
    const existingAccounts = await sql`
      SELECT id, password FROM auth_accounts
      WHERE "userId" = ${authUserId} AND provider = 'credentials'
      LIMIT 1
    `;

    const hashedPassword = await argon2.hash(internalPassword);

    if (existingAccounts.length === 0) {
      // First time: insert
      console.log("📝 Creating new auth_accounts entry");
      await sql`
        INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
        VALUES (${authUserId}, 'credentials', 'credentials', ${String(authUserId)}, ${hashedPassword})
      `;
    } else {
      // Always update the hash to keep it in sync with the internal password
      console.log("🔑 Updating auth_accounts password hash");
      await sql`
        UPDATE auth_accounts
        SET password = ${hashedPassword}
        WHERE "userId" = ${authUserId} AND provider = 'credentials'
      `;
    }

    const responseData = {
      success: true,
      internalPassword,
      driver: {
        id: employee.id,
        name: employee.name,
        email: normalizedEmail, // Return lowercase email for sign-in
        isAdmin: Boolean(employee.is_admin), // Convert to camelCase for frontend
      },
    };

    console.log("🚀 Sending auth response:", {
      email: responseData.driver.email,
      isAdmin: responseData.driver.isAdmin,
    });

    return Response.json(responseData);
  } catch (error) {
    console.error("❌ Error in driver-auth:", error);
    return Response.json(
      { error: "Authentication failed. Please try again." },
      { status: 500 },
    );
  }
}
