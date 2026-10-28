import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const body = await request.json();
    const { type } = body; // 'driver' or 'passenger'

    if (!type || !["driver", "passenger"].includes(type)) {
      return Response.json(
        { error: "Invalid type. Must be 'driver' or 'passenger'" },
        { status: 400 },
      );
    }

    // Fetch the trip to verify it exists
    const [trip] = await sql`
      SELECT id, booking_number, driver_accepted, passenger_confirmed
      FROM appointments
      WHERE id = ${id} AND tenant_id = 1
    `;

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    if (type === "driver") {
      // Force accept driver
      await sql`
        UPDATE appointments
        SET 
          driver_accepted = 'accepted',
          driver_response_at = NOW(),
          driver_declined_reason = NULL
        WHERE id = ${id} AND tenant_id = 1
      `;

      console.log(
        `[Force Confirm] Driver manually accepted for trip #${trip.booking_number} (ID: ${id})`,
      );

      return Response.json({
        success: true,
        message: "Driver marked as accepted",
        trip_id: id,
        booking_number: trip.booking_number,
      });
    } else if (type === "passenger") {
      // Force confirm passenger
      await sql`
        UPDATE appointments
        SET 
          passenger_confirmed = 'confirmed',
          passenger_response_at = NOW(),
          passenger_cancelled_reason = NULL
        WHERE id = ${id} AND tenant_id = 1
      `;

      console.log(
        `[Force Confirm] Passenger manually confirmed for trip #${trip.booking_number} (ID: ${id})`,
      );

      return Response.json({
        success: true,
        message: "Passenger marked as confirmed",
        trip_id: id,
        booking_number: trip.booking_number,
      });
    }
  } catch (error) {
    console.error("Error forcing confirmation:", error);
    return Response.json(
      { error: "Failed to force confirmation" },
      { status: 500 },
    );
  }
}
