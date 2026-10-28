import sql from "@/app/api/utils/sql";

/**
 * GET /api/payments/backfill-zelle-metadata
 * Preview how many Zelle payments are missing contact info
 */
export async function GET() {
  try {
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const paySettings = {};
    settingsRows.forEach((r) => {
      paySettings[r.key] = r.value;
    });

    // Get the unified zelle_contact field (can be email or phone)
    const zelleContact = paySettings.zelle_contact;

    // Determine if it's an email or phone based on presence of @
    const isEmail = zelleContact && zelleContact.includes("@");
    const zelleEmail = isEmail ? zelleContact : null;
    const zellePhone = !isEmail && zelleContact ? zelleContact : null;
    const zelleName = paySettings.zelle_display_name || "Business";

    const missingRows = await sql`
      SELECT COUNT(*) AS cnt
      FROM payments
      WHERE provider = 'zelle'
        AND (
          metadata IS NULL
          OR (
            metadata->>'zelle_email' IS NULL
            AND metadata->>'zelle_phone' IS NULL
          )
        )
    `;

    const totalRows = await sql`
      SELECT COUNT(*) AS cnt FROM payments WHERE provider = 'zelle'
    `;

    return Response.json({
      missing: Number(missingRows[0].cnt),
      total: Number(totalRows[0].cnt),
      configured_contact: {
        email: zelleEmail || null,
        phone: zellePhone || null,
        name: zelleName,
      },
    });
  } catch (error) {
    console.error("[BackfillZelle] Preview error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/payments/backfill-zelle-metadata
 * Backfill Zelle contact info into all existing payment records that are missing it
 */
export async function POST() {
  try {
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const paySettings = {};
    settingsRows.forEach((r) => {
      paySettings[r.key] = r.value;
    });

    // Get the unified zelle_contact field (can be email or phone)
    const zelleContact = paySettings.zelle_contact;

    // Determine if it's an email or phone based on presence of @
    const isEmail = zelleContact && zelleContact.includes("@");
    const zelleEmail = isEmail ? zelleContact : null;
    const zellePhone = !isEmail && zelleContact ? zelleContact : null;
    const zelleName = paySettings.zelle_display_name || "Business";

    if (!zelleContact) {
      return Response.json(
        {
          error:
            "No Zelle contact information found. Please configure Zelle email or phone in Settings → Payment Methods first.",
        },
        { status: 400 },
      );
    }

    const zellePayments = await sql`
      SELECT id, metadata
      FROM payments
      WHERE provider = 'zelle'
        AND (
          metadata IS NULL
          OR (
            metadata->>'zelle_email' IS NULL
            AND metadata->>'zelle_phone' IS NULL
          )
        )
    `;

    if (zellePayments.length === 0) {
      return Response.json({
        success: true,
        message: "All Zelle payments already have contact information.",
        updated: 0,
      });
    }

    let updated = 0;
    for (const payment of zellePayments) {
      const existingMetadata = payment.metadata || {};
      const updatedMetadata = {
        ...existingMetadata,
        zelle_email: zelleEmail || null,
        zelle_phone: zellePhone || null,
        zelle_name: zelleName,
        backfilled_at: new Date().toISOString(),
      };

      await sql`
        UPDATE payments
        SET metadata = ${JSON.stringify(updatedMetadata)},
            updated_at = NOW()
        WHERE id = ${payment.id}
      `;
      updated++;
    }

    console.log(`[BackfillZelle] ✅ Updated ${updated} Zelle payment records`);

    return Response.json({
      success: true,
      message: `Updated ${updated} Zelle payment record${updated === 1 ? "" : "s"} with contact information.`,
      updated,
      contact_info: {
        email: zelleEmail || null,
        phone: zellePhone || null,
        name: zelleName,
      },
    });
  } catch (error) {
    console.error("[BackfillZelle] Error:", error);
    return Response.json(
      { error: error.message || "Failed to backfill Zelle metadata" },
      { status: 500 },
    );
  }
}
