import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { isBeforeInCDT } from "@/utils/timezone";

export async function GET(request, { params }) {
  try {
    const { token } = params;

    // Find trip by driver confirmation token
    const rows = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
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
        a.notes,
        a.driver_notes,
        a.driver_accepted,
        a.driver_response_at,
        a.original_amount,
        a.payment_method,
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
        e.phone as driver_phone,
        e.profile_image_url as driver_photo_url,
        v.name as vehicle_name,
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.appointment_id = a.id
           AND t.category IN ('payment', 'cc_fee')), 0
        ) AS payments_total,
        COALESCE(a.original_amount, 0) - COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           WHERE t.appointment_id = a.id
           AND t.category IN ('payment', 'cc_fee')), 0
        ) AS balance_due
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.driver_confirmation_token = ${token}
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 },
      );
    }

    const trip = rows[0];

    // Load services for this trip
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

    // Fetch credit card fee percent from settings
    const feeSettingsRows = await sql`
      SELECT value FROM settings 
      WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
    `;
    trip.credit_card_fee_percent =
      feeSettingsRows.length > 0 ? Number(feeSettingsRows[0].value) : 4;

    // Removed date restriction - drivers can always view their trip details
    // even after the trip has passed

    return Response.json({ trip });
  } catch (error) {
    console.error("Error fetching driver confirmation:", error);
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

    console.log(
      `\n[Driver Confirmation] ========================================`,
    );
    console.log(`[Driver Confirmation] Token: ${token}`);
    console.log(`[Driver Confirmation] Decision: ${decision}`);
    console.log(`[Driver Confirmation] Reason: ${reason || "N/A"}`);
    console.log(
      `[Driver Confirmation] ========================================\n`,
    );

    if (!["accepted", "declined"].includes(decision)) {
      return Response.json({ error: "Invalid decision" }, { status: 400 });
    }

    // Find trip
    const rows = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.driver_response_at,
        a.passenger_confirmed,
        a.destination,
        a.pickup_address,
        a.dropoff_address,
        a.display_sms_datetime,
        a.display_full_datetime,
        e.name as driver_name,
        e.email as driver_email,
        c.name as passenger_name,
        c.email as passenger_email
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.driver_confirmation_token = ${token}
    `;

    if (rows.length === 0) {
      return Response.json(
        { error: "Invalid or expired confirmation link" },
        { status: 404 },
      );
    }

    const trip = rows[0];

    console.log(`[Driver Confirmation] Trip found: #${trip.booking_number}`);
    console.log(`[Driver Confirmation] Driver: ${trip.driver_name}`);
    console.log(`[Driver Confirmation] Passenger: ${trip.passenger_name}`);
    console.log(
      `[Driver Confirmation] Passenger confirmed: ${trip.passenger_confirmed}`,
    );

    // Check if already responded
    if (trip.driver_response_at) {
      return Response.json(
        { error: "You already responded to this trip" },
        { status: 400 },
      );
    }

    // Update appointment
    if (decision === "declined") {
      // If driver declined, unassign them and revert status to pending
      await sql`
        UPDATE appointments
        SET 
          driver_accepted = ${decision},
          driver_declined_reason = ${reason},
          driver_response_at = NOW(),
          employee_id = NULL,
          status = CASE 
            WHEN status IN ('confirmed', 'needs_review') THEN 'pending'
            ELSE status
          END
        WHERE driver_confirmation_token = ${token}
      `;
      console.log(
        `[Driver Confirmation] Driver declined - trip unassigned and reverted to pending`,
      );
    } else {
      // Driver accepted - check if passenger has also confirmed
      const passengerConfirmed = trip.passenger_confirmed === "confirmed";
      const shouldMarkConfirmed = passengerConfirmed;

      if (shouldMarkConfirmed) {
        console.log(
          `[Driver Confirmation] ✅ BOTH driver accepted AND passenger confirmed - setting status to 'confirmed'`,
        );
      } else {
        console.log(
          `[Driver Confirmation] ⏳ Driver accepted, but passenger hasn't confirmed yet - promoting out of needs_review if applicable`,
        );
      }

      await sql`
        UPDATE appointments
        SET 
          driver_accepted = ${decision},
          driver_declined_reason = NULL,
          driver_response_at = NOW(),
          status = CASE
            WHEN ${shouldMarkConfirmed} THEN 'confirmed'
            WHEN status = 'needs_review' THEN 'pending'
            ELSE status
          END
        WHERE driver_confirmation_token = ${token}
      `;
    }

    console.log(
      `[Driver Confirmation] Database updated with decision: ${decision}`,
    );

    // Send notification to admin
    try {
      const settings =
        await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
      const settingsMap = {};
      settings.forEach((row) => {
        settingsMap[row.key] = row.value;
      });

      const ownerEmail = settingsMap.owner_email;
      const fromAddress = settingsMap.from_email || "noreply@example.com";

      console.log(`[Driver Confirmation] Preparing owner notification email`);
      console.log(`[Driver Confirmation] Owner email: ${ownerEmail}`);
      console.log(`[Driver Confirmation] From address: ${fromAddress}`);

      if (ownerEmail) {
        // Explicitly set subject and badge color based on decision
        const isAccepted = decision === "accepted";
        const badgeColor = isAccepted ? "#10b981" : "#f97316";
        const badgeText = isAccepted ? "✅ Trip Accepted" : "❌ Trip Declined";
        const subject = isAccepted
          ? `✅ Driver ${trip.driver_name} ACCEPTED Trip ${trip.booking_number}`
          : `❌ Driver ${trip.driver_name} DECLINED Trip ${trip.booking_number}`;

        console.log(`[Driver Confirmation] Email subject: ${subject}`);
        console.log(`[Driver Confirmation] Badge text: ${badgeText}`);

        const tripDate =
          trip.display_sms_datetime ||
          trip.display_full_datetime ||
          trip.start_time;

        let message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${badgeColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${badgeText}</h2>
            </div>
            <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p><strong>Driver:</strong> ${trip.driver_name}</p>
              <p><strong>Booking:</strong> #${trip.booking_number}</p>
              <p><strong>Passenger:</strong> ${trip.passenger_name}</p>
              <p><strong>Date:</strong> ${tripDate}</p>
              ${trip.destination ? `<p><strong>Destination:</strong> ${trip.destination}</p>` : ""}
              ${trip.pickup_address ? `<p><strong>Pickup:</strong> ${trip.pickup_address}</p>` : ""}
              ${trip.dropoff_address ? `<p><strong>Dropoff:</strong> ${trip.dropoff_address}</p>` : ""}
        `;

        if (decision === "declined" && reason) {
          message += `
              <div style="background: white; border-left: 4px solid #f97316; padding: 12px; margin-top: 16px;">
                <p style="margin: 0; font-weight: bold; color: #f97316;">Reason for declining:</p>
                <p style="margin: 8px 0 0 0;">${reason}</p>
              </div>
          `;
        }

        message += `
              ${decision === "declined" ? '<p style="margin-top: 20px; color: #dc2626; font-weight: bold;">⚠️ Action needed: Trip has been unassigned and reverted to pending - please assign a new driver</p>' : ""}
            </div>
          </div>
        `;

        const plainText = `${subject}

Driver: ${trip.driver_name}
Booking: #${trip.booking_number}
Passenger: ${trip.passenger_name}
Date: ${tripDate}
${trip.destination ? `Destination: ${trip.destination}` : ""}
${trip.pickup_address ? `Pickup: ${trip.pickup_address}` : ""}
${trip.dropoff_address ? `Dropoff: ${trip.dropoff_address}` : ""}
${decision === "declined" && reason ? `\nReason for declining: ${reason}` : ""}
${decision === "declined" ? "\n⚠️ Action needed: Trip has been unassigned and reverted to pending - please assign a new driver" : ""}`;

        console.log(`[Driver Confirmation] Sending email to owner...`);

        await sendEmail({
          to: ownerEmail,
          from: fromAddress,
          subject: subject,
          text: plainText,
          html: message,
        });

        console.log(
          `[Driver Confirmation] ✅ Owner notification email sent successfully`,
        );
      } else {
        console.log(
          `[Driver Confirmation] ⚠️ No owner email configured, skipping notification`,
        );
      }
    } catch (emailError) {
      console.error(
        "[Driver Confirmation] ❌ Failed to send admin notification:",
        emailError,
      );
      console.error("[Driver Confirmation] Error details:", emailError.message);
      console.error("[Driver Confirmation] Error stack:", emailError.stack);
      // Don't fail the request if email fails
    }

    console.log(
      `[Driver Confirmation] ✅ Process complete for trip #${trip.booking_number}\n`,
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error(
      "[Driver Confirmation] ❌ Error processing driver confirmation:",
      error,
    );
    console.error("[Driver Confirmation] Error details:", error.message);
    console.error("[Driver Confirmation] Error stack:", error.stack);
    return Response.json(
      { error: "Failed to process response" },
      { status: 500 },
    );
  }
}
