import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

// GET /api/blocked-times/recurring - List all recurring blocked time series
export async function GET(request) {
  await requireAuth();

  const series = await sql`
    SELECT 
      rbt.*,
      e.name as employee_name,
      e.color as employee_color
    FROM recurring_blocked_times rbt
    LEFT JOIN employees e ON rbt.employee_id = e.id
    WHERE (rbt.is_deleted = false OR rbt.is_deleted IS NULL)
    ORDER BY rbt.created_at DESC
  `;

  return Response.json(series);
}

// POST /api/blocked-times/recurring - Create a new recurring blocked time series
export async function POST(request) {
  await requireAuth();

  const body = await request.json();
  const {
    employee_id,
    start_time,
    end_time,
    frequency,
    day_of_week,
    reason,
    num_occurrences = 0,
    type,
  } = body;

  if (!employee_id || !start_time || !end_time || !frequency) {
    return Response.json(
      {
        error: "employee_id, start_time, end_time, and frequency are required",
      },
      { status: 400 },
    );
  }

  const validFrequencies = ["daily", "weekly", "bi-weekly", "monthly"];
  if (!validFrequencies.includes(frequency)) {
    return Response.json(
      { error: "frequency must be one of: daily, weekly, bi-weekly, monthly" },
      { status: 400 },
    );
  }

  const result = await sql`
    INSERT INTO recurring_blocked_times (
      employee_id,
      start_time,
      end_time,
      frequency,
      day_of_week,
      reason,
      num_occurrences,
      type,
      created_at
    ) VALUES (
      ${employee_id},
      ${start_time}::time,
      ${end_time}::time,
      ${frequency},
      ${day_of_week || null},
      ${reason || null},
      ${num_occurrences || 0},
      ${type || "blocked"},
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  return Response.json(result[0], { status: 201 });
}
