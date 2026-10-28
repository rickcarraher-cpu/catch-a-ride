import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { normalizeToE164, isValidUSPhone } from "@/utils/phoneNormalizer";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const tenantId = await resolveTenantFromSession(request);

    // Check if we should include inactive passengers (for edit trip flow)
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    let clients;
    if (includeInactive) {
      // Return ALL clients including inactive (for edit mode)
      clients = await sql`
        SELECT * FROM clients 
        WHERE tenant_id = ${tenantId}
        ORDER BY name ASC
      `;
    } else {
      // Return only active clients (default behavior)
      clients = await sql`
        SELECT * FROM clients 
        WHERE tenant_id = ${tenantId} 
          AND is_active != false
        ORDER BY name ASC
      `;
    }

    return Response.json(clients);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

export async function POST(request) {
  // No auth required - passengers can create their own client record via booking wizard

  try {
    const {
      name,
      email,
      phone,
      notes,
      notification_preference,
      address,
      street_address,
      city,
      state,
      zip_code,
      cc_emails,
      referral_source,
    } = await request.json();

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    // Validate and normalize phone number to E.164 format
    let normalizedPhone = null;
    if (phone) {
      if (!isValidUSPhone(phone)) {
        return Response.json(
          {
            error:
              "Invalid phone number. Please enter a valid 10-digit US phone number.",
          },
          { status: 400 },
        );
      }
      normalizedPhone = normalizeToE164(phone);
    }

    // Check for duplicates: same name (case-insensitive) AND matching phone or email
    // Build parameterized query to avoid SQL injection
    let duplicateQuery = `
      SELECT id, name FROM clients
      WHERE tenant_id = 1
        AND LOWER(name) = LOWER($1)
    `;
    const queryParams = [name];

    if (normalizedPhone || email) {
      const contactConditions = [];
      if (normalizedPhone) {
        queryParams.push(normalizedPhone);
        // Normalize phone digits so (615) 555-1234 matches 6155551234
        contactConditions.push(
          `REGEXP_REPLACE(phone, '[^0-9]', '', 'g') = REGEXP_REPLACE($${queryParams.length}, '[^0-9]', '', 'g')`,
        );
      }
      if (email) {
        queryParams.push(email);
        contactConditions.push(`LOWER(email) = LOWER($${queryParams.length})`);
      }
      duplicateQuery += ` AND (${contactConditions.join(" OR ")})`;
    }

    duplicateQuery += ` LIMIT 1`;

    const duplicates = await sql(duplicateQuery, queryParams);

    if (duplicates.length > 0) {
      return Response.json(
        {
          error: `A passenger named "${duplicates[0].name}" already exists with the same contact info. Change the name to save as a separate passenger.`,
          existing_id: duplicates[0].id,
        },
        { status: 409 },
      );
    }

    const result = await sql`
      INSERT INTO clients (
        tenant_id, name, email, phone, notes, notification_preference, 
        address, street_address, city, state, zip_code, cc_emails,
        is_new_passenger, new_passenger_marked_at, referral_source
      )
      VALUES (
        1, ${name}, ${email || null}, ${normalizedPhone}, ${notes || null}, ${notification_preference || "both"}, 
        ${address || null}, ${street_address || null}, ${city || null}, ${state || null}, ${zip_code || null}, ${cc_emails || null},
        true, CURRENT_TIMESTAMP, ${referral_source || null}
      )
      RETURNING *
    `;
    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create client" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const updated = await sql`
      UPDATE clients
      SET name = TRIM(REGEXP_REPLACE(name, '\\s*\\([^)]*\\)', '', 'g'))
      WHERE name ~ '\\('
      RETURNING id, name
    `;
    return Response.json({
      success: true,
      updated_count: updated.length,
      updated_names: updated,
      message:
        updated.length > 0
          ? `Cleaned ${updated.length} passenger name(s)`
          : "No names with parentheses found",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to clean client names" },
      { status: 500 },
    );
  }
}
