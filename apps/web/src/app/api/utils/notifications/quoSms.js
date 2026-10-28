import { toE164 } from "./formatters";

// ── Quo SMS sender ────────────────────────────────────────────────────────────

// Short-lived cache for Quo phone number lookups.
// Prevents hammering the Quo API during batch sends (e.g. 10+ messages in a row).
let _quoPhoneNumbersCache = null;
let _quoPhoneNumbersCacheTime = 0;
const QUO_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Fetch available phone numbers from the Quo account.
 * Uses a 30-second in-memory cache to avoid repeated API calls during batch sends.
 * Returns the raw array from Quo's API: [{ id, number, ... }, ...]
 */
async function fetchQuoPhoneNumbers(apiKey) {
  const now = Date.now();
  if (
    _quoPhoneNumbersCache &&
    now - _quoPhoneNumbersCacheTime < QUO_CACHE_TTL_MS
  ) {
    return _quoPhoneNumbersCache;
  }

  const resp = await fetch("https://api.quo.com/v1/phone-numbers", {
    method: "GET",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
  });
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    // Clear cache on error so next call retries
    _quoPhoneNumbersCache = null;
    throw new Error(
      `Failed to list Quo phone numbers (${resp.status}): ${errBody.message || JSON.stringify(errBody)}`,
    );
  }
  const data = await resp.json();
  const phoneNumbers = data?.data || [];

  // Cache the result
  _quoPhoneNumbersCache = phoneNumbers;
  _quoPhoneNumbersCacheTime = now;

  return phoneNumbers;
}

/**
 * Resolve the best Quo phone number to send from.
 *
 * Strategy:
 *  1. Fetch the live list of phone numbers from Quo.
 *  2. If the stored `phoneNumberId` starts with "PN" → treat as Quo PN ID and match directly.
 *  3. If the stored value is a phone number with "+" → match by phone number and return its PN ID.
 *  4. Otherwise fall back to the first available phone number.
 *
 * **Important**: Phone numbers MUST include the "+" prefix (E.164 format).
 *
 * Returns { id, number } or throws.
 */
async function resolveQuoFrom(apiKey, phoneNumberId) {
  const phoneNumbers = await fetchQuoPhoneNumbers(apiKey);

  if (phoneNumbers.length === 0) {
    throw new Error(
      "No phone numbers found in your Quo account. Add a phone number in Quo first.",
    );
  }

  // ── Strategy 1: Match by PN ID (legacy format) ────────────────────────────
  if (phoneNumberId && phoneNumberId.startsWith("PN")) {
    const match = phoneNumbers.find((pn) => pn.id === phoneNumberId);
    if (match) {
      console.log(
        `[Quo] ✅ Matched stored PN ID "${phoneNumberId}" → number: ${match.number || "(unknown)"}`,
      );
      return { id: match.id, number: match.number };
    }
    console.warn(
      `[Quo] ⚠️ Stored PN ID "${phoneNumberId}" not found in Quo account — it may have been rotated. Falling back...`,
    );
  }

  // ── Strategy 2: Match by phone number (E.164 with + required) ─────────────
  if (phoneNumberId && !phoneNumberId.startsWith("PN")) {
    // Validate that phone number has the required "+" prefix
    if (!phoneNumberId.startsWith("+")) {
      console.warn(
        `[Quo] ⚠️ Phone number "${phoneNumberId}" is missing the "+" prefix. ` +
          `Quo requires E.164 format (e.g., "+16157568152"). Attempting to add "+" automatically...`,
      );
      phoneNumberId = `+${phoneNumberId}`;
    }

    // Normalize to E.164 and try to match
    const normalizedFrom = toE164(phoneNumberId);
    if (normalizedFrom) {
      const match = phoneNumbers.find(
        (pn) => pn.number === normalizedFrom || pn.number === phoneNumberId,
      );
      if (match) {
        console.log(
          `[Quo] ✅ Resolved phone number "${normalizedFrom}" → PN ID "${match.id}"`,
        );
        return { id: match.id, number: match.number };
      }
      console.warn(
        `[Quo] ⚠️ Phone number "${normalizedFrom}" not found among available Quo numbers. Available: ${phoneNumbers.map((pn) => pn.number).join(", ")}`,
      );
    } else {
      console.warn(
        `[Quo] ⚠️ Could not normalize "${phoneNumberId}" to E.164 format.`,
      );
    }
  }

  // ── Strategy 3: Fall back to first available number ───────────────────────
  const fallback = phoneNumbers[0];
  console.warn(
    `[Quo] ⚠️ Falling back to first available Quo number: "${fallback.id}" (${fallback.number}). ` +
      `Update Settings → Quo Credentials → use Lookup to pick the correct number.`,
  );
  return { id: fallback.id, number: fallback.number };
}

