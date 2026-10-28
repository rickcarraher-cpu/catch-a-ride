import sql from "@/app/api/utils/sql";
import {
  formatLongDate,
  formatTime,
} from "@/app/api/utils/notifications/formatters";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const tenantId = 1;

    // Fetch wedding with all related data
    const [wedding] = await sql`
      SELECT 
        w.*,
        c.name as client_name,
        c.phone as client_phone,
        c.email as client_email
      FROM weddings w
      LEFT JOIN clients c ON w.client_id = c.id
      WHERE w.id = ${id} AND w.tenant_id = ${tenantId}
    `;

    if (!wedding) {
      return Response.json({ error: "Wedding not found" }, { status: 404 });
    }

    if (!wedding.coordinator_email) {
      return Response.json(
        { error: "No coordinator email on file" },
        { status: 400 },
      );
    }

    // Fetch all trips for this wedding
    const trips = await sql`
      SELECT 
        a.*,
        e.name as employee_name,
        v.name as vehicle_name,
        c.name as passenger_name
      FROM appointments a
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN clients c ON a.client_id = c.id
      WHERE a.wedding_id = ${id}
        AND a.tenant_id = ${tenantId}
      ORDER BY a.start_time ASC
    `;

    // Fetch settings for email configuration
    const settings = {};
    const settingsRows = await sql`
      SELECT key, value 
      FROM settings 
      WHERE tenant_id = ${tenantId}
    `;
    settingsRows.forEach((row) => {
      settings[row.key] = row.value;
    });

    const businessName = settings.business_name || "Catch A Ride";
    const ownerEmail = settings.owner_email || "noreply@example.com";
    const fromAddress = settings.from_email_address || ownerEmail;

    // Build email content
    const coordinatorName = wedding.coordinator_name || "Coordinator";
    const firstName = coordinatorName.split(" ")[0];

    const subjectLine = `${businessName} — Wedding Transportation Summary for ${wedding.venue_name}`;

    // Calculate totals
    const totalTripsAmount = trips.reduce(
      (sum, t) => sum + Number(t.services_total || 0),
      0,
    );
    const totalPaid = trips.reduce(
      (sum, t) => sum + Number(t.payments_total || 0),
      0,
    );
    const packagePrice = Number(wedding.package_price) || 0;
    const finalAmount = packagePrice > 0 ? packagePrice : totalTripsAmount;
    const balanceDue = finalAmount - totalPaid;

    // Build trip rows HTML
    const baseUrl = (
      process.env.NEXT_PUBLIC_CREATE_APP_URL ||
      process.env.AUTH_URL ||
      process.env.BETTER_AUTH_URL ||
      ""
    ).replace(/\/+$/, "");

    let tripRowsHtml = "";
    trips.forEach((trip, index) => {
      const tripBalanceDue = Number(trip.balance_due || 0);
      const isPaid = trip.payment_status === "paid" || tripBalanceDue <= 0;
      const paymentLinkUrl = isPaid
        ? ""
        : `${baseUrl}/api/payments/trip/${trip.id}/generate?provider=square&type=checkout`;

      tripRowsHtml += `
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:16px 12px;font-size:13px;color:#111827;font-weight:600;">
            #${index + 1}
          </td>
          <td style="padding:16px 12px;font-size:13px;color:#374151;">
            ${formatLongDate(trip.start_time)}<br/>
            <span style="font-size:12px;color:#6b7280;">${formatTime(trip.start_time)}</span>
          </td>
          <td style="padding:16px 12px;font-size:13px;color:#374151;">
            ${trip.passenger_name || "Not assigned"}
          </td>
          <td style="padding:16px 12px;font-size:13px;color:#374151;">
            ${trip.employee_name || "Unassigned"}
          </td>
          <td style="padding:16px 12px;font-size:13px;color:#374151;">
            ${trip.vehicle_name || "—"}
          </td>
          <td style="padding:16px 12px;font-size:13px;color:#111827;font-weight:600;text-align:right;">
            $${Number(trip.services_total || 0).toFixed(2)}
          </td>
          <td style="padding:16px 12px;text-align:center;">
            ${
              isPaid
                ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">✓ Paid</span>`
                : `<span style="display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">Unpaid</span>`
            }
          </td>
          <td style="padding:16px 12px;text-align:center;">
            ${
              isPaid
                ? `<span style="font-size:12px;color:#9ca3af;">—</span>`
                : `<a href="${paymentLinkUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:8px;text-decoration:none;text-align:center;">Pay Now</a>`
            }
          </td>
        </tr>
      `;
    });

    // Build HTML email
    const htmlEmail = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:900px;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #ec4899 0%, #f43f5e 100%);border-radius:12px 12px 0 0;padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:28px;font-weight:700;color:#ffffff;">${businessName}</p>
              <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:6px 16px;border-radius:999px;">💒 Wedding Transportation Summary</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
              
              <!-- Greeting -->
              <div style="padding:32px 24px 24px;">
                <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p>
                <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                  Below is the complete transportation summary for the wedding at <strong>${wedding.venue_name}</strong> on <strong>${formatLongDate(wedding.wedding_date)}</strong>.
                </p>
              </div>

              <!-- Wedding Details Card -->
              <div style="margin:0 24px 24px;background:#fdf4ff;border:1.5px solid #f3e8ff;border-radius:12px;padding:20px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#86198f;text-transform:uppercase;letter-spacing:0.5px;">Wedding Details</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b21a8;font-weight:600;">Venue:</td>
                    <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;">${wedding.venue_name}</td>
                  </tr>
                  ${
                    wedding.venue_address
                      ? `<tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b21a8;font-weight:600;">Address:</td>
                    <td style="padding:5px 0;font-size:13px;color:#374151;text-align:right;">${wedding.venue_address}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b21a8;font-weight:600;">Wedding Date:</td>
                    <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:600;text-align:right;">${formatLongDate(wedding.wedding_date)}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b21a8;font-weight:600;">Client:</td>
                    <td style="padding:5px 0;font-size:13px;color:#374151;text-align:right;">${wedding.client_name || "Not assigned"}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#6b21a8;font-weight:600;">Total Trips:</td>
                    <td style="padding:5px 0;font-size:14px;color:#111827;font-weight:700;text-align:right;">${trips.length}</td>
                  </tr>
                </table>
              </div>

              <!-- Trips Table -->
              <div style="margin:0 24px 24px;overflow-x:auto;">
                <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111827;">Transportation Schedule</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                  <thead>
                    <tr style="background:#f9fafb;">
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e5e7eb;">#</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e5e7eb;">Date & Time</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e5e7eb;">Passenger</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e5e7eb;">Driver</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e5e7eb;">Vehicle</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-bottom:2px solid #e5e7eb;">Price</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border-bottom:2px solid #e5e7eb;">Status</th>
                      <th style="padding:12px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border-bottom:2px solid #e5e7eb;">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tripRowsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Pricing Summary -->
              <div style="margin:0 24px 24px;background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:12px;padding:20px;">
                <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:0.5px;">Pricing Summary</p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">Total Services:</td>
                    <td style="padding:6px 0;font-size:15px;color:#111827;font-weight:600;text-align:right;">$${totalTripsAmount.toFixed(2)}</td>
                  </tr>
                  ${
                    packagePrice > 0
                      ? `<tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">Package Price:</td>
                    <td style="padding:6px 0;font-size:15px;color:#111827;font-weight:600;text-align:right;">$${packagePrice.toFixed(2)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td style="padding:6px 0;font-size:14px;color:#374151;">Total Paid:</td>
                    <td style="padding:6px 0;font-size:15px;color:#059669;font-weight:600;text-align:right;">$${totalPaid.toFixed(2)}</td>
                  </tr>
                  <tr style="border-top:2px solid #6ee7b7;">
                    <td style="padding:12px 0 0;font-size:16px;color:#065f46;font-weight:700;">Balance Due:</td>
                    <td style="padding:12px 0 0;font-size:20px;color:#065f46;font-weight:700;text-align:right;">$${balanceDue.toFixed(2)}</td>
                  </tr>
                </table>
              </div>

              ${
                wedding.special_instructions
                  ? `
              <!-- Special Instructions -->
              <div style="margin:0 24px 24px;background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;padding:20px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;">Special Instructions</p>
                <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">${wedding.special_instructions}</p>
              </div>
              `
                  : ""
              }

              <!-- Footer Message -->
              <div style="padding:0 24px 24px;">
                <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">
                  If you have any questions or need to make changes, please don't hesitate to contact us.
                </p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  Looking forward to making this special day perfect!
                </p>
                <p style="margin:16px 0 0;font-size:14px;color:#374151;font-weight:600;">
                  — ${businessName}
                </p>
              </div>

              <!-- Contact Info -->
              <div style="border-top:1px solid #f3f4f6;padding:16px 24px;text-align:center;">
                ${ownerEmail ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">📧 ${ownerEmail}</p>` : ""}
                ${settings.business_phone ? `<p style="margin:0;font-size:13px;color:#6b7280;">📞 ${settings.business_phone}</p>` : ""}
              </div>

              <!-- Copyright -->
              <div style="padding:12px 24px;text-align:center;">
                <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Build plain text version
    let plainText = `Hi ${firstName},\n\nBelow is the complete transportation summary for the wedding at ${wedding.venue_name} on ${formatLongDate(wedding.wedding_date)}.\n\n`;
    plainText += `WEDDING DETAILS\n`;
    plainText += `Venue: ${wedding.venue_name}\n`;
    if (wedding.venue_address)
      plainText += `Address: ${wedding.venue_address}\n`;
    plainText += `Wedding Date: ${formatLongDate(wedding.wedding_date)}\n`;
    plainText += `Client: ${wedding.client_name || "Not assigned"}\n`;
    plainText += `Total Trips: ${trips.length}\n\n`;
    plainText += `TRANSPORTATION SCHEDULE\n`;
    plainText += `${"=".repeat(80)}\n`;
    trips.forEach((trip, index) => {
      plainText += `\nTrip #${index + 1}\n`;
      plainText += `Date & Time: ${formatLongDate(trip.start_time)} at ${formatTime(trip.start_time)}\n`;
      plainText += `Passenger: ${trip.passenger_name || "Not assigned"}\n`;
      plainText += `Driver: ${trip.employee_name || "Unassigned"}\n`;
      plainText += `Vehicle: ${trip.vehicle_name || "—"}\n`;
      plainText += `Price: $${Number(trip.services_total || 0).toFixed(2)}\n`;
      plainText += `Status: ${trip.payment_status === "paid" ? "PAID" : "UNPAID"}\n`;
      if (trip.payment_status !== "paid") {
        const paymentUrl = `${baseUrl}/api/payments/trip/${trip.id}/generate?provider=square&type=checkout`;
        plainText += `Payment Link: ${paymentUrl}\n`;
      }
      plainText += `${"-".repeat(80)}\n`;
    });
    plainText += `\nPRICING SUMMARY\n`;
    plainText += `Total Services: $${totalTripsAmount.toFixed(2)}\n`;
    if (packagePrice > 0)
      plainText += `Package Price: $${packagePrice.toFixed(2)}\n`;
    plainText += `Total Paid: $${totalPaid.toFixed(2)}\n`;
    plainText += `Balance Due: $${balanceDue.toFixed(2)}\n\n`;
    if (wedding.special_instructions) {
      plainText += `SPECIAL INSTRUCTIONS\n${wedding.special_instructions}\n\n`;
    }
    plainText += `If you have any questions or need to make changes, please don't hesitate to contact us.\n\n`;
    plainText += `Looking forward to making this special day perfect!\n\n`;
    plainText += `— ${businessName}\n`;

    // Send email
    await sendEmail({
      to: wedding.coordinator_email,
      from: fromAddress,
      subject: subjectLine,
      text: plainText,
      html: htmlEmail,
    });

    console.log(
      `[Wedding Coordinator Summary] ✅ Sent to ${wedding.coordinator_email} for wedding #${wedding.id}`,
    );

    // Also send driver notifications for each assigned trip
    const driverNotificationResults = [];
    for (const trip of trips) {
      if (!trip.employee_id) continue;
      try {
        const result = await sendConfirmations({
          appointmentId: trip.id,
          eventType: "driver_assigned",
          notifyPassenger: false,
          notifyDriver: true,
          notifyOffice: false,
        });
        driverNotificationResults.push({ tripId: trip.id, sent: true });
        console.log(`[Wedding] Driver notification sent for trip #${trip.id}`);
      } catch (err) {
        console.error(
          `[Wedding] Failed driver notification for trip #${trip.id}:`,
          err.message,
        );
        driverNotificationResults.push({
          tripId: trip.id,
          sent: false,
          error: err.message,
        });
      }
    }

    return Response.json({
      success: true,
      message: `Summary sent to ${wedding.coordinator_email}`,
      trips_count: trips.length,
      driver_notifications: driverNotificationResults,
    });
  } catch (error) {
    console.error("Error sending coordinator summary:", error);
    return Response.json(
      { error: "Failed to send coordinator summary" },
      { status: 500 },
    );
  }
}
