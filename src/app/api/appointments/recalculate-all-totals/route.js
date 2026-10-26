import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { dryRun = true } = await request.json();

    // Get all appointments with transactions
    const appointments = await sql`
      SELECT DISTINCT a.id, a.booking_number, a.services_total, a.original_amount, a.payment_status
      FROM appointments a
      WHERE EXISTS (
        SELECT 1 FROM transactions t WHERE t.appointment_id = a.id
      )
      ORDER BY a.id
    `;

    const updates = [];
    const errors = [];

    for (const appointment of appointments) {
      try {
        // Get all transactions for this appointment
        const transactions = await sql`
          SELECT * FROM transactions
          WHERE appointment_id = ${appointment.id}
        `;

        // Calculate totals
        const paymentsTotal = transactions
          .filter((t) => t.category === "payment")
          .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        const tipsTotal = transactions
          .filter(
            (t) => t.category === "tip" || parseFloat(t.tip_amount || 0) > 0,
          )
          .reduce((sum, t) => sum + parseFloat(t.tip_amount || 0), 0);

        // Tips count as money received when settling a remaining balance
        // (e.g. a Venmo tip covering a gas-fee line item on the trip).
        const totalReceived = paymentsTotal + tipsTotal;
        const fareBalance =
          parseFloat(appointment.original_amount || 0) - paymentsTotal;
        const balanceDue =
          fareBalance > 0 ? Math.max(0, fareBalance - tipsTotal) : fareBalance;

        const currentPaymentsTotal = parseFloat(
          appointment.payments_total || 0,
        );
        const currentTipsTotal = parseFloat(appointment.tips_total || 0);
        const currentBalanceDue = parseFloat(appointment.balance_due || 0);
        const currentStatus = appointment.payment_status || "unpaid";

        // Check if update is needed
        const needsUpdate =
          Math.abs(currentPaymentsTotal - paymentsTotal) > 0.01 ||
          Math.abs(currentTipsTotal - tipsTotal) > 0.01 ||
          Math.abs(currentBalanceDue - balanceDue) > 0.01;

        if (needsUpdate) {
          updates.push({
            id: appointment.id,
            booking_number: appointment.booking_number,
            before: {
              payments_total: currentPaymentsTotal,
              tips_total: currentTipsTotal,
              balance_due: currentBalanceDue,
            },
            after: {
              payments_total: paymentsTotal,
              tips_total: tipsTotal,
              balance_due: balanceDue,
            },
          });

          if (!dryRun) {
            // Only flip status when the trip becomes fully paid, or when a
            // previously-'paid' trip now has a balance (price adjustment).
            // Preserve 'partial' / 'link_created' / other statuses otherwise.
            const becomesPaid = balanceDue <= 0 && totalReceived > 0;
            const wasPaid =
              currentStatus === "paid" || currentStatus === "partial_refund";
            let newStatus = null;
            if (becomesPaid) newStatus = "paid";
            else if (wasPaid && balanceDue > 0)
              newStatus = paymentsTotal > 0 ? "partial" : "unpaid";

            if (newStatus) {
              if (becomesPaid) {
                await sql`
                  UPDATE appointments
                  SET 
                    payments_total = ${paymentsTotal},
                    tips_total = ${tipsTotal},
                    balance_due = ${balanceDue},
                    payment_status = ${newStatus},
                    payment_date = COALESCE(payment_date, CURRENT_TIMESTAMP)
                  WHERE id = ${appointment.id}
                `;
              } else {
                await sql`
                  UPDATE appointments
                  SET 
                    payments_total = ${paymentsTotal},
                    tips_total = ${tipsTotal},
                    balance_due = ${balanceDue},
                    payment_status = ${newStatus},
                    payment_date = NULL
                  WHERE id = ${appointment.id}
                `;
              }
            } else {
              await sql`
                UPDATE appointments
                SET 
                  payments_total = ${paymentsTotal},
                  tips_total = ${tipsTotal},
                  balance_due = ${balanceDue}
                WHERE id = ${appointment.id}
              `;
            }
          }
        }
      } catch (err) {
        errors.push({
          id: appointment.id,
          booking_number: appointment.booking_number,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      dryRun,
      totalChecked: appointments.length,
      updatesNeeded: updates.length,
      updates: updates.slice(0, 50), // Limit to first 50 for display
      errors,
      message: dryRun
        ? `Found ${updates.length} trips that need recalculation. Call with dryRun=false to apply updates.`
        : `Successfully updated ${updates.length} trips.`,
    });
  } catch (error) {
    console.error("Recalculate all totals error:", error);
    return Response.json(
      {
        error: "Failed to recalculate totals",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
