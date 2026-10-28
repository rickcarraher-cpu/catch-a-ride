import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    if (!date) {
      return Response.json(
        { error: "date parameter required" },
        { status: 400 },
      );
    }

    const trips = await sql`
      SELECT a.id, a.booking_number, a.start_time, a.status, a.payment_status,
             a.original_amount, a.destination, a.needs_receipt,
             a.display_short_date, a.display_time,
             c.name AS client_name,
             e.name AS employee_name, e.color AS employee_color
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.tenant_id = 1
        AND a.needs_receipt = true
        AND a.status != 'deleted'
        AND DATE(a.start_time AT TIME ZONE 'America/Chicago') = ${date}
      ORDER BY a.start_time ASC
    `;

    return Response.json({ trips, date });
  } catch (error) {
    console.error("[needs-receipt]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
