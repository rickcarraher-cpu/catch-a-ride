import sql from "@/app/api/utils/sql";

// GET - Get a single partner company
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const result = await sql`
      SELECT * FROM partner_companies WHERE id = ${id}
    `;

    if (result.length === 0) {
      return Response.json(
        { error: "Partner company not found" },
        { status: 404 },
      );
    }

    return Response.json({ company: result[0] });
  } catch (error) {
    console.error("Error fetching partner company:", error);
    return Response.json(
      { error: "Failed to fetch partner company" },
      { status: 500 },
    );
  }
}

// PUT - Update a partner company
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      name,
      logo_url,
      billing_email,
      billing_phone,
      billing_address,
      status,
      notes,
    } = body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (logo_url !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(logo_url || null);
    }
    if (billing_email !== undefined) {
      updates.push(`billing_email = $${paramIndex++}`);
      values.push(billing_email || null);
    }
    if (billing_phone !== undefined) {
      updates.push(`billing_phone = $${paramIndex++}`);
      values.push(billing_phone || null);
    }
    if (billing_address !== undefined) {
      updates.push(`billing_address = $${paramIndex++}`);
      values.push(billing_address || null);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes || null);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE partner_companies 
      SET ${updates.join(", ")} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await sql(query, values);

    if (result.length === 0) {
      return Response.json(
        { error: "Partner company not found" },
        { status: 404 },
      );
    }

    return Response.json({ company: result[0] });
  } catch (error) {
    console.error("Error updating partner company:", error);
    return Response.json(
      { error: "Failed to update partner company" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a partner company
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check if any trips reference this partner
    const tripCheck = await sql`
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE partner_company_id = ${id}
    `;

    if (parseInt(tripCheck[0].count) > 0) {
      return Response.json(
        {
          error:
            "Cannot delete partner company with associated trips. Set status to inactive instead.",
        },
        { status: 400 },
      );
    }

    const result = await sql`
      DELETE FROM partner_companies WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return Response.json(
        { error: "Partner company not found" },
        { status: 404 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting partner company:", error);
    return Response.json(
      { error: "Failed to delete partner company" },
      { status: 500 },
    );
  }
}
