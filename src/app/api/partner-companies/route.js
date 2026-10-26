import sql from "@/app/api/utils/sql";

// GET - List all partner companies
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenant_id") || 1;
    const status = searchParams.get("status");

    let query = `
      SELECT * FROM partner_companies 
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY name ASC`;

    const companies = await sql(query, params);

    return Response.json({ companies });
  } catch (error) {
    console.error("Error fetching partner companies:", error);
    return Response.json(
      { error: "Failed to fetch partner companies" },
      { status: 500 },
    );
  }
}

// POST - Create a new partner company
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      tenant_id = 1,
      name,
      logo_url,
      billing_email,
      billing_phone,
      billing_address,
      status = "active",
      notes,
    } = body;

    if (!name) {
      return Response.json(
        { error: "Partner company name is required" },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO partner_companies (
        tenant_id, name, logo_url, billing_email, billing_phone,
        billing_address, status, notes
      ) VALUES (
        ${tenant_id}, ${name}, ${logo_url || null}, ${billing_email || null},
        ${billing_phone || null}, ${billing_address || null}, ${status}, ${notes || null}
      )
      RETURNING *
    `;

    return Response.json({ company: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating partner company:", error);
    return Response.json(
      { error: "Failed to create partner company" },
      { status: 500 },
    );
  }
}
