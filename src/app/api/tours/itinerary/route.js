import sql from "@/app/api/utils/sql";

// GET - List all itinerary items for a tour
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

    const itinerary = await sql`
      SELECT *
      FROM tour_itinerary
      WHERE appointment_id = ${appointmentId}
      ORDER BY sequence_order
    `;

    return Response.json({ itinerary });
  } catch (error) {
    console.error("Error fetching tour itinerary:", error);
    return Response.json(
      { error: "Failed to fetch tour itinerary" },
      { status: 500 },
    );
  }
}

// POST - Add an itinerary item to a tour OR batch-fetch itinerary for multiple tours
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
      const itinerary = await sql(
        `SELECT * FROM tour_itinerary
         WHERE appointment_id IN (${placeholders})
         ORDER BY appointment_id, sequence_order`,
        tour_ids,
      );

      return Response.json(itinerary);
    }

    // Add itinerary item mode: { appointment_id, sequence_order, location, ... }
    const { appointment_id, sequence_order, location, description } = body;

    if (!appointment_id || sequence_order === undefined || !location) {
      return Response.json(
        {
          error: "appointment_id, sequence_order, and location are required",
        },
        { status: 400 },
      );
    }

    const result = await sql`
      INSERT INTO tour_itinerary (
        appointment_id,
        sequence_order,
        location,
        description
      ) VALUES (
        ${appointment_id},
        ${sequence_order},
        ${location},
        ${description || null}
      )
      RETURNING *
    `;

    return Response.json({ itinerary_item: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Error in tour itinerary POST:", error);
    return Response.json(
      { error: "Failed to process tour itinerary request" },
      { status: 500 },
    );
  }
}

// PUT - Update itinerary items (batch update)
export async function PUT(request) {
  try {
    const body = await request.json();
    const { appointment_id, items } = body;

    if (!appointment_id || !items || !Array.isArray(items)) {
      return Response.json(
        { error: "appointment_id and items array are required" },
        { status: 400 },
      );
    }

    // Delete existing items
    await sql`DELETE FROM tour_itinerary WHERE appointment_id = ${appointment_id}`;

    // Insert new items using proper parameter binding
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await sql`
          INSERT INTO tour_itinerary (appointment_id, sequence_order, location, description)
          VALUES (
            ${appointment_id},
            ${item.sequence_order !== undefined ? item.sequence_order : i + 1},
            ${item.location},
            ${item.description || null}
          )
        `;
      }
    }

    const updatedItinerary = await sql`
      SELECT *
      FROM tour_itinerary
      WHERE appointment_id = ${appointment_id}
      ORDER BY sequence_order
    `;

    return Response.json({ itinerary: updatedItinerary });
  } catch (error) {
    console.error("Error updating tour itinerary:", error);
    return Response.json(
      { error: "Failed to update tour itinerary" },
      { status: 500 },
    );
  }
}

// DELETE - Remove an itinerary item
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    await sql`DELETE FROM tour_itinerary WHERE id = ${id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting tour itinerary item:", error);
    return Response.json(
      { error: "Failed to delete tour itinerary item" },
      { status: 500 },
    );
  }
}
