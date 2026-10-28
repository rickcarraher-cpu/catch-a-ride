import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// Get employee info by auth user email
export async function GET(request) {
  try {
    // Check for admin impersonation cookie
    const cookies = request.headers.get("cookie") || "";
    const cookieMatch = cookies.match(/admin_impersonate_driver_id=(\d+)/);

    if (cookieMatch) {
      const driverId = cookieMatch[1];
      const impersonatedDrivers = await sql`
        SELECT id, name, email, phone, color, salary_rate, is_admin, 
               address, city, state, zip_code, force_password_reset, adp_worker_id, is_tour_agent
        FROM employees
        WHERE id = ${driverId}
          AND tenant_id = 1
          AND is_active = true
        LIMIT 1
      `;

      if (impersonatedDrivers.length > 0) {
        return Response.json({ employee: impersonatedDrivers[0] });
      }
    }

    const session = await auth();
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;

    const employees = await sql`
      SELECT id, name, email, phone, color, salary_rate, is_admin, 
             address, city, state, zip_code, force_password_reset, adp_worker_id, is_tour_agent
      FROM employees
      WHERE LOWER(email) = LOWER(${userEmail})
        AND tenant_id = 1
        AND is_active = true
    `;

    if (employees.length === 0) {
      // User is logged in but doesn't have an employee record
      // This is normal for admin users who aren't drivers
      return Response.json({
        employee: null,
        isAdmin: true,
        message: "Admin user without driver profile",
      });
    }

    return Response.json({ employee: employees[0] });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch driver information" },
      { status: 500 },
    );
  }
}
