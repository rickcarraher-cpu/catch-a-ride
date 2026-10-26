import sql from "@/app/api/utils/sql";
import {
  toE164,
  formatLongDate,
  formatTime,
  formatShortDate,
  formatShortTime,
  formatPaymentMethod,
} from "./formatters";
import { buildBookingMessage } from "./messageBuilders";
import { sendSmsAndLog, sendSms } from "@/app/api/utils/sms-sender";
import {
  findOrCreateConversationForAppointment,
  updateConversationTimestamp,
} from "@/app/api/utils/conversations";

/**
 * Resolve the proper base URL for links.
 * Checks custom_domain in settings first (the user's real production domain),
 * then falls back to settings.app_url or environment variables.
 */
async function resolveBaseUrl(settings) {
  // FIRST: Check for custom_domain in DB settings — this is the user's real production domain
  try {
    const [domainSetting] = await sql`
      SELECT value FROM settings
      WHERE tenant_id = 1 AND key = 'custom_domain'
    `;
    if (domainSetting?.value) {
      const customUrl = domainSetting.value.startsWith("http")
        ? domainSetting.value
        : `https://${domainSetting.value}`;
      return customUrl.replace(/\/+$/, "");
    }
  } catch (err) {
    console.error("[resolveBaseUrl] Error fetching custom_domain:", err);
  }

  // SECOND: Fall back to settings.app_url or env vars
  const rawBaseUrl =
    settings.app_url ||
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    "";
  return rawBaseUrl.replace(/\/+$/, "");
}

/**
 * Build a unified SMS config from the scattered params these functions receive.
 * This bridges the old interface (many separate params) with the new unified sender.
 */
function buildConfigFromParams({
  smsProvider,
  clicksendUsername,
  clicksendApiKey,
  clicksendFrom,
  quoApiKey,
  quoPhoneNumberId,
  quoUserId,
}) {
  const provider = (smsProvider || "").toLowerCase();

  if (provider === "clicksend" && clicksendUsername && clicksendApiKey) {
    return {
      ready: true,
      provider: smsProvider,
      providerNormalized: "clicksend",
      credentials: {
        username: clicksendUsername,
        apiKey: clicksendApiKey,
        from: clicksendFrom || "CatchARide",
      },
      disabled: false,
    };
  }

  if (provider === "quo" && quoApiKey && quoPhoneNumberId) {
    return {
      ready: true,
      provider: smsProvider,
      providerNormalized: "quo",
      credentials: {
        apiKey: quoApiKey,
        phoneNumberId: quoPhoneNumberId,
        userId: quoUserId,
      },
      disabled: false,
    };
  }

  return {
    ready: false,
    provider: smsProvider || "None",
    providerNormalized: provider || "none",
    reason: `SMS provider "${smsProvider}" is not configured or credentials are missing.`,
    disabled: !smsProvider || provider === "none",
  };
}

export async function sendSmsToOwner({
  type,
  action,
  app,
  services,
  settings,
  changedFields,
  ownerPhone,
  appointmentId,
  tenantId,
  smsProvider,
  clicksendUsername,
  clicksendApiKey,
  clicksendFrom,
  quoApiKey,
  quoPhoneNumberId,
  quoUserId,
}) {
  const ownerMsgBody = buildBookingMessage({
    action,
    app,
    services,
    settings,
    changedFields,
  });
  const smsPrefix = clicksendFrom || "CatchARide";
  const ownerMsg = `${smsPrefix}\n${ownerMsgBody}`;

  const config = buildConfigFromParams({
    smsProvider,
    clicksendUsername,
    clicksendApiKey,
    clicksendFrom,
    quoApiKey,
    quoPhoneNumberId,
    quoUserId,
  });

  if (!config.ready) {
    console.log(`[SMS→Owner] Skipped — ${config.reason}`);
    return;
  }

  let conversationId = null;
  if (appointmentId) {
    try {
      conversationId = await findOrCreateConversationForAppointment(
        appointmentId,
        tenantId,
      );
    } catch (convErr) {
      console.error("[SMS→Owner] Failed to create conversation:", convErr);
    }
  }

  const result = await sendSmsAndLog({
    to: ownerPhone,
    message: ownerMsg,
    config,
    label: `${config.provider}→Owner`,
    appointmentId,
    conversationId,
    senderName: "System",
    recipientType: "owner",
    notificationType: type,
  });

  if (!result.success) {
    console.error(`[SMS→Owner] Failed: ${result.error}`);
  }
}

