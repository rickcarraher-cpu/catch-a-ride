import sql from "./sql";
import { getCompanyEmail } from "./confirmations/settingsHelpers";

// ── Email Deduplication Cache ────────────────────────────────────────────────
// Prevents identical emails from being sent to the same address within a short
// time window. Keyed by "normalizedEmail::subjectFingerprint".
// Mirrors the in-memory dedup in sms-sender.js.
const recentEmailSends = new Map();
const EMAIL_DEDUP_WINDOW_MS = 300_000; // 5 minutes

/**
 * Build a deduplication key for an email send.
 * Uses recipient address + first 100 chars of subject.
 */
function buildEmailDeduplicationKey(email, subject) {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const subjectFingerprint = (subject || "").substring(0, 100).trim();
  return `${normalizedEmail}::${subjectFingerprint}`;
}

/**
 * In-memory duplicate check — fast, but doesn't survive cold starts.
 * Returns true if this is a duplicate that should be skipped.
 */
function isDuplicateEmail(email, subject) {
  const key = buildEmailDeduplicationKey(email, subject);
  const lastSent = recentEmailSends.get(key);
  return !!(lastSent && Date.now() - lastSent < EMAIL_DEDUP_WINDOW_MS);
}

/**
 * Database-backed duplicate check — survives serverless cold starts.
 * Checks email_logs for the same recipient + subject within the last 5 minutes.
 * Returns true (duplicate) or false (safe to send).
 */
