import sql from "@/app/api/utils/sql";
import { createSquarePaymentLink } from "../../providers/square.js";

/**
 * POST /api/payments/square/invoice
 *
 * Creates a Square Checkout Link for an appointment and stores the payment link.
 * (Renamed from "invoice" but kept for backward compatibility)
 *
 * Body: { appointment_id: number, disable_tipping?: boolean }
 * Returns: { success, publicUrl, checkoutId, amount }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { appointment_id, disable_tipping } = body;

    if (!appointment_id) {
      return Response.json(
        { error: "appointment_id is required" },
        { status: 400 },
      );
    }

    // ── Fetch trip + client info ─────────────────────────────────────────
    const tripRows = await sql`
      SELECT a.*,
              c.name  AS client_name,
              c.email AS client_email,
              c.phone AS client_phone
       FROM appointments a
       LEFT JOIN clients c ON a.client_id = c.id
       WHERE a.id = ${appointment_id} AND a.tenant_id = 1
    `;

    if (tripRows.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }
    const trip = tripRows[0];

    // ── Check for existing active invoice/link ───────────────────────────
    const existingLinks = await sql`
      SELECT id, payment_url, amount FROM payments
       WHERE appointment_id = ${appointment_id}
         AND provider = 'square'
         AND status IN ('pending', 'link_created')
       ORDER BY created_at DESC
       LIMIT 1
    `;

    // NOTE: We intentionally do NOT block on existing links here yet —
    // we first need to know balance_due to compare amounts.
    // The stale-link check happens below after balance_due is calculated.

    // ── Fetch services for the trip ──────────────────────────────────────
    const services = await sql`
      SELECT aserv.*, s.name as service_name
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${appointment_id}
    `;

    const servicesSubtotal = services.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    // ── Calculate the invoice amount — READ-ONLY from trip record ────────
    // NEVER alter balance_due, original_amount, or payment_amount.
    // Trip financial fields are managed exclusively by Edit Trip.
    let balanceDue = Number(trip.balance_due || 0);

    // If balance_due is not set, fall back to services calculation
    if (balanceDue <= 0 && servicesSubtotal > 0) {
      const priorPayments = Number(trip.payments_total || 0);
      const originalAmount = Number(trip.original_amount || 0);

      if (originalAmount > 0) {
        balanceDue = Math.max(0, originalAmount - priorPayments);
      } else {
        balanceDue = Math.max(0, Math.ceil(servicesSubtotal) - priorPayments);
      }

      console.log(
        `[Square Invoice] Trip #${appointment_id}: balance_due was 0, calculated fallback=$${balanceDue}`,
      );
    }

    if (balanceDue <= 0) {
      return Response.json(
        { error: "Trip has no balance due" },
        { status: 400 },
      );
    }

    // ── Stale-link check: compare existing amount to current balance_due ──
    if (existingLinks.length > 0) {
      const existingAmount = Number(existingLinks[0].amount || 0);
      if (Math.abs(existingAmount - balanceDue) < 0.5) {
        // Amount matches — reuse existing link
        console.log(
          `[Square Invoice] Trip #${appointment_id}: Existing link amount $${existingAmount} matches balance_due $${balanceDue} — reusing`,
        );
        return Response.json(
          {
            error: "An active Square payment link already exists for this trip",
            existingUrl: existingLinks[0].payment_url,
          },
          { status: 409 },
        );
      }
      // Amount mismatch (stale link) — supersede old link and create fresh one
      console.log(
        `[Square Invoice] Trip #${appointment_id}: Existing link amount $${existingAmount} ≠ balance_due $${balanceDue} — superseding stale link`,
      );
      await sql`
        UPDATE payments SET status = 'superseded'
        WHERE id = ${existingLinks[0].id}
      `;
    }

    const totalAmount = balanceDue;
    const creditCardFee = 0; // CC fee is already included in balance_due if applicable

    console.log(
      `[Square Invoice] Trip #${appointment_id}: Creating invoice for $${totalAmount} (services=$${servicesSubtotal})`,
    );

    // ── Build consistent description: Trip #, Date, Destination ──────────
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
    const descParts = [`Trip #${trip.booking_number || "Trip"}`];
    if (tripDate) descParts.push(tripDate);
    if (trip.destination) descParts.push(trip.destination);
    const consistentDesc = descParts.join(" — ");

    // ── Create Square Checkout Link (better tip support than invoices) ──
    const {
      url,
      externalReferenceId,
      metadata: squareMetadata,
    } = await createSquarePaymentLink({
      trip,
      amount: totalAmount,
      customerInfo: {
        name: trip.client_name,
        email: trip.client_email,
        phone: trip.client_phone,
      },
      disableTipping: disable_tipping || false,
    });

    // ── Persist to payments table ────────────────────────────────────────
    await sql`
      INSERT INTO payments (
         appointment_id, provider, status, amount, currency,
         payment_url, external_reference_id, metadata
       ) VALUES (
         ${appointment_id}, 'square', 'link_created', ${totalAmount}, 'USD',
         ${url}, ${externalReferenceId}, ${JSON.stringify({
           type: "checkout",
           checkout_id: externalReferenceId,
           order_id: squareMetadata.order_id,
           balance_due: totalAmount,
           credit_card_fee: creditCardFee,
           services_subtotal: servicesSubtotal,
         })}
       )
    `;

    // Only update payment_status — NEVER touch financial fields
    await sql`
      UPDATE appointments 
      SET payment_status = 'link_created'
      WHERE id = ${appointment_id}
    `;

    return Response.json({
      success: true,
      publicUrl: url,
      checkoutId: externalReferenceId,
      amount: totalAmount,
      credit_card_fee: creditCardFee,
      services_subtotal: servicesSubtotal,
    });
  } catch (error) {
    console.error("Square checkout link creation failed:", error);
    return Response.json(
      { error: error.message || "Failed to create Square checkout link" },
      { status: 500 },
    );
  }
}
