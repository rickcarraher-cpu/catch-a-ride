import { useEffect, useState } from "react";
import { Form, Link, data, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { requireSameOrigin } from "../lib/auth-core.server";
import { getPasswordReset, requirePreviewReset } from "../lib/password-reset.server";
export function loader() { requirePreviewReset(); return null; }
export async function action({ request }: ActionFunctionArgs) {
  requirePreviewReset(); requireSameOrigin(request);
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405 });
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 1024 || password !== form.get("confirmation")) {
    return data({ ok: false, message: "Passwords must match and contain 12–1024 characters." }, { status: 400 });
  }
  try {
    if (await getPasswordReset().complete(token, password)) {
      return data({ ok: true, message: "Your test account password has changed. Sign in with your new password." });
    }
    return data({ ok: false, message: "This link is invalid, expired or already used. Request a new link." }, { status: 400 });
  } catch {
    console.error("Preview password reset completion unavailable; check database schema and connectivity.");
    return data({ ok: false, message: "Password reset is temporarily unavailable. Try again later." }, { status: 503 });
  }
}
export default function ResetPassword() {
  const [token, setToken] = useState("");
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  useEffect(() => {
    setToken(window.location.hash.slice(1));
    // Remove the secret from browser address/history after capturing it in memory.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  return <main className="signin-shell"><section className="signin-card">
    <p className="brand">Catch A Ride · Preview only</p><h1>Set new password</h1>
    {result && <p role="status">{result.message}</p>}
    {!result?.ok && (token ? <Form method="post">
      <input type="hidden" name="token" value={token} />
      <label htmlFor="new-password">New test password</label>
      <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} />
      <label htmlFor="confirm-password">Confirm password</label>
      <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} />
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save test password"}</button>
    </Form> : <p>Open the complete link from your reset email.</p>)}
    <p><Link to="/account/signin">Sign In</Link> · <Link to="/account/forgot-password">Request another link</Link></p>
  </section></main>;
}
export function headers() { return { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }; }
