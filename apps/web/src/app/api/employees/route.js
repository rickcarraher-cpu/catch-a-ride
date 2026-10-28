import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { buildAddress, parseAddress } from "@/app/api/utils/address-parser";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const tenantId = await resolveTenantFromSession(request);

    const employees = await sql`
      SELECT * FROM employees 
      WHERE tenant_id = ${tenantId} 
      ORDER BY name ASC
    `;

    // Map employees to include password status without exposing the hash
    const employeesWithPasswordStatus = employees.map((emp) => ({
      ...emp,
      password: emp.password ? "***" : null, // Indicate if password is set without exposing hash
    }));

    return Response.json(employeesWithPasswordStatus);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch employees" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      name,
      first_name,
      last_name,
      email,
      phone,
      address,
      street_address,
      city,
      state,
      zip_code,
      notes,
      color,
      salary_rate,
      is_active,
      rotation_order,
      profile_image_url,
      copy_communications_to_company,
      is_admin,
      new_password,
      force_password_reset,
      adp_worker_id,
      can_cancel_trip,
    } = await request.json();

    // Compute full name from first_name and last_name
    const fullName =
      first_name && last_name
        ? `${first_name} ${last_name}`.trim()
        : first_name || last_name || name || "";

    // Auto-assign next rotation_order if not provided
    let rotOrder = rotation_order;
    if (!rotOrder) {
      const [max] =
        await sql`SELECT COALESCE(MAX(rotation_order), 0) + 1 AS next FROM employees WHERE tenant_id = 1`;
      rotOrder = max.next;
    }

    // Parse address into structured fields if legacy address provided
    let finalStreetAddress = street_address;
    let finalCity = city;
    let finalState = state;
    let finalZipCode = zip_code;
    let finalAddress = address;

    if (address && !street_address) {
      const parsed = parseAddress(address);
      finalStreetAddress = parsed.street_address;
      finalCity = parsed.city;
      finalState = parsed.state;
      finalZipCode = parsed.zip_code;
    }

    // Build address from structured components if they're provided
    if (street_address || city || state || zip_code) {
      finalAddress = buildAddress({
        street_address: finalStreetAddress,
        city: finalCity,
        state: finalState,
        zip_code: finalZipCode,
      });
    }

    // Determine password to use
    let passwordToUse = "1234"; // default password
    if (new_password && new_password.trim() !== "") {
      passwordToUse = new_password;
    }

    // Store password as plain text
    const finalPassword = passwordToUse;

    // Determine if password reset should be forced
    // Default to true unless explicitly set to false AND a custom password was provided
    const shouldForceReset =
      force_password_reset !== undefined ? force_password_reset : !new_password; // Force reset if using default password, don't force if custom password was set

    const result = await sql`
      INSERT INTO employees (
        tenant_id, name, first_name, last_name, email, phone, 
        address, street_address, city, state, zip_code,
        notes, color, salary_rate, is_active, rotation_order, profile_image_url,
        copy_communications_to_company, is_admin, password, force_password_reset, adp_worker_id,
        can_cancel_trip
      )
      VALUES (
        1, ${fullName}, ${first_name ?? null}, ${last_name ?? null}, ${email}, ${phone}, 
        ${finalAddress ?? null}, ${finalStreetAddress ?? null}, ${finalCity ?? null}, 
        ${finalState ?? null}, ${finalZipCode ?? null},
        ${notes ?? null}, ${color}, ${salary_rate || 0.75}, 
        ${is_active !== false}, ${rotOrder}, ${profile_image_url ?? null},
        ${copy_communications_to_company ?? false}, ${is_admin ?? false},
        ${finalPassword}, ${shouldForceReset}, ${adp_worker_id ?? null},
        ${can_cancel_trip ?? false}
      )
      RETURNING *
    `;

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create employee" },
      { status: 500 },
    );
  }
}
