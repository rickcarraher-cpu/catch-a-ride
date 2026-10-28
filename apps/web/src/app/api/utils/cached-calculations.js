import sql from "@/app/api/utils/sql";
import { recalculateDisplayFields } from "@/app/api/utils/cached-display-fields";

/**
 * Helper: detect gas fee services by name.
 * Gas fees are treated like tips — excluded from driver commission, shown separately.
 */
export function isGasFeeService(name) {
  return typeof name === "string" && name.toLowerCase().includes("gas");
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CACHED TRIP CALCULATIONS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This module maintains denormalized/cached financial data on the appointments table.
 * Instead of recalculating these values on every read, we store them and update
 * them ONLY when the underlying data changes.
 *
 * Cached Fields:
 * - services_total: Sum of all service prices (base revenue before CC fees)
 * - driver_commission: services_total × driver.salary_rate
 * - payments_total: Sum of payment transactions only (excludes CC fees — those are a business cost)
 * - tips_total: Sum of all tip amounts
 * - balance_due: original_amount - payments - cc_fees - tips (tips count toward settling a remaining balance)
 * - display_* fields: Pre-computed date/time/address display strings
 *
 * These fields are updated by calling the recalculate functions whenever:
 * - Services are added/removed/changed
 * - Driver is assigned/changed or their salary_rate changes
 * - Payments/refunds are recorded
 * - Tips are added
 * - Trip date/time changes
 * - Addresses change
 */

/**
 * Recalculate and store services_total on the appointment.
 * This is the base revenue (sum of all service prices) BEFORE credit card fees.
 *
 * Call this when:
 * - Services are added, removed, or price/quantity changed
 * - Trip is created with services
 *
 * @param {number} appointmentId
 * @returns {Promise<number>} The calculated services_total
 */
export async function recalculateServicesTotal(appointmentId) {
  // Join with services — use is_tip_addon flag to identify driver reimbursement services
  const [row] = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN COALESCE(s.is_tip_addon, false) = true THEN 0 
                        ELSE aps.service_price * COALESCE(aps.quantity, 1) END), 0) AS commission_base,
      COALESCE(SUM(CASE WHEN COALESCE(s.is_tip_addon, false) = true
                        THEN aps.service_price * COALESCE(aps.quantity, 1) ELSE 0 END), 0) AS gas_fee_total,
      COALESCE(SUM(aps.service_price * COALESCE(aps.quantity, 1)), 0) AS total_all
    FROM appointment_services aps
    LEFT JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ${appointmentId}
  `;

  const commissionBase = Number(row?.commission_base || 0);
  const gasFeeTotal = Number(row?.gas_fee_total || 0);
  const totalAll = Number(row?.total_all || 0);

  // ── Preserve the CC fee in original_amount ────────────────────────────
  // original_amount = what the passenger owes = services + CC fee (when the
  // payment method is card-based). Recomputing original_amount from services
  // alone would silently drop the fee and corrupt balance_due (phantom
  // negative balances on paid trips). The fee is locked at booking time in
  // cc_fee_amount, so carry it forward for card payment methods.
  //
  // Guard: if the trip has NO service rows (e.g. tours priced via a direct
  // original_amount override), leave original_amount untouched — a $0 sum
  // here means "no data", not "free trip".
  const hasServiceRows =
    totalAll !== 0 || commissionBase !== 0 || gasFeeTotal !== 0;

  if (!hasServiceRows) {
    console.log(
      `[Cache] Trip #${appointmentId}: no service rows — services_total set to $0, original_amount left untouched`,
    );
    await sql`
      UPDATE appointments
      SET services_total = 0
      WHERE id = ${appointmentId}
    `;
    return 0;
  }

  // services_total = commission base only (gas fees are excluded — driver earns no split on them)
  // original_amount = full amount passenger owes (includes gas fees + preserved CC fee)
  const [apptRow] = await sql`
    SELECT payment_method, cc_fee_amount FROM appointments WHERE id = ${appointmentId}
  `;
  const isCardPayment = ["Credit Card", "Square", "Square Invoice"].includes(
    apptRow?.payment_method || "",
  );
  const existingCcFee = isCardPayment ? Number(apptRow?.cc_fee_amount || 0) : 0;
  const newOriginalAmount = totalAll + existingCcFee;

  await sql`
    UPDATE appointments
    SET services_total = ${commissionBase},
        original_amount = ${newOriginalAmount}
    WHERE id = ${appointmentId}
  `;

  console.log(
    `[Cache] Trip #${appointmentId}: services_total (commission base) = $${commissionBase}, gas_fee_total = $${gasFeeTotal}, original_amount = $${newOriginalAmount} (services $${totalAll} + preserved CC fee $${existingCcFee})`,
  );
  return commissionBase;
}

