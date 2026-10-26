/**
 * Schedule Builder Conflict Detection Utilities
 *
 * Handles both "blocked" and "available" time restrictions:
 * - blocked: driver CANNOT work during these hours (hard block)
 * - available: driver can ONLY work during these hours (inverse restriction)
 */

/**
 * Check if a trip conflicts with a driver's blocked/available times
 * @param {Object} trip - Trip object with start_time and duration_minutes
 * @param {number} driverId - Driver employee ID
 * @param {Array} blockedTimes - Array of blocked/available time records
 * @returns {Object} { hasConflict: boolean, reason: string, conflictingBlocks: Array }
 */
export function checkDriverConflict(trip, driverId, blockedTimes) {
  if (!trip || !driverId || !blockedTimes) {
    return { hasConflict: false, reason: null, conflictingBlocks: [] };
  }

  const tripStart = new Date(trip.start_time);
  const tripDuration = trip.duration_minutes || 75;
  const tripEnd = new Date(tripStart.getTime() + tripDuration * 60 * 1000);

  // Filter to this driver's blocks
  const driverBlocks = blockedTimes.filter(
    (bt) => String(bt.employee_id) === String(driverId),
  );

  // Find overlapping blocks
  const overlappingBlocks = driverBlocks.filter((block) => {
    const blockStart = new Date(block.start_time);
    const blockEnd = new Date(block.end_time);

    // Check for any overlap
    return (
      (blockStart <= tripStart && blockEnd >= tripStart) ||
      (blockStart <= tripEnd && blockEnd >= tripEnd) ||
      (blockStart >= tripStart && blockEnd <= tripEnd)
    );
  });

  if (overlappingBlocks.length === 0) {
    // No blocks at all - check if driver has ANY "available" restrictions
    const hasAvailableRestrictions = driverBlocks.some(
      (bt) => bt.type === "available",
    );

    if (hasAvailableRestrictions) {
      // Driver has available-hour restrictions but trip doesn't fall in any of them
      return {
        hasConflict: true,
        reason: "Trip falls outside driver's available hours",
        conflictingBlocks: driverBlocks.filter((bt) => bt.type === "available"),
      };
    }

    return { hasConflict: false, reason: null, conflictingBlocks: [] };
  }

  // Check for hard "blocked" conflicts
  const hardBlocks = overlappingBlocks.filter((b) => b.type === "blocked");
  if (hardBlocks.length > 0) {
    return {
      hasConflict: true,
      reason: "Driver has blocked time during this trip",
      conflictingBlocks: hardBlocks,
    };
  }

  // Check "available" restrictions (inverse logic)
  const availableBlocks = overlappingBlocks.filter(
    (b) => b.type === "available",
  );
  if (availableBlocks.length > 0) {
    // Trip must be fully contained within at least one available block
    const tripFullyCovered = availableBlocks.some((block) => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);
      return blockStart <= tripStart && blockEnd >= tripEnd;
    });

    if (!tripFullyCovered) {
      return {
        hasConflict: true,
        reason: "Trip extends beyond driver's available hours",
        conflictingBlocks: availableBlocks,
      };
    }
  }

  return { hasConflict: false, reason: null, conflictingBlocks: [] };
}

/**
 * Get all trips that have conflicts with their assigned drivers
 * @param {Array} trips - Array of trip objects
 * @param {Array} blockedTimes - Array of blocked/available time records
 * @param {Object} workingAssignments - Map of tripId -> driverId overrides
 * @returns {Set} Set of trip IDs that have conflicts
 */
export function getConflictingTripIds(
  trips,
  blockedTimes,
  workingAssignments = {},
) {
  const conflictingIds = new Set();

  trips.forEach((trip) => {
    const assignedDriverId = workingAssignments[trip.id] ?? trip.employee_id;
    if (!assignedDriverId) return; // Unassigned trips can't conflict

    const { hasConflict } = checkDriverConflict(
      trip,
      assignedDriverId,
      blockedTimes,
    );
    if (hasConflict) {
      conflictingIds.add(trip.id);
    }
  });

  return conflictingIds;
}

/**
 * Check if assigning a trip to a driver would create a conflict
 * @param {Object} trip - Trip object
 * @param {number} targetDriverId - Driver to assign to
 * @param {Array} blockedTimes - Array of blocked/available time records
 * @returns {Object} { canAssign: boolean, reason: string }
 */
export function canAssignTripToDriver(trip, targetDriverId, blockedTimes) {
  if (!targetDriverId || targetDriverId === "unassigned") {
    return { canAssign: true, reason: null };
  }

  const { hasConflict, reason } = checkDriverConflict(
    trip,
    targetDriverId,
    blockedTimes,
  );

  return {
    canAssign: !hasConflict,
    reason: hasConflict ? reason : null,
  };
}
