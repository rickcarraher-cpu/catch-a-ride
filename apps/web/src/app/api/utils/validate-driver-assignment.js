import sql from "@/app/api/utils/sql";

/**
 * Validates if a driver can be assigned to a trip based on blocked/available hours.
 *
 * Logic:
 * 1. If any "blocked" entries overlap the trip → hard block, reject.
 * 2. If any "available" entries exist on the trip's calendar date(s) →
 *    the trip must be fully contained within at least one available window.
 *    (Checked by date overlap, not just time overlap — so a trip at 6pm is
 *    blocked when available windows are 9–12 and 2–5, even though neither
 *    overlaps 6pm.)
 * 3. Otherwise, allow.
 *
 * @param {number} employeeId
 * @param {Date} tripStart
 * @param {Date} tripEnd
 * @returns {Promise<{valid: boolean, reason?: string, conflictingBlocks?: Array}>}
 */
export async function validateDriverAssignment(employeeId, tripStart, tripEnd) {
  if (!employeeId) {
    return { valid: true };
  }

  try {
    const tripStartISO = tripStart.toISOString();
    const tripEndISO = tripEnd.toISOString();

    // ── 1. Hard blocks that overlap the trip window ──────────────────────────
    const hardBlocks = await sql`
      SELECT id, start_time, end_time, type, reason
      FROM blocked_times
      WHERE employee_id = ${employeeId}
        AND (is_deleted = false OR is_deleted IS NULL)
        AND type = 'blocked'
        AND (
          (start_time <= ${tripStartISO}::timestamptz AND end_time >= ${tripStartISO}::timestamptz)
          OR (start_time <= ${tripEndISO}::timestamptz  AND end_time >= ${tripEndISO}::timestamptz)
          OR (start_time >= ${tripStartISO}::timestamptz AND end_time <= ${tripEndISO}::timestamptz)
        )
      ORDER BY start_time ASC
    `;

    if (hardBlocks.length > 0) {
      return {
        valid: false,
        reason: "Driver has blocked time during this trip",
        conflictingBlocks: hardBlocks,
      };
    }

    // ── 2. Available windows on the trip's calendar date(s) ─────────────────
    // We compare calendar dates in Chicago time so that, e.g., a 9am–12pm
    // available window on Oct 14 is found even when the trip is at 6pm–8pm
    // and doesn't overlap those hours.
    const availableWindows = await sql`
      SELECT id, start_time, end_time, type, reason
      FROM blocked_times
      WHERE employee_id = ${employeeId}
        AND (is_deleted = false OR is_deleted IS NULL)
        AND type = 'available'
        AND (start_time AT TIME ZONE 'America/Chicago')::date
              <= (${tripEndISO}::timestamptz AT TIME ZONE 'America/Chicago')::date
        AND (end_time AT TIME ZONE 'America/Chicago')::date
              >= (${tripStartISO}::timestamptz AT TIME ZONE 'America/Chicago')::date
      ORDER BY start_time ASC
    `;

    if (availableWindows.length > 0) {
      // Trip must be fully contained within at least one available window
      const tripFullyCovered = availableWindows.some((block) => {
        const blockStart = new Date(block.start_time);
        const blockEnd = new Date(block.end_time);
        return blockStart <= tripStart && blockEnd >= tripEnd;
      });

      if (!tripFullyCovered) {
        return {
          valid: false,
          reason: "Trip falls outside driver's available hours",
          conflictingBlocks: availableWindows,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error("[validateDriverAssignment] Error:", error);
    // Fail open to avoid blocking operations on transient DB errors
    return { valid: true };
  }
}