/**
 * Recalculate and store driver_commission on the appointment.
 * Commission = services_total × driver.salary_rate
 *
 * Call this when:
 * - Driver is assigned or changed
 * - Driver's salary_rate changes
 * - Services change (triggers services_total recalc, which should chain to this)
 *
 * @param {number} appointmentId
 * @returns {Promise<number>} The calculated commission
 */
export async function recalculateDriverCommission(appointmentId) {
  // Get the appointment's driver, services_total, and optional per-trip rate override
  const [appointment] = await sql`
    SELECT employee_id, services_total, trip_commission_rate FROM appointments WHERE id = ${appointmentId}
  `;

  if (!appointment || !appointment.employee_id) {
    // No driver assigned — commission is 0
    await sql`
      UPDATE appointments SET driver_commission = 0 WHERE id = ${appointmentId}
    `;
    return 0;
  }

  // Use trip-level rate override if set, otherwise fall back to driver's default salary_rate
  let rate;
  if (
    appointment.trip_commission_rate !== null &&
    appointment.trip_commission_rate !== undefined
  ) {
    rate = Number(appointment.trip_commission_rate);
  } else {
    // Get the driver's default commission rate
    const [driver] = await sql`
      SELECT salary_rate FROM employees WHERE id = ${appointment.employee_id}
    `;

    if (!driver) {
      await sql`
        UPDATE appointments SET driver_commission = 0 WHERE id = ${appointmentId}
      `;
      return 0;
    }
    rate = Number(driver.salary_rate || 0);
  }

  // Get gas fee / driver reimbursement services (is_tip_addon = true)
  // Driver receives 100% of these — they are reimbursements, not commission
  const [gasFeeRow] = await sql`
    SELECT COALESCE(SUM(aps.service_price * COALESCE(aps.quantity, 1)), 0) AS gas_fee_total
    FROM appointment_services aps
    LEFT JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ${appointmentId}
      AND COALESCE(s.is_tip_addon, false) = true
  `;
  const gasFeeTotal = Number(gasFeeRow?.gas_fee_total || 0);

  const servicesTotal = Number(appointment.services_total || 0);
  // Commission = (services_total × rate) + gas_fee_total (driver gets 100% of reimbursements)
  const commission = Number((servicesTotal * rate + gasFeeTotal).toFixed(2));

  await sql`
    UPDATE appointments SET driver_commission = ${commission} WHERE id = ${appointmentId}
  `;

  const rateSource =
    appointment.trip_commission_rate !== null &&
    appointment.trip_commission_rate !== undefined
      ? "trip override"
      : "driver default";
  console.log(
    `[Cache] Trip #${appointmentId}: driver_commission = ($${servicesTotal} × ${(rate * 100).toFixed(0)}% (${rateSource})) + $${gasFeeTotal} gas reimbursement = $${commission}`,
  );

  return commission;
}

/**
 * Recalculate and store payment totals and balance on the appointment.
 * - payments_total: Sum of payment transactions only (CC fees excluded — they are a business cost)
 * - tips_total: Sum of all tip_amount values from payment transactions
 * - balance_due: original_amount - payments - cc_fees - tips (tips count toward settling a remaining balance)
 *
 * Call this when:
 * - Payment transaction is created
 * - Refund is issued
 * - CC fee transaction is created
 * - original_amount changes
 *
 * @param {number} appointmentId
 * @returns {Promise<{payments_total: number, tips_total: number, balance_due: number}>}
 */
