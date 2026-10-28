import sql from "@/app/api/utils/sql";

/**
 * Cleanup old SMS messages and email logs for trips 30+ days old
 * This helps reduce database storage by removing communication logs
 * after they're no longer needed for recent trip history
 */
export async function POST(request) {
  try {
    const { dryRun = false } = await request.json().catch(() => ({}));

    // First, count what would be deleted
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

    if (dryRun) {
      return Response.json({
        success: true,
        dryRun: true,
        wouldDelete: {
          smsMessages: smsCount,
          emailLogs: emailCount,
          total: smsCount + emailCount,
        },
        message: `Would delete ${smsCount} SMS messages and ${emailCount} email logs`,
      });
    }

    // Perform the actual deletion
    const smsDeleteResult = await sql`
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

    const emailDeleteResult = await sql`
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

    return Response.json({
      success: true,
      deleted: {
        smsMessages: smsCount,
        emailLogs: emailCount,
        total: smsCount + emailCount,
      },
      message: `Successfully deleted ${smsCount} SMS messages and ${emailCount} email logs from trips 30+ days old`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error cleaning up old communications:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}

// GET endpoint for manual testing or checking what would be deleted
export async function GET(request) {
  try {
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

    return Response.json({
      ready: true,
      oldRecords: {
        smsMessages: smsCount,
        emailLogs: emailCount,
        total: smsCount + emailCount,
      },
      message: `Found ${smsCount} SMS messages and ${emailCount} email logs ready for cleanup (30+ days old)`,
    });
  } catch (error) {
    console.error("Error checking old communications:", error);
    return Response.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
