/**
 * Unified SMS Sender
 *
 * THE single source of truth for sending SMS messages across the entire app.
 * Every file that needs to send SMS should import from here instead of
 * directly calling ClickSend/Quo utilities or loading settings themselves.
 *
 * Usage:
 *   import { sendSms, loadSmsConfig, isSmsReady } from "@/app/api/utils/sms-sender";
 *
 *   // Simple send (loads settings automatically):
 *   const result = await sendSms({ to: "+16155551234", message: "Hello!" });
 *
 *   // Check if SMS is configured:
 *   const config = await loadSmsConfig();
 *   if (!config.ready) console.log(config.reason);
 *
 *   // Send with pre-loaded config (for batch sends):
 *   const config = await loadSmsConfig();
 *   await sendSms({ to: phone1, message: msg1, config });
 *   await sendSms({ to: phone2, message: msg2, config });
 */

import sql from "@/app/api/utils/sql";
import { sendSmsViaClickSend } from "@/app/api/utils/clicksend";
import {
  sendSmsViaQuo,
  sendSmsBulkViaQuo,
} from "@/app/api/utils/notifications/quoSms";

// ── Deduplication cache ──────────────────────────────────────────────────
// Prevents identical SMS messages from being sent to the same phone number
// within a short time window. Keyed by "normalizedPhone::messageHash".
const recentSmsSends = new Map();
const SMS_DEDUP_WINDOW_MS = 300_000; // 5 minutes (up from 60s — covers rapid-edit bursts)

// ── Global rate limiter ──────────────────────────────────────────────────
// Hard cap: no more than 5 SMS per second across the entire app.
// Uses a sliding-window approach — tracks timestamps of recent sends and
// waits if the window is full.
const GLOBAL_SMS_RATE_LIMIT = 5; // max messages per second
const RATE_WINDOW_MS = 1000; // 1 second window
const smsTimestamps = []; // circular buffer of send timestamps

/**
 * Wait until a rate-limit slot is available.
 * If 5 messages were sent in the last second, waits until the oldest
 * one falls outside the window.
 */
