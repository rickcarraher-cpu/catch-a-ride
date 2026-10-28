import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const { trip_id, disable_tipping } = await request.json();

    if (!trip_id) {
      return Response.json({ error: "trip_id is required" }, { status: 400 });
    }

    // Get Square credentials from settings
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const accessToken = settings.square_access_token;
    const locationId = settings.square_location_id;
    const environment = settings.square_environment || "sandbox";
    const feePercent = Number(settings.credit_card_fee_percent || 4);

    if (!accessToken || !locationId) {
      return Response.json(
        { error: "Square is not configured" },
        { status: 400 },
      );
    }

    // Fetch appointment
    const [appointment] = await sql`
      SELECT a.*, c.name as client_name, c.email as client_email
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${trip_id} AND a.tenant_id = 1
    `;

    if (!appointment) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Calculate subtotal from services (used as fallback only)
    const services = await sql`
      SELECT aserv.*, s.name as service_name
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${trip_id}
    `;

    const servicesSubtotal = services.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    // ── Use balance_due as the authoritative charge amount ────────────────
    // balance_due already accounts for prior payments and any fees.
    // Only fall back to services-based calculation if balance_due is not set.
    let grandTotal = Number(appointment.balance_due || 0);
    let creditCardFee = 0;

    if (grandTotal <= 0 && servicesSubtotal > 0) {
      creditCardFee = Math.round((servicesSubtotal * feePercent) / 100);
      const priorPayments = Number(appointment.payments_total || 0);
      const originalAmount = Number(appointment.original_amount || 0);
      if (originalAmount > 0) {
        grandTotal = Math.max(0, originalAmount - priorPayments);
      } else {
        grandTotal = Math.max(
          0,
          Math.ceil(servicesSubtotal) + creditCardFee - priorPayments,
        );
      }
      console.log(
        `[Square Link] Trip #${trip_id}: balance_due was 0, fallback grandTotal=$${grandTotal}`,
      );
    }

    if (grandTotal <= 0) {
      return Response.json(
        { error: "Trip has no balance due" },
        { status: 400 },
      );
    }

    console.log(
      `[Square Link] Trip #${trip_id}: balance_due=$${grandTotal} (services subtotal=$${servicesSubtotal})`,
    );

    // Build a single "Balance Due" line item for the exact balance owed
    const lineItems = [
      {
        name: `Balance Due — Trip #${appointment.booking_number || trip_id}`,
        quantity: "1",
        base_price_money: {
          amount: Math.round(grandTotal * 100),
          currency: "USD",
        },
      },
    ];

    const squareApiUrl =
      environment === "production"
        ? "https://connect.squareup.com"
        : "https://connect.squareupsandbox.com";

    // Get the base URL for redirects
    const baseUrl =
      process.env.NEXT_PUBLIC_CREATE_APP_URL || "https://your-domain.com";

    // Create payment link using order format (not quick_pay) so redirect_url works
    const response = await fetch(
      `${squareApiUrl}/v2/online-checkout/payment-links`,
      {
        method: "POST",
        headers: {
          "Square-Version": "2024-12-18",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idempotency_key: `link-${trip_id}-${Date.now()}`,
          order: {
            location_id: locationId,
            line_items: lineItems,
          },
          checkout_options: {
            allow_tipping: disable_tipping ? false : true,
            redirect_url: `${baseUrl}/payment-complete`,
            ask_for_shipping_address: false,
          },
          pre_populated_data: {
            buyer_email: appointment.client_email || undefined,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Square link error:", errorData);
      return Response.json(
        { error: "Failed to create payment link" },
        { status: 500 },
      );
    }

    const data = await response.json();
    const paymentLink = data.payment_link?.url;
    const linkId = data.payment_link?.id;
    const orderId = data.payment_link?.order_id;

    if (!paymentLink) {
      return Response.json(
        { error: "No payment link returned" },
        { status: 500 },
      );
    }

    // Update appointment
    await sql`
      UPDATE appointments
      SET square_checkout_id = ${linkId},
          payment_status = 'pending',
          payment_amount = ${grandTotal}
      WHERE id = ${trip_id}
    `;

    // Insert payment record so webhook can find it by order_id
    await sql`
      INSERT INTO payments (
        appointment_id, provider, status, amount, currency,
        payment_url, external_reference_id, metadata
      ) VALUES (
        ${trip_id}, 
        'square',
        'link_created',
        ${grandTotal}, 
        'USD',
        ${paymentLink}, 
        ${linkId},
        ${JSON.stringify({ order_id: orderId, checkout_id: linkId, credit_card_fee: creditCardFee, services_subtotal: servicesSubtotal })}::jsonb
      )
    `;

    return Response.json({
      payment_link: paymentLink,
      link_id: linkId,
      amount: grandTotal,
      subtotal: servicesSubtotal,
      credit_card_fee: creditCardFee,
    });
  } catch (error) {
    console.error("Failed to create payment link:", error);
    return Response.json(
      { error: "Failed to create payment link" },
      { status: 500 },
    );
  }
}
