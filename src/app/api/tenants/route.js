import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

/**
 * Helper to parse a cookie value from request headers
 */
function getCookieValue(request, name) {
  const cookieHeader = request.headers?.get?.("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenants = await sql`
      SELECT id, name, slug
      FROM tenants
      ORDER BY name ASC
    `;

    // Read current override cookie from request headers
    const overrideValue = getCookieValue(request, "x_tenant_override");
    const currentTenantId = overrideValue ? parseInt(overrideValue, 10) : null;

    return Response.json({ tenants, currentTenantId });
  } catch (error) {
    console.error("[Tenants API] Error fetching tenants:", error);
    return Response.json({ error: "Failed to fetch tenants" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tenantId } = await request.json();

    if (!tenantId) {
      // Clear override — revert to user's natural tenant
      const resp = Response.json({ success: true, cleared: true });
      resp.headers.set(
        "Set-Cookie",
        "x_tenant_override=; Path=/; Max-Age=0; SameSite=Lax",
      );
      return resp;
    }

    // Validate tenant exists
    const [tenant] = await sql`
      SELECT id, name FROM tenants WHERE id = ${tenantId}
    `;

    if (!tenant) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const resp = Response.json({ success: true, tenant });
    resp.headers.set(
      "Set-Cookie",
      `x_tenant_override=${tenantId}; Path=/; Max-Age=${60 * 60 * 8}; SameSite=Lax; HttpOnly${secure}`,
    );
    return resp;
  } catch (error) {
    console.error("[Tenants API] Error switching tenant:", error);
    return Response.json({ error: "Failed to switch tenant" }, { status: 500 });
  }
}

// Create a new tenant
export async function PUT(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("[Tenants API PUT] Received body:", body);

    const { name, slug, email, phone, address } = body;

    // Validation
    if (!name?.trim()) {
      return Response.json(
        { error: "Tenant name is required" },
        { status: 400 },
      );
    }
    if (!slug?.trim()) {
      return Response.json({ error: "Slug is required" }, { status: 400 });
    }

    // Check if slug already exists
    const [existing] = await sql`
      SELECT id FROM tenants WHERE slug = ${slug.trim().toLowerCase()}
    `;
    if (existing) {
      return Response.json(
        { error: "A tenant with this slug already exists" },
        { status: 409 },
      );
    }

    // Create tenant
    const [newTenant] = await sql`
      INSERT INTO tenants (name, slug, email, phone, address)
      VALUES (
        ${name.trim()},
        ${slug.trim().toLowerCase()},
        ${email?.trim() || null},
        ${phone?.trim() || null},
        ${address?.trim() || null}
      )
      RETURNING id, name, slug, email, phone, address, created_at
    `;

    console.log("[Tenants API PUT] Created tenant:", newTenant);
    return Response.json(newTenant, { status: 201 });
  } catch (error) {
    console.error("[Tenants API PUT] Error creating tenant:", error);
    console.error("[Tenants API PUT] Error stack:", error.stack);
    return Response.json(
      {
        error: "Failed to create tenant",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Update an existing tenant
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("[Tenants API PATCH] Received body:", body);

    const { id, name, slug, email, phone, address } = body;

    if (!id) {
      return Response.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;

    if (name?.trim()) {
      updates.push(`name = $${++paramCount}`);
      values.push(name.trim());
    }
    if (slug?.trim()) {
      // Check if new slug conflicts with another tenant
      const [existing] = await sql`
        SELECT id FROM tenants 
        WHERE slug = ${slug.trim().toLowerCase()} 
        AND id != ${id}
      `;
      if (existing) {
        return Response.json(
          { error: "A tenant with this slug already exists" },
          { status: 409 },
        );
      }
      updates.push(`slug = $${++paramCount}`);
      values.push(slug.trim().toLowerCase());
    }
    if (email !== undefined) {
      updates.push(`email = $${++paramCount}`);
      values.push(email?.trim() || null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${++paramCount}`);
      values.push(phone?.trim() || null);
    }
    if (address !== undefined) {
      updates.push(`address = $${++paramCount}`);
      values.push(address?.trim() || null);
    }

    if (updates.length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE tenants
      SET ${updates.join(", ")}
      WHERE id = $${++paramCount}
      RETURNING id, name, slug, email, phone, address, created_at
    `;

    console.log(
      "[Tenants API PATCH] Executing query:",
      query,
      "with values:",
      values,
    );
    const [updated] = await sql(query, values);

    if (!updated) {
      return Response.json({ error: "Tenant not found" }, { status: 404 });
    }

    console.log("[Tenants API PATCH] Updated tenant:", updated);
    return Response.json(updated);
  } catch (error) {
    console.error("[Tenants API PATCH] Error updating tenant:", error);
    console.error("[Tenants API PATCH] Error stack:", error.stack);
    return Response.json(
      {
        error: "Failed to update tenant",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Delete a tenant (dangerous operation - consider soft delete instead)
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return Response.json({ error: "Tenant ID is required" }, { status: 400 });
    }

    // Prevent deletion of tenant ID 1 (default tenant)
    if (parseInt(id) === 1) {
      return Response.json(
        { error: "Cannot delete the default tenant" },
        { status: 403 },
      );
    }

    // Check if tenant has any data (appointments, clients, employees, etc.)
    const [hasData] = await sql`
      SELECT 
        (SELECT COUNT(*) FROM appointments WHERE tenant_id = ${id}) as appointment_count,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = ${id}) as client_count,
        (SELECT COUNT(*) FROM employees WHERE tenant_id = ${id}) as employee_count
    `;

    const totalRecords =
      parseInt(hasData.appointment_count || 0) +
      parseInt(hasData.client_count || 0) +
      parseInt(hasData.employee_count || 0);

    if (totalRecords > 0) {
      return Response.json(
        {
          error: "Cannot delete tenant with existing data",
          details: {
            appointments: hasData.appointment_count,
            clients: hasData.client_count,
            employees: hasData.employee_count,
          },
        },
        { status: 409 },
      );
    }

    // Delete tenant
    await sql`DELETE FROM tenants WHERE id = ${id}`;

    return Response.json({
      success: true,
      message: "Tenant deleted successfully",
    });
  } catch (error) {
    console.error("[Tenants API] Error deleting tenant:", error);
    return Response.json({ error: "Failed to delete tenant" }, { status: 500 });
  }
}
