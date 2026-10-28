import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if email belongs to an active employee - NO PASSWORD CHECK
    const employees = await sql`
      SELECT id, name, email, is_admin, first_name, last_name, salary_rate, color
      FROM employees
      WHERE LOWER(email) = LOWER(${email})
        AND is_active = true
    `;

    if (employees.length === 0) {
      return Response.json(
        { error: "Email not found or driver is inactive" },
        { status: 404 },
      );
    }

    const driver = employees[0];

    // Return driver info immediately - password check skipped
    return Response.json({
      success: true,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        isAdmin: driver.is_admin || false,
        firstName: driver.first_name,
        lastName: driver.last_name,
        salary_rate:
          driver.salary_rate != null ? Number(driver.salary_rate) : 0.75,
        color: driver.color || "#2563EB",
      },
    });
  } catch (error) {
    console.error("Error verifying driver email:", error);
    return Response.json({ error: "Failed to verify email" }, { status: 500 });
  }
}
