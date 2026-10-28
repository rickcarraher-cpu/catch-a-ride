import sql from "@/app/api/utils/sql";

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name.trim());
    }

    if (body.display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`);
      values.push(body.display_order);
    }

    if (body.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(body.is_active);
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE vehicle_categories
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name, display_order, is_active, created_at
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json({ category: result[0] });
  } catch (error) {
    console.error("Error updating vehicle category:", error);
    if (error.message?.includes("duplicate key")) {
      return Response.json(
        { error: "A category with this name already exists" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Failed to update vehicle category" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if any vehicles use this category
    const vehiclesUsingCategory = await sql`
      SELECT COUNT(*) as count
      FROM vehicles
      WHERE category = (SELECT name FROM vehicle_categories WHERE id = ${id})
    `;

    if (vehiclesUsingCategory[0]?.count > 0) {
      return Response.json(
        {
          error: `Cannot delete category: ${vehiclesUsingCategory[0].count} vehicle(s) are using this category`,
        },
        { status: 409 },
      );
    }

    const result = await sql`
      DELETE FROM vehicle_categories
      WHERE id = ${id}
      RETURNING id, name
    `;

    if (result.length === 0) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json({
      message: "Category deleted successfully",
      category: result[0],
    });
  } catch (error) {
    console.error("Error deleting vehicle category:", error);
    return Response.json(
      { error: "Failed to delete vehicle category" },
      { status: 500 },
    );
  }
}
