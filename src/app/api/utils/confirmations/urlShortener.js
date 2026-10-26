/**
 * URL Shortening Service
 * Uses Cutt.ly API as primary, falls back to TinyURL
 */

const CUTTLY_API = "https://cutt.ly/api/api.php";
const TINYURL_API = "https://api.tinyurl.com/create";

/**
 * Get Cutt.ly API key (read at call time, not module load time)
 */
function getCuttlyKey() {
  return process.env.CUTTLY_API_KEY || process.env.CUTLY_API_KEY || null;
}

/**
 * Get TinyURL API token (read at call time, not module load time)
 */
function getTinyUrlToken() {
  return process.env.TINYURL_API_TOKEN || process.env.TINY_URL || null;
}

/**
 * Shortens a URL using Cutt.ly API
 * Falls back to TinyURL, then to original URL if both fail
 */
export async function shortenUrl(longUrl) {
  if (!longUrl) return longUrl;

  const cuttlyKey = getCuttlyKey();
  const tinyUrlToken = getTinyUrlToken();

  // Try Cutt.ly first
  if (cuttlyKey) {
    try {
      const params = new URLSearchParams({
        key: cuttlyKey,
        short: longUrl,
      });
      const response = await fetch(`${CUTTLY_API}?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Cutt.ly API error ${response.status}`);
      }

      const data = await response.json();
      const urlData = data.url;

      if (!urlData) {
        throw new Error("Cutt.ly response missing 'url' field");
      }

      // Cutt.ly status codes: 7 = success, others = error
      if (urlData.status === 7) {
        const shortLink = urlData.shortLink;
        console.log(`[URL Shortener] Cutt.ly: ${longUrl} → ${shortLink}`);
        return shortLink;
      }

      // Map error statuses
      const errorMessages = {
        1: "URL already shortened",
        2: "Invalid URL",
        3: "Preferred name already taken",
        4: "Invalid API key",
        5: "URL contains invalid characters",
        6: "URL from blocked domain",
      };
      const errorMsg =
        errorMessages[urlData.status] || `Unknown status ${urlData.status}`;

      // Status 1 means already shortened - return the existing short link
      if (urlData.status === 1 && urlData.shortLink) {
        console.log(
          `[URL Shortener] Cutt.ly (already short): ${longUrl} → ${urlData.shortLink}`,
        );
        return urlData.shortLink;
      }

      throw new Error(`Cutt.ly error: ${errorMsg}`);
    } catch (error) {
      console.error("[URL Shortener] Cutt.ly failed:", error.message);
      // Fall through to TinyURL
    }
  }

  // Fallback to TinyURL
  if (tinyUrlToken) {
    try {
      console.log(`[URL Shortener] Trying TinyURL for: ${longUrl}`);
      const response = await fetch(TINYURL_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tinyUrlToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: longUrl,
          domain: "tinyurl.com",
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(`TinyURL API error: ${response.status} - ${errBody}`);
      }

      const data = await response.json();
      const shortLink = data.data?.tiny_url;
      if (shortLink) {
        console.log(`[URL Shortener] TinyURL: ${longUrl} → ${shortLink}`);
        return shortLink;
      }
      throw new Error("TinyURL response missing url");
    } catch (error) {
      console.error("[URL Shortener] TinyURL failed:", error.message);
    }
  }

  // No shortener configured or all failed
  if (!cuttlyKey && !tinyUrlToken) {
    console.warn(
      "[URL Shortener] ⚠️ No API token configured (checked CUTTLY_API_KEY, CUTLY_API_KEY, TINYURL_API_TOKEN, TINY_URL). Using full URL.",
    );
  } else {
    console.warn(
      "[URL Shortener] ⚠️ All shortener attempts failed. Using full URL.",
    );
  }
  return longUrl;
}

/**
 * Shortens multiple URLs in parallel
 * Returns object with same keys as input
 */
export async function shortenUrls(urlMap) {
  const entries = Object.entries(urlMap);
  const shortened = await Promise.all(
    entries.map(async ([key, url]) => {
      if (!url) return [key, null];
      const shortUrl = await shortenUrl(url);
      return [key, shortUrl];
    }),
  );
  return Object.fromEntries(shortened);
}
