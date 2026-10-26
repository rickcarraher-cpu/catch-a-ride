import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const session = await auth();

    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the authenticated employee
    const employees = await sql`
      SELECT id, name, email, is_active
      FROM employees
      WHERE LOWER(email) = LOWER(${session.user.email})
        AND tenant_id = 1
        AND is_active = true
      LIMIT 1
    `;

    if (employees.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    const employee = employees[0];
    const { decision } = await request.json();

    if (!decision || !["accepted", "declined"].includes(decision)) {
      return Response.json(
        { error: "Invalid decision. Must be 'accepted' or 'declined'" },
        { status: 400 },
      );
    }

    // Get the trip and verify it belongs to this driver
    const trips = await sql`
      SELECT id, employee_id, driver_accepted, booking_number, start_time
      FROM appointments
      WHERE id = ${id}
        AND tenant_id = 1
      LIMIT 1
    `;

    if (trips.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = trips[0];

    // Verify this trip is assigned to the authenticated driver
    if (trip.employee_id !== employee.id) {
      return Response.json(
        { error: "This trip is not assigned to you" },
        { status: 403 },
      );
    }

    // Only allow responding to pending trips
    if (trip.driver_accepted && trip.driver_accepted !== "pending") {
      return Response.json(
        { error: "This trip has already been responded to" },
        { status: 400 },
      );
    }

    // Update the trip with driver's response
    const now = new Date().toISOString();
    await sql`
      UPDATE appointments
      SET driver_accepted = ${decision},
          driver_response_at = ${now},
          driver_declined_reason = ${decision === "declined" ? "Declined via driver portal" : null}
      WHERE id = ${id}
        AND tenant_id = 1
    `;

    return Response.json({
      success: true,
      decision,
      message:
        decision === "accepted"
          ? "Trip accepted successfully"
          : "Trip declined successfully",
    });
  } catch (error) {
    console.error("Error responding to trip:", error);
    return Response.json(
      { error: "Failed to respond to trip" },
      { status: 500 },
    );
  }
}
