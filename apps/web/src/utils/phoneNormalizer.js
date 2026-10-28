// Normalize a phone string to its last 10 digits (strips country code "1" for US numbers)
export function normalizePhone(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  // If 11 digits starting with "1", treat leading 1 as US country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX) for SMS delivery.
 *
 * This is critical for SMS notifications — without the +1 prefix, SMS silently fails.
 *
 * Handles:
 * - 10-digit numbers: "6155551234" → "+16155551234"
 * - 11-digit starting with 1: "16155551234" → "+16155551234"
 * - Already formatted: "+16155551234" → "+16155551234"
 * - Invalid formats: returns null
 *
 * @param {string} raw - Raw phone input (can include formatting like (615) 555-1234)
 * @returns {string|null} - E.164 formatted phone (+1XXXXXXXXXX) or null if invalid
 */
export function normalizeToE164(raw) {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");

  // 10 digits: add +1 prefix
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 11 digits starting with 1: add + prefix
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Already has + and 11 digits starting with 1
  if (raw.startsWith("+") && digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Invalid format
  return null;
}

/**
 * Validate if a phone number is in valid US format (10 or 11 digits).
 *
 * @param {string} raw - Raw phone input
 * @returns {boolean} - true if valid, false otherwise
 */
export function isValidUSPhone(raw) {
  if (!raw) return false;
  const digits = raw.replace(/\D/g, "");
  return (
    digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))
  );
}
