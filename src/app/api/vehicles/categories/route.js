import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    // Fetch vehicle categories from the vehicle_categories settings table
    // (managed via Settings > Vehicle Categories)
    const categories = await sql`
      SELECT name
      FROM vehicle_categories
      WHERE is_active = true
      ORDER BY display_order ASC, name ASC
    `;

    const categoryList = categories.map((row) => row.name);

    return Response.json({ categories: categoryList });
  } catch (error) {
    console.error("Error fetching vehicle categories:", error);
    return Response.json(
      { error: "Failed to fetch vehicle categories" },
      { status: 500 },
    );
  }
}
