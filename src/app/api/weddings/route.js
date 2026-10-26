import sql from "@/app/api/utils/sql";

// GET /api/weddings - List all weddings
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") || "upcoming";
    const tenantId = 1;

    let dateFilter = "";
    if (window === "upcoming") {
      dateFilter = "AND w.wedding_date >= NOW()";
    } else if (window === "past") {
      dateFilter = "AND w.wedding_date < NOW()";
    }
    // 'all' - no additional filter

    const weddings = await sql(
      `SELECT 
        w.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email,
        COUNT(DISTINCT a.id) as trip_count,
        SUM(a.services_total) as trips_total,
        SUM(a.payments_total) as total_paid
      FROM weddings w
      LEFT JOIN clients c ON w.client_id = c.id
      LEFT JOIN appointments a ON a.wedding_id = w.id
      WHERE w.tenant_id = $1
        ${dateFilter}
      GROUP BY w.id, c.name, c.phone, c.email
      ORDER BY w.wedding_date DESC`,
      [tenantId],
    );

    return Response.json(weddings);
  } catch (error) {
    console.error("Error fetching weddings:", error);
    return Response.json(
      { error: "Failed to fetch weddings" },
      { status: 500 },
    );
  }
}

// POST /api/weddings - Create a new wedding
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      client_id,
      venue_name,
      venue_address,
      wedding_date,
      coordinator_name,
      coordinator_phone,
      coordinator_email,
      special_instructions,
      package_price,
    } = body;

    if (!venue_name || !wedding_date) {
      return Response.json(
        { error: "Venue name and wedding date are required" },
        { status: 400 },
      );
    }

    const [wedding] = await sql`
      INSERT INTO weddings (
        tenant_id,
        client_id,
        venue_name,
        venue_address,
        wedding_date,
        coordinator_name,
        coordinator_phone,
        coordinator_email,
        special_instructions,
        package_price
      ) VALUES (
        1,
        ${client_id || null},
        ${venue_name},
        ${venue_address || null},
        ${wedding_date},
        ${coordinator_name || null},
        ${coordinator_phone || null},
        ${coordinator_email || null},
        ${special_instructions || null},
        ${package_price || 0}
      )
      RETURNING *
    `;

    return Response.json({ success: true, wedding });
  } catch (error) {
    console.error("Error creating wedding:", error);
    return Response.json(
      { error: "Failed to create wedding" },
      { status: 500 },
    );
  }
}
