/**
 * POST /api/schedule-timeline/notify-preview
 *
 * Dry-run preview: given a list of trip IDs, returns who would be notified
 * and who would be skipped after all suppression rules are applied.
 *
 * Chunk 7 — Notification layer for the dispatch timeline.
 * This endpoint never sends anything. It only reads settings + trip data.
 */

import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { loadSettings } from "@/app/api/utils/confirmations/settingsHelpers";

export async function POST(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  try {
    const body = await request.json();
    const { trip_ids } = body;

    if (!Array.isArray(trip_ids) || trip_ids.length === 0) {
      return Response.json(
        { error: "trip_ids array is required" },
        { status: 400 },
      );
    }

    // Load global settings (same path used by confirmationService)
    const settings = await loadSettings(1);

    const driverPortalOnly = settings.driver_portal_only === "yes";
    const suppressDriverConfirmations =
      settings.suppress_driver_confirmations === "yes";
    const emailsEnabled = settings.send_emails !== "no";
    const smsEnabled = settings.send_sms !== "no";

    // Fetch all requested trips in one query
    const trips = await sql`
      SELECT
        a.id,
        a.booking_number,
        a.status,
        a.employee_id,
        a.start_time,
        c.name  AS client_name,
        c.email AS client_email,
        c.phone AS client_phone,
        c.notification_preference,
        e.name  AS employee_name,
        e.email AS employee_email,
        e.phone AS employee_phone
      FROM appointments a
      LEFT JOIN clients   c ON a.client_id  = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ANY(${trip_ids})
        AND a.status NOT IN ('deleted', 'cancelled', 'canceled')
      ORDER BY a.start_time ASC
    `;

    const preview = trips.map((trip) => {
      const skipReasons = [];

      const pref = trip.notification_preference || "both";
      const wantEmail = pref === "both" || pref === "email";
      const wantSms = pref === "both" || pref === "sms";
      const wantNone = pref === "none";

      // ── Passenger ──────────────────────────────────────────────────────
      let passengerEmail = false;
      let passengerSms = false;

      if (wantNone) {
        skipReasons.push("Passenger preference: none");
      } else {
        if (emailsEnabled && trip.client_email && wantEmail) {
          passengerEmail = true;
        } else if (!trip.client_email && wantEmail) {
          skipReasons.push("Passenger has no email address");
        }

        if (smsEnabled && trip.client_phone && wantSms) {
          passengerSms = true;
        } else if (!trip.client_phone && wantSms) {
          skipReasons.push("Passenger has no phone number");
        }
      }

      // ── Driver ─────────────────────────────────────────────────────────
      let driverEmail = false;
      let driverSms = false;

      if (!trip.employee_id) {
        skipReasons.push("No driver assigned to this trip");
      } else if (driverPortalOnly) {
        skipReasons.push("Driver portal-only mode is on");
      } else if (suppressDriverConfirmations) {
        skipReasons.push("Driver confirmations are suppressed");
      } else {
        if (emailsEnabled && trip.employee_email) {
          driverEmail = true;
        }
        if (smsEnabled && trip.employee_phone) {
          driverSms = true;
        }
        if (!trip.employee_email && !trip.employee_phone) {
          skipReasons.push(
            `Driver ${trip.employee_name || ""} has no contact info`,
          );
        }
      }

      // ── Office ─────────────────────────────────────────────────────────
      // Office email always fires when emails are enabled (handled internally
      // by confirmationService via business_email setting)
      const officeEmail = emailsEnabled;

      const willSendAnything =
        passengerEmail ||
        passengerSms ||
        driverEmail ||
        driverSms ||
        officeEmail;

      return {
        trip_id: trip.id,
        booking_number: trip.booking_number,
        client_name: trip.client_name || "Unknown",
        employee_name: trip.employee_name || null,
        employee_id: trip.employee_id || null,
        start_time: trip.start_time,
        notify: {
          passenger_email: passengerEmail,
          passenger_sms: passengerSms,
          driver_email: driverEmail,
          driver_sms: driverSms,
          office_email: officeEmail,
        },
        skip_reasons: skipReasons,
        will_send_anything: willSendAnything,
      };
    });

    return Response.json({ preview });
  } catch (error) {
    console.error("[notify-preview] Error:", error);
    return Response.json(
      { error: "Failed to build notification preview", detail: error.message },
      { status: 500 },
    );
  }
}
