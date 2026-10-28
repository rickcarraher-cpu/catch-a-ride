import sql from "@/app/api/utils/sql";

function csvVal(v) {
  if (v == null) return "";
  const s = String(v);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(request) {
  try {
    const tenantId = 1;
    const date = new Date().toISOString().slice(0, 10);

    // Fetch all passengers with all fields
    const rows = await sql`
      SELECT 
        name,
        phone,
        email,
        notes,
        notification_preference,
        street_address,
        city,
        state,
        zip_code
      FROM clients 
      WHERE tenant_id = ${tenantId} 
      ORDER BY name
    `;

    // Create CSV headers (without id for import compatibility)
    const headers = [
      "name",
      "phone",
      "email",
      "notes",
      "notification_preference",
      "street_address",
      "city",
      "state",
      "zip_code",
    ];

    // Create CSV rows
    const csvRows = [headers.join(",")];

    for (const row of rows) {
      const values = headers.map((h) => csvVal(row[h]));
      csvRows.push(values.join(","));
    }

    const csv = csvRows.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="passengers-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Passenger CSV Export]", error);
    return Response.json(
      { error: "Export failed: " + error.message },
      { status: 500 },
    );
  }
}
