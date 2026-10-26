import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

export async function GET(request) {
  // No auth required - services are public (needed for passenger booking wizard)

  try {
    const tenantId = await resolveTenantFromSession(request);

    const services = await sql`
      SELECT * FROM services 
      WHERE tenant_id = ${tenantId} 
      ORDER BY display_order ASC, name ASC
    `;
    return Response.json(services);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch services" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      name,
      description,
      default_price,
      duration_minutes,
      is_variable_price,
      display_order,
      is_active,
      is_airport_service,
      is_addon,
      can_passenger_request,
      is_tip_addon,
    } = await request.json();
    const result = await sql`
      INSERT INTO services (tenant_id, name, description, default_price, duration_minutes, is_variable_price, display_order, is_active, is_airport_service, is_addon, can_passenger_request, is_tip_addon)
      VALUES (1, ${name}, ${description}, ${default_price || 0}, ${duration_minutes || 75}, ${is_variable_price || false}, ${display_order || 0}, ${is_active !== false}, ${is_airport_service || false}, ${is_addon || false}, ${can_passenger_request || false}, ${is_tip_addon || false})
      RETURNING *
    `;
    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create service" },
      { status: 500 },
    );
  }
}
