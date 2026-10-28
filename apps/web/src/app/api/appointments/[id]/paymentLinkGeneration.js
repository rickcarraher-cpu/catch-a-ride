import sql from "@/app/api/utils/sql";
import {
  createSquarePaymentLink,
  cancelSquareOrder,
} from "@/app/api/payments/providers/square";

export async function supersedePreviousPaymentLinks(
  id,
  existingPayment,
  tripProvider,
) {
  if (existingPayment.provider === "square") {
    try {
      const oldMeta = existingPayment.metadata
        ? typeof existingPayment.metadata === "string"
          ? JSON.parse(existingPayment.metadata)
          : existingPayment.metadata
        : null;
      const oldOrderId = oldMeta?.order_id;
      if (oldOrderId) {
        console.log(
          `[Auto-Payment] Cancelling Square order ${oldOrderId} — trip #${id} switched from ${existingPayment.provider} to ${tripProvider}`,
        );
        await cancelSquareOrder(oldOrderId);
      }
    } catch (cancelErr) {
      console.error(
        `[Auto-Payment] Failed to cancel Square order on provider switch:`,
        cancelErr.message,
      );
    }
  }

  await sql`UPDATE payments SET status = 'superseded' WHERE id = ${existingPayment.id}`;
  console.log(
    `[Auto-Payment] Superseded payment #${existingPayment.id} (${existingPayment.provider}) — trip #${id} switched to ${tripProvider}`,
  );
}

export async function handleCashPaymentSwitch(id, existingPayment) {
  if (existingPayment.provider === "square") {
    try {
      const oldMeta = existingPayment.metadata
        ? typeof existingPayment.metadata === "string"
          ? JSON.parse(existingPayment.metadata)
          : existingPayment.metadata
        : null;
      const oldOrderId = oldMeta?.order_id;
      if (oldOrderId) {
        console.log(
          `[Auto-Payment] Cancelling Square order ${oldOrderId} — trip #${id} switched to Cash`,
        );
        await cancelSquareOrder(oldOrderId);
      }
    } catch (cancelErr) {
      console.error(
        `[Auto-Payment] Failed to cancel Square order on cash switch:`,
        cancelErr.message,
      );
    }
  }
  await sql`UPDATE payments SET status = 'superseded' WHERE id = ${existingPayment.id}`;
  await sql`UPDATE appointments SET payment_status = 'unpaid' WHERE id = ${id}`;
  console.log(
    `[Auto-Payment] Superseded payment #${existingPayment.id} — trip #${id} switched to Cash`,
  );
}

export async function cancelAndSupersedePayment(id, existingPayment) {
  if (existingPayment.provider === "square") {
    try {
      const oldMetadata = existingPayment.metadata
        ? typeof existingPayment.metadata === "string"
          ? JSON.parse(existingPayment.metadata)
          : existingPayment.metadata
        : null;
      const oldOrderId = oldMetadata?.order_id;

      if (oldOrderId) {
        console.log(
          `[Auto-Payment] Cancelling old Square order ${oldOrderId} for superseded payment #${existingPayment.id}`,
        );
        await cancelSquareOrder(oldOrderId);
      } else {
        console.warn(
          `[Auto-Payment] No order_id found in metadata for payment #${existingPayment.id}`,
        );
      }
    } catch (cancelErr) {
      console.error(
        `[Auto-Payment] Failed to cancel old Square order:`,
        cancelErr.message,
      );
    }
  }

  await sql`
    UPDATE payments SET status = 'superseded'
    WHERE id = ${existingPayment.id}
  `;
  console.log(
    `[Auto-Payment] Superseded old payment #${existingPayment.id} ($${existingPayment.amount}) for trip #${id}`,
  );
}

