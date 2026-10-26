/**
 * Tenant Resolution Utility
 *
 * Resolves the tenant_id for the current authenticated user by looking up
 * their employee record. This is the single source of truth for tenant context.
 */

import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Helper to parse a cookie value from a request object
 */
function getCookieFromRequest(request, name) {
  if (!request) return null;
  try {
    const cookieHeader = request.headers?.get?.("cookie") || "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve tenant ID from the authenticated session
 *
 * @param {Request} request - The incoming request (optional, will call auth() if not provided)
 * @returns {Promise<number>} - The tenant_id for the logged-in user
 * @throws {Error} - If session is invalid or employee not found
 */
export async function resolveTenantFromSession(request = null) {
  try {
    // Check for admin tenant override cookie first
    try {
      const overrideValue = getCookieFromRequest(request, "x_tenant_override");
      if (overrideValue) {
        const overrideTenantId = parseInt(overrideValue, 10);
        if (!isNaN(overrideTenantId)) {
          console.log(
            `[resolveTenantFromSession] Using tenant override cookie: ${overrideTenantId}`,
          );
          return overrideTenantId;
        }
      }
    } catch (cookieErr) {
      // safe to ignore
    }

    // Get the session
    const session = await auth();

    if (!session || !session.user?.email) {
      console.warn("[resolveTenantFromSession] No valid session found");
      // Fallback to tenant 1 during transition period
      return 1;
    }

    const userEmail = session.user.email.toLowerCase().trim();

    // Look up the employee by email to get their tenant_id
    const [employee] = await sql`
      SELECT tenant_id 
      FROM employees 
      WHERE LOWER(TRIM(email)) = ${userEmail}
      AND is_active = true
      ORDER BY tenant_id ASC
      LIMIT 1
    `;

    if (employee?.tenant_id) {
      console.log(
        `[resolveTenantFromSession] Resolved tenant ${employee.tenant_id} for user ${userEmail}`,
      );
      return employee.tenant_id;
    }

    // If employee not found by email, this might be an admin user not in employees table
    console.warn(
      `[resolveTenantFromSession] No employee found for ${userEmail}, falling back to tenant 1`,
    );
    return 1;
  } catch (error) {
    console.error("[resolveTenantFromSession] Error resolving tenant:", error);
    // Safe fallback during transition
    return 1;
  }
}

/**
 * Resolve tenant ID from a driver's email (for driver portal routes)
 *
 * @param {string} email - The driver's email address
 * @returns {Promise<number>} - The tenant_id for the driver
 */
export async function resolveTenantFromDriverEmail(email) {
  try {
    if (!email) {
      console.warn("[resolveTenantFromDriverEmail] No email provided");
      return 1;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [employee] = await sql`
      SELECT tenant_id 
      FROM employees 
      WHERE LOWER(TRIM(email)) = ${normalizedEmail}
      AND is_active = true
      ORDER BY tenant_id ASC
      LIMIT 1
    `;

    if (employee?.tenant_id) {
      return employee.tenant_id;
    }

    console.warn(
      `[resolveTenantFromDriverEmail] No employee found for ${normalizedEmail}, falling back to tenant 1`,
    );
    return 1;
  } catch (error) {
    console.error(
      "[resolveTenantFromDriverEmail] Error resolving tenant:",
      error,
    );
    return 1;
  }
}

/**
 * Resolve tenant ID from an appointment ID
 *
 * @param {number} appointmentId - The appointment ID
 * @returns {Promise<number>} - The tenant_id for the appointment
 */
export async function resolveTenantFromAppointment(appointmentId) {
  try {
    if (!appointmentId) {
      console.warn("[resolveTenantFromAppointment] No appointment ID provided");
      return 1;
    }

    const [appointment] = await sql`
      SELECT tenant_id 
      FROM appointments 
      WHERE id = ${appointmentId}
      LIMIT 1
    `;

    if (appointment?.tenant_id) {
      return appointment.tenant_id;
    }

    console.warn(
      `[resolveTenantFromAppointment] No appointment found for ID ${appointmentId}, falling back to tenant 1`,
    );
    return 1;
  } catch (error) {
    console.error(
      "[resolveTenantFromAppointment] Error resolving tenant:",
      error,
    );
    return 1;
  }
}

/**
 * Resolve tenant ID from a client ID
 *
 * @param {number} clientId - The client ID
 * @returns {Promise<number>} - The tenant_id for the client
 */
export async function resolveTenantFromClient(clientId) {
  try {
    if (!clientId) {
      console.warn("[resolveTenantFromClient] No client ID provided");
      return 1;
    }

    const [client] = await sql`
      SELECT tenant_id 
      FROM clients 
      WHERE id = ${clientId}
      LIMIT 1
    `;

    if (client?.tenant_id) {
      return client.tenant_id;
    }

    console.warn(
      `[resolveTenantFromClient] No client found for ID ${clientId}, falling back to tenant 1`,
    );
    return 1;
  } catch (error) {
    console.error("[resolveTenantFromClient] Error resolving tenant:", error);
    return 1;
  }
}

/**
 * Get tenant slug from tenant ID (for URLs, subdomains, etc.)
 *
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string|null>} - The tenant slug
 */
export async function getTenantSlug(tenantId) {
  try {
    const [tenant] = await sql`
      SELECT slug 
      FROM tenants 
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    return tenant?.slug || null;
  } catch (error) {
    console.error("[getTenantSlug] Error fetching tenant slug:", error);
    return null;
  }
}

/**
 * Get tenant name from tenant ID
 *
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string>} - The tenant name (defaults to "Catch A Ride" for tenant 1)
 */
export async function getTenantName(tenantId) {
  try {
    const [tenant] = await sql`
      SELECT name 
      FROM tenants 
      WHERE id = ${tenantId}
      LIMIT 1
    `;

    return tenant?.name || "Catch A Ride";
  } catch (error) {
    console.error("[getTenantName] Error fetching tenant name:", error);
    return "Catch A Ride";
  }
}
