import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { hash, argon2id } from "argon2";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL locally first.");
if (!process.stdin.isTTY) throw new Error("Run interactively; passwords must not be passed as command arguments.");
let hidden = false;
const output = new Writable({ write(chunk, _encoding, callback) {
  if (!hidden) process.stdout.write(chunk);
  callback();
} });
const terminal = createInterface({ input: process.stdin, output, terminal: true });
let email = "", name = "", password = "";
try {
  email = (await terminal.question("Email: ")).trim().toLowerCase();
  name = (await terminal.question("Display name: ")).trim();
  process.stdout.write("Password (hidden, minimum 12 characters): ");
  hidden = true;
  password = await terminal.question("");
  process.stdout.write("\nConfirm password (hidden): ");
  const confirmation = await terminal.question("");
  process.stdout.write("\n");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email.");
  if (password.length < 12 || password.length > 1024 || password !== confirmation) throw new Error("Passwords must match and contain 12–1024 characters.");
} finally { terminal.close(); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  const passwordHash = await hash(password, { type: argon2id });
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [email]);
  const existing = await client.query("SELECT id FROM auth_users WHERE lower(email) = $1", [email]);
  if (existing.rowCount) throw new Error("Account already exists; no changes made.");
  const result = await client.query("INSERT INTO auth_users (email, name) VALUES ($1, $2) RETURNING id", [email, name || null]);
  const id = result.rows[0].id;
  await client.query(`INSERT INTO auth_accounts ("userId", type, provider, "providerAccountId", password)
    VALUES ($1, 'credentials', 'credentials', $2, $3)`, [id, String(id), passwordHash]);
  await client.query("COMMIT");
  console.log("Account created. You can now sign in.");
} catch {
  await client.query("ROLLBACK");
  console.error("Account not created. Check for an existing account, database connectivity and schema compatibility.");
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
