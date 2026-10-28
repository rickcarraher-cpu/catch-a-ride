// ClickSend SMS integration utility

/**
 * Normalize phone number to E.164 format
 */
function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * Send SMS via ClickSend REST API
 *
 * @param {object} opts
 * @param {string} opts.username - ClickSend username
 * @param {string} opts.apiKey - ClickSend API key
 * @param {string} opts.from - Sender ID (alphanumeric or E.164 phone)
 * @param {string} opts.to - Recipient phone number
 * @param {string} opts.message - SMS body
 * @param {string} [opts.source] - ClickSend source identifier (defaults to "anything-limo" for backward compatibility)
 * @returns {Promise<object>} ClickSend API response
 */
export async function sendSmsViaClickSend({
  username,
  apiKey,
  from,
  to,
  message,
  source = "anything-limo", // Tenant-specific via caller, fallback for backward compatibility
}) {
  const e164To = toE164(to);
  if (!e164To) throw new Error("Invalid destination phone number");

  // ClickSend expects Basic Auth with username:apiKey
  const authHeader = `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`;

  const body = {
    messages: [
      {
        source: source, // Now configurable per tenant
        from: from || "CatchARide", // Fallback if from not provided
        to: e164To,
        body: message,
      },
    ],
  };

  const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `ClickSend API error ${response.status}: ${JSON.stringify(err)}`,
    );
  }

  const data = await response.json();

  // ClickSend returns HTTP 200 even on delivery failures.
  // Check the per-message status inside the response body.
  const msgStatus = data?.data?.messages?.[0];
  if (msgStatus && msgStatus.status !== "SUCCESS") {
    const reason = msgStatus.error_text || msgStatus.status || "Unknown error";
    throw new Error(`ClickSend rejected message: ${reason}`);
  }

  return data;
}

/**
 * Verify ClickSend inbound webhook signature (optional, if configured)
 * ClickSend doesn't natively sign webhooks, but you can validate via IP whitelist or custom token
 */
export function verifyClickSendWebhook(request, webhookSecret) {
  // If you configure a custom token in ClickSend webhook settings, validate it here
  const token = request.headers.get("x-clicksend-token");
  if (webhookSecret && token !== webhookSecret) {
    return false;
  }
  return true;
}
