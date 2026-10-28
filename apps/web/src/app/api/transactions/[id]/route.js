import sql from "@/app/api/utils/sql";

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    const { description } = body;

    const [updated] = await sql`
      UPDATE transactions
      SET description = ${description ?? null}
      WHERE id = ${id} AND tenant_id = 1
      RETURNING *
    `;

    if (!updated) {
      return Response.json({ error: "Transaction not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;

  try {
    // Grab the transaction before deleting so we know the appointment_id and category
    const [txn] = await sql`
      SELECT id, appointment_id, category FROM transactions
      WHERE id = ${id} AND tenant_id = 1
    `;

    if (!txn) {
      // Already gone — treat as success so stale UI records can be cleared
      return Response.json({ success: true });
    }

    // Delete the transaction
    await sql`
      DELETE FROM transactions
      WHERE id = ${id} AND tenant_id = 1
    `;

    // If this was a payment, also clean up the auto-created commission expense
    // and recalculate the appointment's payment status
    if (txn.category === "payment" && txn.appointment_id) {
      // Delete any commission expense tied to this appointment that was auto-created
      await sql`
        DELETE FROM transactions
        WHERE appointment_id = ${txn.appointment_id}
          AND tenant_id = 1
          AND category = 'expense'
          AND method = 'Commission'
      `;

      // Get the appointment's original amount (total owed)
      const [appt] = await sql`
        SELECT original_amount FROM appointments WHERE id = ${txn.appointment_id}
      `;
      const originalAmount = Number(appt?.original_amount || 0);

      // Calculate total payments remaining after deletion
      // Include cc_fee transactions — original_amount includes CC fees
      const [paymentsSum] = await sql`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE appointment_id = ${txn.appointment_id}
        AND category IN ('payment', 'cc_fee')
      `;
      const totalPaid = Number(paymentsSum?.total || 0);

      // Determine payment status based on balance
      const balance = originalAmount - totalPaid;
      let newStatus = "unpaid";

      if (balance <= 0) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partial";
      }

      // ═══════════════════════════════════════════════════════════════════
      // ALWAYS CLEAR payment_date if status is not 'paid'
      // Prevents inconsistency where payment_date exists but no payments remain
      // ═══════════════════════════════════════════════════════════════════
      const shouldClearDate = newStatus !== "paid";

      // Update appointment with recalculated status
      await sql`
        UPDATE appointments
        SET
          payment_status = ${newStatus},
          payment_amount = ${totalPaid},
          payment_date = ${shouldClearDate ? null : "NOW()"},
          payment_method = ${newStatus === "unpaid" ? null : "Multiple"}
        WHERE id = ${txn.appointment_id}
      `;

      console.log(
        `[DELETE /api/transactions/${id}] Trip #${txn.appointment_id}: status=${newStatus}, totalPaid=$${totalPaid}, payment_date ${shouldClearDate ? "CLEARED" : "SET"}`,
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