async function isDuplicateEmailDb(email, subject, tenantId = 1) {
  try {
    const normalizedEmail = (email || "").toLowerCase().trim();
    const subjectFingerprint = (subject || "").substring(0, 100).trim();
    const rows = await sql(
      `SELECT id FROM email_logs
       WHERE tenant_id = $1
         AND LOWER(recipient_email) = $2
         AND LEFT(subject, 100) = $3
         AND status = 'sent'
         AND sent_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [tenantId, normalizedEmail, subjectFingerprint],
    );
    return rows.length > 0;
  } catch (err) {
    // Fail open — if the DB check errors, let the email through
    console.error("[Email:Dedup:DB] Check failed (failing open):", err.message);
    return false;
  }
}

/**
 * Record that an email was sent (for in-memory deduplication tracking).
 * Also prunes stale entries to prevent memory leaks.
 */
function recordEmailSent(email, subject) {
  const key = buildEmailDeduplicationKey(email, subject);
  recentEmailSends.set(key, Date.now());

  // Prune old entries periodically
  if (recentEmailSends.size > 500) {
    const now = Date.now();
    for (const [k, v] of recentEmailSends) {
      if (now - v > EMAIL_DEDUP_WINDOW_MS) {
        recentEmailSends.delete(k);
      }
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Helper function to parse and clean email addresses from CSV string or array
function parseEmailAddresses(emailInput) {
  // Already an array? Parse each element in case any contain commas
  if (Array.isArray(emailInput)) {
    return emailInput
      .flatMap((e) =>
        typeof e === "string" ? e.split(",").map((addr) => addr.trim()) : [e],
      )
      .filter((e) => e && typeof e === "string" && e.includes("@"));
  }
  // String? Split by comma
  if (typeof emailInput === "string") {
    return emailInput
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));
  }
  // Invalid input
  return [];
}

export async function sendEmail({
  to,
  from,
  subject,
  html,
  text,
  bcc,
  appointmentId = null,
  recipientName = null,
  emailType = null,
  tenantId = 1,
}) {
  // Get company email from settings for this tenant
  const defaultEmail = await getCompanyEmail(tenantId);
  const FALLBACK_FROM = `Catch A Ride <${defaultEmail}>`;

  // Log raw incoming from for debugging
  console.log(`[sendEmail:tenant${tenantId}] Raw incoming from:`, from);

  // Hard override — replace stale domain no matter where it came from
  let sanitizedFrom = from
    ? from.replace(/myservicetracker\.biz/gi, "catcharide.us")
    : from;

  const isValidFrom = (addr) =>
    addr &&
    addr.includes("@") &&
    !addr.trim().endsWith("@") &&
    !addr.trim().endsWith("@>");

  const fromAddress = isValidFrom(sanitizedFrom)
    ? sanitizedFrom
    : FALLBACK_FROM;

  // Parse email addresses (handles comma-separated strings)
  const toAddresses = parseEmailAddresses(to);
  const bccAddresses = bcc ? parseEmailAddresses(bcc) : [];

  console.log(`[sendEmail:tenant${tenantId}] Attempting to send email:`);
  console.log("  → To:", toAddresses);
  console.log("  → From:", fromAddress);
  console.log("  → Subject:", subject);
  console.log("  → BCC:", bccAddresses.length > 0 ? bccAddresses : "none");
  console.log("  → RESEND_API_KEY set?", !!process.env.RESEND_API_KEY);

  // ── Deduplication checks ────────────────────────────────────────────────────
  // Check each primary recipient for duplicates. If ALL recipients are duplicates,
  // skip sending entirely. If only some are duplicates, we still send (rare edge
  // case — e.g. cc_emails with overlapping addresses).
  if (toAddresses.length > 0) {
    const primaryRecipient = toAddresses[0];
    const dedupKey = buildEmailDeduplicationKey(primaryRecipient, subject);

    if (isDuplicateEmail(primaryRecipient, subject)) {
      console.log(
        `[sendEmail:tenant${tenantId}] ⏭️  Email deduped (in-memory): ${dedupKey}`,
      );
      // Log the skipped attempt so it still appears in the communication log
      try {
        await sql(
          `INSERT INTO email_logs (
            tenant_id, appointment_id, recipient_email, recipient_name,
            subject, body, status, email_type, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7, $8)`,
          [
            tenantId,
            appointmentId,
            primaryRecipient,
            recipientName,
            subject,
            html || text || "",
            emailType,
            "Duplicate email suppressed (sent within the last 5 minutes)",
          ],
        );
      } catch (logErr) {
        console.error(
          `[sendEmail:tenant${tenantId}] Failed to log skipped email:`,
          logErr.message || logErr,
        );
      }
      return { skipped: true, reason: "Duplicate email (in-memory)" };
    }

    const dbDup = await isDuplicateEmailDb(primaryRecipient, subject, tenantId);
    if (dbDup) {
      console.log(
        `[sendEmail:tenant${tenantId}] ⏭️  Email deduped (DB — same email sent within last 5 min): ${dedupKey}`,
      );
      // Log the skipped attempt so it still appears in the communication log
      try {
        await sql(
          `INSERT INTO email_logs (
            tenant_id, appointment_id, recipient_email, recipient_name,
            subject, body, status, email_type, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, 'skipped', $7, $8)`,
          [
            tenantId,
            appointmentId,
            primaryRecipient,
            recipientName,
            subject,
            html || text || "",
            emailType,
            "Duplicate email suppressed (sent within the last 5 minutes)",
          ],
        );
      } catch (logErr) {
        console.error(
          `[sendEmail:tenant${tenantId}] Failed to log skipped email:`,
          logErr.message || logErr,
        );
      }
      return { skipped: true, reason: "Duplicate email (DB)" };
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: toAddresses,
      subject,
      html,
      text,
      ...(bccAddresses.length > 0 ? { bcc: bccAddresses } : {}),
    }),
  });

  const data = await response.json();
  console.log(
    `[sendEmail:tenant${tenantId}] Resend response status:`,
    response.status,
  );
  console.log(
    `[sendEmail:tenant${tenantId}] Resend response body:`,
    JSON.stringify(data),
  );

  if (!response.ok) {
    console.error(
      `[sendEmail:tenant${tenantId}] Resend error:`,
      JSON.stringify(data),
    );

    // Log failed email attempt using function form to avoid ::jsonb parse issues
    try {
      await sql(
        `INSERT INTO email_logs (
          tenant_id, appointment_id, recipient_email, recipient_name,
          subject, body, status, email_type, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, 'failed', $7, $8)`,
        [
          tenantId,
          appointmentId,
          toAddresses[0] || "unknown",
          recipientName,
          subject,
          html || text || "",
          emailType,
          data.message || "Failed to send email",
        ],
      );
    } catch (logErr) {
      console.error(
        `[sendEmail:tenant${tenantId}] Failed to log error:`,
        logErr.message || logErr,
      );
    }

    throw new Error(data.message || "Failed to send email");
  }

  console.log(
    `[sendEmail:tenant${tenantId}] ✅ Email sent successfully, id:`,
    data.id,
  );

  // Record the send in the in-memory dedup cache
  if (toAddresses.length > 0) {
    recordEmailSent(toAddresses[0], subject);
  }

  // Log successful email send — use function form of sql() to avoid ::jsonb
  // tagged-template parsing issues that silently drop the log entry.
  const metadataJson = JSON.stringify({ resend_id: data.id || null });
  try {
    await sql(
      `INSERT INTO email_logs (
        tenant_id, appointment_id, recipient_email, recipient_name,
        subject, body, status, email_type, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7, $8)`,
      [
        tenantId,
        appointmentId,
        toAddresses[0] || "unknown",
        recipientName,
        subject,
        html || text || "",
        emailType,
        metadataJson,
      ],
    );
  } catch (logErr) {
    console.error(
      `[sendEmail:tenant${tenantId}] Failed to log email (full): ${logErr.message || logErr}`,
    );
    // Fallback: insert without metadata so the log entry always gets created
    try {
      await sql(
        `INSERT INTO email_logs (
          tenant_id, appointment_id, recipient_email, recipient_name,
          subject, body, status, email_type
        ) VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7)`,
        [
          tenantId,
          appointmentId,
          toAddresses[0] || "unknown",
          recipientName,
          subject,
          html || text || "",
          emailType,
        ],
      );
    } catch (fallbackErr) {
      console.error(
        `[sendEmail:tenant${tenantId}] Fallback log also failed: ${fallbackErr.message || fallbackErr}`,
      );
    }
  }

  return { id: data.id };
}
