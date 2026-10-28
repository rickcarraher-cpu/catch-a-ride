import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);
    const appointmentId = searchParams.get("appointment_id");

    let rows;

    if (appointmentId) {
      rows = await sql`
        SELECT * FROM change_log
        WHERE tenant_id = 1 AND appointment_id = ${appointmentId}
        ORDER BY changed_at DESC
        LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM change_log
        WHERE tenant_id = 1
        ORDER BY changed_at DESC
        LIMIT ${limit}
      `;
    }

    return Response.json({ entries: rows });
  } catch (err) {
    console.error("[GET /api/change-log]", err);
    return Response.json(
      { error: "Failed to fetch change log" },
      { status: 500 },
    );
  }
}
