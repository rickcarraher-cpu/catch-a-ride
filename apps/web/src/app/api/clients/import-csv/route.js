import sql from "@/app/api/utils/sql";

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[\s\-()]/g, "");
}

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: "No rows provided" }, { status: 400 });
    }

    const results = [];
    let newCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const errors = [];

    // Get all existing clients for matching
    const existingClients = await sql`
      SELECT id, name, phone, email, notes, notification_preference, 
             street_address, city, state, zip_code
      FROM clients 
      WHERE tenant_id = 1
    `;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is headers and arrays are 0-indexed

      try {
        // Validate required fields
        if (!row.name || row.name.trim() === "") {
          errors.push(`Row ${rowNum}: Missing required field 'name'`);
          errorCount++;
          continue;
        }

        const name = row.name.trim();
        const phone = row.phone ? row.phone.trim() : "";
        const email = row.email ? row.email.trim() : null;
        const notes = row.notes ? row.notes.trim() : null;

        // Auto-determine notification preference based on contact info
        let notification_preference;
        if (row.notification_preference) {
          // Use provided value if explicitly set
          notification_preference = row.notification_preference;
        } else {
          // Auto-determine based on what contact info is available
          if (email && phone) {
            notification_preference = "both";
          } else if (phone) {
            notification_preference = "text";
          } else if (email) {
            notification_preference = "email";
          } else {
            notification_preference = "both"; // default fallback
          }
        }

        const street_address = row.street_address
          ? row.street_address.trim()
          : null;
        const city = row.city ? row.city.trim() : null;
        const state = row.state ? row.state.trim() : null;
        const zip_code = row.zip_code ? row.zip_code.trim() : null;

        // Normalize phone for matching
        const normalizedImportPhone = normalizePhone(phone);

        // Try to find existing client by name or phone
        let existingClient = null;

        for (const client of existingClients) {
          const normalizedClientPhone = normalizePhone(client.phone);

          // Match by name (case insensitive)
          if (client.name.toLowerCase() === name.toLowerCase()) {
            existingClient = client;
            break;
          }

          // Match by phone (if both have phone and they match)
          if (
            normalizedImportPhone &&
            normalizedClientPhone &&
            normalizedImportPhone === normalizedClientPhone
          ) {
            existingClient = client;
            break;
          }
        }

        let result;
        let action;

        if (existingClient) {
          // UPDATE existing client - only update fields that are not blank in import
          const updates = [];
          const values = [];
          let paramIndex = 1;

          // Always update name if provided
          updates.push(`name = $${paramIndex++}`);
          values.push(name);

          // Update phone if provided and not blank
          if (phone) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
          }

          // Update email if provided and not blank
          if (email) {
            updates.push(`email = $${paramIndex++}`);
            values.push(email);
          }

          // Update notes if provided and not blank
          if (notes) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(notes);
          }

          // Update notification_preference if provided
          if (row.notification_preference) {
            updates.push(`notification_preference = $${paramIndex++}`);
            values.push(notification_preference);
          }

          // Update address fields if provided and not blank
          if (street_address) {
            updates.push(`street_address = $${paramIndex++}`);
            values.push(street_address);
          }

          if (city) {
            updates.push(`city = $${paramIndex++}`);
            values.push(city);
          }

          if (state) {
            updates.push(`state = $${paramIndex++}`);
            values.push(state);
          }

          if (zip_code) {
            updates.push(`zip_code = $${paramIndex++}`);
            values.push(zip_code);
          }

          // Add the WHERE clause parameter
          values.push(existingClient.id);

          const updateQuery = `
            UPDATE clients 
            SET ${updates.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING *
          `;

          const updated = await sql(updateQuery, values);
          result = updated[0];
          action = "update";
          updateCount++;
        } else {
          // INSERT new client
          const inserted = await sql`
            INSERT INTO clients (
              tenant_id, name, email, phone, notes, notification_preference,
              street_address, city, state, zip_code
            )
            VALUES (
              1, ${name}, ${email}, ${phone}, ${notes}, ${notification_preference},
              ${street_address}, ${city}, ${state}, ${zip_code}
            )
            RETURNING *
          `;
          result = inserted[0];
          action = "new";
          newCount++;
        }

        results.push({
          row: rowNum,
          action,
          name: result.name,
          phone: result.phone,
          email: result.email,
          id: result.id,
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err.message}`);
        errorCount++;
      }
    }

    // Fix the message to handle singular/plural correctly
    const totalProcessed = newCount + updateCount;
    const passengerWord = totalProcessed === 1 ? "passenger" : "passengers";

    return Response.json({
      success: true,
      message: `Imported ${totalProcessed} ${passengerWord}: ${newCount} new, ${updateCount} updated`,
      new_count: newCount,
      update_count: updateCount,
      error_count: errorCount,
      total_processed: newCount + updateCount,
      errors: errors.length > 0 ? errors : undefined,
      results,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return Response.json(
      { error: "Failed to import CSV: " + error.message },
      { status: 500 },
    );
  }
}
