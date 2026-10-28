/**
 * Square Payment Provider
 * Handles payment link generation and webhook processing for Square
 */
import { createHmac } from "crypto";

const SQUARE_BASE_URL =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";

const SQUARE_API_VERSION = "2026-05-20";

/**
 * Extract the first valid email from a string that may contain multiple emails
 * separated by commas, semicolons, spaces, or slash characters.
 * Returns undefined if no valid email is found.
 */
function extractFirstEmail(emailStr) {
  if (!emailStr || typeof emailStr !== "string") return undefined;
  // Split on common separators: comma, semicolon, space, pipe, slash
  const candidates = emailStr
    .split(/[,;\s|\/]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const candidate of candidates) {
    if (emailRegex.test(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Cancel a Square order to invalidate its payment link
 * @param {string} orderId - Square order ID
 * @returns {Promise<void>}
 */
export async function cancelSquareOrder(orderId) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Square access token not configured");
  }

  if (!orderId) {
    console.warn("[cancelSquareOrder] No order ID provided, skipping");
    return;
  }

  console.log(`[cancelSquareOrder] Cancelling Square order: ${orderId}`);

  try {
    // First, get the current order version
    const getRes = await fetch(`${SQUARE_BASE_URL}/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
    });

    if (!getRes.ok) {
      const err = await getRes.json();
      console.error(`[cancelSquareOrder] Failed to get order ${orderId}:`, err);
      return; // Don't throw - this is a cleanup operation
    }

    const getData = await getRes.json();
    const version = getData.order?.version;

    if (!version) {
      console.warn(`[cancelSquareOrder] No version found for order ${orderId}`);
      return;
    }

    // Now cancel the order
    const cancelBody = {
      idempotency_key: `cancel-${orderId}-${Date.now()}`,
      version: version,
    };

    const cancelRes = await fetch(
      `${SQUARE_BASE_URL}/orders/${orderId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Square-Version": SQUARE_API_VERSION,
        },
        body: JSON.stringify(cancelBody),
      },
    );

    if (!cancelRes.ok) {
      const err = await cancelRes.json();
      console.error(
        `[cancelSquareOrder] Failed to cancel order ${orderId}:`,
        err,
      );
      return;
    }

    console.log(`[cancelSquareOrder] Successfully cancelled order: ${orderId}`);
  } catch (error) {
    console.error(
      `[cancelSquareOrder] Error cancelling order ${orderId}:`,
      error.message,
    );
    // Don't throw - this is a cleanup operation and shouldn't block the main flow
  }
}

export async function createSquarePaymentLink({
  trip,
  amount,
  customerInfo,
  disableTipping = false,
}) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    throw new Error("Square credentials not configured");
  }

  const amountInCents = Math.round(amount * 100);
  console.log(
    `[createSquarePaymentLink] Trip #${trip.id}: amount=$${amount}, amountInCents=${amountInCents}`,
  );

  const idempotencyKey = `trip-${trip.id}-${Date.now()}`;

  // Get the base URL for redirects
  const baseUrl =
    process.env.NEXT_PUBLIC_CREATE_APP_URL || "https://your-domain.com";

  // ── Build consistent description: Trip #, Date, Destination ─────────
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
  const descParts = [`Trip #${trip.booking_number || "Booking"}`];
  if (tripDate) descParts.push(tripDate);
  if (trip.destination) descParts.push(trip.destination);
  const consistentTripDesc = descParts.join(" — ");

  // Use order-based format (NOT quick_pay) so checkout_options like allow_tipping work
  const checkoutBody = {
    idempotency_key: idempotencyKey,
    order: {
      location_id: locationId,
      line_items: [
        {
          name: consistentTripDesc,
          quantity: "1",
          base_price_money: {
            amount: amountInCents, // Convert to cents
            currency: "USD",
          },
        },
      ],
    },
    checkout_options: {
      allow_tipping: !disableTipping,
      redirect_url: `${baseUrl}/payment-complete`,
      ask_for_shipping_address: false,
    },
    pre_populated_data: {
      buyer_email: extractFirstEmail(customerInfo?.email),
    },
  };

  console.log(
    `[createSquarePaymentLink] Sending to Square:`,
    JSON.stringify(checkoutBody, null, 2),
  );

  const response = await fetch(
    `${SQUARE_BASE_URL}/online-checkout/payment-links`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
      body: JSON.stringify(checkoutBody),
    },
  );

  if (!response.ok) {
    const error = await response.json();
    console.error("Square API error:", error);
    throw new Error(
      error.errors?.[0]?.detail || "Failed to create Square payment link",
    );
  }

  const data = await response.json();
  console.log(
    `[createSquarePaymentLink] Square response URL: ${data.payment_link?.url}`,
  );

  return {
    url: data.payment_link?.url,
    externalReferenceId: data.payment_link?.id,
    metadata: {
      order_id: data.payment_link?.order_id,
      checkout_id: data.payment_link?.id,
    },
  };
}

