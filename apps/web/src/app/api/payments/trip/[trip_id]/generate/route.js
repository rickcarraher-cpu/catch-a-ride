import sql from "@/app/api/utils/sql";
import { createSquarePaymentLink } from "../../../providers/square";
import { createVenmoPaymentLink } from "../../../providers/braintree-venmo";
import { createZellePaymentInstructions } from "../../../providers/zelle";

export async function POST(request, { params }) {
  const { trip_id } = params;
  const body = await request.json();
  const { provider, disable_tipping } = body;

  if (!provider || !["square", "venmo", "zelle"].includes(provider)) {
    return Response.json(
      { error: "Invalid provider. Must be square, venmo, or zelle" },
      { status: 400 },
    );
  }

  try {
    const [trip] = await sql`
      SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${trip_id}
    `;

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.payment_method && trip.payment_method.toLowerCase() === "cash") {
      return Response.json(
        {
          error:
            "This trip is set to Cash payment. Online payment links cannot be generated for cash transactions. Change the payment method to generate a link.",
        },
        { status: 400 },
      );
    }

    if (trip.payment_status === "paid") {
      return Response.json(
        {
          error:
            "This trip has already been paid. Cannot generate a new payment link.",
        },
        { status: 400 },
      );
    }

    const services = await sql`
      SELECT aserv.*, s.name as service_name
      FROM appointment_services aserv
      JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${trip_id}
    `;

    // ── READ-ONLY: Determine the invoice amount from the trip record ──
    // NEVER alter balance_due, original_amount, or payment_amount on the trip.
    // The trip's financial fields are managed exclusively by Edit Trip.
    const balanceDue = Number(trip.balance_due || 0);
    const servicesSubtotal = services.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    let totalAmount;
    let creditCardFee = 0;

    if (balanceDue > 0) {
      // Use balance_due as-is — it already reflects the correct amount the customer owes
      totalAmount = balanceDue;
      console.log(
        `[Generate] Using balance_due ($${totalAmount}) as invoice amount for trip #${trip_id}`,
      );
    } else {
      // Fallback: calculate from services (should rarely happen)
      totalAmount = servicesSubtotal > 0 ? Math.ceil(servicesSubtotal) : 0;

      // If there's an original_amount set, prefer that
      if (Number(trip.original_amount || 0) > 0) {
        totalAmount = Number(trip.original_amount);
      }

      // Subtract any prior payments
      const paymentsTotal = Number(trip.payments_total || 0);
      if (paymentsTotal > 0 && paymentsTotal < totalAmount) {
        totalAmount = totalAmount - paymentsTotal;
      }

      console.log(
        `[Generate] Fallback: calculated amount for trip #${trip_id}: $${totalAmount}`,
      );
    }

    if (totalAmount <= 0) {
      return Response.json(
        { error: "Trip amount must be greater than zero" },
        { status: 400 },
      );
    }

    const existingPayments = await sql`
      SELECT * FROM payments
      WHERE appointment_id = ${trip_id}
      AND status IN ('pending', 'link_created', 'manual_pending')
      AND provider = ${provider}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingPayments.length > 0) {
      const existing = existingPayments[0];
      if (Math.abs(Number(existing.amount) - totalAmount) < 0.001) {
        return Response.json({
          payment: existing,
          message: "Using existing payment link",
        });
      }
      await sql`
        UPDATE payments SET status = 'superseded'
        WHERE id = ${existing.id}
      `;
      console.log(
        `[Generate] Superseded old payment #${existing.id} ($${existing.amount}) for trip #${trip_id} — new amount: $${totalAmount}`,
      );
    }

    let paymentData;

    if (provider === "square") {
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

      paymentData = {
        url,
        externalReferenceId,
        metadata: {
          type: "checkout",
          checkout_id: externalReferenceId,
          order_id: squareMetadata.order_id,
          services_subtotal: servicesSubtotal,
        },
      };
    } else if (provider === "venmo") {
      paymentData = await createVenmoPaymentLink({
        trip,
        amount: totalAmount,
        customerInfo: {
          name: trip.client_name,
          email: trip.client_email,
          phone: trip.client_phone,
        },
      });
    } else if (provider === "zelle") {
      paymentData = await createZellePaymentInstructions({
        trip,
        amount: totalAmount,
      });
    }

    const [payment] = await sql`
      INSERT INTO payments (
        appointment_id, provider, status, amount, currency,
        payment_url, external_reference_id, metadata
      ) VALUES (
        ${trip_id}, ${provider},
        ${provider === "zelle" ? "manual_pending" : "link_created"},
        ${totalAmount}, 'USD',
        ${paymentData.url}, ${paymentData.externalReferenceId},
        ${JSON.stringify(paymentData.metadata)}
      )
      RETURNING *
    `;

    // Only update payment_status — NEVER touch financial fields (balance_due, original_amount, payment_amount)
    await sql`
      UPDATE appointments
      SET payment_status = ${provider === "zelle" ? "manual_pending" : "link_created"}
      WHERE id = ${trip_id}
    `;

    return Response.json({
      payment,
      message: "Payment link created successfully",
    });
  } catch (error) {
    console.error("Error generating payment link:", error);
    return Response.json(
      { error: error.message || "Failed to generate payment link" },
      { status: 500 },
    );
  }
}
