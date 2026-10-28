import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request, { params }) {
  try {
    const session = await auth();
    const paidBy = session?.user?.name || session?.user?.email || "Admin";

    const { id } = params;
    if (!id) {
      return Response.json(
        { error: "Appointment ID required" },
        { status: 400 },
      );
    }

    const rows = await sql`
      UPDATE appointments
      SET driver_paid = true,
          driver_paid_at = NOW(),
          driver_paid_by = ${paidBy}
      WHERE id = ${parseInt(id)}
      RETURNING id, booking_number, driver_paid, driver_paid_at, driver_paid_by
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    return Response.json({ success: true, appointment: rows[0] });
  } catch (error) {
    console.error("Error marking driver paid:", error);
    return Response.json(
      { error: "Failed to update payment status" },
      { status: 500 },
    );
  }
}
