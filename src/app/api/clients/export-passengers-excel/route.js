import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const tenantId = 1;

    // Get all unique clients that have at least one trip (any status)
    const clients = await sql`
      SELECT DISTINCT
        c.id,
        c.name,
        c.email,
        c.phone
      FROM clients c
      INNER JOIN appointments a ON c.id = a.client_id
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.name
    `;

    // CSV header
    const header = "First Name,Last Name,Phone Number,Email,Company,Role";

    // Build rows
    const rows = clients.map((c) => {
      const fullName = (c.name || "").trim();
      const spaceIndex = fullName.indexOf(" ");
      const firstName =
        spaceIndex === -1 ? fullName : fullName.slice(0, spaceIndex);
      const lastName =
        spaceIndex === -1 ? "" : fullName.slice(spaceIndex + 1).trim();

      // Escape fields that might contain commas or quotes
      const esc = (val) => {
        const s = (val || "").toString().trim();
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      return [
        esc(firstName),
        esc(lastName),
        esc(c.phone),
        esc(c.email),
        "", // Company — blank
        "", // Role — blank
      ].join(",");
    });

    const csvContent = [header, ...rows].join("\r\n");

    const date = new Date().toISOString().slice(0, 10);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="passengers-${date}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Export Passengers] Error:", error);
    return Response.json(
      { error: "Export failed: " + error.message },
      { status: 500 },
    );
  }
}
