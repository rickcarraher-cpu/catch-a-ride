/**
 * Build a complete address string from structured components.
 * Shared utility — safe for both client and server use.
 */
export function buildAddress({ street_address, city, state, zip_code }) {
  const parts = [];

  if (street_address) parts.push(street_address);
  if (city) parts.push(city);

  const stateZip = [state, zip_code].filter(Boolean).join(" ");
  if (stateZip) parts.push(stateZip);

  return parts.join(", ");
}

/**
 * Parse a combined address string into structured components.
 * Best-effort parser for legacy data.
 */
export function parseAddress(addressString) {
  if (!addressString || typeof addressString !== "string") {
    return { street_address: null, city: null, state: null, zip_code: null };
  }

  const cleaned = addressString.trim();
  const parts = cleaned.split(",").map((p) => p.trim());

  if (parts.length === 0) {
    return { street_address: cleaned, city: null, state: null, zip_code: null };
  }

  if (parts.length === 1) {
    return {
      street_address: parts[0],
      city: null,
      state: null,
      zip_code: null,
    };
  }

  const street_address = parts[0];
  const lastPart = parts[parts.length - 1];
  const stateZipMatch = lastPart.match(/([A-Z]{2})?\s*(\d{5}(?:-\d{4})?)?/i);
  const state = stateZipMatch?.[1] || null;
  const zip_code = stateZipMatch?.[2] || null;

  let city = null;
  if (parts.length === 3) {
    city = parts[1];
  } else if (parts.length === 2) {
    const cityMatch = lastPart.replace(/\s*[A-Z]{2}\s*\d{5}.*$/i, "").trim();
    city = cityMatch || null;
  } else if (parts.length > 3) {
    city = parts.slice(1, -1).join(", ");
  }

  return {
    street_address: street_address || null,
    city: city || null,
    state: state || null,
    zip_code: zip_code || null,
  };
}
