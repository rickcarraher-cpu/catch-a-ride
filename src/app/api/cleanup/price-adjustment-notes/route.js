import sql from "@/app/api/utils/sql";

/**
 * Cleanup endpoint to remove price adjustment text from appointment notes
 * Price adjustments should only exist in the transactions table, not in notes
 */
export async function POST(request) {
  try {
    // Find all appointments with price adjustment text in notes
    const affectedTrips = await sql`
      SELECT id, booking_number, notes
      FROM appointments
      WHERE notes LIKE '%Price Adjustment:%'
      ORDER BY id
    `;

    if (affectedTrips.length === 0) {
      return Response.json({
        success: true,
        message: "No trips found with price adjustment text in notes",
        cleaned: 0,
      });
    }

    const cleanedTrips = [];
    let updateCount = 0;

    // Process each trip
    for (const trip of affectedTrips) {
      const originalNotes = trip.notes || "";

      // Remove all price adjustment lines
      // Pattern matches: "Price Adjustment: Price increase +$XX.XX" or "Price Adjustment: Discount -$XX.XX"
      let cleanedNotes = originalNotes
        .split("\n")
        .filter((line) => !line.trim().startsWith("Price Adjustment:"))
        .join("\n")
        .trim();

      // Only update if notes actually changed
      if (cleanedNotes !== originalNotes) {
        await sql`
          UPDATE appointments
          SET notes = ${cleanedNotes}
          WHERE id = ${trip.id}
        `;

        cleanedTrips.push({
          id: trip.id,
          booking_number: trip.booking_number,
          before: originalNotes,
          after: cleanedNotes,
        });

        updateCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Successfully cleaned ${updateCount} trip(s)`,
      cleaned: updateCount,
      total_found: affectedTrips.length,
      details: cleanedTrips,
    });
  } catch (error) {
    console.error("Error cleaning price adjustment notes:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to clean price adjustment notes",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET endpoint to preview affected trips without making changes
 */
export async function GET(request) {
  try {
    const affectedTrips = await sql`
      SELECT 
        id,
        booking_number,
        notes,
        start_time,
        client_id
      FROM appointments
      WHERE notes LIKE '%Price Adjustment:%'
      ORDER BY start_time DESC
    `;

    const preview = affectedTrips.map((trip) => {
      const originalNotes = trip.notes || "";
      const cleanedNotes = originalNotes
        .split("\n")
        .filter((line) => !line.trim().startsWith("Price Adjustment:"))
        .join("\n")
        .trim();

      return {
        id: trip.id,
        booking_number: trip.booking_number,
        start_time: trip.start_time,
        before: originalNotes,
        after: cleanedNotes,
        will_change: cleanedNotes !== originalNotes,
      };
    });

    return Response.json({
      success: true,
      total_affected: affectedTrips.length,
      trips: preview,
    });
  } catch (error) {
    console.error("Error previewing price adjustment notes:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to preview affected trips",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
