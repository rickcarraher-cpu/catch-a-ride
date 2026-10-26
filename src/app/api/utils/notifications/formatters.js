/**
 * Shared formatting utilities for notification emails and SMS messages.
 * ──────────────────────────────────────────────────────────────────────
 * ALL date/time display across the entire app (emails, SMS, calendar
 * links) MUST go through this file so that Central Time is applied
 * exactly once and consistently.
 *
 * Timezone: America/Chicago  (CDT in summer, CST in winter)
 */

const TIMEZONE = "America/Chicago";

// ── internal helper: CDT-aware date parts ──────────────────────────────
function getDatePartsInCDT(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const v = (type) => parts.find((p) => p.type === type)?.value || "00";

  return {
    year: v("year"),
    month: v("month"),
    day: v("day"),
    hour: v("hour") === "24" ? "00" : v("hour"),
    minute: v("minute"),
    second: v("second"),
  };
}

// ── Public formatting functions ────────────────────────────────────────

/**
 * Format a date to a long human-readable string.
 * Example: "Monday, January 15, 2025"
 */
export function formatLongDate(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: TIMEZONE,
    });
  } catch {
    return "N/A";
  }
}

/**
 * Format a date to a short date string.
 * Example: "1/15"
 */
export function formatShortDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      timeZone: TIMEZONE,
    });
  } catch {
    return "";
  }
}

/**
 * Format a date to a time string.
 * Example: "2:30 PM"
 */
export function formatTime(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TIMEZONE,
    });
  } catch {
    return "N/A";
  }
}

/**
 * Format a date to a short time string (same as formatTime but exported separately).
 * Example: "2:30 PM"
 */
export function formatShortTime(dateStr) {
  return formatTime(dateStr);
}

/**
 * Full date + time in one string – used by confirmation emails.
 * Example: "Friday, January 17, 2025 at 2:30 PM"
 */
export function formatFullDateTime(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-US", {
      timeZone: TIMEZONE,
      dateStyle: "full",
      timeStyle: "short",
    });
  } catch {
    return "N/A";
  }
}

/**
 * Format a date-only value (like return_date) in Central Time.
 * For return_date fields that are stored as timestamps, this ensures
 * they are displayed in the correct timezone (America/Chicago).
 * Example: "2026-10-02T00:00:00.000Z" (Oct 1 11PM CDT) → "Wednesday, October 1, 2026"
 */
export function formatDateOnly(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: TIMEZONE,
    });
  } catch {
    return "N/A";
  }
}

/**
 * Compact date + time for SMS messages.
 * Example: "Jan 5, 2:30 PM"
 */
export function formatSmsDateTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      timeZone: TIMEZONE,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Simple date/time for office emails.
 * Example: "1/17/2025, 2:30:00 PM"
 */
export function formatOfficeDateTime(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-US", { timeZone: TIMEZONE });
  } catch {
    return "N/A";
  }
}

/**
 * Convert a Date to Google Calendar format in CENTRAL TIME.
 * Output: "YYYYMMDDTHHmmss" (local CDT/CST time, no Z suffix).
 *
 * ⚠️  Previous version used toISOString() which produced UTC times,
 *     causing Google Calendar events to be off by 5-6 hours.
 */
export function toGCalDate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const parts = getDatePartsInCDT(d);
  if (!parts) return "";
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US).
 * Returns empty string for invalid/empty input.
 */
export function toE164(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // For international numbers that already include country code
  if (digits.length >= 10) return `+${digits}`;
  // Phone number too short — invalid
  return "";
}

/**
 * Format a payment method string for display.
 * Example: "square" → "Credit Card (Square)"
 */
export function formatPaymentMethod(method) {
  if (!method) return "N/A";
  const lower = method.toLowerCase();
  if (lower === "square" || lower === "card") return "Credit Card (Square)";
  if (lower === "credit card" || lower === "square invoice")
    return "Square Invoice";
  if (lower === "venmo") return "Venmo";
  if (lower === "zelle") return "Zelle";
  if (lower === "cash") return "Cash";
  if (lower === "check") return "Check";
  if (lower === "comp") return "🎁 Comp";
  // Title case the original value
  return method.charAt(0).toUpperCase() + method.slice(1);
}

/**
 * ────────────────────────────────────────────────────────────────────────
 * ⚠️ DEPRECATED: CENTRALIZED TRIP ENRICHMENT
 * ────────────────────────────────────────────────────────────────────────
 * These functions are DEPRECATED and should NOT be used in new code.
 *
 * Display fields (display_long_date, display_time, display_full_datetime, etc.)
 * are now stored in the appointments table and computed ONCE when the trip is
 * created or updated via recalculateDisplayFields().
 *
 * All consumers should read these values directly from the database:
 *   const [trip] = await sql`SELECT * FROM appointments WHERE id = ${id}`;
 *   // trip.display_long_date, trip.display_time, etc. are already populated
 *
 * These functions are kept for backward compatibility only and will be removed
 * in a future update.
 * ────────────────────────────────────────────────────────────────────────
 */
export function enrichTripWithDisplayFields(trip) {
  if (!trip) return trip;

  console.warn(
    "[DEPRECATED] enrichTripWithDisplayFields() is deprecated. Display fields should be read directly from the database.",
  );

  // Compute all display values from start_time ONCE
  trip.display_long_date = formatLongDate(trip.start_time);
  trip.display_short_date = formatShortDate(trip.start_time);
  trip.display_time = formatTime(trip.start_time);
  trip.display_full_datetime = formatFullDateTime(trip.start_time);
  trip.display_sms_datetime = formatSmsDateTime(trip.start_time);
  trip.display_office_datetime = formatOfficeDateTime(trip.start_time);
  trip.display_gcal_date = toGCalDate(trip.start_time);

  // Compute return date display if present
  if (trip.return_date) {
    trip.display_return_date = formatDateOnly(trip.return_date);
  }

  // Compute tour end time if present
  if (trip.tour_end_time) {
    trip.display_tour_end_time = formatTime(trip.tour_end_time);
  }

  // Format payment method
  if (trip.payment_method) {
    trip.display_payment_method = formatPaymentMethod(trip.payment_method);
  }

  return trip;
}

/**
 * ⚠️ DEPRECATED: Enrich an array of trips with display fields.
 * Convenience wrapper for bulk operations.
 *
 * DO NOT USE in new code. Display fields should be read from the database.
 */
export function enrichTripsWithDisplayFields(trips) {
  if (!Array.isArray(trips)) return trips;

  console.warn(
    "[DEPRECATED] enrichTripsWithDisplayFields() is deprecated. Display fields should be read directly from the database.",
  );

  return trips.map((trip) => enrichTripWithDisplayFields(trip));
}
