// ── Multi-tenant VIP notification settings ─────────────────────────────────────
// DEPRECATED: These hardcoded constants are now replaced by per-tenant settings.
// Use getAlwaysNotifyEmails(tenantId) and getAlwaysNotifyNames(tenantId) from
// settingsHelpers.js instead.
//
// These are kept for backward compatibility during transition only.

/**
 * @deprecated Use getAlwaysNotifyEmails(tenantId) from settingsHelpers.js instead
 */
export const ALWAYS_NOTIFY_EMAILS = ["rickcarraher@gmail.com"];

/**
 * @deprecated Use getAlwaysNotifyNames(tenantId) from settingsHelpers.js instead
 */
export const ALWAYS_NOTIFY_NAMES = ["rick carraher"];
