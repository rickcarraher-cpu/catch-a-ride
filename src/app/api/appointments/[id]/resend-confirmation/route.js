import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const body = await request.json();
    const { type, channel, include_office } = body; // type: 'driver', 'passenger', or 'all'; channel: 'email', 'sms', or 'all'; include_office: bool

    // Fetch the trip to verify it exists
    const [trip] = await sql`
      SELECT id, booking_number, employee_id
      FROM appointments
      WHERE id = ${id} AND tenant_id = 1
    `;

    if (!trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    console.log(
      `[Resend Confirmation] Manually resending ${type} confirmation (${channel || "all"} channels) for trip #${trip.booking_number || id}`,
    );

    // Use the centralized confirmation service which has proper payment link logic
    try {
      const result = await sendConfirmations({
        appointmentId: parseInt(id),
        eventType: "booking_created", // Use booking_created for resends
        notifyPassenger: type === "passenger" || type === "all",
        notifyDriver:
          (type === "driver" || type === "all") && !!trip.employee_id,
        notifyOffice: type === "all" || include_office === true,
        channelFilter: channel || "all", // Pass channel filter to confirmation service
      });

      console.log(
        `[Resend Confirmation] ✅ Successfully resent confirmations for trip #${trip.booking_number || id}`,
      );
      console.log(`[Resend Confirmation] Results:`, result.results);

      return Response.json({
        success: true,
        message: "Confirmations sent successfully",
        status: result.results,
      });
    } catch (confirmError) {
      console.error(
        `[Resend Confirmation] ❌ Failed to resend confirmations for trip #${trip.booking_number || id}:`,
        confirmError.message,
      );
      console.error("[Resend Confirmation] Error stack:", confirmError.stack);

      return Response.json(
        {
          error: "Failed to send confirmations",
          details: confirmError.message,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error(`[Resend Confirmation] Error for trip #${id}:`, error);
    return Response.json(
      { error: error.message || "Failed to resend confirmation" },
      { status: 500 },
    );
  }
}
