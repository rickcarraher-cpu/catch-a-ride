import sql from "@/app/api/utils/sql";
import { createHmac } from "crypto";
import { sendNotification } from "@/app/api/utils/notifications";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";
import {
  recalculatePaymentsAndBalance,
  recalculateDriverCommission,
} from "@/app/api/utils/cached-calculations";

// ─── Signature verification ───────────────────────────────────────────────────
function verifySquareSignature(body, signature, signatureKey, webhookUrl) {
  const hmac = createHmac("sha256", signatureKey);
  hmac.update((webhookUrl || "") + body);
  return hmac.digest("base64") === signature;
}

// ─── Square API helper ────────────────────────────────────────────────────────
function squareApiBase() {
  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

async function squareFetch(path) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${squareApiBase()}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": "2026-05-20",
    },
  });
  if (!res.ok) {
    console.warn(`[Square Webhook] squareFetch ${path} → ${res.status}`);
    return null;
  }
  return res.json();
}

// ─── CC fee calculation ───────────────────────────────────────────────────────
async function getCustomerCcFee(appointmentId, paymentMeta) {
  // Prefer the value stored when the invoice was created
  if (paymentMeta?.credit_card_fee != null) {
    return Number(paymentMeta.credit_card_fee);
  }
  // Fallback: calculate from services + settings
  try {
    const services = await sql`
      SELECT service_price, quantity FROM appointment_services WHERE appointment_id = ${appointmentId}
    `;
    const subtotal = services.reduce(
      (s, r) => s + Number(r.service_price) * Number(r.quantity || 1),
      0,
    );
    if (subtotal <= 0) return 0;
    const [feeSetting] = await sql`
      SELECT value FROM settings WHERE tenant_id = 1 AND key = 'credit_card_fee_percent' LIMIT 1
    `;
    const feePercent = feeSetting?.value ? Number(feeSetting.value) : 4;
    return Math.round((subtotal * feePercent) / 100);
  } catch (e) {
    console.error(`[Square Webhook] CC fee calc error:`, e.message);
    return 0;
  }
}

// ─── Commission helper ────────────────────────────────────────────────────────
async function ensureCommission(appointmentId) {
  try {
    const existing = await sql`
      SELECT id FROM transactions
      WHERE appointment_id = ${appointmentId} AND category = 'expense' AND method = 'Commission'
      LIMIT 1
    `;
    if (existing.length > 0) return;

    const [appt] = await sql`
      SELECT a.employee_id, a.booking_number, a.services_total, a.trip_commission_rate,
             e.name AS employee_name, e.salary_rate
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ${appointmentId}
    `;
    if (!appt?.employee_id) return;

    // Use trip-level override if set, otherwise driver's default salary_rate
    const effectiveRate =
      appt.trip_commission_rate !== null &&
      appt.trip_commission_rate !== undefined
        ? Number(appt.trip_commission_rate)
        : Number(appt.salary_rate || 0);

    if (!effectiveRate) return;

    const base = Number(appt.services_total || 0);
    if (base <= 0) return;

    const commission = (base * effectiveRate).toFixed(2);
    const ref = appt.booking_number || `#${appointmentId}`;
    const rateLabel =
      appt.trip_commission_rate !== null &&
      appt.trip_commission_rate !== undefined
        ? `${Math.round(effectiveRate * 100)}% override`
        : `${Math.round(effectiveRate * 100)}%`;
    await sql`
      INSERT INTO transactions
        (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
      VALUES
        (1, ${appointmentId}, 'expense', 'Commission', ${commission}, 0,
         ${`Commission for ${appt.employee_name} (${rateLabel}) — Trip ${ref}`},
         CURRENT_DATE, ${appt.employee_id})
    `;
    console.log(
      `[Square Webhook] ✓ Commission created: $${commission} for ${appt.employee_name} at ${Math.round(effectiveRate * 100)}%`,
    );
  } catch (e) {
    console.error(`[Square Webhook] Commission error:`, e.message);
  }
}

// ─── Guard: only insert if no row with that category exists ──────────────────
async function insertIfMissing(appointmentId, category, values) {
  const existing = await sql`
    SELECT id FROM transactions WHERE appointment_id = ${appointmentId} AND category = ${category} LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(
      `[Square Webhook] ${category} tx already exists for trip #${appointmentId} — skipping`,
    );
    return false;
  }
  await sql(
    `INSERT INTO transactions
       (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
     VALUES ($1, $2, 'Square', $3, $4, $5, CURRENT_DATE, 1)`,
    [appointmentId, category, ...values],
  );
  return true;
}

