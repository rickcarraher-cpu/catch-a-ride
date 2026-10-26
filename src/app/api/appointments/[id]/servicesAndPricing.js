import sql from "@/app/api/utils/sql";
import {
  recalculateServicesTotal,
  recalculateDriverCommission,
  recalculatePaymentsAndBalance,
} from "@/app/api/utils/cached-calculations";

export async function saveAppointmentServices(id, services) {
  await sql`DELETE FROM appointment_services WHERE appointment_id = ${id}`;
  console.log(
    `[PATCH ${id}] Saving ${services.length} services:`,
    JSON.stringify(services),
  );
  for (const s of services) {
    await sql`
      INSERT INTO appointment_services (appointment_id, service_id, service_price, duration_minutes, quantity, stop_description)
      VALUES (${id}, ${s.service_id}, ${s.service_price}, ${s.duration_minutes}, ${s.quantity || 1}, ${s.stop_description || null})
    `;
  }

  // ═══════════════════════════════════════════════════════════════════
  // RECALCULATE CACHED FIELDS when services change
  // ═══════════════════════════════════════════════════════════════════
  await recalculateServicesTotal(id);
  await recalculateDriverCommission(id);
  // Note: balance recalc not needed here - payments didn't change
}

export async function calculateOriginalAmount(
  services,
  baseAmount,
  paymentMethod,
) {
  let originalAmount = Math.ceil(baseAmount);
  let ccFeeAmount = 0;

  if (
    (paymentMethod === "Credit Card" ||
      paymentMethod === "Square" ||
      paymentMethod === "Square Invoice") &&
    baseAmount > 0
  ) {
    const feeSettingsRows = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
    `;
    const feePercent =
      feeSettingsRows.length > 0 ? Number(feeSettingsRows[0].value) : 4;

    const creditCardFee = (baseAmount * feePercent) / 100;
    const roundedFee = Math.round(creditCardFee);
    originalAmount += roundedFee;
    ccFeeAmount = roundedFee;

    console.log(
      `Base amount: $${baseAmount.toFixed(2)} → rounded to $${Math.ceil(baseAmount)}. Credit card fee (${feePercent}%): $${creditCardFee.toFixed(2)} → rounded to $${roundedFee}. Total: $${originalAmount}`,
    );
  }

  return { originalAmount, ccFeeAmount };
}

export async function updateOriginalAndPaymentAmount(
  id,
  originalAmount,
  ccFeeAmount = null,
) {
  console.log(
    `[updateOriginalAndPaymentAmount] Trip #${id}: Setting original_amount to $${originalAmount}${ccFeeAmount !== null ? `, cc_fee_amount to $${ccFeeAmount}` : ""}`,
  );

  if (ccFeeAmount !== null) {
    await sql`
      UPDATE appointments
      SET original_amount = ${originalAmount},
          cc_fee_amount = ${ccFeeAmount}
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE appointments
      SET original_amount = ${originalAmount}
      WHERE id = ${id}
    `;
  }

  const existingPayments = await sql`
    SELECT COUNT(*) as count FROM transactions
    WHERE appointment_id = ${id} AND category = 'payment'
  `;

  const hasPayments = existingPayments[0]?.count > 0;

  if (!hasPayments) {
    await sql`
      UPDATE appointments
      SET payment_amount = ${originalAmount}
      WHERE id = ${id}
    `;
    console.log(
      `[PATCH ${id}] Updated original_amount and payment_amount to $${originalAmount} (no payments yet)`,
    );
  } else {
    console.log(
      `[PATCH ${id}] Updated original_amount to $${originalAmount} (payment_amount unchanged - payments exist)`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // RECALCULATE BALANCE when original_amount changes
  // ═══════════════════════════════════════════════════════════════════
  await recalculatePaymentsAndBalance(id);

  // Log the final balance_due for verification
  const [updated] = await sql`
    SELECT balance_due FROM appointments WHERE id = ${id}
  `;
  console.log(
    `[updateOriginalAndPaymentAmount] Trip #${id}: After recalc, balance_due=$${updated?.balance_due || 0}`,
  );

  // ═══════════════════════════════════════════════════════════════════
  // SUPERSEDE STALE PAYMENT LINKS when balance_due changes
  // ═══════════════════════════════════════════════════════════════════
  // If there's an active payment link with a different amount than the new balance_due,
  // mark it as superseded so a fresh link with the correct amount will be generated
  const newBalanceDue = Number(updated?.balance_due || 0);
  if (newBalanceDue > 0) {
    const existingLinks = await sql`
      SELECT id, amount, provider FROM payments
      WHERE appointment_id = ${id}
      AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingLinks.length > 0) {
      const existingLink = existingLinks[0];
      const existingAmount = Number(existingLink.amount);
      const amountDifference = Math.abs(existingAmount - newBalanceDue);

      if (amountDifference > 0.01) {
        await sql`
          UPDATE payments
          SET status = 'superseded'
          WHERE id = ${existingLink.id}
        `;
        console.log(
          `[updateOriginalAndPaymentAmount] Trip #${id}: Superseded ${existingLink.provider} payment link (old amount: $${existingAmount}, new balance_due: $${newBalanceDue})`,
        );
      }
    }
  }
}

