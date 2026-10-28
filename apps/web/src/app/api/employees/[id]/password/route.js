import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json(
        { error: "Employee ID is required" },
        { status: 400 },
      );
    }

    // Get employee password status (not the hash itself)
    const employees = await sql`
      SELECT password
      FROM employees
      WHERE id = ${id}
        AND tenant_id = 1
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    const employee = employees[0];

    return Response.json({
      hasPassword: !!employee.password,
    });
  } catch (error) {
    console.error("Error fetching employee password:", error);
    return Response.json(
      { error: "Failed to fetch password" },
      { status: 500 },
    );
  }
}
