import pg from "pg";
import { logAuthFailure } from "./auth-diagnostics.server";
import { createAuth } from "./auth-core.server";

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!auth) {
    const { DATABASE_URL, AUTH_SECRET } = process.env;
    if (!DATABASE_URL || !AUTH_SECRET) throw new Error("Database authentication is not configured.");
    // Use your provider's pooled connection URL, including its required TLS settings.
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3,
      idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, allowExitOnIdle: true });
    auth = createAuth(pool, AUTH_SECRET, process.env.NODE_ENV === "production");
  }
  return auth;
}
export function authUnavailable(error: unknown) {
  logAuthFailure(error);
  return new Response("Sign-in is temporarily unavailable. Please try again later.", {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
}
