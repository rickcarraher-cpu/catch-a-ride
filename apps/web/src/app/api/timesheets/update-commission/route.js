import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { tripId, employeeId, startDate, endDate, newRate, type } = body;

    // type: "trip" or "driver"
    // newRate: decimal between 0 and 1 (e.g., 0.75 for 75%)

    if (!startDate || !endDate) {
      return Response.json(
        { error: "startDate and endDate are required" },
        { status: 400 },
      );
    }

    if (typeof newRate !== "number" || newRate < 0 || newRate > 1) {
      return Response.json(
        { error: "newRate must be a number between 0 and 1" },
        { status: 400 },
      );
    }

    // Check if payroll has been approved (admin_status)
    const approvalCheck = await sql`
      SELECT admin_status FROM timesheet_approvals
      WHERE employee_id = ${parseInt(employeeId)}
        AND start_date = ${startDate}::date
        AND end_date = ${endDate}::date
      LIMIT 1
    `;

    if (
      approvalCheck.length > 0 &&
      approvalCheck[0].admin_status !== "pending"
    ) {
      return Response.json(
        {
          error:
            "Cannot edit commission rate after payroll has been approved or rejected",
        },
        { status: 403 },
      );
    }

    if (type === "trip") {
      // Update individual trip commission rate
      if (!tripId) {
        return Response.json(
          { error: "tripId is required for trip commission update" },
          { status: 400 },
        );
      }

      // Update trip_commission_rate and recalculate driver_commission
      await sql`
        UPDATE appointments
        SET trip_commission_rate = ${newRate},
            driver_commission = services_total * ${newRate}
        WHERE id = ${parseInt(tripId)}
      `;

      return Response.json({
        success: true,
        message: "Trip commission rate updated",
      });
    } else if (type === "driver") {
      // Update driver's default salary_rate
      if (!employeeId) {
        return Response.json(
          { error: "employeeId is required for driver commission update" },
          { status: 400 },
        );
      }

      await sql`
        UPDATE employees
        SET salary_rate = ${newRate}
        WHERE id = ${parseInt(employeeId)}
      `;

      return Response.json({
        success: true,
        message: "Driver default commission rate updated",
      });
    } else {
      return Response.json(
        { error: "type must be 'trip' or 'driver'" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error updating commission rate:", error);
    return Response.json(
      { error: "Failed to update commission rate" },
      { status: 500 },
    );
  }
}
