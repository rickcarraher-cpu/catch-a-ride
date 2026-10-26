import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const categories = await sql`
      SELECT id, name, display_order, is_active, created_at
      FROM vehicle_categories
      WHERE is_active = true
      ORDER BY display_order ASC, name ASC
    `;

    return Response.json({ categories });
  } catch (error) {
    console.error("Error fetching vehicle categories:", error);
    return Response.json(
      { error: "Failed to fetch vehicle categories" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const { name, display_order = 0 } = await request.json();

    if (!name || !name.trim()) {
      return Response.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    const [category] = await sql`
      INSERT INTO vehicle_categories (name, display_order)
      VALUES (${name.trim()}, ${display_order})
      RETURNING id, name, display_order, is_active, created_at
    `;

    return Response.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle category:", error);
    if (error.message?.includes("duplicate key")) {
      return Response.json(
        { error: "A category with this name already exists" },
        { status: 409 },
      );
    }
    return Response.json(
      { error: "Failed to create vehicle category" },
      { status: 500 },
    );
  }
}
