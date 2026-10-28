import sql from "@/app/api/utils/sql";
import { requireAuth, optionalAuth } from "@/app/api/utils/auth-guard";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

export async function GET(request) {
  // Settings GET is public for the booking wizard, but we only expose safe keys
  // to unauthenticated users
  const session = await optionalAuth();
  const isAuthenticated = !!(session && session.user?.email);

  try {
    const tenantId = await resolveTenantFromSession(request);

    const settings =
      await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`;
    const settingsMap = settings.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    // If not authenticated, only return public-safe keys
    if (!isAuthenticated) {
      const safeKeys = [
        "business_name",
        "business_phone",
        "business_email",
        "business_address",
        "logo_url",
        "booking_page_title",
        "booking_page_subtitle",
        "payment_venmo_enabled",
        "payment_zelle_enabled",
        "payment_square_enabled",
        "credit_card_fee_percent",
        "rate_per_mile",
        "require_welcome_screen",
        "booking_message",
        "business_hours_start",
        "business_hours_end",
      ];
      const publicSettings = {};
      for (const key of safeKeys) {
        if (settingsMap[key] !== undefined) {
          publicSettings[key] = settingsMap[key];
        }
      }
      return Response.json(publicSettings);
    }

    return Response.json(settingsMap);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const tenantId = await resolveTenantFromSession(request);
    const { key, value } = await request.json();
    console.log(`[Settings API] Saving setting: ${key} = ${value}`);

    if (!key)
      return Response.json({ error: "Key is required" }, { status: 400 });

    await sql`
      INSERT INTO settings (tenant_id, key, value)
      VALUES (${tenantId}, ${key}, ${value})
      ON CONFLICT (tenant_id, key) DO UPDATE SET value = ${value}
    `;

    console.log(`[Settings API] Successfully saved ${key} = ${value}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[Settings API] Error saving setting:", error);
    return Response.json(
      { error: "Failed to update setting" },
      { status: 500 },
    );
  }
}

export async function DELETE(request) {
  try {
    const tenantId = await resolveTenantFromSession(request);
    const { key } = await request.json();
    if (!key)
      return Response.json({ error: "Key is required" }, { status: 400 });

    await sql`
      DELETE FROM settings
      WHERE tenant_id = ${tenantId} AND key = ${key}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("[Settings API] Error deleting setting:", error);
    return Response.json(
      { error: "Failed to delete setting" },
      { status: 500 },
    );
  }
}
