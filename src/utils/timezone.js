/**
 * Timezone utility for CDT (America/Chicago)
 * Ensures all dates display in Central Daylight Time
 */

const TIMEZONE = "America/Chicago";

/**
 * Get current date in CDT timezone as YYYY-MM-DD string
 */
export function getTodayInCDT() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // en-CA gives YYYY-MM-DD
}

/**
 * Format a date string or Date object to display in CDT
 */
export function formatDateCDT(dateInput, options = {}) {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Validate date before formatting
  if (!date || isNaN(date.getTime())) {
    console.error("Invalid date passed to formatDateCDT:", dateInput);
    return "";
  }

  return date.toLocaleDateString("en-US", {
    timeZone: TIMEZONE,
    ...options,
  });
}

/**
 * Format time in CDT
 */
export function formatTimeCDT(dateInput, options = {}) {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Validate date before formatting
  if (!date || isNaN(date.getTime())) {
    console.error("Invalid date passed to formatTimeCDT:", dateInput);
    return "";
  }

  return date.toLocaleTimeString("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  });
}

/**
 * Format date and time in CDT
 */
export function formatDateTimeCDT(
  dateInput,
  dateOptions = {},
  timeOptions = {},
) {
  if (!dateInput) return "";

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

  // Validate date before formatting
  if (!date || isNaN(date.getTime())) {
    console.error("Invalid date passed to formatDateTimeCDT:", dateInput);
    return "";
  }

  return date.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    ...dateOptions,
    ...timeOptions,
  });
}

/**
 * Convert a date input to a Date object in CDT context
 */
export function parseDateInCDT(dateString) {
  // If it's a date-only string like "2026-06-10", interpret it as midnight CDT
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString + "T00:00:00-05:00"); // CDT offset
  }
  return new Date(dateString);
}

/**
 * Check if a date is today in CDT
 */
export function isTodayInCDT(dateString) {
  const today = getTodayInCDT();
  const checkDate =
    typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString)
      ? dateString
      : formatDateCDT(dateString, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .split("/")
          .reverse()
          .join("-")
          .replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");

  return dateString === today;
}

/**
 * Get date parts in CDT (year, month, day, hour, minute, etc.)
 */
export function getDatePartsInCDT(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

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
  const getValue = (type) => parts.find((p) => p.type === type)?.value;

  // Intl.DateTimeFormat with hour12:false returns "24" for midnight in some browsers.
  // Normalize "24" → "00" so arithmetic (Number(hour)*60) gives 0, not 1440.
  const rawHour = getValue("hour");
  const hour = rawHour === "24" ? "00" : rawHour;

  return {
    year: getValue("year"),
    month: getValue("month"),
    day: getValue("day"),
    hour,
    minute: getValue("minute"),
    second: getValue("second"),
  };
}

/**
 * Convert a date to ICS format (YYYYMMDDTHHMMSSZ) in CDT timezone
 * For use in .ics calendar files
 */
export function toIcsDateCDT(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = getDatePartsInCDT(date);

  // Format as YYYYMMDDTHHMMSS (local time, no Z suffix for DTSTART/DTEND with TZID)
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Convert a date to Google Calendar format (YYYYMMDDTHHmmssZ) in CDT timezone
 * For use in Google Calendar links
 */
export function toGCalDateCDT(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = getDatePartsInCDT(date);

  // Google Calendar expects local time in YYYYMMDDTHHmmss format (no Z for local time)
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

/**
 * Get date string in CDT as YYYY-MM-DD for a given date
 */
export function getDateStringInCDT(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Compare if a date is before another date (both compared in CDT timezone)
 */
export function isBeforeInCDT(date1, date2) {
  const d1 = typeof date1 === "string" ? new Date(date1) : date1;
  const d2 = typeof date2 === "string" ? new Date(date2) : date2;
  return d1 < d2;
}

/**
 * Get tomorrow's date in CDT as YYYY-MM-DD
 */
export function getTomorrowInCDT() {
  const now = new Date();
  const tomorrow = new Date(
    now.toLocaleString("en-US", { timeZone: TIMEZONE }),
  );
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Get start of day (00:00:00) in CDT for a given date string (YYYY-MM-DD)
 * Returns ISO string suitable for database queries
 */
export function getStartOfDayInCDT(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return createDateInCDT(year, month, day, 0, 0).toISOString();
}

/**
 * Get end of day (23:59:59) in CDT for a given date string (YYYY-MM-DD)
 * Returns ISO string suitable for database queries
 */
export function getEndOfDayInCDT(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return createDateInCDT(year, month, day, 23, 59).toISOString();
}

/**
 * Create a Date object for a specific date and time in CDT
 * @param year - Full year (e.g., 2026)
 * @param month - Month (1-12)
 * @param day - Day of month
 * @param hour - Hour (0-23)
 * @param minute - Minute (0-59)
 * @returns Date object representing that moment in CDT
 */
export function createDateInCDT(year, month, day, hour = 0, minute = 0) {
  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const hourStr = String(hour).padStart(2, "0");
  const minuteStr = String(minute).padStart(2, "0");

  // Dynamically detect DST for the target date
  // Create a test date and check what offset Central Time uses
  try {
    const testDate = new Date(`${year}-${monthStr}-${dayStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(testDate);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";

    // longOffset gives "GMT-05:00" or "GMT-06:00"
    if (
      tzName.startsWith("GMT") &&
      (tzName.includes("+") || tzName.includes("-"))
    ) {
      const offset = tzName.slice(3); // "-05:00" or "-06:00"
      const isoString = `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00${offset}`;
      return new Date(isoString);
    }
  } catch (_) {}

  // Fallback: Use month-based DST detection
  // DST is active (CDT, -05:00) roughly March through November
  // CST (-06:00) is November through March
  const offset = month >= 3 && month <= 10 ? "-05:00" : "-06:00";
  const isoString = `${year}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}:00${offset}`;
  return new Date(isoString);
}

/**
 * Build a Chicago timestamp from date and time strings
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:MM format (24-hour)
 * @returns ISO 8601 timestamp string with correct CDT/CST offset
 */
export function buildChicagoTimestamp(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return createDateInCDT(year, month, day, hour, minute).toISOString();
}

/**
 * Format a date-only string (YYYY-MM-DD) without UTC-to-local timezone shift.
 * Use this instead of new Date(dateStr).toLocaleDateString() for DATE columns
 * from the database — those come back as "YYYY-MM-DD" strings and if you pass
 * them through new Date() they are parsed as UTC midnight, which shifts the
 * displayed day back by 5–6 hours in CDT.
 *
 * @param dateStr - A YYYY-MM-DD string (or any string starting with YYYY-MM-DD)
 * @param options - Optional Intl.DateTimeFormatOptions (passed to toLocaleDateString)
 * @returns Formatted date string using the browser's locale, or "—" if falsy
 */
export function formatDateOnly(dateStr, options = {}) {
  if (!dateStr) return "—";
  const s = String(dateStr).slice(0, 10); // grab "YYYY-MM-DD"
  if (s.length < 10) return s;
  const [yr, mo, dy] = s.split("-").map(Number);
  if (!yr || !mo || !dy) return s;
  // Multi-arg Date constructor = local time (no UTC offset issue)
  return new Date(yr, mo - 1, dy).toLocaleDateString("en-US", options);
}
