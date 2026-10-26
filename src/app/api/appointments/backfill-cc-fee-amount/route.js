import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

/**
 * POST /api/appointments/backfill-cc-fee-amount
 *
 * Looks at every trip whose payment method is a credit-card type
 * (Credit Card | Square | Square Invoice) and sets cc_fee_amount
 * from its services_total × the stored fee %.
 *
 * Trips that already have a non-zero cc_fee_amount are skipped
 * unless mode=all is passed.
 */
export async function POST(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const body = await request.json().catch(() => ({}));
    const mode = body.mode || "missing"; // "missing" | "all"

    // Fetch CC fee % from settings
    const [feeSetting] = await sql`
      SELECT value FROM settings
      WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
      LIMIT 1
    `;
    const feePercent = feeSetting?.value ? Number(feeSetting.value) : 4;

    // Fetch candidate trips
    let trips;
    if (mode === "all") {
      trips = await sql`
        SELECT id, services_total, original_amount, payment_method, cc_fee_amount
        FROM appointments
        WHERE tenant_id = 1
          AND status NOT IN ('deleted')
          AND payment_method IN ('Credit Card', 'Square', 'Square Invoice')
        ORDER BY id ASC
      `;
    } else {
      // Only trips where cc_fee_amount is null or 0
      trips = await sql`
        SELECT id, services_total, original_amount, payment_method, cc_fee_amount
        FROM appointments
        WHERE tenant_id = 1
          AND status NOT IN ('deleted')
          AND payment_method IN ('Credit Card', 'Square', 'Square Invoice')
          AND (cc_fee_amount IS NULL OR cc_fee_amount = 0)
        ORDER BY id ASC
      `;
    }

    let fixed = 0;
    let skipped = 0;
    const errors = [];

    for (const trip of trips) {
      try {
        // Prefer services_total (cached sum of line items, no fee).
        // Fall back to original_amount if services_total is 0 / null.
        let baseAmount = Number(trip.services_total || 0);

        if (baseAmount <= 0) {
          // Recompute directly from appointment_services rows
          const [svcRow] = await sql`
            SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) AS total
            FROM appointment_services
            WHERE appointment_id = ${trip.id}
          `;
          baseAmount = Number(svcRow?.total || 0);
        }

        if (baseAmount <= 0) {
          // Last resort: strip estimated fee from original_amount
          const existingOriginal = Number(trip.original_amount || 0);
          if (existingOriginal > 0) {
            baseAmount = Math.floor(existingOriginal / (1 + feePercent / 100));
          }
        }

        if (baseAmount <= 0) {
          skipped++;
          continue;
        }

        const ccFee = Math.ceil((baseAmount * feePercent) / 100);

        await sql`
          UPDATE appointments
          SET cc_fee_amount = ${ccFee}
          WHERE id = ${trip.id}
        `;
        fixed++;
      } catch (err) {
        console.error(`[BackfillCcFee] Trip #${trip.id} error:`, err.message);
        errors.push({ id: trip.id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      total: trips.length,
      fixed,
      skipped,
      errors: errors.length,
      errorList: errors,
      feePercent,
    });
  } catch (err) {
    console.error("[BackfillCcFee] Fatal error:", err);
    return Response.json(
      { error: err.message || "Failed to backfill cc_fee_amount" },
      { status: 500 },
    );
  }
}