// ─── Core: apply a completed payment to an appointment ──────────────────────
/**
 * Rules confirmed by business:
 *   payments_total  = SUM(payment + cc_fee transactions)   — reduces balance
 *   tips_total      = SUM(tip transactions)                — does NOT reduce balance
 *   balance_due     = original_amount − payments_total     = $0 when fully paid
 *   driver_commission = services_total × salary_rate
 */
async function applyPayment(
  appointmentId,
  {
    paymentRowId,
    paidAmount,
    tipAmount,
    ccFee,
    squarePaymentId,
    invoiceId,
    description,
  },
) {
  // ── Payment split ──────────────────────────────────────────────────────
  // paidAmount (from Square total_money) = services + ccFee + tip
  // We record two transaction rows that BOTH count toward payments_total:
  //   1. 'payment'  → services portion  (paidAmount − tipAmount − ccFee)
  //   2. 'cc_fee'   → CC surcharge      (ccFee)
  // payments_total = payment + cc_fee = paidAmount − tipAmount
  // balance_due    = original_amount − payments_total → should be $0
  //
  // IMPORTANT: baseTripPayment is ONLY for the 'payment' transaction row.
  // It must NOT include the ccFee — that goes to the separate cc_fee row.
  const baseTripPayment = paidAmount - tipAmount - ccFee;

  // Guard: if Square's total_money didn't include the CC surcharge (invoice
  // payments sometimes report only the order line-item total), the subtraction
  // above would produce a value that is too low by exactly ccFee.  Detect this
  // by comparing against the trip's services_total; if baseTripPayment is lower
  // than services_total by ~ccFee, Square already excluded the surcharge and we
  // should NOT subtract it again.
  let adjustedBaseTripPayment = baseTripPayment;
  let adjustedCcFeeForPaymentTx = ccFee;

  if (ccFee > 0) {
    try {
      const [svcRow] = await sql`
        SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as svc_total
        FROM appointment_services WHERE appointment_id = ${appointmentId}
      `;
      const servicesTotal = Number(svcRow?.svc_total || 0);

      if (servicesTotal > 0) {
        const withoutCcFeeDeduction = paidAmount - tipAmount;
        // If paidAmount - tipAmount already equals services_total (no CC fee in Square total),
        // don't subtract ccFee from the payment row — it was never in total_money.
        if (Math.abs(withoutCcFeeDeduction - servicesTotal) < 1) {
          console.log(
            `[Square Webhook] CC fee ($${ccFee}) not included in Square total_money — recording payment=$${servicesTotal}, cc_fee=$${ccFee}`,
          );
          adjustedBaseTripPayment = servicesTotal;
          adjustedCcFeeForPaymentTx = ccFee;
        } else {
          console.log(
            `[Square Webhook] CC fee ($${ccFee}) included in Square total_money — recording payment=$${baseTripPayment}, cc_fee=$${ccFee}`,
          );
        }
      }
    } catch (e) {
      console.error(`[Square Webhook] Services total lookup error:`, e.message);
    }
  }

  console.log(
    `[Square Webhook] Applying payment to trip #${appointmentId}: ` +
      `total=$${paidAmount}, tip=$${tipAmount}, ccFee=$${ccFee}, base=$${adjustedBaseTripPayment}`,
  );

  // 1. Mark payment record as paid
  if (paymentRowId) {
    await sql`
      UPDATE payments
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{square_payment_id}',
                               ${JSON.stringify(squarePaymentId || "")}::jsonb)
      WHERE id = ${paymentRowId}
    `;
  }

  // 2. Update appointment
  await sql`
    UPDATE appointments
    SET payment_status = 'paid',
        payment_date = CURRENT_TIMESTAMP,
        payment_amount = ${adjustedBaseTripPayment},
        square_payment_id = COALESCE(${squarePaymentId}, square_payment_id)
    WHERE id = ${appointmentId} AND tenant_id = 1
  `;

  // 3. Transactions (each guarded against duplicates)
  await insertIfMissing(appointmentId, "payment", [
    adjustedBaseTripPayment,
    0,
    `${description} - Trip amount`,
  ]);
  if (adjustedCcFeeForPaymentTx > 0)
    await insertIfMissing(appointmentId, "cc_fee", [
      adjustedCcFeeForPaymentTx,
      0,
      `${description} - CC fee`,
    ]);
  if (tipAmount > 0)
    await insertIfMissing(appointmentId, "tip", [
      0,
      tipAmount,
      `${description} - Tip`,
    ]);

  // 4. Commission
  await ensureCommission(appointmentId);

  // 5. Recalculate cached fields → balance_due = original_amount − payments_total = $0
  await recalculatePaymentsAndBalance(appointmentId);
  await recalculateDriverCommission(appointmentId);

  // 6. Auto-complete if eligible
  try {
    await autoCompleteIfEligible(appointmentId);
  } catch (_) {}

  // 7. Notify passenger
  try {
    await sendNotification({
      type: "payment_confirmed",
      appointmentId,
      tenantId: 1,
    });
  } catch (e) {
    console.error(`[Square Webhook] Notification error:`, e.message);
  }

  console.log(
    `[Square Webhook] ✓ Trip #${appointmentId} marked paid. base=$${adjustedBaseTripPayment}, ccFee=$${adjustedCcFeeForPaymentTx}, tip=$${tipAmount}`,
  );
}

