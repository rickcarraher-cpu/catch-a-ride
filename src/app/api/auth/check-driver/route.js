import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if employee exists in employees table (case-insensitive)
    const employees = await sql`
      SELECT 
        id, 
        name, 
        email,
        password,
        is_admin,
        is_active
      FROM employees
      WHERE LOWER(email) = ${normalizedEmail}
        AND tenant_id = 1
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json(
        { error: "Not a valid email address" },
        { status: 404 },
      );
    }

    const employee = employees[0];
    const hasPassword = Boolean(employee.password && employee.password.trim());

    return Response.json({
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email.toLowerCase(),
        isAdmin: Boolean(employee.is_admin),
        isDriver: Boolean(employee.is_active),
      },
      hasPassword,
    });
  } catch (error) {
    console.error("Error checking driver:", error);
    return Response.json(
      { error: "Failed to check email. Please try again." },
      { status: 500 },
    );
  }
}
