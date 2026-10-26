import sql from "@/app/api/utils/sql";

export async function createMissingCommission(id, updated, driverChanged) {
  try {
    const currentEmployeeId = updated.employee_id;

    if (updated.payment_status !== "paid" || !currentEmployeeId) {
      return;
    }

    const existingCommissions = await sql`
      SELECT id, employee_id FROM transactions
      WHERE appointment_id = ${id}
        AND category = 'expense'
        AND method = 'Commission'
      ORDER BY id ASC
    `;

    // Clean up duplicate commissions — keep only the first one per employee
    if (existingCommissions.length > 1) {
      const keepId = existingCommissions[0].id;
      const dupeIds = existingCommissions.slice(1).map((c) => c.id);
      await sql`
        DELETE FROM transactions
        WHERE id = ANY(${dupeIds})
      `;
      console.log(
        `[PATCH ${id}] Cleaned up ${dupeIds.length} duplicate commission(s), kept id=${keepId}`,
      );
    }

    // Re-check after cleanup: does a commission exist for the current driver?
    const existingCommission =
      existingCommissions.length > 0 ? [existingCommissions[0]] : [];

    const commissionBelongsToDifferentDriver =
      existingCommission.length > 0 &&
      existingCommission[0].employee_id !== currentEmployeeId &&
      driverChanged;

    if (commissionBelongsToDifferentDriver) {
      await sql`
        DELETE FROM transactions
        WHERE appointment_id = ${id}
          AND category = 'expense'
          AND method = 'Commission'
          AND employee_id != ${currentEmployeeId}
      `;
      console.log(
        `[PATCH ${id}] Removed old driver commission — driver reassigned, will create new one`,
      );
    }

    const needsCommission =
      existingCommission.length === 0 || commissionBelongsToDifferentDriver;

    if (needsCommission) {
      const [driverInfo] = await sql`
        SELECT id, name, salary_rate FROM employees WHERE id = ${currentEmployeeId}
      `;

      // Fetch trip-level commission rate override if set
      const [tripRow] = await sql`
        SELECT trip_commission_rate FROM appointments WHERE id = ${id}
      `;
      const tripRate =
        tripRow?.trip_commission_rate !== null &&
        tripRow?.trip_commission_rate !== undefined
          ? Number(tripRow.trip_commission_rate)
          : null;

      // Use trip override rate if set, otherwise fall back to driver's default
      const effectiveRate =
        tripRate !== null ? tripRate : Number(driverInfo?.salary_rate || 0);

      if (driverInfo && effectiveRate > 0) {
        const [servicesRow] = await sql`
          SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
          FROM appointment_services WHERE appointment_id = ${id}
        `;
        const servicesTotal = Number(servicesRow?.services_total || 0);
        const commissionBase =
          servicesTotal > 0
            ? servicesTotal
            : Number(updated.payment_amount || 0);
        const commissionAmount = (commissionBase * effectiveRate).toFixed(2);
        const tripRef = updated.booking_number || `#${id}`;
        const rateLabel =
          tripRate !== null
            ? `${Math.round(effectiveRate * 100)}% override`
            : `${Math.round(effectiveRate * 100)}%`;
        const expenseDesc = `Commission for ${driverInfo.name} (${rateLabel}) — Trip ${tripRef}`;

        await sql`
          INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
          VALUES (1, ${id}, 'expense', 'Commission', ${commissionAmount}, 0, ${expenseDesc}, CURRENT_DATE, ${driverInfo.id})
        `;
        console.log(
          `[PATCH ${id}] ✓ Auto-created missing commission $${commissionAmount} for ${driverInfo.name} at ${Math.round(effectiveRate * 100)}%`,
        );
      }
    } else if (existingCommission.length > 0) {
      console.log(
        `[PATCH ${id}] Commission already exists for paid trip #${id} — skipping`,
      );
    }
  } catch (commErr) {
    console.error(
      `[PATCH ${id}] Commission auto-create failed:`,
      commErr.message,
    );
  }
}