export function verifySquareWebhook(body, signature) {
  const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

  if (!webhookSignatureKey) {
    if (process.env.SQUARE_ENVIRONMENT === "production") {
      console.error(
        "Square webhook signature key not configured in production — rejecting webhook",
      );
      return false;
    }
    console.warn(
      "Square webhook signature key not configured — allowing in non-production",
    );
    return true;
  }

  // Square uses HMAC SHA256 for webhook signatures
  const hmac = createHmac("sha256", webhookSignatureKey);
  hmac.update(body);
  const computedSignature = hmac.digest("base64");

  return computedSignature === signature;
}

export function parseSquareWebhook(payload) {
  const event = payload.data;
  const eventType = payload.type;

  return {
    eventId: event.id,
    type: eventType,
    data: event,
  };
}

export function mapSquareEventToStatus(eventType) {
  // Map Square webhook events to internal payment statuses
  const statusMap = {
    "payment.created": "pending",
    "payment.updated": "pending",
    "order.created": "pending",
    "order.updated": "link_created",
    "order.payment.completed": "paid",
    "payment.completed": "paid",
    "invoice.payment_made": "paid",
    "payment.failed": "failed",
    "payment.canceled": "cancelled",
  };

  return statusMap[eventType] || "pending";
}

/**
 * Find an existing Square customer by email, or create one if not found.
 * Returns the Square customer_id.
 */
