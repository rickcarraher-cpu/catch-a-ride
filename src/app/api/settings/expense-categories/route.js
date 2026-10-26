import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    // Fetch expense categories from settings
    const result = await sql`
      SELECT value FROM settings 
      WHERE key = 'expense_categories' 
      AND tenant_id = 1
    `;

    if (result.length === 0 || !result[0].value) {
      // Return default categories if not configured yet
      const defaultCategories = [
        { name: "Fuel", display_order: 0 },
        { name: "Maintenance", display_order: 1 },
        { name: "Insurance", display_order: 2 },
        { name: "Salary / Payout", display_order: 3 },
        { name: "Office Supplies", display_order: 4 },
        { name: "Marketing", display_order: 5 },
        { name: "Other", display_order: 6 },
      ];
      return Response.json(defaultCategories);
    }

    const categories = JSON.parse(result[0].value);
    return Response.json(categories);
  } catch (error) {
    console.error("Failed to fetch expense categories:", error);
    return Response.json(
      { error: "Failed to fetch expense categories" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { categories } = body;

    if (!categories || !Array.isArray(categories)) {
      return Response.json(
        { error: "categories must be an array" },
        { status: 400 },
      );
    }

    // Validate categories
    for (const cat of categories) {
      if (!cat.name || typeof cat.name !== "string") {
        return Response.json(
          { error: "Each category must have a name" },
          { status: 400 },
        );
      }
    }

    // Update or insert the setting
    const existing = await sql`
      SELECT id FROM settings 
      WHERE key = 'expense_categories' 
      AND tenant_id = 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE settings 
        SET value = ${JSON.stringify(categories)}
        WHERE key = 'expense_categories' 
        AND tenant_id = 1
      `;
    } else {
      await sql`
        INSERT INTO settings (tenant_id, key, value)
        VALUES (1, 'expense_categories', ${JSON.stringify(categories)})
      `;
    }

    return Response.json({ success: true, categories });
  } catch (error) {
    console.error("Failed to update expense categories:", error);
    return Response.json(
      { error: "Failed to update expense categories" },
      { status: 500 },
    );
  }
}