export async function generateSquareInvoicePayment(
  id,
  updated,
  grandTotal,
  svcRows,
  isPartialBalance = false,
) {
  const settingsRows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
  const paySettings = {};
  settingsRows.forEach((r) => {
    paySettings[r.key] = r.value;
  });

  const accessToken =
    paySettings.square_access_token || process.env.SQUARE_ACCESS_TOKEN;
  const locationId =
    paySettings.square_location_id || process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    return false;
  }

  try {
    const svcLineTotal = svcRows.reduce(
      (sum, s) => sum + Number(s.service_price || 0) * Number(s.quantity || 1),
      0,
    );

    console.log(
      `[generateSquarePaymentLink] Trip #${id}: svcLineTotal=$${svcLineTotal}, grandTotal=$${grandTotal}`,
    );

    // Use Square Checkout Links (not invoices) so tipping UI is shown to passengers
    const {
      url: publicUrl,
      externalReferenceId,
      metadata: squareMeta,
    } = await createSquarePaymentLink({
      trip: updated,
      amount: grandTotal,
      customerInfo: {
        name: updated.client_name,
        email: updated.client_email,
        phone: updated.client_phone,
      },
      disableTipping: false,
    });

    await sql(
      `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, external_reference_id, metadata)
       VALUES ($1, 'square', 'link_created', $2, 'USD', $3, $4, $5)`,
      [
        id,
        grandTotal,
        publicUrl,
        externalReferenceId,
        JSON.stringify({
          type: "checkout",
          checkout_id: externalReferenceId,
          order_id: squareMeta.order_id,
          auto_generated: true,
          credit_card_fee:
            grandTotal - svcLineTotal > 0.01
              ? Math.round((grandTotal - svcLineTotal) * 100) / 100
              : 0,
        }),
      ],
    );
    console.log(
      `[Auto-Payment] Square Checkout Link created on PATCH for trip #${id}: ${publicUrl} ($${grandTotal})`,
    );
    return true;
  } catch (sqErr) {
    console.error(
      `[Auto-Payment] Square Checkout Link failed on PATCH for trip #${id}:`,
      sqErr.message,
    );
    return false;
  }
}

export async function generateVenmoPayment(id, grandTotal) {
  const settingsRows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
  const paySettings = {};
  settingsRows.forEach((r) => {
    paySettings[r.key] = r.value;
  });

  const venmoHandle = paySettings.venmo_handle;
  if (!venmoHandle) {
    return false;
  }

  // ── Always pull trip identity from the database (trip record is king) ──
  const [tripRow] = await sql`
    SELECT a.booking_number, c.name as client_name
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.id = ${id}
  `;
  const bookingNum = (tripRow && tripRow.booking_number) || id;
  const clientName = (tripRow && tripRow.client_name) || "Transportation";

  const cleanHandle = venmoHandle.replace(/^@/, "");
  const note = encodeURIComponent(`${clientName} - Trip #${bookingNum}`);
  const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${grandTotal.toFixed(2)}&note=${note}`;
  const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${grandTotal.toFixed(2)}&note=${note}`;

  await sql(
    `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
     VALUES ($1, 'venmo', 'link_created', $2, 'USD', $3, $4)`,
    [
      id,
      grandTotal,
      venmoWebUrl,
      JSON.stringify({
        venmo_app_url: venmoAppUrl,
        venmo_web_url: venmoWebUrl,
        venmo_handle: cleanHandle,
        booking_number: bookingNum,
        auto_generated: true,
      }),
    ],
  );
  console.log(
    `[Auto-Payment] Venmo link created on PATCH for trip #${bookingNum} (db id=${id}, $${grandTotal})`,
  );
  return true;
}

export async function generateZellePayment(id, grandTotal) {
  const settingsRows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
  const paySettings = {};
  settingsRows.forEach((r) => {
    paySettings[r.key] = r.value;
  });

  const zelleContact = paySettings.zelle_contact;
  if (!zelleContact) {
    return false;
  }

  const zelleUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/pay/zelle/${id}`;

  // Determine if zelle_contact is email or phone and store in metadata
  const isEmail = zelleContact.includes("@");
  const metadata = {
    auto_generated: true,
    zelle_contact: zelleContact,
    zelle_email: isEmail ? zelleContact : null,
    zelle_phone: !isEmail ? zelleContact : null,
    zelle_name:
      paySettings.zelle_display_name || paySettings.business_name || "Business",
  };

  await sql(
    `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
     VALUES ($1, 'zelle', 'manual_pending', $2, 'USD', $3, $4)`,
    [id, grandTotal, zelleUrl, JSON.stringify(metadata)],
  );
  console.log(
    `[Auto-Payment] Zelle link created on PATCH for trip #${id} ($${grandTotal})`,
  );
  return true;
}

