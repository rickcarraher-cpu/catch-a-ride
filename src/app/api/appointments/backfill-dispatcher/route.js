import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

export async function POST(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    // Find all Admin-booked trips that are missing booked_by_dispatcher
    // but have last_modified_by set (email of who touched it)
    const trips = await sql`
      SELECT id, last_modified_by, booked_by_dispatcher, booking_number
      FROM appointments
      WHERE booked_by = 'Admin'
        AND booked_by_dispatcher IS NULL
        AND last_modified_by IS NOT NULL
        AND last_modified_by != 'unknown'
    `;

    if (trips.length === 0) {
      return Response.json({
        updated: 0,
        message: "No trips needed backfilling.",
      });
    }

    // Get all active employees keyed by email (lowercased)
    const employees = await sql`
      SELECT name, email FROM employees
      WHERE is_active = true AND email IS NOT NULL
    `;

    const emailToName = {};
    for (const emp of employees) {
      emailToName[emp.email.toLowerCase()] = emp.name;
    }

    let updated = 0;
    let skipped = 0;

    for (const trip of trips) {
      const email = (trip.last_modified_by || "").toLowerCase();
      const dispatcherName = emailToName[email] || null;

      if (dispatcherName) {
        await sql`
          UPDATE appointments
          SET booked_by_dispatcher = ${dispatcherName}
          WHERE id = ${trip.id}
        `;
        updated++;
      } else {
        // Fall back to using the email itself if no employee record found
        await sql`
          UPDATE appointments
          SET booked_by_dispatcher = ${trip.last_modified_by}
          WHERE id = ${trip.id}
        `;
        updated++;
      }
    }

    return Response.json({
      updated,
      skipped,
      total: trips.length,
      message: `Backfilled ${updated} trip(s) with dispatcher names.`,
    });
  } catch (error) {
    console.error("Backfill dispatcher error:", error);
    return Response.json(
      { error: error.message || "Backfill failed" },
      { status: 500 },
    );
  }
}