// ─── Match a payment row by order_id (tries multiple strategies) ─────────────
async function findPaymentByOrderId(orderId) {
  // Strategy 1: metadata->>'order_id', non-paid statuses
  let rows = await sql`
    SELECT id, appointment_id, amount, metadata, status
    FROM payments
    WHERE provider = 'square' AND status IN ('pending', 'link_created') AND metadata->>'order_id' = ${orderId}
    LIMIT 1
  `;
  if (rows.length > 0) return { row: rows[0], via: "order_id_pending" };

  // Strategy 2: any status
  rows = await sql`
    SELECT id, appointment_id, amount, metadata, status
    FROM payments
    WHERE provider = 'square' AND metadata->>'order_id' = ${orderId}
    LIMIT 1
  `;
  if (rows.length > 0) return { row: rows[0], via: "order_id_any" };

  // Strategy 3: fetch order from Square API → reference_id = "trip-{id}"
  const orderData = await squareFetch(`/v2/orders/${orderId}`);
  const refId = orderData?.order?.reference_id;
  if (refId?.startsWith("trip-")) {
    const appointmentId = Number(refId.replace("trip-", ""));
    if (appointmentId > 0) {
      rows = await sql`
        SELECT id, appointment_id, amount, metadata, status
        FROM payments
        WHERE provider = 'square' AND appointment_id = ${appointmentId} AND status != 'paid'
        ORDER BY created_at DESC LIMIT 1
      `;
      if (rows.length > 0) {
        // Patch the metadata so future lookups find it instantly
        await sql`
          UPDATE payments
          SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{order_id}', ${JSON.stringify(orderId)}::jsonb)
          WHERE id = ${rows[0].id}
        `;
        return { row: rows[0], via: "order_reference_id" };
      }
    }
  }

  return null;
}

// ─── Fetch actual Square payment details (tip, processing fee, amount) ───────
async function fetchSquarePaymentDetails(orderId) {
  const orderData = await squareFetch(`/v2/orders/${orderId}`);
  const paymentId = orderData?.order?.tenders?.[0]?.payment_id;
  if (!paymentId) return { paymentId: null, paidAmount: 0, tipAmount: 0 };

  const payData = await squareFetch(`/v2/payments/${paymentId}`);
  const sqPay = payData?.payment;
  if (!sqPay) return { paymentId, paidAmount: 0, tipAmount: 0 };

  return {
    paymentId,
    paidAmount: sqPay.total_money ? Number(sqPay.total_money.amount) / 100 : 0,
    tipAmount: sqPay.tip_money ? Number(sqPay.tip_money.amount) / 100 : 0,
  };
}

