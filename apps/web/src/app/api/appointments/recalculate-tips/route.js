import sql from "@/app/api/utils/sql";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";

/**
 * POST /api/appointments/recalculate-tips
 *
 * Finds all paid trips that have a tip transaction (category='tip' or
 * tip_amount > 0 on a payment row) but have tips_total = 0 or NULL, and
 * runs recalculatePaymentsAndBalance on each one to fix the cached value.
 *
 * Also optionally processes ALL paid Square trips to ensure tips from
 * Square invoices are correctly reflected.
 */
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {}

  const mode = body.mode || "missing"; // "missing" | "all" | "webhook" | "single"
  const singleAppointmentId = body.appointment_id
    ? parseInt(body.appointment_id)
    : null;

  try {
    let appointmentIds = [];
    let webhookRows = [];

    if (mode === "single" && singleAppointmentId) {
      // Fix just one specific appointment's tips_total (payments only, no services recalc)
      try {
        await recalculatePaymentsAndBalance(singleAppointmentId);
        return Response.json({
          success: true,
          total: 1,
          fixed: 1,
          message: `Recalculated tips for appointment #${singleAppointmentId}.`,
        });
      } catch (err) {
        return Response.json(
          { success: false, error: err.message },
          { status: 500 },
        );
      }
    } else if (mode === "webhook") {
      // Find trips where Square webhook logs recorded a tip > 0
      // but no tip transaction was ever created for that trip.
      webhookRows = await sql`
        SELECT DISTINCT ON (swl.appointment_id)
          swl.appointment_id,
          swl.tip_amount,
          swl.square_payment_id
        FROM square_webhook_logs swl
        WHERE swl.tip_amount > 0
          AND swl.processing_status = 'success'
          AND swl.appointment_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.appointment_id = swl.appointment_id
              AND t.category = 'tip'
              AND t.tip_amount > 0
          )
        ORDER BY swl.appointment_id DESC, swl.received_at DESC
        LIMIT 500
      `;
    } else if (mode === "all") {
      // Recalculate every paid trip that used Square (could have tips)
      const rows = await sql`
        SELECT DISTINCT a.id
        FROM appointments a
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND a.payment_status = 'paid'
          AND (
            a.payment_method ILIKE '%square%'
            OR EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.appointment_id = a.id
                AND t.method = 'Square'
            )
          )
        ORDER BY a.id DESC
        LIMIT 2000
      `;
      appointmentIds = rows.map((r) => r.id);
    } else {
      // Only trips with tip transactions but tips_total not set
      const rows = await sql`
        SELECT DISTINCT a.id
        FROM appointments a
        JOIN transactions t ON t.appointment_id = a.id
        WHERE a.tenant_id = 1
          AND a.status != 'deleted'
          AND (a.tips_total IS NULL OR a.tips_total = 0)
          AND (
            (t.category = 'tip' AND t.tip_amount > 0)
            OR (t.category = 'payment' AND t.tip_amount > 0)
          )
        ORDER BY a.id DESC
        LIMIT 2000
      `;
      appointmentIds = rows.map((r) => r.id);
    }

    const totalCount =
      mode === "webhook" ? webhookRows.length : appointmentIds.length;

    if (totalCount === 0) {
      return Response.json({
        success: true,
        total: 0,
        fixed: 0,
        message: "No trips needed recalculation.",
      });
    }

    let fixed = 0;
    let errors = 0;
    const errorList = [];

    if (mode === "webhook") {
      for (const row of webhookRows) {
        try {
          await sql`
            INSERT INTO transactions
              (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
            VALUES
              (${row.appointment_id}, 'tip', 'Square', 0, ${row.tip_amount},
               ${`Square tip restored from webhook log (${row.square_payment_id || "unknown"})`},
               CURRENT_DATE, 1)
          `;
          await recalculatePaymentsAndBalance(row.appointment_id);
          fixed++;
        } catch (err) {
          errors++;
          errorList.push({ id: row.appointment_id, error: err.message });
          console.error(
            `[RecalcTips] Webhook restore error on trip #${row.appointment_id}:`,
            err.message,
          );
        }
      }
    } else {
      for (const id of appointmentIds) {
        try {
          await recalculatePaymentsAndBalance(id);
          fixed++;
        } catch (err) {
          errors++;
          errorList.push({ id, error: err.message });
          console.error(`[RecalcTips] Error on trip #${id}:`, err.message);
        }
      }
    }

    return Response.json({
      success: true,
      total: totalCount,
      fixed,
      errors,
      errorList: errorList.slice(0, 10),
      message: `Processed ${fixed} trip(s). ${errors > 0 ? `${errors} error(s).` : ""}`,
    });
  } catch (err) {
    console.error("[RecalcTips] Fatal error:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
