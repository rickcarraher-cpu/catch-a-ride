/**
 * Email Helper Functions
 * Utilities for parsing and managing email addresses
 */

import sql from "@/app/api/utils/sql";

/**
 * Dedup window for appointment-level email deduplication.
 * Prevents the same notification type from being emailed more than once
 * per appointment per recipient within this window.
 */
const APPOINTMENT_EMAIL_DEDUP_WINDOW_MINUTES = 5;

/**
 * Check if an email for this appointment + recipient + emailType was already
 * sent within the dedup window.  Catches the "rapid edit" scenario where a
 * trip is changed multiple times quickly — each edit triggers notifications
 * but the recipient only needs one.
 *
 * Unlike the subject-based dedup in send-email.js, this check works even when
 * the subject changes between edits (e.g. different booking-number formats).
 *
 * @param {number} appointmentId
 * @param {string} email
 * @param {string} emailType - e.g. "passenger_booking_changed"
 * @returns {Promise<boolean>} true if a duplicate was detected (suppress the send)
 */
export async function wasRecentAppointmentEmailSent(
  appointmentId,
  email,
  emailType,
) {
  if (!appointmentId || !email || !emailType) return false;
  try {
    const normalizedEmail = (email || "").toLowerCase().trim();
    const rows = await sql(
      `SELECT id FROM email_logs
       WHERE appointment_id = $1
         AND LOWER(recipient_email) = $2
         AND email_type = $3
         AND status = 'sent'
         AND sent_at > NOW() - INTERVAL '${APPOINTMENT_EMAIL_DEDUP_WINDOW_MINUTES} minutes'
       LIMIT 1`,
      [appointmentId, normalizedEmail, emailType],
    );
    return rows.length > 0;
  } catch (err) {
    // Fail open — if the check errors, let the email through
    console.error(
      "[wasRecentAppointmentEmailSent] Check failed (failing open):",
      err.message,
    );
    return false;
  }
}

/**
 * Parse and clean email addresses from CSV string
 */
export function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

/**
 * Combine primary email + cc_emails into a single deduped list
 */
export function getAllPassengerEmails(trip) {
  const emails = [];
  if (trip.client_email) {
    emails.push(...parseEmailAddresses(trip.client_email));
  }
  if (trip.cc_emails) {
    emails.push(...parseEmailAddresses(trip.cc_emails));
  }
  const seen = new Set();
  return emails.filter((e) => {
    const lower = e.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Match a trip's pickup/dropoff against preferred locations and return
 * any notification emails configured for matching locations.
 * Returns a deduped array of email addresses (excluding any already in passengerEmails).
 */
export function getLocationNotificationEmails(
  trip,
  preferredLocations,
  passengerEmails = [],
) {
  if (!preferredLocations || preferredLocations.length === 0) return [];

  const matchedEmails = [];
  const passengerSet = new Set(passengerEmails.map((e) => e.toLowerCase()));

  for (const loc of preferredLocations) {
    if (!loc.email) continue;

    let isMatch = false;

    // Check pickup match
    if (matchesLocation(trip, "pickup", loc)) {
      isMatch = true;
    }

    // Check dropoff match
    if (!isMatch && matchesLocation(trip, "dropoff", loc)) {
      isMatch = true;
    }

    if (isMatch) {
      const emails = parseEmailAddresses(loc.email);
      matchedEmails.push(...emails);
    }
  }

  // Dedupe and exclude any passenger emails already being notified
  const seen = new Set();
  return matchedEmails.filter((e) => {
    const lower = e.toLowerCase();
    if (seen.has(lower) || passengerSet.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

/**
 * Check if a trip's pickup or dropoff matches a preferred location
 */
function matchesLocation(trip, direction, location) {
  // 1. Try structured address match (street + city + state)
  const tripStreet = (trip[`${direction}_street`] || "").trim().toLowerCase();
  const tripCity = (trip[`${direction}_city`] || "").trim().toLowerCase();
  const tripState = (trip[`${direction}_state`] || "").trim().toLowerCase();
  const locStreet = (location.street || "").trim().toLowerCase();
  const locCity = (location.city || "").trim().toLowerCase();
  const locState = (location.state || "").trim().toLowerCase();

  if (tripStreet && locStreet && tripCity && locCity) {
    if (
      tripStreet === locStreet &&
      tripCity === locCity &&
      tripState === locState
    ) {
      return true;
    }
  }

  // 2. Check if the full address field contains the location label or street
  const fullAddress = (trip[`${direction}_address`] || "").toLowerCase();
  const locLabel = (location.label || "").toLowerCase();

  if (fullAddress && locLabel && fullAddress.includes(locLabel)) {
    return true;
  }

  if (fullAddress && locStreet && fullAddress.includes(locStreet)) {
    return true;
  }

  // 3. Check the destination field (sometimes used instead of dropoff_address)
  if (direction === "dropoff") {
    const destination = (trip.destination || "").toLowerCase();
    if (destination && locLabel && destination.includes(locLabel)) {
      return true;
    }
    if (destination && locStreet && destination.includes(locStreet)) {
      return true;
    }
  }

  return false;
}
