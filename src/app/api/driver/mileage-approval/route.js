import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sendEmail } from "@/app/api/utils/send-email";

// Submit dispatcher approval for individual trips
export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { startDate, endDate, approvals } = await request.json();

    if (!startDate || !endDate || !Array.isArray(approvals)) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Group approvals by driver
    const driverApprovals = {};
    approvals.forEach(({ driverId, tripId }) => {
      if (!driverApprovals[driverId]) {
        driverApprovals[driverId] = [];
      }
      driverApprovals[driverId].push(tripId);
    });

    // For each driver, store their approved trip IDs
    const results = [];
    for (const [driverId, tripIds] of Object.entries(driverApprovals)) {
      const result = await sql`
        INSERT INTO driver_mileage_approvals (
          employee_id,
          start_date,
          end_date,
          approval_status,
          approved_trip_ids,
          submitted_at,
          reviewed_at
        ) VALUES (
          ${parseInt(driverId)},
          ${startDate}::date,
          ${endDate}::date,
          'approved',
          ${JSON.stringify(tripIds)}::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (employee_id, start_date, end_date)
        DO UPDATE SET
          approval_status = 'approved',
          approved_trip_ids = ${JSON.stringify(tripIds)}::jsonb,
          reviewed_at = NOW()
        RETURNING *
      `;

      results.push(result[0]);
    }

    // Send email notification to bookings@catcharide.us
    const emailSubject = `Trip Approvals Submitted - ${approvals.length} trips`;

    const emailHtml = `
      <h2>Dispatcher Trip Approvals</h2>
      <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
      <p><strong>Approved Trips:</strong> ${approvals.length}</p>
      <p>The following trips have been approved for driver payment:</p>
      <ul>
        ${approvals.map((a) => `<li>Driver ID ${a.driverId}, Trip ID ${a.tripId}</li>`).join("")}
      </ul>
    `;

    const emailText = `
Dispatcher Trip Approvals

Period: ${startDate} to ${endDate}
Approved Trips: ${approvals.length}

The following trips have been approved for driver payment:
${approvals.map((a) => `- Driver ID ${a.driverId}, Trip ID ${a.tripId}`).join("\n")}
    `;

    try {
      await sendEmail({
        to: ["bookings@catcharide.us"],
        from: "Catch A Ride <bookings@catcharide.us>",
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Don't fail the request if email fails
    }

    return Response.json({
      success: true,
      approvedCount: approvals.length,
      driversAffected: results.length,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to submit approvals" },
      { status: 500 },
    );
  }
}

// Get approval status for a period
export async function GET(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = session.user.email;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return Response.json(
        { error: "Missing date parameters" },
        { status: 400 },
      );
    }

    // Get employee by email
    const employees = await sql`
      SELECT id
      FROM employees
      WHERE LOWER(email) = LOWER(${userEmail})
        AND tenant_id = 1
        AND is_active = true
    `;

    if (employees.length === 0) {
      return Response.json(
        { error: "No driver account found for this email" },
        { status: 404 },
      );
    }

    const employee = employees[0];

    // Get approval record
    const approvals = await sql`
      SELECT *
      FROM driver_mileage_approvals
      WHERE employee_id = ${employee.id}
        AND start_date = ${startDate}
        AND end_date = ${endDate}
    `;

    return Response.json({
      approval: approvals[0] || null,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch approval status" },
      { status: 500 },
    );
  }
}
