import { autoCompleteOldTrips } from "@/app/api/utils/auto-complete";

/**
 * Scheduled job to auto-complete old paid trips
 *
 * This endpoint should be called daily (e.g., by a cron job or scheduler like Vercel Cron)
 * to ensure all past trips that are paid are marked as completed.
 *
 * Logic:
 * - Find all trips where:
 *   - status NOT IN ('completed', 'cancelled', 'deleted')
 *   - payment_status = 'paid'
 *   - start_time < NOW()
 * - Mark them as status = 'completed'
 */
export async function POST(request) {
  try {
    console.log("[Auto-Complete Job] Starting daily auto-complete job...");

    const result = await autoCompleteOldTrips();

    if (result.success) {
      console.log(`[Auto-Complete Job] ✅ Completed ${result.count} trip(s)`);
      return Response.json({
        success: true,
        message: `Auto-completed ${result.count} old paid trip(s)`,
        count: result.count,
        trips: result.trips,
      });
    } else {
      console.error("[Auto-Complete Job] ❌ Failed:", result.error);
      return Response.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("[Auto-Complete Job] ❌ Error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Failed to auto-complete trips",
      },
      { status: 500 },
    );
  }
}

// Also support GET for manual testing
export async function GET(request) {
  return POST(request);
}
