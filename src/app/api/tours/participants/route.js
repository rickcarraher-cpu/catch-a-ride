import sql from "@/app/api/utils/sql";

// GET - List all participants for a tour
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointment_id");

    if (!appointmentId) {
      return Response.json(
        { error: "appointment_id is required" },
        { status: 400 },
      );
    }

    const participants = await sql`
      SELECT 
        tp.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email
      FROM tour_participants tp
      LEFT JOIN clients c ON tp.client_id = c.id
      WHERE tp.appointment_id = ${appointmentId}
      ORDER BY tp.created_at
    `;

    return Response.json({ participants });
  } catch (error) {
    console.error("Error fetching tour participants:", error);
    return Response.json(
      { error: "Failed to fetch tour participants" },
      { status: 500 },
    );
  }
}

// POST - Add a participant to a tour OR batch-fetch participants for multiple tours
export async function POST(request) {
  try {
    const body = await request.json();

    // Batch fetch mode: { tour_ids: [1, 2, 3] }
    if (body.tour_ids && Array.isArray(body.tour_ids)) {
      const { tour_ids } = body;

      if (tour_ids.length === 0) {
        return Response.json([]);
      }

      const placeholders = tour_ids.map((_, i) => `$${i + 1}`).join(", ");
      const participants = await sql(
        `SELECT * FROM tour_participants
         WHERE appointment_id IN (${placeholders})
         ORDER BY appointment_id, id`,
        tour_ids,
      );

      return Response.json(participants);
    }

    // Add participant mode: { appointment_id, participant_type, name, ... }
    const {
      appointment_id,
      participant_type,
      client_id,
      name,
      phone,
      email,
      pickup_location,
      dropoff_location,
    } = body;

    if (!appointment_id || !participant_type || !name) {
      return Response.json(
        {
          error: "appointment_id, participant_type, and name are required",
        },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO tour_participants (
        appointment_id,
        participant_type,
        client_id,
        name,
        phone,
        email,
        pickup_location,
        dropoff_location
      ) VALUES (
        ${appointment_id},
        ${participant_type},
        ${client_id || null},
        ${name},
        ${phone || null},
        ${email || null},
        ${pickup_location || null},
        ${dropoff_location || null}
      )
      RETURNING *
    `;

    return Response.json({ participant: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error in tour participants POST:", error);
    return Response.json(
      { error: "Failed to process tour participants request" },
      { status: 500 },
    );
  }
}

// PATCH - Update an existing participant
export async function PATCH(request) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      phone,
      email,
      pickup_location,
      dropoff_location,
      participant_type,
    } = body;

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(phone || null);
    }
    if (email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }
    if (pickup_location !== undefined) {
      setClauses.push(`pickup_location = $${paramIndex++}`);
      values.push(pickup_location || null);
    }
    if (dropoff_location !== undefined) {
      setClauses.push(`dropoff_location = $${paramIndex++}`);
      values.push(dropoff_location || null);
    }
    if (participant_type !== undefined) {
      setClauses.push(`participant_type = $${paramIndex++}`);
      values.push(participant_type);
    }

    if (setClauses.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const result = await sql(
      `UPDATE tour_participants SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values,
    );

    if (result.length === 0) {
      return Response.json({ error: "Participant not found" }, { status: 404 });
    }

    return Response.json({ participant: result[0] });
  } catch (error) {
    console.error("Error updating tour participant:", error);
    return Response.json(
      { error: "Failed to update tour participant" },
      { status: 500 },
    );
  }
}

// DELETE - Remove a participant from a tour
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    await sql`DELETE FROM tour_participants WHERE id = ${id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting tour participant:", error);
    return Response.json(
      { error: "Failed to delete tour participant" },
      { status: 500 },
    );
  }
}