export async function sendSmsToPassenger({
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
}) {
  const baseUrl = await resolveBaseUrl(settings);
  const viewBookingUrl = `${baseUrl}/booking/${app.id}`;
  const passengerConfirmUrl = app.passenger_confirmation_token
    ? `${baseUrl}/passenger/confirm/${app.passenger_confirmation_token}`
    : null;
  const firstName = app.client_name?.split(" ")[0] || "there";
  const businessName = settings.business_name || "Catch A Ride";

  const replaceVariables = (template, linkOverride) => {
    const linkUrl = linkOverride || viewBookingUrl;
    return template
      .replace(/\{name\}/gi, firstName)
      .replace(/\{business\}/gi, businessName)
      .replace(/\{date\}/gi, formatLongDate(app.start_time))
      .replace(/\{time\}/gi, formatTime(app.start_time))
      .replace(/\{driver\}/gi, app.employee_name || "To Be Assigned")
      .replace(/\{vehicle\}/gi, app.vehicle_name || "")
      .replace(/\{code\}/gi, String(app.booking_number))
      .replace(/\{link\}/gi, linkUrl)
      .replace(/\{payment_link\}/gi, paymentUrl || linkUrl)
      .replace(
        /\{amount\}/gi,
        Number(app.payment_amount || app.refund_amount || 0).toFixed(2),
      )
      .replace(/\{payment_method\}/gi, app.payment_method || "Online")
      .replace(/\{review_link\}/gi, settings.google_review_link || "");
  };

  const STOP = "Text STOP to unsub";

  let smsBody = "";

  // Check if payment is due (balance > 0 and not paid, and not cash payment)
  const isPaid =
    app.payment_status === "paid" ||
    ((app.balance_due ?? 0) <= 0 && (app.payments_total ?? 0) > 0);
  const isCashPayment = (app.payment_method || "").toLowerCase() === "cash";
  const shouldIncludePaymentLink = !isPaid && !isCashPayment && paymentUrl;

  if (type === "booking_created") {
    const customTemplate = settings.template_booking_created_sms;
    if (customTemplate) {
      smsBody = replaceVariables(customTemplate);
    } else {
      const isPending =
        app.booked_by === "Online" || app.status === "needs_review";

      const linkUrl =
        !isPending && passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;

      const d = formatShortDate(app.start_time);
      const t = formatShortTime(app.start_time);
      const driver = app.employee_name || "TBA";
      const status = isPending ? "pending" : "confirmed";

      let msg = `#${app.booking_number} ${status}! ${d} ${t} w/${driver}.`;
      if (app.pickup_street || app.pickup_address) {
        const pickup = app.pickup_street || app.pickup_address;
        msg += ` From: ${pickup}.`;
      }
      msg += ` ${linkUrl}`;
      // Always include payment link when balance is due and not cash
      if (shouldIncludePaymentLink) msg += ` Pay: ${paymentUrl}`;
      msg += ` ${STOP}`;
      smsBody = msg;
    }
  } else if (type === "booking_changed") {
    const customTemplate = settings.template_booking_changed_sms;
    if (customTemplate) {
      const linkUrl =
        passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;
      smsBody = replaceVariables(customTemplate, linkUrl);
    } else {
      const d = formatShortDate(app.start_time);
      const t = formatShortTime(app.start_time);
      const driver = app.employee_name || "TBA";
      let msg = `#${app.booking_number} UPDATED: ${d} ${t} w/${driver}.`;
      if (isPaid) msg += ` Paid.`;
      msg += ` ${viewBookingUrl}`;
      // Always include payment link when balance is due and not cash
      if (shouldIncludePaymentLink) msg += ` Pay: ${paymentUrl}`;
      msg += ` ${STOP}`;
      smsBody = msg;
    }
  } else if (type === "booking_deleted") {
    const customTemplate = settings.template_booking_deleted_sms;
    if (customTemplate) {
      smsBody = replaceVariables(customTemplate);
    } else {
      smsBody = `#${app.booking_number} cancelled. Questions? Contact ${businessName}. ${STOP}`;
    }
  } else if (type === "booking_cancelled") {
    const customTemplate = settings.template_booking_cancelled_sms;
    if (customTemplate) {
      smsBody = replaceVariables(customTemplate);
    } else {
      smsBody = `#${app.booking_number} cancelled. Questions? Contact ${businessName}. ${STOP}`;
    }
  } else if (type === "reminder_day_before") {
    const customTemplate = settings.template_reminder_day_before_sms;
    if (customTemplate) {
      const linkUrl =
        passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;
      smsBody = replaceVariables(customTemplate, linkUrl);
    } else {
      const defaultReminder =
        "Hi {name}, reminder: your trip with {business} is tomorrow at {time}. Driver: {driver}. Booking #{code}.\n\nShow Details: {link}\n\nReply STOP to opt out of messages.";
      const template = settings.sms_reminder_message || defaultReminder;
      const linkUrl =
        passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;
      if (template === defaultReminder) {
        const d = formatShortDate(app.start_time);
        const t = formatShortTime(app.start_time);
        const driver = app.employee_name || "driver";
        let msg = `Reminder: #${app.booking_number} tomorrow ${d} ${t} w/${driver}. ${linkUrl}`;
        // Include payment link when balance is due
        if (shouldIncludePaymentLink) msg += ` Pay: ${paymentUrl}`;
        msg += ` ${STOP}`;
        smsBody = msg;
      } else {
        smsBody = replaceVariables(template, linkUrl);
      }
    }
  } else if (type === "driver_assigned") {
    const customTemplate = settings.template_driver_assigned_sms;
    if (customTemplate) {
      const linkUrl =
        passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;
      smsBody = replaceVariables(customTemplate, linkUrl);
    } else {
      const linkUrl =
        passengerConfirmUrl && !app.passenger_response_at
          ? passengerConfirmUrl
          : viewBookingUrl;
      const d = formatShortDate(app.start_time);
      const t = formatShortTime(app.start_time);
      const driver = app.employee_name || "driver";
      let msg = `${driver} assigned #${app.booking_number} ${d} ${t}.`;
      if (app.vehicle_name) msg += ` Vehicle: ${app.vehicle_name}.`;
      msg += ` ${linkUrl}`;
      // Include payment link when balance is due
      if (shouldIncludePaymentLink) msg += ` Pay: ${paymentUrl}`;
      msg += ` ${STOP}`;
      smsBody = msg;
    }
  } else if (type === "payment_confirmed") {
    const customTemplate = settings.template_payment_confirmed_sms;
    if (customTemplate) {
      smsBody = replaceVariables(customTemplate);
    } else {
      // Use payments_total + tips_total for the actual amount received,
      // same logic as the email handler — payment_amount only stores the
      // base trip amount (excluding tip and CC fee) so it understates the total.
      const paymentsTotal = Number(app.payments_total || 0);
      const tipsTotal = Number(app.tips_total || 0);
      const paidAmount = (
        paymentsTotal + tipsTotal > 0
          ? paymentsTotal + tipsTotal
          : Number(app.payment_amount || 0)
      ).toFixed(2);
      const method = app.payment_method || "Online";
      smsBody = `Payment $${paidAmount} received #${app.booking_number} via ${method}. Thanks! ${viewBookingUrl} ${STOP}`;
    }
  } else if (type === "refund_processed") {
    const customTemplate = settings.template_refund_processed_sms;
    if (customTemplate) {
      smsBody = replaceVariables(customTemplate);
    } else {
      const refundAmount = Number(app.refund_amount || 0).toFixed(2);
      smsBody = `Refund $${refundAmount} processed #${app.booking_number}. Allow 3-5 days. ${STOP}`;
    }
  }

  if (!smsBody) return;

  // Use unified sender instead of manual provider branching
  const config = buildConfigFromParams({
    smsProvider,
    clicksendUsername,
    clicksendApiKey,
    clicksendFrom,
    quoApiKey,
    quoPhoneNumberId,
    quoUserId,
  });

  if (!config.ready) {
    console.log(`[SMS→Passenger] Skipped — ${config.reason}`);
    return;
  }

  let conversationId = null;
  if (appointmentId) {
    try {
      conversationId = await findOrCreateConversationForAppointment(
        appointmentId,
        tenantId,
      );
    } catch (convErr) {}
  }

  const result = await sendSmsAndLog({
    to: app.client_phone,
    message: smsBody,
    config,
    label: `${config.provider}→Passenger`,
    appointmentId,
    clientId: app.client_id || null,
    conversationId,
    senderName: app.client_name || "Passenger",
    recipientType: "passenger",
    notificationType: type,
  });

  if (!result.success) {
    console.error(`[SMS→Passenger] Failed: ${result.error}`);
  }
}

