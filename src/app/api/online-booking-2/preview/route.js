import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

/**
 * Online Booking 2.0 — Preview endpoint (admin-only, read-only)
 *
 * Assembles everything the dashboard preview panel needs by REUSING existing
 * data sources (services, preferred locations, online booking stats) without
 * modifying any legacy behavior.
 */
export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const tenantId = await resolveTenantFromSession(request);

    // OB2 configuration
    const settingRows = await sql`
      SELECT key, value FROM settings
      WHERE tenant_id = ${tenantId} AND key LIKE 'ob2_%'
    `;
    const settings = {};
    for (const { key, value } of settingRows) {
      settings[key] = value;
    }

    // Services the new flow would offer (reuse services catalog — read only)
    const services = await sql`
      SELECT id, name, description, default_price, duration_minutes,
             is_variable_price, is_airport_service, is_addon
      FROM services
      WHERE tenant_id = ${tenantId} AND is_active = true
      ORDER BY display_order ASC, name ASC
    `;

    // Preferred locations available for quick pickup/dropoff selection
    const locations = await sql`
      SELECT id, label, emoji, is_airport
      FROM preferred_locations
      WHERE is_active = true
      ORDER BY display_order ASC, label ASC
    `;

    // Recent online booking activity (last 30 days) for the overview stats
    const statsResult = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM appointments
      WHERE tenant_id = ${tenantId}
        AND (booked_by = 'Online' OR booked_by = 'Passenger')
        AND created_at > NOW() - INTERVAL '30 days'
    `;

    // Integration readiness (diagnostics only — never exposes secret values)
    const squareReady = !!(
      process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID
    );
    const emailReady = !!process.env.RESEND_API_KEY;

    return Response.json({
      settings,
      services,
      locations,
      stats: statsResult[0] || { total: 0, pending: 0 },
      integrations: {
        square: {
          configured: squareReady,
          environment: process.env.SQUARE_ENVIRONMENT || null,
        },
        email: {
          configured: emailReady,
        },
      },
    });
  } catch (error) {
    console.error("[OB2 Preview] error:", error);
    return Response.json(
      { error: "Failed to build Online Booking 2.0 preview" },
      { status: 500 },
    );
  }
}
