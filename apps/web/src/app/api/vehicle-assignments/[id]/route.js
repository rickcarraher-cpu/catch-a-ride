import sql from "@/app/api/utils/sql";

// PATCH /api/vehicle-assignments/[id] — update vehicle-specific profile
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const { profile_image_url, profile_description } = await request.json();

    const [updated] = await sql`
      UPDATE vehicle_assignments
      SET profile_image_url = ${profile_image_url || null},
          profile_description = ${profile_description || null}
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updated) {
      return Response.json(
        { error: "Vehicle assignment not found" },
        { status: 404 },
      );
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Failed to update vehicle assignment:", error);
    return Response.json(
      { error: "Failed to update vehicle assignment" },
      { status: 500 },
    );
  }
}
