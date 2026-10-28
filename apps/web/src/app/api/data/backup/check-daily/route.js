import sql from "@/app/api/utils/sql";

/**
 * Check if a new daily backup has been completed
 * Returns the timestamp if a new backup exists that hasn't been acknowledged
 */
export async function GET(request) {
  try {
    // Get the daily backup completion timestamp
    const result = await sql(
      `SELECT value FROM settings WHERE tenant_id = 1 AND key = 'daily_backup_completed' LIMIT 1`,
    );

    if (result.length === 0 || !result[0].value) {
      return Response.json({
        has_new_backup: false,
      });
    }

    const backupTimestamp = result[0].value;

    // Check if this backup has been acknowledged
    const ackResult = await sql(
      `SELECT value FROM settings WHERE tenant_id = 1 AND key = 'daily_backup_acknowledged' LIMIT 1`,
    );

    const acknowledgedTimestamp =
      ackResult.length > 0 ? ackResult[0].value : null;

    // If acknowledged timestamp matches backup timestamp, no new backup
    if (acknowledgedTimestamp === backupTimestamp) {
      return Response.json({
        has_new_backup: false,
      });
    }

    // New backup exists that hasn't been acknowledged
    return Response.json({
      has_new_backup: true,
      backup_timestamp: backupTimestamp,
    });
  } catch (err) {
    console.error("[Check Daily Backup] Error:", err);
    return Response.json(
      { error: "Failed to check daily backup status" },
      { status: 500 },
    );
  }
}

/**
 * Acknowledge that the user has seen the daily backup notification
 */
export async function POST(request) {
  try {
    const { backup_timestamp } = await request.json();

    if (!backup_timestamp) {
      return Response.json(
        { error: "backup_timestamp is required" },
        { status: 400 },
      );
    }

    // Mark this backup as acknowledged
    await sql(
      `INSERT INTO settings (tenant_id, key, value) VALUES (1, 'daily_backup_acknowledged', $1)
       ON CONFLICT (tenant_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [backup_timestamp],
    );

    return Response.json({
      success: true,
      message: "Daily backup notification acknowledged",
    });
  } catch (err) {
    console.error("[Acknowledge Daily Backup] Error:", err);
    return Response.json(
      { error: "Failed to acknowledge daily backup" },
      { status: 500 },
    );
  }
}
