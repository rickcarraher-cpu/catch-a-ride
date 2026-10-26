import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { buildBookingEmailHtml } from "@/app/api/utils/notifications/emailBuilder";
import { buildBookingMessage } from "@/app/api/utils/notifications/messageBuilders";

export async function GET(request, { params }) {
  try {
    const session = await auth();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Fetch appointment with all joined data
    const [app] = await sql`
      SELECT
        a.*,
        c.name AS client_name,
        c.phone AS client_phone,
        c.email AS client_email,
        c.notification_preference,
        e.name AS employee_name,
        e.profile_image_url AS employee_profile_image_url,
        v.name AS vehicle_name,
        va.profile_image_url AS vehicle_profile_image_url,
        va.profile_description AS vehicle_profile_description
      FROM appointments a
      LEFT JOIN clients c ON c.id = a.client_id
      LEFT JOIN employees e ON e.id = a.employee_id
      -- Fall back to driver's assigned vehicle if vehicle_id not set on appointment
      LEFT JOIN LATERAL (
        SELECT vehicle_id FROM vehicle_assignments
        WHERE employee_id = a.employee_id
        ORDER BY id LIMIT 1
      ) va_fallback ON true
      LEFT JOIN vehicles v ON v.id = COALESCE(a.vehicle_id, va_fallback.vehicle_id)
      LEFT JOIN vehicle_assignments va ON va.vehicle_id = COALESCE(a.vehicle_id, va_fallback.vehicle_id) AND va.employee_id = a.employee_id
      WHERE a.id = ${id}
    `;

    if (!app) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Fetch services
    const services = await sql`
      SELECT
        as2.*,
        s.name AS service_name,
        s.is_addon,
        s.is_airport_service
      FROM appointment_services as2
      LEFT JOIN services s ON s.id = as2.service_id
      WHERE as2.appointment_id = ${id}
      ORDER BY s.is_addon ASC, as2.id ASC
    `;

    // Fetch active payment link
    const [activePayment] = await sql`
      SELECT payment_url, provider, status, amount
      FROM payments
      WHERE appointment_id = ${id}
        AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // Fetch settings
    const settingsRows = await sql`
      SELECT key, value FROM settings WHERE tenant_id = 1
    `;
    const settings = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    // Build email HTML (passenger-facing) with payment link
    const emailHtml = buildBookingEmailHtml({
      action: "created",
      app,
      services,
      settings,
      changedFields: [],
      isOnlineBooking: false,
      includeDriverNotes: false,
      includePassengerNotes: true,
      includeCalendarLinks: true,
      recipientType: "passenger",
      paymentUrl: activePayment?.payment_url || null,
    });

    // Build SMS text (passenger-facing) with payment link
    const smsText = buildBookingMessage({
      action: "created",
      app,
      services,
      settings,
      changedFields: [],
      includeDriverNotes: false,
      paymentUrl: activePayment?.payment_url || null,
    });

    return Response.json({ emailHtml, smsText, app });
  } catch (error) {
    console.error("Error building confirmation preview:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
