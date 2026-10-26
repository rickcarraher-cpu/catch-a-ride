import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let query = `
      SELECT 
        a.id,
        a.booking_number,
        a.created_at,
        a.start_time,
        a.booked_by,
        a.booker_name,
        a.status,
        a.notes,
        a.payment_status,
        a.payment_amount,
        a.original_amount,
        a.pickup_address,
        a.dropoff_address,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        e.name as employee_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.tenant_id = 1
        AND (a.booked_by = 'Online' OR a.booked_by = 'Passenger')
    `;

    const params = [];

    // Date range filter
    if (startDate) {
      params.push(startDate);
      query += ` AND a.created_at >= $${params.length}::timestamp`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND a.created_at <= $${params.length}::timestamp`;
    }

    // Search filter (email or phone only - name search removed)
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        LOWER(c.email) LIKE LOWER($${params.length})
        OR c.phone LIKE $${params.length}
      )`;
    }

    query += ` ORDER BY a.created_at DESC`;

    // Pagination
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const bookings = await sql(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.tenant_id = 1
        AND (a.booked_by = 'Online' OR a.booked_by = 'Passenger')
    `;

    const countParams = [];
    if (startDate) {
      countParams.push(startDate);
      countQuery += ` AND a.created_at >= $${countParams.length}::timestamp`;
    }
    if (endDate) {
      countParams.push(endDate);
      countQuery += ` AND a.created_at <= $${countParams.length}::timestamp`;
    }
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (
        LOWER(c.email) LIKE LOWER($${countParams.length})
        OR c.phone LIKE $${countParams.length}
      )`;
    }

    const countResult = await sql(countQuery, countParams);
    const total = Number(countResult[0]?.total || 0);

    return Response.json({
      bookings,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching online bookings:", error);
    return Response.json(
      { error: "Failed to fetch online bookings" },
      { status: 500 },
    );
  }
}
