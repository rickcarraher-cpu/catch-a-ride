import sql from "@/app/api/utils/sql";
import { cancelSquareOrder } from "@/app/api/payments/providers/square";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";
import { auth } from "@/auth";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";

// ── Resolve the name of the person posting this transaction ─────────────
// Priority: 1) employee name from employees table, 2) session user name, 3) session email
async function resolvePostedBy(session) {
  if (session?.user?.email) {
    try {
      const [employee] = await sql`
        SELECT name FROM employees
        WHERE LOWER(email) = LOWER(${session.user.email})
          AND is_active = true
        LIMIT 1
      `;
      if (employee?.name) return employee.name;
      if (session.user.name) return session.user.name;
      return session.user.email;
    } catch (lookupErr) {
      console.error("[PostedBy Lookup] Failed:", lookupErr.message);
      return session?.user?.name || session?.user?.email || null;
    }
  }
  return session?.user?.name || null;
}

export async function GET(request) {
  const tenantId = await resolveTenantFromSession(request);

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const category = searchParams.get("category");
  const appointment_id = searchParams.get("appointment_id");
  let employee_id = searchParams.get("employee_id");
  const q = searchParams.get("q"); // text search across all time

  // ── SECURITY: Verify driver can only see their own transactions ──────────
  try {
    const session = await auth();

    if (session?.user?.email) {
      const [driver] = await sql`
        SELECT id, is_admin FROM employees 
        WHERE LOWER(email) = LOWER(${session.user.email}) 
          AND tenant_id = ${tenantId} 
          AND is_active = true
      `;

      if (driver) {
        // If the user is NOT an admin, force them to only see their own transactions
        if (!driver.is_admin) {
          employee_id = String(driver.id);
          console.log(
            `[GET /api/transactions] Non-admin driver ${driver.id} restricted to viewing own transactions only`,
          );
        }
        // If they ARE an admin, allow the requested employee_id filter
      }
    }
  } catch (authError) {
    console.error("Transaction security check error:", authError);
    // Continue with original employee_id if check fails
  }

  try {
    let query = `
      SELECT 
        t.*,
        a.booking_number,
        a.start_time as trip_date,
        c.name as passenger_name
      FROM transactions t
      LEFT JOIN appointments a ON t.appointment_id = a.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE t.tenant_id = ${tenantId}
    `;
    const params = [];

    if (appointment_id) {
      params.push(appointment_id);
      query += ` AND t.appointment_id = $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND t.employee_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND t.category = $${params.length}`;
      // Exclude $0 payment transactions — these are phantom entries created
      // when a payment link is confirmed before services are set
      if (category === "payment") {
        query += ` AND t.amount > 0`;
      }
    }

    if (q) {
      // Text search — skip date range, search all time
      params.push(`%${q}%`);
      const idx = params.length;
      query += ` AND (
        a.booking_number ILIKE $${idx}
        OR c.name ILIKE $${idx}
        OR t.description ILIKE $${idx}
        OR CAST(t.appointment_id AS TEXT) LIKE $${idx}
      )`;
    } else {
      // Date range only when not doing a text search
      if (start) {
        params.push(start);
        query += ` AND t.transaction_date >= $${params.length}::date`;
      }
      if (end) {
        params.push(end);
        query += ` AND t.transaction_date <= $${params.length}::date`;
      }
    }

    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;

    const transactions = await sql(query, params);
    return Response.json(transactions);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      appointment_id,
      category,
      method,
      amount,
      tip_amount,
      description,
      transaction_date,
    } = await request.json();

    // Resolve who is posting this transaction (for audit trail)
    const session = await auth();
    const postedBy = await resolvePostedBy(session);

    // Snapshot the current driver at payment time for 1099 accuracy
    let snapshotEmployeeId = null;
    if (appointment_id) {
      const [apptSnap] = await sql`
        SELECT employee_id FROM appointments WHERE id = ${appointment_id}
      `;
      snapshotEmployeeId = apptSnap?.employee_id || null;
    }

    // Cast transaction_date to ::date to prevent timezone conversion issues
    // Use CURRENT_DATE (not now()) as fallback to ensure date-only, no time component
    const dateValue = transaction_date || null;

    const result = await sql`
      INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id, posted_by)
      VALUES (1, ${appointment_id}, ${category}, ${method}, ${amount}, ${tip_amount || 0}, ${description}, COALESCE(${dateValue}::date, CURRENT_DATE), ${snapshotEmployeeId}, ${postedBy})
      RETURNING *
    `;

    const payment = result[0];

    // ═══════════════════════════════════════════════════════════════════
    // MAINTAIN CACHED FIELDS when payment-related transactions are created
    // ═══════════════════════════════════════════════════════════════════
    if (appointment_id && (category === "payment" || category === "cc_fee")) {
      await recalculatePaymentsAndBalance(appointment_id);
    }

    // When recording a payment, update the appointments table with smart payment status
    if (category === "payment" && appointment_id) {
      // Get the appointment's original amount (total owed) AND existing payment_method
      const [appt] = await sql`
        SELECT original_amount, balance_due, payment_method FROM appointments WHERE id = ${appointment_id}
      `;
      const originalAmount = Number(appt?.original_amount || 0);
      const balanceDue = Number(appt?.balance_due || 0); // Read from cached field
      const existingPaymentMethod = appt?.payment_method || null;

      // Calculate total payments made (read from cached field or recalculate)
      const [paymentsSum] = await sql`
        SELECT payments_total FROM appointments WHERE id = ${appointment_id}
      `;
      const totalPaid = Number(paymentsSum?.payments_total || 0);

      // Determine payment status based on balance
      let newStatus = "unpaid";

      if (balanceDue <= 0) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partial";
      }

      // ═══════════════════════════════════════════════════════════════════
      // ONLY SET payment_date when status is 'paid'
      // Clear payment_date if status is not 'paid' to prevent inconsistencies
      // ═══════════════════════════════════════════════════════════════════
      const paymentDateValue =
        newStatus === "paid"
          ? transaction_date
            ? transaction_date + "T12:00:00"
            : "now()"
          : null;

      // Only update payment_method when there's an actual payment amount.
      // Tip-only transactions (amount=0, tip_amount>0) should NOT overwrite
      // the trip's payment method (e.g. "Square Invoice" → "Cash").
      // Also, do NOT overwrite an already-set payment method — e.g. adding a
      // cash transaction to a Square trip should not flip it to "Cash".
      const hasActualPayment = Number(amount) > 0;
      const shouldUpdatePaymentMethod =
        hasActualPayment && !existingPaymentMethod;

      if (shouldUpdatePaymentMethod) {
        await sql`
          UPDATE appointments
          SET 
            payment_amount = ${totalPaid},
            payment_status = ${newStatus},
            payment_date = ${paymentDateValue},
            payment_method = ${method}
          WHERE id = ${appointment_id}
        `;
      } else {
        await sql`
          UPDATE appointments
          SET 
            payment_amount = ${totalPaid},
            payment_status = ${newStatus},
            payment_date = ${paymentDateValue}
          WHERE id = ${appointment_id}
        `;
      }

      console.log(
        `[POST /api/transactions] Trip #${appointment_id}: payment_date ${paymentDateValue ? "SET" : "CLEARED"} (status=${newStatus}, totalPaid=$${totalPaid}, payment_method ${shouldUpdatePaymentMethod ? "set to " + method : "unchanged (already: " + (existingPaymentMethod || "none") + ")"})`,
      );

      // ── Supersede active payment links when payment recorded ────────────
      if (balanceDue <= 0) {
        const activePayments = await sql`
          SELECT id, provider, status, metadata
          FROM payments
          WHERE appointment_id = ${appointment_id}
            AND status IN ('pending', 'link_created', 'manual_pending')
        `;

        if (activePayments.length > 0) {
          console.log(
            `[POST /api/transactions] Trip #${appointment_id} paid in full - superseding ${activePayments.length} active payment link(s)...`,
          );

          for (const paymentLink of activePayments) {
            // Cancel Square orders if applicable
            if (paymentLink.provider === "square") {
              try {
                const metadata = paymentLink.metadata
                  ? typeof paymentLink.metadata === "string"
                    ? JSON.parse(paymentLink.metadata)
                    : paymentLink.metadata
                  : null;
                const orderId = metadata?.order_id;

                if (orderId) {
                  await cancelSquareOrder(orderId);
                  console.log(
                    `[POST /api/transactions] Cancelled Square order ${orderId} for payment #${paymentLink.id}`,
                  );
                }
              } catch (cancelErr) {
                console.error(
                  `[POST /api/transactions] Failed to cancel Square order for payment #${paymentLink.id}:`,
                  cancelErr.message,
                );
              }
            }

            await sql`UPDATE payments SET status = 'superseded' WHERE id = ${paymentLink.id}`;
          }

          console.log(
            `[POST /api/transactions] Superseded ${activePayments.length} payment link(s) for trip #${appointment_id}`,
          );
        }
      }
      // ── END SUPERSEDE LOGIC ───────────────────────────────────────────────
    }

    // Auto-create driver commission expense when a payment is recorded
    if (category === "payment" && appointment_id) {
      try {
        // Look up the appointment's driver and use cached driver_commission
        const [appt] = await sql`
          SELECT 
            a.employee_id, 
            a.booking_number, 
            a.driver_commission,
            a.services_total,
            e.name as employee_name, 
            e.salary_rate
          FROM appointments a
          LEFT JOIN employees e ON a.employee_id = e.id
          WHERE a.id = ${appointment_id}
        `;

        if (appt?.employee_id && appt?.salary_rate) {
          // Check if a commission already exists for this trip to prevent duplicates
          const existingCommission = await sql`
            SELECT id FROM transactions
            WHERE appointment_id = ${appointment_id}
              AND category = 'expense'
              AND method = 'Commission'
            LIMIT 1
          `;

          if (existingCommission.length === 0) {
            // Use the CACHED driver_commission value instead of recalculating
            const commissionAmount = Number(
              appt.driver_commission || 0,
            ).toFixed(2);
            const tripRef = appt.booking_number || `#${appointment_id}`;
            const expenseDesc = `Commission for ${appt.employee_name} (${Math.round(appt.salary_rate * 100)}%) — Trip ${tripRef}`;

            await sql`
              INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id, posted_by)
              VALUES (1, ${appointment_id}, 'expense', 'Commission', ${commissionAmount}, 0, ${expenseDesc}, COALESCE(${dateValue}::date, CURRENT_DATE), ${appt.employee_id}, ${postedBy})
            `;

            console.log(
              `[POST /api/transactions] Created commission transaction: $${commissionAmount} (from cached field)`,
            );
          } else {
            console.log(
              `[POST /api/transactions] Commission already exists for trip #${appointment_id}, skipping auto-create.`,
            );
          }
        }
      } catch (expenseErr) {
        // Log but don't fail the payment if expense creation fails
        console.error("Auto-expense creation failed:", expenseErr);
      }
    }

    return Response.json(payment);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}
