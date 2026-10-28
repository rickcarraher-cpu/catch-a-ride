/**
 * Settings and Configuration Helpers
 */

import sql from "@/app/api/utils/sql";

/**
 * Get base URL with fallback to settings
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getBaseUrl(tenantId = 1) {
  const envUrl = process.env.NEXT_PUBLIC_CREATE_APP_URL;

  // FIRST: Always check for custom_domain in settings — this is the user's real production domain
  try {
    const [setting] = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = ${tenantId} AND key = 'custom_domain'
    `;

    if (setting?.value) {
      const customUrl = setting.value.startsWith("http")
        ? setting.value
        : `https://${setting.value}`;
      console.log(
        `[getBaseUrl] Using custom_domain from settings for tenant ${tenantId}: ${customUrl}`,
      );
      return customUrl;
    }
  } catch (error) {
    console.error(
      `[getBaseUrl] Error fetching custom_domain for tenant ${tenantId}:`,
      error,
    );
  }

  // SECOND: Use env URL if available
  if (envUrl) {
    console.log(`[getBaseUrl] Using NEXT_PUBLIC_CREATE_APP_URL: ${envUrl}`);
    return envUrl;
  }

  // Fallback — no URL available
  console.warn(
    `[getBaseUrl] WARNING: No BASE_URL available for tenant ${tenantId}. Please set custom_domain in Settings.`,
  );
  return "https://your-domain.com";
}

/**
 * Load settings from database
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function loadSettings(tenantId = 1) {
  const rows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`;
  return rows.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {});
}

/**
 * Get office/company owner email from settings
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getOfficeEmail(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return settings.business_email || settings.owner_email || null;
}

/**
 * Get company name from settings with fallback
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getCompanyName(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return settings.business_name || settings.company_name || "Catch A Ride";
}

/**
 * Get company phone from settings with fallback
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getCompanyPhone(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return settings.business_phone || settings.company_phone || "615-756-8152";
}

/**
 * Get company email from settings with fallback
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getCompanyEmail(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return (
    settings.from_email || settings.business_email || "bookings@catcharide.us"
  );
}

/**
 * Get SMS sender name from settings with fallback
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getSmsSenderName(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return settings.sms_sender_name || settings.business_name || "CatchARide";
}

/**
 * Get ClickSend SMS source/from identifier from settings with fallback
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 */
export async function getClickSendSource(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  return (
    settings.clicksend_source || settings.sms_sender_name || "anything-limo"
  );
}

/**
 * Get list of emails that should always be notified (VIP list)
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 * @returns {Promise<string[]>} Array of email addresses
 */
export async function getAlwaysNotifyEmails(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  if (settings.always_notify_emails) {
    try {
      return JSON.parse(settings.always_notify_emails);
    } catch (e) {
      // If it's a comma-separated string instead of JSON
      return settings.always_notify_emails
        .split(",")
        .map((e) => e.trim().toLowerCase());
    }
  }
  // Fallback for tenant 1 (Catch A Ride) during transition
  return tenantId === 1 ? ["rickcarraher@gmail.com"] : [];
}

/**
 * Get list of names that should always be notified (VIP list)
 * @param {number} tenantId - The tenant ID (defaults to 1 for backward compatibility)
 * @returns {Promise<string[]>} Array of names
 */
export async function getAlwaysNotifyNames(tenantId = 1) {
  const settings = await loadSettings(tenantId);
  if (settings.always_notify_names) {
    try {
      return JSON.parse(settings.always_notify_names);
    } catch (e) {
      // If it's a comma-separated string instead of JSON
      return settings.always_notify_names
        .split(",")
        .map((n) => n.trim().toLowerCase());
    }
  }
  // Fallback for tenant 1 (Catch A Ride) during transition
  return tenantId === 1 ? ["rick carraher"] : [];
}

/**
 * Build contact advisory HTML block for inclusion in confirmation emails.
 * Uses "Non Reservation Number ID" for normal comms and "Reservation Number ID" for urgent.
 */
export function buildContactAdvisoryHtml(settings) {
  const reservationNumber = settings["Reservation Number ID"] || "";
  const nonReservationNumber = settings["Non Reservation Number ID"] || "";

  if (!reservationNumber && !nonReservationNumber) return "";

  const nonUrgentLine = nonReservationNumber
    ? `For normal communications (non-urgent), please use <strong>${nonReservationNumber}</strong>.`
    : "";
  const urgentLine = reservationNumber
    ? ` For urgent reasons, please call or text <strong>${reservationNumber}</strong>.`
    : "";

  return `
<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin:20px 0;text-align:center;font-size:14px;color:#0369a1;">
  <strong>📞 Contact Information</strong><br><br>
  ${nonUrgentLine}${urgentLine}
</div>`;
}

/**
 * Build contact advisory text line for SMS confirmations.
 * Appended to the end of the SMS body.
 */
export function buildContactAdvisorySms(settings) {
  const reservationNumber = settings["Reservation Number ID"] || "";
  const nonReservationNumber = settings["Non Reservation Number ID"] || "";

  if (!reservationNumber && !nonReservationNumber) return "";

  const parts = [];
  if (nonReservationNumber)
    parts.push(
      `For normal communications (non-urgent), please use ${nonReservationNumber}`,
    );
  if (reservationNumber)
    parts.push(`For urgent reasons, please call or text ${reservationNumber}`);

  return "\n" + parts.join(". ");
}
