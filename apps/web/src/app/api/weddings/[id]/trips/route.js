import sql from "@/app/api/utils/sql";

// POST /api/weddings/[id]/trips - Add a trip to a wedding
export async function POST(request, { params }) {
  try {
    const { id: weddingId } = params;
    const body = await request.json();
    const { appointment_id } = body;

    if (!appointment_id) {
      return Response.json(
        { error: "appointment_id is required" },
        { status: 400 },
      );
    }

    // Verify the wedding exists
    const [wedding] = await sql`
      SELECT * FROM weddings WHERE id = ${weddingId}
    `;

    if (!wedding) {
      return Response.json({ error: "Wedding not found" }, { status: 404 });
    }

    // Block adding trips to a paid wedding
    if (wedding.payment_status === "paid") {
      return Response.json(
        { error: "Cannot add trips to a paid wedding" },
        { status: 400 },
      );
    }

    // Block adding trips to a past wedding
    if (wedding.wedding_date && new Date(wedding.wedding_date) < new Date()) {
      return Response.json(
        {
          error: "Cannot add trips to a wedding whose date has already passed",
        },
        { status: 400 },
      );
    }

    // Verify the appointment exists
    const [appointment] = await sql`
      SELECT * FROM appointments WHERE id = ${appointment_id}
    `;

    if (!appointment) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Link the appointment to the wedding
    await sql`
      UPDATE appointments
      SET wedding_id = ${weddingId}
      WHERE id = ${appointment_id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error adding trip to wedding:", error);
    return Response.json(
      { error: "Failed to add trip to wedding" },
      { status: 500 },
    );
  }
}

// DELETE /api/weddings/[id]/trips - Remove a trip from a wedding
export async function DELETE(request, { params }) {
  try {
    const { id: weddingId } = params;
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get("appointment_id");

    if (!appointmentId) {
      return Response.json(
        { error: "appointment_id is required" },
        { status: 400 },
      );
    }

    // Unlink the appointment from the wedding
    await sql`
      UPDATE appointments
      SET wedding_id = NULL
      WHERE id = ${appointmentId} AND wedding_id = ${weddingId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error removing trip from wedding:", error);
    return Response.json(
      { error: "Failed to remove trip from wedding" },
      { status: 500 },
    );
  }
}
