import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";

export async function POST(request, { params }) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const { id } = params;

  try {
    const result = await sql`
      UPDATE appointments
      SET needs_receipt = false
      WHERE id = ${id} AND tenant_id = 1
      RETURNING id, needs_receipt
    `;

    if (result.length === 0) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    return Response.json({ success: true, id, needs_receipt: false });
  } catch (error) {
    console.error("[mark-receipt-printed]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
