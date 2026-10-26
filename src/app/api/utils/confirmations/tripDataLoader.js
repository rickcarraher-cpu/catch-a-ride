/**
 * Trip Data Loader
 * Loads complete trip data with all related information
 */

import sql from "@/app/api/utils/sql";
import { generatePaymentLinkIfNeeded } from "./paymentLinkGenerator.js";

/**
 * Load complete trip data with all related information
 */
export async function loadTripData(appointmentId) {
  const [trip] = await sql`
    SELECT 
      a.*,
      c.name AS client_name,
      c.email AS client_email,
      c.phone AS client_phone,
      c.notification_preference,
      c.cc_emails AS cc_emails,
      e.name AS employee_name,
      e.email AS employee_email,
      e.phone AS employee_phone,
      e.profile_image_url AS employee_profile_image_url,
      v.name AS vehicle_name,
      va.profile_image_url AS vehicle_profile_image_url,
      va.profile_description AS vehicle_profile_description
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    LEFT JOIN employees e ON a.employee_id = e.id
    -- Only use the vehicle explicitly set on the trip — never fall back to driver's current vehicle
    LEFT JOIN vehicles v ON v.id = a.vehicle_id
    LEFT JOIN vehicle_assignments va
           ON va.vehicle_id = a.vehicle_id
          AND va.employee_id = a.employee_id
    WHERE a.id = ${appointmentId}
  `;

  if (!trip) {
    throw new Error(`Appointment ${appointmentId} not found`);
  }

  // Display fields (display_full_datetime, display_time, display_sms_datetime, etc.)
  // are now read directly from the database. All consumers now use trip.display_*
  // instead of recalculating at runtime.

  // === DEBUG: Log what was loaded from DB ===
  console.log(
    `[loadTripData] Loaded trip #${trip.booking_number || trip.id} from DB:`,
  );
  console.log(`  - payment_method from DB: "${trip.payment_method || "NULL"}"`);
  console.log(`  - payment_status from DB: "${trip.payment_status || "NULL"}"`);
  console.log(`  - payment_amount from DB: ${trip.payment_amount || "NULL"}`);
  console.log(`  - original_amount from DB: ${trip.original_amount || "NULL"}`);
  // === END DEBUG ===

  const services = await sql`
    SELECT aps.*, s.name AS service_name
    FROM appointment_services aps
    LEFT JOIN services s ON aps.service_id = s.id
    WHERE aps.appointment_id = ${appointmentId}
  `;

  const transactions = await sql`
    SELECT *
    FROM transactions
    WHERE appointment_id = ${appointmentId}
    ORDER BY created_at DESC
  `;

  // Use cached fields from the appointments row — they are kept current by cached-calculations.js
  // No need to call calculateBalance() — trip was just loaded with SELECT a.* which includes
  // original_amount, balance_due, payments_total, tips_total already in memory.
  const totalAmount = Number(trip.original_amount || 0);
  const balance = Math.max(0, Number(trip.balance_due || 0));

  // Load existing payment link from database
  // IMPORTANT: Do NOT load payment links for already-paid trips
  let paymentUrl = null;

  // Check if trip is paid
  const isPaid = trip.payment_status === "paid" || balance <= 0;

  if (isPaid) {
    console.log(
      `[loadTripData] Trip #${trip.booking_number || trip.id} is paid — not loading payment link`,
    );
  } else {
    const paymentRows = await sql`
      SELECT payment_url, provider, status, amount
      FROM payments
      WHERE appointment_id = ${appointmentId}
        AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;

    console.log(
      `[loadTripData] Payment link query for trip #${trip.booking_number || trip.id}:`,
    );
    console.log(`  - Found ${paymentRows.length} payment record(s)`);

    if (paymentRows.length > 0) {
      const existingPayment = paymentRows[0];
      const existingAmount = Number(existingPayment.amount || 0);

      // Verify the stored amount matches what the trip record says we should charge.
      // original_amount is set by the admin and includes any CC fee; payments_total
      // reflects cash already collected. If these diverge from the stored link, the
      // link was created before the CC fee (or a price correction) was applied.
      const tripOriginalAmount = Number(trip.original_amount || 0);
      const tripPaymentsTotal = Number(trip.payments_total || 0);
      const expectedAmount =
        tripOriginalAmount > 0
          ? Math.max(0, tripOriginalAmount - tripPaymentsTotal)
          : balance;

      if (
        expectedAmount > 0 &&
        Math.abs(existingAmount - expectedAmount) >= 0.5
      ) {
        // Amount mismatch — let generatePaymentLinkIfNeeded supersede the stale
        // link and create a fresh one at the correct amount (with tipping enabled).
        console.log(
          `[loadTripData] Existing link amount $${existingAmount} ≠ expected $${expectedAmount} for trip #${trip.booking_number || trip.id} — regenerating`,
        );
        paymentUrl = await generatePaymentLinkIfNeeded(trip, balance);
      } else {
        paymentUrl = existingPayment.payment_url;
        console.log(`  - payment_url: "${paymentUrl}"`);
        console.log(`  - provider: "${existingPayment.provider}"`);
        console.log(`  - status: "${existingPayment.status}"`);
        console.log(`  - amount: $${existingPayment.amount}`);
      }
    } else {
      console.log(`  - No payment link found in database`);

      // If no payment link exists and balance > 0, try to auto-generate one
      if (balance > 0) {
        console.log(
          `[loadTripData] No payment link found for trip #${trip.booking_number || trip.id} with balance $${balance.toFixed(2)} — attempting auto-generation...`,
        );
        paymentUrl = await generatePaymentLinkIfNeeded(trip, balance);

        if (paymentUrl) {
          console.log(
            `[loadTripData] ✅ Auto-generated payment link: ${paymentUrl}`,
          );
        } else {
          console.log(`[loadTripData] ⚠️ Could not auto-generate payment link`);
        }
      }
    }
  }

  // === DEBUG: Log payment link result ===
  console.log(`[loadTripData] Final payment link result:`);
  console.log(`  - paymentUrl: ${paymentUrl ? `"${paymentUrl}"` : "NULL"}`);
  console.log(`  - balance: $${balance.toFixed(2)}`);
  // === END DEBUG ===

  // Load preferred locations that have notification emails configured
  let preferredLocations = [];
  try {
    preferredLocations = await sql`
      SELECT id, label, street, city, state, zip, email
      FROM preferred_locations
      WHERE is_active = true AND email IS NOT NULL AND email != ''
    `;
    if (preferredLocations.length > 0) {
      console.log(
        `[loadTripData] Found ${preferredLocations.length} preferred location(s) with notification emails`,
      );
    }
  } catch (err) {
    console.error(
      "[loadTripData] Failed to load preferred locations:",
      err.message,
    );
  }

  return {
    trip,
    services,
    transactions,
    balance,
    totalAmount,
    paymentUrl,
    preferredLocations,
  };
}
