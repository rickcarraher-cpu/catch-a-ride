import sql from "@/app/api/utils/sql";
import { recalculateAllCachedFields } from "@/app/api/utils/cached-calculations";

/**
 * POST /api/appointments/[id]/recalculate
 *
 * Manually trigger recalculation of cached payment fields for a trip.
 * This will fix inconsistencies like payment_date existing when balance_due > 0.
 */
export async function POST(request, { params }) {
  const { id } = params;

  try {
    const appointmentId = parseInt(id);

    if (isNaN(appointmentId)) {
      return Response.json(
        { error: "Invalid appointment ID" },
        { status: 400 },
      );
    }

    // Verify the appointment exists
    const [appointment] = await sql`
      SELECT id FROM appointments WHERE id = ${appointmentId} AND tenant_id = 1
    `;

    if (!appointment) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Recalculate ALL cached fields: services_total, original_amount, driver_commission, payments, balance
    const result = await recalculateAllCachedFields(appointmentId);

    console.log(
      `[Recalculate] Trip #${appointmentId}: Manual recalculation triggered`,
      result,
    );

    return Response.json({
      success: true,
      message: "Payment fields recalculated successfully",
      data: result,
    });
  } catch (error) {
    console.error("[Recalculate] Error:", error);
    return Response.json(
      {
        error: "Failed to recalculate payment fields",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
