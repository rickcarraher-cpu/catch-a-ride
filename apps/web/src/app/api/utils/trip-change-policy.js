/**
 * Trip Change Policy
 * No time restrictions - trips can be modified at any time
 */

export function isTripMutable(trip) {
  // No restrictions - all trips are mutable
  return { mutable: true, reason: null };
}

export function assertTripMutable(trip, action = "modify") {
  const { mutable, reason } = isTripMutable(trip);

  if (!mutable) {
    const error = new Error(reason);
    error.code = "TRIP_NOT_MUTABLE";
    error.status = 403;
    throw error;
  }
}

export function canBypassPolicy(userRole) {
  // No policy to bypass - kept for backwards compatibility
  return true;
}
