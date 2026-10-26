import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

// GET /api/driver/approvals-summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns all driver timesheet approval statuses for a date range (admin only)
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return Response.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    // Get all active drivers
    const drivers = await sql`
      SELECT id, name, email, color
      FROM employees
      WHERE tenant_id = 1 AND is_active = true
      ORDER BY name ASC
    `;

    // Get all approval records for this period
    const approvals = await sql`
      SELECT
        dma.id,
        dma.employee_id,
        dma.approval_status,
        dma.driver_comments,
        dma.submitted_at,
        dma.start_date,
        dma.end_date
      FROM driver_mileage_approvals dma
      WHERE dma.start_date = ${startDate}::date
        AND dma.end_date = ${endDate}::date
    `;

    const approvalByDriver = approvals.reduce((acc, a) => {
      acc[a.employee_id] = a;
      return acc;
    }, {});

    const result = drivers.map((driver) => ({
      driver,
      approval: approvalByDriver[driver.id] || null,
    }));

    return Response.json({ drivers: result, startDate, endDate });
  } catch (error) {
    console.error("[approvals-summary] Error:", error);
    return Response.json(
      { error: "Failed to fetch approval summary" },
      { status: 500 },
    );
  }
}
