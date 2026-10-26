/**
 * Venmo Payment Provider
 * Generates Venmo payment links using the Venmo handle from settings.
 * No Braintree SDK required — uses Venmo's direct web/app URLs.
 */

import sql from "@/app/api/utils/sql";

export async function createVenmoPaymentLink({ trip, amount, customerInfo }) {
  // Fetch Venmo handle from settings
  const settingsRows =
    await sql`SELECT key, value FROM settings WHERE tenant_id = 1 AND key IN ('venmo_handle', 'payment_venmo_enabled')`;
  const settings = {};
  settingsRows.forEach((r) => {
    settings[r.key] = r.value;
  });

  const venmoHandle = settings.venmo_handle;
  const venmoEnabled = settings.payment_venmo_enabled === "true";

  if (!venmoEnabled || !venmoHandle) {
    throw new Error(
      "Venmo is not configured. Please add your Venmo handle in Settings.",
    );
  }

  const cleanHandle = venmoHandle.replace(/^@/, "");
  const bookingNum = trip.booking_number || trip.id;
  const note = encodeURIComponent(
    `${customerInfo?.name || trip.client_name || "Transportation"} - Trip #${bookingNum}`,
  );

  // Venmo app deep link
  const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${amount.toFixed(2)}&note=${note}`;

  // Venmo web fallback URL
  const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${amount.toFixed(2)}&note=${note}`;

  return {
    url: venmoWebUrl,
    externalReferenceId: `venmo-${trip.id}-${Date.now()}`,
    metadata: {
      venmo_app_url: venmoAppUrl,
      venmo_web_url: venmoWebUrl,
      venmo_handle: cleanHandle,
      booking_number: trip.booking_number,
      amount: amount,
    },
  };
}

export function verifyBraintreeWebhook(payload, signature) {
  return true;
}

export function parseBraintreeWebhook(payload) {
  return {
    eventId: payload.bt_signature || payload.id,
    type: payload.kind,
    data: payload,
  };
}

export function mapBraintreeEventToStatus(eventType) {
  const statusMap = {
    transaction_disbursed: "paid",
    transaction_settled: "paid",
    transaction_settlement_declined: "failed",
    transaction_settled_batch: "paid",
    subscription_charged_successfully: "paid",
  };
  return statusMap[eventType] || "pending";
}
