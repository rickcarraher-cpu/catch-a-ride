import sql from "@/app/api/utils/sql";

export async function POST(request, { params }) {
  const { payment_id } = params;

  try {
    // Update payment status to manual_pending
    await sql`
      UPDATE payments
      SET status = 'manual_pending',
          updated_at = NOW()
      WHERE id = ${payment_id} AND provider = 'zelle'
    `;

    return Response.json({
      success: true,
      message: "Status updated to pending confirmation",
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    return Response.json({ error: "Failed to update status" }, { status: 500 });
  }
}
