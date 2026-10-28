/**
 * Get the last complete Sunday-Saturday week in CST/CDT (America/Chicago) timezone
 * This matches the payroll review period calculation
 * @returns {Object} { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export function getLastCompleteWeek() {
  // Get current date in America/Chicago timezone
  const nowCDT = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const now = new Date(nowCDT + "T12:00:00");

  // Get day of week (0 = Sunday, 6 = Saturday)
  const dayOfWeek = now.getDay();

  // Calculate last Saturday (yesterday if today is Sunday, otherwise go back to previous Saturday)
  const lastSat = new Date(now);
  lastSat.setDate(now.getDate() - dayOfWeek - 1);

  // Calculate last Sunday (6 days before last Saturday)
  const lastSun = new Date(lastSat);
  lastSun.setDate(lastSat.getDate() - 6);

  return {
    startDate: lastSun.toISOString().split("T")[0],
    endDate: lastSat.toISOString().split("T")[0],
  };
}

/**
 * Format a period label for display
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {string} Formatted label like "Sun Dec 15 - Sat Dec 21, 2024"
 */
export function formatPeriodLabel(startDate, endDate) {
  if (!startDate || !endDate) return "Unknown Period";

  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");

  const startStr = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const endStr = end.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startStr} - ${endStr}`;
}

/**
 * Get Monday of current CDT week (America/Chicago timezone-aware)
 * @param {Date} d - Date object (defaults to now)
 * @returns {string} YYYY-MM-DD format
 */
export function getMonday(d = new Date()) {
  const cdtStr = d.toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const date = new Date(cdtStr + "T12:00:00");
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

/**
 * Get Sunday of current CDT week (end of Mon-Sun week)
 * @param {Date} d - Date object (defaults to now)
 * @returns {string} YYYY-MM-DD format
 */
export function getSunday(d = new Date()) {
  const cdtStr = d.toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const date = new Date(cdtStr + "T12:00:00");
  const day = date.getDay();
  const daysToAdd = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + daysToAdd);
  return date.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}
