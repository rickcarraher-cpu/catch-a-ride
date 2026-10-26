import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

export async function DELETE(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const deleted = await sql`
      DELETE FROM blocked_times
      WHERE end_time < NOW()
        AND (is_deleted = false OR is_deleted IS NULL)
      RETURNING id
    `;

    return Response.json({
      success: true,
      deleted: deleted.length,
      message: `Removed ${deleted.length} past blocked time${deleted.length !== 1 ? "s" : ""}.`,
    });
  } catch (err) {
    console.error("[Cleanup Past Blocked Times] error:", err);
    return Response.json(
      { error: "Failed to clean up past blocked times: " + err.message },
      { status: 500 },
    );
  }
}
