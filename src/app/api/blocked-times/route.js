import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

// Detect the correct UTC offset for America/Chicago on a given YYYY-MM-DD date.
// Returns e.g. "-05:00" (CDT) or "-06:00" (CST).
function getCentralTimeOffset(dateStr) {
  try {
    const testDate = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(testDate);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (
      tzName.startsWith("GMT") &&
      (tzName.includes("+") || tzName.includes("-"))
    ) {
      return tzName.slice(3); // "-05:00" or "-06:00"
    }
  } catch (_) {}
  // Fallback: CDT (UTC-5) March–October, CST (UTC-6) otherwise
  const month = parseInt(dateStr.split("-")[1], 10);
  return month >= 3 && month <= 10 ? "-05:00" : "-06:00";
}

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const { searchParams } = new URL(request.url);
  const employee_id = searchParams.get("employee_id");
  const date = searchParams.get("date"); // YYYY-MM-DD format for filtering by specific day

  try {
    let query =
      "SELECT bt.*, e.name as employee_name, e.color as employee_color FROM blocked_times bt LEFT JOIN employees e ON bt.employee_id = e.id WHERE (bt.is_deleted = false OR bt.is_deleted IS NULL)";
    const params = [];

    if (employee_id) {
      params.push(employee_id);
      query += ` AND bt.employee_id = $${params.length}`;
    }

    // Filter by specific date if provided - get blocks that overlap with the day.
    // Use CDT-aware boundaries so late-evening blocks aren't cut off by UTC mismatch.
    if (date) {
      const offset = getCentralTimeOffset(date);
      const dayStart = `${date}T00:00:00${offset}`;
      const dayEnd = `${date}T23:59:59${offset}`;
      params.push(dayStart);
      params.push(dayEnd);
      query += ` AND (
        (bt.start_time <= $${params.length} AND bt.end_time >= $${params.length - 1})
        OR (bt.start_time >= $${params.length - 1} AND bt.start_time <= $${params.length})
      )`;
    }

    query += " ORDER BY bt.start_time ASC";

    const blockedTimes = await sql(query, params);
    return Response.json(blockedTimes);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch blocked times" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const authCheck = await requireAuth();
    if (authCheck.error) return authCheck.error;

    const { employee_id, start_time, end_time, reason, type } =
      await request.json();

    if (!employee_id || !start_time || !end_time) {
      return Response.json(
        { error: "employee_id, start_time, and end_time are required" },
        { status: 400 },
      );
    }

    // Convert the ISO timestamps to UTC for storage
    // The frontend sends timestamps like "2024-01-15T10:30:00-06:00" (Chicago time)
    // PostgreSQL will store these correctly as timestamptz
    const [blocked] = await sql`
      INSERT INTO blocked_times (employee_id, start_time, end_time, reason, type)
      VALUES (${employee_id}, ${start_time}::timestamptz, ${end_time}::timestamptz, ${reason || null}, ${type || "blocked"})
      RETURNING *
    `;

    return Response.json(blocked);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create blocked time" },
      { status: 500 },
    );
  }
}
