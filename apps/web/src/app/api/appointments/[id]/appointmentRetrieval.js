import sql from "@/app/api/utils/sql";
import { generateNextBookingNumber } from "@/app/api/utils/booking-number";
import { cancelSquareOrder } from "@/app/api/payments/providers/square";

export async function getAppointmentById(id) {
  const [appointment] = await sql`
    SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
           e.name as employee_name, e.color as employee_color, e.profile_image_url as employee_profile_image,
           v.name as vehicle_name,
           va.profile_image_url as vehicle_profile_image_url,
           va.profile_description as vehicle_profile_description
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    LEFT JOIN employees e ON a.employee_id = e.id
    LEFT JOIN vehicles v ON a.vehicle_id = v.id
    LEFT JOIN vehicle_assignments va ON va.vehicle_id = a.vehicle_id AND va.employee_id = a.employee_id
    WHERE a.id = ${id} AND a.tenant_id = 1 AND a.status != 'deleted'
  `;

  if (!appointment) {
    return null;
  }

  // Auto-generate booking number for old records that don't have one
  if (!appointment.booking_number) {
    try {
      const bookingNumber = await generateNextBookingNumber();
      await sql`UPDATE appointments SET booking_number = ${bookingNumber} WHERE id = ${id}`;
      appointment.booking_number = bookingNumber;
    } catch (e) {
      console.error("Failed to backfill booking number:", e);
    }
  }

  // Auto-clear "needs_review" status when an admin opens the trip
  if (appointment.status === "needs_review") {
    await sql`UPDATE appointments SET status = 'pending' WHERE id = ${id}`;
    appointment.status = "pending";
    console.log(
      `[GET /api/appointments/${id}] Auto-cleared needs_review → pending (admin opened trip)`,
    );
  }

  // One-time cleanup: strip "Price Adjustment:" lines that were accidentally
  // written to the notes field in a previous version of the code.
  if (appointment.notes && appointment.notes.includes("Price Adjustment:")) {
    const cleaned =
      appointment.notes
        .split("\n")
        .filter((line) => !line.trim().startsWith("Price Adjustment:"))
        .join("\n")
        .trim() || null;

    try {
      await sql`UPDATE appointments SET notes = ${cleaned} WHERE id = ${id}`;
      appointment.notes = cleaned;
      console.log(
        `[GET /api/appointments/${id}] Auto-stripped Price Adjustment lines from notes`,
      );
    } catch (cleanupErr) {
      console.error(
        `[GET /api/appointments/${id}] Failed to clean notes:`,
        cleanupErr.message,
      );
    }
  }

  // Display fields (display_long_date, display_time, etc.) are now read directly from the database

  return appointment;
}

export async function syncPaymentStatus(id, appointment) {
  if (appointment.payment_status === "paid") {
    const activePayments = await sql`
      SELECT id, provider, status, metadata
      FROM payments
      WHERE appointment_id = ${id}
        AND status IN ('pending', 'link_created', 'manual_pending')
    `;

    if (activePayments.length > 0) {
      console.log(
        `[GET ${id}] Trip marked paid but ${activePayments.length} active payment link(s) found - superseding...`,
      );

      for (const payment of activePayments) {
        // Cancel Square orders if applicable
        if (payment.provider === "square") {
          try {
            const metadata = payment.metadata
              ? typeof payment.metadata === "string"
                ? JSON.parse(payment.metadata)
                : payment.metadata
              : null;
            const orderId = metadata?.order_id;

            if (orderId) {
              await cancelSquareOrder(orderId);
              console.log(
                `[GET ${id}] Cancelled Square order ${orderId} for superseded payment #${payment.id}`,
              );
            }
          } catch (cancelErr) {
            console.error(
              `[GET ${id}] Failed to cancel Square order for payment #${payment.id}:`,
              cancelErr.message,
            );
          }
        }

        // Mark payment as superseded
        await sql`UPDATE payments SET status = 'superseded' WHERE id = ${payment.id}`;
      }

      console.log(
        `[GET ${id}] Superseded ${activePayments.length} payment link(s) to sync with trip payment_status`,
      );
    }
  }
}

export async function getAppointmentServices(id) {
  return await sql`
    SELECT aserv.*, s.name as service_name, s.is_addon as is_addon, s.is_airport_service as is_airport_service, s.is_tip_addon as is_tip_addon
    FROM appointment_services aserv
    LEFT JOIN services s ON aserv.service_id = s.id
    WHERE aserv.appointment_id = ${id}
  `;
}

export async function getAppointmentTransactions(id) {
  return await sql`
    SELECT * FROM transactions 
    WHERE appointment_id = ${id} AND tenant_id = 1
    ORDER BY transaction_date DESC
  `;
}

export async function getAppointmentWithDetails(id) {
  const appointment = await getAppointmentById(id);

  if (!appointment) {
    return null;
  }

  await syncPaymentStatus(id, appointment);

  const services = await getAppointmentServices(id);
  const transactions = await getAppointmentTransactions(id);

  // Use cached financial fields from the appointments row (payments_total, tips_total, balance_due)
  // These are kept up to date by cached-calculations.js on every write.
  // No need to call calculateBalance() here — that would re-query transactions unnecessarily.
  return {
    ...appointment,
    services,
    transactions,
  };
}
