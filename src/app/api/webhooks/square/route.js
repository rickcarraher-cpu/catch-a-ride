import { POST as mainWebhookHandler } from "../../payments/square/webhook/route";

// Forward to the main Square webhook handler at /api/payments/square/webhook
// We read the body here first and create a fresh Request so the stream
// is never consumed before the main handler gets to call request.text()
export async function POST(request) {
  try {
    const body = await request.text();
    const headers = new Headers(request.headers);

    const freshRequest = new Request(request.url, {
      method: "POST",
      headers,
      body,
    });

    return await mainWebhookHandler(freshRequest);
  } catch (error) {
    console.error(
      "[Square Webhook /api/webhooks/square] Error forwarding:",
      error,
    );
    // Always return 200 to Square to prevent webhook disabling
    return Response.json({ received: true, error: "Processing error logged" });
  }
}
