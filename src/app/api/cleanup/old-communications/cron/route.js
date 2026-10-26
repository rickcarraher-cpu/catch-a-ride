import sql from "@/app/api/utils/sql";

/**
 * Cron endpoint for automated cleanup of old communications
 * This should be called daily or weekly by a scheduler (e.g., Vercel Cron)
 *
 * To set up with Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cleanup/old-communications/cron",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 *
 * The schedule "0 2 * * *" means daily at 2 AM UTC
 */
export async function GET(request) {
  try {
    // Optional: Add authorization check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    // Count records to be deleted
    const smsCountResult = await sql`
      SELECT COUNT(*) as count
      FROM sms_messages 
      WHERE (
        appointment_id IN (
          SELECT id FROM appointments 
          WHERE start_time < NOW() - INTERVAL '30 days'
        )
      ) OR (
        appointment_id IS NULL 
        AND sent_at < NOW() - INTERVAL '30 days'
      )
    `;

    const emailCountResult = await sql`
      SELECT COUNT(*) as count
      FROM email_logs 
      WHERE (
        appointment_id IN (
          SELECT id FROM appointments 
          WHERE start_time < NOW() - INTERVAL '30 days'
        )
      ) OR (
        appointment_id IS NULL 
        AND sent_at < NOW() - INTERVAL '30 days'
      )
    `;

    const smsCount = parseInt(smsCountResult[0]?.count || 0);
    const emailCount = parseInt(emailCountResult[0]?.count || 0);

    // Perform deletion if there are records to delete
    if (smsCount > 0 || emailCount > 0) {
      await sql`
        DELETE FROM sms_messages 
        WHERE (
          appointment_id IN (
            SELECT id FROM appointments 
            WHERE start_time < NOW() - INTERVAL '30 days'
          )
        ) OR (
          appointment_id IS NULL 
          AND sent_at < NOW() - INTERVAL '30 days'
        )
      `;

      await sql`
        DELETE FROM email_logs 
        WHERE (
          appointment_id IN (
            SELECT id FROM appointments 
            WHERE start_time < NOW() - INTERVAL '30 days'
          )
        ) OR (
          appointment_id IS NULL 
          AND sent_at < NOW() - INTERVAL '30 days'
        )
      `;
    }

    return Response.json({
      success: true,
      deleted: {
        smsMessages: smsCount,
        emailLogs: emailCount,
        total: smsCount + emailCount,
      },
      message:
        smsCount + emailCount > 0
          ? `Cleanup completed: removed ${smsCount} SMS and ${emailCount} emails from trips 30+ days old`
          : "No old communications to clean up",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// Support POST as well for manual triggers
export async function POST(request) {
  return GET(request);
}
