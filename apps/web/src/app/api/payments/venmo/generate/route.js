import sql from "@/app/api/utils/sql";

/**
 * POST /api/payments/venmo/generate
 * Generate Venmo payment link for a trip - creates a payment record and returns a hosted checkout URL
 */
export async function POST(request) {
  try {
    const { trip_id } = await request.json();

    if (!trip_id) {
      return Response.json({ error: "trip_id is required" }, { status: 400 });
    }

    // Get settings
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const venmoHandle = settings.venmo_handle;
    const venmoEnabled = settings.payment_venmo_enabled === "true";

    if (!venmoEnabled || !venmoHandle) {
      return Response.json(
        {
          error:
            "Venmo is not configured. Please add your Venmo handle in Settings.",
        },
        { status: 400 },
      );
    }

    // Fetch appointment details
    const [appointment] = await sql`
      SELECT a.*, c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.id = ${trip_id} AND a.tenant_id = 1
    `;

    if (!appointment) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    // Get services to calculate total
    const services = await sql`
      SELECT aserv.*, s.name as service_name
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${trip_id}
    `;

    const grandTotal = services.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    // Check if payment already exists
    const existingPayments = await sql`
      SELECT id, payment_url FROM payments
      WHERE appointment_id = ${trip_id}
      AND provider = 'venmo'
      AND status IN ('pending', 'link_created')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existingPayments.length > 0 && existingPayments[0].payment_url) {
      // Return existing link
      return Response.json({
        payment_url: existingPayments[0].payment_url,
        amount: grandTotal,
        payment_id: existingPayments[0].id,
        note: "Existing payment link returned",
      });
    }

    // Generate Venmo payment URL
    // Format: venmo://paycharge?txn=pay&recipients=username&amount=100.00&note=Name%20-%20Booking
    const cleanHandle = venmoHandle.replace(/^@/, ""); // Remove @ if present
    const bookingNum = appointment.booking_number || trip_id;
    const note = encodeURIComponent(
      `${appointment.client_name || "Transportation"} - Trip #${bookingNum}`,
    );
    const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${grandTotal.toFixed(2)}&note=${note}`;

    // Also create a web fallback URL
    const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${grandTotal.toFixed(2)}&note=${note}`;

    // Create or update payment record
    const [payment] = await sql`
      INSERT INTO payments (
        appointment_id,
        provider,
        status,
        amount,
        currency,
        payment_url,
        metadata
      ) VALUES (
        ${trip_id},
        'venmo',
        'link_created',
        ${grandTotal},
        'USD',
        ${venmoWebUrl},
        ${JSON.stringify({
          venmo_app_url: venmoAppUrl,
          venmo_web_url: venmoWebUrl,
          venmo_handle: cleanHandle,
          booking_number: appointment.booking_number,
        })}
      )
      ON CONFLICT (id) DO UPDATE SET
        payment_url = ${venmoWebUrl},
        amount = ${grandTotal},
        metadata = ${JSON.stringify({
          venmo_app_url: venmoAppUrl,
          venmo_web_url: venmoWebUrl,
          venmo_handle: cleanHandle,
          booking_number: appointment.booking_number,
        })}
      RETURNING *
    `;

    return Response.json({
      payment_url: venmoWebUrl,
      venmo_app_url: venmoAppUrl,
      amount: grandTotal,
      payment_id: payment.id,
      venmo_handle: `@${cleanHandle}`,
    });
  } catch (error) {
    console.error("Failed to generate Venmo payment link:", error);
    return Response.json(
      { error: "Failed to generate Venmo payment link" },
      { status: 500 },
    );
  }
}
