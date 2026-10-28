import sql from "@/app/api/utils/sql";
import {
  ALWAYS_NOTIFY_EMAILS,
  ALWAYS_NOTIFY_NAMES,
} from "./notifications/constants";
import {
  buildBookingMessage,
  buildSmsMessage,
} from "./notifications/messageBuilders";
import { buildBookingEmailHtml } from "./notifications/emailBuilder";
import { sendSmsViaQuo } from "./notifications/quoSms";
import {
  sendSmsToOwner,
  sendSmsToPassenger,
  sendSmsToDriver,
} from "./notifications/smsHandlers";
import {
  sendEmailToOwner,
  sendEmailToPassenger,
  sendPaymentConfirmationEmail,
  sendRefundNotificationEmail,
  sendEmailToDriver,
  sendDriverAssignedEmailToPassenger,
} from "./notifications/emailHandlers";
import {
  logNotificationAttempt,
  generateCorrelationId,
  logSuppressedNotification,
} from "./notifications/notificationLogger";

// Helper to check if any passenger email address exists (primary OR cc_emails)
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}
function hasAnyPassengerEmail(app) {
  const primary = parseEmailAddresses(app.client_email || "");
  const cc = parseEmailAddresses(app.cc_emails || "");
  return primary.length > 0 || cc.length > 0;
}

// Re-export for backward compatibility
export {
  buildBookingMessage,
  buildBookingEmailHtml,
  buildSmsMessage,
  sendSmsViaQuo,
};

// Re-export unified SMS sender for new code
export { sendSms, loadSmsConfig, isSmsReady } from "@/app/api/utils/sms-sender";

// ── Main notification dispatcher ──────────────────────────────────────────────

