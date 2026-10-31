import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hash } from "argon2";
import type { Pool } from "pg";
import { createAuth, requireSameOrigin } from "../app/lib/auth-core.server";
import { action } from "../app/account/signin/page";
import { loader as dashboardLoader } from "../app/dashboard/page";

const database = new PGlite();
const driver = { query: (sql: string, params?: unknown[]) => database.query(sql, params) } as unknown as Pick<Pool, "query">;
const secret = "a-test-only-signing-secret-of-at-least-32-characters";
const auth = createAuth(driver, secret, true);
const request = (cookie?: string) => new Request("https://app.example/dashboard", {
  headers: cookie ? { Cookie: cookie.split(";")[0] } : {},
});
const email = "driver@example.test";
const password = "test-only password, never a live credential";

before(async () => {
  const migration = await readFile(new URL("../db/001-auth.sql", import.meta.url), "utf8");
  await database.exec(migration);
  // Re-running the migration must preserve existing data/schema.
  const user = await database.query<{ id: number }>("INSERT INTO auth_users (email, name) VALUES ($1, $2) RETURNING id", [email, "Driver"]);
  await database.query(`INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
    VALUES ($1, 'credentials', 'credentials', $2, $3)`, [user.rows[0].id, String(user.rows[0].id), await hash(password)]);
  await database.exec(migration);
});
after(async () => { await database.close(); });

test("successful login queries existing accounts, signs a secure cookie and persists only a digest", async () => {
  const result = await auth.signIn(email, password);
  assert.equal(result.kind, "success");
  if (result.kind !== "success") return;
  assert.match(result.cookie, /^__Host-car_session=/);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=604800"]) assert.ok(result.cookie.includes(flag));
  const user = await auth.getUser(request(result.cookie));
  assert.equal(user?.email, email);
  const rows = await database.query<{ token_hash: string }>("SELECT token_hash FROM app_login_sessions");
  assert.match(rows.rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.ok(!result.cookie.includes(rows.rows[0].token_hash));
});
test("wrong passwords and unknown users return identical failures", async () => {
  assert.deepEqual(await auth.signIn(email, "wrong password"), { kind: "invalid" });
  assert.deepEqual(await auth.signIn("unknown@example.test", password), { kind: "invalid" });
});
test("SQL-shaped email inputs do not bypass authentication", async () => {
  assert.deepEqual(await auth.signIn("' OR 1=1 --", password), { kind: "invalid" });
});
test("missing, forged and tampered cookies cannot open a session", async () => {
  assert.equal(await auth.getUser(request()), null);
  assert.equal(await auth.getUser(request("__Host-car_session=forged")), null);
  const result = await auth.signIn(email, password);
  assert.equal(result.kind, "success");
  if (result.kind !== "success") return;
  const cookie = result.cookie.split(";")[0];
  assert.equal(await auth.getUser(request(cookie.slice(0, -1) + "x")), null);
  const otherSecret = createAuth(driver, "a-different-signing-secret-with-at-least-32-characters", true);
  assert.equal(await otherSecret.getUser(request(cookie)), null);
});
test("expired database sessions cannot be reused", async () => {
  const result = await auth.signIn(email, password);
  if (result.kind !== "success") assert.fail("Expected successful login");
  await database.query("UPDATE app_login_sessions SET expires_at = now() - interval '1 second'");
  assert.equal(await auth.getUser(request(result.cookie)), null);
});
test("logout revokes the server session even if the original cookie is replayed", async () => {
  const result = await auth.signIn(email, password);
  if (result.kind !== "success") assert.fail("Expected successful login");
  const clear = await auth.signOut(request(result.cookie));
  assert.match(clear, /Max-Age=0/);
  assert.equal(await auth.getUser(request(result.cookie)), null);
});
test("account-level rate limits persist across auth instances and reset after the window", async () => {
  const limitedEmail = "limited@example.test";
  for (let i = 0; i < 10; i++) assert.equal((await auth.signIn(limitedEmail, password)).kind, "invalid");
  const otherInstance = createAuth(driver, secret, true);
  assert.equal((await otherInstance.signIn(limitedEmail, password)).kind, "limited");
  await database.query("UPDATE app_login_attempts SET started_at = now() - interval '16 minutes'");
  assert.equal((await otherInstance.signIn(limitedEmail, password)).kind, "invalid");
});
test("localhost sessions can work without HTTPS, production cookies cannot", async () => {
  const local = createAuth(driver, secret, false);
  const result = await local.signIn(email, password);
  if (result.kind !== "success") assert.fail("Expected successful login");
  assert.match(result.cookie, /^car_session=/);
  assert.ok(!result.cookie.includes("Secure"));
});
test("cross-origin and origin-less submissions are rejected", () => {
  for (const origin of [undefined, "https://attacker.example"]) {
    assert.throws(() => requireSameOrigin(new Request("https://app.example/account/signin", {
      method: "POST", headers: origin ? { Origin: origin } : {},
    })), (error: unknown) => error instanceof Response && error.status === 403);
  }
  assert.doesNotThrow(() => requireSameOrigin(new Request("https://app.example/account/signin", {
    method: "POST", headers: { Origin: "https://app.example" },
  })));
});
test("malformed login submissions return validation errors without touching a database", async () => {
  const response = await action({ request: new Request("https://app.example/account/signin", {
    method: "POST", headers: { Origin: "https://app.example" }, body: new URLSearchParams({ email: "invalid", password: "" }),
  }), params: {}, context: {}, unstable_pattern: "" });
  assert.equal((response as { init: { status: number } }).init.status, 400);
});
test("missing environment variables fail closed with a friendly service error", async () => {
  const oldDatabase = process.env.DATABASE_URL;
  const oldSecret = process.env.AUTH_SECRET;
  delete process.env.DATABASE_URL; delete process.env.AUTH_SECRET;
  try {
    const response = await action({ request: new Request("https://app.example/account/signin", {
      method: "POST", headers: { Origin: "https://app.example" }, body: new URLSearchParams({ email, password }),
    }), params: {}, context: {}, unstable_pattern: "" });
    assert.equal((response as { init: { status: number } }).init.status, 503);
  } finally {
    if (oldDatabase !== undefined) process.env.DATABASE_URL = oldDatabase;
    if (oldSecret !== undefined) process.env.AUTH_SECRET = oldSecret;
  }
});
test("dashboard redirects signed-out visitors and does not cache personalized data", async () => {
  const response = await dashboardLoader({ request: request(), params: {}, context: {}, unstable_pattern: "" });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/account/signin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
test("short signing secrets are rejected", () => {
  assert.throws(() => createAuth(driver, "short", true), /AUTH_SECRET/);
});
