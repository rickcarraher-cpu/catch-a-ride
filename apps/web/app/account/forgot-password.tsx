import { Form, Link, data, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { requireSameOrigin } from "../lib/auth-core.server";
import { getPasswordReset, requirePreviewReset } from "../lib/password-reset.server";
import { RESET_MESSAGE } from "../lib/password-reset-core.server";
export function loader() { requirePreviewReset(); return null; }
export async function action({ request }: ActionFunctionArgs) {
  requirePreviewReset(); requireSameOrigin(request);
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405 });
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return data({ message: "Enter a valid email address." }, { status: 400 });
  }
  try { await getPasswordReset().request(email); }
  catch { console.error("Preview password reset request unavailable; check reset schema and email configuration."); }
  // Same response for unknown accounts, throttled requests and delivery errors.
  return data({ message: RESET_MESSAGE });
}
export default function ForgotPassword() {
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return <main className="signin-shell"><section className="signin-card">
    <p className="brand">Catch A Ride · Preview only</p><h1>Reset password</h1>
    <p>This changes your test account, not your live account.</p>
    {result && <p role="status">{result.message}</p>}
    <Form method="post"><label htmlFor="reset-email">Sign-in email</label>
      <input id="reset-email" name="email" type="email" autoComplete="username" required maxLength={254} />
      <button type="submit" disabled={busy}>{busy ? "Requesting…" : "Email reset link"}</button>
    </Form><p><Link to="/account/signin">Back to Sign In</Link></p>
  </section></main>;
}
export function headers() { return { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }; }