export async function autoGeneratePaymentLink(
  id,
  updated,
  existingTrip,
  fields,
) {
  try {
    if (updated.is_tentative) {
      console.log(
        `[PATCH ${id}] Skipping payment link generation — trip is tentative/quote (pricing not finalized)`,
      );
      return;
    }

    const svcRows = await sql`
      SELECT aserv.service_price, aserv.quantity, s.name as service_name
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${id}
    `;

    // ── Use balance_due as the authoritative invoice amount ──────────────
    // balance_due already accounts for CC fees, prior payments, and all adjustments.
    let balanceDue = Number(
      updated.balance_due || existingTrip.balance_due || 0,
    );
    let priorPayments = Number(existingTrip.payments_total || 0);

    // ── If balance_due is 0 in both the PATCH payload and the cached trip,
    // re-fetch it live from the DB. This prevents generating a link for the
    // full trip amount when a prior payment was recorded AFTER the trip was
    // last loaded (i.e. the cached existingTrip has a stale payments_total). ──
    if (balanceDue === 0) {
      const [freshRow] = await sql`
        SELECT balance_due, payments_total FROM appointments WHERE id = ${id}
      `;
      const freshBalance = Number(freshRow?.balance_due || 0);
      const freshPayments = Number(freshRow?.payments_total || 0);
      if (freshBalance > 0 || freshPayments > 0) {
        balanceDue = freshBalance;
        priorPayments = freshPayments;
        console.log(
          `[PATCH ${id}] Re-fetched balance_due=$${balanceDue}, payments_total=$${priorPayments} from DB (cached values were stale)`,
        );
      }
    }

    const effectivePayMethod =
      updated.payment_method || existingTrip.payment_method || "";
    const isCardPayment = ["Credit Card", "Square", "Square Invoice"].includes(
      effectivePayMethod,
    );

    let invoiceAmount;
    let isPartialBalance = priorPayments > 0;

    if (balanceDue > 0) {
      invoiceAmount = balanceDue;
      console.log(
        `[PATCH ${id}] Using balance_due ($${invoiceAmount}) as invoice amount`,
      );

      // ── CC fee verification for card payments (no prior payments) ───────
      // If balance_due equals the services subtotal exactly, the CC fee was
      // never baked into original_amount. Detect this and add the CC fee now.
      if (isCardPayment && priorPayments === 0) {
        const svcTotal = svcRows.reduce(
          (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
          0,
        );

        console.log(
          `[PATCH ${id}] CC fee check: svcTotal=$${svcTotal}, invoiceAmount=$${invoiceAmount}, isCardPayment=${isCardPayment}`,
        );

        if (svcTotal > 0) {
          const ccFeeRows =
            await sql`SELECT value FROM settings WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'`;
          const ccFeePercent =
            ccFeeRows.length > 0 ? Number(ccFeeRows[0].value) : 4;
          const ccFee = Math.round((svcTotal * ccFeePercent) / 100);
          const expectedWithFee = Math.ceil(svcTotal) + ccFee;

          console.log(
            `[PATCH ${id}] CC fee calculation: svcTotal=$${svcTotal}, ccFeePercent=${ccFeePercent}%, ccFee=$${ccFee}, expectedWithFee=$${expectedWithFee}`,
          );

          if (
            ccFee > 0 &&
            Math.abs(invoiceAmount - Math.ceil(svcTotal)) < 1 &&
            Math.abs(invoiceAmount - expectedWithFee) >= 1
          ) {
            console.log(
              `[PATCH ${id}] ⚠️  balance_due $${invoiceAmount} = services only (CC fee $${ccFee} missing). Correcting invoice to $${expectedWithFee}.`,
            );
            invoiceAmount = expectedWithFee;

            // Fix original_amount and balance_due so future calculations stay correct
            await sql`
              UPDATE appointments
              SET original_amount = ${invoiceAmount},
                  balance_due     = ${invoiceAmount}
              WHERE id = ${id}
            `;
            updated.balance_due = invoiceAmount;
            updated.original_amount = invoiceAmount;
            console.log(
              `[PATCH ${id}] Updated original_amount and balance_due to $${invoiceAmount} (includes CC fee $${ccFee})`,
            );
          } else {
            console.log(
              `[PATCH ${id}] CC fee already included or not needed. invoiceAmount=$${invoiceAmount} is correct.`,
            );
          }
        }
      }
      // ── END CC fee verification ─────────────────────────────────────────
    } else {
      // Fallback: calculate from services (should rarely happen)
      const totalAmount = svcRows.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );

      let grandTotal = totalAmount;

      if (isCardPayment && totalAmount > 0) {
        const ccFeeRows = await sql`
          SELECT value FROM settings WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
        `;
        const ccFeePercent =
          ccFeeRows.length > 0 ? Number(ccFeeRows[0].value) : 4;
        const ccFee = Math.round((totalAmount * ccFeePercent) / 100);
        grandTotal = Math.ceil(totalAmount) + ccFee;
      } else {
        grandTotal = Math.ceil(totalAmount);
      }

      // Subtract prior payments in fallback mode
      if (priorPayments > 0) {
        const remaining = grandTotal - priorPayments;
        if (remaining <= 0) {
          console.log(
            `[PATCH ${id}] Trip fully paid (payments_total=$${priorPayments}). Skipping invoice generation.`,
          );
          return;
        }
        invoiceAmount = remaining;
        isPartialBalance = true;
        console.log(
          `[PATCH ${id}] Fallback: Prior payments=$${priorPayments}. Invoice adjusted to $${invoiceAmount} (was $${grandTotal}).`,
        );
      } else {
        invoiceAmount = grandTotal;
      }

      console.log(
        `[PATCH ${id}] Fallback: calculated invoice amount $${invoiceAmount} from services`,
      );
    }

    if (invoiceAmount <= 0) {
      console.log(
        `[PATCH ${id}] Invoice amount is $0 or less. Skipping invoice generation.`,
      );
      return;
    }

    const existingPayments = await sql`
      SELECT id, amount, provider, metadata FROM payments
      WHERE appointment_id = ${id}
      AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const existingPayment =
      existingPayments.length > 0 ? existingPayments[0] : null;

    const paymentMethodToProvider = {
      square: "square",
      "square invoice": "square",
      "credit card": "square",
      venmo: "venmo",
      zelle: "zelle",
    };

    const tripMethod = (updated.payment_method || "").toLowerCase();
    const tripProvider = paymentMethodToProvider[tripMethod];

    const providerChanged =
      existingPayment &&
      tripProvider &&
      existingPayment.provider !== tripProvider;

    if (providerChanged) {
      await supersedePreviousPaymentLinks(id, existingPayment, tripProvider);
    }

    const chosenMethodForCheck = updated.payment_method || "";
    if (
      chosenMethodForCheck.toLowerCase() === "cash" &&
      existingPayment &&
      !providerChanged
    ) {
      await handleCashPaymentSwitch(id, existingPayment);
    }

    const amountChanged =
      existingPayment &&
      Math.abs(Number(existingPayment.amount) - invoiceAmount) > 0.001;

    const needsNewLink = !existingPayment || amountChanged;

    if (amountChanged) {
      await cancelAndSupersedePayment(id, existingPayment);
    }

    if (needsNewLink && invoiceAmount > 0) {
      const chosenMethod = updated.payment_method || "Square";
      let paymentGenerated = false;

      console.log(
        `[PATCH ${id}] Generating payment link: method="${chosenMethod}", invoiceAmount=$${invoiceAmount}`,
      );

      if (chosenMethod.toLowerCase() === "cash") {
        console.log(
          `[PATCH ${id}] Payment method is Cash — skipping payment link generation`,
        );
      } else if (
        chosenMethod === "Square Invoice" ||
        chosenMethod === "Credit Card" ||
        chosenMethod === "Square"
      ) {
        // ── ALL Square payment methods now generate Square Invoice ──
        console.log(
          `[PATCH ${id}] Calling generateSquareInvoicePayment with invoiceAmount=$${invoiceAmount}`,
        );
        paymentGenerated = await generateSquareInvoicePayment(
          id,
          updated,
          invoiceAmount,
          svcRows,
          isPartialBalance,
        );
      } else if (chosenMethod === "Venmo") {
        paymentGenerated = await generateVenmoPayment(id, invoiceAmount);
      } else if (chosenMethod === "Zelle") {
        paymentGenerated = await generateZellePayment(id, invoiceAmount);
      }

      if (paymentGenerated) {
        await sql`UPDATE appointments SET payment_status = 'link_created', payment_amount = ${invoiceAmount} WHERE id = ${id}`;
        updated.payment_status = "link_created";
        updated.payment_amount = invoiceAmount;
      }
    }
  } catch (payErr) {
    console.error(
      `[Auto-Payment] PATCH payment link generation failed for trip #${id}:`,
      payErr.message,
    );
  }
}
