import sql from "@/app/api/utils/sql";

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      label,
      street,
      city,
      state,
      zip,
      emoji,
      display_order,
      email,
      is_airport = false,
      pickup_dropoff_instructions = null,
    } = body;

    if (!label || !street || !city || !state || !zip) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await sql`
      UPDATE preferred_locations
      SET 
        label = ${label},
        street = ${street},
        city = ${city},
        state = ${state},
        zip = ${zip},
        emoji = ${emoji || "📍"},
        display_order = ${display_order || 0},
        email = ${email || null},
        is_airport = ${is_airport},
        pickup_dropoff_instructions = ${pickup_dropoff_instructions || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }

    return Response.json(result[0]);
  } catch (error) {
    console.error("Failed to update preferred location:", error);
    return Response.json(
      { error: "Failed to update preferred location" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Soft delete by setting is_active to false
    const result = await sql`
      UPDATE preferred_locations
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json({ error: "Location not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete preferred location:", error);
    return Response.json(
      { error: "Failed to delete preferred location" },
      { status: 500 },
    );
  }
}
