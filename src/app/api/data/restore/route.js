import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    console.log("[Restore] Starting restore process...");

    // Check if backup tables exist
    const backupCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%_backup'
    `;

    if (backupCheck.length === 0) {
      return Response.json(
        { error: "No backup found. Please create a backup first." },
        { status: 400 },
      );
    }

    // List of all tables to restore (in order to handle foreign keys)
    const tables = [
      "tenants",
      "settings",
      "clients",
      "employees",
      "vehicles",
      "services",
      "vehicle_assignments",
      "working_hours",
      "blocked_times",
      "appointments",
      "appointment_services",
      "recurring_appointments",
      "transactions",
      "invoices",
      "conversations",
      "conversation_participants",
      "sms_messages",
      "payments",
      "payment_events",
      "driver_mileage_approvals",
    ];

    let restoreResults = {};

    // Process each table sequentially
    // First, delete all data from main tables (in reverse order for foreign keys)
    for (let i = tables.length - 1; i >= 0; i--) {
      const table = tables[i];
      const backupTable = `${table}_backup`;

      // Check if backup table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${backupTable}
        ) as exists
      `;

      if (!tableExists[0].exists) {
        console.log(`[Restore] Skipping ${table} - no backup table found`);
        continue;
      }

      // Delete current data
      await sql(`DELETE FROM "${table}"`);
      console.log(`[Restore] Cleared ${table}`);
    }

    // Then, restore data from backup tables (in forward order)
    for (const table of tables) {
      const backupTable = `${table}_backup`;

      // Check if backup table exists
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${backupTable}
        ) as exists
      `;

      if (!tableExists[0].exists) {
        restoreResults[table] = 0;
        continue;
      }

      // Get column names from backup table
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${backupTable}
        ORDER BY ordinal_position
      `;

      const columnList = columns.map((c) => c.column_name).join(", ");

      // Restore data using INSERT INTO ... SELECT
      await sql(
        `INSERT INTO "${table}" (${columnList}) SELECT ${columnList} FROM "${backupTable}"`,
        [],
      );

      // Get count of restored records
      const countResult = await sql(`SELECT COUNT(*) as count FROM "${table}"`);
      restoreResults[table] = parseInt(countResult[0].count);
      console.log(
        `[Restore] Restored ${restoreResults[table]} records to ${table}`,
      );
    }

    const totalRecords = Object.values(restoreResults).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Response.json({
      success: true,
      message: `Restore completed successfully. ${totalRecords} total records restored.`,
      restore_timestamp: new Date().toISOString(),
      details: restoreResults,
    });
  } catch (err) {
    console.error("[Restore] Error:", err);
    return Response.json(
      {
        error: "Failed to restore backup: " + err.message,
        details: err.stack,
      },
      { status: 500 },
    );
  }
}
