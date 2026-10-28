import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    // Check if any backup tables exist
    const backupTables = await sql`
      SELECT table_name, 
             pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%_backup'
      ORDER BY table_name
    `;

    if (backupTables.length === 0) {
      return Response.json({
        exists: false,
        message: "No backup found",
      });
    }

    // Get total record counts
    let totalRecords = 0;
    const tableCounts = {};

    for (const table of backupTables) {
      const countResult = await sql(
        'SELECT COUNT(*) as count FROM "' + table.table_name + '"',
      );
      const count = parseInt(countResult[0].count);
      tableCounts[table.table_name.replace("_backup", "")] = count;
      totalRecords += count;
    }

    // Get backup timestamp from settings
    let lastBackup = "Unknown";
    try {
      const tsResult = await sql(
        `SELECT value FROM settings WHERE tenant_id = 1 AND key = 'backup_timestamp' LIMIT 1`,
        [],
      );
      if (tsResult.length > 0 && tsResult[0].value) {
        lastBackup = tsResult[0].value;
      }
    } catch (tsErr) {
      console.warn(
        "[Backup Status] Could not retrieve timestamp:",
        tsErr.message,
      );
    }

    // Count changes made since the last backup across key tables
    let changesSinceBackup = 0;
    if (lastBackup && lastBackup !== "Unknown") {
      try {
        const changesResult = await sql(
          `SELECT
            (SELECT COUNT(*) FROM appointments WHERE created_at > $1) +
            (SELECT COUNT(*) FROM clients WHERE created_at > $1) +
            (SELECT COUNT(*) FROM transactions WHERE created_at > $1) +
            (SELECT COUNT(*) FROM payments WHERE created_at > $1)
           AS total_changes`,
          [lastBackup],
        );
        changesSinceBackup = parseInt(changesResult[0]?.total_changes || 0);
      } catch (chErr) {
        console.warn("[Backup Status] Could not count changes:", chErr.message);
      }
    }

    // Get cron status from settings
    let cronLastSuccess = null;
    let cronLastError = null;
    try {
      const cronSettings = await sql(
        `SELECT key, value FROM settings WHERE tenant_id = 1 AND key IN ('last_cron_success', 'last_cron_error')`,
      );
      for (const row of cronSettings) {
        if (row.key === "last_cron_success") cronLastSuccess = row.value;
        if (row.key === "last_cron_error") {
          try {
            cronLastError = JSON.parse(row.value);
          } catch {
            cronLastError = row.value;
          }
        }
      }
    } catch (cronErr) {
      console.warn(
        "[Backup Status] Could not retrieve cron status:",
        cronErr.message,
      );
    }

    return Response.json({
      exists: true,
      total_records: totalRecords,
      table_counts: tableCounts,
      backup_tables: backupTables.length,
      last_backup: lastBackup,
      changes_since_backup: changesSinceBackup,
      cron_last_success: cronLastSuccess,
      cron_last_error: cronLastError,
    });
  } catch (err) {
    console.error("[Backup Status] Error:", err);
    return Response.json(
      { error: "Failed to get backup status: " + err.message },
      { status: 500 },
    );
  }
}
