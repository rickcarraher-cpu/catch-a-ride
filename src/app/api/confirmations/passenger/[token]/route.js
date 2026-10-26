import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { isBeforeInCDT } from "@/utils/timezone";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

// Helper to parse comma-separated emails
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

export async function GET(request, { params }) {
  try {
    const { token } = params;

    const rows = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.status,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.num_people,
        a.num_bags_checked,
        a.num_bags_carry_on,
        a.num_car_seats,
        a.num_golf_bags,
        a.outgoing_flight_info,
        a.returning_flight_info,
        a.return_date,
        a.notes,
        a.payment_status,
        a.payment_method,
        a.payment_amount,
        a.original_amount,
        a.passenger_confirmed,
        a.passenger_response_at,
        a.gift_certificate,
        a.client_id,
        a.display_long_date,
        a.display_short_date,
        a.display_time,
        a.display_full_datetime,
        a.display_sms_datetime,
        a.display_return_date,
        c.name as passenger_name,
        c.phone as passenger_phone,
        c.email as passenger_email,
        e.name as driver_name,
        e.first_name as driver_first_name,
        e.phone as driver_phone,
        e.profile_image_url as driver_profile_image,
        v.name as vehicle_name,
        va.profile_image_url as driver_portrait,
        va.profile_description as driver_bio
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_assignments va ON va.vehicle_id = v.id AND va.employee_id = e.id
      WHERE a.passenger_confirmation_token = ${token}
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 },
      );
    }

    const trip = rows[0];

    // Removed date restriction - passengers can always view their trip details
    // even after the trip has passed

    const services = await sql`
      SELECT 
        aps.service_id,
        s.name as service_name,
        s.is_addon,
        aps.service_price,
        aps.duration_minutes,
        aps.quantity,
        aps.stop_description
      FROM appointment_services aps
      LEFT JOIN services s ON aps.service_id = s.id
      WHERE aps.appointment_id = ${trip.id}
      ORDER BY aps.id
    `;

    trip.services = services;

    // Fetch active payment link if one exists
    const paymentRows = await sql`
      SELECT payment_url, provider, status, amount
      FROM payments
      WHERE appointment_id = ${trip.id}
        AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    trip.payment_url =
      paymentRows.length > 0 ? paymentRows[0].payment_url : null;

    // Also compute payments_total for balance calculation
    // Include cc_fee transactions — original_amount includes CC fees
    const [totalsRow] = await sql`
      SELECT COALESCE(SUM(t.amount), 0) as payments_total
      FROM transactions t
      WHERE t.appointment_id = ${trip.id}
        AND t.category IN ('payment', 'cc_fee')
    `;
    trip.payments_total = Number(totalsRow?.payments_total || 0);

    // Fetch credit card fee percent from settings
    const feeSettingsRows = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
    `;
    trip.credit_card_fee_percent =
      feeSettingsRows.length > 0 ? Number(feeSettingsRows[0].value) : 4;

    return Response.json({ trip });
  } catch (error) {
    console.error("Error fetching passenger confirmation:", error);
    return Response.json(
      { error: "Failed to load trip details" },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { token } = params;
    const body = await request.json();
    const { decision, reason } = body;

    if (!["confirmed", "cancelled"].includes(decision)) {
      return Response.json({ error: "Invalid decision" }, { status: 400 });
    }

    // Fetch trip with driver + client contact info for notifications
    const rows = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.passenger_response_at,
        a.driver_accepted,
        a.status,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        e.name as driver_name,
        e.phone as driver_phone,
        e.email as driver_email,
        c.name as passenger_name,
        c.phone as client_phone,
        c.email as client_email
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.passenger_confirmation_token = ${token}
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 },
      );
    }

    const trip = rows[0];

    console.log(
      `[Passenger Confirmation] Trip: #${trip.booking_number}, Decision: ${decision}, Current Status: ${trip.status}`,
    );

    const driverAccepted = trip.driver_accepted === "accepted";
    // Confirm if driver accepted OR if trip was reinstated (approved) — admin has cleared it
    const tripIsApproved = trip.status === "approved";
    const shouldMarkConfirmed =
      decision === "confirmed" && (driverAccepted || tripIsApproved);

    // Update appointment status
    await sql`
      UPDATE appointments
      SET 
        passenger_confirmed = ${decision},
        passenger_cancelled_reason = ${decision === "cancelled" ? reason : null},
        passenger_response_at = NOW(),
        status = CASE
          WHEN ${decision === "cancelled"} THEN 'cancelled'
          WHEN ${shouldMarkConfirmed} THEN 'confirmed'
          WHEN ${decision === "confirmed"} AND status = 'needs_review' THEN 'pending'
          WHEN ${decision === "confirmed"} AND status = 'approved' THEN 'confirmed'
          ELSE status
        END
      WHERE passenger_confirmation_token = ${token}
    `;

    // Load settings
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = {};
    settingsRows.forEach((row) => {
      settings[row.key] = row.value;
    });

    const ownerEmail = settings.owner_email;
    const ownerPhone = settings.business_phone;
    const businessName = settings.business_name || "Catch A Ride";
    const fromName = settings.from_name || businessName;
    const fromEmail = settings.from_email;
    const fromAddress = fromEmail ? `${fromName} <${fromEmail}>` : null;

    // Load SMS config once using unified sender
    const smsConfig = await loadSmsConfig(settings);

    const tripDate =
      trip.display_sms_datetime ||
      trip.display_full_datetime ||
      trip.start_time;

    // ── Helper: send SMS via unified sender ────────────────────────────────
    async function sendSmsTo(phone, message) {
      if (!phone) return;

      const result = await sendSms({
        to: phone,
        message,
        config: smsConfig,
        label: "PassengerCancellation",
      });

      if (result.success) {
        console.log(`[PassengerCancellation] ✅ SMS sent to ${phone}`);
      } else if (result.skipped) {
        console.log(
          `[PassengerCancellation] ⏭️  SMS skipped — ${result.reason}`,
        );
      } else {
        console.error(
          `[PassengerCancellation] ❌ SMS failed to ${phone}: ${result.error}`,
        );
      }
    }

    // ── Helper: build cancellation email HTML ────────────────────────────
    function buildCancellationEmailHtml(title, bodyContent, accentColor) {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${accentColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">${title}</h2>
          </div>
          <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            ${bodyContent}
          </div>
        </div>`;
    }

    if (decision === "cancelled") {
      console.log(
        `[Passenger Confirmation] ❌ Passenger cancelled — sending all notifications`,
      );

      const passengerFirstName = trip.passenger_name?.split(" ")[0] || "there";
      const reasonText = reason ? `\nReason: ${reason}` : "";

      // 1. SMS to PASSENGER — cancellation confirmation
      const passengerSms = `Hi ${passengerFirstName}, your trip with ${businessName} (Booking #${trip.booking_number}) on ${tripDate} has been cancelled per your request.${reasonText}\n\nWe hope to serve you again!`;
      await sendSmsTo(trip.client_phone, passengerSms);

      // 2. Email to PASSENGER — cancellation confirmation
      if (trip.client_email && fromAddress) {
        const passengerEmails = parseEmailAddresses(trip.client_email);
        for (const email of passengerEmails) {
          try {
            const passengerHtml = buildCancellationEmailHtml(
              "❌ Trip Cancellation Confirmed",
              `<p>Hi ${passengerFirstName},</p>
               <p>Your trip with <strong>${businessName}</strong> has been cancelled as requested.</p>
               <p><strong>Booking #:</strong> ${trip.booking_number}</p>
               <p><strong>Date:</strong> ${tripDate}</p>
               ${reason ? `<p><strong>Your reason:</strong> ${reason}</p>` : ""}
               <p>We hope to serve you again soon!</p>`,
              "#f97316",
            );
            await sendEmail({
              to: email,
              from: fromAddress,
              subject: `Trip Cancellation Confirmed — Booking #${trip.booking_number}`,
              text: `Hi ${passengerFirstName}, your trip #${trip.booking_number} with ${businessName} has been cancelled.`,
              html: passengerHtml,
            });
            console.log(
              `[PassengerCancellation] ✅ Email sent to passenger ${email}`,
            );
          } catch (e) {
            console.error(
              `[PassengerCancellation] Passenger email failed to ${email}:`,
              e.message,
            );
          }
        }
      }

      // 3. SMS to DRIVER — passenger cancelled
      if (trip.driver_phone) {
        const driverFirstName = trip.driver_name?.split(" ")[0] || "Driver";
        const driverSms = `⚠️ PASSENGER CANCELLED\nHi ${driverFirstName}, passenger ${trip.passenger_name} has CANCELLED trip #${trip.booking_number} scheduled for ${tripDate}.${reasonText}\n— ${businessName}`;
        await sendSmsTo(trip.driver_phone, driverSms);
      }

      // 4. Email to DRIVER — passenger cancelled
      if (trip.driver_email && fromAddress) {
        try {
          const driverFirstName = trip.driver_name?.split(" ")[0] || "Driver";
          const driverHtml = buildCancellationEmailHtml(
            "⚠️ Passenger Cancelled Their Trip",
            `<p>Hi ${driverFirstName},</p>
             <p>Your passenger has cancelled trip <strong>#${trip.booking_number}</strong>.</p>
             <p><strong>Passenger:</strong> ${trip.passenger_name}</p>
             <p><strong>Date:</strong> ${tripDate}</p>
             ${trip.destination || trip.dropoff_address ? `<p><strong>Destination:</strong> ${trip.dropoff_address || trip.destination}</p>` : ""}
             ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
             <p>Please contact the office for further instructions.</p>`,
            "#f97316",
          );
          await sendEmail({
            to: trip.driver_email,
            from: fromAddress,
            subject: `⚠️ Passenger Cancelled — Trip #${trip.booking_number}`,
            text: `Passenger ${trip.passenger_name} cancelled Trip #${trip.booking_number} on ${tripDate}.`,
            html: driverHtml,
          });
          console.log(
            `[PassengerCancellation] ✅ Email sent to driver ${trip.driver_email}`,
          );
        } catch (e) {
          console.error(
            "[PassengerCancellation] Driver email failed:",
            e.message,
          );
        }
      }

      // 5. SMS to OFFICE — urgent alert
      if (ownerPhone) {
        const officeSms = `🚨 URGENT: PASSENGER CANCELLED\nTrip #${trip.booking_number} — Passenger: ${trip.passenger_name}\nDate: ${tripDate}${trip.driver_name ? `\nDriver: ${trip.driver_name}` : ""}${reasonText}\n— ${businessName}`;
        await sendSmsTo(ownerPhone, officeSms);
      }

      // 6. Email to OFFICE — urgent alert
      if (ownerEmail && fromAddress) {
        try {
          const officeHtml = buildCancellationEmailHtml(
            "🚨 URGENT: PASSENGER CANCELLED THEIR TRIP",
            `<p><strong>Passenger:</strong> ${trip.passenger_name}</p>
             <p><strong>Booking #:</strong> ${trip.booking_number}</p>
             ${trip.driver_name ? `<p><strong>Driver:</strong> ${trip.driver_name}</p>` : ""}
             <p><strong>Date:</strong> ${tripDate}</p>
             ${trip.destination || trip.dropoff_address ? `<p><strong>Destination:</strong> ${trip.dropoff_address || trip.destination}</p>` : ""}
             ${reason ? `<div style="background:white;border-left:4px solid #dc2626;padding:12px;margin-top:16px;"><p style="margin:0;font-weight:bold;color:#dc2626;">Cancellation Reason:</p><p style="margin:8px 0 0 0;">${reason}</p></div>` : ""}
             <p style="margin-top:20px;color:#dc2626;font-weight:bold;">⚠️ Action needed: Review and handle this cancellation.</p>`,
            "#dc2626",
          );
          await sendEmail({
            to: ownerEmail,
            from: fromAddress,
            subject: `🚨 URGENT: PASSENGER CANCELLED — Trip #${trip.booking_number} | ${trip.passenger_name}`,
            text: `URGENT: Passenger ${trip.passenger_name} cancelled Trip #${trip.booking_number} on ${tripDate}.`,
            html: officeHtml,
          });
          console.log(
            `[PassengerCancellation] ✅ Urgent email sent to office ${ownerEmail}`,
          );
        } catch (e) {
          console.error(
            "[PassengerCancellation] Office email failed:",
            e.message,
          );
        }
      }

      // 7. Insert dispatcher alert (persistent banner until READ)
      try {
        await sql`
          INSERT INTO passenger_cancellation_alerts 
            (appointment_id, booking_number, passenger_name, cancellation_reason, trip_date, driver_name, is_read)
          VALUES 
            (${trip.id}, ${trip.booking_number}, ${trip.passenger_name}, ${reason || null}, ${trip.start_time}, ${trip.driver_name || null}, false)
        `;
        console.log(`[PassengerCancellation] ✅ Dispatcher alert inserted`);
      } catch (alertErr) {
        console.error(
          "[PassengerCancellation] Failed to insert dispatcher alert:",
          alertErr.message,
        );
      }
    } else {
      // CONFIRMED — send existing admin notification
      if (ownerEmail && fromAddress) {
        try {
          const subject = `✅ Passenger ${trip.passenger_name} CONFIRMED Trip ${trip.booking_number}`;
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#10b981;color:white;padding:20px;border-radius:8px 8px 0 0;">
                <h2 style="margin:0;">✅ Trip Confirmed</h2>
              </div>
              <div style="background:#f9fafb;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p><strong>Passenger:</strong> ${trip.passenger_name}</p>
                <p><strong>Booking:</strong> ${trip.booking_number}</p>
                ${trip.driver_name ? `<p><strong>Driver:</strong> ${trip.driver_name}</p>` : ""}
                <p><strong>Date:</strong> ${tripDate}</p>
                ${trip.destination ? `<p><strong>Destination:</strong> ${trip.destination}</p>` : ""}
              </div>
            </div>`;
          await sendEmail({
            to: ownerEmail,
            from: fromAddress,
            subject,
            text: subject,
            html,
          });
        } catch (e) {
          console.error(
            "[PassengerConfirmation] Admin email failed:",
            e.message,
          );
        }
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error processing passenger confirmation:", error);
    return Response.json(
      { error: "Failed to process response" },
      { status: 500 },
    );
  }
}
