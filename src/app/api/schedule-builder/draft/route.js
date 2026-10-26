import sql from "@/app/api/utils/sql";

/**
 * GET /api/schedule-builder/draft?date=YYYY-MM-DD
 * Retrieve saved draft assignments for a specific date
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return Response.json(
        { error: "Date parameter required" },
        { status: 400 },
      );
    }

    const [draft] = await sql`
      SELECT value
      FROM settings
      WHERE tenant_id = 1
      AND key = ${"schedule_draft_" + date}
    `;

    if (!draft || !draft.value) {
      return Response.json({ draft: null });
    }

    const parsedData = JSON.parse(draft.value);

    return Response.json({
      draft: parsedData.assignments || {},
      vehicleAssignments: parsedData.vehicleAssignments || {},
      savedAt: parsedData.savedAt || null,
    });
  } catch (error) {
    console.error("Error loading draft:", error);
    return Response.json({ error: "Failed to load draft" }, { status: 500 });
  }
}

/**
 * POST /api/schedule-builder/draft
 * Save draft assignments for a specific date
 * Body: { date: "YYYY-MM-DD", assignments: { tripId: driverId, ... }, vehicleAssignments: { tripId: vehicleId, ... } }
 */
export async function POST(request) {
  try {
    const { date, assignments, vehicleAssignments } = await request.json();

    if (!date || !assignments) {
      return Response.json(
        { error: "Date and assignments required" },
        { status: 400 },
      );
    }

    const key = "schedule_draft_" + date;
    const draftData = JSON.stringify({
      assignments,
      vehicleAssignments: vehicleAssignments || {},
      savedAt: new Date().toISOString(),
    });

    // Upsert the draft
    await sql`
      INSERT INTO settings (tenant_id, key, value)
      VALUES (1, ${key}, ${draftData})
      ON CONFLICT (tenant_id, key)
      DO UPDATE SET value = ${draftData}
    `;

    return Response.json({
      success: true,
      message: "Draft saved successfully",
    });
  } catch (error) {
    console.error("Error saving draft:", error);
    return Response.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

/**
 * DELETE /api/schedule-builder/draft?date=YYYY-MM-DD
 * Delete saved draft for a specific date
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return Response.json(
        { error: "Date parameter required" },
        { status: 400 },
      );
    }

    const key = "schedule_draft_" + date;

    await sql`
      DELETE FROM settings
      WHERE tenant_id = 1 AND key = ${key}
    `;

    return Response.json({
      success: true,
      message: "Draft deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting draft:", error);
    return Response.json({ error: "Failed to delete draft" }, { status: 500 });
  }
}
