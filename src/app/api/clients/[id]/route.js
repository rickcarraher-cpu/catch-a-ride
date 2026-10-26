import sql from "@/app/api/utils/sql";
import { buildAddress, parseAddress } from "@/app/api/utils/address-parser";
import { normalizeToE164, isValidUSPhone } from "@/utils/phoneNormalizer";

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const client =
      await sql`SELECT * FROM clients WHERE id = ${id} AND tenant_id = 1`;
    if (client.length === 0)
      return Response.json({ error: "Not found" }, { status: 404 });

    const trips = await sql`
      SELECT a.*, e.name as driver_name 
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.client_id = ${id} AND a.tenant_id = 1
      ORDER BY a.start_time DESC
    `;

    return Response.json({ ...client[0], trips });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();

    // Validate and normalize phone number if being updated
    if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
      if (!isValidUSPhone(body.phone)) {
        return Response.json(
          {
            error:
              "Invalid phone number. Please enter a valid 10-digit US phone number.",
          },
          { status: 400 },
        );
      }
      body.phone = normalizeToE164(body.phone);
    }

    const fields = Object.keys(body).filter((k) =>
      [
        "name",
        "email",
        "phone",
        "notes",
        "notification_preference",
        "address",
        "street_address",
        "city",
        "state",
        "zip_code",
        "cc_emails",
        "is_active",
        "referral_source",
      ].includes(k),
    );

    if (fields.length === 0)
      return Response.json({ error: "No fields to update" }, { status: 400 });

    // If legacy 'address' field is provided, parse it into structured fields
    if (body.address && !body.street_address) {
      const parsed = parseAddress(body.address);
      body.street_address = parsed.street_address;
      body.city = parsed.city;
      body.state = parsed.state;
      body.zip_code = parsed.zip_code;

      // Add structured fields to update list
      if (!fields.includes("street_address")) fields.push("street_address");
      if (!fields.includes("city")) fields.push("city");
      if (!fields.includes("state")) fields.push("state");
      if (!fields.includes("zip_code")) fields.push("zip_code");
    }

    // Also rebuild address field from structured components if they're provided
    if (body.street_address || body.city || body.state || body.zip_code) {
      body.address = buildAddress({
        street_address: body.street_address,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
      });
      if (!fields.includes("address")) fields.push("address");
    }

    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
    // Normalize empty strings to null for contact fields so we don't store ""
    const nullableFields = [
      "email",
      "phone",
      "notes",
      "address",
      "street_address",
      "city",
      "state",
      "zip_code",
    ];
    const values = fields.map((f) => {
      const v = body[f];
      if (nullableFields.includes(f) && (v === "" || v === undefined))
        return null;
      return v;
    });

    const result = await sql(
      `UPDATE clients SET ${setClause} WHERE id = $${fields.length + 1} AND tenant_id = 1 RETURNING *`,
      [...values, id],
    );

    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    // Check if passenger has any trips
    const trips = await sql`
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE client_id = ${id} AND tenant_id = 1
    `;

    const tripCount = parseInt(trips[0].count);

    if (tripCount > 0) {
      // Has trips - cannot delete, return error
      return Response.json(
        {
          error: "Cannot delete passenger with existing trips",
          tripCount,
        },
        { status: 400 },
      );
    }

    // No trips - safe to delete
    await sql`DELETE FROM clients WHERE id = ${id} AND tenant_id = 1`;

    return Response.json({
      success: true,
      message: "Passenger deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to delete passenger" },
      { status: 500 },
    );
  }
}
