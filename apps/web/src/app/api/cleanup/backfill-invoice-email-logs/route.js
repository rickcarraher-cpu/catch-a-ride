import sql from "@/app/api/utils/sql";

/**
 * POST /api/cleanup/backfill-invoice-email-logs
 *
 * Backfills email_logs rows that were logged without email_type or appointment_id.
 * This fixes invoice emails that show as "sent" but don't appear in the communication
 * log when filtering by "Invoice" type.
 *
 * The root cause was that older versions of the invoice route called sendEmail()
 * without passing appointmentId, recipientName, or emailType, so the logs were
 * created with null values for those fields.
 */
export async function POST() {
  try {
    // Find email_logs with invoice subjects but missing email_type or appointment_id
    // Match them to appointments via booking_number extracted from the subject line
    const result = await sql`
      UPDATE email_logs el
      SET 
        email_type = 'invoice',
        appointment_id = a.id,
        recipient_name = COALESCE(el.recipient_name, c.name)
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE el.tenant_id = 1
        AND el.subject ILIKE 'Invoice #%'
        AND (el.email_type IS NULL OR el.appointment_id IS NULL)
        AND a.booking_number = SUBSTRING(el.subject FROM 'Invoice #([0-9]+-[0-9]+)')
        AND a.tenant_id = 1
      RETURNING el.id, el.subject, a.id AS matched_appointment_id
    `;

    // Also fix any receipt emails that are missing metadata
    const receiptResult = await sql`
      UPDATE email_logs el
      SET 
        email_type = COALESCE(el.email_type, 'receipt')
      WHERE el.tenant_id = 1
        AND el.subject ILIKE 'Receipt for%'
        AND el.email_type IS NULL
      RETURNING el.id
    `;

    return Response.json({
      success: true,
      invoices_fixed: result.length,
      receipts_fixed: receiptResult.length,
      details: result.map((r) => ({
        email_log_id: r.id,
        subject: r.subject,
        appointment_id: r.matched_appointment_id,
      })),
    });
  } catch (error) {
    console.error("[Backfill Invoice Logs] Error:", error);
    return Response.json(
      { error: "Failed to backfill invoice email logs", detail: error.message },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    // Preview what would be fixed without making changes
    const preview = await sql`
      SELECT el.id, el.subject, el.recipient_email, el.email_type, el.appointment_id, el.sent_at,
        SUBSTRING(el.subject FROM 'Invoice #([0-9]+-[0-9]+)') as extracted_booking,
        a.id as matched_appointment_id,
        c.name as matched_client_name
      FROM email_logs el
      LEFT JOIN appointments a ON a.booking_number = SUBSTRING(el.subject FROM 'Invoice #([0-9]+-[0-9]+)') AND a.tenant_id = 1
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE el.tenant_id = 1
        AND el.subject ILIKE 'Invoice #%'
        AND (el.email_type IS NULL OR el.appointment_id IS NULL)
      ORDER BY el.sent_at DESC
    `;

    return Response.json({
      count: preview.length,
      message: `Found ${preview.length} invoice email logs that need backfilling. POST to this endpoint to fix them.`,
      records: preview,
    });
  } catch (error) {
    console.error("[Backfill Invoice Logs] Preview error:", error);
    return Response.json(
      { error: "Failed to preview", detail: error.message },
      { status: 500 },
    );
  }
}
