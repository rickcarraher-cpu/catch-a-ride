import sql from "@/app/api/utils/sql";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";

const SQUARE_API_VERSION = "2026-05-20";

function getSquareApiUrl() {
  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

/**
 * Auto-apply a paid Square payment that was missed by webhooks.
 * Creates transactions, updates appointment, recalculates balances.
 */
async function autoApplySquarePayment(
  appointmentId,
  pmtRowId,
  squarePayment,
  pmtMeta,
) {
  const paidAmount = (squarePayment.amount_money?.amount || 0) / 100;
  const tipAmount = (squarePayment.tip_money?.amount || 0) / 100;
  const processingFee = squarePayment.processing_fee?.[0]?.amount_money?.amount
    ? Number(squarePayment.processing_fee[0].amount_money.amount) / 100
    : 0;
  const paymentId = squarePayment.id;

  // Get customer CC fee from payment metadata (stored when the link/invoice was created)
  let customerCcFee = 0;
  if (
    pmtMeta?.credit_card_fee !== undefined &&
    pmtMeta?.credit_card_fee !== null
  ) {
    customerCcFee = Number(pmtMeta.credit_card_fee);
  } else {
    // Fallback: calculate from services
    try {
      const services = await sql`
        SELECT service_price, quantity FROM appointment_services WHERE appointment_id = ${appointmentId}
      `;
      const subtotal = services.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );
      const feeRows =
        await sql`SELECT value FROM settings WHERE tenant_id = 1 AND key = 'credit_card_fee_percent' LIMIT 1`;
      const feePercent =
        feeRows.length > 0 && feeRows[0].value ? Number(feeRows[0].value) : 4;
      if (subtotal > 0) {
        customerCcFee = Math.round((subtotal * feePercent) / 100);
      }
    } catch (e) {
      console.error(`[Square Status] Could not calculate CC fee: ${e.message}`);
    }
  }

  const totalTripPayment = paidAmount - tipAmount;
  let baseTripPayment = totalTripPayment - customerCcFee;

  // Guard: if Square's total_money didn't include the CC surcharge (invoice
  // payments sometimes report only the order line-item total), don't subtract again.
  if (customerCcFee > 0) {
    try {
      const [svcRow] = await sql`
        SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as svc_total
        FROM appointment_services WHERE appointment_id = ${appointmentId}
      `;
      const servicesTotal = Number(svcRow?.svc_total || 0);
      if (servicesTotal > 0 && Math.abs(totalTripPayment - servicesTotal) < 1) {
        console.log(
          `[Square Status] CC fee ($${customerCcFee}) not in Square total_money — using payment=$${servicesTotal}`,
        );
        baseTripPayment = servicesTotal;
      }
    } catch (e) {
      console.error(`[Square Status] Services total lookup error:`, e.message);
    }
  }

  console.log(
    `[Square Status] Auto-applying payment: total=$${paidAmount}, base=$${baseTripPayment}, ccFee=$${customerCcFee}, tip=$${tipAmount}`,
  );

  // Update payment record
  if (pmtRowId) {
    await sql`
      UPDATE payments
      SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{square_payment_id}', ${JSON.stringify(paymentId)}::jsonb)
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
    SELECT id FROM transactions WHERE appointment_id = ${appointmentId} AND method = 'Square' AND category = 'payment' LIMIT 1
  `;

  if (existingTx.length === 0) {
    // Base trip payment transaction
    await sql`
      INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
      VALUES (${appointmentId}, 'payment', 'Square', ${baseTripPayment}, 0,
        ${`Square payment ${paymentId} - Trip amount (auto-detected)`}, CURRENT_DATE, 1)
    `;

    // Auto-create driver commission
    try {
      const [appt] = await sql`
        SELECT a.employee_id, a.booking_number, e.name as employee_name, e.salary_rate
        FROM appointments a LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.id = ${appointmentId}
      `;
      if (appt?.employee_id && appt?.salary_rate) {
        const existingComm = await sql`
          SELECT id FROM transactions WHERE appointment_id = ${appointmentId} AND category = 'expense' AND method = 'Commission' LIMIT 1
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
            INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
            VALUES (1, ${appointmentId}, 'expense', 'Commission', ${commissionAmount}, 0,
              ${`Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`}, CURRENT_DATE, ${appt.employee_id})
          `;
          console.log(
            `[Square Status] ✓ Auto-created commission: $${commissionAmount} for ${appt.employee_name}`,
          );
        }
      }
    } catch (commErr) {
      console.error(`[Square Status] Commission error: ${commErr.message}`);
    }

    // CC fee transaction
    if (customerCcFee > 0) {
      await sql`
        INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
        VALUES (${appointmentId}, 'cc_fee', 'Square', ${customerCcFee}, 0,
          ${`Square payment ${paymentId} - CC fee (auto-detected)`}, CURRENT_DATE, 1)
      `;
    }

    // Tip transaction
    if (tipAmount > 0) {
      await sql`
        INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
        VALUES (${appointmentId}, 'tip', 'Square', 0, ${tipAmount},
          ${`Square tip ${paymentId} (auto-detected)`}, CURRENT_DATE, 1)
      `;
    }

    // Processing fee
    if (processingFee > 0) {
      await sql`
        INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
        VALUES (${appointmentId}, 'expense', 'Square', ${processingFee}, 0,
          ${`Square processing fee ${paymentId} (auto-detected)`}, CURRENT_DATE, 1)
      `;
    }
  }

  // Recalculate cached fields
  try {
    await recalculatePaymentsAndBalance(appointmentId);
  } catch (e) {
    console.error(`[Square Status] Cache recalc error: ${e.message}`);
  }

  // Auto-complete if eligible
  try {
    await autoCompleteIfEligible(appointmentId);
  } catch (e) {
    console.error(`[Square Status] Auto-complete error: ${e.message}`);
  }

  // Log as payment event for audit
  await sql`
    INSERT INTO payment_events (provider, event_id, event_type, payload, received_at)
    VALUES ('square', ${`auto-detect-${appointmentId}-${Date.now()}`}, 'auto_detected',
      ${JSON.stringify({ payment_id: paymentId, source: "status-check", amount: paidAmount })}::jsonb,
      CURRENT_TIMESTAMP)
    ON CONFLICT (event_id) DO NOTHING
  `;

  return {
    auto_applied: true,
    amount: paidAmount,
    tip: tipAmount,
    cc_fee: customerCcFee,
    base_payment: baseTripPayment,
  };
}

