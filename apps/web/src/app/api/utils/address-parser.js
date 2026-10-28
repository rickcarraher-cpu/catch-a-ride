/**
 * Utility to parse a combined address string into structured components
 * This is a best-effort parser for migrating legacy data
 */

export function parseAddress(addressString) {
  if (!addressString || typeof addressString !== "string") {
    return { street_address: null, city: null, state: null, zip_code: null };
  }

  const cleaned = addressString.trim();

  // Common patterns:
  // "123 Main St, Nashville, TN 37075"
  // "456 Oak Ave, Nashville TN 37075"
  // "789 Pine Rd, Nashville, TN"
  // "123 Main St"

  // Split by comma
  const parts = cleaned.split(",").map((p) => p.trim());

  if (parts.length === 0) {
    return { street_address: cleaned, city: null, state: null, zip_code: null };
  }

  if (parts.length === 1) {
    // Just a street address or unparseable
    return {
      street_address: parts[0],
      city: null,
      state: null,
      zip_code: null,
    };
  }

  // Extract street (first part)
  const street_address = parts[0];

  // Last part usually contains state and/or zip
  const lastPart = parts[parts.length - 1];

  // Try to extract state and zip from last part
  // Pattern: "TN 37075" or "TN" or "37075"
  const stateZipMatch = lastPart.match(/([A-Z]{2})?\s*(\d{5}(?:-\d{4})?)?/i);
  const state = stateZipMatch?.[1] || null;
  const zip_code = stateZipMatch?.[2] || null;

  // City is the middle part(s)
  let city = null;
  if (parts.length === 3) {
    // "123 Main, Nashville, TN 37075" → city is parts[1]
    city = parts[1];
  } else if (parts.length === 2) {
    // "123 Main, Nashville TN 37075" → extract city from parts[1] before state/zip
    const cityMatch = lastPart.replace(/\s*[A-Z]{2}\s*\d{5}.*$/i, "").trim();
    city = cityMatch || null;
  } else if (parts.length > 3) {
    // Multiple commas - join middle parts as city
    city = parts.slice(1, -1).join(", ");
  }

  return {
    street_address: street_address || null,
    city: city || null,
    state: state || null,
    zip_code: zip_code || null,
  };
}

/**
 * Build a complete address string from structured components
 */
export function buildAddress({ street_address, city, state, zip_code }) {
  const parts = [];

  if (street_address) parts.push(street_address);
  if (city) parts.push(city);

  const stateZip = [state, zip_code].filter(Boolean).join(" ");
  if (stateZip) parts.push(stateZip);

  return parts.join(", ");
}
