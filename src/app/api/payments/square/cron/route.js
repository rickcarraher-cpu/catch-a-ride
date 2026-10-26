import sql from "@/app/api/utils/sql";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";
import { sendNotification } from "@/app/api/utils/notifications";

/**
 * GET/POST /api/payments/square/cron
 *
 * Scheduled cron job that scans all pending Square payments (invoice + link)
 * and auto-applies any that have been paid on Square's side.
 *
 * Runs every 30 minutes via vercel.json crons.
 * Can also be triggered manually via POST.
 *
 * This is the safety net for when Square webhooks don't arrive.
 */

const SQUARE_API_VERSION = "2026-05-20";

function getSquareApiUrl() {
  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

async function applyPayment(appointmentId, pmtRowId, squarePayment, pmtMeta) {
  const paidAmount = (squarePayment.amount_money?.amount || 0) / 100;
  const tipAmount = (squarePayment.tip_money?.amount || 0) / 100;
  const processingFee = squarePayment.processing_fee?.[0]?.amount_money?.amount
    ? Number(squarePayment.processing_fee[0].amount_money.amount) / 100
    : 0;
  const paymentId = squarePayment.id || `cron-${appointmentId}-${Date.now()}`;

  // Get CC fee from metadata or calculate it
  let customerCcFee = 0;
  if (
    pmtMeta?.credit_card_fee !== undefined &&
    pmtMeta?.credit_card_fee !== null
  ) {
    customerCcFee = Number(pmtMeta.credit_card_fee);
  } else {
    try {
      const services = await sql`
        SELECT service_price, quantity FROM appointment_services WHERE appointment_id = ${appointmentId}
      `;
      const subtotal = services.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );
      const feeRows = await sql`
        SELECT value FROM settings WHERE tenant_id = 1 AND key = 'credit_card_fee_percent' LIMIT 1
      `;
      const feePercent =
        feeRows.length > 0 && feeRows[0].value ? Number(feeRows[0].value) : 4;
      if (subtotal > 0) {
        customerCcFee = Math.round((subtotal * feePercent) / 100);
      }
    } catch (e) {
      console.error(
        `[Square Cron] CC fee calc error for trip #${appointmentId}: ${e.message}`,
      );
    }
  }

  const totalTripPayment = paidAmount - tipAmount;
  let baseTripPayment = totalTripPayment - customerCcFee;

  // Guard: if Square's total_money didn't include the CC surcharge (invoice
  // payments sometimes report only the order line-item total), the subtraction
  // above produces a value that is too low.  Detect by comparing against
  // the trip's services_total.
  if (customerCcFee > 0) {
    try {
      const [svcRow] = await sql`
        SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as svc_total
        FROM appointment_services WHERE appointment_id = ${appointmentId}
      `;
      const servicesTotal = Number(svcRow?.svc_total || 0);
      if (servicesTotal > 0 && Math.abs(totalTripPayment - servicesTotal) < 1) {
        console.log(
          `[Square Cron] CC fee ($${customerCcFee}) not in Square total_money — using payment=$${servicesTotal}`,
        );
        baseTripPayment = servicesTotal;
      }
    } catch (e) {
      console.error(`[Square Cron] Services total lookup error:`, e.message);
    }
  }

  console.log(
    `[Square Cron] Applying trip #${appointmentId}: total=$${paidAmount}, base=$${baseTripPayment}, ccFee=$${customerCcFee}, tip=$${tipAmount}`,
  );

  // Update payment record
  if (pmtRowId) {
    await sql`
      UPDATE payments
      SET status = 'paid',
          paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP,
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{square_payment_id}',
            ${JSON.stringify(paymentId)}::jsonb
          )
      WHERE id = ${pmtRowId}
    `;
  }

  // Update appointment
  await sql`
    UPDATE appointments
    SET payment_status = 'paid',
        payment_date = CURRENT_TIMESTAMP,
        payment_amount = ${baseTripPayment},
        square_payment_id = ${paymentId}
    WHERE id = ${appointmentId} AND tenant_id = 1
  `;

  // Check for existing transactions to prevent duplicates
  const existingTx = await sql`
    SELECT id FROM transactions
    WHERE appointment_id = ${appointmentId}
      AND method = 'Square'
      AND category = 'payment'
    LIMIT 1
  `;

  if (existingTx.length === 0) {
    // Base trip payment
    await sql`
      INSERT INTO transactions (
        appointment_id, category, method, amount, tip_amount,
        description, transaction_date, tenant_id
      ) VALUES (
        ${appointmentId}, 'payment', 'Square', ${baseTripPayment}, 0,
        ${`Square payment ${paymentId} - Trip amount (cron auto-detected)`},
        CURRENT_DATE, 1
      )
    `;

    // Driver commission
    try {
      const [appt] = await sql`
        SELECT a.employee_id, a.booking_number, e.name as employee_name, e.salary_rate
        FROM appointments a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ${appointmentId}
      `;
      if (appt?.employee_id && appt?.salary_rate) {
        const existingComm = await sql`
          SELECT id FROM transactions
          WHERE appointment_id = ${appointmentId}
            AND category = 'expense'
            AND method = 'Commission'
          LIMIT 1
        `;
        if (existingComm.length === 0) {
          const [servicesRow] = await sql`
            SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
            FROM appointment_services WHERE appointment_id = ${appointmentId}
          `;
          const servicesTotal = Number(servicesRow?.services_total || 0);
          const commissionBase =
            servicesTotal > 0 ? servicesTotal : baseTripPayment;
          const commissionAmount = (
            commissionBase * Number(appt.salary_rate)
          ).toFixed(2);
          const tripRef = appt.booking_number || `#${appointmentId}`;
          await sql`
            INSERT INTO transactions (
              tenant_id, appointment_id, category, method,
              amount, tip_amount, description, transaction_date, employee_id
            ) VALUES (
              1, ${appointmentId}, 'expense', 'Commission', ${commissionAmount}, 0,
              ${`Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`},
              CURRENT_DATE, ${appt.employee_id}
            )
          `;
          console.log(
            `[Square Cron] ✓ Commission $${commissionAmount} for ${appt.employee_name}`,
          );
        }
      }
    } catch (commErr) {
      console.error(
        `[Square Cron] Commission error trip #${appointmentId}: ${commErr.message}`,
      );
    }

    // CC fee transaction
    if (customerCcFee > 0) {
      await sql`
        INSERT INTO transactions (
          appointment_id, category, method, amount, tip_amount,
          description, transaction_date, tenant_id
        ) VALUES (
          ${appointmentId}, 'cc_fee', 'Square', ${customerCcFee}, 0,
          ${`Square payment ${paymentId} - CC fee (cron auto-detected)`},
          CURRENT_DATE, 1
        )
      `;
    }

    // Tip transaction
    if (tipAmount > 0) {
      await sql`
        INSERT INTO transactions (
          appointment_id, category, method, amount, tip_amount,
          description, transaction_date, tenant_id
        ) VALUES (
          ${appointmentId}, 'tip', 'Square', 0, ${tipAmount},
          ${`Square tip ${paymentId} (cron auto-detected)`},
          CURRENT_DATE, 1
        )
      `;
    }

    // Square processing fee (merchant's cost)
    if (processingFee > 0) {
      await sql`
        INSERT INTO transactions (
          appointment_id, category, method, amount, tip_amount,
          description, transaction_date, tenant_id
        ) VALUES (
          ${appointmentId}, 'expense', 'Square', ${processingFee}, 0,
          ${`Square processing fee ${paymentId} (cron auto-detected)`},
          CURRENT_DATE, 1
        )
      `;
    }
  } else {
    console.log(
      `[Square Cron] Transaction already exists for trip #${appointmentId} — skipping duplicate`,
    );
  }

  // Recalculate cached fields
  try {
    await recalculatePaymentsAndBalance(appointmentId);
  } catch (e) {
    console.error(
      `[Square Cron] Cache recalc error trip #${appointmentId}: ${e.message}`,
    );
  }

  // Auto-complete if trip date has passed
  try {
    await autoCompleteIfEligible(appointmentId);
  } catch (e) {
    console.error(
      `[Square Cron] Auto-complete error trip #${appointmentId}: ${e.message}`,
    );
  }

  // Send payment confirmation to passenger
  try {
    await sendNotification({
      type: "payment_confirmed",
      appointmentId,
      tenantId: 1,
    });
  } catch (notifErr) {
    console.error(
      `[Square Cron] Notification error trip #${appointmentId}: ${notifErr.message}`,
    );
  }

  // Log the event for audit trail
  await sql`
    INSERT INTO payment_events (provider, event_id, event_type, payload, received_at)
    VALUES (
      'square',
      ${`cron-auto-${appointmentId}-${Date.now()}`},
      'cron_auto_detected',
      ${JSON.stringify({ payment_id: paymentId, source: "cron", amount: paidAmount })}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (event_id) DO NOTHING
  `;

  return {
    applied: true,
    amount: paidAmount,
    tip: tipAmount,
    cc_fee: customerCcFee,
  };
}

