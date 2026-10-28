import sql from "@/app/api/utils/sql";
import { recalculateDisplayFields } from "@/app/api/utils/cached-display-fields";

/**
 * Recalculate display fields for all appointments or a specific appointment
 * This is useful after fixing date formatting logic
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { appointmentId } = body;

    if (appointmentId) {
      // Recalculate for a single appointment
      await recalculateDisplayFields(appointmentId);
      return Response.json({
        success: true,
        message: `Display fields recalculated for appointment ${appointmentId}`,
      });
    } else {
      // Recalculate for all appointments with return_date
      const appointments = await sql`
        SELECT id FROM appointments 
        WHERE return_date IS NOT NULL
        ORDER BY id
      `;

      let count = 0;
      for (const appt of appointments) {
        await recalculateDisplayFields(appt.id);
        count++;
      }

      return Response.json({
        success: true,
        message: `Display fields recalculated for ${count} appointments`,
        count,
      });
    }
  } catch (error) {
    console.error("Error recalculating display fields:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
