/**
 * 5 PM Daily Reminder Endpoint
 * Sends reminder messages to passengers who haven't confirmed
 * and drivers who haven't accepted their trips in the next 24 hours
 */

import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { ensureAllTokens } from "@/app/api/utils/confirmations/tokenGenerator";
import { buildConfirmationUrls } from "@/app/api/utils/confirmations/urlBuilder";
import { loadSettings } from "@/app/api/utils/confirmations/settingsHelpers";
import {
  sendSms,
  logSmsToDatabase,
} from "@/app/api/utils/confirmations/smsHelpers";
import { sendSmsBatch } from "@/app/api/utils/sms-sender";
import { getAllPassengerEmails } from "@/app/api/utils/confirmations/emailHelpers";
import { logCommunicationFailure } from "@/app/api/utils/confirmations/failureLogger";
import { loadSmsConfig } from "@/app/api/utils/sms-sender";

const SEND_DELAY_MS = 300;
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build passenger reminder email HTML
 */
function buildPassengerReminderEmail(trip, urls, settings) {
  const businessName = settings.business_name || "Catch A Ride";
  const businessPhone = settings.business_phone || "";
  const firstName = trip.client_name?.split(" ")[0] || "there";

  const dateStr = new Date(trip.start_time).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const timeStr = new Date(trip.start_time).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const confirmUrl =
    urls.passengerTrip || urls.passengerConfirm || urls.tripDetails;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#8b5cf6;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${businessName}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#e9d5ff;font-weight:500;">Trip Confirmation Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Dear ${firstName},</p>
              
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                This is a follow-up on your trip <strong>#${trip.booking_number}</strong> on <strong>${dateStr}</strong> at <strong>${timeStr}</strong>.
              </p>
              
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Please confirm your trip by clicking the button below. ${businessPhone ? `Otherwise, call us at <strong>${businessPhone}</strong>.` : ""}
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <a href="${confirmUrl}" style="display:inline-block;background:#8b5cf6;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      Confirm Your Trip
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                Thank you and we look forward to seeing you.
              </p>
              
              <p style="margin:16px 0 0;font-size:15px;color:#374151;font-weight:600;">
                ${businessName}
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #f3f4f6;padding:16px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} ${businessName} · All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build driver reminder email HTML
 */
function buildDriverReminderEmail(trip, urls, settings) {
  const businessName = settings.business_name || "Catch A Ride";
  const firstName = trip.employee_name?.split(" ")[0] || "there";

  const dateStr = new Date(trip.start_time).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const timeStr = new Date(trip.start_time).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const confirmUrl = urls.driverTrip || urls.driverConfirm || urls.tripDetails;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#f59e0b;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;">${businessName}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#fef3c7;font-weight:500;">Trip Acceptance Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#111827;">Dear ${firstName},</p>
              
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                This is a follow-up on a trip assigned to you.
              </p>
              
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Trip <strong>#${trip.booking_number}</strong> on <strong>${dateStr}</strong> at <strong>${timeStr}</strong>.
              </p>
              
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                Please reply by clicking the acceptance button below. Otherwise, call the office immediately.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <a href="${confirmUrl}" style="display:inline-block;background:#f59e0b;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      Accept This Trip
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin:0;font-size:15px;color:#374151;line-height:1.6;">
                Thank you
              </p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #f3f4f6;padding:16px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                © ${new Date().getFullYear()} ${businessName} · All rights reserved
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build passenger reminder SMS
 */
function buildPassengerReminderSms(trip, urls, settings) {
  const businessName = settings.business_name || "Catch A Ride";
  const confirmUrl =
    urls.passengerTrip || urls.passengerConfirm || urls.tripDetails;

  return `Please approve your trip: ${confirmUrl} - ${businessName}`;
}

/**
 * Build driver reminder SMS
 */
function buildDriverReminderSms(trip, urls, settings) {
  const businessName = settings.business_name || "Catch A Ride";
  const confirmUrl = urls.driverTrip || urls.driverConfirm || urls.tripDetails;

  return `Please approve your trip: ${confirmUrl} - ${businessName}`;
}

/**
 * POST /api/reminders/send-5pm
 * Sends 5 PM reminder to all unconfirmed passengers and drivers
 */
export async function POST(request) {
  try {
    console.log("[5PM Reminder] Starting daily reminder job...");

    const settings = await loadSettings();
    const businessName = settings.business_name || "Catch A Ride";

    // Build from address
    const fromName = settings.from_name || businessName;
    const fromEmail = settings.from_email;
    const fromAddress = fromEmail ? `${fromName} <${fromEmail}>` : undefined;

    // Check global notification toggles
    const emailsEnabled = settings.send_emails !== "no";
    const smsEnabled = settings.send_sms !== "no";

    // FIXED: Get current time in America/Chicago timezone and calculate end of today (not +24 hours)
    // This ensures we only send reminders for trips happening TODAY, not tomorrow's trips
    const now = new Date();

    // Calculate end of today at 11:59:59 PM in Chicago timezone
    // Get the current date in Chicago timezone and set time to end of day
    const todayEndChicago = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Chicago" }),
    );
    todayEndChicago.setHours(23, 59, 59, 999);

    // Convert back to UTC for PostgreSQL comparison
    const todayEnd = new Date(
      todayEndChicago.toLocaleString("en-US", { timeZone: "UTC" }),
    );

    // FIXED: Find all trips happening TODAY (not next 24 hours) where passenger hasn't confirmed OR driver hasn't accepted
    const tripsNeedingReminders = await sql`
      SELECT 
        a.id,
        a.booking_number,
        a.start_time,
        a.passenger_confirmed,
        a.driver_accepted,
        a.passenger_confirmation_token,
        a.driver_confirmation_token,
        a.payment_method,
        a.payment_status,
        a.payment_amount,
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        c.notification_preference,
        c.cc_emails,
        e.id as employee_id,
        e.name as employee_name,
        e.email as employee_email,
        e.phone as employee_phone
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      WHERE 
        a.start_time >= NOW()
        AND a.start_time::date = CURRENT_DATE
        AND a.status NOT IN ('cancelled', 'completed')
        AND (
          a.passenger_confirmed = 'pending'
          OR a.driver_accepted = 'pending'
        )
      ORDER BY a.start_time ASC
    `;

    console.log(
      `[5PM Reminder] Found ${tripsNeedingReminders.length} trips needing reminders for today`,
    );

    const results = {
      passenger_emails: 0,
      passenger_sms: 0,
      driver_emails: 0,
      driver_sms: 0,
      errors: [],
    };

    // Process each trip
    const smsJobs = [];
    for (const trip of tripsNeedingReminders) {
      // Ensure tokens exist
      const tokens = await ensureAllTokens(trip.id);

      // Build URLs
      const urls = await buildConfirmationUrls(
        trip.id,
        tokens.passengerToken,
        tokens.driverToken,
        null, // no payment URL for reminders
      );

      // === SEND PASSENGER REMINDER ===
      if (trip.passenger_confirmed === "pending" && trip.client_id) {
        const preference = trip.notification_preference || "both";

        // Send email
        const passengerEmails = getAllPassengerEmails(trip);
        if (
          emailsEnabled &&
          passengerEmails.length > 0 &&
          (preference === "email" || preference === "both")
        ) {
          try {
            const html = buildPassengerReminderEmail(trip, urls, settings);
            const subject = `${businessName}: Confirmation Reminder - Trip #${trip.booking_number}`;

            for (let i = 0; i < passengerEmails.length; i++) {
              const email = passengerEmails[i];
              try {
                if (i > 0) await wait(SEND_DELAY_MS);

                await sendEmail({
                  to: email,
                  from: fromAddress,
                  subject,
                  html,
                  appointmentId: trip.id,
                  recipientName: trip.client_name,
                  emailType: "passenger_reminder_5pm",
                });

                results.passenger_emails++;
              } catch (err) {
                console.error(
                  `[5PM Reminder] Failed passenger email #${trip.booking_number}: ${err.message}`,
                );
                results.errors.push({
                  trip: trip.booking_number,
                  type: "passenger_email",
                  error: err.message,
                });

                await logCommunicationFailure({
                  appointmentId: trip.id,
                  bookingNumber: trip.booking_number,
                  passengerName: trip.client_name,
                  driverName: trip.employee_name,
                  channel: "email",
                  recipientType: "passenger",
                  recipientAddress: email,
                  eventType: "reminder_5pm",
                  errorMessage: err.message,
                  tripDate: trip.start_time,
                });
              }
            }
          } catch (err) {
            console.error(
              `[5PM Reminder] Passenger email error #${trip.booking_number}: ${err.message}`,
            );
            results.errors.push({
              trip: trip.booking_number,
              type: "passenger_email",
              error: err.message,
            });
          }
        }

        // Send SMS (collect job for batch sending later)
        if (
          smsEnabled &&
          trip.client_phone &&
          (preference === "sms" || preference === "both")
        ) {
          const smsMessage = buildPassengerReminderSms(trip, urls, settings);
          smsJobs.push({
            _meta: {
              tripId: trip.id,
              bookingNumber: trip.booking_number,
              recipientType: "passenger",
              recipientId: trip.client_id,
              phone: trip.client_phone,
              message: smsMessage,
              name: trip.client_name,
              driverName: trip.employee_name,
              startTime: trip.start_time,
            },
            to: trip.client_phone,
            message: smsMessage,
            label: "5PMReminder-Passenger",
            appointmentId: trip.id,
            clientId: trip.client_id,
            senderName: businessName,
            recipientType: "passenger",
            notificationType: "reminder_5pm",
            metadata: { reminder_type: "5pm_passenger" },
          });
        }
      }

      // === SEND DRIVER REMINDER ===
      if (trip.driver_accepted === "pending" && trip.employee_id) {
        // Send email
        if (emailsEnabled && trip.employee_email) {
          try {
            await wait(SEND_DELAY_MS);

            const html = buildDriverReminderEmail(trip, urls, settings);
            const subject = `${businessName}: Acceptance Reminder - Trip #${trip.booking_number}`;

            await sendEmail({
              to: trip.employee_email,
              from: fromAddress,
              subject,
              html,
              appointmentId: trip.id,
              recipientName: trip.employee_name,
              emailType: "driver_reminder_5pm",
            });

            results.driver_emails++;
          } catch (err) {
            console.error(
              `[5PM Reminder] Driver email error #${trip.booking_number}: ${err.message}`,
            );
            results.errors.push({
              trip: trip.booking_number,
              type: "driver_email",
              error: err.message,
            });

            await logCommunicationFailure({
              appointmentId: trip.id,
              bookingNumber: trip.booking_number,
              passengerName: trip.client_name,
              driverName: trip.employee_name,
              channel: "email",
              recipientType: "driver",
              recipientAddress: trip.employee_email,
              eventType: "reminder_5pm",
              errorMessage: err.message,
              tripDate: trip.start_time,
            });
          }
        }

        // Send SMS (collect job for batch sending later)
        if (smsEnabled && trip.employee_phone) {
          const smsMessage = buildDriverReminderSms(trip, urls, settings);
          smsJobs.push({
            _meta: {
              tripId: trip.id,
              bookingNumber: trip.booking_number,
              recipientType: "driver",
              recipientId: trip.employee_id,
              phone: trip.employee_phone,
              message: smsMessage,
              name: trip.employee_name,
              driverName: trip.employee_name,
              passengerName: trip.client_name,
              startTime: trip.start_time,
            },
            to: trip.employee_phone,
            message: smsMessage,
            label: "5PMReminder-Driver",
            appointmentId: trip.id,
            senderName: businessName,
            recipientType: "driver",
            notificationType: "reminder_5pm",
            metadata: { reminder_type: "5pm_driver" },
          });
        }
      }
    }

    // ── Batch-send all collected SMS jobs (batches of 10, 1.5s between batches) ──
    if (smsJobs.length > 0) {
      console.log(
        `[5PM Reminder] Sending ${smsJobs.length} SMS messages in batches...`,
      );

      // Throttled sequential send — 120 ms between each message, ~8/sec (Quo allows 10/sec)
      const batchResults = await sendSmsBatch({
        jobs: smsJobs,
        label: "5PMReminder",
      });

      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i];
        const meta = smsJobs[i]._meta;

        if (result.success) {
          if (meta.recipientType === "passenger") {
            results.passenger_sms++;
          } else {
            results.driver_sms++;
          }

          // Log to legacy database tables
          try {
            await logSmsToDatabase({
              appointmentId: meta.tripId,
              clientId:
                meta.recipientType === "passenger" ? meta.recipientId : null,
              recipientType: meta.recipientType,
              recipientId: meta.recipientId,
              phone: meta.phone,
              message: meta.message,
              senderName: businessName,
              eventType: "reminder_5pm",
              provider: settings.sms_provider || "Unknown",
              status: "sent",
            });
          } catch (logErr) {
            // Logging failure is non-critical
          }
        } else {
          console.error(
            `[5PM Reminder] SMS failed #${meta.bookingNumber} to ${meta.recipientType}: ${result.error}`,
          );
          results.errors.push({
            trip: meta.bookingNumber,
            type: `${meta.recipientType}_sms`,
            error: result.error,
          });

          await logCommunicationFailure({
            appointmentId: meta.tripId,
            bookingNumber: meta.bookingNumber,
            passengerName:
              meta.recipientType === "passenger"
                ? meta.name
                : meta.passengerName,
            driverName: meta.driverName,
            channel: "sms",
            recipientType: meta.recipientType,
            recipientAddress: meta.phone,
            eventType: "reminder_5pm",
            errorMessage: result.error,
            tripDate: meta.startTime,
          });
        }
      }
    }

    console.log(
      `[5PM Reminder] Completed: ${results.passenger_emails} passenger emails, ${results.passenger_sms} passenger SMS, ${results.driver_emails} driver emails, ${results.driver_sms} driver SMS, ${results.errors.length} errors`,
    );

    // Return minimal response for cron (detailed info in server logs)
    return Response.json({ success: true });
  } catch (error) {
    console.error("[5PM Reminder] Error:", error);
    return Response.json({ success: false }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, endpoint: "send-5pm", method: "POST" });
}
