import sql from "@/app/api/utils/sql";

// GET /api/weddings/[id] - Get a single wedding with all trips
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const [wedding] = await sql`
      SELECT 
        w.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email
      FROM weddings w
      LEFT JOIN clients c ON w.client_id = c.id
      WHERE w.id = ${id}
    `;

    if (!wedding) {
      return Response.json({ error: "Wedding not found" }, { status: 404 });
    }

    // Get all trips for this wedding
    const trips = await sql`
      SELECT 
        a.*,
        e.name as employee_name,
        v.name as vehicle_name
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.wedding_id = ${id}
      ORDER BY a.start_time
    `;

    return Response.json({ ...wedding, trips });
  } catch (error) {
    console.error("Error fetching wedding:", error);
    return Response.json({ error: "Failed to fetch wedding" }, { status: 500 });
  }
}

// PATCH /api/weddings/[id] - Update a wedding
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
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
      payment_status,
      payment_date,
      payment_method,
    } = body;

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (venue_name !== undefined) {
      updateFields.push(`venue_name = $${paramCount++}`);
      values.push(venue_name);
    }
    if (venue_address !== undefined) {
      updateFields.push(`venue_address = $${paramCount++}`);
      values.push(venue_address || null);
    }
    if (wedding_date !== undefined) {
      updateFields.push(`wedding_date = $${paramCount++}`);
      values.push(wedding_date);
    }
    if (client_id !== undefined) {
      updateFields.push(`client_id = $${paramCount++}`);
      values.push(client_id || null);
    }
    if (coordinator_name !== undefined) {
      updateFields.push(`coordinator_name = $${paramCount++}`);
      values.push(coordinator_name || null);
    }
    if (coordinator_phone !== undefined) {
      updateFields.push(`coordinator_phone = $${paramCount++}`);
      values.push(coordinator_phone || null);
    }
    if (coordinator_email !== undefined) {
      updateFields.push(`coordinator_email = $${paramCount++}`);
      values.push(coordinator_email || null);
    }
    if (special_instructions !== undefined) {
      updateFields.push(`special_instructions = $${paramCount++}`);
      values.push(special_instructions || null);
    }
    if (package_price !== undefined) {
      updateFields.push(`package_price = $${paramCount++}`);
      values.push(package_price || 0);
    }
    if (payment_status !== undefined) {
      updateFields.push(`payment_status = $${paramCount++}`);
      values.push(payment_status);
    }
    if (payment_date !== undefined) {
      updateFields.push(`payment_date = $${paramCount++}`);
      values.push(payment_date || null);
    }
    if (payment_method !== undefined) {
      updateFields.push(`payment_method = $${paramCount++}`);
      values.push(payment_method || null);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length === 1) {
      // Only updated_at
      return Response.json({ success: true, message: "No fields to update" });
    }

    values.push(id);
    const query = `
      UPDATE weddings 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const [wedding] = await sql(query, values);

    return Response.json({ success: true, wedding });
  } catch (error) {
    console.error("Error updating wedding:", error);
    return Response.json(
      { error: "Failed to update wedding" },
      { status: 500 },
    );
  }
}

// DELETE /api/weddings/[id] - Delete a wedding
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // First, unlink all trips from this wedding
    await sql`
      UPDATE appointments
      SET wedding_id = NULL
      WHERE wedding_id = ${id}
    `;

    // Then delete the wedding
    await sql`
      DELETE FROM weddings
      WHERE id = ${id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting wedding:", error);
    return Response.json(
      { error: "Failed to delete wedding" },
      { status: 500 },
    );
  }
}
