import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

/**
 * POST /api/schedule-builder/notify-trip
 *
 * Sends driver + passenger + office confirmations for a single appointment.
 * Called one-at-a-time from the Schedule Builder frontend so the UI can show
 * real-time progress and avoid overwhelming Quo with a burst of outbound SMS.
 *
 * Body: { appointmentId: number }
 */
export async function POST(request) {
  try {
    const { appointmentId } = await request.json();

    if (!appointmentId) {
      return Response.json(
        { error: "appointmentId is required" },
        { status: 400 },
      );
    }

    await sendConfirmations({
      appointmentId,
      eventType: "driver_assigned",
      notifyPassenger: true,
      notifyDriver: true,
      notifyOffice: true,
    });

    console.log(
      `[notify-trip] ✅ Notifications sent for appt #${appointmentId}`,
    );

    return Response.json({ success: true, appointmentId });
  } catch (error) {
    console.error(`[notify-trip] ❌ Failed for appt:`, error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