async function acquireRateSlot() {
  const now = Date.now();

  // Clean out timestamps older than the window
  while (smsTimestamps.length > 0 && now - smsTimestamps[0] >= RATE_WINDOW_MS) {
    smsTimestamps.shift();
  }

  // If we're at the limit, wait until the oldest timestamp expires
  if (smsTimestamps.length >= GLOBAL_SMS_RATE_LIMIT) {
    const waitTime = RATE_WINDOW_MS - (now - smsTimestamps[0]) + 10; // +10ms buffer
    if (waitTime > 0) {
      console.log(
        `[SMS:RateLimit] Throttling — waiting ${waitTime}ms (${smsTimestamps.length} sent in last 1s)`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      // Clean again after waiting
      const afterWait = Date.now();
      while (
        smsTimestamps.length > 0 &&
        afterWait - smsTimestamps[0] >= RATE_WINDOW_MS
      ) {
        smsTimestamps.shift();
      }
    }
  }

  // Record this send
  smsTimestamps.push(Date.now());
}
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a simple hash key for deduplication.
 * Uses phone + first 100 chars of message to create a unique-enough key.
 */
function buildDeduplicationKey(phone, message) {
  const normalizedPhone = phone.replace(/\D/g, "");
  // Use first 100 chars of message — enough to identify duplicates without being too long
  const msgFingerprint = (message || "").substring(0, 100).trim();
  return `${normalizedPhone}::${msgFingerprint}`;
}

/**
 * Check if an identical SMS was recently sent (within the dedup window).
 * Returns true if this is a duplicate that should be skipped.
 */
function isDuplicateSms(phone, message) {
  const key = buildDeduplicationKey(phone, message);
  const lastSent = recentSmsSends.get(key);
  if (lastSent && Date.now() - lastSent < SMS_DEDUP_WINDOW_MS) {
    return true;
  }
  return false;
}

/**
 * Database-backed duplicate check.
 * Serverless functions don't share in-process memory, so the in-memory Map
 * above is always empty on a cold start.  This function hits the sms_messages
 * table as a persistent fallback — if we already sent the same message body
 * to the same phone within the last 5 minutes we skip it.
 *
 * Returns true (is a duplicate) or false (safe to send).
 */
async function isDuplicateSmsDb(normalizedPhone, message) {
  try {
    const fingerprint = (message || "").substring(0, 100).trim();
    const rows = await sql(
      `SELECT id FROM sms_messages
       WHERE phone = $1
         AND direction = 'outbound'
         AND LEFT(message, 100) = $2
         AND sent_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [normalizedPhone, fingerprint],
    );
    return rows.length > 0;
  } catch (err) {
    // Fail open — if the DB check errors, let the message through
    console.error("[SMS:Dedup:DB] Check failed (failing open):", err.message);
    return false;
  }
}

/**
 * Record that an SMS was sent (for deduplication tracking).
 */
function recordSmsSent(phone, message) {
  const key = buildDeduplicationKey(phone, message);
  recentSmsSends.set(key, Date.now());

  // Periodically clean up old entries to prevent memory leaks
  if (recentSmsSends.size > 500) {
    const now = Date.now();
    for (const [k, v] of recentSmsSends) {
      if (now - v > SMS_DEDUP_WINDOW_MS) {
        recentSmsSends.delete(k);
      }
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calculate SMS segment count based on message length and character encoding
 * GSM-7 encoding: 160 chars per segment (standard), 153 chars per segment (concatenated)
 * UCS-2 encoding: 70 chars per segment (unicode), 67 chars per segment (concatenated)
 */
export function calculateSegmentCount(message) {
  if (!message) return 1;

  const length = message.length;

  // Check if message contains unicode characters (requires UCS-2 encoding)
  const hasUnicode = /[^\x00-\x7F]/.test(message);

  if (hasUnicode) {
    // UCS-2 encoding
    if (length <= 70) return 1;
    return Math.ceil(length / 67);
  } else {
    // GSM-7 encoding
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }
}

/**
 * Normalize phone number to E.164 format
 */
export function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // For international numbers that already include country code
  if (digits.length >= 10) return `+${digits}`;
  // Phone number too short — invalid
  return null;
}

/**
 * Load SMS configuration from the settings table.
 * Returns a config object with provider info, credentials, and readiness status.
 *
 * @param {object} [existingSettings] - If you already loaded settings, pass them to avoid a duplicate query
 * @returns {Promise<SmsConfig>}
 */
export async function loadSmsConfig(existingSettings) {
  let settings = existingSettings;

  if (!settings) {
    const rows = await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    settings = rows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  const rawProvider = settings.sms_provider || "";
  const provider = rawProvider.toLowerCase().trim();

  // Provider is explicitly disabled
  if (provider === "none" || provider === "") {
    return {
      ready: false,
      provider: rawProvider || "None",
      providerNormalized: provider || "none",
      reason: "SMS provider is set to None (disabled).",
      disabled: true,
      settings,
    };
  }

  // Quo provider
  if (provider === "quo") {
    const apiKey = settings.quo_api_key || process.env.QUO_API_KEY || "";

    // Use Non Reservation Number for all outbound SMS if configured;
    // fall back to the main reservation number if not set.
    const phoneNumberId =
      settings.quo_non_reservation_phone_number_id ||
      settings.quo_phone_number_id ||
      process.env.QUO_PHONE_NUMBER_ID ||
      "";

    const userId = settings.quo_user_id || process.env.QUO_USER_ID || null;

    const ready = !!(apiKey && phoneNumberId);
    const missing = [];
    if (!apiKey) missing.push("quo_api_key");
    if (!phoneNumberId)
      missing.push(
        "quo_phone_number_id or quo_non_reservation_phone_number_id",
      );

    return {
      ready,
      provider: rawProvider,
      providerNormalized: "quo",
      reason: ready
        ? null
        : `Quo credentials missing: ${missing.join(", ")}. Add them in Settings → SMS tab.`,
      disabled: false,
      credentials: { apiKey, phoneNumberId, userId },
      settings,
    };
  }

  // ClickSend provider
  if (provider === "clicksend") {
    const username =
      settings.clicksend_username || process.env.CLICKSEND_USERNAME || "";
    const apiKey =
      settings.clicksend_api_key || process.env.CLICKSEND_API_KEY || "";
    const from = settings.clicksend_from || "CatchARide";

    const ready = !!(username && apiKey);
    const missing = [];
    if (!username) missing.push("clicksend_username");
    if (!apiKey) missing.push("clicksend_api_key");

    return {
      ready,
      provider: rawProvider,
      providerNormalized: "clicksend",
      reason: ready
        ? null
        : `ClickSend credentials missing: ${missing.join(", ")}. Add them in Settings → SMS tab.`,
      disabled: false,
      credentials: { username, apiKey, from },
      settings,
    };
  }

  // Unknown provider
  return {
    ready: false,
    provider: rawProvider,
    providerNormalized: provider,
    reason: `Unknown SMS provider "${rawProvider}". Expected "Quo", "ClickSend", or "None". Fix in Settings → SMS tab.`,
    disabled: false,
    settings,
  };
}

/**
 * Quick check: is SMS ready to send?
 *
 * @param {object} [existingSettings] - optional pre-loaded settings
 * @returns {Promise<boolean>}
 */
export async function isSmsReady(existingSettings) {
  const config = await loadSmsConfig(existingSettings);
  return config.ready;
}

/**
 * Send an SMS message using the configured provider.
 *
 * This is THE function every part of the app should call to send SMS.
 * It handles settings loading, credential validation, provider selection,
 * and error handling in one place.
 *
 * @param {object} options
 * @param {string} options.to - Recipient phone number (any format, will be normalized)
 * @param {string} options.message - SMS body text
 * @param {object} [options.config] - Pre-loaded config from loadSmsConfig() (avoids extra DB query)
 * @param {object} [options.settings] - Pre-loaded settings object (avoids extra DB query)
 * @param {string} [options.label] - Optional label for logging (e.g. "Password Reset", "Driver Notification")
 *
 * @returns {Promise<SmsResult>}
 *   { success: true, provider: "Quo", data: {...} }
 *   { success: false, skipped: true, reason: "..." }  — when provider is disabled
 *   { success: false, error: "...", reason: "..." }    — when credentials missing or send failed
 */
export async function sendSms({ to, message, config, settings, label }) {
  const tag = label ? `[SMS:${label}]` : "[SMS]";

  // Validate inputs
  if (!to) {
    console.error(`${tag} ❌ No recipient phone number provided`);
    return { success: false, error: "No recipient phone number provided" };
  }
  if (!message) {
    console.error(`${tag} ❌ No message body provided`);
    return { success: false, error: "No message body provided" };
  }

  // Load config if not provided
  if (!config) {
    config = await loadSmsConfig(settings);
  }

  // Provider is disabled
  if (config.disabled) {
    console.log(`${tag} ⏭️  SMS disabled (provider set to None)`);
    return { success: false, skipped: true, reason: config.reason };
  }

  // Credentials are missing
  if (!config.ready) {
    console.error(`${tag} ❌ ${config.reason}`);
    return { success: false, error: config.reason, reason: config.reason };
  }

  const normalizedTo = toE164(to);
  if (!normalizedTo) {
    console.error(`${tag} ❌ Invalid phone number: "${to}"`);
    return { success: false, error: `Invalid phone number: "${to}"` };
  }

  // Deduplication: Check in-memory cache first (fast), then DB (cross-invocation)
  const dedupKey = buildDeduplicationKey(normalizedTo, message);
  if (isDuplicateSms(normalizedTo, message)) {
    console.log(`${tag} ⏭️  SMS deduped (in-memory): ${dedupKey}`);
    return {
      success: false,
      skipped: true,
      reason: "Duplicate message (in-memory)",
    };
  }

  const dbDup = await isDuplicateSmsDb(normalizedTo, message);
  if (dbDup) {
    console.log(
      `${tag} ⏭️  SMS deduped (DB — same message sent within last 5 min): ${dedupKey}`,
    );
    return { success: false, skipped: true, reason: "Duplicate message (DB)" };
  }

  // Wait for a rate limit slot
  await acquireRateSlot();

  // Send via the configured provider
  try {
    let data;

    if (config.providerNormalized === "quo") {
      console.log(
        `${tag} 📤 Sending via Quo to ${normalizedTo} (${message.length} chars)`,
      );
      data = await sendSmsViaQuo({
        apiKey: config.credentials.apiKey,
        phoneNumberId: config.credentials.phoneNumberId,
        userId: config.credentials.userId,
        to: normalizedTo,
        message,
      });
    } else if (config.providerNormalized === "clicksend") {
      // ClickSend outage prefix — prepended to every ClickSend message while Quo is down
      const CLICKSEND_OUTAGE_PREFIX =
        "Catch A Ride - We are experiencing Text Message issues.  You cannot reply to this.  If you need to contact us, you may call or text our office #   (615) 756-8152.  Thank you. ";
      const clicksendMessage = `${CLICKSEND_OUTAGE_PREFIX}${message}`;
      console.log(
        `${tag} 📤 Sending via ClickSend to ${normalizedTo} (${clicksendMessage.length} chars, with outage prefix)`,
      );
      data = await sendSmsViaClickSend({
        username: config.credentials.username,
        apiKey: config.credentials.apiKey,
        from: config.credentials.from,
        to: normalizedTo,
        message: clicksendMessage,
      });
    } else {
      const err = `Unknown provider "${config.provider}"`;
      console.error(`${tag} ❌ ${err}`);
      return { success: false, error: err };
    }

    console.log(`${tag} ✅ Sent successfully via ${config.provider}`);
    recordSmsSent(normalizedTo, message);
    return { success: true, provider: config.provider, data };
  } catch (err) {
    console.error(
      `${tag} ❌ Send failed via ${config.provider}: ${err.message}`,
    );
    return { success: false, error: err.message, provider: config.provider };
  }
}

/**
 * Send an SMS and log it to the sms_messages table.
 * Combines sending + database logging in one call.
 *
 * @param {object} options
 * @param {string} options.to - Recipient phone number
 * @param {string} options.message - SMS body
 * @param {number} [options.appointmentId] - Link to an appointment
 * @param {number} [options.clientId] - Link to a client
 * @param {number} [options.employeeId] - Link to an employee
 * @param {number} [options.conversationId] - Link to a conversation
 * @param {string} [options.senderName] - Who sent it (e.g. business name)
 * @param {string} [options.recipientType] - "passenger", "driver", "owner"
 * @param {string} [options.notificationType] - e.g. "booking_created", "custom_message"
 * @param {object} [options.metadata] - Extra metadata for the sms_messages row
 * @param {object} [options.config] - Pre-loaded SMS config
 * @param {object} [options.settings] - Pre-loaded settings
 * @param {string} [options.label] - Logging label
 *
 * @returns {Promise<SmsResult>}
 */
export async function sendSmsAndLog({
  to,
  message,
  appointmentId,
  clientId,
  employeeId,
  conversationId,
  senderName,
  recipientType,
  notificationType,
  metadata,
  config,
  settings,
  label,
}) {
  // Send the SMS
  const result = await sendSms({ to, message, config, settings, label });

  // Only log to DB if it was actually sent (not skipped/failed before sending)
  if (result.success) {
    try {
      const normalizedPhone = toE164(to);
      const provider = result.provider || "Unknown";
      const segmentCount = calculateSegmentCount(message);
      const metadataJson = JSON.stringify({
        notification_type: notificationType || "general",
        recipient: recipientType || "unknown",
        ...metadata,
      });

      await sql(
        `INSERT INTO sms_messages (
          tenant_id, conversation_id, appointment_id, client_id, direction, phone, message, sender_name, provider, metadata, segment_count
        ) VALUES (
          1, $1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9
        )`,
        [
          conversationId || null,
          appointmentId || null,
          clientId || null,
          normalizedPhone,
          message,
          senderName || "System",
          provider,
          metadataJson,
          segmentCount,
        ],
      );

      // Update conversation timestamp if we have one
      if (conversationId) {
        await sql`UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ${conversationId}`;
      }
    } catch (logErr) {
      console.error(`[SMS:Log] Failed to log SMS to database:`, logErr.message);
      // Don't fail the whole operation just because logging failed
    }
  }

  return result;
}

// ── Tiny sleep helper ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send a batch of SMS jobs sequentially with a controlled delay between each send.
 *
 * Quo hard caps:
 *   - 10 API requests / second per API key
 *   - Up to 10 recipients in the `to` array per request (we send 1:1 for personalised messages)
 *
 * Using a 120 ms inter-send delay keeps us at ~8 sends/sec — safely under the cap
 * even when a bulk-assign triggers 100+ messages in one function invocation.
 *
 * @param {object}   opts
 * @param {Array}    opts.jobs       – Array of sendSmsAndLog job objects
 * @param {string}   [opts.label]    – Log prefix label
 * @param {number}   [opts.delayMs=120] – Milliseconds to wait between each send
 */
export async function sendSmsBatch({ jobs, label, delayMs = 120 }) {
  const tag = label ? `[SMS:Batch:${label}]` : "[SMS:Batch]";

  if (!jobs || jobs.length === 0) {
    console.log(`${tag} No jobs to process`);
    return [];
  }

  console.log(
    `${tag} Sending ${jobs.length} message(s) sequentially with ${delayMs}ms between each (~${Math.round(1000 / delayMs)}/sec). This will take ~${Math.round((jobs.length * delayMs) / 1000)}s.`,
  );

  const allResults = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    // Delay before every send except the very first
    if (i > 0) {
      await sleep(delayMs);
    }

    console.log(
      `${tag} Sending ${i + 1}/${jobs.length} to ${job.to || "(unknown)"}`,
    );

    try {
      const result = await sendSmsAndLog(job);
      allResults.push({ ...result, index: i });
    } catch (err) {
      console.error(`${tag} Job ${i} threw unexpectedly: ${err.message}`);
      allResults.push({
        success: false,
        error: err.message,
        index: i,
      });
    }
  }

  const successCount = allResults.filter((r) => r.success).length;
  const failCount = allResults.length - successCount;
  console.log(
    `${tag} Done — ${successCount} succeeded, ${failCount} failed out of ${allResults.length}`,
  );

  return allResults;
}

// ── Quo-optimised bulk batch sender ──────────────────────────────────────────
/**
 * Like sendSmsBatch but uses Quo's native multi-recipient feature to collapse
 * up to 10 same-message jobs into a single API call.
 *
 * Advantages over sendSmsBatch (sequential, one-call-per-message):
 *  • Identical messages → 1 API call for up to 10 recipients (10× fewer calls)
 *  • API calls spaced 110 ms apart → ≈9 calls/sec (safely under Quo's 10/sec cap)
 *  • Deduplication and DB logging still happen per recipient
 *
 * Falls back to regular sendSmsBatch when the provider is not Quo.
 *
 * @param {Object} opts
 * @param {Array}  opts.jobs   - Same shape as sendSmsBatch jobs
 * @param {string} [opts.label]
 * @param {Object} [opts.config] - Pre-loaded SMS config (optional — loaded if omitted)
 */
export async function sendSmsBatchOptimized({ jobs, label, config }) {
  const tag = label ? `[SMS:BatchOpt:${label}]` : "[SMS:BatchOpt]";

  if (!jobs || jobs.length === 0) {
    console.log(`${tag} No jobs to process`);
    return [];
  }

  // Load config once if not supplied
  if (!config) {
    config = await loadSmsConfig();
  }

  // Non-Quo provider → fall back to standard sequential sender
  if (!config.ready || config.providerNormalized !== "quo") {
    console.log(
      `${tag} Provider is "${config.provider || "unknown"}" — falling back to sequential sendSmsBatch`,
    );
    return sendSmsBatch({ jobs, label });
  }

  console.log(
    `${tag} Quo optimised batch: ${jobs.length} job(s). Will group same-message recipients (≤10/call) and pace at ~9 calls/sec.`,
  );

  // ── Deduplication pass — filter out duplicates before hitting Quo ──────────
  const recipients = []; // [{to, message, job}] — validated, non-duplicate
  const skippedResults = [];

  for (const job of jobs) {
    if (!job.to || !job.message) {
      skippedResults.push({
        success: false,
        error: "Missing to or message",
        skipped: true,
      });
      continue;
    }

    const normalizedTo = toE164(job.to); // toE164 is defined locally in this file
    if (!normalizedTo) {
      skippedResults.push({
        success: false,
        error: `Invalid phone: ${job.to}`,
        skipped: true,
      });
      continue;
    }

    // In-memory dedup
    if (isDuplicateSms(normalizedTo, job.message)) {
      console.log(`${tag} ⏭️  Deduped (in-memory): ${normalizedTo}`);
      skippedResults.push({
        success: false,
        skipped: true,
        reason: "Duplicate (in-memory)",
      });
      continue;
    }

    // DB dedup
    const dbDup = await isDuplicateSmsDb(normalizedTo, job.message);
    if (dbDup) {
      console.log(`${tag} ⏭️  Deduped (DB): ${normalizedTo}`);
      skippedResults.push({
        success: false,
        skipped: true,
        reason: "Duplicate (DB)",
      });
      continue;
    }

    recipients.push({ to: job.to, message: job.message, job });
  }

  if (recipients.length === 0) {
    console.log(
      `${tag} All ${jobs.length} job(s) were deduped — nothing to send`,
    );
    return skippedResults;
  }

  // ── Fire the bulk Quo sender ───────────────────────────────────────────────
  const quoResults = await sendSmsBulkViaQuo({
    apiKey: config.credentials.apiKey,
    phoneNumberId: config.credentials.phoneNumberId,
    userId: config.credentials.userId,
    recipients: recipients.map((r) => ({ to: r.to, message: r.message })),
  });

  // ── Log each result to the DB and update dedup cache ──────────────────────
  const allResults = [...skippedResults];

  for (let i = 0; i < recipients.length; i++) {
    const { to, message, job } = recipients[i];
    const quoResult = quoResults[i] || {
      success: false,
      error: "No result returned",
    };

    if (quoResult.success) {
      // Record in dedup cache so we don't re-send within the 5-min window
      recordSmsSent(toE164(to) || to, message);

      // Log to sms_messages table
      try {
        await sql`
          INSERT INTO sms_messages (
            tenant_id, appointment_id, client_id, direction, phone, message,
            sender_name, provider, conversation_id, metadata, created_at, sent_at
          ) VALUES (
            ${job.tenantId || 1},
            ${job.appointmentId || null},
            ${job.clientId || null},
            'outbound',
            ${to},
            ${message},
            ${job.senderName || null},
            ${"quo"},
            ${job.conversationId || null},
            ${JSON.stringify(job.metadata || {})},
            NOW(),
            NOW()
          )
        `;
      } catch (logErr) {
        console.error(`${tag} DB log failed for ${to}: ${logErr.message}`);
      }

      allResults.push({ success: true, provider: "quo" });
    } else {
      allResults.push({
        success: false,
        error: quoResult.error,
        provider: "quo",
      });
    }
  }

  const successCount = allResults.filter((r) => r.success).length;
  console.log(
    `${tag} 🏁 Done — ${successCount}/${allResults.length} delivered`,
  );

  return allResults;
}