// ─── Main webhook event processor ────────────────────────────────────────────
async function processWebhookEvent(eventId, eventType, eventData) {
  const wlog = {
    processing_status: "success",
    appointment_id: null,
    booking_number: null,
    matched_via: null,
    match_attempt_count: 0,
    square_payment_id: null,
    square_order_id: null,
    payment_amount: null,
    tip_amount: null,
    cc_fee_amount: null,
    trip_updated: false,
    payment_record_updated: false,
    transactions_created: false,
    error_message: null,
    error_stage: null,
  };

  const startedAt = Date.now();

  try {
    // Atomic idempotency: try to claim this event. If another concurrent
    // request already inserted this event_id, the ON CONFLICT returns no rows
    // and we bail out immediately — preventing duplicate transaction creation.
    const claimed = await sql`
      INSERT INTO payment_events (provider, event_id, event_type, payload, received_at)
      VALUES ('square', ${eventId}, ${eventType}, ${JSON.stringify(eventData)}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    `;
    if (claimed.length === 0) {
      console.log(
        `[Square Webhook] Event ${eventId} already claimed by another process — skipping`,
      );
      wlog.processing_status = "duplicate";
      return;
    }

    // ══════════════════════════════════════════════════════════════════
    // payment.created / payment.updated
    // ══════════════════════════════════════════════════════════════════
    if (eventType === "payment.created" || eventType === "payment.updated") {
      const payment = eventData?.object?.payment;
      if (!payment) {
        wlog.processing_status = "skipped";
        wlog.error_message = "No payment object";
        return;
      }

      const { id: squarePaymentId, order_id: orderId, status } = payment;
      const paidAmount = payment.total_money
        ? Number(payment.total_money.amount) / 100
        : 0;
      const tipAmount = payment.tip_money
        ? Number(payment.tip_money.amount) / 100
        : 0;

      wlog.square_payment_id = squarePaymentId;
      wlog.square_order_id = orderId;

      if (!orderId) {
        wlog.processing_status = "skipped";
        wlog.error_message = "No order_id";
        return;
      }
      if (status !== "COMPLETED") {
        wlog.processing_status = "skipped";
        wlog.error_message = `Status=${status}`;
        return;
      }

      const match = orderId ? await findPaymentByOrderId(orderId) : null;
      if (!match) {
        wlog.processing_status = "skipped";
        wlog.error_message = `No payment row found for order ${orderId}`;
        console.warn(
          `[Square Webhook] No match for order ${orderId} — may be handled by invoice.payment_made`,
        );
        return;
      }

      const { row, via } = match;
      wlog.matched_via = via;
      wlog.appointment_id = row.appointment_id;

      // Already paid? Just recalculate and exit
      if (row.status === "paid") {
        console.log(
          `[Square Webhook] Payment #${row.id} already paid — recalculating only`,
        );
        await recalculatePaymentsAndBalance(row.appointment_id);
        wlog.processing_status = "duplicate";
        return;
      }

      const meta =
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata || {};
      const ccFee = await getCustomerCcFee(row.appointment_id, meta);

      await applyPayment(row.appointment_id, {
        paymentRowId: row.id,
        paidAmount,
        tipAmount,
        ccFee,
        squarePaymentId,
        description: `Square payment ${squarePaymentId}`,
      });

      wlog.payment_amount = paidAmount;
      wlog.tip_amount = tipAmount;
      wlog.cc_fee_amount = ccFee;
      wlog.trip_updated = true;
      wlog.payment_record_updated = true;
      wlog.transactions_created = true;

      const [a] =
        await sql`SELECT booking_number FROM appointments WHERE id = ${row.appointment_id}`;
      wlog.booking_number = a?.booking_number || null;
    }

    // ══════════════════════════════════════════════════════════════════
    // invoice.payment_made
    // ══════════════════════════════════════════════════════════════════
    else if (eventType === "invoice.payment_made") {
      const invoice = eventData?.object?.invoice;
      if (!invoice) {
        wlog.processing_status = "skipped";
        wlog.error_message = "No invoice object";
        return;
      }

      const invoiceId = invoice.id;
      const invoiceOrderId = invoice.order_id;
      wlog.square_order_id = invoiceOrderId;

      // Find the payment row — try invoice_id, then order_id match
      let paymentRow = null;
      let via = null;

      // 1. external_reference_id = invoiceId
      let rows = await sql`
        SELECT id, appointment_id, amount, metadata, status
        FROM payments WHERE provider = 'square' AND external_reference_id = ${invoiceId} LIMIT 1
      `;
      if (rows.length > 0) {
        paymentRow = rows[0];
        via = "external_reference_id";
      }

      // 2. metadata->>'invoice_id'
      if (!paymentRow) {
        rows = await sql`
          SELECT id, appointment_id, amount, metadata, status
          FROM payments WHERE provider = 'square' AND metadata->>'invoice_id' = ${invoiceId} LIMIT 1
        `;
        if (rows.length > 0) {
          paymentRow = rows[0];
          via = "meta_invoice_id";
        }
      }

      // 3. metadata->>'order_id'
      if (!paymentRow && invoiceOrderId) {
        rows = await sql`
          SELECT id, appointment_id, amount, metadata, status
          FROM payments WHERE provider = 'square' AND metadata->>'order_id' = ${invoiceOrderId} LIMIT 1
        `;
        if (rows.length > 0) {
          paymentRow = rows[0];
          via = "meta_order_id";
        }
      }

      // 4. Order reference_id from Square API
      if (!paymentRow && invoiceOrderId) {
        const orderData = await squareFetch(`/v2/orders/${invoiceOrderId}`);
        const refId = orderData?.order?.reference_id;
        if (refId?.startsWith("trip-")) {
          const appointmentId = Number(refId.replace("trip-", ""));
          if (appointmentId > 0) {
            rows = await sql`
              SELECT id, appointment_id, amount, metadata, status
              FROM payments WHERE provider = 'square' AND appointment_id = ${appointmentId}
              ORDER BY created_at DESC LIMIT 1
            `;
            if (rows.length > 0) {
              paymentRow = rows[0];
              via = "order_reference_id";
            }
          }
        }
      }

      if (!paymentRow) {
        wlog.processing_status = "skipped";
        wlog.error_message = `No payment row for invoice ${invoiceId}`;
        console.warn(`[Square Webhook] No match for invoice ${invoiceId}`);
        return;
      }

      wlog.matched_via = via;
      wlog.appointment_id = paymentRow.appointment_id;

      // Already paid → just recalculate
      if (paymentRow.status === "paid") {
        console.log(
          `[Square Webhook] Invoice payment already processed — recalculating`,
        );
        await recalculatePaymentsAndBalance(paymentRow.appointment_id);
        wlog.processing_status = "duplicate";
        return;
      }

      // Fetch actual tip + amount from Square API
      const meta =
        typeof paymentRow.metadata === "string"
          ? JSON.parse(paymentRow.metadata)
          : paymentRow.metadata || {};
      let {
        paymentId: squarePaymentId,
        paidAmount,
        tipAmount,
      } = invoiceOrderId
        ? await fetchSquarePaymentDetails(invoiceOrderId)
        : {
            paymentId: null,
            paidAmount: Number(paymentRow.amount),
            tipAmount: 0,
          };

      if (paidAmount <= 0) paidAmount = Number(paymentRow.amount);
      const ccFee = await getCustomerCcFee(paymentRow.appointment_id, meta);

      await applyPayment(paymentRow.appointment_id, {
        paymentRowId: paymentRow.id,
        paidAmount,
        tipAmount,
        ccFee,
        squarePaymentId,
        invoiceId,
        description: `Square invoice ${invoiceId}`,
      });

      wlog.square_payment_id = squarePaymentId;
      wlog.payment_amount = paidAmount;
      wlog.tip_amount = tipAmount;
      wlog.cc_fee_amount = ccFee;
      wlog.trip_updated = true;
      wlog.payment_record_updated = true;
      wlog.transactions_created = true;

      const [a] =
        await sql`SELECT booking_number FROM appointments WHERE id = ${paymentRow.appointment_id}`;
      wlog.booking_number = a?.booking_number || null;
    }

    // ══════════════════════════════════════════════════════════════════
    // refund.created / refund.updated
    // ══════════════════════════════════════════════════════════════════
    else if (eventType === "refund.created" || eventType === "refund.updated") {
      const refund = eventData?.object?.refund;
      if (!refund || refund.status !== "COMPLETED") {
        wlog.processing_status = "skipped";
        wlog.error_message = "Refund not completed or missing";
        return;
      }

      const rows = await sql`
        SELECT id, appointment_id FROM payments
        WHERE provider = 'square' AND metadata->>'square_payment_id' = ${refund.payment_id}
        LIMIT 1
      `;
      if (rows.length > 0) {
        await sql`UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ${rows[0].id}`;
        await sql`UPDATE appointments SET payment_status = 'refunded' WHERE id = ${rows[0].appointment_id} AND tenant_id = 1`;
        wlog.appointment_id = rows[0].appointment_id;
        wlog.trip_updated = true;
        console.log(
          `[Square Webhook] ✓ Refund applied to trip #${rows[0].appointment_id}`,
        );
      } else {
        wlog.processing_status = "skipped";
        wlog.error_message = `No payment matched for refund payment_id=${refund.payment_id}`;
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // Unhandled event
    // ══════════════════════════════════════════════════════════════════
    else {
      wlog.processing_status = "skipped";
      wlog.error_message = `Unhandled event type: ${eventType}`;
      console.log(`[Square Webhook] Unhandled: ${eventType}`);
    }
  } catch (err) {
    wlog.processing_status = "failed";
    wlog.error_message = err.message;
    wlog.error_stage = "processWebhookEvent";
    console.error(`[Square Webhook] Error processing ${eventId}:`, err);
  } finally {
    // Write audit log
    const durationMs = Date.now() - startedAt;
    try {
      await sql`
        INSERT INTO square_webhook_logs (
          event_id, event_type, received_at, processing_status,
          processing_started_at, processing_completed_at, processing_duration_ms,
          appointment_id, booking_number, matched_via, match_attempt_count,
          square_payment_id, square_order_id, payment_amount, tip_amount, cc_fee_amount,
          trip_updated, payment_record_updated, transactions_created,
          error_message, error_stage, tenant_id
        ) VALUES (
          ${eventId}, ${eventType}, CURRENT_TIMESTAMP, ${wlog.processing_status},
          ${new Date(startedAt).toISOString()}, CURRENT_TIMESTAMP, ${durationMs},
          ${wlog.appointment_id}, ${wlog.booking_number}, ${wlog.matched_via}, ${wlog.match_attempt_count},
          ${wlog.square_payment_id}, ${wlog.square_order_id}, ${wlog.payment_amount},
          ${wlog.tip_amount}, ${wlog.cc_fee_amount},
          ${wlog.trip_updated}, ${wlog.payment_record_updated}, ${wlog.transactions_created},
          ${wlog.error_message}, ${wlog.error_stage}, 1
        )
      `;
    } catch (logErr) {
      console.error(
        `[Square Webhook] Failed to write webhook log:`,
        logErr.message,
      );
    }
  }
}

// ─── HTTP handlers ────────────────────────────────────────────────────────────
export async function GET() {
  return Response.json({
    status: "ok",
    message: "Square webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-square-hmacsha256-signature");

    let event;
    try {
      event = JSON.parse(body);
    } catch {
      console.error(`[Square Webhook] Invalid JSON body`);
      return Response.json({ received: true, error: "Invalid JSON" });
    }

    const eventId = event.event_id || event.id || `square-${Date.now()}`;
    const eventType = event.type;

    console.log(`[Square Webhook] Received ${eventId}: ${eventType}`);

    // Fast idempotency pre-check — the real atomic guard is inside processWebhookEvent
    const existing =
      await sql`SELECT id FROM payment_events WHERE event_id = ${eventId} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`[Square Webhook] Duplicate event ${eventId}, ignoring`);
      return Response.json({ received: true, duplicate: true });
    }

    // Signature verification (log-only, never blocks processing)
    try {
      const settings = await sql`
        SELECT key, value FROM settings WHERE tenant_id = 1 AND key IN ('square_webhook_signature', 'square_webhook_url')
      `;
      const sigKey = settings.find(
        (r) => r.key === "square_webhook_signature",
      )?.value;
      const webhookUrl = settings.find(
        (r) => r.key === "square_webhook_url",
      )?.value;

      if (sigKey && signature) {
        const verifyUrl = webhookUrl || request.url;
        const valid =
          verifySquareSignature(body, signature, sigKey, verifyUrl) ||
          verifySquareSignature(body, signature, sigKey, request.url);
        if (!valid) {
          console.warn(
            `[Square Webhook] ⚠️ Signature mismatch for ${eventId} — processing anyway`,
          );
        }
      }
    } catch (sigErr) {
      console.error(`[Square Webhook] Signature check error:`, sigErr.message);
    }

    // Process synchronously (serverless — no fire-and-forget)
    await processWebhookEvent(eventId, eventType, event.data);

    return Response.json({ received: true });
  } catch (err) {
    console.error(`[Square Webhook] Handler error:`, err);
    // Always 200 to prevent Square from disabling the webhook
    return Response.json({ received: true, error: "Processing error logged" });
  }
}
