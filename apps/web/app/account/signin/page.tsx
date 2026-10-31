import { useState } from "react";
import { Form, data, redirect, useActionData, useNavigation } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { logAuthFailure } from "../../lib/auth-diagnostics.server";
import { getAuth } from "../../lib/auth.server";
import { requireSameOrigin } from "../../lib/auth-core.server";

const noStoreHeaders = { "Cache-Control": "no-store" };
export async function action({ request }: ActionFunctionArgs) {
  requireSameOrigin(request);
  if (request.method !== "POST") throw new Response("Method not allowed", { status: 405 });
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 1024) {
    return data({ error: "Enter a valid email and password." }, { status: 400, headers: noStoreHeaders });
  }
  let result;
  try { result = await getAuth().signIn(email, password); }
  catch (error) {
    logAuthFailure(error);
    return data({ error: "Sign-in is temporarily unavailable. Please try again later." }, { status: 503, headers: noStoreHeaders });
  }
  if (result.kind === "limited") {
    return data({ error: "Too many attempts. Try again in 15 minutes." }, {
      status: 429, headers: { ...noStoreHeaders, "Retry-After": "900" },
    });
  }
  if (result.kind === "invalid") return data({ error: "Invalid email or password." }, { status: 401, headers: noStoreHeaders });
  return redirect("/dashboard", { headers: { ...noStoreHeaders, "Set-Cookie": result.cookie } });
}

export default function SignInPage() {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return (
    <main className="signin-shell">
      <section className="signin-card" aria-labelledby="signin-title">
        <p className="brand">Catch A Ride</p>
        <h1 id="signin-title">{step === "email" ? "Welcome" : "Sign In"}</h1>
        <p>{step === "email" ? "Enter your email to sign in." : "Enter your password."}</p>
        {result?.error && <p role="alert" className="error">{result.error}</p>}
        {step === "email" ? (
          <form onSubmit={(event) => { event.preventDefault(); setStep("password"); }}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} />
            <button type="submit">Continue</button>
          </form>
        ) : (
          <Form method="post">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" type="email" name="email" autoComplete="username" value={email} readOnly />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" name="password" autoComplete="current-password" required maxLength={1024} autoFocus />
            <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button>
            <button className="secondary" type="button" disabled={busy} onClick={() => setStep("email")}>← Back to Email</button>
          </Form>
        )}
      </section>
    </main>
  );
}

export function headers() { return { "Cache-Control": "no-store" }; }