export async function sendSmsToDriver({
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
  driverPhone,
}) {
  const baseUrl = await resolveBaseUrl(settings);
  const businessName = settings.business_name || "Catch A Ride";
  const passengerName = app.client_name || "Passenger";

  // Combined driver trip page — has accept/decline, trip details, and calendar
  const driverTripUrl = app.driver_confirmation_token
    ? `${baseUrl}/driver/trip/${app.driver_confirmation_token}`
    : `${baseUrl}/booking/${app.id}`;

  const d = formatShortDate(app.start_time);
  const t = formatShortTime(app.start_time);

  let smsBody = "";

  if (type === "booking_deleted" || type === "booking_cancelled") {
    smsBody = `#${app.booking_number} CANCELLED: ${d} ${t} ${passengerName}. -${businessName}`;
  } else if (type === "booking_changed") {
    let msg = `#${app.booking_number} UPDATED: ${d} ${t} ${passengerName}`;
    if (app.balance_due !== undefined && app.balance_due > 0) {
      msg += ` $${Number(app.balance_due).toFixed(2)}`;
    }
    msg += ` → ${driverTripUrl} -${businessName}`;
    smsBody = msg;
  } else {
    // booking_created or driver_assigned
    let msg = `#${app.booking_number}: ${d} ${t} ${passengerName}`;
    if (app.balance_due !== undefined && app.balance_due > 0) {
      msg += ` $${Number(app.balance_due).toFixed(2)}`;
    }
    msg += ` → ${driverTripUrl} -${businessName}`;
    smsBody = msg;
  }

  if (!driverPhone) {
    console.log(`[SMS→Driver] ❌ Skipped — no driver phone number`);
    return;
  }

  // Use unified sender instead of manual provider branching
  const config = buildConfigFromParams({
    smsProvider,
    clicksendUsername,
    clicksendApiKey,
    clicksendFrom,
    quoApiKey,
    quoPhoneNumberId,
    quoUserId,
  });

  if (!config.ready) {
    console.log(`[SMS→Driver] Skipped — ${config.reason}`);
    return;
  }

  let conversationId = null;
  if (appointmentId) {
    try {
      conversationId = await findOrCreateConversationForAppointment(
        appointmentId,
        tenantId,
      );
    } catch (convErr) {}
  }

  const result = await sendSmsAndLog({
    to: driverPhone,
    message: smsBody,
    config,
    label: `${config.provider}→Driver`,
    appointmentId,
    conversationId,
    senderName: app.employee_name || "Driver",
    recipientType: "driver",
    notificationType: type,
  });

  if (result.success) {
    console.log(`[SMS→Driver] ✅ ${type} sent to ${driverPhone}`);
  } else {
    console.error(`[SMS→Driver] Failed: ${result.error}`);
  }
}
