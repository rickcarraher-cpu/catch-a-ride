import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "5000", 10),
      10000,
    );

    // Query all sent emails from the database
    // We'll need to create an email_logs table to track sent emails
    const emails = await sql`
      SELECT 
        id,
        appointment_id,
        recipient_email,
        recipient_name,
        subject,
        body,
        sent_at,
        status,
        error_message,
        email_type
      FROM email_logs
      WHERE tenant_id = 1
        AND sent_at >= NOW() - INTERVAL '30 days'
      ORDER BY sent_at DESC
      LIMIT ${limit}
    `;

    return Response.json({ emails });
  } catch (error) {
    console.error("[Email Logs] Error fetching emails:", error);
    return Response.json(
      { error: "Failed to fetch email logs" },
      { status: 500 },
    );
  }
}
