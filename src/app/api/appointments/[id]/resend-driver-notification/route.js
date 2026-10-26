import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";
import { randomBytes } from "crypto";

export async function POST(request, { params }) {
  try {
    const { id } = params;

    // Fetch appointment details
    const [app] = await sql`
      SELECT a.*,
        c.name  AS client_name,  c.phone AS client_phone, c.email AS client_email,
        c.notification_preference AS client_notif_pref,
        e.name  AS employee_name, e.phone AS employee_phone, e.email AS employee_email,
        e.profile_image_url AS employee_profile_image_url,
        e.copy_communications_to_company AS employee_copy_comms,
        v.name  AS vehicle_name,
        va.profile_image_url AS vehicle_profile_image_url,
        va.profile_description AS vehicle_profile_description
      FROM appointments a
      LEFT JOIN clients   c ON a.client_id   = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles  v ON a.vehicle_id  = v.id
      LEFT JOIN vehicle_assignments va
             ON va.vehicle_id  = a.vehicle_id
            AND va.employee_id = a.employee_id
      WHERE a.id = ${id}
    `;

    if (!app) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    if (!app.employee_id) {
      return Response.json(
        { error: "No driver assigned to this trip" },
        { status: 400 },
      );
    }

    // Ensure a driver confirmation token exists
    if (!app.driver_confirmation_token) {
      const newToken = randomBytes(32).toString("hex");
      await sql`
        UPDATE appointments
        SET driver_confirmation_token = ${newToken}
        WHERE id = ${id}
      `;
      app.driver_confirmation_token = newToken;
      console.log(
        `[Resend Driver Notification] Generated new driver token for trip #${id}`,
      );
    }

    // Send driver assignment notification using new confirmation service
    const result = await sendConfirmations({
      appointmentId: app.id,
      eventType: "driver_assigned",
      notifyPassenger: false, // Only notify driver when manually resending
      notifyDriver: true,
      notifyOffice: false,
    });

    return Response.json({
      success: true,
      message: "Driver notification sent successfully",
      results: result.results,
    });
  } catch (error) {
    console.error("Error resending driver notification:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
