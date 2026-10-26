/**
 * POST /api/schedule-timeline/notify-send
 *
 * Sends notifications for a SINGLE trip.
 * The caller is responsible for spacing multiple calls 10 seconds apart.
 *
 * Chunk 7 — Notification layer for the dispatch timeline.
 * The 10-second inter-trip delay lives in the client-side send loop so each
 * request here stays fast and stateless. Failure on one trip never blocks
 * another — the caller loops and records failures independently.
 *
 * Honours all existing suppression rules:
 *   driver_portal_only, suppress_driver_confirmations, notification_preference
 * Logs failures to communication_failures exactly as the existing path does.
 */

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

export async function POST(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const body = await request.json();
    const { trip_id } = body;

    if (!trip_id) {
      return Response.json({ error: "trip_id is required" }, { status: 400 });
    }

    // Verify the trip exists and is not cancelled/deleted
    const [trip] = await sql`
      SELECT id, booking_number, status, employee_id
      FROM appointments
      WHERE id = ${trip_id}
    `;

    if (!trip) {
      return Response.json(
        { success: false, error: "Trip not found" },
        { status: 404 },
      );
    }

    if (
      trip.status === "cancelled" ||
      trip.status === "canceled" ||
      trip.status === "deleted"
    ) {
      console.log(
        `[notify-send] ⏭️ Skipping trip #${trip_id} — status is ${trip.status}`,
      );
      return Response.json({
        success: false,
        skipped: true,
        trip_id,
        booking_number: trip.booking_number,
        reason: `Trip status is ${trip.status}`,
      });
    }

    console.log(
      `[notify-send] 📬 Sending notifications for trip #${trip.booking_number || trip_id}`,
    );

    // Delegate to the same confirmationService used everywhere else.
    // It honours driver_portal_only, suppress_driver_confirmations,
    // notification_preference, and logs communication failures internally.
    const result = await sendConfirmations({
      appointmentId: trip_id,
      eventType: "driver_assigned",
      notifyPassenger: true,
      notifyDriver: true,
      notifyOffice: true,
    });

    console.log(
      `[notify-send] ✅ Done for trip #${trip.booking_number || trip_id}`,
    );

    return Response.json({
      success: true,
      trip_id,
      booking_number: trip.booking_number,
      results: result.results,
    });
  } catch (error) {
    console.error("[notify-send] ❌ Error:", error);
    // Return 200 so the client can distinguish "this trip failed" from
    // "network error / auth error" — the loop continues either way.
    return Response.json({
      success: false,
      trip_id: null,
      error: error.message,
    });
  }
}
