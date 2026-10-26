import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    console.log("[Backup] Starting backup process...");

    // List of all tables to backup (excluding auth tables and backup tables themselves)
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
      "sms_messages",
      "conversations",
      "conversation_participants",
      "payments",
      "payment_events",
      "settings",
      "tenants",
      "vehicle_assignments",
      "driver_mileage_approvals",
    ];

    let backupResults = {};

    // Process each table sequentially (DDL operations can't be in standard transactions)
    for (const table of tables) {
      const backupTable = `${table}_backup`;

      // Drop existing backup table if it exists
      await sql(`DROP TABLE IF EXISTS "${backupTable}" CASCADE`);

      // Create backup table as exact copy of original
      await sql(`CREATE TABLE "${backupTable}" AS SELECT * FROM "${table}"`);

      // Get count of backed up records
      const countResult = await sql(
        `SELECT COUNT(*) as count FROM "${backupTable}"`,
      );
      backupResults[table] = parseInt(countResult[0].count);

      console.log(
        `[Backup] Backed up ${backupResults[table]} records from ${table}`,
      );
    }

    const totalRecords = Object.values(backupResults).reduce(
      (sum, count) => sum + count,
      0,
    );

    // Save backup timestamp to settings so status can retrieve it
    const backupTimestamp = new Date().toISOString();
    await sql(
      `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'backup_timestamp', $1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [backupTimestamp],
    );

    // Log details server-side only (keep response small for cron-job.org)
    console.log(`[Backup] Completed: ${totalRecords} total records backed up.`);
    console.log(`[Backup] Details:`, JSON.stringify(backupResults));

    // Return minimal response to avoid cron-job.org "output too large" errors
    return Response.json({
      success: true,
      total_records: totalRecords,
      backup_timestamp: backupTimestamp,
    });
  } catch (err) {
    console.error("[Backup] Error:", err);
    // Return minimal error response (no stack trace) to avoid cron-job.org "output too large"
    return Response.json(
      {
        error: "Failed to create backup: " + err.message,
      },
      { status: 500 },
    );
  }
}
