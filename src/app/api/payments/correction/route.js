import sql from "@/app/api/utils/sql";
import { createSquareInvoice } from "../providers/square";
import {
  recalculatePaymentsAndBalance,
  recalculateDriverCommission,
  recalculateServicesTotal,
} from "@/app/api/utils/cached-calculations";

export async function POST(request) {
  try {
    const body = await request.json();
    const { trip_id, correction_amount, manual_confirm } = body;

    if (
      !trip_id ||
      correction_amount === undefined ||
      correction_amount === null ||
      Number(correction_amount) === 0
    ) {
      return Response.json(
        { error: "trip_id and a non-zero correction_amount are required" },
        { status: 400 },
      );
    }

    const adjustment = Number(correction_amount);

    // ── Fetch trip details ──────────────────────────────────────────────
    const tripRows = await sql`
      SELECT 
        a.id, 
        a.booking_number, 
        a.client_id,
        a.destination,
        a.start_time,
        a.original_amount,
        a.services_total,
        a.display_short_date,
        a.display_long_date,
        c.name AS client_name_from_table,
        c.email AS client_email,
        c.phone AS client_phone
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${trip_id}
    `;

    if (tripRows.length === 0) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const trip = tripRows[0];
    const clientName = trip.client_name_from_table || "Customer";
    const previousAmount = Number(
      trip.original_amount || trip.services_total || 0,
    );
    const newAmount = previousAmount + adjustment;

    if (newAmount < 0) {
      return Response.json(
        {
          error: `Adjustment of $${adjustment.toFixed(2)} would make the trip amount negative ($${newAmount.toFixed(2)}). Current trip amount is $${previousAmount.toFixed(2)}.`,
        },
        { status: 400 },
      );
    }

    // ── Build trip description for invoice ─────────────────────────────
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
    const tripDescription = descParts.join(" — ");

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Find or create the "Price Adjustment" service
    // ═══════════════════════════════════════════════════════════════════
    let adjustmentServiceId;
    const [existingService] = await sql`
      SELECT id FROM services WHERE name = 'Price Adjustment' AND tenant_id = 1 LIMIT 1
    `;
    if (existingService) {
      adjustmentServiceId = existingService.id;
    } else {
      const [newService] = await sql`
        INSERT INTO services (tenant_id, name, description, default_price, duration_minutes, is_variable_price, display_order, is_active, is_addon)
        VALUES (1, 'Price Adjustment', 'Manual price adjustment (+/-)', 0, 0, true, 999, true, true)
        RETURNING id
      `;
      adjustmentServiceId = newService.id;
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Add an appointment_services line item for the adjustment
    // This ensures recalculateServicesTotal stays correct
    // ═══════════════════════════════════════════════════════════════════
    const adjustmentDescription =
      adjustment >= 0
        ? `Price increase +$${adjustment.toFixed(2)}`
        : `Price decrease -$${Math.abs(adjustment).toFixed(2)}`;

    console.log(
      `[PaymentCorrection] Trip #${trip_id}: Adding adjustment service line: ${adjustmentDescription}`,
    );

    await sql`
      INSERT INTO appointment_services (appointment_id, service_id, service_price, duration_minutes, quantity, stop_description)
      VALUES (${trip_id}, ${adjustmentServiceId}, ${adjustment}, 0, 1, ${adjustmentDescription})
    `;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Recalculate services_total from appointment_services
    // This sets both services_total AND we sync original_amount to match
    // ═══════════════════════════════════════════════════════════════════
    const newServicesTotal = await recalculateServicesTotal(trip_id);

    // Sync original_amount to match new services_total
    await sql`
      UPDATE appointments SET original_amount = ${newServicesTotal} WHERE id = ${trip_id}
    `;

    console.log(
      `[PaymentCorrection] Trip #${trip_id}: services_total recalculated to $${newServicesTotal} (was $${previousAmount}, adjustment ${adjustment >= 0 ? "+" : ""}$${adjustment})`,
    );

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Record an "adjustment" transaction for audit trail
    // ═══════════════════════════════════════════════════════════════════
    await sql`
      INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date)
      VALUES (1, ${trip_id}, 'adjustment', 'Adjustment', ${adjustment}, 0, ${null}, CURRENT_DATE)
    `;

    console.log(
      `[PaymentCorrection] Trip #${trip_id}: Recorded adjustment transaction`,
    );

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Recalculate balance and driver commission
    // ═══════════════════════════════════════════════════════════════════
    await recalculatePaymentsAndBalance(trip_id);
    await recalculateDriverCommission(trip_id);

    // ══════════════════════════════════════════════════════════════════
    // MANUAL CONFIRMATION MODE: Just update the trip amount, no link
    // ══════════════════════════════════════════════════════════════════
    if (manual_confirm === true) {
      console.log(
        `[PaymentCorrection] ✅ Trip #${trip_id}: Amount adjusted from $${previousAmount} by ${adjustment >= 0 ? "+" : ""}$${adjustment} → $${newServicesTotal}`,
      );

      return Response.json({
        success: true,
        manually_confirmed: true,
        adjustment,
        previous_amount: previousAmount,
        new_amount: newServicesTotal,
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // LINK MODE: Also create Square Invoice link for the new balance
    // ══════════════════════════════════════════════════════════════════

    // Get the updated balance after the correction
    const [updatedTrip] = await sql`
      SELECT balance_due FROM appointments WHERE id = ${trip_id}
    `;
    const newBalance = Number(updatedTrip?.balance_due || 0);

    if (newBalance <= 0) {
      console.log(
        `[PaymentCorrection] ✅ Trip #${trip_id}: Amount adjusted to $${newServicesTotal}. Balance is $${newBalance} — no payment link needed.`,
      );
      return Response.json({
        success: true,
        adjustment,
        previous_amount: previousAmount,
        new_amount: newServicesTotal,
        balance_due: newBalance,
        message:
          "Trip amount updated. No balance due — payment link not needed.",
      });
    }

    // ── Supersede ALL existing active Square links before creating new one ──
    // This prevents multiple active links with different amounts from coexisting.
    const activeLinks = await sql`
      SELECT id, amount FROM payments
      WHERE appointment_id = ${trip_id}
        AND provider = 'square'
        AND status IN ('pending', 'link_created')
    `;
    for (const link of activeLinks) {
      console.log(
        `[PaymentCorrection] Superseding stale Square link id=${link.id} ($${link.amount}) — new balance is $${newBalance}`,
      );
      await sql`UPDATE payments SET status = 'superseded' WHERE id = ${link.id}`;
    }

    console.log(
      `[PaymentCorrection] Creating Square Invoice for trip #${trip_id}, balance: $${newBalance}`,
    );

    const { invoiceId, publicUrl, orderId } = await createSquareInvoice({
      trip: {
        id: trip.id,
        booking_number: trip.booking_number,
        client_name: clientName,
        destination: trip.destination,
        start_time: trip.start_time,
        display_short_date: trip.display_short_date,
      },
      amount: newBalance,
      customerInfo: {
        name: clientName,
        email: trip.client_email,
        phone: trip.client_phone,
      },
      lineItems: [
        {
          name: `${tripDescription} — Correction`,
          quantity: 1,
          amount: newBalance,
        },
      ],
      disableTipping: false,
    });

    // ── Save payment record ─────────────────────────────────────────────
    await sql`
      INSERT INTO payments (
        appointment_id, 
        provider, 
        status, 
        amount, 
        currency, 
        payment_url, 
        external_reference_id, 
        metadata
      )
      VALUES (
        ${trip_id}, 
        'square', 
        'link_created', 
        ${newBalance}, 
        'USD', 
        ${publicUrl}, 
        ${invoiceId}, 
        ${JSON.stringify({
          type: "invoice",
          invoice_id: invoiceId,
          order_id: orderId,
          correction_payment: true,
          adjustment,
          previous_amount: previousAmount,
          new_amount: newServicesTotal,
          generated_by: "payment_correction_modal",
        })}
      )
    `;

    console.log(
      `[PaymentCorrection] ✅ Trip #${trip_id}: Amount adjusted from $${previousAmount} → $${newServicesTotal}. Square Invoice for balance $${newBalance}: ${publicUrl}`,
    );

    return Response.json({
      success: true,
      payment_url: publicUrl,
      invoice_id: invoiceId,
      adjustment,
      previous_amount: previousAmount,
      new_amount: newServicesTotal,
      balance_due: newBalance,
    });
  } catch (error) {
    console.error("[PaymentCorrection] Error:", error);
    return Response.json(
      { error: error.message || "Failed to process payment correction" },
      { status: 500 },
    );
  }
}
