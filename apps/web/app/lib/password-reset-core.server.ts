import { createHash, randomBytes } from "node:crypto";
import { hash, argon2id } from "argon2";
import type { Pool } from "pg";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const RESET_MESSAGE = "If this email has a sign-in account, a reset link will arrive shortly. Check your spam folder too.";
export const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export function createPasswordReset(db: Pick<Pool, "query">, send: (email: string, link: string) => Promise<void>, origin: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password) throw new Error("Invalid reset origin");
  return {
    async request(email: string) {
      email = email.trim().toLowerCase();
      // Separate reset throttle: three emails per normalized account per 15 minutes.
      const key = "reset:" + digest(email);
      const attempt = await db.query(`INSERT INTO app_login_attempts (key, attempts, started_at)
        VALUES ($1, 1, now()) ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes' THEN 1 ELSE app_login_attempts.attempts + 1 END,
        started_at = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes' THEN now() ELSE app_login_attempts.started_at END
        RETURNING attempts`, [key]);
      if (attempt.rows[0].attempts > 3) return;
      // Global email budget also limits abuse with many different email inputs.
      const budget = await db.query(`INSERT INTO app_login_attempts (key, attempts, started_at)
        VALUES ('reset:global', 1, now()) ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes' THEN 1 ELSE app_login_attempts.attempts + 1 END,
        started_at = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes' THEN now() ELSE app_login_attempts.started_at END
        RETURNING attempts`);
      if (budget.rows[0].attempts > 20) return;
      const token = randomBytes(32).toString("hex");
      const result = await db.query(`INSERT INTO app_password_resets (token_hash, user_id, expires_at)
        SELECT $1, u.id::text, now() + interval '15 minutes' FROM auth_users u
        WHERE lower(u.email) = $2 AND EXISTS (
          SELECT 1 FROM auth_accounts a WHERE a."userId"::text = u.id::text AND a.provider = 'credentials'
        ) ON CONFLICT (user_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at RETURNING user_id`, [digest(token), email]);
      if (!result.rowCount) return;
      const link = new URL("/account/reset-password", base.origin);
      // Fragment is not sent in GET requests, Referer headers or URL access logs.
      link.hash = token;
      try { await send(email, link.href); }
      catch {
        await db.query("DELETE FROM app_password_resets WHERE token_hash = $1", [digest(token)]);
        throw new Error("Reset email delivery unavailable");
      }
    },
    async complete(token: string, password: string): Promise<boolean> {
      if (!validToken(token) || password.length < 12 || password.length > 1024) return false;
      const active = await db.query("SELECT 1 FROM app_password_resets WHERE token_hash = $1 AND expires_at > now()", [digest(token)]);
      if (!active.rowCount) return false;
      const passwordHash = await hash(password, { type: argon2id });
      // One statement consumes a token once, updates credentials and revokes sessions atomically.
      const result = await db.query(`WITH consumed AS (
        DELETE FROM app_password_resets WHERE token_hash = $1 AND expires_at > now() RETURNING user_id
      ), updated AS (
        UPDATE auth_accounts a SET password = $2 FROM consumed c
        WHERE a."userId"::text = c.user_id AND a.provider = 'credentials' RETURNING a."userId"::text AS user_id
      ), sessions AS (
        DELETE FROM app_login_sessions WHERE user_id IN (SELECT user_id FROM updated)
      ), attempts AS (
        DELETE FROM app_login_attempts WHERE key IN (
          SELECT encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
          FROM auth_users u JOIN updated a ON u.id::text = a.user_id
        )
      ) SELECT user_id FROM updated`, [digest(token), passwordHash]);
      return !!result.rowCount;
    },
  };
}
