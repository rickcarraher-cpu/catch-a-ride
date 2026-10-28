import sql from "@/app/api/utils/sql";

/**
 * POST /api/schedule-builder/validate-assignment
 *
 * Validates if a driver can be assigned to a trip based on blocked/available hours.
 *
 * Request body:
 * {
 *   employeeId: number,
 *   tripStartTime: string (ISO timestamp),
 *   tripEndTime: string (ISO timestamp)
 * }
 *
 * Response:
 * {
 *   valid: boolean,
 *   reason?: string,  // If invalid, explains why
 *   conflictingBlocks?: Array<{id, start_time, end_time, type, reason}>
 * }
 */
export async function POST(request) {
  try {
    const { employeeId, tripStartTime, tripEndTime } = await request.json();

    if (!employeeId || !tripStartTime || !tripEndTime) {
      return Response.json(
        { error: "employeeId, tripStartTime, and tripEndTime are required" },
        { status: 400 },
      );
    }

    // Fetch all blocked/available times for this driver that overlap with the trip
    const overlappingBlocks = await sql`
      SELECT id, start_time, end_time, type, reason
      FROM blocked_times
      WHERE employee_id = ${employeeId}
      AND (is_deleted = false OR is_deleted IS NULL)
      AND (
        (start_time <= ${tripStartTime}::timestamptz AND end_time >= ${tripStartTime}::timestamptz)
        OR (start_time <= ${tripEndTime}::timestamptz AND end_time >= ${tripEndTime}::timestamptz)
        OR (start_time >= ${tripStartTime}::timestamptz AND end_time <= ${tripEndTime}::timestamptz)
      )
      ORDER BY start_time ASC
    `;

    // Check for hard blocks (type = 'blocked')
    const hardBlocks = overlappingBlocks.filter((b) => b.type === "blocked");
    if (hardBlocks.length > 0) {
      return Response.json({
        valid: false,
        reason: `Driver has blocked time during this trip`,
        conflictingBlocks: hardBlocks,
      });
    }

    // Check for available hours restrictions (type = 'available')
    const availableBlocks = overlappingBlocks.filter(
      (b) => b.type === "available",
    );

    // If there are ANY available-hour blocks for this driver on this day,
    // the trip MUST be fully contained within one of them
    if (availableBlocks.length > 0) {
      const tripFullyCovered = availableBlocks.some((block) => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        const tripStart = new Date(tripStartTime);
        const tripEnd = new Date(tripEndTime);

        return blockStart <= tripStart && blockEnd >= tripEnd;
      });

      if (!tripFullyCovered) {
        return Response.json({
          valid: false,
          reason: `Trip falls outside driver's available hours`,
          conflictingBlocks: availableBlocks,
        });
      }
    }

    // No conflicts found
    return Response.json({
      valid: true,
    });
  } catch (error) {
    console.error("[validate-assignment] Error:", error);
    return Response.json(
      { error: "Failed to validate assignment" },
      { status: 500 },
    );
  }
}