export async function GET(request, { params }) {
  try {
    const { trip_id } = params;

    const [appointment] = await sql`
      SELECT id, square_payment_id, square_checkout_id, payment_status, payment_amount, payment_date
      FROM appointments
      WHERE id = ${trip_id} AND tenant_id = 1
    `;

    if (!appointment) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // If already paid, just return current status
    if (appointment.payment_status === "paid") {
      return Response.json({
        trip_id: appointment.id,
        payment_status: "paid",
        payment_id: appointment.square_payment_id,
        checkout_id: appointment.square_checkout_id,
        amount: appointment.payment_amount,
        payment_date: appointment.payment_date,
      });
    }

    // If there's a pending Square payment, actively check Square's API
    const pendingPayments = await sql`
      SELECT id, amount, metadata, external_reference_id, status
      FROM payments
      WHERE appointment_id = ${trip_id}
        AND provider = 'square'
        AND status IN ('pending', 'link_created')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (pendingPayments.length > 0) {
      const pmtRow = pendingPayments[0];
      const pmtMeta =
        typeof pmtRow.metadata === "string"
          ? JSON.parse(pmtRow.metadata)
          : pmtRow.metadata || {};
      const accessToken = process.env.SQUARE_ACCESS_TOKEN;
      const squareApiUrl = getSquareApiUrl();

      if (accessToken) {
        try {
          const invoiceId =
            pmtMeta.invoice_id ||
            (pmtMeta.type === "invoice" ? pmtRow.external_reference_id : null);
          const orderId = pmtMeta.order_id;

          // Strategy 1: Check invoice directly
          if (invoiceId) {
            console.log(
              `[Square Status] Checking invoice ${invoiceId} for trip #${trip_id}...`,
            );
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
                  `[Square Status] ✓ Invoice ${invoiceId} is PAID! Auto-applying...`,
                );

                // Get payment details from the invoice order
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
                  const result = await autoApplySquarePayment(
                    trip_id,
                    pmtRow.id,
                    squarePayment,
                    pmtMeta,
                  );
                  return Response.json({
                    trip_id: Number(trip_id),
                    payment_status: "paid",
                    ...result,
                    message:
                      "Payment auto-detected from Square invoice and applied",
                  });
                } else {
                  // Invoice is paid but we couldn't get payment details — apply with stored amount
                  const totalAmount = Number(pmtRow.amount);
                  const ccFee =
                    pmtMeta.credit_card_fee !== undefined
                      ? Number(pmtMeta.credit_card_fee)
                      : 0;
                  const basePmt = totalAmount - ccFee;

                  // Update payment record
                  await sql`UPDATE payments SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${pmtRow.id}`;
                  await sql`UPDATE appointments SET payment_status = 'paid', payment_date = CURRENT_TIMESTAMP, payment_amount = ${basePmt} WHERE id = ${trip_id} AND tenant_id = 1`;

                  // Check for existing transactions
                  const existingTx =
                    await sql`SELECT id FROM transactions WHERE appointment_id = ${trip_id} AND method = 'Square' AND category = 'payment' LIMIT 1`;
                  if (existingTx.length === 0) {
                    await sql`INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
                      VALUES (${trip_id}, 'payment', 'Square', ${basePmt}, 0, ${`Square invoice ${invoiceId} - Trip amount (auto-detected)`}, CURRENT_DATE, 1)`;
                    if (ccFee > 0) {
                      await sql`INSERT INTO transactions (appointment_id, category, method, amount, tip_amount, description, transaction_date, tenant_id)
                        VALUES (${trip_id}, 'cc_fee', 'Square', ${ccFee}, 0, ${`Square invoice ${invoiceId} - CC fee (auto-detected)`}, CURRENT_DATE, 1)`;
                    }

                    // Auto-create driver commission
                    try {
                      const [appt] = await sql`
                        SELECT a.employee_id, a.booking_number, e.name as employee_name, e.salary_rate
                        FROM appointments a LEFT JOIN employees e ON a.employee_id = e.id
                        WHERE a.id = ${trip_id}
                      `;
                      if (appt?.employee_id && appt?.salary_rate) {
                        const existingComm =
                          await sql`SELECT id FROM transactions WHERE appointment_id = ${trip_id} AND category = 'expense' AND method = 'Commission' LIMIT 1`;
                        if (existingComm.length === 0) {
                          const [servicesRow] = await sql`
                            SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
                            FROM appointment_services WHERE appointment_id = ${trip_id}
                          `;
                          const servicesTotal = Number(
                            servicesRow?.services_total || 0,
                          );
                          const commBase =
                            servicesTotal > 0 ? servicesTotal : basePmt;
                          const commAmt = (
                            commBase * Number(appt.salary_rate)
                          ).toFixed(2);
                          const tripRef = appt.booking_number || `#${trip_id}`;
                          await sql`
                            INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
                            VALUES (1, ${trip_id}, 'expense', 'Commission', ${commAmt}, 0,
                              ${`Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`}, CURRENT_DATE, ${appt.employee_id})
                          `;
                        }
                      }
                    } catch (commErr) {
                      console.error(
                        `[Square Status] Commission error: ${commErr.message}`,
                      );
                    }
                  }

                  try {
                    await recalculatePaymentsAndBalance(Number(trip_id));
                  } catch (e) {
                    /* ignore */
                  }
                  try {
                    await autoCompleteIfEligible(Number(trip_id));
                  } catch (e) {
                    /* ignore */
                  }

                  return Response.json({
                    trip_id: Number(trip_id),
                    payment_status: "paid",
                    auto_applied: true,
                    amount: totalAmount,
                    cc_fee: ccFee,
                    base_payment: basePmt,
                    message:
                      "Payment auto-detected from Square invoice (no payment details available)",
                  });
                }
              } else {
                console.log(
                  `[Square Status] Invoice ${invoiceId} status: ${inv?.status} (not paid yet)`,
                );
              }
            }
          }

          // Strategy 2: Check order directly (for payment links)
          if (orderId) {
            console.log(
              `[Square Status] Checking order ${orderId} for trip #${trip_id}...`,
            );
            const orderRes = await fetch(
              `${squareApiUrl}/v2/orders/${orderId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Square-Version": SQUARE_API_VERSION,
                },
              },
            );

            if (orderRes.ok) {
              const orderData = await orderRes.json();
              const order = orderData.order;

              if (
                order?.state === "COMPLETED" &&
                order.tenders?.[0]?.payment_id
              ) {
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
                  const result = await autoApplySquarePayment(
                    trip_id,
                    pmtRow.id,
                    payData.payment,
                    pmtMeta,
                  );
                  return Response.json({
                    trip_id: Number(trip_id),
                    payment_status: "paid",
                    ...result,
                    message:
                      "Payment auto-detected from Square order and applied",
                  });
                }
              }
            }
          }
        } catch (checkErr) {
          console.error(
            `[Square Status] Error checking Square API: ${checkErr.message}`,
          );
          // Don't fail the request — just return current status
        }
      }
    }

    return Response.json({
      trip_id: appointment.id,
      payment_status: appointment.payment_status || "unpaid",
      payment_id: appointment.square_payment_id,
      checkout_id: appointment.square_checkout_id,
      amount: appointment.payment_amount,
      payment_date: appointment.payment_date,
    });
  } catch (error) {
    console.error("Failed to get payment status:", error);
    return Response.json(
      { error: "Failed to get payment status" },
      { status: 500 },
    );
  }
}
