import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

/**
 * Online Booking 2.0 — Admin settings API (ISOLATED from the legacy booking flow)
 *
 * All keys are prefixed with "ob2_" so they can never collide with the
 * legacy booking configuration stored in the same settings table.
 * The legacy /book/[slug] flow never reads ob2_* keys.
 */

export const OB2_SETTING_KEYS = [
  // Status
  "ob2_enabled",
  // Branding & content
  "ob2_headline",
  "ob2_subheadline",
  "ob2_hero_image_url",
  "ob2_theme_color",
  "ob2_booking_page_message",
  // Booking rules
  "ob2_show_pricing",
  "ob2_require_phone",
  "ob2_require_email",
  "ob2_enable_round_trip",
  "ob2_enable_addons",
  "ob2_enable_flight_fields",
  "ob2_enable_special_requests",
  "ob2_enable_referral_source",
  "ob2_default_service_id",
  "ob2_min_notice_hours",
  "ob2_max_days_ahead",
  // Payments
  "ob2_payment_mode",
  "ob2_deposit_percent",
  // Notifications
  "ob2_confirmation_email_enabled",
  "ob2_confirmation_sms_enabled",
  "ob2_confirmation_email_text",
  "ob2_confirmation_sms_text",
  "ob2_owner_alert_email",
  "ob2_owner_alert_sms",
  "ob2_thankyou_enabled",
  "ob2_thankyou_delay_hours",
  "ob2_thankyou_message",
];

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const tenantId = await resolveTenantFromSession(request);
    const rows = await sql`
      SELECT key, value FROM settings
      WHERE tenant_id = ${tenantId} AND key LIKE 'ob2_%'
    `;
    const settings = {};
    for (const { key, value } of rows) {
      settings[key] = value;
    }
    return Response.json({ settings });
  } catch (error) {
    console.error("[OB2 Settings] GET error:", error);
    return Response.json(
      { error: "Failed to load Online Booking 2.0 settings" },
      { status: 500 },
    );
  }
}

export async function PUT(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const tenantId = await resolveTenantFromSession(request);
    const body = await request.json();
    const updates = body?.settings;

    if (!updates || typeof updates !== "object") {
      return Response.json(
        { error: "A settings object is required" },
        { status: 400 },
      );
    }

    // Only accept known ob2_ keys — never allow writes to legacy keys
    const entries = Object.entries(updates).filter(([key]) =>
      OB2_SETTING_KEYS.includes(key),
    );

    if (entries.length === 0) {
      return Response.json(
        { error: "No valid Online Booking 2.0 setting keys provided" },
        { status: 400 },
      );
    }

    for (const [key, rawValue] of entries) {
      const value =
        rawValue === null || rawValue === undefined ? null : String(rawValue);
      await sql`
        INSERT INTO settings (tenant_id, key, value)
        VALUES (${tenantId}, ${key}, ${value})
        ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${value}
      `;
    }

    // Return the fresh state
    const rows = await sql`
      SELECT key, value FROM settings
      WHERE tenant_id = ${tenantId} AND key LIKE 'ob2_%'
    `;
    const settings = {};
    for (const { key, value } of rows) {
      settings[key] = value;
    }

    return Response.json({ settings, updated: entries.length });
  } catch (error) {
    console.error("[OB2 Settings] PUT error:", error);
    return Response.json(
      { error: "Failed to save Online Booking 2.0 settings" },
      { status: 500 },
    );
  }
}
