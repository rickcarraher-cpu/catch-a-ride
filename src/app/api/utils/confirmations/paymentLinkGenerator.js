/**
 * Payment Link Generation
 * Auto-generates payment links for trips based on payment method
 */

import sql from "@/app/api/utils/sql";
import { getBaseUrl } from "./settingsHelpers.js";
import { createSquarePaymentLink } from "@/app/api/payments/providers/square.js";

/**
 * Auto-generate a payment link for a trip if one doesn't exist (or if the
 * existing link was created at the wrong amount).
 */
export async function generatePaymentLinkIfNeeded(trip, balance) {
  // Never generate for already-paid trips
  if (trip.payment_status === "paid") {
    console.log(
      `[generatePaymentLink] Skipping — trip #${trip.id} is already paid`,
    );
    return null;
  }

  // Never generate for tentative/quote trips
  if (trip.is_tentative) {
    console.log(
      `[generatePaymentLink] Skipping — trip #${trip.id} is tentative/quote`,
    );
    return null;
  }

  const paymentMethodLower = (trip.payment_method || "").toLowerCase();

  const isPayable =
    paymentMethodLower.includes("square") ||
    paymentMethodLower.includes("card") ||
    paymentMethodLower.includes("credit") ||
    paymentMethodLower.includes("venmo") ||
    paymentMethodLower.includes("zelle");

  if (!isPayable || balance <= 0) {
    console.log(
      `[generatePaymentLink] Skipping — method="${trip.payment_method}", balance=$${balance}`,
    );
    return null;
  }

  // ── Load settings early — needed for CC fee calculation ────────────────
  const settingsRows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
  const paySettings = {};
  settingsRows.forEach((r) => {
    paySettings[r.key] = r.value;
  });

  // ── Calculate the CORRECT expected total BEFORE checking existing links ─
  // For Square / Credit Card: use trip.original_amount (which has the CC fee
  // baked in) minus any payments already received. Fall back to
  // services-subtotal + CC-fee only when original_amount is not set.
  let expectedTotal = balance; // default (Venmo / Zelle)
  let servicesRows = [];
  let servicesSubtotal = 0;
  let customerCcFee = 0;

  const isSquareOrCard =
    paymentMethodLower.includes("square") ||
    paymentMethodLower.includes("card") ||
    paymentMethodLower.includes("credit");

  if (isSquareOrCard) {
    const tripOriginalAmount = Number(trip.original_amount || 0);
    const tripPaymentsTotal = Number(trip.payments_total || 0);

    if (tripOriginalAmount > 0) {
      // original_amount is the authoritative total (set by admin, includes CC fee)
      expectedTotal = Math.max(0, tripOriginalAmount - tripPaymentsTotal);
      console.log(
        `[generatePaymentLink] Using original_amount ($${tripOriginalAmount}) - payments ($${tripPaymentsTotal}) = $${expectedTotal}`,
      );
    } else {
      // No original_amount yet — derive from services + CC fee
      servicesRows = await sql`
        SELECT service_price, quantity
        FROM appointment_services
        WHERE appointment_id = ${trip.id}
      `;
      servicesSubtotal = servicesRows.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );
      const feePercent = Number(paySettings.credit_card_fee_percent || 4);
      customerCcFee = Math.round((servicesSubtotal * feePercent) / 100);
      expectedTotal = Math.ceil(servicesSubtotal) + customerCcFee;
      console.log(
        `[generatePaymentLink] Calculated from services: subtotal=$${servicesSubtotal}, ccFee=$${customerCcFee}, total=$${expectedTotal}`,
      );

      // NOTE: Do NOT persist original_amount here.
      // Trip financial fields (original_amount, balance_due, etc.) are managed
      // exclusively by Edit Trip / the appointments route.
    }
  }

  if (expectedTotal <= 0) {
    console.log(
      `[generatePaymentLink] Expected total is $0 or less. Skipping for trip #${trip.id}`,
    );
    return null;
  }

  // ── Check for existing payment link — validate the stored amount ────────
  const existing = await sql`
    SELECT payment_url, amount FROM payments
    WHERE appointment_id = ${trip.id}
      AND status IN ('pending', 'link_created', 'manual_pending')
    ORDER BY created_at DESC LIMIT 1
  `;

  if (existing.length > 0 && existing[0].payment_url) {
    const existingAmount = Number(existing[0].amount || 0);
    if (Math.abs(existingAmount - expectedTotal) < 0.5) {
      console.log(
        `[generatePaymentLink] Existing link at correct amount ($${existingAmount}) for trip #${trip.id} — reusing`,
      );
      return existing[0].payment_url;
    }
    // Amount mismatch — supersede the stale link so we create a fresh one
    console.log(
      `[generatePaymentLink] ⚠️  Existing link amount $${existingAmount} ≠ expected $${expectedTotal} — superseding stale link for trip #${trip.id}`,
    );
    await sql`
      UPDATE payments
      SET status = 'superseded'
      WHERE appointment_id = ${trip.id}
        AND status IN ('pending', 'link_created', 'manual_pending')
    `;
  }

  // ── Create a new payment link at expectedTotal ──────────────────────────
  const grandTotal = expectedTotal;

  try {
    // Venmo
    if (paymentMethodLower.includes("venmo")) {
      const venmoHandle = paySettings.venmo_handle;
      const venmoEnabled = paySettings.payment_venmo_enabled === "true";
      if (venmoEnabled && venmoHandle) {
        const cleanHandle = venmoHandle.replace(/^@/, "");
        const bookingNum = trip.booking_number || trip.id;
        const note = encodeURIComponent(
          `${trip.client_name || "Transportation"} - Trip #${bookingNum}`,
        );
        const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${grandTotal.toFixed(2)}&note=${note}`;
        const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${grandTotal.toFixed(2)}&note=${note}`;
        await sql(
          `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
           VALUES ($1, 'venmo', 'link_created', $2, 'USD', $3, $4)`,
          [
            trip.id,
            grandTotal,
            venmoWebUrl,
            JSON.stringify({
              venmo_app_url: venmoAppUrl,
              venmo_web_url: venmoWebUrl,
              venmo_handle: cleanHandle,
              auto_generated: true,
              generated_by: "confirmationService",
            }),
          ],
        );
        console.log(
          `[generatePaymentLink] ✅ Created Venmo link for trip #${trip.id}: ${venmoWebUrl}`,
        );
        return venmoWebUrl;
      }
      console.warn(
        `[generatePaymentLink] Venmo selected but not configured for trip #${trip.id}`,
      );
    }

    // Zelle
    if (paymentMethodLower.includes("zelle")) {
      const zelleContact = paySettings.zelle_contact;
      const zelleEnabled = paySettings.payment_zelle_enabled === "true";
      if (zelleEnabled && zelleContact) {
        const BASE_URL = await getBaseUrl();
        const zelleUrl = `${BASE_URL}/pay/zelle/${trip.id}`;
        const zelleName =
          paySettings.zelle_display_name ||
          process.env.ZELLE_DISPLAY_NAME ||
          "";
        const zellePhone =
          paySettings.zelle_phone || process.env.ZELLE_PHONE || "";
        const looksLikePhone = /^[\d\s\-\(\)\+]+$/.test(zelleContact.trim());
        const zelleEmail = looksLikePhone ? "" : zelleContact;
        const zellePhoneFinal = looksLikePhone ? zelleContact : zellePhone;
        await sql(
          `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
           VALUES ($1, 'zelle', 'manual_pending', $2, 'USD', $3, $4)`,
          [
            trip.id,
            grandTotal,
            zelleUrl,
            JSON.stringify({
              zelle_contact: zelleContact,
              zelle_email: zelleEmail,
              zelle_phone: zellePhoneFinal,
              zelle_name: zelleName,
              auto_generated: true,
              generated_by: "confirmationService",
            }),
          ],
        );
        console.log(
          `[generatePaymentLink] ✅ Created Zelle link for trip #${trip.id}: ${zelleUrl}`,
        );
        return zelleUrl;
      }
      console.warn(
        `[generatePaymentLink] Zelle selected but not configured for trip #${trip.id}`,
      );
    }

    // Square / Credit Card
    if (isSquareOrCard) {
      const accessToken =
        paySettings.square_access_token || process.env.SQUARE_ACCESS_TOKEN;
      const locationId =
        paySettings.square_location_id || process.env.SQUARE_LOCATION_ID;

      if (accessToken && locationId) {
        // Get client info
        const clientRows = trip.client_id
          ? await sql`SELECT name, email, phone FROM clients WHERE id = ${trip.client_id}`
          : [];
        const client = clientRows[0] || {};

        // Fetch services for line items if not already loaded
        if (servicesRows.length === 0) {
          servicesRows = await sql`
            SELECT service_price, quantity
            FROM appointment_services
            WHERE appointment_id = ${trip.id}
          `;
          servicesSubtotal = servicesRows.reduce(
            (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
            0,
          );
          const feePercent = Number(paySettings.credit_card_fee_percent || 4);
          customerCcFee = Math.round((servicesSubtotal * feePercent) / 100);
        }

        // ── Build consistent description: Trip #, Date, Destination ──────
        const tripDate =
          trip.display_short_date ||
          trip.display_long_date ||
          (trip.start_time
            ? new Date(trip.start_time).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "");
        const descParts = [`Trip #${trip.booking_number || trip.id}`];
        if (tripDate) descParts.push(tripDate);
        if (trip.destination) descParts.push(trip.destination);
        const consistentTripDesc = descParts.join(" — ");

        // Build line items — single line with trip info when amount differs from services
        const lineItemsMismatch =
          Math.abs(servicesSubtotal - grandTotal) > 0.01;
        const lineItems = lineItemsMismatch
          ? [
              {
                name: consistentTripDesc,
                quantity: 1,
                amount: grandTotal,
              },
            ]
          : servicesRows.map((s) => ({
              name: "Service",
              quantity: Number(s.quantity || 1),
              amount: Number(s.service_price || 0),
            }));

        // Create Square Checkout Link with tipping enabled
        const {
          url: publicUrl,
          externalReferenceId,
          metadata: squareMeta,
        } = await createSquarePaymentLink({
          trip,
          amount: grandTotal,
          customerInfo: {
            name: client.name,
            email: client.email,
            phone: client.phone,
          },
          disableTipping: false, // always allow tip
        });

        await sql(
          `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, external_reference_id, metadata)
           VALUES ($1, 'square', 'link_created', $2, 'USD', $3, $4, $5)`,
          [
            trip.id,
            grandTotal,
            publicUrl,
            externalReferenceId,
            JSON.stringify({
              type: "checkout",
              checkout_id: externalReferenceId,
              order_id: squareMeta.order_id,
              credit_card_fee: customerCcFee,
              services_subtotal: servicesSubtotal,
              auto_generated: true,
              generated_by: "confirmationService",
            }),
          ],
        );
        console.log(
          `[generatePaymentLink] ✅ Created Square Checkout Link for trip #${trip.id}: ${publicUrl} (total=$${grandTotal}, ccFee=$${customerCcFee})`,
        );
        return publicUrl;
      }
      console.warn(
        `[generatePaymentLink] Square credentials not available for trip #${trip.id}`,
      );
    }
  } catch (err) {
    console.error(
      `[generatePaymentLink] ❌ Failed to generate payment link for trip #${trip.id}:`,
      err.message,
    );
  }

  return null;
}