export async function recalculateCommissionForPaidTrip(
  id,
  existingTrip,
  fields,
  baseAmount,
) {
  try {
    const currentPaymentStatus = existingTrip.payment_status;
    const currentDriverId =
      fields.employee_id !== undefined
        ? fields.employee_id
        : existingTrip.employee_id;

    if (currentPaymentStatus === "paid" && currentDriverId) {
      const existingCommissionRows = await sql`
        SELECT id FROM transactions
        WHERE appointment_id = ${id}
          AND category = 'expense'
          AND method = 'Commission'
        ORDER BY id ASC
      `;

      if (existingCommissionRows.length > 0) {
        // Clean up duplicates first — keep only the first commission
        if (existingCommissionRows.length > 1) {
          const keepId = existingCommissionRows[0].id;
          const dupeIds = existingCommissionRows.slice(1).map((c) => c.id);
          await sql`
            DELETE FROM transactions
            WHERE id = ANY(${dupeIds})
          `;
          console.log(
            `[PATCH ${id}] recalcCommission: cleaned up ${dupeIds.length} duplicate commission(s), kept id=${keepId}`,
          );
        }

        const [driverForCommission] = await sql`
          SELECT id, name, salary_rate FROM employees WHERE id = ${currentDriverId}
        `;

        // Use trip-level rate override if set, otherwise driver's default
        const [tripRow] = await sql`
          SELECT trip_commission_rate FROM appointments WHERE id = ${id}
        `;
        const tripRate =
          tripRow?.trip_commission_rate !== null &&
          tripRow?.trip_commission_rate !== undefined
            ? Number(tripRow.trip_commission_rate)
            : null;
        const effectiveRate =
          tripRate !== null
            ? tripRate
            : Number(driverForCommission?.salary_rate || 0);

        if (driverForCommission && effectiveRate > 0) {
          const newServicesTotal = baseAmount;
          const newCommissionAmount = (
            newServicesTotal * effectiveRate
          ).toFixed(2);
          const tripRef = existingTrip.booking_number || `#${id}`;
          const rateLabel =
            tripRate !== null
              ? `${Math.round(effectiveRate * 100)}% override`
              : `${Math.round(effectiveRate * 100)}%`;
          const newExpenseDesc = `Commission for ${driverForCommission.name} (${rateLabel}) — Trip ${tripRef}`;

          // Update only the kept commission row
          await sql`
            UPDATE transactions
            SET amount = ${newCommissionAmount}, description = ${newExpenseDesc}
            WHERE id = ${existingCommissionRows[0].id}
          `;
          console.log(
            `[PATCH ${id}] ✓ Updated commission to $${newCommissionAmount} at ${Math.round(effectiveRate * 100)}%`,
          );
        }
      }
    }
  } catch (commRecalcErr) {
    console.error(
      `[PATCH ${id}] Commission recalculation failed:`,
      commRecalcErr.message,
    );
  }
}

