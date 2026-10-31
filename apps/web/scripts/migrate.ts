import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in your local environment first.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(await readFile(new URL("../db/001-auth.sql", import.meta.url), "utf8"));
  console.log("Authentication schema is ready. Existing auth users/accounts were preserved.");
} catch {
  console.error("Migration failed. Check database connectivity, permissions and existing schema compatibility.");
  process.exitCode = 1;
} finally { await pool.end(); }