export async function recalculatePaymentsAndBalance(appointmentId) {
  // Get the original amount (total owed)
  const [appointment] = await sql`
    SELECT original_amount, payment_status, driver_commission, employee_id, services_total, status
    FROM appointments WHERE id = ${appointmentId}
  `;

  // ── GUARD: never touch deleted or cancelled trips ─────────────────────
  // Recalculating a deleted/cancelled trip would restore its balance_due
  // and flip payment_status back to 'unpaid', making it resurface in
  // unpaid-trips reports. Deleted trips must stay frozen as-is.
  if (
    appointment &&
    (appointment.status === "deleted" || appointment.status === "cancelled")
  ) {
    console.log(
      `[Cache] Trip #${appointmentId}: status is '${appointment.status}' — skipping payment recalculation (trip is deleted/cancelled)`,
    );
    return {
      payments_total: 0,
      tips_total: 0,
      balance_due: 0,
      skipped: true,
    };
  }

  const originalAmount = Number(appointment?.original_amount || 0);

  console.log(
    `[Cache] Trip #${appointmentId}: recalculatePaymentsAndBalance starting with original_amount=$${originalAmount}`,
  );

  // Sum up payments (payment transactions ONLY)
  // CC fees are a business cost, NOT customer payments — they do NOT reduce balance_due
  // Tips are tracked separately — they don't reduce the balance
  const [paymentRow] = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN category = 'payment' THEN amount ELSE 0 END), 0) as payments,
      COALESCE(SUM(CASE WHEN category = 'payment' THEN tip_amount ELSE 0 END), 0) as tips,
      COALESCE(SUM(CASE WHEN category = 'cc_fee' THEN amount ELSE 0 END), 0) as cc_fees
    FROM transactions
    WHERE appointment_id = ${appointmentId}
    AND category IN ('payment', 'cc_fee')
  `;

  // Also count tips stored as separate 'tip' category rows (e.g. from Square webhooks)
  const [tipRow] = await sql`
    SELECT COALESCE(SUM(tip_amount), 0) as separate_tips
    FROM transactions
    WHERE appointment_id = ${appointmentId}
    AND category = 'tip'
  `;

  // Gas fee services flow to the driver like a tip — include in tips_total
  const [gasFeeRow] = await sql`
    SELECT COALESCE(SUM(aps.service_price * COALESCE(aps.quantity, 1)), 0) AS gas_fees
    FROM appointment_services aps
    LEFT JOIN services s ON s.id = aps.service_id
    WHERE aps.appointment_id = ${appointmentId}
      AND LOWER(s.name) LIKE '%gas%'
  `;

  const paymentsTotal = Number(paymentRow?.payments || 0);
  const ccFeeTotal = Number(paymentRow?.cc_fees || 0);
  const tipsFromPayments = Number(paymentRow?.tips || 0);
  const tipsFromTipRows = Number(tipRow?.separate_tips || 0);
  const gasFeeAmount = Number(gasFeeRow?.gas_fees || 0);
  // Gas fees are a service line item — they are already included in payments/services.
  // Do NOT add them to tips_total, which should only reflect actual tips from passengers.
  const tipsTotal = tipsFromPayments + tipsFromTipRows;
  // ── Tips count as money received when settling a balance ────────────────
  // CC fees are charged TO the customer (included in original_amount), and tips
  // are real money the passenger sent. When a balance remains after fare
  // payments, tips settle it (e.g. a $4 Venmo tip covering a $4 gas-fee line
  // item on the trip). Tips never create a negative balance — only genuine
  // fare overpayments show as a credit.
  const totalReceived = paymentsTotal + ccFeeTotal + tipsTotal;
  const fareBalance = originalAmount - paymentsTotal - ccFeeTotal;
  const balanceDue =
    fareBalance > 0 ? Math.max(0, fareBalance - tipsTotal) : fareBalance;

  console.log(
    `[Cache] Trip #${appointmentId}: paymentsTotal=$${paymentsTotal}, ccFees=$${ccFeeTotal}, tips=$${tipsTotal}, totalReceived=$${totalReceived}, balanceDue=$${balanceDue} (original_amount $${originalAmount})`,
  );

  // ── Auto-set payment_status to 'paid' when balance is settled ──────────
  // If balance_due <= 0 and we received payments, the trip is paid.
  // Also auto-mark zero-charge trips (services_total = 0, balance_due <= 0) as paid.
  // This prevents trips from staying at 'link_created', 'unpaid', etc.
  const currentStatus = appointment?.payment_status || "";
  const isZeroChargePaid =
    Number(appointment?.services_total || 0) === 0 && balanceDue <= 0;
  const isPaidNow = (balanceDue <= 0 && totalReceived > 0) || isZeroChargePaid;
  const shouldUpdateStatus = isPaidNow && currentStatus !== "paid";

  // ═══════════════════════════════════════════════════════════════════
  // AUTO-CLEAR payment_date if balance_due > 0 or no payments exist
  // (but NOT for zero-charge trips — those are legitimately paid with no payments)
  // Prevents data inconsistency where payment_date exists without payments
  // ═══════════════════════════════════════════════════════════════════
  const shouldClearPaymentDate =
    !isZeroChargePaid && (balanceDue > 0 || totalReceived === 0);

  if (shouldUpdateStatus) {
    // Trip just became paid - set payment_date if not already set
    await sql`
      UPDATE appointments
      SET 
        payments_total = ${paymentsTotal},
        tips_total = ${tipsTotal},
        balance_due = ${balanceDue},
        cc_fee_amount = ${ccFeeTotal},
        payment_status = 'paid',
        payment_date = COALESCE(payment_date, CURRENT_TIMESTAMP)
      WHERE id = ${appointmentId}
    `;
    console.log(
      `[Cache] Trip #${appointmentId}: payments=$${paymentsTotal}, tips=$${tipsTotal}, balance=$${balanceDue}, cc_fee_amount=$${ccFeeTotal} → payment_status updated to 'paid' (was '${currentStatus}')`,
    );
  } else if (shouldClearPaymentDate) {
    // Balance is still owed or no payments - clear payment_date
    // If the trip was previously 'paid' but now has a balance due (e.g. price adjustment),
    // reset payment_status back to 'unpaid'.
    const shouldResetToPaid = currentStatus === "paid" && balanceDue > 0;

    if (shouldResetToPaid) {
      await sql`
        UPDATE appointments
        SET 
          payments_total = ${paymentsTotal},
          tips_total = ${tipsTotal},
          balance_due = ${balanceDue},
          cc_fee_amount = ${ccFeeTotal},
          payment_status = 'unpaid',
          payment_date = NULL
        WHERE id = ${appointmentId}
      `;
      console.log(
        `[Cache] Trip #${appointmentId}: balance_due=$${balanceDue} after adjustment — payment_status reset 'paid' → 'unpaid', payment_date CLEARED`,
      );
    } else {
      await sql`
        UPDATE appointments
        SET 
          payments_total = ${paymentsTotal},
          tips_total = ${tipsTotal},
          balance_due = ${balanceDue},
          cc_fee_amount = ${ccFeeTotal},
          payment_date = NULL
        WHERE id = ${appointmentId}
      `;
      console.log(
        `[Cache] Trip #${appointmentId}: payments=$${paymentsTotal}, tips=$${tipsTotal} (txn tips: $${tipsFromPayments + tipsFromTipRows}, gas fees: $${gasFeeAmount}), balance=$${balanceDue}, cc_fee_amount=$${ccFeeTotal}, payment_date CLEARED`,
      );
    }
  } else {
    // Paid in full, just update totals without touching payment_date or status
    await sql`
      UPDATE appointments
      SET 
        payments_total = ${paymentsTotal},
        tips_total = ${tipsTotal},
        balance_due = ${balanceDue},
        cc_fee_amount = ${ccFeeTotal}
      WHERE id = ${appointmentId}
    `;
    console.log(
      `[Cache] Trip #${appointmentId}: payments=$${paymentsTotal}, tips=$${tipsTotal} (txn tips: $${tipsFromPayments + tipsFromTipRows}, gas fees: $${gasFeeAmount}), balance=$${balanceDue}, cc_fee_amount=$${ccFeeTotal}`,
    );
  }

  // ── Auto-populate driver_commission when trip becomes paid ──────────────
  // If the trip just became paid and driver_commission is 0 but there's revenue
  // and a driver assigned, calculate and cache it now.
  const existingCommission = Number(appointment?.driver_commission || 0);
  const servicesTotal = Number(appointment?.services_total || 0);
  if (
    isPaidNow &&
    existingCommission === 0 &&
    servicesTotal > 0 &&
    appointment?.employee_id
  ) {
    try {
      await recalculateDriverCommission(appointmentId);
    } catch (commErr) {
      console.error(
        `[Cache] Trip #${appointmentId}: Failed to auto-populate driver_commission:`,
        commErr.message,
      );
    }
  }

  return {
    payments_total: paymentsTotal,
    tips_total: tipsTotal,
    balance_due: balanceDue,
  };
}

