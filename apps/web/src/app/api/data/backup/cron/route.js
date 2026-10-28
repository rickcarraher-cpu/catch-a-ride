import sql from "@/app/api/utils/sql";

// Allow up to 5 minutes — prevents Vercel from killing the job mid-backup
export const maxDuration = 300;

/**
 * Daily Backup Cron Endpoint
 *
 * Should be called by a cron job at 5 PM CDT daily.
 * Performs a full database backup and sets the notification flag.
 *
 * Cron schedule (UTC): 0 22 * * *  (10 PM UTC = 5 PM CDT)
 *
 * ⚠️ NOTE: Vercel Cron Jobs send GET requests to the configured path.
 * Both GET and POST handlers are provided:
 *  - GET: Used by Vercel's scheduled cron runner
 *  - POST: Used for manual triggers or external cron services
 */

// ✅ GET handler: Vercel cron jobs send GET requests
export async function GET(request) {
  return handleBackup();
}

// ✅ POST handler: for manual triggers
export async function POST(request) {
  return handleBackup();
}

async function handleBackup() {
  try {
    console.log(`[Backup Cron] Starting daily backup...`);

    const tables = [
      "appointments",
      "appointment_services",
      "clients",
      "employees",
      "vehicles",
      "services",
      "blocked_times",
      "working_hours",
      "recurring_appointments",
      "transactions",
      "invoices",
      "payments",
      "settings",
      "tenants",
      "vehicle_assignments",
      "driver_mileage_approvals",
    ];

    let totalRecords = 0;
    const tableErrors = [];

    for (const table of tables) {
      try {
        const backupTable = `${table}_backup`;
        await sql(`DROP TABLE IF EXISTS "${backupTable}" CASCADE`);
        await sql(`CREATE TABLE "${backupTable}" AS SELECT * FROM "${table}"`);
        const countResult = await sql(
          `SELECT COUNT(*) as cnt FROM "${backupTable}"`,
        );
        const count = parseInt(countResult[0].cnt);
        totalRecords += count;
        console.log(`[Backup Cron] ✓ ${table}: ${count} records`);
      } catch (tableErr) {
        console.error(
          `[Backup Cron] ✗ Failed to backup table "${table}":`,
          tableErr.message,
        );
        tableErrors.push({ table, error: tableErr.message });
      }
    }

    const backupTimestamp = new Date().toISOString();

    await sql(
      `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'backup_timestamp', $1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [backupTimestamp],
    );

    await sql(
      `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'daily_backup_completed', $1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [backupTimestamp],
    );

    await sql(
      `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'last_cron_success', $1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [backupTimestamp],
    );

    if (tableErrors.length > 0) {
      await sql(
        `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'last_cron_error', $1)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [JSON.stringify({ timestamp: backupTimestamp, tableErrors })],
      );
    } else {
      // Clear any previous error when backup fully succeeds
      await sql(
        `DELETE FROM settings WHERE tenant_id = 1 AND key = 'last_cron_error'`,
      );
    }

    console.log(
      `[Backup Cron] Completed: ${totalRecords} records backed up. Errors: ${tableErrors.length}`,
    );

    return Response.json({
      success: true,
      total_records: totalRecords,
      backup_timestamp: backupTimestamp,
      table_errors: tableErrors.length > 0 ? tableErrors : undefined,
    });
  } catch (err) {
    console.error("[Backup Cron] Fatal error:", err.message);

    try {
      await sql(
        `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'last_cron_error', $1)
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [
          JSON.stringify({
            timestamp: new Date().toISOString(),
            error: err.message,
          }),
        ],
      );
    } catch (logErr) {
      console.error("[Backup Cron] Failed to log error:", logErr.message);
    }

    return Response.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
