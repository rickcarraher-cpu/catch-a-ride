import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { sendSmsAndLog, loadSmsConfig } from "@/app/api/utils/sms-sender";
import {
  findOrCreateConversationForAppointment,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

// Helper to parse comma-separated emails
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { method } = await request.json();

    // Get appointment and client details
    const appointment = await sql`
      SELECT 
        a.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        c.cc_emails as cc_emails,
        e.name as driver_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE a.id = ${id}
    `;

    if (!appointment || appointment.length === 0) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    const trip = appointment[0];
    const receiptUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/receipt/${id}`;

    // Get settings for SMS provider configuration and business info
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    const businessName = settings.business_name || "Limo Service";

    if (method === "email") {
      // Send email with receipt link
      // Parse all passenger emails (primary + cc) first
      const passengerEmails = [];
      if (trip.client_email)
        passengerEmails.push(...parseEmailAddresses(trip.client_email));
      if (trip.cc_emails)
        passengerEmails.push(...parseEmailAddresses(trip.cc_emails));
      const uniqueEmails = [
        ...new Set(passengerEmails.map((e) => e.toLowerCase())),
      ].map((lower) => passengerEmails.find((e) => e.toLowerCase() === lower));

      if (uniqueEmails.length === 0) {
        return Response.json(
          {
            error:
              "Client has no email address (no primary email and no cc_emails)",
          },
          { status: 400 },
        );
      }

      const fromName = settings.from_name || businessName;
      const fromAddress = settings.from_email
        ? `${fromName} <${settings.from_email}>`
        : undefined;

      // Format trip date directly from the trip record in Central Time
      const tripDateDisplay = trip.start_time
        ? new Date(trip.start_time).toLocaleDateString("en-US", {
            timeZone: "America/Chicago",
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "";

      const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563EB;">Trip Receipt</h2>
            <p>Hi ${trip.client_name},</p>
            <p>Thank you for your business! Here is your receipt for your recent trip.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Booking Number:</strong> ${trip.booking_number || id}</p>
              <p style="margin: 5px 0;"><strong>Date:</strong> ${tripDateDisplay}</p>
              ${
                trip.destination
                  ? `<p style="margin: 5px 0;"><strong>Destination:</strong> ${trip.destination}</p>`
                  : ""
              }
              <p style="margin: 5px 0;"><strong>Amount:</strong> $${parseFloat(
                trip.payment_amount || 0,
              ).toFixed(2)}</p>
              ${
                parseFloat(trip.tips_total || 0) > 0
                  ? `<p style="margin: 5px 0;"><strong>Tip:</strong> $${parseFloat(trip.tips_total).toFixed(2)}</p>`
                  : ""
              }
              <p style="margin: 5px 0;"><strong>Status:</strong> ${trip.payment_status === "paid" ? "Paid" : "Pending"}</p>
            </div>
            
            <p>
              <a href="${receiptUrl}" 
                 style="display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                View Full Receipt
              </a>
            </p>
            
            <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
              If you have any questions, please don't hesitate to contact us.
            </p>
          </div>
        `;

      // Send to each email address individually
      for (const email of uniqueEmails) {
        try {
          await sendEmail({
            to: email,
            from: fromAddress,
            subject: `Receipt for your trip - Booking #${trip.booking_number || id}`,
            html: emailHtml,
            appointmentId: parseInt(id),
            recipientName: trip.client_name,
            emailType: "receipt",
            skipLog: true, // We manually log below to avoid duplicate entries
          });
          console.log(`[Receipt→Email] ✅ Sent to ${email}`);
        } catch (emailErr) {
          console.error(
            `[Receipt→Email] ❌ Failed to send to ${email}:`,
            emailErr.message,
          );
        }
      }

      // Log the email
      await sql`
        INSERT INTO email_logs 
        (appointment_id, recipient_email, recipient_name, subject, body, email_type, status)
        VALUES 
        (${id}, ${trip.client_email}, ${trip.client_name}, 
         ${"Receipt for trip #" + (trip.booking_number || id)}, 
         ${"Receipt sent via email"}, 
         ${"receipt"}, 
         ${"sent"})
      `;

      return Response.json({ success: true, method: "email" });
    } else if (method === "sms") {
      // Send SMS with link
      if (!trip.client_phone) {
        return Response.json(
          { error: "Client has no phone number" },
          { status: 400 },
        );
      }

      const firstName = trip.client_name?.split(" ")[0] || "there";
      const message = `Hi ${firstName}, here is your receipt for trip #${trip.booking_number || id}: ${receiptUrl}\n\nThank you for choosing ${businessName}!`;

      // Load SMS config using unified sender
      const smsConfig = await loadSmsConfig(settings);

      if (!smsConfig.ready) {
        return Response.json({ error: smsConfig.reason }, { status: 400 });
      }

      // Find or create conversation
      let conversationId = null;
      try {
        conversationId = await findOrCreateConversationForAppointment(id, 1);
      } catch (convErr) {
        console.error("[Receipt SMS] Failed to create conversation:", convErr);
      }

      // Send via unified sender
      const result = await sendSmsAndLog({
        to: trip.client_phone,
        message,
        config: smsConfig,
        label: "Receipt→SMS",
        appointmentId: id,
        clientId: trip.client_id || null,
        conversationId,
        senderName: trip.client_name || "Passenger",
        recipientType: "passenger",
        notificationType: "receipt",
      });

      if (!result.success) {
        return Response.json(
          { error: result.error || "Failed to send SMS" },
          { status: 500 },
        );
      }

      return Response.json({ success: true, method: "sms" });
    }

    return Response.json({ error: "Invalid method" }, { status: 400 });
  } catch (error) {
    console.error("Error sending receipt:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
