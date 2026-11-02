import pg from "pg";
import { logAuthFailure } from "./auth-diagnostics.server";
import { createAuth } from "./auth-core.server";

let auth: ReturnType<typeof createAuth> | undefined;
let pool: pg.Pool | undefined;
let metadataLogged = false;
export function getAuth() {
  if (!auth) {
    const { DATABASE_URL, AUTH_SECRET } = process.env;
    if (!DATABASE_URL || !AUTH_SECRET) throw new Error("Database authentication is not configured.");
    // Use your provider's pooled connection URL, including its required TLS settings.
    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3,
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

// Temporary Preview-only investigation. Reads catalog metadata, never user rows.
export async function logPreviewSchema() {
  if (process.env.VERCEL_ENV !== "preview" || !pool || metadataLogged) return;
  metadataLogged = true;
  try {
    const { rows } = await pool.query(`SELECT
      count(*)::integer AS public_table_count,
      md5(coalesce(string_agg(tablename, ',' ORDER BY tablename), '')) AS schema_fingerprint,
      coalesce(bool_or(tablename = 'auth_users'), false) AS has_auth_users,
      coalesce(bool_or(tablename = 'auth_accounts'), false) AS has_auth_accounts,
      coalesce(bool_or(tablename = 'app_login_sessions'), false) AS has_login_sessions,
      coalesce(bool_or(tablename = 'app_login_attempts'), false) AS has_login_attempts
      FROM pg_catalog.pg_tables WHERE schemaname = 'public'`);
    const row = rows[0];
    console.info("Preview database schema check", {
      publicTableCount: Number(row.public_table_count),
      schemaFingerprint: /^[a-f0-9]{32}$/.test(row.schema_fingerprint) ? row.schema_fingerprint : "unavailable",
      authUsers: row.has_auth_users === true,
      authAccounts: row.has_auth_accounts === true,
      loginSessions: row.has_login_sessions === true,
      loginAttempts: row.has_login_attempts === true,
    });
  } catch (error) { logAuthFailure(error); }
}

export function getDatabase(): pg.Pool {
  getAuth();
  return pool!;
}
