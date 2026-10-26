import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { getDatePartsInCDT, createDateInCDT } from "@/utils/timezone";

// Helper to generate blocked times from a single series
function generateBlockedTimesFromSeries(
  series,
  startDate,
  endDate,
  remainingSlots,
) {
  const candidates = [];

  // Parse time-of-day from series
  const [startHour, startMinute] = series.start_time.split(":").map(Number);
  const [endHour, endMinute] = series.end_time.split(":").map(Number);

  // Get the day-of-week target
  const seriesCreatedParts = getDatePartsInCDT(new Date(series.created_at));
  const seriesCreatedDate = new Date(series.created_at);
  const targetDayOfWeek =
    series.day_of_week !== null && series.day_of_week !== undefined
      ? series.day_of_week
      : seriesCreatedDate.getDay();

  // Iterate day by day in America/Chicago
  let current = new Date(startDate);
  while (
    current <= endDate &&
    (remainingSlots === null || candidates.length < remainingSlots)
  ) {
    const currentParts = getDatePartsInCDT(current);
    const currentDayOfWeek = current.getDay();

    let include = false;

    if (series.frequency === "daily") {
      include = true;
    } else if (series.frequency === "weekly") {
      include = currentDayOfWeek === targetDayOfWeek;
    } else if (series.frequency === "bi-weekly") {
      if (currentDayOfWeek === targetDayOfWeek) {
        const msInWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksSinceStart = Math.floor(
          (current - seriesCreatedDate) / msInWeek,
        );
        include = weeksSinceStart % 2 === 0;
      }
    } else if (series.frequency === "monthly") {
      include = currentParts.day === seriesCreatedParts.day;
    }

    if (include) {
      // Create start and end datetime in CDT
      const blockStart = createDateInCDT(
        currentParts.year,
        currentParts.month,
        currentParts.day,
        startHour,
        startMinute,
        0,
      );
      const blockEnd = createDateInCDT(
        currentParts.year,
        currentParts.month,
        currentParts.day,
        endHour,
        endMinute,
        0,
      );

      candidates.push({
        start_time: blockStart.toISOString(),
        end_time: blockEnd.toISOString(),
      });
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return candidates;
}

// POST /api/blocked-times/recurring/generate - Generate blocked times from recurring series
export async function POST(request) {
  await requireAuth();

  const body = await request.json();
  const { days_ahead = 30, recurring_id = null } = body;

  // Load series
  let seriesList;
  if (recurring_id) {
    seriesList = await sql`
      SELECT * FROM recurring_blocked_times
      WHERE id = ${recurring_id}
      AND (is_deleted = false OR is_deleted IS NULL)
    `;
  } else {
    seriesList = await sql`
      SELECT * FROM recurring_blocked_times
      WHERE (is_deleted = false OR is_deleted IS NULL)
    `;
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + days_ahead * 24 * 60 * 60 * 1000);

  let totalGenerated = 0;

  for (const series of seriesList) {
    // Check if there's a cap
    let remainingSlots = null;
    if (series.num_occurrences > 0) {
      // Count existing blocked times from this series
      const existingCount = await sql`
        SELECT COUNT(*) as count
        FROM blocked_times
        WHERE recurring_blocked_time_id = ${series.id}
        AND (is_deleted = false OR is_deleted IS NULL)
      `;

      const alreadyGenerated = parseInt(existingCount[0].count);
      remainingSlots = series.num_occurrences - alreadyGenerated;

      if (remainingSlots <= 0) {
        continue; // Skip this series
      }
    }

    // Generate candidate datetimes
    const candidates = generateBlockedTimesFromSeries(
      series,
      now,
      endDate,
      remainingSlots,
    );

    // Insert each candidate if it doesn't already exist
    for (const candidate of candidates) {
      // Check if already exists
      const existing = await sql`
        SELECT id FROM blocked_times
        WHERE employee_id = ${series.employee_id}
        AND start_time = ${candidate.start_time}::timestamptz
        AND end_time = ${candidate.end_time}::timestamptz
        AND (is_deleted = false OR is_deleted IS NULL)
      `;

      if (existing.length === 0) {
        // Insert
        await sql`
          INSERT INTO blocked_times (
            employee_id,
            start_time,
            end_time,
            reason,
            recurring_blocked_time_id,
            type
          ) VALUES (
            ${series.employee_id},
            ${candidate.start_time}::timestamptz,
            ${candidate.end_time}::timestamptz,
            ${series.reason || null},
            ${series.id},
            ${series.type || "blocked"}
          )
        `;
        totalGenerated++;
      }
    }
  }

  return Response.json({ success: true, generated: totalGenerated });
}

// GET /api/blocked-times/recurring/generate - Health check
export async function GET() {
  return Response.json({
    message: "Recurring blocked times generator ready",
    usage: "POST with { days_ahead: 30, recurring_id: optional }",
  });
}
