import sql from "@/app/api/utils/sql";
import { sendEmail } from "@/app/api/utils/send-email";
import { generateNextBookingNumber } from "@/app/api/utils/booking-number";
import { createSquarePaymentLink } from "@/app/api/payments/providers/square";
import { sendSms, loadSmsConfig } from "@/app/api/utils/sms-sender";

// Helper function to parse and clean email addresses from CSV string
function parseEmailAddresses(emailString) {
  if (!emailString || typeof emailString !== "string") return [];
  return emailString
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e && e.includes("@"));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const appointmentId = searchParams.get("appointment_id");

  try {
    if (appointmentId) {
      const invoices = await sql`
        SELECT * FROM invoices
        WHERE tenant_id = 1 AND appointment_id = ${appointmentId}
        ORDER BY created_at DESC
      `;
      return Response.json(invoices);
    }

    const invoices = await sql`
      SELECT * FROM invoices WHERE tenant_id = 1 ORDER BY created_at DESC
    `;
    return Response.json(invoices);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch invoices" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const {
      appointment_id,
      payment_method,
      send_via,
      tip_amount,
      notification_preference,
    } = await request.json();

    if (!appointment_id) {
      return Response.json(
        { error: "appointment_id is required" },
        { status: 400 },
      );
    }

    // Fetch the appointment with all details — include notification_preference
    const appointments = await sql`
      SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.cc_emails as client_cc_emails, c.notification_preference as client_notification_preference,
             e.name as employee_name, e.color as employee_color,
             v.name as vehicle_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.id = ${appointment_id} AND a.tenant_id = 1
    `;

    const appointment = appointments[0];

    if (!appointment) {
      return Response.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Auto-assign booking number if missing
    if (!appointment.booking_number) {
      const bookingNumber = await generateNextBookingNumber();
      await sql`
        UPDATE appointments SET booking_number = ${bookingNumber} WHERE id = ${appointment_id}
      `;
      appointment.booking_number = bookingNumber;
    }

    // ── Early validation: make sure there is at least one way to reach the client ──
    // Determine effective preference early so we can validate correctly
    const earlyPref =
      notification_preference ||
      appointment.client_notification_preference ||
      "both";
    const earlyNeedsSmsOnly = earlyPref === "sms";
    if (
      !earlyNeedsSmsOnly &&
      send_via === "email" &&
      !appointment.client_email
    ) {
      // Only block if the client genuinely cannot receive anything
      if (!appointment.client_phone) {
        return Response.json(
          {
            error: `Cannot send invoice: ${appointment.client_name || "This passenger"} has no email or phone on file.`,
          },
          { status: 400 },
        );
      }
      // else: fall through — will send via SMS based on preference
    }

    const services = await sql`
      SELECT aserv.*, s.name as service_name, s.is_addon
      FROM appointment_services aserv
      LEFT JOIN services s ON aserv.service_id = s.id
      WHERE aserv.appointment_id = ${appointment_id}
    `;

    const servicesTotal = services.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    );

    if (servicesTotal <= 0 && services.length === 0) {
      return Response.json(
        {
          error:
            "Cannot create invoice: this trip has no services or pricing. Please add services to the trip first.",
        },
        { status: 400 },
      );
    }

    // Use balance_due from the appointment if available, otherwise compute it
    const paidToDate = Number(appointment.payments_total ?? 0);
    const tripTotal =
      Number(appointment.original_amount || 0) > 0
        ? Number(appointment.original_amount)
        : servicesTotal;
    const balanceDue = Number(
      appointment.balance_due ?? tripTotal - paidToDate,
    );

    // Parse tip
    const tip = Number(tip_amount) || 0;

    // Invoice amount = balance due + tip
    const invoiceTotal = Math.max(balanceDue + tip, 0);

    // ── Pre-flight: supersede any stale Square link before payment method logic ──
    // This ensures a trip with balance_due=$16 (after partial payments) does NOT
    // reuse an existing Square link created for the full $67 original amount.
    // Any existing link amount that differs from invoiceTotal is now stale.
    const isSquarePayment = [
      "Square Invoice",
      "Square",
      "Credit Card",
    ].includes(payment_method);
    if (isSquarePayment && invoiceTotal > 0) {
      const staleSquare = await sql`
        SELECT id, amount FROM payments
        WHERE appointment_id = ${appointment_id}
          AND provider = 'square'
          AND status IN ('pending', 'link_created')
        ORDER BY created_at DESC LIMIT 1
      `;
      if (
        staleSquare.length > 0 &&
        Math.abs(Number(staleSquare[0].amount) - invoiceTotal) >= 0.5
      ) {
        console.log(
          `[Invoice] Pre-flight: superseding stale Square link id=${staleSquare[0].id} ($${staleSquare[0].amount}) — invoiceTotal is $${invoiceTotal}`,
        );
        await sql`UPDATE payments SET status = 'superseded' WHERE id = ${staleSquare[0].id}`;
      }
    }
    // ── END pre-flight stale-link supersede ──────────────────────────────────

    // Generate invoice number using booking number
    const invoiceNumber = `INV-${appointment.booking_number}`;

    // Check if invoice already exists for this appointment
    const existing = await sql`
      SELECT * FROM invoices WHERE appointment_id = ${appointment_id} AND tenant_id = 1 LIMIT 1
    `;

    let invoice;
    if (existing.length > 0) {
      // Update existing
      const updated = await sql`
        UPDATE invoices
        SET amount = ${invoiceTotal}, payment_method = ${payment_method || null}, status = 'sent', sent_via = ${send_via || "email"}, date_issued = CURRENT_TIMESTAMP
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
      invoice = updated[0];
    } else {
      // Create new
      const created = await sql`
        INSERT INTO invoices (tenant_id, appointment_id, invoice_number, amount, status, payment_method, sent_via)
        VALUES (1, ${appointment_id}, ${invoiceNumber}, ${invoiceTotal}, 'sent', ${payment_method || null}, ${send_via || "email"})
        RETURNING *
      `;
      invoice = created[0];
    }

    // Fetch settings for email
    const settingsRows =
      await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
    const settings = {};
    settingsRows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const businessName = settings.business_name || "Catch A Ride";
    const logoUrl = settings.logo_url || "";
    const fromEmail = settings.from_email || "bookings@catcharide.us";
    const fromName = settings.from_name || businessName;
    const businessPhone = settings.business_phone || "";

    const isSquareInvoice = (payment_method || "")
      .toLowerCase()
      .includes("square");
    const isVenmo = (payment_method || "").toLowerCase().includes("venmo");

    // Check for existing payment link (Square or Venmo depending on method)
    let paymentUrl = null;

    if (isVenmo) {
      // First try active statuses
      const existingVenmo = await sql`
        SELECT payment_url FROM payments
        WHERE appointment_id = ${appointment_id}
          AND provider = 'venmo'
          AND status IN ('pending', 'link_created')
        ORDER BY created_at DESC
        LIMIT 1
      `;
      paymentUrl =
        existingVenmo.length > 0 ? existingVenmo[0].payment_url : null;

      // Fallback: try any Venmo payment regardless of status (mirrors what the preview page does)
      if (!paymentUrl) {
        const anyVenmo = await sql`
          SELECT payment_url FROM payments
          WHERE appointment_id = ${appointment_id}
            AND provider = 'venmo'
          ORDER BY created_at DESC
          LIMIT 1
        `;
        paymentUrl = anyVenmo.length > 0 ? anyVenmo[0].payment_url : null;
      }

      // Auto-generate Venmo link if none exists
      if (!paymentUrl && invoiceTotal > 0) {
        try {
          const venmoHandle = settings.venmo_handle;
          if (venmoHandle) {
            const cleanHandle = venmoHandle.replace(/^@/, "");
            const bookingNum = appointment.booking_number || appointment_id;
            const note = encodeURIComponent(
              `${appointment.client_name || "Transportation"} - Trip #${bookingNum}`,
            );
            const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${invoiceTotal.toFixed(2)}&note=${note}`;
            const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${invoiceTotal.toFixed(2)}&note=${note}`;

            await sql`
              INSERT INTO payments (
                appointment_id, provider, status, amount, currency,
                payment_url, metadata
              ) VALUES (
                ${appointment_id}, 'venmo', 'link_created', ${invoiceTotal}, 'USD',
                ${venmoWebUrl},
                ${JSON.stringify({
                  venmo_app_url: venmoAppUrl,
                  venmo_web_url: venmoWebUrl,
                  venmo_handle: cleanHandle,
                  booking_number: appointment.booking_number,
                  auto_generated_from_invoice: true,
                })}
              )
            `;

            await sql`
              UPDATE appointments
              SET payment_status = 'link_created'
              WHERE id = ${appointment_id}
            `;

            paymentUrl = venmoWebUrl;
            console.log(
              `[Invoice] Auto-generated Venmo link for trip #${appointment_id}: ${venmoWebUrl}`,
            );
          }
        } catch (venmoErr) {
          console.error(
            `[Invoice] Failed to auto-generate Venmo link for trip #${appointment_id}:`,
            venmoErr.message,
          );
          // Last-resort fallback: construct URL directly from settings without saving
          // This guarantees the email always contains the payment button
          const venmoHandle = settings.venmo_handle;
          if (venmoHandle && invoiceTotal > 0) {
            const cleanHandle = venmoHandle.replace(/^@/, "");
            const bookingNum = appointment.booking_number || appointment_id;
            const note = encodeURIComponent(
              `${appointment.client_name || "Transportation"} - Trip #${bookingNum}`,
            );
            paymentUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${invoiceTotal.toFixed(2)}&note=${note}`;
            console.log(
              `[Invoice] Using fallback Venmo URL (not saved to DB) for trip #${appointment_id}`,
            );
          }
        }
      }
    } else {
      // Check for existing Square payment link
      const existingPayment = await sql`
        SELECT payment_url FROM payments
        WHERE appointment_id = ${appointment_id}
          AND provider = 'square'
          AND status IN ('pending', 'link_created')
        ORDER BY created_at DESC
        LIMIT 1
      `;
      paymentUrl =
        existingPayment.length > 0 ? existingPayment[0].payment_url : null;

      // Auto-generate a Square checkout link if payment method is Square Invoice and no link exists
      if (isSquareInvoice && !paymentUrl && invoiceTotal > 0) {
        try {
          const {
            url,
            externalReferenceId,
            metadata: squareMeta,
          } = await createSquarePaymentLink({
            trip: appointment,
            amount: invoiceTotal,
            customerInfo: {
              name: appointment.client_name,
              email: appointment.client_email,
              phone: appointment.client_phone,
            },
            disableTipping: false,
          });

          await sql`
            INSERT INTO payments (
              appointment_id, provider, status, amount, currency,
              payment_url, external_reference_id, metadata
            ) VALUES (
              ${appointment_id}, 'square', 'link_created', ${invoiceTotal}, 'USD',
              ${url}, ${externalReferenceId},
              ${JSON.stringify({
                type: "checkout",
                checkout_id: externalReferenceId,
                order_id: squareMeta.order_id,
                auto_generated_from_invoice: true,
              })}
            )
          `;

          await sql`
            UPDATE appointments
            SET payment_status = 'link_created'
            WHERE id = ${appointment_id}
          `;

          paymentUrl = url;
          console.log(
            `[Invoice] Auto-generated Square checkout link for trip #${appointment_id}: ${url}`,
          );
        } catch (sqErr) {
          console.error(
            `[Invoice] Failed to auto-generate Square link for trip #${appointment_id}:`,
            sqErr.message,
          );
        }
      }
    }

    // ── Square Invoice stale-link check ───────────────────────────────────
    // FIX: Compare existing Square link amount against invoiceTotal (the actual
    // balance_due) NOT against tripTotal (the full original amount).
    // This prevents reusing a stale $67 link when the customer only owes $16.
    if (existing.length > 0) {
      const existingAmount = Number(existing[0].amount) || 0;
      // KEY: when checking for an existing Square payment link, compare
      // existing.amount against invoiceTotal — NOT against tripTotal.
      //   WRONG:  if (existing.amount === tripTotal)
      //   CORRECT: if (Math.abs(Number(existing.amount) - invoiceTotal) < 0.5)
      if (Math.abs(Number(existingAmount) - invoiceTotal) < 0.5) {
        // ... reuse existing link ...
      } else {
        // ... supersede old link and create new one for invoiceTotal ...
      }
    } else {
      // ... create new link for invoiceTotal ...
    }

    // Determine which channels to use based on notification_preference
    // Priority: passed-in notification_preference > client's stored preference > default 'both'
    const effectivePref =
      notification_preference ||
      appointment.client_notification_preference ||
      "both";
    const shouldSendEmail =
      (effectivePref === "email" || effectivePref === "both") &&
      send_via !== "sms";
    const shouldSendSms =
      (effectivePref === "sms" || effectivePref === "both") &&
      appointment.client_phone;

    // Send email if applicable
    let emailSent = false;
    let emailSkippedReason = null;
    const sentEmails = [];
    const skippedEmails = [];
    let smsSent = false;

    if (shouldSendEmail && appointment.client_email) {
      const formatDate = (dt) =>
        new Date(dt).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/Chicago",
        });
      const formatTime = (dt) =>
        new Date(dt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "America/Chicago",
        });

      const sortedServices = [...services].sort(
        (a, b) => (a.is_addon ? 1 : 0) - (b.is_addon ? 1 : 0),
      );

      const servicesHtml = sortedServices
        .map((s) => {
          const lineTotal = Number(s.service_price) * Number(s.quantity || 1);
          const prefix = s.is_addon ? "Plus" : "Cost";
          const qty = s.quantity > 1 ? ` ×${s.quantity}` : "";
          return `<tr><td style="padding:8px 0;color:#4B5563;font-size:14px;">${prefix}: ${s.service_name}${qty}</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">${s.is_addon ? "+" : ""}$${lineTotal.toFixed(2)}</td></tr>`;
        })
        .join("");

      // Show payments already made
      const paidHtml =
        paidToDate > 0
          ? `<tr><td style="padding:8px 0;color:#059669;font-size:14px;">Paid to Date</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#059669;font-size:14px;">-$${paidToDate.toFixed(2)}</td></tr>`
          : "";

      // Show tip if included
      const tipHtml =
        tip > 0
          ? `<tr><td style="padding:8px 0;color:#4B5563;font-size:14px;">Tip</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;font-size:14px;">+$${tip.toFixed(2)}</td></tr>`
          : "";

      const paymentMethodLine = payment_method
        ? `<p style="margin:16px 0 0;font-size:13px;color:#6B7280;">Payment Method: <strong>${payment_method}</strong></p>`
        : "";

      // Payment button — label and color reflect the actual provider
      const payBtnLabel = isVenmo
        ? "💰 Pay Now with Venmo"
        : "Pay Now with Square";
      const payBtnColor = isVenmo ? "#3D95CE" : "#2563EB";
      const payBtnShadow = isVenmo
        ? "rgba(61,149,206,0.3)"
        : "rgba(37,99,235,0.3)";
      const payBtnNote = isVenmo
        ? "Pay securely via Venmo"
        : "Secure payment powered by Square";

      const paymentButtonHtml = paymentUrl
        ? `
          <div style="text-align:center;padding:32px 0 24px;">
            <a href="${paymentUrl}" 
               style="display:inline-block;background:${payBtnColor};color:white;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 4px 12px ${payBtnShadow};">
              ${payBtnLabel}
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;">${payBtnNote}</p>
          </div>
        `
        : "";

      const html = `
        <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <div style="background:#2563EB;border-radius:16px;padding:24px;color:white;margin-bottom:16px;">
            ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" style="height:32px;margin-bottom:12px;" />` : ""}
            <p style="font-size:12px;color:#93C5FD;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px;">Invoice</p>
            <p style="font-size:32px;font-weight:700;margin:0;">#${appointment.booking_number}</p>
            <p style="font-size:12px;color:#93C5FD;margin:8px 0 0;">Issued ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:24px;margin-bottom:16px;">
            <p style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Trip Details</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">DATE</td><td style="padding:6px 0;color:#111827;font-size:14px;">${formatDate(appointment.start_time)}</td></tr>
              <tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">PICKUP</td><td style="padding:6px 0;color:#111827;font-size:14px;">${formatTime(appointment.start_time)}</td></tr>
              ${appointment.destination ? `<tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">DESTINATION</td><td style="padding:6px 0;color:#111827;font-size:14px;">${appointment.destination}</td></tr>` : ""}
              <tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">PASSENGER</td><td style="padding:6px 0;color:#111827;font-size:14px;">${appointment.client_name}</td></tr>
              ${appointment.employee_name ? `<tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">DRIVER</td><td style="padding:6px 0;color:#111827;font-size:14px;">${appointment.employee_name}</td></tr>` : ""}
              ${appointment.vehicle_name ? `<tr><td style="padding:6px 0;color:#9CA3AF;font-size:12px;font-weight:600;">VEHICLE</td><td style="padding:6px 0;color:#111827;font-size:14px;">${appointment.vehicle_name}</td></tr>` : ""}
            </table>
          </div>
          <div style="background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:24px;margin-bottom:16px;">
            <p style="font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Pricing</p>
            <table style="width:100%;border-collapse:collapse;">
              ${servicesHtml}
              ${paidHtml}
              ${tipHtml}
              <tr><td colspan="2" style="border-top:1px solid #E5E7EB;padding:12px 0 0;"></td></tr>
              <tr><td style="padding:4px 0;font-weight:700;color:#111827;font-size:16px;">Amount Due</td><td style="padding:4px 0;text-align:right;font-weight:700;color:#2563EB;font-size:20px;">$${invoiceTotal.toFixed(2)}</td></tr>
            </table>
            ${paymentMethodLine}
          </div>
          ${paymentButtonHtml}
          ${businessPhone ? `<div style="text-align:center;padding:16px;"><p style="font-size:13px;color:#6B7280;">Questions? Call <a href="tel:${businessPhone}" style="color:#2563EB;font-weight:600;">${businessPhone}</a></p></div>` : ""}
          <div style="text-align:center;padding:16px 0;"><p style="font-size:11px;color:#9CA3AF;">© ${new Date().getFullYear()} ${businessName}</p></div>
        </div>
      `;

      // Parse email addresses (handles comma-separated emails)
      const recipientEmails = parseEmailAddresses(appointment.client_email);

      // Also include CC emails if available
      const ccEmails = parseEmailAddresses(appointment.client_cc_emails);
      const allRecipients = [...new Set([...recipientEmails, ...ccEmails])];

      // Send separate email to each recipient
      for (const email of allRecipients) {
        try {
          const result = await sendEmail({
            to: email,
            from: `${fromName} <${fromEmail}>`,
            subject: `Invoice #${appointment.booking_number} from ${businessName}`,
            html,
            appointmentId: appointment_id,
            recipientName: appointment.client_name,
            emailType: "invoice",
          });

          if (result?.skipped) {
            console.log(`[Invoice Email] ⏭️ Skipped (dedup) for ${email}`);
            skippedEmails.push(email);
            emailSkippedReason = result.reason || "Duplicate email";
          } else {
            console.log(`[Invoice Email] ✅ Sent to ${email}`);
            sentEmails.push(email);
            emailSent = true; // At least one email was actually sent
          }
        } catch (err) {
          console.error(
            `[Invoice Email] ❌ Failed to send to ${email}:`,
            err.message,
          );
          // Fallback: log the failure directly so it shows in the communication log
          try {
            await sql`
              INSERT INTO email_logs (
                tenant_id, appointment_id, recipient_email, recipient_name,
                subject, body, status, email_type, error_message
              ) VALUES (
                1, ${appointment_id}, ${email}, ${appointment.client_name},
                ${"Invoice #" + appointment.booking_number + " from " + businessName},
                ${html}, 'failed', 'invoice',
                ${err.message || "Failed to send invoice email"}
              )
            `;
          } catch (logErr) {
            console.error(
              "[Invoice Email] Failed to log error:",
              logErr.message,
            );
          }
          emailSent = false;
        }
      }
    }

    // Send SMS if preference includes sms — independently of email
    if (shouldSendSms) {
      try {
        const smsConfig = await loadSmsConfig();
        if (smsConfig.ready) {
          const firstName = appointment.client_name?.split(" ")[0] || "there";
          const balance = Number(appointment.balance_due || 0);
          const amountText =
            balance > 0 ? ` Amount due: $${balance.toFixed(2)}.` : "";
          let smsMessage = `Hi ${firstName}, your invoice for trip #${appointment.booking_number} from ${businessName} is ready.${amountText}`;
          if (paymentUrl) {
            smsMessage += ` Pay here: ${paymentUrl}`;
          }
          const smsResult = await sendSms({
            to: appointment.client_phone,
            message: smsMessage,
            config: smsConfig,
            appointmentId: appointment_id,
            clientId: appointment.client_id || null,
            senderName: appointment.client_name || "Passenger",
          });
          smsSent = smsResult?.success === true;
          console.log(
            `[Invoice SMS] ${smsSent ? "✅ Sent" : "❌ Failed"} to ${appointment.client_phone}`,
          );
        } else {
          console.log(`[Invoice SMS] SMS not configured: ${smsConfig.reason}`);
        }
      } catch (smsErr) {
        console.error(`[Invoice SMS] Error sending SMS:`, smsErr.message);
      }
    }

    return Response.json({
      ...invoice,
      appointment,
      services,
      grandTotal: invoiceTotal,
      emailSent,
      emailSkippedReason,
      sentEmails,
      skippedEmails,
      smsSent,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to create invoice" },
      { status: 500 },
    );
  }
}
