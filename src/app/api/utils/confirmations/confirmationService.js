/**
 * Centralized Confirmation Service
 * Single source of truth for all trip confirmations
 */

import { ensureAllTokens } from "./tokenGenerator.js";
import { sendEmail } from "@/app/api/utils/send-email.js";
import { loadTripData } from "./tripDataLoader.js";
import { loadSettings, getOfficeEmail } from "./settingsHelpers.js";
import { buildConfirmationUrls } from "./urlBuilder.js";
import { buildPassengerConfirmationEmail } from "./passengerEmailBuilder.js";
import { buildDriverConfirmationEmail } from "./driverEmailBuilder.js";
import { buildOfficeEmail } from "./officeEmailBuilder.js";
import { buildPassengerSms, buildDriverSms } from "./smsBuilders.js";
import {
  sendSms,
  logSmsToDatabase,
  wasRecentAppointmentSmsSent,
} from "./smsHelpers.js";
import {
  getAllPassengerEmails,
  getLocationNotificationEmails,
  wasRecentAppointmentEmailSent,
} from "./emailHelpers.js";
import { logCommunicationFailure } from "./failureLogger.js";

// Small delay between API calls within a single confirmation to stay under rate limits
const SEND_DELAY_MS = 300;
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main confirmation service - sends all confirmations for a trip event
 *
 * @param {Object} options
 * @param {number} options.appointmentId - Trip ID
 * @param {string} options.eventType - Event type (booking_created, booking_changed, driver_removed, etc.)
 * @param {boolean} options.notifyPassenger - Send to passenger (default: true)
 * @param {boolean} options.notifyDriver - Send to driver (default: true if driver assigned)
 * @param {boolean} options.notifyOffice - Send to office (default: true)
 * @param {Array<string>} options.changedFields - List of field labels that changed (for booking_changed)
 * @param {string} options.channelFilter - Filter by channel: 'email', 'sms', or 'all' (default: 'all')
 * @param {number} options.oldDriverId - Old driver ID for driver_removed event
 * @param {string} options.oldDriverName - Old driver name for driver_removed event
 * @param {string} options.oldDriverEmail - Old driver email for driver_removed event
 * @param {string} options.oldDriverPhone - Old driver phone for driver_removed event
 */
