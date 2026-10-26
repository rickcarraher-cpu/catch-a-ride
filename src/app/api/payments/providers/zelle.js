/**
 * Zelle Payment Provider
 * Manual payment tracking - Zelle has no API for automated payment links
 */

export async function createZellePaymentInstructions({ trip, amount }) {
  // Zelle has no API - we just generate an instructions page URL
  // Generate a random hex token without require("crypto")
  const instructionToken = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0"),
  ).join("");

  const instructionsUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/pay/zelle/${trip.id}?token=${instructionToken}`;

  return {
    url: instructionsUrl,
    externalReferenceId: instructionToken,
    metadata: {
      amount: amount,
      instruction_token: instructionToken,
      trip_id: trip.id,
      zelle_email: process.env.ZELLE_EMAIL,
      zelle_phone: process.env.ZELLE_PHONE,
      zelle_name: process.env.ZELLE_DISPLAY_NAME,
    },
  };
}

export function getZelleInstructions() {
  return {
    email: process.env.ZELLE_EMAIL || "payments@example.com",
    phone: process.env.ZELLE_PHONE || "(555) 123-4567",
    displayName: process.env.ZELLE_DISPLAY_NAME || "Your Business Name",
  };
}

// Zelle has no webhooks - payments are manually confirmed by admin
export async function markZellePaidManually({ paymentId, confirmedBy, note }) {
  return {
    status: "paid",
    manually_confirmed_by: confirmedBy,
    manually_confirmed_at: new Date().toISOString(),
    manual_note: note,
    paid_at: new Date().toISOString(),
  };
}