export async function GET(request) {
  const startTime = Date.now();
  const results = {
    checked: 0,
    applied: 0,
    already_paid: 0,
    errors: 0,
    skipped: 0,
    skipped_reasons: {
      invoice_unpaid: 0,
      order_not_completed: 0,
      no_reference_id: 0,
      api_error: 0,
    },
    details: [],
  };

  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      return Response.json(
        { error: "Square not configured (SQUARE_ACCESS_TOKEN missing)" },
        { status: 400 },
      );
    }

    const squareApiUrl = getSquareApiUrl();

    // Find all pending Square payments from the last 90 days
    const pendingPayments = await sql`
      SELECT
        p.id as pmt_id,
        p.appointment_id,
        p.amount,
        p.metadata,
        p.external_reference_id,
        p.status as pmt_status,
        a.booking_number,
        a.payment_status as appt_payment_status
      FROM payments p
      JOIN appointments a ON a.id = p.appointment_id
      WHERE p.provider = 'square'
        AND p.status IN ('pending', 'link_created')
        AND a.payment_status != 'paid'
        AND p.created_at > NOW() - INTERVAL '90 days'
        AND a.tenant_id = 1
      ORDER BY p.created_at DESC
      LIMIT 100
    `;

    console.log(
      `[Square Cron] Found ${pendingPayments.length} pending Square payments to check`,
    );
    results.checked = pendingPayments.length;

    for (const pmtRow of pendingPayments) {
      const pmtMeta =
        typeof pmtRow.metadata === "string"
          ? JSON.parse(pmtRow.metadata)
          : pmtRow.metadata || {};

      const invoiceId =
        pmtMeta.invoice_id ||
        (pmtMeta.type === "invoice" ? pmtRow.external_reference_id : null);
      const orderId = pmtMeta.order_id;

      let applied = false;
      let skipReason = null;

      // Check if we have any Square reference ID
      if (!invoiceId && !orderId) {
        results.skipped++;
        results.skipped_reasons.no_reference_id++;
        console.log(
          `[Square Cron] ⚠️ Payment #${pmtRow.pmt_id} (trip ${pmtRow.booking_number}) has no invoice_id or order_id — skipping`,
        );
        continue;
      }

      // Strategy 1: Check Square invoice
      if (invoiceId) {
        try {
          const invRes = await fetch(
            `${squareApiUrl}/v2/invoices/${invoiceId}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Square-Version": SQUARE_API_VERSION,
              },
            },
          );

          if (invRes.ok) {
            const invData = await invRes.json();
            const inv = invData.invoice;

            if (inv?.status === "PAID") {
              console.log(
                `[Square Cron] ✅ Invoice ${invoiceId} PAID — applying to trip #${pmtRow.appointment_id} (${pmtRow.booking_number})`,
              );

              // Get payment details from the invoice's order
              const invOrderId = inv.order_id;
              let squarePayment = null;

              if (invOrderId) {
                const orderRes = await fetch(
                  `${squareApiUrl}/v2/orders/${invOrderId}`,
                  {
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      "Square-Version": SQUARE_API_VERSION,
                    },
                  },
                );
                if (orderRes.ok) {
                  const orderData = await orderRes.json();
                  const tenderId = orderData.order?.tenders?.[0]?.payment_id;
                  if (tenderId) {
                    const payRes = await fetch(
                      `${squareApiUrl}/v2/payments/${tenderId}`,
                      {
                        headers: {
                          Authorization: `Bearer ${accessToken}`,
                          "Square-Version": SQUARE_API_VERSION,
                        },
                      },
                    );
                    if (payRes.ok) {
                      const payData = await payRes.json();
                      squarePayment = payData.payment;
                    }
                  }
                }
              }

              if (squarePayment) {
                const result = await applyPayment(
                  pmtRow.appointment_id,
                  pmtRow.pmt_id,
                  squarePayment,
                  pmtMeta,
                );
                results.applied++;
                results.details.push({
                  booking_number: pmtRow.booking_number,
                  appointment_id: pmtRow.appointment_id,
                  source: "invoice",
                  invoice_id: invoiceId,
                  ...result,
                });
                applied = true;
              } else {
                // Invoice is PAID but couldn't get payment details — apply with stored amount
                const totalAmount = Number(pmtRow.amount);
                const ccFee =
                  pmtMeta.credit_card_fee !== undefined
                    ? Number(pmtMeta.credit_card_fee)
                    : 0;
                const basePmt = totalAmount - ccFee;

                await sql`UPDATE payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${pmtRow.pmt_id}`;
                await sql`UPDATE appointments SET payment_status = 'paid', payment_date = CURRENT_TIMESTAMP, payment_amount = ${basePmt} WHERE id = ${pmtRow.appointment_id} AND tenant_id = 1`;

                const existingTx = await sql`
                  SELECT id FROM transactions WHERE appointment_id = ${pmtRow.appointment_id} AND method = 'Square' AND category = 'payment' LIMIT 1
                `;
                if (existingTx.length === 0) {
                  await sql`
                    INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
                    VALUES (${pmtRow.appointment_id}, 'payment', 'Square', ${basePmt}, 0,
                      ${`Square invoice ${invoiceId} - Trip amount (cron)`}, CURRENT_DATE, 1)
                  `;
                  if (ccFee > 0) {
                    await sql`
                      INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
                      VALUES (${pmtRow.appointment_id}, 'cc_fee', 'Square', ${ccFee}, 0,
                        ${`Square invoice ${invoiceId} - CC fee (cron)`}, CURRENT_DATE, 1)
                    `;
                  }

                  // Driver commission
                  try {
                    const [appt] = await sql`
                      SELECT a.employee_id, a.booking_number, e.name as employee_name, e.salary_rate
                      FROM appointments a LEFT JOIN employees e ON a.employee_id = e.id
                      WHERE a.id = ${pmtRow.appointment_id}
                    `;
                    if (appt?.employee_id && appt?.salary_rate) {
                      const existingComm =
                        await sql`SELECT id FROM transactions WHERE appointment_id = ${pmtRow.appointment_id} AND category = 'expense' AND method = 'Commission' LIMIT 1`;
                      if (existingComm.length === 0) {
                        const [servicesRow] = await sql`
                          SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
                          FROM appointment_services WHERE appointment_id = ${pmtRow.appointment_id}
                        `;
                        const svcTotal = Number(
                          servicesRow?.services_total || 0,
                        );
                        const commBase = svcTotal > 0 ? svcTotal : basePmt;
                        const commAmt = (
                          commBase * Number(appt.salary_rate)
                        ).toFixed(2);
                        const tripRef =
                          appt.booking_number || `#${pmtRow.appointment_id}`;
                        await sql`
                          INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
                          VALUES (1, ${pmtRow.appointment_id}, 'expense', 'Commission', ${commAmt}, 0,
                            ${`Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`}, CURRENT_DATE, ${appt.employee_id})
                        `;
                      }
                    }
                  } catch (commErr) {
                    console.error(
                      `[Square Cron] Commission error: ${commErr.message}`,
                    );
                  }
                }

                try {
                  await recalculatePaymentsAndBalance(pmtRow.appointment_id);
                } catch (e) {
                  /* ignore */
                }
                try {
                  await autoCompleteIfEligible(pmtRow.appointment_id);
                } catch (e) {
                  /* ignore */
                }

                results.applied++;
                results.details.push({
                  booking_number: pmtRow.booking_number,
                  appointment_id: pmtRow.appointment_id,
                  source: "invoice_no_payment_details",
                  invoice_id: invoiceId,
                  applied: true,
                  amount: totalAmount,
                });
                applied = true;
              }
            } else if (inv?.status) {
              // Invoice exists but not paid — this is NORMAL, not an error
              results.skipped++;
              results.skipped_reasons.invoice_unpaid++;
              console.log(
                `[Square Cron] 📋 Invoice ${invoiceId} status: ${inv.status} (trip ${pmtRow.booking_number}) — waiting for customer to pay`,
              );
            }
          } else {
            const errText = await invRes.text();
            console.error(
              `[Square Cron] ❌ API error checking invoice ${invoiceId}: ${invRes.status} - ${errText.substring(0, 200)}`,
            );
            results.errors++;
            results.skipped_reasons.api_error++;
          }
        } catch (err) {
          console.error(
            `[Square Cron] ❌ Exception checking invoice ${invoiceId}: ${err.message}`,
          );
          results.errors++;
          results.skipped_reasons.api_error++;
        }
      }

      // Strategy 2: Check Square order (for payment link payments)
      if (!applied && orderId) {
        try {
          const orderRes = await fetch(`${squareApiUrl}/v2/orders/${orderId}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Square-Version": SQUARE_API_VERSION,
            },
          });

          if (orderRes.ok) {
            const orderData = await orderRes.json();
            const order = orderData.order;

            if (
              order?.state === "COMPLETED" &&
              order.tenders?.[0]?.payment_id
            ) {
              console.log(
                `[Square Cron] ✅ Order ${orderId} COMPLETED — applying to trip #${pmtRow.appointment_id} (${pmtRow.booking_number})`,
              );

              const tenderId = order.tenders[0].payment_id;
              const payRes = await fetch(
                `${squareApiUrl}/v2/payments/${tenderId}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Square-Version": SQUARE_API_VERSION,
                  },
                },
              );

              if (payRes.ok) {
                const payData = await payRes.json();
                const result = await applyPayment(
                  pmtRow.appointment_id,
                  pmtRow.pmt_id,
                  payData.payment,
                  pmtMeta,
                );
                results.applied++;
                results.details.push({
                  booking_number: pmtRow.booking_number,
                  appointment_id: pmtRow.appointment_id,
                  source: "order",
                  order_id: orderId,
                  ...result,
                });
                applied = true;
              }
            } else if (order?.state) {
              // Order exists but not completed — this is NORMAL
              results.skipped++;
              results.skipped_reasons.order_not_completed++;
              console.log(
                `[Square Cron] 📋 Order ${orderId} state: ${order.state} (trip ${pmtRow.booking_number}) — waiting for customer to pay`,
              );
            }
          } else {
            const errText = await orderRes.text();
            console.error(
              `[Square Cron] ❌ API error checking order ${orderId}: ${orderRes.status} - ${errText.substring(0, 200)}`,
            );
            results.errors++;
            results.skipped_reasons.api_error++;
          }
        } catch (err) {
          console.error(
            `[Square Cron] ❌ Exception checking order ${orderId}: ${err.message}`,
          );
          results.errors++;
          results.skipped_reasons.api_error++;
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[Square Cron] ✓ Done in ${elapsed}ms: checked=${results.checked}, applied=${results.applied}, skipped=${results.skipped} (${results.skipped_reasons.invoice_unpaid} unpaid invoices, ${results.skipped_reasons.order_not_completed} uncompleted orders, ${results.skipped_reasons.no_reference_id} missing IDs), errors=${results.errors}`,
    );

    return Response.json({
      success: true,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error("[Square Cron] Fatal error:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Also support POST for manual triggers
export async function POST(request) {
  return GET(request);
}