export async function recalculateAmountOnPaymentMethodChange(
  id,
  existingTrip,
  fields,
) {
  const oldPayMethod = existingTrip.payment_method || "";
  const newPayMethod = fields.payment_method || "";

  const oldIsCard = ["Credit Card", "Square", "Square Invoice"].includes(
    oldPayMethod,
  );
  const newIsCard = ["Credit Card", "Square", "Square Invoice"].includes(
    newPayMethod,
  );

  if (oldIsCard !== newIsCard) {
    const currentServices = await sql`
      SELECT service_price, quantity
      FROM appointment_services WHERE appointment_id = ${id}
    `;

    let baseAmount = currentServices.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    if (baseAmount <= 0) {
      const existingOriginal = Number(existingTrip.original_amount || 0);
      const existingServicesTotal = Number(existingTrip.services_total || 0);

      if (existingServicesTotal > 0) {
        baseAmount = existingServicesTotal;
        console.log(
          `[PATCH ${id}] No appointment_services rows — using cached services_total: $${baseAmount}`,
        );
      } else if (existingOriginal > 0) {
        if (oldIsCard && existingOriginal > 0) {
          const feeRows = await sql`
            SELECT value FROM settings 
            WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
          `;
          const feePercent = feeRows.length > 0 ? Number(feeRows[0].value) : 4;
          baseAmount = Math.floor(existingOriginal / (1 + feePercent / 100));
          console.log(
            `[PATCH ${id}] No services rows — reverse-calculated base from original_amount $${existingOriginal} (minus ${feePercent}% CC fee): $${baseAmount}`,
          );
        } else {
          baseAmount = existingOriginal;
          console.log(
            `[PATCH ${id}] No services rows — using original_amount as base: $${baseAmount}`,
          );
        }
      }
    }

    if (baseAmount > 0) {
      let recalcOriginal = Math.ceil(baseAmount);
      let newCcFeeAmount = 0;

      if (newIsCard) {
        const feeRows = await sql`
          SELECT value FROM settings 
          WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
        `;
        const feePercent = feeRows.length > 0 ? Number(feeRows[0].value) : 4;
        const fee = Math.round((baseAmount * feePercent) / 100);
        recalcOriginal += fee;
        newCcFeeAmount = fee;
        console.log(
          `[PATCH ${id}] Payment method changed to ${newPayMethod} — adding CC fee: $${fee}. New original_amount: $${recalcOriginal}`,
        );
      } else {
        const deletedFees = await sql`
          DELETE FROM transactions
          WHERE appointment_id = ${id} AND category = 'cc_fee'
          RETURNING id, amount
        `;
        if (deletedFees.length > 0) {
          const totalDeleted = deletedFees.reduce(
            (s, r) => s + Number(r.amount),
            0,
          );
          console.log(
            `[PATCH ${id}] Payment method changed from ${oldPayMethod} to ${newPayMethod} — deleted ${deletedFees.length} cc_fee transaction(s) totaling $${totalDeleted.toFixed(2)}`,
          );
        } else {
          console.log(
            `[PATCH ${id}] Payment method changed from ${oldPayMethod} to ${newPayMethod} — no cc_fee transactions to remove`,
          );
        }
        console.log(
          `[PATCH ${id}] Removing CC fee. New original_amount: $${recalcOriginal}`,
        );
      }

      await sql`
        UPDATE appointments
        SET original_amount = ${recalcOriginal},
            cc_fee_amount = ${newCcFeeAmount}
        WHERE id = ${id}
      `;

      const payCheck = await sql`
        SELECT COUNT(*) as count FROM transactions
        WHERE appointment_id = ${id} AND category = 'payment'
      `;
      if (payCheck[0]?.count <= 0) {
        await sql`UPDATE appointments SET payment_amount = ${recalcOriginal} WHERE id = ${id}`;
      }
    } else {
      console.log(
        `[PATCH ${id}] Payment method changed but base amount is $0 — no CC fee adjustment needed`,
      );
    }

    await recalculatePaymentsAndBalance(id);
  }
}