export async function sendSmsViaQuo({
  apiKey,
  phoneNumberId,
  userId,
  to,
  message,
}) {
  const e164To = toE164(to);
  if (!e164To) throw new Error("Invalid destination phone number");

  // Always resolve the from phone number via live lookup.
  // This prevents stale PN ID errors when Quo rotates phone number IDs.
  let resolved;
  try {
    resolved = await resolveQuoFrom(apiKey, phoneNumberId);
  } catch (lookupErr) {
    console.error(`[Quo] ❌ Failed to resolve from number:`, lookupErr.message);
    throw new Error(
      `Cannot resolve Quo sender phone number: ${lookupErr.message}. ` +
        `Go to Settings → Quo Credentials and use the Lookup button to select the correct phone number.`,
    );
  }

  const fromValue = resolved.id;

  const body = { content: message, from: fromValue, to: [e164To] };

  // Only include userId if it's valid (starts with "US")
  if (userId && userId.startsWith("US")) {
    body.userId = userId;
  } else if (userId) {
    console.warn(
      `[Quo] Skipping invalid userId "${userId}" — must start with "US"`,
    );
  }

  // Diagnostic logging — show exact JSON body being sent (sanitized)
  console.log(
    `[Quo] 📤 Sending SMS → from: "${fromValue}" (${resolved.number || "?"}), to: "${e164To}", message length: ${message.length}, userId: ${body.userId ? `"${body.userId}"` : "(not included)"}`,
  );
  console.log(`[Quo] 📋 Request body (JSON):`, JSON.stringify(body, null, 2));

  // ── Retry loop for transient 5xx errors (e.g. 504 Gateway Timeout) ─────
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 1500;

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.quo.com/v1/messages", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const successData = await response.json();
      if (attempt > 1) {
        console.log(
          `[Quo] ✅ Message sent on attempt ${attempt}:`,
          successData,
        );
      } else {
        console.log(`[Quo] ✅ Message sent successfully:`, successData);
      }
      return successData;
    }

    const err = await response.json().catch(() => ({}));
    console.error(
      `[Quo] ❌ API error ${response.status} (attempt ${attempt}/${MAX_RETRIES}):`,
      err,
    );

    // For 403 errors — don't retry, fail immediately with helpful message
    if (response.status === 403) {
      const helpMsg = err.message || JSON.stringify(err);
      if (body.userId) {
        console.warn(
          `[Quo] ⚠️ Got 403 with userId="${body.userId}" — this may be a permissions issue. Go to Settings → Quo Credentials and clear the User ID field (leave blank).`,
        );
      }
      throw new Error(
        `Quo API 403 Forbidden: ${helpMsg}. This usually means the User ID field doesn't have permission to access this phone number. Go to Settings → Quo Credentials and clear the User ID field (leave blank).`,
      );
    }

    // For 404 errors — don't retry
    if (response.status === 404) {
      const helpMsg = err.message || JSON.stringify(err);
      throw new Error(
        `Quo API 404: ${helpMsg}. The phone number ID "${fromValue}" was just resolved from a fresh lookup but Quo still can't find it. ` +
          `This may be a transient Quo issue. Try again shortly, or go to Settings → Quo Credentials and re-select your phone number.`,
      );
    }

    // For 5xx errors — retry with delay
    if (response.status >= 500) {
      const isTimeout = response.status === 504;
      lastError = new Error(
        isTimeout
          ? `Quo API timed out (504). Quo's servers did not respond in time — this is usually temporary. Please try again in a moment.`
          : `Quo API server error (${response.status}): ${JSON.stringify(err)}`,
      );

      if (attempt < MAX_RETRIES) {
        console.warn(
          `[Quo] ⚠️ ${response.status} error — retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt}/${MAX_RETRIES})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      // Exhausted all retries
      console.error(
        `[Quo] ❌ All ${MAX_RETRIES} attempts failed with ${response.status}`,
      );
      throw lastError;
    }

    // Any other non-OK status — throw immediately
    throw new Error(`Quo API error ${response.status}: ${JSON.stringify(err)}`);
  }

  // Fallback (should not reach here)
  throw lastError || new Error("Quo SMS sending failed after all retries");
}

// ── Quo bulk / batched sender ─────────────────────────────────────────────────

/**
 * Send many SMS messages via Quo efficiently.
 *
 * Strategy:
 *  - Recipients sharing the **same message body** are grouped together and sent
 *    in a single Quo API call (up to 10 phone numbers per call — Quo's hard cap).
 *  - Recipients with unique messages each get their own API call.
 *  - All API calls are spaced QUO_INTER_CALL_DELAY_MS apart, keeping throughput
 *    well under Quo's 10 req/sec limit.
 *
 * @param {Object}  opts
 * @param {string}  opts.apiKey
 * @param {string}  opts.phoneNumberId
 * @param {string}  [opts.userId]
 * @param {Array<{to: string, message: string}>} opts.recipients
 * @returns {Promise<Array<{to: string, success: boolean, data?: any, error?: string}>>}
 */
export async function sendSmsBulkViaQuo({
  apiKey,
  phoneNumberId,
  userId,
  recipients,
}) {
  const QUO_MAX_PER_CALL = 10; // Quo hard cap: 10 numbers per request
  const QUO_INTER_CALL_DELAY_MS = 110; // 110 ms ≈ 9 calls/sec — safely under 10/sec cap

  if (!recipients || recipients.length === 0) return [];

  // Resolve the sender phone number once for the entire batch
  let resolved;
  try {
    resolved = await resolveQuoFrom(apiKey, phoneNumberId);
  } catch (lookupErr) {
    const errMsg = `Cannot resolve Quo sender: ${lookupErr.message}`;
    console.error(`[Quo:Bulk] ❌ ${errMsg}`);
    return recipients.map((r) => ({ to: r.to, success: false, error: errMsg }));
  }

  const fromValue = resolved.id;

  // Validate + normalise all destination numbers up front
  const prepared = recipients.map((r) => ({
    originalTo: r.to,
    e164: toE164(r.to),
    message: r.message || "",
  }));

  const invalid = prepared
    .filter((r) => !r.e164)
    .map((r) => ({
      to: r.originalTo,
      success: false,
      error: "Invalid phone number",
    }));

  const valid = prepared.filter((r) => !!r.e164);

  // Group valid recipients by message content so identical messages can share
  // a single API call (up to QUO_MAX_PER_CALL numbers each).
  const messageGroups = new Map(); // message → [{originalTo, e164}]
  for (const r of valid) {
    if (!messageGroups.has(r.message)) messageGroups.set(r.message, []);
    messageGroups.get(r.message).push(r);
  }

  // Build an ordered list of API call descriptors
  const apiCalls = []; // [{toList: string[], message: string, sourceRecipients: [...]}]
  for (const [message, group] of messageGroups) {
    for (let i = 0; i < group.length; i += QUO_MAX_PER_CALL) {
      const chunk = group.slice(i, i + QUO_MAX_PER_CALL);
      apiCalls.push({
        toList: chunk.map((r) => r.e164),
        message,
        sourceRecipients: chunk,
      });
    }
  }

  const results = [...invalid];
  let callIndex = 0;

  for (const call of apiCalls) {
    // Space every call except the very first
    if (callIndex > 0) {
      await new Promise((res) => setTimeout(res, QUO_INTER_CALL_DELAY_MS));
    }
    callIndex++;

    const body = { content: call.message, from: fromValue, to: call.toList };
    if (userId && userId.startsWith("US")) body.userId = userId;

    console.log(
      `[Quo:Bulk] 📤 Call ${callIndex}/${apiCalls.length}: ${call.toList.length} recipient(s), msg length: ${call.message.length}`,
    );

    try {
      const response = await fetch("https://api.quo.com/v1/messages", {
        method: "POST",
        headers: { Authorization: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(
          `[Quo:Bulk] ✅ Call ${callIndex} OK — ${call.toList.length} number(s) delivered`,
        );
        call.sourceRecipients.forEach((r) =>
          results.push({ to: r.originalTo, success: true, data }),
        );
      } else {
        const err = await response.json().catch(() => ({}));
        const errMsg = `Quo API ${response.status}: ${err.message || JSON.stringify(err)}`;
        console.error(`[Quo:Bulk] ❌ Call ${callIndex} failed — ${errMsg}`);
        call.sourceRecipients.forEach((r) =>
          results.push({ to: r.originalTo, success: false, error: errMsg }),
        );
      }
    } catch (fetchErr) {
      const errMsg = fetchErr.message;
      console.error(`[Quo:Bulk] ❌ Call ${callIndex} threw — ${errMsg}`);
      call.sourceRecipients.forEach((r) =>
        results.push({ to: r.originalTo, success: false, error: errMsg }),
      );
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Quo:Bulk] 🏁 Done — ${successCount}/${results.length} sent across ${callIndex} API call(s)`,
  );

  return results;
}
