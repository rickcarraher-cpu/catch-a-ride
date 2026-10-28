import sql from "@/app/api/utils/sql";

// Use direct fetch to Square API (same pattern as webhook, cron, checkout routes)
const SQUARE_API_VERSION = "2026-05-20";

function getSquareApiUrl() {
  const env = process.env.SQUARE_ENVIRONMENT || "sandbox";
  return env === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

async function squareFetch(path, options = {}) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${getSquareApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_API_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    console.warn(`[Square Reconcile] squareFetch ${path} → ${res.status}`);
    return null;
  }
  return res.json();
}

/**
 * Search Square payments by date range, amount, and customer info
 */
async function searchSquarePayments({
  startDate,
  endDate,
  minAmount,
  maxAmount,
  customerName,
}) {
  try {
    // Build query params for listPayments
    const params = new URLSearchParams();
    if (startDate) params.set("begin_time", startDate);
    if (endDate) params.set("end_time", endDate);
    params.set("limit", "100");

    const data = await squareFetch(`/v2/payments?${params.toString()}`);
    if (!data) return [];

    let payments = data.payments || [];

    // Filter by amount if specified
    if (minAmount !== undefined && maxAmount !== undefined) {
      payments = payments.filter((p) => {
        const totalAmount = (p.total_money?.amount || 0) / 100;
        return totalAmount >= minAmount && totalAmount <= maxAmount;
      });
    }

    // Filter by customer name if specified
    if (customerName) {
      const searchName = customerName.toLowerCase();
      payments = payments.filter((p) => {
        const buyerEmail = p.buyer_email_address?.toLowerCase() || "";
        const refId = p.reference_id?.toLowerCase() || "";
        const note = p.note?.toLowerCase() || "";
        return (
          buyerEmail.includes(searchName) ||
          refId.includes(searchName) ||
          note.includes(searchName)
        );
      });
    }

    return payments;
  } catch (err) {
    console.error("Failed to search Square payments:", err);
    return [];
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { tripIdentifier, action, squarePaymentId, searchDate } = body;

    // Handle manual linking of Square payment ID
    if (action === "link_payment_id" && squarePaymentId) {
      const tripId = tripIdentifier.includes("-")
        ? (
            await sql`SELECT id FROM appointments WHERE booking_number = ${tripIdentifier}`
          )[0]?.id
        : parseInt(tripIdentifier);

      if (!tripId) {
        return Response.json({ error: "Trip not found" }, { status: 404 });
      }

      await sql`
        UPDATE appointments
        SET square_payment_id = ${squarePaymentId}
        WHERE id = ${tripId}
      `;

      return Response.json({
        success: true,
        message:
          "Square payment ID linked successfully. Please search again to view reconciliation.",
      });
    }

    // Handle payment search
    if (action === "search_payments" && searchDate) {
      const tripId = tripIdentifier.includes("-")
        ? (
            await sql`SELECT id FROM appointments WHERE booking_number = ${tripIdentifier}`
          )[0]?.id
        : parseInt(tripIdentifier);

      if (!tripId) {
        return Response.json({ error: "Trip not found" }, { status: 404 });
      }

      const appointment = (
        await sql`
        SELECT a.*, c.name as client_name, c.email as client_email
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        WHERE a.id = ${tripId}
      `
      )[0];

      // Search within +/- 3 days of the specified date
      const searchDateObj = new Date(searchDate);
      const startDate = new Date(searchDateObj);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(searchDateObj);
      endDate.setDate(endDate.getDate() + 3);

      // Search for payments with amount +/- 50% of original amount
      const origAmt = Number(appointment.original_amount || 0);
      const minAmt = origAmt > 0 ? origAmt * 0.5 : 0;
      const maxAmt = origAmt > 0 ? origAmt * 1.5 : 999999;

      const payments = await searchSquarePayments({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        minAmount: minAmt,
        maxAmount: maxAmt,
      });

      // Format results
      const formattedPayments = payments.map((p) => ({
        id: p.id,
        status: p.status,
        created_at: p.created_at,
        total_amount: (p.total_money?.amount || 0) / 100,
        tip_amount: (p.tip_money?.amount || 0) / 100,
        processing_fee:
          p.processing_fee?.reduce(
            (sum, f) => sum + (f.amount_money?.amount || 0),
            0,
          ) / 100 || 0,
        buyer_email: p.buyer_email_address || null,
        reference_id: p.reference_id || null,
        note: p.note || null,
        receipt_url: p.receipt_url || null,
        order_id: p.order_id || null,
      }));

      return Response.json({
        success: true,
        payments: formattedPayments,
        trip: {
          id: appointment.id,
          booking_number: appointment.booking_number,
          client_name: appointment.client_name,
          original_amount: origAmt,
        },
      });
    }

    // Resolve trip identifier to numeric ID
    const tripId = tripIdentifier.includes("-")
      ? (
          await sql`SELECT id FROM appointments WHERE booking_number = ${tripIdentifier}`
        )[0]?.id
      : parseInt(tripIdentifier);

    if (!tripId) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Handle apply corrections
    if (action === "apply_corrections") {
      const { corrections } = body;
      if (!corrections) {
        return Response.json(
          { error: "No corrections provided" },
          { status: 400 },
        );
      }

      // Delete existing payment-related transactions
      if (corrections.delete_existing) {
        await sql`
          DELETE FROM transactions 
          WHERE appointment_id = ${tripId} 
          AND category IN ('payment', 'cc_fee', 'tip')
        `;
      }

      // Insert corrected transactions
      if (corrections.transactions && corrections.transactions.length > 0) {
        for (const tx of corrections.transactions) {
          await sql(
            `INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)`,
            [
              1,
              tripId,
              tx.category,
              tx.method || "Square",
              tx.amount,
              tx.tip_amount || 0,
              tx.description || `Reconciliation correction`,
            ],
          );
        }
      }

      // Recalculate totals
      const allTransactions = await sql`
        SELECT * FROM transactions WHERE appointment_id = ${tripId}
      `;

      const paymentsTotal = allTransactions
        .filter(
          (t) =>
            t.category === "payment" ||
            t.category === "cc_fee" ||
            t.category === "tip",
        )
        .reduce(
          (sum, t) =>
            sum + parseFloat(t.amount || 0) + parseFloat(t.tip_amount || 0),
          0,
        );

      const tipsTotal = allTransactions
        .filter(
          (t) => t.category === "tip" || parseFloat(t.tip_amount || 0) > 0,
        )
        .reduce((sum, t) => sum + parseFloat(t.tip_amount || 0), 0);

      const balanceDue =
        parseFloat(
          (
            await sql`SELECT original_amount FROM appointments WHERE id = ${tripId}`
          )[0]?.original_amount || 0,
        ) - paymentsTotal;

      await sql`
        UPDATE appointments
        SET 
          payments_total = ${paymentsTotal},
          tips_total = ${tipsTotal},
          balance_due = ${balanceDue},
          payment_status = ${balanceDue <= 0.005 ? "paid" : "unpaid"}
        WHERE id = ${tripId}
      `;

      return Response.json({
        success: true,
        message: "Corrections applied successfully",
        updated: {
          payments_total: paymentsTotal,
          tips_total: tipsTotal,
          balance_due: balanceDue,
        },
      });
    }

    // Default action: fetch and compare
    const appointment = (
      await sql`
      SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone,
             e.name as driver_name, e.salary_rate
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ${tripId}
    `
    )[0];

    if (!appointment) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Get services
    const services = await sql`
      SELECT aserv.*, s.name as service_name
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${tripId}
    `;

    // Get transactions
    const transactions = await sql`
      SELECT * FROM transactions WHERE appointment_id = ${tripId} ORDER BY created_at
    `;

    // Get payments table records
    const paymentRecords = await sql`
      SELECT * FROM payments WHERE appointment_id = ${tripId} ORDER BY created_at
    `;

    // Try to fetch from Square if we have a payment ID
    let squareData = null;
    const sqPaymentId = appointment.square_payment_id;

    if (sqPaymentId) {
      const payData = await squareFetch(`/v2/payments/${sqPaymentId}`);
      if (payData?.payment) {
        const sqPay = payData.payment;
        squareData = {
          payment_id: sqPay.id,
          status: sqPay.status,
          created_at: sqPay.created_at,
          total_amount: (sqPay.total_money?.amount || 0) / 100,
          amount_without_tip:
            ((sqPay.total_money?.amount || 0) -
              (sqPay.tip_money?.amount || 0)) /
            100,
          tip_amount: (sqPay.tip_money?.amount || 0) / 100,
          processing_fee:
            sqPay.processing_fee?.reduce(
              (sum, f) => sum + (f.amount_money?.amount || 0),
              0,
            ) / 100 || 0,
          net_amount: (sqPay.approved_money?.amount || 0) / 100,
          buyer_email: sqPay.buyer_email_address || null,
          receipt_url: sqPay.receipt_url || null,
          order_id: sqPay.order_id || null,
          card_details: sqPay.card_details
            ? {
                card_brand: sqPay.card_details.card?.card_brand,
                last_4: sqPay.card_details.card?.last_4,
                exp_month: sqPay.card_details.card?.exp_month,
                exp_year: sqPay.card_details.card?.exp_year,
                entry_method: sqPay.card_details.entry_method,
              }
            : null,
        };
      }
    }

    // Also try fetching via order ID from payments table metadata
    if (!squareData) {
      for (const pr of paymentRecords) {
        const meta =
          typeof pr.metadata === "string"
            ? JSON.parse(pr.metadata)
            : pr.metadata || {};
        const orderId = meta.order_id;
        if (orderId) {
          const orderData = await squareFetch(`/v2/orders/${orderId}`);
          if (orderData?.order?.tenders?.[0]?.payment_id) {
            const tenderId = orderData.order.tenders[0].payment_id;
            const payData = await squareFetch(`/v2/payments/${tenderId}`);
            if (payData?.payment) {
              const sqPay = payData.payment;
              squareData = {
                payment_id: sqPay.id,
                status: sqPay.status,
                created_at: sqPay.created_at,
                total_amount: (sqPay.total_money?.amount || 0) / 100,
                amount_without_tip:
                  ((sqPay.total_money?.amount || 0) -
                    (sqPay.tip_money?.amount || 0)) /
                  100,
                tip_amount: (sqPay.tip_money?.amount || 0) / 100,
                processing_fee:
                  sqPay.processing_fee?.reduce(
                    (sum, f) => sum + (f.amount_money?.amount || 0),
                    0,
                  ) / 100 || 0,
                net_amount: (sqPay.approved_money?.amount || 0) / 100,
                buyer_email: sqPay.buyer_email_address || null,
                receipt_url: sqPay.receipt_url || null,
                order_id: sqPay.order_id || null,
                card_details: sqPay.card_details
                  ? {
                      card_brand: sqPay.card_details.card?.card_brand,
                      last_4: sqPay.card_details.card?.last_4,
                      exp_month: sqPay.card_details.card?.exp_month,
                      exp_year: sqPay.card_details.card?.exp_year,
                      entry_method: sqPay.card_details.entry_method,
                    }
                  : null,
              };
              break;
            }
          }
        }
      }
    }

    // Calculate database totals
    const dbPayments = transactions.filter((t) => t.category === "payment");
    const dbCcFees = transactions.filter((t) => t.category === "cc_fee");
    const dbTips = transactions.filter((t) => t.category === "tip");
    const dbCommissions = transactions.filter(
      (t) =>
        t.category === "expense" && (t.method || "").includes("Commission"),
    );

    const dbPaymentTotal = dbPayments.reduce(
      (sum, t) => sum + parseFloat(t.amount || 0),
      0,
    );
    const dbTipFromPayments = dbPayments.reduce(
      (sum, t) => sum + parseFloat(t.tip_amount || 0),
      0,
    );
    const dbCcFeeTotal = dbCcFees.reduce(
      (sum, t) => sum + parseFloat(t.amount || 0),
      0,
    );
    const dbTipTotal =
      dbTips.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) +
      dbTipFromPayments;

    // Build discrepancies
    const discrepancies = [];
    if (squareData) {
      const sqBaseAmount = squareData.amount_without_tip;
      if (Math.abs(dbPaymentTotal + dbCcFeeTotal - sqBaseAmount) > 0.01) {
        discrepancies.push({
          field: "Base Payment Amount",
          square: sqBaseAmount,
          database: dbPaymentTotal + dbCcFeeTotal,
          difference: sqBaseAmount - (dbPaymentTotal + dbCcFeeTotal),
        });
      }
      if (Math.abs(dbTipTotal - squareData.tip_amount) > 0.01) {
        discrepancies.push({
          field: "Tip Amount (Square only)",
          square: squareData.tip_amount,
          database: dbTipTotal,
          difference: squareData.tip_amount - dbTipTotal,
        });
      }
    }

    return Response.json({
      success: true,
      trip: {
        id: appointment.id,
        booking_number: appointment.booking_number,
        client_name: appointment.client_name,
        client_email: appointment.client_email,
        client_phone: appointment.client_phone,
        driver_name: appointment.driver_name,
        salary_rate: appointment.salary_rate,
        start_time: appointment.start_time,
        payment_status: appointment.payment_status,
        payment_method: appointment.payment_method,
        original_amount: parseFloat(appointment.original_amount || 0),
        services_total: parseFloat(appointment.services_total || 0),
        payments_total: parseFloat(appointment.payments_total || 0),
        tips_total: parseFloat(appointment.tips_total || 0),
        balance_due: parseFloat(appointment.balance_due || 0),
        cc_fee_amount: parseFloat(appointment.cc_fee_amount || 0),
        square_payment_id: appointment.square_payment_id,
      },
      services: services.map((s) => ({
        name: s.service_name,
        price: parseFloat(s.service_price),
        quantity: s.quantity || 1,
        total: parseFloat(s.service_price) * (s.quantity || 1),
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        category: t.category,
        method: t.method,
        amount: parseFloat(t.amount || 0),
        tip_amount: parseFloat(t.tip_amount || 0),
        description: t.description,
        date: t.transaction_date,
      })),
      payment_records: paymentRecords.map((p) => ({
        id: p.id,
        provider: p.provider,
        status: p.status,
        amount: parseFloat(p.amount || 0),
        metadata: p.metadata,
      })),
      square: squareData,
      discrepancies,
      database_totals: {
        payment_amount: dbPaymentTotal,
        cc_fee_amount: dbCcFeeTotal,
        tip_amount: dbTipTotal,
        commission_amount: dbCommissions.reduce(
          (sum, t) => sum + parseFloat(t.amount || 0),
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Reconciliation error:", error);
    return Response.json(
      {
        error: "Failed to reconcile",
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// Add a cash tip or other manual transaction
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      tripIdentifier,
      category,
      method,
      amount,
      tip_amount,
      description,
    } = body;

    const tripId = tripIdentifier.includes("-")
      ? (
          await sql`SELECT id FROM appointments WHERE booking_number = ${tripIdentifier}`
        )[0]?.id
      : parseInt(tripIdentifier);

    if (!tripId) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Insert the transaction
    await sql(
      `INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)`,
      [
        1,
        tripId,
        category || "tip",
        method || "Cash",
        amount || 0,
        tip_amount || 0,
        description || "Manual entry via reconciliation",
      ],
    );

    // Recalculate totals
    const allTransactions = await sql`
      SELECT * FROM transactions WHERE appointment_id = ${tripId}
    `;

    const paymentsTotal = allTransactions
      .filter(
        (t) =>
          t.category === "payment" ||
          t.category === "cc_fee" ||
          t.category === "tip",
      )
      .reduce(
        (sum, t) =>
          sum + parseFloat(t.amount || 0) + parseFloat(t.tip_amount || 0),
        0,
      );

    const tipsTotal = allTransactions
      .filter((t) => t.category === "tip" || parseFloat(t.tip_amount || 0) > 0)
      .reduce((sum, t) => sum + parseFloat(t.tip_amount || 0), 0);

    const balanceDue =
      parseFloat(
        (
          await sql`SELECT original_amount FROM appointments WHERE id = ${tripId}`
        )[0]?.original_amount || 0,
      ) - paymentsTotal;

    await sql`
      UPDATE appointments
      SET 
        payments_total = ${paymentsTotal},
        tips_total = ${tipsTotal},
        balance_due = ${balanceDue},
        payment_status = ${balanceDue <= 0.005 ? "paid" : "unpaid"}
      WHERE id = ${tripId}
    `;

    return Response.json({
      success: true,
      message: "Transaction added successfully",
      updated: {
        payments_total: paymentsTotal,
        tips_total: tipsTotal,
        balance_due: balanceDue,
      },
    });
  } catch (error) {
    console.error("Add transaction error:", error);
    return Response.json(
      {
        error: "Failed to add transaction",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