export async function sendConfirmations({
  appointmentId,
  eventType,
  notifyPassenger = true,
  notifyDriver = true,
  notifyOffice = true,
  changedFields,
  channelFilter = "all",
  oldDriverId = null,
  oldDriverName = null,
  oldDriverEmail = null,
  oldDriverPhone = null,
}) {
  try {
    // Normalize changedFields to array (in case it comes as a Set or is undefined)
    const changedFieldsList = changedFields ? Array.from(changedFields) : [];

    // Load all data
    const data = await loadTripData(appointmentId);
    const settings = await loadSettings();
    data.settings = settings;

    const { trip } = data;

    // Build from address from settings
    const fromName =
      settings.from_name || settings.business_name || "Catch A Ride";
    const fromEmail = settings.from_email;
    const fromAddress = fromEmail ? `${fromName} <${fromEmail}>` : undefined;

    // === DEBUG: Show what data will be passed to email/SMS builders ===
    console.log(
      `[sendConfirmations] Data loaded for trip #${trip.booking_number || trip.id}:`,
    );
    console.log(`  - trip.payment_method: "${trip.payment_method || "NULL"}"`);
    console.log(`  - trip.payment_status: "${trip.payment_status || "NULL"}"`);
    console.log(`  - trip.payment_amount: ${trip.payment_amount || "NULL"}`);
    console.log(
      `  - data.paymentUrl: ${data.paymentUrl ? `"${data.paymentUrl}"` : "NULL"}`,
    );
    console.log(`  - data.balance: $${data.balance.toFixed(2)}`);
    console.log(`  - data.totalAmount: $${data.totalAmount.toFixed(2)}`);
    console.log(`  - This data will be passed to email and SMS builders`);
    console.log(`  - channelFilter: ${channelFilter}`);
    // === END DEBUG ===

    // Check global notification toggles and apply channel filter
    const emailsEnabled =
      settings.send_emails !== "no" &&
      (channelFilter === "all" || channelFilter === "email");
    const smsEnabled =
      settings.send_sms !== "no" &&
      (channelFilter === "all" || channelFilter === "sms");

    // Check if driver portal-only mode is enabled
    const driverPortalOnly = settings.driver_portal_only === "yes";

    // Check if driver confirmations are suppressed
    const suppressDriverConfirmations =
      settings.suppress_driver_confirmations === "yes";

    // Ensure tokens exist
    const tokens = await ensureAllTokens(appointmentId);

    // Build all URLs (shortened)
    const urls = await buildConfirmationUrls(
      appointmentId,
      tokens.passengerToken,
      tokens.driverToken,
      data.paymentUrl,
    );

    const results = {
      passenger: { email: null, sms: null },
      driver: { email: null, sms: null },
      office: { email: null },
      location: { email: null },
    };

    // === PASSENGER NOTIFICATIONS ===
    if (notifyPassenger && trip.client_id) {
      const preference = trip.notification_preference || "both";

      console.log(
        `[Confirmation] Passenger notifications for trip #${trip.booking_number || trip.id}:`,
      );
      console.log(`  - client_id: ${trip.client_id}`);
      console.log(`  - client_phone: ${trip.client_phone || "MISSING"}`);
      console.log(`  - client_email: ${trip.client_email || "MISSING"}`);
      console.log(`  - cc_emails: ${trip.cc_emails || "MISSING"}`);
      console.log(`  - notification_preference: ${preference}`);
      console.log(`  - smsEnabled (global): ${smsEnabled}`);
      console.log(`  - emailsEnabled (global): ${emailsEnabled}`);

      // Passenger Email — send if ANY email address exists (primary OR cc_emails)
      const passengerEmailsForGating = getAllPassengerEmails(trip);
      if (
        emailsEnabled &&
        passengerEmailsForGating.length > 0 &&
        (preference === "email" || preference === "both")
      ) {
        try {
          const html = buildPassengerConfirmationEmail(
            data,
            urls,
            eventType,
            changedFieldsList,
          );
          const reasonLabel =
            {
              booking_created: "NEW",
              booking_changed: "UPDATED",
              booking_cancelled: "CANCELLED",
              booking_deleted: "REMOVED",
              driver_assigned: "DRIVER ASSIGNED",
            }[eventType] || "CONFIRMATION";

          // Use simplified subject for passenger-booked trips
          const isPassengerBooking =
            trip.booked_by === "Passenger" || trip.status === "needs_review";
          const emailSubject =
            isPassengerBooking && eventType === "booking_created"
              ? `${settings.business_name || "Catch A Ride"}: Booking Request Received`
              : `${settings.business_name || "Catch A Ride"}: Trip #${trip.booking_number || trip.id} (${reasonLabel})`;

          // Send to all passenger emails (primary + cc_emails)
          const passengerEmails = getAllPassengerEmails(trip);
          console.log(
            `[Confirmation] Sending passenger email to ${passengerEmails.length} address(es): ${passengerEmails.join(", ")}`,
          );

          // ── Appointment-level email dedup ─────────────────────────────────────
          // Prevents duplicate email notifications when a trip is edited rapidly.
          const passengerEmailAlreadySent = await wasRecentAppointmentEmailSent(
            trip.id,
            passengerEmails[0],
            `passenger_${eventType}`,
          );
          if (passengerEmailAlreadySent) {
            results.passenger.email = "skipped";
            console.log(
              `[Confirmation] ⏭️  Passenger email suppressed — a passenger_${eventType} email was already sent for trip #${trip.booking_number || trip.id} within the last 5 minutes (rapid-edit dedup)`,
            );
          } else {
            // ─────────────────────────────────────────────────────────────────────

            let anySuccess = false;
            for (let i = 0; i < passengerEmails.length; i++) {
              const email = passengerEmails[i];
              try {
                // Add delay between sends to avoid rate limits (skip before first)
                if (i > 0) {
                  await wait(SEND_DELAY_MS);
                }
                const emailResult = await sendEmail({
                  to: email,
                  from: fromAddress,
                  subject: emailSubject,
                  html,
                  appointmentId: trip.id,
                  recipientName: trip.client_name || null,
                  emailType: `passenger_${eventType}`,
                });
                if (emailResult && emailResult.skipped) {
                  console.log(
                    `[Confirmation] ⏭️  Passenger email deduped (send-email) to ${email}`,
                  );
                } else {
                  console.log(
                    `[Confirmation] ✅ Passenger email sent to ${email}`,
                  );
                  anySuccess = true;
                }
              } catch (emailErr) {
                console.error(
                  `[Confirmation] ❌ Passenger email failed to ${email}:`,
                  emailErr.message,
                );
                await logCommunicationFailure({
                  appointmentId: trip.id,
                  bookingNumber: trip.booking_number,
                  passengerName: trip.client_name,
                  driverName: trip.employee_name,
                  channel: "email",
                  recipientType: "passenger",
                  recipientAddress: email,
                  eventType,
                  errorMessage: emailErr.message || "Email send failed",
                  tripDate: trip.start_time,
                });
              }
            }
            results.passenger.email = anySuccess ? "sent" : "failed";
          } // end appointment-level dedup else
        } catch (error) {
          console.error("[Confirmation] Passenger email failed:", error);
          results.passenger.email = "failed";
          await logCommunicationFailure({
            appointmentId: trip.id,
            bookingNumber: trip.booking_number,
            passengerName: trip.client_name,
            driverName: trip.employee_name,
            channel: "email",
            recipientType: "passenger",
            recipientAddress: trip.client_email,
            eventType,
            errorMessage: error.message || "Email build/send failed",
            tripDate: trip.start_time,
          });
        }
      } else {
        console.log(
          `[Confirmation] ⏭️  Passenger email skipped - emailsEnabled: ${emailsEnabled}, has_email: ${!!trip.client_email}, preference allows: ${preference === "email" || preference === "both"}`,
        );
      }

      // Passenger SMS
      if (
        smsEnabled &&
        trip.client_phone &&
        (preference === "sms" || preference === "both")
      ) {
        // Small delay before SMS if we just sent emails
        if (results.passenger.email) {
          await wait(SEND_DELAY_MS);
        }

        // ── Appointment-level dedup ───────────────────────────────────────────
        // Prevents sending duplicate notifications when a trip is edited rapidly.
        // The content-based dedup in sms-sender.js doesn't catch this because the
        // message body changes with each edit (e.g. updated pickup time).
        const passengerAlreadySent = await wasRecentAppointmentSmsSent(
          trip.id,
          trip.client_phone,
          eventType,
        );
        if (passengerAlreadySent) {
          results.passenger.sms = "skipped";
          console.log(
            `[Confirmation] ⏭️  Passenger SMS suppressed — a ${eventType} SMS was already sent to this number for trip #${trip.booking_number || trip.id} within the last 5 minutes (rapid-edit dedup)`,
          );
        } else {
          // ─────────────────────────────────────────────────────────────────────
          console.log(
            `[Confirmation] 📱 Attempting to send passenger SMS to ${trip.client_phone}...`,
          );
          try {
            const message = buildPassengerSms(
              data,
              urls,
              eventType,
              changedFieldsList,
            );
            console.log(
              `[Confirmation] SMS message built: "${message.substring(0, 100)}..."`,
            );
            const smsResult = await sendSms(
              trip.client_phone,
              message,
              settings,
            );

            if (smsResult.success) {
              results.passenger.sms = "sent";
              console.log(
                `[Confirmation] ✅ Passenger SMS sent successfully to ${trip.client_phone}`,
              );

              // Log SMS to database
              const smsProvider = settings.sms_provider || "ClickSend";
              await logSmsToDatabase({
                appointmentId: trip.id,
                clientId: trip.client_id,
                recipientType: "passenger",
                recipientId: trip.client_id,
                phone: trip.client_phone,
                message,
                senderName: settings.business_name || "Catch A Ride",
                eventType,
                provider: smsProvider,
                status: "sent",
              });
            } else if (smsResult.skipped) {
              // Deduped or provider disabled — not a failure, just skip
              results.passenger.sms = "skipped";
              console.log(
                `[Confirmation] ⏭️  Passenger SMS skipped (${smsResult.reason})`,
              );
            } else {
              results.passenger.sms = "failed";
              results.passenger.sms_reason =
                smsResult.reason || "SMS send failed";
              console.error(
                `[Confirmation] ❌ Passenger SMS failed: ${smsResult.reason}`,
              );
              await logCommunicationFailure({
                appointmentId: trip.id,
                bookingNumber: trip.booking_number,
                passengerName: trip.client_name,
                driverName: trip.employee_name,
                channel: "sms",
                recipientType: "passenger",
                recipientAddress: trip.client_phone,
                eventType,
                errorMessage: smsResult.reason || "SMS send failed",
                tripDate: trip.start_time,
              });
            }
          } catch (error) {
            console.error("[Confirmation] ❌ Passenger SMS failed:", error);
            results.passenger.sms = "failed";
            results.passenger.sms_reason = error.message || "SMS send failed";
            await logCommunicationFailure({
              appointmentId: trip.id,
              bookingNumber: trip.booking_number,
              passengerName: trip.client_name,
              driverName: trip.employee_name,
              channel: "sms",
              recipientType: "passenger",
              recipientAddress: trip.client_phone,
              eventType,
              errorMessage: error.message || "SMS send failed",
              tripDate: trip.start_time,
            });
          }
        } // end dedup else
      } else {
        console.log(`[Confirmation] ⏭️  Passenger SMS SKIPPED:`);
        console.log(`    - smsEnabled: ${smsEnabled}`);
        console.log(
          `    - has phone: ${!!trip.client_phone} (${trip.client_phone || "N/A"})`,
        );
        console.log(
          `    - preference allows SMS: ${preference === "sms" || preference === "both"} (preference="${preference}")`,
        );
      }
    }

    // === DRIVER NOTIFICATIONS ===
    // Handle driver_removed event - send to OLD driver info passed in
    if (eventType === "driver_removed" && notifyDriver && oldDriverId) {
      // Check if driver confirmations are suppressed
      if (suppressDriverConfirmations) {
        console.log(
          `[Confirmation] ⏭️  Driver removal notifications SKIPPED — suppress_driver_confirmations is ON. Driver confirmations are disabled.`,
        );
        results.driver.email = "skipped";
        results.driver.sms = "skipped";
      }
      // Check if driver portal-only mode is enabled
      else if (driverPortalOnly) {
        console.log(
          `[Confirmation] ⏭️  Driver removal notifications SKIPPED — driver_portal_only mode is ON. Driver must use portal.`,
        );
        results.driver.email = "skipped";
        results.driver.sms = "skipped";
      } else {
        // Small delay before driver notifications if we just sent passenger notifications
        if (results.passenger.email || results.passenger.sms) {
          await wait(SEND_DELAY_MS);
        }

        console.log(
          `[Confirmation] Sending driver_removed notifications to old driver #${oldDriverId} (${oldDriverName})`,
        );

        // Driver Email
        if (emailsEnabled && oldDriverEmail) {
          try {
            // ── Appointment-level email dedup ───────────────────────────────────
            const driverRemovedEmailAlreadySent =
              await wasRecentAppointmentEmailSent(
                trip.id,
                oldDriverEmail,
                `driver_${eventType}`,
              );
            if (driverRemovedEmailAlreadySent) {
              results.driver.email = "skipped";
              console.log(
                `[Confirmation] ⏭️  Driver (removed) email suppressed — duplicate driver_${eventType} email already sent within 5 min for trip #${trip.booking_number || trip.id}`,
              );
            } else {
              // ───────────────────────────────────────────────────────────────────
              const html = buildDriverConfirmationEmail(
                data,
                urls,
                eventType,
                changedFieldsList,
              );
              const emailResult = await sendEmail({
                to: oldDriverEmail,
                from: fromAddress,
                subject: `${settings.business_name || "Catch A Ride"}: Trip #${trip.booking_number || trip.id} (REMOVED)`,
                html,
                appointmentId: trip.id,
                recipientName: oldDriverName || null,
                emailType: `driver_${eventType}`,
              });
              if (emailResult && emailResult.skipped) {
                results.driver.email = "skipped";
                console.log(
                  `[Confirmation] ⏭️  driver_removed email deduped (send-email) to ${oldDriverEmail}`,
                );
              } else {
                results.driver.email = "sent";
                console.log(
                  `[Confirmation] ✅ driver_removed email sent to ${oldDriverEmail}`,
                );
              }
            } // end appointment-level dedup else
          } catch (error) {
            console.error("[Confirmation] Driver removal email failed:", error);
            results.driver.email = "failed";
            await logCommunicationFailure({
              appointmentId: trip.id,
              bookingNumber: trip.booking_number,
              passengerName: trip.client_name,
              driverName: oldDriverName,
              channel: "email",
              recipientType: "driver",
              recipientAddress: oldDriverEmail,
              eventType,
              errorMessage: error.message || "Driver removal email failed",
              tripDate: trip.start_time,
            });
          }
        }

        // Driver SMS (driver_removed)
        if (smsEnabled && oldDriverPhone) {
          // Small delay before SMS if we just sent driver email
          if (results.driver.email) {
            await wait(SEND_DELAY_MS);
          }

          const driverRemovedAlreadySent = await wasRecentAppointmentSmsSent(
            trip.id,
            oldDriverPhone,
            eventType,
          );
          if (driverRemovedAlreadySent) {
            results.driver.sms = "skipped";
            console.log(
              `[Confirmation] ⏭️  Driver (removed) SMS suppressed — duplicate ${eventType} already sent within 5 min for trip #${trip.booking_number || trip.id}`,
            );
          } else {
            try {
              const message = buildDriverSms(
                data,
                urls,
                eventType,
                changedFieldsList,
              );
              const smsResult = await sendSms(
                oldDriverPhone,
                message,
                settings,
              );

              if (smsResult.success) {
                results.driver.sms = "sent";
                console.log(
                  `[Confirmation] ✅ driver_removed SMS sent to ${oldDriverPhone}`,
                );

                // Log SMS to database
                const smsProvider = settings.sms_provider || "ClickSend";
                await logSmsToDatabase({
                  appointmentId: trip.id,
                  clientId: null,
                  recipientType: "driver",
                  recipientId: oldDriverId,
                  phone: oldDriverPhone,
                  message,
                  senderName: settings.business_name || "Catch A Ride",
                  eventType,
                  provider: smsProvider,
                  status: "sent",
                });
              } else if (smsResult.skipped) {
                results.driver.sms = "skipped";
                console.log(
                  `[Confirmation] ⏭️  driver_removed SMS skipped (${smsResult.reason})`,
                );
              } else {
                results.driver.sms = "failed";
                results.driver.sms_reason =
                  smsResult.reason || "SMS send failed";
                console.error(
                  `[Confirmation] ❌ driver_removed SMS failed: ${smsResult.reason}`,
                );
                await logCommunicationFailure({
                  appointmentId: trip.id,
                  bookingNumber: trip.booking_number,
                  passengerName: trip.client_name,
                  driverName: oldDriverName,
                  channel: "sms",
                  recipientType: "driver",
                  recipientAddress: oldDriverPhone,
                  eventType,
                  errorMessage: smsResult.reason || "SMS send failed",
                  tripDate: trip.start_time,
                });
              }
            } catch (error) {
              console.error("[Confirmation] driver_removed SMS failed:", error);
              results.driver.sms = "failed";
              results.driver.sms_reason = error.message || "SMS send failed";
              await logCommunicationFailure({
                appointmentId: trip.id,
                bookingNumber: trip.booking_number,
                passengerName: trip.client_name,
                driverName: oldDriverName,
                channel: "sms",
                recipientType: "driver",
                recipientAddress: oldDriverPhone,
                eventType,
                errorMessage: error.message || "SMS send failed",
                tripDate: trip.start_time,
              });
            }
          } // end dedup else
        }
      }
    }
    // Handle normal driver notifications (driver_assigned, booking_changed, etc.)
    else if (notifyDriver && trip.employee_id && trip.employee_name) {
      // Check if driver confirmations are suppressed
      if (suppressDriverConfirmations) {
        console.log(
          `[Confirmation] ⏭️  Driver notifications SKIPPED for trip #${trip.booking_number || trip.id} — suppress_driver_confirmations is ON. Driver confirmations are disabled.`,
        );
        results.driver.email = "skipped";
        results.driver.sms = "skipped";
      }
      // Check if driver portal-only mode is enabled
      else if (driverPortalOnly) {
        console.log(
          `[Confirmation] ⏭️  Driver notifications SKIPPED for trip #${trip.booking_number || trip.id} — driver_portal_only mode is ON. Driver must use portal to view schedule.`,
        );
        results.driver.email = "skipped";
        results.driver.sms = "skipped";
      } else {
        // Small delay before driver notifications if we just sent passenger notifications
        if (results.passenger.email || results.passenger.sms) {
          await wait(SEND_DELAY_MS);
        }

        // Driver Email
        if (emailsEnabled && trip.employee_email) {
          try {
            // ── Appointment-level email dedup ───────────────────────────────────
            const driverEmailAlreadySent = await wasRecentAppointmentEmailSent(
              trip.id,
              trip.employee_email,
              `driver_${eventType}`,
            );
            if (driverEmailAlreadySent) {
              results.driver.email = "skipped";
              console.log(
                `[Confirmation] ⏭️  Driver email suppressed — duplicate driver_${eventType} email already sent within 5 min for trip #${trip.booking_number || trip.id}`,
              );
            } else {
              // ───────────────────────────────────────────────────────────────────
              const html = buildDriverConfirmationEmail(
                data,
                urls,
                eventType,
                changedFieldsList,
              );
              const driverReasonLabel =
                {
                  booking_created: "NEW",
                  booking_changed: "UPDATED",
                  booking_cancelled: "CANCELLED",
                  booking_deleted: "REMOVED",
                  driver_assigned: "DRIVER ASSIGNED",
                }[eventType] || "ASSIGNMENT";
              const emailResult = await sendEmail({
                to: trip.employee_email,
                from: fromAddress,
                subject: `${settings.business_name || "Catch A Ride"}: Trip #${trip.booking_number || trip.id} (${driverReasonLabel})`,
                html,
                appointmentId: trip.id,
                recipientName: trip.employee_name || null,
                emailType: `driver_${eventType}`,
              });
              if (emailResult && emailResult.skipped) {
                results.driver.email = "skipped";
                console.log(
                  `[Confirmation] ⏭️  Driver email deduped (send-email) to ${trip.employee_email}`,
                );
              } else {
                results.driver.email = "sent";
              }
            } // end appointment-level dedup else
          } catch (error) {
            console.error("[Confirmation] Driver email failed:", error);
            results.driver.email = "failed";
            await logCommunicationFailure({
              appointmentId: trip.id,
              bookingNumber: trip.booking_number,
              passengerName: trip.client_name,
              driverName: trip.employee_name,
              channel: "email",
              recipientType: "driver",
              recipientAddress: trip.employee_email,
              eventType,
              errorMessage: error.message || "Driver email failed",
              tripDate: trip.start_time,
            });
          }
        }

        // Driver SMS (normal notifications)
        if (smsEnabled && trip.employee_phone) {
          // Small delay before SMS if we just sent driver email
          if (results.driver.email) {
            await wait(SEND_DELAY_MS);
          }

          const driverAlreadySent = await wasRecentAppointmentSmsSent(
            trip.id,
            trip.employee_phone,
            eventType,
          );
          if (driverAlreadySent) {
            results.driver.sms = "skipped";
            console.log(
              `[Confirmation] ⏭️  Driver SMS suppressed — duplicate ${eventType} already sent within 5 min for trip #${trip.booking_number || trip.id}`,
            );
          } else {
            try {
              const message = buildDriverSms(
                data,
                urls,
                eventType,
                changedFieldsList,
              );
              const smsResult = await sendSms(
                trip.employee_phone,
                message,
                settings,
              );

              if (smsResult.success) {
                results.driver.sms = "sent";

                // Log SMS to database
                const smsProvider = settings.sms_provider || "ClickSend";
                await logSmsToDatabase({
                  appointmentId: trip.id,
                  clientId: null,
                  recipientType: "driver",
                  recipientId: trip.employee_id,
                  phone: trip.employee_phone,
                  message,
                  senderName: settings.business_name || "Catch A Ride",
                  eventType,
                  provider: smsProvider,
                  status: "sent",
                });
              } else if (smsResult.skipped) {
                results.driver.sms = "skipped";
                console.log(
                  `[Confirmation] ⏭️  Driver SMS skipped (${smsResult.reason})`,
                );
              } else {
                results.driver.sms = "failed";
                results.driver.sms_reason =
                  smsResult.reason || "SMS send failed";
                console.error(
                  `[Confirmation] ❌ Driver SMS failed: ${smsResult.reason}`,
                );
                await logCommunicationFailure({
                  appointmentId: trip.id,
                  bookingNumber: trip.booking_number,
                  passengerName: trip.client_name,
                  driverName: trip.employee_name,
                  channel: "sms",
                  recipientType: "driver",
                  recipientAddress: trip.employee_phone,
                  eventType,
                  errorMessage: smsResult.reason || "SMS send failed",
                  tripDate: trip.start_time,
                });
              }
            } catch (error) {
              console.error("[Confirmation] Driver SMS failed:", error);
              results.driver.sms = "failed";
              results.driver.sms_reason = error.message || "SMS send failed";
              await logCommunicationFailure({
                appointmentId: trip.id,
                bookingNumber: trip.booking_number,
                passengerName: trip.client_name,
                driverName: trip.employee_name,
                channel: "sms",
                recipientType: "driver",
                recipientAddress: trip.employee_phone,
                eventType,
                errorMessage: error.message || "SMS send failed",
                tripDate: trip.start_time,
              });
            }
          } // end dedup else
        }
      }
    }

    // === OFFICE NOTIFICATIONS ===
    if (notifyOffice) {
      // Small delay before office notification if we just sent driver notifications
      if (results.driver.email || results.driver.sms) {
        await wait(SEND_DELAY_MS);
      }
      const officeEmail = await getOfficeEmail();
      if (emailsEnabled && officeEmail) {
        try {
          // ── Appointment-level email dedup ───────────────────────────────────
          const officeEmailAlreadySent = await wasRecentAppointmentEmailSent(
            trip.id,
            officeEmail,
            `office_${eventType}`,
          );
          if (officeEmailAlreadySent) {
            results.office.email = "skipped";
            console.log(
              `[Confirmation] ⏭️  Office email suppressed — duplicate office_${eventType} email already sent within 5 min for trip #${trip.booking_number || trip.id}`,
            );
          } else {
            // ───────────────────────────────────────────────────────────────────
            const html = buildOfficeEmail(
              data,
              urls,
              eventType,
              changedFieldsList,
            );
            const officeReasonLabel =
              {
                booking_created: "NEW",
                booking_changed: "UPDATED",
                booking_cancelled: "CANCELLED",
                booking_deleted: "REMOVED",
                driver_assigned: "DRIVER ASSIGNED",
              }[eventType] || "NOTIFICATION";
            const emailResult = await sendEmail({
              to: officeEmail,
              from: fromAddress,
              subject: `${settings.business_name || "Catch A Ride"}: Trip #${trip.booking_number || trip.id} (${officeReasonLabel})`,
              html,
              appointmentId: trip.id,
              recipientName: "Office",
              emailType: `office_${eventType}`,
            });
            if (emailResult && emailResult.skipped) {
              results.office.email = "skipped";
              console.log(
                `[Confirmation] ⏭️  Office email deduped (send-email) to ${officeEmail}`,
              );
            } else {
              results.office.email = "sent";
            }
          } // end appointment-level dedup else
        } catch (error) {
          console.error("[Confirmation] Office email failed:", error);
          results.office.email = "failed";
          await logCommunicationFailure({
            appointmentId: trip.id,
            bookingNumber: trip.booking_number,
            passengerName: trip.client_name,
            driverName: trip.employee_name,
            channel: "email",
            recipientType: "office",
            recipientAddress: officeEmail,
            eventType,
            errorMessage: error.message || "Office email failed",
            tripDate: trip.start_time,
          });
        }
      }
    }

    // === LOCATION NOTIFICATIONS (Preferred Location Emails) ===
    if (
      emailsEnabled &&
      data.preferredLocations &&
      data.preferredLocations.length > 0
    ) {
      const passengerEmails = getAllPassengerEmails(trip);
      const locationEmails = getLocationNotificationEmails(
        trip,
        data.preferredLocations,
        passengerEmails,
      );

      if (locationEmails.length > 0) {
        console.log(
          `[Confirmation] 📍 Location notification emails matched: ${locationEmails.join(", ")}`,
        );

        // Small delay before location notifications
        await wait(SEND_DELAY_MS);

        try {
          // Use the office email template so location contacts see all trip details
          const html = buildOfficeEmail(
            data,
            urls,
            eventType,
            changedFieldsList,
          );
          const locationReasonLabel =
            {
              booking_created: "NEW",
              booking_changed: "UPDATED",
              booking_cancelled: "CANCELLED",
              booking_deleted: "REMOVED",
              driver_assigned: "DRIVER ASSIGNED",
            }[eventType] || "NOTIFICATION";

          const locationSubject = `${settings.business_name || "Catch A Ride"}: Trip #${trip.booking_number || trip.id} (${locationReasonLabel})`;

          let anySuccess = false;
          for (let i = 0; i < locationEmails.length; i++) {
            const email = locationEmails[i];
            try {
              if (i > 0) {
                await wait(SEND_DELAY_MS);
              }
              await sendEmail({
                to: email,
                from: fromAddress,
                subject: locationSubject,
                html,
                appointmentId: trip.id,
                recipientName: "Location Contact",
                emailType: `location_${eventType}`,
              });
              console.log(
                `[Confirmation] ✅ Location notification email sent to ${email}`,
              );
              anySuccess = true;
            } catch (emailErr) {
              console.error(
                `[Confirmation] ❌ Location notification email failed to ${email}:`,
                emailErr.message,
              );
              await logCommunicationFailure({
                appointmentId: trip.id,
                bookingNumber: trip.booking_number,
                passengerName: trip.client_name,
                driverName: trip.employee_name,
                channel: "email",
                recipientType: "location",
                recipientAddress: email,
                eventType,
                errorMessage: emailErr.message || "Location email send failed",
                tripDate: trip.start_time,
              });
            }
          }
          results.location.email = anySuccess ? "sent" : "failed";
        } catch (error) {
          console.error(
            "[Confirmation] Location notification emails failed:",
            error,
          );
          results.location.email = "failed";
        }
      } else {
        console.log(
          `[Confirmation] ⏭️  No location notification emails matched for this trip`,
        );
      }
    }

    return {
      success: true,
      results,
      urls,
    };
  } catch (error) {
    console.error("[Confirmation Service] Error:", error);
    throw error;
  }
}