async function findOrCreateSquareCustomer({ name, email, phone, accessToken }) {
  const cleanedEmail = extractFirstEmail(email);

  // 1. Try to search by email first
  if (cleanedEmail) {
    const searchRes = await fetch(`${SQUARE_BASE_URL}/customers/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
      body: JSON.stringify({
        query: {
          filter: {
            email_address: { exact: cleanedEmail },
          },
        },
      }),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const existing = searchData.customers?.[0];
      if (existing?.id) {
        console.log(
          `[Square] Found existing customer ${existing.id} for email ${cleanedEmail}`,
        );

        // ── Ensure the Square customer name matches the current trip passenger ──
        // Multiple clients can share an email. If the name on the Square record
        // doesn't match the passenger for this trip, update it so the invoice
        // shows the correct name.
        if (name) {
          const nameParts = name.trim().split(/\s+/);
          const wantGiven = nameParts[0] || "";
          const wantFamily =
            nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
          const existingGiven = (existing.given_name || "").trim();
          const existingFamily = (existing.family_name || "").trim();

          if (
            wantGiven.toLowerCase() !== existingGiven.toLowerCase() ||
            wantFamily.toLowerCase() !== existingFamily.toLowerCase()
          ) {
            console.log(
              `[Square] Customer name mismatch: Square has "${existingGiven} ${existingFamily}", trip needs "${name}". Updating...`,
            );
            try {
              // Re-fetch the customer to get the latest version (avoids stale version conflicts)
              const refetchRes = await fetch(
                `${SQUARE_BASE_URL}/customers/${existing.id}`,
                {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Square-Version": SQUARE_API_VERSION,
                  },
                },
              );
              const latestVersion = refetchRes.ok
                ? (await refetchRes.json()).customer?.version
                : existing.version;

              const updateRes = await fetch(
                `${SQUARE_BASE_URL}/customers/${existing.id}`,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                    "Square-Version": SQUARE_API_VERSION,
                  },
                  body: JSON.stringify({
                    given_name: wantGiven,
                    family_name: wantFamily || undefined,
                    version: latestVersion,
                  }),
                },
              );
              if (updateRes.ok) {
                console.log(
                  `[Square] Updated customer ${existing.id} name to "${name}"`,
                );
                return existing.id;
              } else {
                const updateErr = await updateRes.json();
                console.warn(
                  `[Square] Failed to update customer name (will create new customer instead):`,
                  updateErr,
                );
                // Fall through to create a new customer below so the invoice
                // definitely shows the correct name
              }
            } catch (updateError) {
              console.warn(
                `[Square] Error updating customer name (will create new customer instead):`,
                updateError.message,
              );
              // Fall through to create a new customer below
            }
          } else {
            // Name matches — safe to use this customer
            return existing.id;
          }
        } else {
          return existing.id;
        }
      }
    }
  }

  // 2. Create a new Square customer
  // This also handles the case where the name update above failed —
  // we create a fresh customer with the correct name so the invoice is accurate.
  const nameParts = (name || "").trim().split(/\s+/);
  const givenName = nameParts[0] || "Customer";
  const familyName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const createBody = {
    idempotency_key: `customer-${cleanedEmail || phone || name}-${Date.now()}`,
    given_name: givenName,
    family_name: familyName || undefined,
    email_address: cleanedEmail || undefined,
    phone_number: phone || undefined,
  };

  const createRes = await fetch(`${SQUARE_BASE_URL}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error("[Square] Failed to create customer:", err);
    // Don't throw — return null so invoice creation can still proceed without customer_id
    return null;
  }

  const createData = await createRes.json();
  const customerId = createData.customer?.id;
  console.log(
    `[Square] Created new customer ${customerId} for ${cleanedEmail || name}`,
  );
  return customerId;
}

/**
 * Create a Square Invoice, publish it, and return the public payment URL.
 *
 * Flow: Create Invoice → Publish → return public_url
 *
 * @param {Object}  params
 * @param {Object}  params.trip          – appointment row
 * @param {number}  params.amount        – total in dollars
 * @param {Object}  params.customerInfo  – { name, email, phone }
 * @param {Array}   params.lineItems     – [{ name, quantity, amount }]
 * @param {number}  [params.dueDays=7]   – days until due
 * @returns {Promise<{ invoiceId, publicUrl, orderId, version }>}
 */
export async function createSquareInvoice({
  trip,
  amount,
  customerInfo,
  lineItems = [],
  dueDays = 7,
  disableTipping = false,
}) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) {
    throw new Error(
      "Square credentials not configured (SQUARE_ACCESS_TOKEN / SQUARE_LOCATION_ID)",
    );
  }

  const idempotencyKey = `inv-trip-${trip.id}-${Date.now()}`;

  // ── Find or create Square customer to get customer_id ─────────────────
  const customerId = await findOrCreateSquareCustomer({
    name: customerInfo.name,
    email: customerInfo.email,
    phone: customerInfo.phone,
    accessToken,
  });

  // ── Build a consistent description: Trip #, Date, Destination ─────────
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

  // ── Build order line items ─────────────────────────────────────────────
  const orderLineItems =
    lineItems.length > 0
      ? lineItems.map((item) => ({
          name: item.name,
          quantity: String(item.quantity || 1),
          base_price_money: {
            amount: Math.round(Number(item.amount) * 100),
            currency: "USD",
          },
        }))
      : [
          {
            name: consistentTripDesc,
            quantity: "1",
            base_price_money: {
              amount: Math.round(amount * 100),
              currency: "USD",
            },
          },
        ];

  // ── Build primary recipient ────────────────────────────────────────────
  // When customer_id is present, Square derives all other fields from the
  // customer record. Setting them manually causes a "derived field" error.
  let primaryRecipient;
  if (customerId) {
    primaryRecipient = { customer_id: customerId };
  } else {
    // No Square customer — fall back to manual fields
    primaryRecipient = {};
    const cleanedEmail = extractFirstEmail(customerInfo.email);
    if (cleanedEmail) primaryRecipient.email_address = cleanedEmail;
    if (customerInfo.phone) primaryRecipient.phone_number = customerInfo.phone;
    if (customerInfo.name) {
      const parts = customerInfo.name.trim().split(/\s+/);
      primaryRecipient.given_name = parts[0];
      if (parts.length > 1)
        primaryRecipient.family_name = parts.slice(1).join(" ");
    }
  }

  // ── Due date ───────────────────────────────────────────────────────────
  const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // ── 1. Create the Order first ──────────────────────────────────────────
  const orderBody = {
    idempotency_key: `order-${idempotencyKey}`,
    order: {
      location_id: locationId,
      line_items: orderLineItems,
      reference_id: `trip-${trip.id}`,
    },
  };

  const orderRes = await fetch(`${SQUARE_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify(orderBody),
  });

  if (!orderRes.ok) {
    const errBody = await orderRes.json();
    console.error("Square create-order error:", errBody);
    throw new Error(
      errBody.errors?.[0]?.detail || "Failed to create Square order",
    );
  }

  const orderData = await orderRes.json();
  const orderId = orderData.order?.id;

  if (!orderId) {
    throw new Error("Square did not return an order ID");
  }

  // ── 2. Create Invoice referencing the order ────────────────────────────
  const createBody = {
    idempotency_key: idempotencyKey,
    invoice: {
      location_id: locationId,
      order_id: orderId,
      primary_recipient: primaryRecipient,
      payment_requests: [
        {
          request_type: "BALANCE",
          due_date: dueDate,
          automatic_payment_source: "NONE",
          tipping_enabled: !disableTipping,
        },
      ],
      delivery_method: "SHARE_MANUALLY",
      accepted_payment_methods: {
        card: true,
        square_gift_card: false,
        bank_account: false,
        buy_now_pay_later: false,
      },
      invoice_number: `${trip.booking_number}-${Date.now().toString(36).toUpperCase()}`,
      title: `Trip Payment — ${consistentTripDesc}`,
      description: consistentTripDesc,
    },
  };

  const createRes = await fetch(`${SQUARE_BASE_URL}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const errBody = await createRes.json();
    console.error("Square create-invoice error:", errBody);
    throw new Error(
      errBody.errors?.[0]?.detail || "Failed to create Square invoice",
    );
  }

  const createData = await createRes.json();
  const invoiceId = createData.invoice?.id;
  const invoiceVersion = createData.invoice?.version;

  if (!invoiceId) {
    throw new Error("Square did not return an invoice ID");
  }

  // ── 2. Publish Invoice → get public_url ────────────────────────────────
  const publishRes = await fetch(
    `${SQUARE_BASE_URL}/invoices/${invoiceId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Square-Version": SQUARE_API_VERSION,
      },
      body: JSON.stringify({
        version: invoiceVersion,
        idempotency_key: `pub-${idempotencyKey}`,
      }),
    },
  );

  if (!publishRes.ok) {
    const errBody = await publishRes.json();
    console.error("Square publish-invoice error:", errBody);
    throw new Error(
      errBody.errors?.[0]?.detail || "Failed to publish Square invoice",
    );
  }

  const publishData = await publishRes.json();
  const publicUrl = publishData.invoice?.public_url;

  if (!publicUrl) {
    throw new Error("Square did not return a public URL after publishing");
  }

  return {
    invoiceId,
    publicUrl,
    orderId,
    version: publishData.invoice?.version,
  };
}
