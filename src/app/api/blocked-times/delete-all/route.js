import sql from "@/app/api/utils/sql";

export async function DELETE(request) {
  // DISABLED FOR SAFETY - Use backup/restore system instead
  return Response.json(
    {
      error:
        "This endpoint has been disabled for safety. Please use the backup/restore system in Settings.",
      disabled: true,
    },
    { status: 403 },
  );

  /* Original code commented out for reference
  try {
    const result = await sql`DELETE FROM blocked_times`;

    return Response.json({
      success: true,
      deleted: result.length ?? 0,
      message: "All blocked times have been deleted.",
    });
  } catch (err) {
    console.error("[Delete All Blocked Times] error:", err);
    return Response.json(
      { error: "Failed to delete blocked times: " + err.message },
      { status: 500 },
    );
  }
  */
}
