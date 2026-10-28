import { sendEmail } from "@/app/api/utils/send-email";
import { buildBookingMessage } from "./messageBuilders";
import { buildBookingEmailHtml } from "./emailBuilder";
import {
  formatLongDate,
  formatTime,
  formatPaymentMethod,
  toGCalDate,
} from "./formatters";

// Helper function to parse and clean email addresses from CSV string
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

// Helper to combine primary email + cc_emails into a single deduped list
function getAllPassengerEmails(app) {
  const emails = [];
  if (app.client_email) {
    emails.push(...parseEmailAddresses(app.client_email));
  }
  if (app.cc_emails) {
    emails.push(...parseEmailAddresses(app.cc_emails));
  }
  // Deduplicate (case-insensitive)
  const seen = new Set();
  return emails.filter((e) => {
    const lower = e.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export async function sendEmailToOwner({
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
}) {
  const bodyText = buildBookingMessage({
    action,
    app,
    services,
    settings,
    changedFields,
  });
  const bodyHtml = buildBookingEmailHtml({
    action,
    app,
    services,
    settings,
    changedFields,
    isOnlineBooking,
    paymentUrl,
    paymentAmount,
  });
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const ownerSubject = `Trip #${app.booking_number} ${actionLabel} — ${app.client_name || "Unknown Passenger"}`;

  // Parse all owner emails (primary + additional)
  const ownerEmails = [];
  if (ownerEmail) ownerEmails.push(ownerEmail);
  if (settings?.additional_owner_emails) {
    const additionalEmails = parseEmailAddresses(
      settings.additional_owner_emails,
    );
    ownerEmails.push(...additionalEmails);
  }

  console.log(
    `\n[EMAIL→Owner] Preparing to send to ${ownerEmails.length} address(es): ${ownerEmails.join(", ")}, Type: ${type}`,
  );

  // Send separate email to each owner address
  for (const email of ownerEmails) {
    try {
      await sendEmail({
        to: email,
        from: fromAddress,
        subject: ownerSubject,
        text: bodyText,
        html: bodyHtml,
      });
      console.log(`[EMAIL→Owner] ✅ Successfully sent to ${email}`);
    } catch (err) {
      console.error(
        `[EMAIL→Owner] ❌ Failed to send to ${email}:`,
        err.message,
      );
    }
  }
  console.log(`[EMAIL→Owner] Completed sending to all owner addresses\n`);
}

export async function sendEmailToPassenger({
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
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const firstName = app.client_name?.split(" ")[0] || "there";
  const isPending = app.booked_by === "Online" && type === "booking_created";

  console.log(`\n[EMAIL→Passenger] Type: ${type}, To: ${app.client_email}`);
  console.log(
    `[EMAIL→Passenger] Debug - client_email exists: ${!!app.client_email}`,
  );
  console.log(`[EMAIL→Passenger] Debug - fromAddress: ${fromAddress}`);
  console.log(
    `[EMAIL→Passenger] Debug - RESEND_API_KEY exists: ${!!process.env.RESEND_API_KEY}`,
  );

  if (!fromAddress) {
    const error =
      "Cannot send email: from_email setting is not configured in settings";
    console.error(`[EMAIL→Passenger] ❌ ${error}`);
    throw new Error(error);
  }
  if (!process.env.RESEND_API_KEY) {
    const error =
      "Cannot send email: RESEND_API_KEY environment variable is not set";
    console.error(`[EMAIL→Passenger] ❌ ${error}`);
    throw new Error(error);
  }

  // Parse passenger emails (primary + cc_emails) — either one is sufficient
  const passengerEmails = getAllPassengerEmails(app);
  if (passengerEmails.length === 0) {
    const error =
      "Cannot send email: no valid passenger email addresses found (no primary email and no cc_emails)";
    console.error(`[EMAIL→Passenger] ❌ ${error}`);
    throw new Error(error);
  }

  console.log(
    `[EMAIL→Passenger] Sending to ${passengerEmails.length} address(es): ${passengerEmails.join(", ")}`,
  );

  // ── Build confirmation URL (if token exists and not yet responded) ────────
  const baseUrl = (
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    ""
  ).replace(/\/+$/, "");
  const passengerConfirmUrl =
    app.passenger_confirmation_token && !app.passenger_response_at
      ? `${baseUrl}/passenger/confirm/${app.passenger_confirmation_token}`
      : null;

  let subjectLine;
  if (isPending)
    subjectLine = `Your booking request with ${businessName} — #${app.booking_number}`;
  else if (type === "booking_changed")
    subjectLine = `Your trip has been updated — Booking #${app.booking_number}`;
  else if (type === "booking_deleted" || type === "booking_cancelled")
    subjectLine = `Trip Cancelled — Booking #${app.booking_number}`;
  else subjectLine = `Your trip is confirmed — Booking #${app.booking_number}`;

  let bodyText;
  let passengerHtml;

  if (type === "booking_deleted" || type === "booking_cancelled") {
    bodyText = `Hi ${firstName},\n\nYour trip with ${businessName} (Booking Code: #${app.booking_number}) has been cancelled.\n\nDate: ${formatLongDate(app.start_time)}\nTime: ${formatTime(app.start_time)}\n\nIf you have any questions or would like to rebook, please don't hesitate to reach out.\n\n— ${businessName}`;
    passengerHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" /><title>${businessName} — Trip Cancelled</title></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td style="background:#ef4444;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">✕ Trip Cancelled</span></td></tr><tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><div style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Your trip with ${businessName} has been cancelled.</p><div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Original Date:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatLongDate(app.start_time)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Original Time:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatTime(app.start_time)}</td></tr></table></div><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">If you have any questions or would like to rebook, please don't hesitate to reach out.</p></div><div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p></div></td></tr></table></td></tr></table></body></html>`;
  } else if (isPending) {
    bodyText = `Hi ${firstName},\n\nWe've received your trip request with ${businessName} (Booking Code: #${app.booking_number}) and will confirm your trip shortly.\n\nDate: ${formatLongDate(app.start_time)}\nTime: ${formatTime(app.start_time)}\n\nWe'll be in touch soon. If you have questions, reply to this email or call us.\n\n— ${businessName}`;
    passengerHtml = buildBookingEmailHtml({
      action,
      app,
      services,
      settings,
      changedFields,
      isOnlineBooking: isPending,
      paymentUrl,
      paymentAmount,
      includeDriverNotes: false,
      includePassengerNotes: false,
      includeCalendarLinks: true,
      recipientType: "passenger",
      passengerConfirmUrl,
    });
  } else {
    bodyText = buildBookingMessage({
      action,
      app,
      services,
      settings,
      changedFields,
      includeDriverNotes: false,
    });
    passengerHtml = buildBookingEmailHtml({
      action,
      app,
      services,
      settings,
      changedFields,
      isOnlineBooking: isPending,
      paymentUrl,
      paymentAmount,
      includeDriverNotes: false,
      includePassengerNotes: false,
      includeCalendarLinks: true,
      recipientType: "passenger",
      passengerConfirmUrl,
    });
  }

  console.log(`  - Subject: ${subjectLine}`);

  // Parse owner emails for BCC if employee_copy_comms is enabled
  const bccEmails = [];
  if (app.employee_copy_comms && ownerEmail) {
    bccEmails.push(ownerEmail);
    if (settings?.additional_owner_emails) {
      const additionalEmails = parseEmailAddresses(
        settings.additional_owner_emails,
      );
      bccEmails.push(...additionalEmails);
    }
  }

  // Send separate email to each passenger address
  for (const email of passengerEmails) {
    try {
      await sendEmail({
        to: email,
        from: fromAddress,
        subject: subjectLine,
        text: bodyText,
        html: passengerHtml,
        ...(bccEmails.length > 0 ? { bcc: bccEmails } : {}),
      });
      console.log(
        `[EMAIL→Passenger] ✅ Successfully sent to ${email}${bccEmails.length > 0 ? ` (BCC: ${bccEmails.join(", ")})` : ""}\n`,
      );
    } catch (err) {
      console.error(
        `[EMAIL→Passenger] ❌ Failed to send to ${email}:`,
        err.message,
      );
    }
  }
  console.log(
    `[EMAIL→Passenger] Completed sending to all passenger addresses\n`,
  );
}

export async function sendPaymentConfirmationEmail({
  app,
  settings,
  ownerEmail,
  fromAddress,
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const firstName = app.client_name?.split(" ")[0] || "there";

  // Use payments_total (base + cc_fee transactions) + tips_total for the actual amount
  // the customer paid. This is more accurate than payment_amount, which can be
  // understated due to CC fee rounding (e.g. Math.ceil(0.08) = 1 on small trips).
  const paymentsTotal = Number(app.payments_total || 0);
  const tipsTotal = Number(app.tips_total || 0);
  const paidAmount =
    paymentsTotal + tipsTotal > 0
      ? paymentsTotal + tipsTotal
      : Number(app.payment_amount || 0);
  const paymentMethod = app.payment_method || "Online";
  const subjectLine = `Payment Received — Booking #${app.booking_number}`;
  const bodyText = `Hi ${firstName},\n\nThank you! We've received your payment of $${Number(paidAmount).toFixed(2)} for your trip with ${businessName}.\n\nBooking Code: #${app.booking_number}\nPayment Method: ${paymentMethod}\nAmount Paid: $${Number(paidAmount).toFixed(2)}\nDate: ${formatLongDate(app.start_time)}\nTime: ${formatTime(app.start_time)}\n\nWe look forward to serving you!\n\n— ${businessName}`;

  // Build calendar links
  const calBaseUrl = (
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    ""
  ).replace(/\/+$/, "");
  const calIcsUrl = `${calBaseUrl}/api/appointments/${app.id}/ics?recipient=passenger`;
  const calStart = new Date(app.start_time);
  const calEnd = new Date(calStart.getTime() + 60 * 60000);
  const calGcalTitle = encodeURIComponent(
    `${businessName} — Trip #${app.booking_number}`,
  );
  const calGcalDetails = encodeURIComponent(
    `Booking Code: #${app.booking_number}\nPayment Method: ${paymentMethod}\nAmount Paid: $${Number(paidAmount).toFixed(2)}`,
  );
  const calGcalLocation = encodeURIComponent(
    app.pickup_address || app.departure_location || "",
  );
  const calGcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calGcalTitle}&dates=${toGCalDate(calStart)}/${toGCalDate(calEnd)}&details=${calGcalDetails}&location=${calGcalLocation}&ctz=America%2FChicago`;
  const calendarButtons = `<div style="padding:0 16px 8px;text-align:center;"><p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Add to My Calendar</p><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="padding-right:8px;"><a href="${calGcalUrl}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;"><img src="https://www.google.com/favicon.ico" width="14" height="14" style="vertical-align:middle;margin-right:4px;" alt="" />Google Calendar</a></td><td><a href="${calIcsUrl}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">&#128197; Apple / Outlook</a></td></tr></table></div>`;

  const passengerHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td style="background:#16a34a;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">✓ Payment Received</span></td></tr><tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><div style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Thank you! We've received your payment of <strong style="color:#16a34a;">$${Number(paidAmount).toFixed(2)}</strong> for your upcoming trip.</p><div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 0;font-size:12px;color:#15803d;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#15803d;font-weight:600;">Payment Method:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${paymentMethod}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#15803d;font-weight:600;">Amount Paid:</td><td style="padding:5px 0;font-size:15px;color:#16a34a;font-weight:700;text-align:right;">$${Number(paidAmount).toFixed(2)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#15803d;font-weight:600;">Trip Date:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatLongDate(app.start_time)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#15803d;font-weight:600;">Trip Time:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatTime(app.start_time)}</td></tr></table></div><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">We look forward to serving you!</p></div>${calendarButtons}<div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p></div></td></tr></table></td></tr></table></body></html>`;

  // Parse all passenger emails (primary + cc)
  const passengerEmails = getAllPassengerEmails(app);
  if (passengerEmails.length === 0) {
    console.error(`[EMAIL→Passenger Payment] ❌ No valid email addresses`);
    return;
  }

  // Parse owner emails for BCC if employee_copy_comms is enabled
  const bccEmails = [];
  if (app.employee_copy_comms && ownerEmail) {
    bccEmails.push(ownerEmail);
  }

  console.log(
    `[EMAIL→Passenger Payment] Sending to ${passengerEmails.length} address(es): ${passengerEmails.join(", ")}`,
  );

  // Send separate email to each passenger address
  for (const email of passengerEmails) {
    try {
      await sendEmail({
        to: email,
        from: fromAddress,
        subject: subjectLine,
        text: bodyText,
        html: passengerHtml,
        ...(bccEmails.length > 0 ? { bcc: bccEmails } : {}),
      });
      console.log(`[EMAIL→Passenger Payment] ✅ Sent to ${email}`);
    } catch (err) {
      console.error(
        `[EMAIL→Passenger Payment] ❌ Failed to send to ${email}:`,
        err.message,
      );
    }
  }
  console.log(`[EMAIL→Passenger Payment] Completed sending to all addresses\n`);
}

export async function sendRefundNotificationEmail({
  app,
  settings,
  ownerEmail,
  fromAddress,
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const firstName = app.client_name?.split(" ")[0] || "there";
  const refundAmount = app.refund_amount || 0;
  const subjectLine = `Refund Processed — Booking #${app.booking_number}`;
  const bodyText = `Hi ${firstName},\n\nA refund of $${Number(refundAmount).toFixed(2)} has been processed for your trip with ${businessName}.\n\nBooking Code: #${app.booking_number}\nRefund Amount: $${Number(refundAmount).toFixed(2)}\n\nYou should see this refund in your account within 3-5 business days.\n\nIf you have any questions, please don't hesitate to reach out.\n\n— ${businessName}`;
  const passengerHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td style="background:#3b82f6;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">↩ Refund Processed</span></td></tr><tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><div style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">A refund of <strong style="color:#3b82f6;">$${Number(refundAmount).toFixed(2)}</strong> has been processed for your trip.</p><div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Refund Amount:</td><td style="padding:5px 0;font-size:15px;color:#3b82f6;font-weight:700;text-align:right;">$${Number(refundAmount).toFixed(2)}</td></tr></table></div><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">You should see this refund in your account within <strong>3-5 business days</strong>.</p><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">If you have any questions, please don't hesitate to reach out.</p></div><div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p></div></td></tr></table></td></tr></table></body></html>`;

  // Parse all passenger emails (primary + cc)
  const passengerEmails = getAllPassengerEmails(app);
  if (passengerEmails.length === 0) {
    console.error(`[EMAIL→Passenger Refund] ❌ No valid email addresses`);
    return;
  }

  // Parse owner emails for BCC if employee_copy_comms is enabled
  const bccEmails = [];
  if (app.employee_copy_comms && ownerEmail) {
    bccEmails.push(ownerEmail);
  }

  console.log(
    `[EMAIL→Passenger Refund] Sending to ${passengerEmails.length} address(es): ${passengerEmails.join(", ")}`,
  );

  // Send separate email to each passenger address
  for (const email of passengerEmails) {
    try {
      await sendEmail({
        to: email,
        from: fromAddress,
        subject: subjectLine,
        text: bodyText,
        html: passengerHtml,
        ...(bccEmails.length > 0 ? { bcc: bccEmails } : {}),
      });
      console.log(`[EMAIL→Passenger Refund] ✅ Sent to ${email}`);
    } catch (err) {
      console.error(
        `[EMAIL→Passenger Refund] ❌ Failed to send to ${email}:`,
        err.message,
      );
    }
  }
  console.log(`[EMAIL→Passenger Refund] Completed sending to all addresses\n`);
}

export async function sendEmailToDriver({
  type = "driver_assigned",
  app,
  services,
  settings,
  fromAddress,
  driverEmail,
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const driverFirstName = app.employee_name?.split(" ")[0] || "Driver";
  const passengerPhone = app.client_phone || "No phone provided";
  const passengerEmail = app.client_email || "No email provided";
  const passengerName = app.client_name || "Passenger";

  // Subject line based on type
  let subjectLine;
  if (type === "booking_deleted" || type === "booking_cancelled") {
    subjectLine = `Trip Cancelled — Trip #${app.booking_number}`;
  } else if (type === "booking_changed") {
    subjectLine = `Trip Updated — Trip #${app.booking_number}`;
  } else if (type === "booking_created") {
    subjectLine = `New Trip Booked — Trip #${app.booking_number}`;
  } else {
    subjectLine = `You've Been Assigned — Trip #${app.booking_number}`;
  }

  // For deleted/cancelled trips, send a simple cancellation email
  if (type === "booking_deleted" || type === "booking_cancelled") {
    const bodyText = `Hi ${driverFirstName},\n\nTrip #${app.booking_number} on ${formatLongDate(app.start_time)} at ${formatTime(app.start_time)} for passenger ${passengerName} has been CANCELLED.\n\n— ${businessName}`;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td style="background:#ef4444;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">✕ Trip Cancelled</span></td></tr><tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><div style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${driverFirstName},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">The following trip has been <strong>cancelled</strong>:</p><div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Passenger:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${passengerName}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Original Date:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatLongDate(app.start_time)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#991b1b;font-weight:600;">Original Time:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatTime(app.start_time)}</td></tr></table></div><p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">This trip has been removed from your schedule.</p></div><div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p></div></td></tr></table></td></tr></table></body></html>`;
    console.log(`\n[EMAIL→Driver] Sending cancellation to ${driverEmail}`);
    try {
      await sendEmail({
        to: driverEmail,
        from: fromAddress,
        subject: subjectLine,
        text: bodyText,
        html,
      });
      console.log(`[EMAIL→Driver] ✅ Cancellation sent to ${driverEmail}`);
    } catch (err) {
      console.error(`[EMAIL→Driver] ❌ Failed:`, err.message);
      throw err;
    }
    return;
  }

  // For created/changed/assigned — full trip details email
  const rawBaseUrl =
    settings.app_url ||
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    "";
  const baseUrl = rawBaseUrl.replace(/\/+$/, ""); // strip trailing slashes
  const driverConfirmUrl = app.driver_confirmation_token
    ? `${baseUrl}/driver/confirm/${app.driver_confirmation_token}`
    : null;
  const showConfirmButton = driverConfirmUrl && !app.driver_response_at;

  const totalPrice = services.reduce(
    (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
    0,
  );
  const totalDuration = services.reduce(
    (sum, s) => sum + (s.duration_minutes || 0) * (s.quantity || 1),
    0,
  );

  // Calculate credit card fee for driver email display
  const driverPayMethod = (app.payment_method || "").toLowerCase();
  const driverIsCardPayment =
    driverPayMethod === "card" ||
    driverPayMethod === "credit card" ||
    driverPayMethod === "square" ||
    driverPayMethod === "square invoice";
  const driverFeePercent = Number(settings?.credit_card_fee_percent || 4);
  const driverCreditCardFee =
    driverIsCardPayment && totalPrice > 0
      ? Math.round((Math.ceil(totalPrice) * driverFeePercent) / 100)
      : 0;
  const driverGrandTotal = Math.ceil(totalPrice) + driverCreditCardFee;

  const startTime = new Date(app.start_time);
  const endTime = new Date(startTime.getTime() + (totalDuration || 60) * 60000);
  const baseUrl2 = (
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    ""
  ).replace(/\/+$/, "");
  const icsUrl = `${baseUrl2}/api/appointments/${app.id}/ics?recipient=driver`;
  const gcalTitle = encodeURIComponent(
    `${businessName} — Trip #${app.booking_number}`,
  );
  const gcalDetails = encodeURIComponent(
    `Booking Code: #${app.booking_number}\nPassenger: ${passengerName}\nPhone: ${passengerPhone}${app.vehicle_name ? `\nVehicle: ${app.vehicle_name}` : ""}${app.driver_notes ? `\nDriver Notes: ${app.driver_notes}` : ""}`,
  );
  const gcalPickupLocation = encodeURIComponent(
    app.pickup_address || app.departure_location || "",
  );
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${toGCalDate(startTime)}/${toGCalDate(endTime)}&details=${gcalDetails}&location=${gcalPickupLocation}&ctz=America%2FChicago`;

  const hasValue = (val) => val !== null && val !== undefined;

  const pickupLower = (
    app.pickup_street ||
    app.pickup_address ||
    ""
  ).toLowerCase();
  const dropoffLower = (
    app.dropoff_street ||
    app.dropoff_address ||
    app.destination ||
    ""
  ).toLowerCase();
  const airportKeywords = ["airport", "terminal", "concourse"];
  const isPickupAtAirport = airportKeywords.some((kw) =>
    pickupLower.includes(kw),
  );
  const isDropoffAtAirport = airportKeywords.some((kw) =>
    dropoffLower.includes(kw),
  );
  const isIncomingFlight = isPickupAtAirport && !isDropoffAtAirport;
  const isOutgoingFlight = isDropoffAtAirport && !isPickupAtAirport;
  let flightLabel = "Flight Info";
  if (isIncomingFlight) flightLabel = "Incoming Flight";
  else if (isOutgoingFlight) flightLabel = "Outgoing Flight";

  const pickupAddress = app.pickup_street
    ? [app.pickup_street, app.pickup_city, app.pickup_state, app.pickup_zip]
        .filter(Boolean)
        .join(", ")
    : app.pickup_address || null;
  const dropoffAddress = app.dropoff_street
    ? [app.dropoff_street, app.dropoff_city, app.dropoff_state, app.dropoff_zip]
        .filter(Boolean)
        .join(", ")
    : app.dropoff_address || app.destination || null;

  // Badge text based on type
  const badgeText =
    type === "booking_changed"
      ? "✏ Trip Updated"
      : type === "booking_created"
        ? "🆕 New Trip Booked"
        : "🚗 You've Been Assigned";
  const headerColor = type === "booking_changed" ? "#d97706" : "#2563eb";

  const bodyText = `Hi ${driverFirstName},\n\n${type === "booking_changed" ? "A trip you are assigned to has been UPDATED." : type === "booking_created" ? "A new trip has been booked and assigned to you." : "You've been assigned to the following trip."}\n\nBooking Code: #${app.booking_number}\nDate: ${formatLongDate(app.start_time)}\nTime: ${formatTime(app.start_time)}\n${app.vehicle_name ? `Vehicle: ${app.vehicle_name}` : ""}\n\nPASSENGER CONTACT INFO:\nName: ${passengerName}\nPhone: ${passengerPhone}\nEmail: ${passengerEmail}\n\nTRIP DETAILS:\n${pickupAddress ? `Pickup: ${pickupAddress}` : ""}${dropoffAddress ? `\nDropoff: ${dropoffAddress}` : ""}${app.outgoing_flight_info ? `\n${flightLabel}: ${app.outgoing_flight_info}` : ""}${app.returning_flight_info ? `\nReturn Flight: ${app.returning_flight_info}` : ""}${app.notes ? `\nPassenger Notes: ${app.notes}` : ""}${app.driver_notes ? `\nNotes for You: ${app.driver_notes}` : ""}\n\n${services.length > 0 ? `PRICING:\n${services.map((s) => `  ${s.service_name || "Service"}: $${(Number(s.service_price) * Number(s.quantity || 1)).toFixed(2)}`).join("\n")}${driverCreditCardFee > 0 ? `\n  Credit Card Fee (${driverFeePercent}%): +$${driverCreditCardFee.toFixed(2)}` : ""}\nTotal: $${driverGrandTotal.toFixed(2)}\n${app.balance_due !== undefined ? `Balance Due: $${Number(app.balance_due).toFixed(2)}\n` : ""}` : ""}${showConfirmButton ? `Please confirm you can take this trip:\n${driverConfirmUrl}\n\n` : ""}— ${businessName}`;

  const driverHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>${businessName} — Driver Notification</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
        <tr><td style="background:${headerColor};border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;">
          <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${businessName}</p>
          <span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">${badgeText}</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);">
          <div style="padding:24px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${driverFirstName},</p>
            <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">${type === "booking_changed" ? "A trip you are assigned to has been <strong>updated</strong>. Here are the latest details:" : type === "booking_created" ? "A new trip has been booked and assigned to you:" : "You've been assigned to the following trip:"}</p>
            
            ${showConfirmButton ? `<div style="text-align:center;margin:0 0 20px 0;"><a href="${driverConfirmUrl}" style="display:inline-block;background:#10b981;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;box-shadow:0 2px 8px rgba(16,185,129,0.3);">✓ Confirm Trip</a><p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;">Click to accept or decline this trip</p></div>` : ""}
            
            <div style="background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Date:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatLongDate(app.start_time)}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Time:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatTime(app.start_time)}</td></tr>
                ${app.vehicle_name ? `<tr><td style="padding:5px 0;font-size:12px;color:#1e40af;font-weight:600;">Vehicle:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.vehicle_name}</td></tr>` : ""}
              </table>
            </div>

            <div style="background:#fef3c7;border:1.5px solid #fcd34d;border-radius:12px;padding:16px;margin-bottom:16px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#92400e;">PASSENGER CONTACT INFO:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="padding:5px 0;font-size:12px;color:#92400e;font-weight:600;">Name:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:600;text-align:right;">${passengerName}</td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#92400e;font-weight:600;">Phone:</td><td style="padding:5px 0;font-size:14px;color:#2563eb;font-weight:700;text-align:right;"><a href="tel:${passengerPhone}" style="color:#2563eb;text-decoration:none;">${passengerPhone}</a></td></tr>
                <tr><td style="padding:5px 0;font-size:12px;color:#92400e;font-weight:600;">Email:</td><td style="padding:5px 0;font-size:13px;color:#2563eb;font-weight:500;text-align:right;"><a href="mailto:${passengerEmail}" style="color:#2563eb;text-decoration:none;">${passengerEmail}</a></td></tr>
              </table>
            </div>

            <div style="background:#f9fafb;border:1.5px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#374151;">TRIP DETAILS:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${hasValue(app.num_people) ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;"># of People:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.num_people}</td></tr>` : ""}
                ${hasValue(app.num_bags_checked) ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Checked Bags:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.num_bags_checked}</td></tr>` : ""}
                ${hasValue(app.num_bags_carry_on) ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Carry-on Bags:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.num_bags_carry_on}</td></tr>` : ""}
                ${app.num_golf_bags > 0 ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Golf Bags:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.num_golf_bags}</td></tr>` : ""}
                ${app.num_car_seats > 0 ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Car Seats:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.num_car_seats}</td></tr>` : ""}
                ${app.outgoing_flight_info ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">${flightLabel}:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.outgoing_flight_info}</td></tr>` : ""}
                ${app.returning_flight_info ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Return Flight:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.returning_flight_info}</td></tr>` : ""}
                ${pickupAddress ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Pickup:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${pickupAddress}</td></tr>` : ""}
                ${dropoffAddress ? `<tr><td style="padding:5px 0;font-size:12px;color:#6b7280;font-weight:600;">Dropoff:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${dropoffAddress}</td></tr>` : ""}
                ${app.notes ? `<tr><td colspan="2" style="padding:8px 0 0 0;font-size:12px;color:#6b7280;font-weight:600;">Passenger Notes:</td></tr><tr><td colspan="2" style="font-size:13px;color:#111827;background:#fef3c7;padding:8px;border-radius:6px;">${app.notes}</td></tr>` : ""}
                ${app.driver_notes ? `<tr><td colspan="2" style="padding:8px 0 0 0;font-size:12px;color:#6b7280;font-weight:600;">Notes for You:</td></tr><tr><td colspan="2" style="font-size:13px;color:#111827;background:#fffbeb;padding:8px;border-radius:6px;">${app.driver_notes}</td></tr>` : ""}
              </table>
            </div>

            ${services.length > 0 ? `<div style="background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:16px;"><p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#15803d;">PRICING:</p><table width="100%" cellpadding="0" cellspacing="0">${services.map((s) => `<tr><td style="padding:3px 0;font-size:12px;color:#15803d;">${s.service_name || "Service"}:</td><td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">$${(Number(s.service_price) * Number(s.quantity || 1)).toFixed(2)}</td></tr>`).join("")}${driverCreditCardFee > 0 ? `<tr><td style="padding:3px 0;font-size:12px;color:#15803d;">Credit Card Fee (${driverFeePercent}%):</td><td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">+$${driverCreditCardFee.toFixed(2)}</td></tr>` : ""}<tr style="border-top:1.5px solid #bbf7d0;"><td style="padding:8px 0 0 0;font-size:13px;color:#15803d;font-weight:700;">Total:</td><td style="padding:8px 0 0 0;font-size:15px;color:#16a34a;font-weight:700;text-align:right;">$${driverGrandTotal.toFixed(2)}</td></tr>${app.balance_due !== undefined ? `<tr style="border-top:1.5px solid #bbf7d0;"><td style="padding:8px 0 0 0;font-size:13px;color:#15803d;font-weight:700;">Balance Due:</td><td style="padding:8px 0 0 0;font-size:16px;color:#16a34a;font-weight:800;text-align:right;">$${Number(app.balance_due).toFixed(2)}</td></tr>` : ""}</table></div>` : ""}
          </div>
          
          <div style="padding:0 16px 8px;text-align:center;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Add to My Calendar</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:8px;"><a href="${gcalUrl}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;"><img src="https://www.google.com/favicon.ico" width="14" height="14" style="vertical-align:middle;margin-right:4px;" alt="" />Google Calendar</a></td>
                <td><a href="${icsUrl}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">&#128197; Apple / Outlook</a></td>
              </tr>
            </table>
          </div>
          
          <div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  console.log(`\n[EMAIL→Driver] Sending ${type} to ${driverEmail}`);
  try {
    await sendEmail({
      to: driverEmail,
      from: fromAddress,
      subject: subjectLine,
      text: bodyText,
      html: driverHtml,
    });
    console.log(`[EMAIL→Driver] ✅ Successfully sent to ${driverEmail}\n`);
  } catch (err) {
    console.error(`[EMAIL→Driver] ❌ Failed:`, err.message);
    throw err;
  }
}

export async function sendDriverAssignedEmailToPassenger({
  app,
  settings,
  ownerEmail,
  fromAddress,
}) {
  const businessName = settings.business_name || "Catch A Ride";
  const firstName = app.client_name?.split(" ")[0] || "there";
  const subjectLine = `Your Driver Has Been Assigned — Booking #${app.booking_number}`;

  const bodyText = `Hi ${firstName},\n\nGreat news! ${app.employee_name || "Your driver"} has been assigned to your trip with ${businessName}.\n\nBooking Code: #${app.booking_number}\nDate: ${formatLongDate(app.start_time)}\nTime: ${formatTime(app.start_time)}\nDriver: ${app.employee_name || "Your driver"}\n${app.vehicle_name ? `Vehicle: ${app.vehicle_name}` : ""}\n${app.vehicle_profile_description ? `\nABOUT YOUR DRIVER:\n${app.vehicle_profile_description}\n` : ""}\nWe look forward to serving you!\n\n— ${businessName}`;

  // Build calendar links
  const calBaseUrl = (
    process.env.NEXT_PUBLIC_CREATE_APP_URL ||
    process.env.AUTH_URL ||
    process.env.BETTER_AUTH_URL ||
    ""
  ).replace(/\/+$/, "");
  const calIcsUrl = `${calBaseUrl}/api/appointments/${app.id}/ics?recipient=passenger`;
  const calStart = new Date(app.start_time);
  const calEnd = new Date(calStart.getTime() + 60 * 60000);
  const calGcalTitle = encodeURIComponent(
    `${businessName} — Trip #${app.booking_number}`,
  );
  const calGcalDetails = encodeURIComponent(
    `Booking Code: #${app.booking_number}\nDriver: ${app.employee_name || "Your driver"}${app.vehicle_name ? `\nVehicle: ${app.vehicle_name}` : ""}`,
  );
  const calGcalLocation = encodeURIComponent(
    app.pickup_address || app.departure_location || "",
  );
  const calGcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calGcalTitle}&dates=${toGCalDate(calStart)}/${toGCalDate(calEnd)}&details=${calGcalDetails}&location=${calGcalLocation}&ctz=America%2FChicago`;
  const calendarButtons = `<div style="padding:0 16px 8px;text-align:center;"><p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Add to My Calendar</p><table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="padding-right:8px;"><a href="${calGcalUrl}" target="_blank" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;"><img src="https://www.google.com/favicon.ico" width="14" height="14" style="vertical-align:middle;margin-right:4px;" alt="" />Google Calendar</a></td><td><a href="${calIcsUrl}" style="display:inline-block;background:#ffffff;border:1.5px solid #e5e7eb;color:#374151;font-family:'Inter',Arial,sans-serif;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">&#128197; Apple / Outlook</a></td></tr></table></div>`;

  const passengerHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:14px 12px;"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;"><tr><td style="background:#8b5cf6;border-radius:12px 12px 0 0;padding:14px 24px;text-align:center;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#ffffff;">${businessName}</p><span style="display:inline-block;background:rgba(255,255,255,0.22);color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:999px;">🚗 Driver Assigned</span></td></tr><tr><td style="background:#ffffff;border-radius:0 0 12px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.07);"><div style="padding:24px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p><p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Great news! <strong>${app.employee_name || "Your driver"}</strong> has been assigned to your upcoming trip.</p><div style="background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:12px;padding:16px;margin-bottom:16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:5px 0;font-size:12px;color:#5b21b6;font-weight:600;">Booking Code:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">#${app.booking_number}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#5b21b6;font-weight:600;">Date:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatLongDate(app.start_time)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#5b21b6;font-weight:600;">Time:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${formatTime(app.start_time)}</td></tr><tr><td style="padding:5px 0;font-size:12px;color:#5b21b6;font-weight:600;">Driver:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:700;text-align:right;">${app.employee_name || "Your driver"}</td></tr>${app.vehicle_name ? `<tr><td style="padding:5px 0;font-size:12px;color:#5b21b6;font-weight:600;">Vehicle:</td><td style="padding:5px 0;font-size:13px;color:#111827;font-weight:500;text-align:right;">${app.vehicle_name}</td></tr>` : ""}</table></div>${app.vehicle_profile_image_url || app.vehicle_profile_description ? `<div style="background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:12px;padding:20px;margin-bottom:16px;text-align:center;"><p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:0.5px;">Your Driver</p>${app.vehicle_profile_image_url ? `<img src="${app.vehicle_profile_image_url}" alt="${app.employee_name}" style="width:120px;height:120px;border-radius:60px;object-fit:cover;border:4px solid:#ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.15);margin-bottom:16px;" />` : ""}${app.vehicle_profile_description ? `<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${app.vehicle_profile_description}</p>` : ""}</div>` : ""}<p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">We look forward to serving you!</p></div>${calendarButtons}<div style="border-top:1px solid #f3f4f6;padding:10px 24px;text-align:center;"><p style="margin:0;font-size:11px;color:#d1d5db;">© ${new Date().getFullYear()} ${businessName} · All rights reserved</p></div></td></tr></table></td></tr></table></body></html>`;

  // Parse all passenger emails (primary + cc)
  const passengerEmails = getAllPassengerEmails(app);
  if (passengerEmails.length === 0) {
    console.error(
      `[EMAIL→Passenger Driver Assigned] ❌ No valid email addresses`,
    );
    return;
  }

  // Parse owner emails for BCC if employee_copy_comms is enabled
  const bccEmails = [];
  if (app.employee_copy_comms && ownerEmail) {
    bccEmails.push(ownerEmail);
  }

  console.log(
    `[EMAIL→Passenger Driver Assigned] Sending to ${passengerEmails.length} address(es): ${passengerEmails.join(", ")}`,
  );

  // Send separate email to each passenger address
  for (const email of passengerEmails) {
    try {
      await sendEmail({
        to: email,
        from: fromAddress,
        subject: subjectLine,
        text: bodyText,
        html: passengerHtml,
        ...(bccEmails.length > 0 ? { bcc: bccEmails } : {}),
      });
      console.log(`[EMAIL→Passenger Driver Assigned] ✅ Sent to ${email}`);
    } catch (err) {
      console.error(
        `[EMAIL→Passenger Driver Assigned] ❌ Failed to send to ${email}:`,
        err.message,
      );
    }
  }
  console.log(
    `[EMAIL→Passenger Driver Assigned] Completed sending to all addresses\n`,
  );
}
