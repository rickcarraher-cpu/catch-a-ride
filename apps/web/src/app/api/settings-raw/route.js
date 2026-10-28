import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const settings =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1 ORDER BY key`;
    const locations =
      await sql`SELECT * FROM preferred_locations ORDER BY display_order`;
    return Response.json({ settings, locations });
  } catch (error) {
    console.error("[settings-raw] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
