import { getDatabase } from "./auth.server";
import { createPasswordReset } from "./password-reset-core.server";

export function requirePreviewReset() {
  if (process.env.VERCEL_ENV !== "preview") throw new Response("Not found", { status: 404 });
}
export function getPasswordReset() {
  requirePreviewReset();
  const key = process.env.RESEND_KEY;
  const host = process.env.VERCEL_URL;
  if (!key || !host || !/^[a-zA-Z0-9.-]+\.vercel\.app$/.test(host)) throw new Error("Preview reset configuration missing");
  return createPasswordReset(getDatabase(), async (email, link) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Catch A Ride <noreply@catcharide.us>", to: [email],
        subject: "Reset your Catch A Ride TEST account password",
        text: `This resets your development/test account only, not your live account.\n\nOpen this link within 15 minutes:\n${link}\n\nIf you did not request this, ignore this email.` }),
    });
    // Never log response bodies: they can contain recipient addresses or request details.
    if (!response.ok) throw new Error("Email service rejected request");
  }, `https://${host}`);
}
