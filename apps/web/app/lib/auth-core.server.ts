import { createHash, randomBytes } from "node:crypto";
import { verify, hash, argon2id } from "argon2";
import { createCookie } from "react-router";
import type { Pool } from "pg";

export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
let dummyHash: Promise<string> | undefined;
export type SignedInUser = { id: string; email: string; name: string | null };

export function createAuth(db: Pick<Pool, "query">, secret: string, secure: boolean) {
  if (secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  const cookie = createCookie(secure ? "__Host-car_session" : "car_session", {
    httpOnly: true, secure, sameSite: "lax", path: "/", secrets: [secret],
  });
  const tokenFrom = async (request: Request): Promise<string | null> => {
    try {
      const value: unknown = await cookie.parse(request.headers.get("Cookie"));
      return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : null;
    } catch { return null; }
  };
  return {
    async signIn(email: string, password: string) {
      // Atomic account-level throttle shared across Vercel instances. Never store raw emails/IPs here.
      const key = digest(email);
      const attempt = await db.query(`
        INSERT INTO app_login_attempts (key, attempts, started_at) VALUES ($1, 1, now())
        ON CONFLICT (key) DO UPDATE SET
          attempts = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes'
            THEN 1 ELSE app_login_attempts.attempts + 1 END,
          started_at = CASE WHEN app_login_attempts.started_at < now() - interval '15 minutes'
            THEN now() ELSE app_login_attempts.started_at END
        RETURNING attempts`, [key]);
      if (attempt.rows[0].attempts > 10) return { kind: "limited" } as const;
      const result = await db.query(`
        SELECT u.id::text AS id, u.email, u.name, a.password
        FROM auth_users u JOIN auth_accounts a ON a."userId"::text = u.id::text
        WHERE lower(u.email) = $1 AND a.provider = 'credentials'
        LIMIT 1`, [email]);
      const user = result.rows[0];
      dummyHash ??= hash(randomBytes(32), { type: argon2id });
      let valid = false;
      try { valid = await verify(user?.password || await dummyHash, password); }
      catch { /* An invalid stored hash must not grant access. */ }
      if (!user || !valid) return { kind: "invalid" } as const;
      const token = randomBytes(32).toString("hex");
      await db.query(`INSERT INTO app_login_sessions (token_hash, user_id, expires_at)
        VALUES ($1, $2, now() + interval '7 days')`, [digest(token), user.id]);
      await db.query("DELETE FROM app_login_attempts WHERE key = $1", [key]);
      return { kind: "success", cookie: await cookie.serialize(token, { maxAge: SESSION_SECONDS }) } as const;
    },
    async getUser(request: Request): Promise<SignedInUser | null> {
      const token = await tokenFrom(request);
      if (!token) return null;
      const result = await db.query(`
        SELECT u.id::text AS id, u.email, u.name FROM app_login_sessions s
        JOIN auth_users u ON u.id::text = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`, [digest(token)]);
      return result.rows[0] ?? null;
    },
    async signOut(request: Request) {
      const token = await tokenFrom(request);
      if (token) await db.query("DELETE FROM app_login_sessions WHERE token_hash = $1", [digest(token)]);
      return cookie.serialize("", { maxAge: 0, expires: new Date(0) });
    },
  };
}

export function requireSameOrigin(request: Request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) {
    throw new Response("Forbidden", { status: 403, headers: { "Cache-Control": "no-store" } });
  }
}
