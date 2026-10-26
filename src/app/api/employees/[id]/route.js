import sql from "@/app/api/utils/sql";
import { buildAddress, parseAddress } from "@/app/api/utils/address-parser";

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const employee =
      await sql`SELECT * FROM employees WHERE id = ${id} AND tenant_id = 1`;
    if (employee.length === 0)
      return Response.json({ error: "Not found" }, { status: 404 });

    const workingHours =
      await sql`SELECT * FROM working_hours WHERE employee_id = ${id} ORDER BY day_of_week ASC`;
    const blockedTimes =
      await sql`SELECT * FROM blocked_times WHERE employee_id = ${id} AND (is_deleted = false OR is_deleted IS NULL) ORDER BY start_time ASC`;

    // Include password status (but not the actual hash)
    const result = {
      ...employee[0],
      password: employee[0].password ? "***" : null, // Indicate if password is set without exposing hash
      workingHours,
      blockedTimes,
    };

    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch employee" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    const fields = Object.keys(body).filter((k) =>
      [
        "name",
        "first_name",
        "last_name",
        "email",
        "phone",
        "address",
        "street_address",
        "city",
        "state",
        "zip_code",
        "notes",
        "color",
        "salary_rate",
        "is_active",
        "rotation_order",
        "profile_image_url",
        "copy_communications_to_company",
        "is_admin",
        "force_password_reset",
        "adp_worker_id",
        "can_cancel_trip",
        "hourly_rate",
        "is_tour_agent",
        "is_driver",
      ].includes(k),
    );

    // Handle password update - plain text
    if (body.new_password && body.new_password.trim() !== "") {
      body.password = body.new_password;
      fields.push("password");

      // When setting a new password, typically we clear the force_password_reset flag
      // unless it's explicitly being set to true in this same request
      if (!fields.includes("force_password_reset")) {
        body.force_password_reset = false;
        fields.push("force_password_reset");
      }
    }

    if (fields.length === 0)
      return Response.json({ error: "No fields to update" }, { status: 400 });

    // If first_name or last_name is being updated, rebuild the full name
    if (body.first_name !== undefined || body.last_name !== undefined) {
      // Fetch current employee data to fill in missing name parts
      const [current] =
        await sql`SELECT first_name, last_name FROM employees WHERE id = ${id}`;
      const firstName =
        body.first_name !== undefined
          ? body.first_name
          : current?.first_name || "";
      const lastName =
        body.last_name !== undefined
          ? body.last_name
          : current?.last_name || "";
      body.name = `${firstName} ${lastName}`.trim();
      if (!fields.includes("name")) fields.push("name");
    }

    // If legacy 'address' field is provided, parse it into structured fields
    if (body.address && !body.street_address) {
      const parsed = parseAddress(body.address);
      body.street_address = parsed.street_address;
      body.city = parsed.city;
      body.state = parsed.state;
      body.zip_code = parsed.zip_code;

      // Add structured fields to update list
      if (!fields.includes("street_address")) fields.push("street_address");
      if (!fields.includes("city")) fields.push("city");
      if (!fields.includes("state")) fields.push("state");
      if (!fields.includes("zip_code")) fields.push("zip_code");
    }

    // Also rebuild address field from structured components if they're provided
    if (body.street_address || body.city || body.state || body.zip_code) {
      body.address = buildAddress({
        street_address: body.street_address,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
      });
      if (!fields.includes("address")) fields.push("address");
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    const values = fields.map((f) => body[f]);

    const result = await sql(
      `UPDATE employees SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = 1 RETURNING *`,
      [...values, id],
    );

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update employee" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    // Check for upcoming appointments (future trips)
    const upcomingTrips = await sql`
      SELECT id, booking_number, start_time, destination, dropoff_address, dropoff_city
      FROM appointments
      WHERE employee_id = ${id}
        AND start_time >= NOW()
        AND status NOT IN ('cancelled', 'canceled', 'deleted')
      ORDER BY start_time ASC
    `;

    if (upcomingTrips.length > 0) {
      return Response.json(
        {
          error: "Cannot delete driver with upcoming trips",
          hasUpcomingTrips: true,
          trips: upcomingTrips,
        },
        { status: 409 },
      );
    }

    // Check if driver has ANY trips (past or future)
    const allTrips = await sql`
      SELECT COUNT(*) as count
      FROM appointments
      WHERE employee_id = ${id}
    `;

    const tripCount = parseInt(allTrips[0].count);

    if (tripCount === 0) {
      // No trips at all — safe to permanently delete
      await sql`DELETE FROM employees WHERE id = ${id} AND tenant_id = 1`;
      return Response.json({
        success: true,
        deleted: true,
        note: "Driver permanently deleted (no trips were associated).",
      });
    }

    // Has past trips — soft delete to preserve history
    await sql`UPDATE employees SET is_active = false WHERE id = ${id} AND tenant_id = 1`;

    return Response.json({
      success: true,
      deleted: false,
      note: "Driver deactivated. All historical data preserved.",
    });
  } catch (error) {
    console.error("Failed to delete employee:", error);
    return Response.json(
      { error: "Failed to delete employee", details: error.message },
      { status: 500 },
    );
  }
}