/**
 * Recalculate ALL cached fields for a trip in one go.
 * This is useful for:
 * - Backfilling existing trips
 * - Major updates that affect multiple fields
 * - Initial trip creation
 *
 * @param {number} appointmentId
 * @returns {Promise<{services_total: number, driver_commission: number, payments_total: number, tips_total: number, balance_due: number}>}
 */
export async function recalculateAllCachedFields(appointmentId) {
  console.log(
    `[Cache] Recalculating ALL cached fields for trip #${appointmentId}...`,
  );

  const servicesTotal = await recalculateServicesTotal(appointmentId);
  const driverCommission = await recalculateDriverCommission(appointmentId);
  const paymentData = await recalculatePaymentsAndBalance(appointmentId);

  // ✅ NEW: Also recalculate display fields (date/time/address strings)
  // This ensures all downstream consumers (emails, SMS, reports, UI) read from the database
  await recalculateDisplayFields(appointmentId);

  return {
    services_total: servicesTotal,
    driver_commission: driverCommission,
    ...paymentData,
  };
}

/**
 * Batch recalculation for multiple trips.
 * More efficient than calling recalculateAllCachedFields in a loop.
 *
 * @param {number[]} appointmentIds
 * @returns {Promise<void>}
 */
export async function recalculateAllCachedFieldsBatch(appointmentIds) {
  if (!appointmentIds || appointmentIds.length === 0) {
    return;
  }

  console.log(`[Cache] Batch recalculating ${appointmentIds.length} trips...`);

  for (const id of appointmentIds) {
    try {
      await recalculateAllCachedFields(id);
    } catch (error) {
      console.error(`[Cache] Failed to recalculate trip #${id}:`, error);
    }
  }

  console.log(`[Cache] Batch recalculation complete.`);
}