export async function sendNotification({
  type,
  appointmentId,
  appointmentSnapshot,
  servicesSnapshot,
  changedFields = [],
  tenantId = 1,
}) {
  // ⚠️ DEPRECATION WARNING: This function is deprecated
  // New code should use sendConfirmations() from confirmationService.js instead
  // This legacy system is maintained only for backward compatibility
  console.warn(
    `[DEPRECATED] sendNotification() called with type="${type}" for appointment #${appointmentId}. Consider migrating to sendConfirmations() from confirmationService.js`,
  );

  // Generate correlation ID to link all related notification attempts
  const correlationId = generateCorrelationId();

  // Track any errors that occur during notification sending
  const errors = [];

  // ── Track notification status for UI feedback ─────────────────────────
  const notificationStatus = {
    passenger: { email: false, sms: false },
    driver: { email: false, sms: false },
    dispatch: { email: false, sms: false },
  };

  try {
    console.log(`\n========================================`);
    console.log(`[NOTIFICATION] Type: ${type}`);
    console.log(`[NOTIFICATION] Appointment ID: ${appointmentId}`);
    console.log(`[NOTIFICATION] Correlation ID: ${correlationId}`);
    console.log(`========================================\n`);

    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = ${tenantId}`;
    const settings = settingsRows.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});

    const businessName = settings.business_name || "Catch A Ride";
    const ownerPhone = settings.business_phone || null;
    const ownerEmail = settings.owner_email || null;

    // ── Global send toggles (default ON) ──────────────────────────────────
    const emailsEnabled = settings.send_emails !== "no";
    const smsEnabled = settings.send_sms !== "no";

    console.log(`[NOTIFICATION] Settings loaded:`);
    console.log(`  - emailsEnabled: ${emailsEnabled}`);
    console.log(`  - smsEnabled: ${smsEnabled}`);
    console.log(`  - ownerEmail: ${ownerEmail}`);
    console.log(`  - ownerPhone: ${ownerPhone}`);
    console.log(`  - from_email setting: ${settings.from_email}`);
    console.log(`  - from_name setting: ${settings.from_name}`);

    const fromName = settings.from_name || businessName;
    console.log("[notifications] settings.from_email:", settings.from_email);
    const fromAddress = settings.from_email
      ? `${fromName} <${settings.from_email}>`
      : undefined;
    console.log("[notifications] fromAddress built as:", fromAddress);

    let app = appointmentSnapshot || null;
    let services = servicesSnapshot || [];

    if (!app) {
      const [row] = await sql`
        SELECT a.*,
          c.name  AS client_name,  c.phone AS client_phone, c.email AS client_email,
          c.notification_preference AS client_notif_pref,
          c.cc_emails AS cc_emails,
          e.name  AS employee_name, e.phone AS employee_phone, e.email AS employee_email,
          e.profile_image_url AS employee_profile_image_url,
          e.copy_communications_to_company AS employee_copy_comms,
          v.name  AS vehicle_name,
          va.profile_image_url AS vehicle_profile_image_url,
          va.profile_description AS vehicle_profile_description
        FROM appointments a
        LEFT JOIN clients   c ON a.client_id   = c.id
        LEFT JOIN employees e ON a.employee_id = e.id
        -- Fall back to driver's assigned vehicle if vehicle_id not set on appointment
        LEFT JOIN LATERAL (
          SELECT vehicle_id FROM vehicle_assignments
          WHERE employee_id = a.employee_id
          ORDER BY id LIMIT 1
        ) va_fallback ON true
        LEFT JOIN vehicles  v ON v.id = COALESCE(a.vehicle_id, va_fallback.vehicle_id)
        LEFT JOIN vehicle_assignments va
               ON va.vehicle_id  = COALESCE(a.vehicle_id, va_fallback.vehicle_id)
              AND va.employee_id = a.employee_id
        WHERE a.id = ${appointmentId}
      `;
      if (!row) return { error: "Appointment not found" };
      app = row;
    }

    if (!services.length && appointmentId) {
      services = await sql`
        SELECT aps.*, s.name AS service_name, s.is_addon AS is_addon
        FROM appointment_services aps
        LEFT JOIN services s ON aps.service_id = s.id
        WHERE aps.appointment_id = ${appointmentId}
      `;
    }

    // ── Calculate balance information ─────────────────────────────────────
    // The appointment is loaded with SELECT a.* which already includes
    // balance_due, payments_total, and original_amount from cached fields.
    // No need to call calculateBalance() — trust the cached values on the row.
    if (appointmentId && !app.balance_due) {
      // If for some reason balance_due is missing (e.g. very old trip), default to 0
      app.balance_due = 0;
      app.payments_total = app.payments_total || 0;
      console.log(
        `[notifications] balance_due was missing for trip #${appointmentId} — defaulting to 0 (check cached-calculations.js)`,
      );
    }

    // ── Ensure payment link exists for unpaid trips ───────────────────────
    let paymentLinkGenerated = false;
    if (appointmentId && app.balance_due > 0 && app.payment_status !== "paid") {
      try {
        const paymentMethod = (app.payment_method || "").toLowerCase();
        const needsPaymentLink = [
          "square",
          "credit card",
          "card",
          "zelle",
          "venmo",
        ].includes(paymentMethod);

        if (needsPaymentLink && paymentMethod !== "cash") {
          // Check if an active payment link already exists
          const existingPayments = await sql`
            SELECT id, payment_url, provider FROM payments
            WHERE appointment_id = ${appointmentId}
            AND status IN ('pending', 'link_created', 'manual_pending')
            AND payment_url IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if (existingPayments.length === 0) {
            console.log(
              `[notifications] No payment link exists for unpaid trip #${appointmentId} ($${app.balance_due} due) — generating link before sending notifications`,
            );

            // Import payment link creators
            const { createSquarePaymentLink } = await import(
              "../payments/providers/square"
            );
            const { createVenmoPaymentLink } = await import(
              "../payments/providers/braintree-venmo"
            );
            const { createZellePaymentInstructions } = await import(
              "../payments/providers/zelle"
            );

            const amount = app.balance_due;
            let paymentData = null;
            let provider = null;

            // Generate payment link based on method
            if (["square", "credit card", "card"].includes(paymentMethod)) {
              provider = "square";
              paymentData = await createSquarePaymentLink({
                trip: app,
                amount,
                customerInfo: {
                  name: app.client_name,
                  email: app.client_email,
                  phone: app.client_phone,
                },
              });
            } else if (paymentMethod === "venmo") {
              provider = "venmo";
              paymentData = await createVenmoPaymentLink({
                trip: app,
                amount,
                customerInfo: {
                  name: app.client_name,
                  email: app.client_email,
                  phone: app.client_phone,
                },
              });
            } else if (paymentMethod === "zelle") {
              provider = "zelle";
              paymentData = await createZellePaymentInstructions({
                trip: app,
                amount,
              });
            }

            if (paymentData && provider) {
              // Create payment record
              await sql`
                INSERT INTO payments (
                  appointment_id, provider, status, amount, currency,
                  payment_url, external_reference_id, metadata
                ) VALUES (
                  ${appointmentId}, ${provider},
                  ${provider === "zelle" ? "manual_pending" : "link_created"},
                  ${amount}, 'USD',
                  ${paymentData.url}, ${paymentData.externalReferenceId},
                  ${JSON.stringify({ ...paymentData.metadata, auto_generated_in_notifications: true })}
                )
              `;

              // Update appointment payment status
              await sql`
                UPDATE appointments
                SET payment_status = ${provider === "zelle" ? "manual_pending" : "link_created"}
                WHERE id = ${appointmentId}
              `;

              paymentLinkGenerated = true;
              console.log(
                `[notifications] ✅ Generated ${provider} payment link for trip #${appointmentId} ($${amount})`,
              );
            }
          } else {
            console.log(
              `[notifications] Payment link already exists for trip #${appointmentId} (${existingPayments[0].provider})`,
            );
          }
        }
      } catch (paymentLinkErr) {
        console.error(
          `[notifications] Failed to ensure payment link for trip #${appointmentId}:`,
          paymentLinkErr.message,
        );
        // Continue with notifications even if payment link generation failed
      }
    }

    // ── Hardcoded always-notify exception ─────────────────────────────────
    const alwaysNotifyByEmail = ALWAYS_NOTIFY_EMAILS.includes(
      (app.client_email || "").toLowerCase().trim(),
    );
    const alwaysNotifyByName = ALWAYS_NOTIFY_NAMES.includes(
      (app.client_name || "").toLowerCase().trim(),
    );
    const alwaysNotify = alwaysNotifyByEmail || alwaysNotifyByName;
    if (alwaysNotify) {
      console.log(
        `[NOTIFICATION] ⚡ Always-notify exception active for "${app.client_name}" (${app.client_email}) — overriding ALL send toggles and preferences`,
      );
    }
    const effectiveEmailsEnabled = emailsEnabled || alwaysNotify;
    const effectiveSmsEnabled = smsEnabled || alwaysNotify;

    const actionMap = {
      booking_created: "created",
      booking_changed: "changed",
      booking_deleted: "deleted",
      booking_cancelled: "cancelled",
      reminder_day_before: "reminder",
      driver_assigned: "driver_assigned",
      payment_confirmed: "payment_confirmed",
      refund_processed: "refund_processed",
    };
    const action = actionMap[type] || "updated";

    // Determine if this is an online booking — used to override "Confirmed" → "Pending"
    const isOnlineBooking =
      app.booked_by === "Online" && type === "booking_created";

    // ── Look up active payment link for this appointment ──────────────────
    let paymentUrl = null;
    let paymentAmount = null;
    if (appointmentId) {
      try {
        // Map payment methods to providers - case insensitive and flexible matching
        const paymentMethodLower = (app.payment_method || "").toLowerCase();
        let provider = null;

        // Match payment method to provider with flexible string matching
        if (
          paymentMethodLower.includes("square") ||
          paymentMethodLower.includes("card") ||
          paymentMethodLower.includes("credit")
        ) {
          provider = "square";
        } else if (paymentMethodLower.includes("venmo")) {
          provider = "venmo";
        } else if (paymentMethodLower.includes("zelle")) {
          provider = "zelle";
        }

        console.log(
          `[notifications] Looking up payment link for appointment ${appointmentId}:`,
        );
        console.log(`  - payment_method: "${app.payment_method}"`);
        console.log(`  - payment_status: "${app.payment_status}"`);
        console.log(`  - balance_due: $${app.balance_due || 0}`);
        console.log(`  - mapped provider: "${provider || "NONE"}"`);

        if (provider) {
          const activePayments = await sql`
            SELECT payment_url, amount, provider FROM payments
            WHERE appointment_id = ${appointmentId}
            AND provider = ${provider}
            AND status IN ('pending', 'link_created', 'manual_pending')
            AND payment_url IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
          `;

          if (activePayments.length > 0) {
            paymentUrl = activePayments[0].payment_url;
            paymentAmount = activePayments[0].amount;
            console.log(
              `[notifications] ✅ Found ${activePayments[0].provider} payment link: ${paymentUrl}`,
            );
          } else {
            console.log(
              `[notifications] ⚠️  No active ${provider} payment link found for appointment ${appointmentId}`,
            );
          }
        } else {
          console.log(
            `[notifications] ⚠️  Payment method "${app.payment_method}" does not require online payment link`,
          );
        }
      } catch (payLookupErr) {
        console.error(
          "[notifications] Payment lookup failed:",
          payLookupErr.message,
        );
      }
    }

    const smsProvider = settings.sms_provider;
    const clicksendUsername =
      settings.clicksend_username || process.env.CLICKSEND_USERNAME;
    const clicksendApiKey =
      settings.clicksend_api_key || process.env.CLICKSEND_API_KEY;
    const clicksendFrom = settings.clicksend_from || "CatchARide";

    const quoApiKey = settings.quo_api_key;
    const quoPhoneNumberId = settings.quo_phone_number_id;
    const quoUserId = settings.quo_user_id || null;

    // ── SMS readiness diagnostic ──────────────────────────────────────────
    const clicksendReady =
      smsProvider === "ClickSend" && clicksendUsername && clicksendApiKey;
    const quoReady = smsProvider === "Quo" && quoApiKey && quoPhoneNumberId;
    const anySmsReady = clicksendReady || quoReady;

    console.log(`[NOTIFICATION] SMS diagnostic:`);
    console.log(`  - smsProvider: "${smsProvider || "NOT SET"}"`);
    console.log(`  - quoApiKey: ${quoApiKey ? "✅ present" : "❌ MISSING"}`);
    console.log(
      `  - quoPhoneNumberId: ${quoPhoneNumberId ? `✅ "${quoPhoneNumberId}"` : "❌ MISSING"}`,
    );
    console.log(`  - quoReady: ${quoReady}`);
    console.log(`  - clicksendReady: ${clicksendReady}`);
    console.log(`  - anySmsReady: ${anySmsReady}`);

    if (!anySmsReady && smsProvider) {
      console.error(
        `[NOTIFICATION] ⚠️ SMS provider is "${smsProvider}" but credentials are MISSING — NO SMS WILL BE SENT`,
      );
      console.error(
        `[NOTIFICATION] Go to Settings → SMS tab and save your Quo API Key + Phone Number ID`,
      );

      // Log this as a suppressed notification so it shows up in audit
      try {
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "system",
          recipientId: null,
          channel: "sms",
          toAddress: "N/A",
          status: "failure",
          provider: smsProvider || "unknown",
          errorCode: "MISSING_CREDENTIALS",
          errorMessage: `SMS provider is "${smsProvider}" but credentials are missing. quoApiKey: ${quoApiKey ? "present" : "MISSING"}, quoPhoneNumberId: ${quoPhoneNumberId ? "present" : "MISSING"}`,
          correlationId,
          metadata: {
            smsProvider,
            quoApiKeyPresent: !!quoApiKey,
            quoPhoneNumberIdPresent: !!quoPhoneNumberId,
          },
        });
      } catch (logErr) {
        console.error(
          "[NOTIFICATION] Failed to log missing credentials:",
          logErr.message,
        );
      }
    }

    // ── SMS to owner — DISABLED ───────────────────────────────────────────
    console.log(`[SMS→Owner] DISABLED — SMS to owner phone is turned off`);

    const clientPref = app.client_notif_pref || "both";
    const wantsSms =
      alwaysNotify || clientPref === "sms" || clientPref === "both";
    const wantsEmail =
      alwaysNotify || clientPref === "email" || clientPref === "both";

    // ── SMS to passenger ──────────────────────────────────────────────────
    let passengerSmsSuccess = false;
    let passengerSmsFallbackNeeded = false;

    if (effectiveSmsEnabled && app.client_phone && wantsSms) {
      try {
        await sendSmsToPassenger({
          type,
          app,
          settings,
          appointmentId,
          tenantId,
          smsProvider,
          clicksendUsername,
          clicksendApiKey,
          clicksendFrom,
          quoApiKey,
          quoPhoneNumberId,
          quoUserId,
          ownerPhone,
          paymentUrl,
        });

        // Log successful SMS
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "passenger",
          recipientId: app.client_id,
          channel: "sms",
          toAddress: app.client_phone,
          status: "success",
          provider: smsProvider || "unknown",
          correlationId,
          metadata: {
            balance_due: app.balance_due,
            payment_link_included: !!paymentUrl,
          },
        });

        passengerSmsSuccess = true;
      } catch (smsErr) {
        console.error(`[SMS→Passenger] ❌ Failed:`, smsErr.message);

        // Log SMS failure
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "passenger",
          recipientId: app.client_id,
          channel: "sms",
          toAddress: app.client_phone,
          status: "failure",
          provider: smsProvider || "unknown",
          errorCode: smsErr.code || "UNKNOWN",
          errorMessage: smsErr.message,
          correlationId,
          metadata: {
            balance_due: app.balance_due,
            payment_link_included: !!paymentUrl,
          },
        });

        errors.push(`SMS to passenger failed: ${smsErr.message}`);

        // Trigger fallback to email if passenger has email
        if (app.client_email && effectiveEmailsEnabled) {
          passengerSmsFallbackNeeded = true;
          console.log(
            `[SMS→Passenger] Will attempt email fallback to ${app.client_email}`,
          );
        }
      }
    } else {
      console.log(
        `[SMS→Passenger] Skipped — effectiveSmsEnabled: ${effectiveSmsEnabled}, client_phone: ${app.client_phone}, wantsSms: ${wantsSms}, type: ${type}`,
      );
    }

    // ── Email (owner) ─────────────────────────────────────────────────────
    if (
      emailsEnabled &&
      ownerEmail &&
      (type === "booking_created" ||
        type === "booking_changed" ||
        type === "booking_deleted" ||
        type === "booking_cancelled" ||
        type === "driver_assigned")
    ) {
      await sendEmailToOwner({
        type,
        action,
        app,
        services,
        settings,
        changedFields,
        ownerEmail,
        fromAddress,
        isOnlineBooking,
        paymentUrl,
        paymentAmount,
      });
    } else {
      console.log(
        `[EMAIL→Owner] Skipped — emailsEnabled: ${emailsEnabled}, ownerEmail: ${ownerEmail}, type: ${type}`,
      );
    }

    // ── Email (passenger) ─────────────────────────────────────────────────
    let passengerEmailSuccess = false;
    let passengerEmailFallbackNeeded = false;

    const shouldSendPassengerEmail =
      effectiveEmailsEnabled &&
      hasAnyPassengerEmail(app) &&
      wantsEmail &&
      (type === "booking_created" ||
        type === "booking_changed" ||
        type === "booking_deleted" ||
        type === "booking_cancelled");

    const shouldSendFallbackEmail =
      !passengerSmsSuccess &&
      passengerSmsFallbackNeeded &&
      hasAnyPassengerEmail(app) &&
      effectiveEmailsEnabled;

    if (shouldSendPassengerEmail || shouldSendFallbackEmail) {
      if (
        app.client_email &&
        app.client_email.toLowerCase() === (ownerEmail || "").toLowerCase()
      ) {
        console.log(
          `[EMAIL→Passenger] Skipping — same address as owner (${app.client_email})`,
        );
      } else {
        try {
          await sendEmailToPassenger({
            type,
            action,
            app,
            services,
            settings,
            changedFields,
            ownerEmail,
            fromAddress,
            paymentUrl,
            paymentAmount,
          });

          // Log successful email
          await logNotificationAttempt({
            eventType: type,
            entityId: appointmentId,
            recipientType: "passenger",
            recipientId: app.client_id,
            channel: "email",
            toAddress: app.client_email,
            status: "success",
            provider: "resend",
            correlationId,
            metadata: {
              balance_due: app.balance_due,
              payment_link_included: !!paymentUrl,
              is_fallback: shouldSendFallbackEmail,
            },
          });

          passengerEmailSuccess = true;

          if (shouldSendFallbackEmail) {
            console.log(
              `[EMAIL→Passenger] ✅ Fallback email sent successfully (SMS had failed)`,
            );
          }
        } catch (emailErr) {
          const errorMsg = `Failed to send email to passenger: ${emailErr.message}`;
          console.error(`[EMAIL→Passenger] ❌ ${errorMsg}`);

          // Log email failure
          await logNotificationAttempt({
            eventType: type,
            entityId: appointmentId,
            recipientType: "passenger",
            recipientId: app.client_id,
            channel: "email",
            toAddress: app.client_email,
            status: "failure",
            provider: "resend",
            errorCode: emailErr.code || "UNKNOWN",
            errorMessage: emailErr.message,
            correlationId,
            metadata: {
              balance_due: app.balance_due,
              payment_link_included: !!paymentUrl,
              is_fallback: shouldSendFallbackEmail,
            },
          });

          errors.push(errorMsg);

          // If email failed and it wasn't a fallback, try SMS as fallback
          if (
            !shouldSendFallbackEmail &&
            app.client_phone &&
            effectiveSmsEnabled &&
            !passengerSmsSuccess
          ) {
            passengerEmailFallbackNeeded = true;
            console.log(
              `[EMAIL→Passenger] Will attempt SMS fallback to ${app.client_phone}`,
            );

            // Attempt SMS fallback
            try {
              await sendSmsToPassenger({
                type,
                app,
                settings,
                appointmentId,
                tenantId,
                smsProvider,
                clicksendUsername,
                clicksendApiKey,
                clicksendFrom,
                quoApiKey,
                quoPhoneNumberId,
                quoUserId,
                ownerPhone,
                paymentUrl,
              });

              await logNotificationAttempt({
                eventType: type,
                entityId: appointmentId,
                recipientType: "passenger",
                recipientId: app.client_id,
                channel: "sms",
                toAddress: app.client_phone,
                status: "success",
                provider: smsProvider || "unknown",
                correlationId,
                metadata: {
                  balance_due: app.balance_due,
                  payment_link_included: !!paymentUrl,
                  is_fallback: true,
                },
              });

              console.log(
                `[SMS→Passenger] ✅ Fallback SMS sent successfully (email had failed)`,
              );
            } catch (smsFallbackErr) {
              console.error(
                `[SMS→Passenger] ❌ Fallback SMS also failed:`,
                smsFallbackErr.message,
              );

              await logNotificationAttempt({
                eventType: type,
                entityId: appointmentId,
                recipientType: "passenger",
                recipientId: app.client_id,
                channel: "sms",
                toAddress: app.client_phone,
                status: "failure",
                provider: smsProvider || "unknown",
                errorCode: smsFallbackErr.code || "UNKNOWN",
                errorMessage: smsFallbackErr.message,
                correlationId,
                metadata: {
                  balance_due: app.balance_due,
                  payment_link_included: !!paymentUrl,
                  is_fallback: true,
                },
              });

              errors.push(
                `SMS fallback to passenger also failed: ${smsFallbackErr.message}`,
              );
            }
          }
        }
      }
    } else {
      console.log(
        `[EMAIL→Passenger] Skipped — effectiveEmailsEnabled: ${effectiveEmailsEnabled}, hasAnyPassengerEmail: ${hasAnyPassengerEmail(app)}, wantsEmail: ${wantsEmail}, type: ${type}`,
      );
    }

    // ── Email (driver assignment notification to passenger) ────────────────
    if (
      effectiveEmailsEnabled &&
      hasAnyPassengerEmail(app) &&
      wantsEmail &&
      type === "driver_assigned"
    ) {
      if (
        app.client_email &&
        app.client_email.toLowerCase() === (ownerEmail || "").toLowerCase()
      ) {
        console.log(
          `[EMAIL→Passenger Driver Assigned] Skipping — same address as owner (${app.client_email})`,
        );
      } else {
        try {
          await sendDriverAssignedEmailToPassenger({
            app,
            settings,
            ownerEmail,
            fromAddress,
          });
        } catch (emailErr) {
          const errorMsg = `Failed to send driver assigned email to passenger: ${emailErr.message}`;
          console.error(`[EMAIL→Passenger Driver Assigned] ❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    // ── Email (payment confirmation) ──────────────────────────────────────
    if (
      effectiveEmailsEnabled &&
      hasAnyPassengerEmail(app) &&
      wantsEmail &&
      type === "payment_confirmed"
    ) {
      if (
        app.client_email &&
        app.client_email.toLowerCase() === (ownerEmail || "").toLowerCase()
      ) {
        console.log(
          `[EMAIL→Passenger Payment] Skipping — same address as owner (${app.client_email})`,
        );
      } else {
        try {
          await sendPaymentConfirmationEmail({
            app,
            settings,
            ownerEmail,
            fromAddress,
          });
        } catch (emailErr) {
          errors.push(
            `Failed to send payment confirmation email: ${emailErr.message}`,
          );
        }
      }
    }

    // ── Email (refund notification) ───────────────────────────────────────
    if (
      effectiveEmailsEnabled &&
      hasAnyPassengerEmail(app) &&
      wantsEmail &&
      type === "refund_processed"
    ) {
      if (
        app.client_email &&
        app.client_email.toLowerCase() === (ownerEmail || "").toLowerCase()
      ) {
        console.log(
          `[EMAIL→Passenger Refund] Skipping — same address as owner (${app.client_email})`,
        );
      } else {
        try {
          await sendRefundNotificationEmail({
            app,
            settings,
            ownerEmail,
            fromAddress,
          });
        } catch (emailErr) {
          errors.push(
            `Failed to send refund notification email: ${emailErr.message}`,
          );
        }
      }
    }

    // ── SMS to driver ─────────────────────────────────────────────────────
    // Driver gets SMS for: created, changed, deleted, and driver_assigned
    // (only when a driver is actually assigned to the trip)
    const isDriverNotificationType =
      type === "booking_created" ||
      type === "booking_changed" ||
      type === "booking_deleted" ||
      type === "booking_cancelled" ||
      type === "driver_assigned";

    let driverSmsSuccess = false;

    if (
      effectiveSmsEnabled &&
      isDriverNotificationType &&
      app.employee_id &&
      app.employee_phone
    ) {
      console.log(`[SMS→Driver] ✅ Sending ${type} SMS to driver`);
      try {
        await sendSmsToDriver({
          type,
          app,
          settings,
          appointmentId,
          tenantId,
          smsProvider,
          clicksendUsername,
          clicksendApiKey,
          clicksendFrom,
          quoApiKey,
          quoPhoneNumberId,
          quoUserId,
          driverPhone: app.employee_phone,
        });

        // Log successful SMS to driver
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "driver",
          recipientId: app.employee_id,
          channel: "sms",
          toAddress: app.employee_phone,
          status: "success",
          provider: smsProvider || "unknown",
          correlationId,
          metadata: {
            balance_due: app.balance_due,
          },
        });

        driverSmsSuccess = true;
      } catch (smsErr) {
        console.error(`[SMS→Driver] ❌ Failed:`, smsErr.message);

        // Log SMS failure for driver
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "driver",
          recipientId: app.employee_id,
          channel: "sms",
          toAddress: app.employee_phone,
          status: "failure",
          provider: smsProvider || "unknown",
          errorCode: smsErr.code || "UNKNOWN",
          errorMessage: smsErr.message,
          correlationId,
          metadata: {
            balance_due: app.balance_due,
          },
        });

        errors.push(`SMS to driver failed: ${smsErr.message}`);
      }
    } else {
      console.log(`[SMS→Driver] Skipped:`);
      console.log(`  - effectiveSmsEnabled: ${effectiveSmsEnabled}`);
      console.log(
        `  - isDriverNotificationType: ${isDriverNotificationType} (type=${type})`,
      );
      console.log(`  - employee_id: ${!!app.employee_id}`);
      console.log(`  - employee_phone: ${!!app.employee_phone}`);
    }

    // ── Email to driver ───────────────────────────────────────────────────
    // Driver gets email for: created, changed, deleted, and driver_assigned
    // (only when a driver is actually assigned to the trip)
    let driverEmailSuccess = false;

    if (
      effectiveEmailsEnabled &&
      isDriverNotificationType &&
      app.employee_id &&
      app.employee_email
    ) {
      console.log(`[EMAIL→Driver] ✅ Sending ${type} email to driver`);
      try {
        await sendEmailToDriver({
          type,
          app,
          services,
          settings,
          fromAddress,
          driverEmail: app.employee_email,
        });

        // Log successful email to driver
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "driver",
          recipientId: app.employee_id,
          channel: "email",
          toAddress: app.employee_email,
          status: "success",
          provider: "resend",
          correlationId,
          metadata: {
            balance_due: app.balance_due,
          },
        });

        driverEmailSuccess = true;
      } catch (emailErr) {
        const errorMsg = `Failed to send email to driver: ${emailErr.message}`;
        console.error(`[EMAIL→Driver] ❌ ${errorMsg}`);

        // Log email failure for driver
        await logNotificationAttempt({
          eventType: type,
          entityId: appointmentId,
          recipientType: "driver",
          recipientId: app.employee_id,
          channel: "email",
          toAddress: app.employee_email,
          status: "failure",
          provider: "resend",
          errorCode: emailErr.code || "UNKNOWN",
          errorMessage: emailErr.message,
          correlationId,
          metadata: {
            balance_due: app.balance_due,
          },
        });

        errors.push(errorMsg);
      }
    } else {
      console.log(
        `[EMAIL→Driver] Skipped — effectiveEmailsEnabled: ${effectiveEmailsEnabled}, isDriverNotificationType: ${isDriverNotificationType}, employee_id: ${app.employee_id}, employee_email: ${app.employee_email}`,
      );
    }

    if (errors.length > 0) {
      console.error(
        `[NOTIFICATION] Completed with ${errors.length} error(s):`,
        errors,
      );
      return { success: false, error: errors.join("; "), errors };
    }

    return { success: true };
  } catch (error) {
    console.error("Notification Error:", error);
    return { error: error.message };
  }
}
