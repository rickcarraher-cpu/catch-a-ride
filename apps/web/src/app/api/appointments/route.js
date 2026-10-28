import sql from "@/app/api/utils/sql";
import { requireAuth } from "@/app/api/utils/auth-guard";
import { auth } from "@/auth";
import { sendSms } from "@/app/api/utils/sms-sender";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";
import { insertAppointmentWithBookingNumber } from "@/app/api/utils/booking-number";
import { createSquarePaymentLink } from "@/app/api/payments/providers/square";
import {
  createConversation,
  addPassengerToConversation,
  addDriverToConversation,
} from "@/app/api/utils/conversations";
import { recalculateAllCachedFields } from "@/app/api/utils/cached-calculations";
import { randomBytes } from "crypto";
import { sendAfterHoursAlert } from "@/app/api/utils/afterHoursAlert";
import { resolveTenantFromSession } from "@/app/api/utils/tenant-resolver";
import { snapshotDriverCommissionRate } from "@/app/api/appointments/[id]/fieldUpdates";
import { logChange } from "@/app/api/utils/change-log";

export async function GET(request) {
  const authCheck = await requireAuth();
  if (authCheck.error) return authCheck.error;

  const tenantId = await resolveTenantFromSession(request);

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  let employee_id = searchParams.get("employee_id");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");
  const payment_status = searchParams.get("payment_status");
  const dateWindow = searchParams.get("window"); // 'all' to skip default date window
  const is_tour = searchParams.get("is_tour"); // Filter for tours only

  // ── SECURITY: Verify driver can only see their own trips ──────────────────
  try {
    const session = authCheck.session;

    if (session?.user?.email) {
      const [driver] = await sql`
        SELECT id, is_admin FROM employees 
        WHERE LOWER(email) = LOWER(${session.user.email}) 
          AND tenant_id = ${tenantId} 
          AND is_active = true
      `;

      if (driver) {
        // If the user is NOT an admin, force them to only see their own trips
        if (!driver.is_admin) {
          employee_id = String(driver.id);
          console.log(
            `[GET /api/appointments] Non-admin driver ${driver.id} restricted to viewing own trips only`,
          );
        }
        // If they ARE an admin, allow the requested employee_id filter
      }
    }
  } catch (authError) {
    console.error("Driver security check error:", authError);
    // Continue with original employee_id if check fails
  }

  try {
    // Only exclude 'deleted' status - show all other statuses including cancelled
    // Cancelled trips are now visible by default so users can see their full trip history
    const excludedStatuses = `('deleted')`;

    let query = `
      SELECT a.*, c.name as client_name, c.phone as client_phone, c.email as client_email,
             c.is_new_passenger as client_is_new_passenger,
             c.referral_source,
             e.name as employee_name, e.color as employee_color, e.profile_image_url as employee_profile_image_url, e.copy_communications_to_company as employee_copy_comms,
             v.name as vehicle_name, v.category as vehicle_actual_category,
             va.profile_image_url as vehicle_profile_image_url,
             va.profile_description as vehicle_profile_description,
             pmt.payment_methods,
             pmt.has_cash_tip,
             a.driver_accepted,
             a.driver_response_at,
             a.passenger_confirmed,
             a.passenger_response_at
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id AND c.is_active IS NOT FALSE
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_assignments va ON va.vehicle_id = a.vehicle_id AND va.employee_id = a.employee_id
      LEFT JOIN (
        SELECT appointment_id, 
               STRING_AGG(DISTINCT method, ', ' ORDER BY method) as payment_methods,
               BOOL_OR(category IN ('payment', 'tip') AND method = 'Cash' AND COALESCE(tip_amount, 0) > 0) as has_cash_tip
        FROM transactions
        WHERE category IN ('payment', 'tip')
        GROUP BY appointment_id
      ) pmt ON pmt.appointment_id = a.id
      WHERE a.tenant_id = $1
        AND a.status NOT IN ${excludedStatuses}
    `;
    const params = [tenantId];

    // Filter by is_tour if specified
    if (is_tour === "true") {
      query += ` AND a.is_tour = true`;
    } else if (is_tour === "false") {
      query += ` AND (a.is_tour = false OR a.is_tour IS NULL)`;
    }

    // Default ±30 day window for performance — only loads the working window
    // Use ?window=all to skip this and load all trips
    // If explicit start/end params are provided, those take priority
    if (start) {
      params.push(start);
      query += ` AND a.start_time >= $${params.length}`;
    } else if (dateWindow !== "all") {
      // Apply default -30 day window (past 30 days from today)
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);
      params.push(defaultStart.toISOString());
      query += ` AND a.start_time >= $${params.length}`;
    }

    if (end) {
      params.push(end);
      query += ` AND a.start_time <= $${params.length}`;
    } else if (dateWindow !== "all") {
      // Apply default +30 day window (next 30 days from today)
      const defaultEnd = new Date();
      defaultEnd.setDate(defaultEnd.getDate() + 30);
      params.push(defaultEnd.toISOString());
      query += ` AND a.start_time <= $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND a.employee_id = $${params.length}`;
    }

    if (payment_status) {
      params.push(payment_status);
      query += ` AND a.payment_status = $${params.length}`;
    }

    query += ` ORDER BY a.start_time DESC`;

    // Add pagination support
    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const appointments = await sql(query, params);

    // Fetch all services in one query instead of one per appointment (N+1)
    let appointmentsWithServices = appointments.map((app) => ({
      ...app,
      appointment_services: [],
    }));

    if (appointments.length > 0) {
      const appointmentIds = appointments.map((a) => a.id);
      const placeholders = appointmentIds.map((_, i) => `$${i + 1}`).join(", ");
      const allServices = await sql(
        `SELECT aserv.*, s.name as service_name, s.is_addon as is_addon
         FROM appointment_services aserv
         JOIN services s ON aserv.service_id = s.id
         WHERE aserv.appointment_id IN (${placeholders})`,
        appointmentIds,
      );

      // Group services by appointment_id
      const servicesByAppointment = {};
      for (const svc of allServices) {
        if (!servicesByAppointment[svc.appointment_id]) {
          servicesByAppointment[svc.appointment_id] = [];
        }
        servicesByAppointment[svc.appointment_id].push(svc);
      }

      appointmentsWithServices = appointments.map((app) => ({
        ...app,
        appointment_services: servicesByAppointment[app.id] || [],
      }));
    }

    // Fetch balance information for all appointments
    // NO LONGER RECALCULATING - just read from cached fields on the appointment
    // const balances = await calculateBalanceBatch(
    //   appointmentsWithServices.map((a) => a.id),
    // );

    // Merge balance information into appointments
    // Balance data is now ALREADY on the appointment from the main query
    const appointmentsWithBalance = appointmentsWithServices.map((app) => {
      return {
        ...app,
        // These fields are now stored on the appointment record itself:
        // - services_total
        // - driver_commission
        // - payments_total (already present)
        // - tips_total
        // - balance_due
        // No need to merge from separate query
      };
    });

    // Auto-complete past trips that are paid in full
    const now = new Date();
    const tripsToComplete = [];

    for (const app of appointmentsWithBalance) {
      const tripDate = new Date(app.start_time);
      const isPast = tripDate < now;
      const isPaidInFull = app.balance_due <= 0 && app.payments_total > 0;
      const needsCompletion =
        app.status !== "completed" &&
        app.status !== "cancelled" &&
        app.status !== "canceled" &&
        app.status !== "deleted";

      if (isPast && isPaidInFull && needsCompletion) {
        tripsToComplete.push(app.id);
        app.status = "completed"; // Update in-memory for this response
      }
    }

    // Batch update completed trips in database
    if (tripsToComplete.length > 0) {
      const placeholders = tripsToComplete
        .map((_, i) => `$${i + 1}`)
        .join(", ");
      await sql(
        `UPDATE appointments SET status = 'completed' WHERE id IN (${placeholders})`,
        tripsToComplete,
      );
      console.log(
        `[Auto-complete] Marked ${tripsToComplete.length} past paid trips as completed: ${tripsToComplete.join(", ")}`,
      );
    }

    return Response.json(appointmentsWithBalance);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch appointments" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log("POST /api/appointments - Received body:", body);
    console.log("returning_flight_info:", body.returning_flight_info);
    console.log("return_date:", body.return_date);

    // Get logged-in user email for audit trail
    const session = await auth();
    const userEmail = session?.user?.email || "unknown";

    const {
      client_id,
      employee_id,
      start_time,
      status,
      booked_by,
      booker_name,
      notes,
      services,
      is_tentative,
      tentative_reason,
      num_people,
      num_bags_checked,
      num_bags_carry_on,
      num_car_seats,
      num_golf_bags,
      special_items,
      outgoing_flight_info,
      returning_flight_info,
      return_date,
      driver_notes,
      vehicle_id,
      vehicle_category,
      destination,
      payment_method,
      requested_driver_name,
      pickup_address,
      dropoff_address,
      pickup_street,
      pickup_city,
      pickup_state,
      pickup_zip,
      dropoff_street,
      dropoff_city,
      dropoff_state,
      dropoff_zip,
      distance_miles: client_distance_miles,
      distance_method: client_distance_method,
      send_notification, // Extract notification preference
      is_international_flight,
      customs_clearance_location,
      // NEW: Tour-specific fields
      is_tour,
      tour_end_time,
      tour_participant_type,
      tour_flat_fee,
      tour_payment_split,
      tour_participants,
      tour_itinerary,
      tour_notes, // Free-form itinerary description
      // NEW: Wedding field
      wedding_id,
    } = body;

    // Validate required fields
    if (!start_time) {
      return Response.json(
        { error: "Date & time is required" },
        { status: 400 },
      );
    }

    // ── Deduplication guard for passenger bookings ─────────────────────
    // If the same client submits the same trip within 60 seconds, return the
    // existing appointment rather than creating a duplicate.
    if (booked_by === "Passenger" && client_id && start_time) {
      const existing = await sql`
        SELECT id, booking_number FROM appointments
        WHERE client_id = ${Number(client_id)}
          AND start_time = ${start_time}
          AND booked_by = 'Passenger'
          AND created_at >= NOW() - INTERVAL '60 seconds'
        LIMIT 1
      `;
      if (existing.length > 0) {
        console.log(
          `[POST] Dedup: Duplicate passenger booking detected for client ${client_id} — returning existing appointment #${existing[0].id}`,
        );
        return Response.json(existing[0]);
      }
    }
    // ──────────────────────────────────────────────────────────────────

    // NEW: Validate that return trips cannot have a return_date
    const isReturnTrip = notes && notes.toLowerCase().includes("return trip");
    if (isReturnTrip && return_date) {
      return Response.json(
        {
          error:
            "A return trip cannot have its own return date. This creates a logical inconsistency.",
        },
        { status: 400 },
      );
    }

    // Coerce empty strings to null for numeric/FK fields
    const toIntOrNull = (v) =>
      v === "" || v === null || v === undefined ? null : Number(v);
    const toStrOrNull = (v) =>
      v === "" || v === null || v === undefined ? null : v;
    const toDateOrNull = (v) =>
      v === "" || v === null || v === undefined ? null : v;

    console.log("After conversion - return_date:", toDateOrNull(return_date));
    console.log(
      "After conversion - returning_flight_info:",
      toStrOrNull(returning_flight_info),
    );

    // Generate confirmation tokens for driver and passenger
    const driverConfirmationToken = employee_id
      ? randomBytes(32).toString("hex")
      : null;
    const passengerConfirmationToken = client_id
      ? randomBytes(32).toString("hex")
      : null;

    // Determine dispatcher name — only for Admin-booked trips (i.e. from the Booking Wizard)
    // Priority: 1) employee name from employees table, 2) session user name, 3) session email
    // ── Resolve dispatcher name: employee record → session name → email ──
    let bookedByDispatcher = null;
    if (session?.user?.email) {
      try {
        const [dispatcherEmployee] = await sql`
          SELECT name FROM employees
          WHERE LOWER(email) = LOWER(${session.user.email})
            AND is_active = true
          LIMIT 1
        `;
        if (dispatcherEmployee?.name) {
          bookedByDispatcher = dispatcherEmployee.name;
        } else if (session.user.name) {
          bookedByDispatcher = session.user.name;
        } else {
          bookedByDispatcher = session.user.email;
        }
      } catch (dispatcherLookupErr) {
        console.error(
          "[Dispatcher Lookup] Failed:",
          dispatcherLookupErr.message,
        );
        bookedByDispatcher =
          session?.user?.name || session?.user?.email || null;
      }
    } else if (session?.user?.name) {
      bookedByDispatcher = session.user.name;
    }

    // Insert appointment with automatic booking number retry on duplicate
    const appointment = await insertAppointmentWithBookingNumber({
      client_id: toIntOrNull(client_id),
      employee_id: toIntOrNull(employee_id),
      start_time,
      // SAFEGUARD: Passenger/Online bookings must always be "needs_review"
      // so the office sees them and can approve. Never allow "pending" for these sources.
      status:
        booked_by === "Passenger" || booked_by === "Online"
          ? "needs_review"
          : status || "pending",
      booked_by: booked_by || "Admin",
      booker_name: toStrOrNull(booker_name),
      booked_by_dispatcher: bookedByDispatcher,
      // For tours, use tour_notes as the notes field (free-form itinerary description)
      notes: is_tour ? toStrOrNull(tour_notes) : toStrOrNull(notes),
      is_tentative: is_tentative ?? false,
      tentative_reason: toStrOrNull(tentative_reason),
      num_people: toIntOrNull(num_people),
      num_bags_checked: toIntOrNull(num_bags_checked),
      num_bags_carry_on: toIntOrNull(num_bags_carry_on),
      num_car_seats: toIntOrNull(num_car_seats),
      num_golf_bags: toIntOrNull(num_golf_bags),
      special_items: toStrOrNull(special_items),
      outgoing_flight_info: toStrOrNull(outgoing_flight_info),
      returning_flight_info: toStrOrNull(returning_flight_info),
      return_date: toDateOrNull(return_date),
      driver_notes: toStrOrNull(driver_notes),
      vehicle_id: toIntOrNull(vehicle_id),
      vehicle_category: toStrOrNull(vehicle_category),
      destination: toStrOrNull(destination),
      payment_method: toStrOrNull(payment_method),
      requested_driver_name: toStrOrNull(requested_driver_name),
      pickup_address: toStrOrNull(pickup_address),
      dropoff_address: toStrOrNull(dropoff_address),
      pickup_street: toStrOrNull(pickup_street),
      pickup_city: toStrOrNull(pickup_city),
      pickup_state: toStrOrNull(pickup_state),
      pickup_zip: toStrOrNull(pickup_zip),
      dropoff_street: toStrOrNull(dropoff_street),
      dropoff_city: toStrOrNull(dropoff_city),
      dropoff_state: toStrOrNull(dropoff_state),
      dropoff_zip: toStrOrNull(dropoff_zip),
      driver_confirmation_token: driverConfirmationToken,
      passenger_confirmation_token: passengerConfirmationToken,
      is_international_flight: is_international_flight ?? false,
      customs_clearance_location: toStrOrNull(customs_clearance_location),
      // NEW: Tour fields
      is_tour: body.is_tour || false,
      tour_end_time: body.tour_end_time || null,
      tour_participant_type: body.tour_participant_type || null,
      tour_flat_fee: body.tour_flat_fee || 0,
      tour_payment_split: body.tour_payment_split || null,
      needs_receipt: body.needs_receipt === true,
      last_modified_by: session?.user?.email || null,
      gift_certificate: toStrOrNull(body.gift_certificate),
      // NEW: Wedding field
      wedding_id: toIntOrNull(wedding_id),
    });

    console.log("Created appointment:", appointment);

    // Lock in the driver's commission rate at time of booking
    if (appointment.employee_id) {
      await snapshotDriverCommissionRate(
        appointment.id,
        appointment.employee_id,
      );
    }

    // ── Save tour-specific data ────────────────────────────────────────
    if (is_tour) {
      // Save tour participants (additional guests only - primary passenger is client_id)
      if (tour_participants && Array.isArray(tour_participants)) {
        for (const guest of tour_participants) {
          await sql`
            INSERT INTO tour_participants (
              appointment_id,
              participant_type,
              client_id,
              name,
              phone,
              email,
              pickup_location,
              dropoff_location
            ) VALUES (
              ${appointment.id},
              'guest',
              ${null},
              ${guest.name},
              ${null},
              ${null},
              ${guest.pickup_location || null},
              ${guest.dropoff_location || null}
            )
          `;
        }
        console.log(
          `[POST] Saved ${tour_participants.length} additional guests for tour #${appointment.id}`,
        );
      }

      // Save tour itinerary
      if (tour_itinerary && Array.isArray(tour_itinerary)) {
        for (const stop of tour_itinerary) {
          await sql`
            INSERT INTO tour_itinerary (
              appointment_id,
              sequence_order,
              location,
              description
            ) VALUES (
              ${appointment.id},
              ${stop.sequence_order || 0},
              ${stop.location},
              ${stop.description || null}
            )
          `;
        }
        console.log(
          `[POST] Saved ${tour_itinerary.length} itinerary stops for tour #${appointment.id}`,
        );
      }

      // For tours, set original_amount to tour_flat_fee
      if (tour_flat_fee && Number(tour_flat_fee) > 0) {
        let originalAmount = Math.ceil(Number(tour_flat_fee));

        // Add credit card processing fee if applicable
        if (
          (payment_method === "Credit Card" ||
            payment_method === "Square" ||
            payment_method === "Square Invoice") &&
          originalAmount > 0
        ) {
          const feeSettingsRows = await sql`
            SELECT value FROM settings 
            WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
          `;
          const feePercent =
            feeSettingsRows.length > 0 ? Number(feeSettingsRows[0].value) : 4;

          const creditCardFee = (originalAmount * feePercent) / 100;
          const roundedFee = Math.ceil(creditCardFee);
          originalAmount += roundedFee;

          console.log(
            `[POST] Tour flat fee: $${tour_flat_fee}. Credit card fee (${feePercent}%): $${creditCardFee.toFixed(2)} → rounded to $${roundedFee}. Total: $${originalAmount}`,
          );
        }

        await sql`
          UPDATE appointments
          SET original_amount = ${originalAmount}
          WHERE id = ${appointment.id}
        `;
        appointment.original_amount = originalAmount;
        console.log(
          `[POST] Set original_amount for tour #${appointment.id}: $${originalAmount}`,
        );
      }
    }

    // ── Save driving distance (manual entry only) - Skip for tours ────────
    const userProvidedDistance =
      client_distance_miles !== undefined && client_distance_miles !== null;

    if (!is_tour && userProvidedDistance) {
      const finalMiles = Number(client_distance_miles);
      const distMethod = client_distance_method || null;
      await sql(
        `UPDATE appointments SET distance_miles = $1, distance_method = $2 WHERE id = $3`,
        [finalMiles, distMethod, appointment.id],
      );
      appointment.distance_miles = finalMiles;
      appointment.distance_method = distMethod;
      console.log(
        `[POST] Distance for trip #${appointment.id}: ${finalMiles} mi (method: ${distMethod || "manual"})`,
      );
    } else if (is_tour) {
      console.log(
        `[POST] Tour #${appointment.id} — distance not calculated (flat fee pricing)`,
      );
    } else {
      console.log(
        `[POST] No distance provided for trip #${appointment.id} — distance will remain null until manually entered`,
      );
    }

    // NOTE: Auto-pricing from mileage has been removed from the backend.
    // The frontend (DestinationSection.jsx) already calculates the price from
    // rate_per_mile × distance when the user enters miles. The backend was
    // overriding user-entered custom prices, so we now trust the frontend price.

    // ── Save services (skip for tours, they use flat fee) ─────────────
    if (!is_tour && services && services.length > 0) {
      for (const s of services) {
        await sql`
          INSERT INTO appointment_services (appointment_id, service_id, service_price, duration_minutes, quantity, stop_description)
          VALUES (${appointment.id}, ${s.service_id}, ${s.service_price}, ${s.duration_minutes}, ${s.quantity || 1}, ${s.stop_description || null})
        `;
      }

      // Calculate original amount from services and round up
      let baseAmount = services.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );
      let originalAmount = Math.ceil(baseAmount);

      // Add credit card processing fee if payment method is Credit Card, Square, or Square Invoice
      if (
        (payment_method === "Credit Card" ||
          payment_method === "Square" ||
          payment_method === "Square Invoice") &&
        baseAmount > 0
      ) {
        // Fetch credit card fee percentage from settings
        const feeSettingsRows = await sql`
          SELECT value FROM settings 
          WHERE tenant_id = 1 AND key = 'credit_card_fee_percent'
        `;
        const feePercent =
          feeSettingsRows.length > 0 ? Number(feeSettingsRows[0].value) : 4;

        // Calculate fee on base amount (before rounding)
        const creditCardFee = (baseAmount * feePercent) / 100;
        const roundedFee = Math.ceil(creditCardFee);
        originalAmount += roundedFee;

        console.log(
          `[POST] Base amount: $${baseAmount.toFixed(2)} → rounded to $${Math.ceil(
            baseAmount,
          )}. Credit card fee (${feePercent}%): $${creditCardFee.toFixed(
            2,
          )} → rounded to $${roundedFee}. Total: $${originalAmount}`,
        );

        await sql`
          UPDATE appointments
          SET original_amount = ${originalAmount},
              cc_fee_amount = ${roundedFee}
          WHERE id = ${appointment.id}
        `;
        appointment.cc_fee_amount = roundedFee;
      } else {
        console.log(
          `[POST] Set original_amount for trip #${appointment.id}: $${originalAmount}`,
        );

        await sql`
          UPDATE appointments
          SET original_amount = ${originalAmount},
              cc_fee_amount = 0
          WHERE id = ${appointment.id}
        `;
        appointment.cc_fee_amount = 0;
      }

      appointment.original_amount = originalAmount;
    }

    // ═══════════════════════════════════════════════════════════════════
    // CALCULATE AND CACHE ALL FINANCIAL FIELDS
    // ═══════════════════════════════════════════════════════════════════
    // This populates services_total, driver_commission, payments_total,
    // tips_total, and balance_due on the appointment record.
    // Must happen AFTER services are inserted and original_amount is set.
    try {
      await recalculateAllCachedFields(appointment.id);
      console.log(
        `[POST] Cached fields calculated for trip #${appointment.id}`,
      );
    } catch (cacheErr) {
      console.error(
        `[POST] Failed to cache fields for trip #${appointment.id}:`,
        cacheErr,
      );
      // Don't fail the whole appointment creation
    }

    // ── COMP payment method: auto-mark as fully paid, driver earns commission ──
    if ((payment_method || "").toLowerCase() === "comp") {
      try {
        const [servicesRow] = await sql`
          SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
          FROM appointment_services WHERE appointment_id = ${appointment.id}
        `;
        const servicesTotal = Number(
          servicesRow?.services_total ||
            appointment.services_total ||
            appointment.original_amount ||
            0,
        );

        if (servicesTotal > 0) {
          const tripRef = appointment.booking_number || `#${appointment.id}`;
          await sql`
            INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
            VALUES (1, ${appointment.id}, 'payment', 'Comp', ${servicesTotal}, 0, ${`Comp — Trip ${tripRef}`}, CURRENT_DATE, ${appointment.employee_id || null})
          `;
          console.log(
            `[POST] COMP — inserted payment transaction $${servicesTotal}`,
          );
        }

        // Recalculate cached balance/payments fields
        await recalculateAllCachedFields(appointment.id);

        // Mark the appointment as paid
        await sql`
          UPDATE appointments
          SET payment_status = 'paid', payment_date = CURRENT_TIMESTAMP, payment_amount = ${servicesTotal}
          WHERE id = ${appointment.id}
        `;
        appointment.payment_status = "paid";
        appointment.payment_date = new Date();
        appointment.payment_amount = servicesTotal;
        console.log(`[POST] COMP — trip auto-marked as paid`);
      } catch (compErr) {
        console.error(`[POST] COMP auto-payment error:`, compErr.message);
      }
    }

    // ── Create Conversation Thread ─────────────────────────────────────
    try {
      const conversationId = await createConversation(appointment.id, 1);
      console.log(
        `[Appointments] Created conversation ${conversationId} for appointment ${appointment.id}`,
      );

      // Add passenger to conversation if we have client info
      if (client_id) {
        const clientRows = await sql`
          SELECT id, name, phone FROM clients WHERE id = ${client_id}
        `;
        if (clientRows.length > 0) {
          const client = clientRows[0];
          if (client.phone) {
            await addPassengerToConversation(
              conversationId,
              client.id,
              client.phone,
              client.name,
            );
          }
        }
      }

      // Add driver to conversation if assigned
      if (employee_id) {
        const employeeRows = await sql`
          SELECT id, name, phone FROM employees WHERE id = ${employee_id}
        `;
        if (employeeRows.length > 0) {
          const employee = employeeRows[0];
          if (employee.phone) {
            await addDriverToConversation(
              conversationId,
              employee.id,
              employee.phone,
              employee.name,
            );
          }
        }
      }
    } catch (convErr) {
      console.error("[Appointments] Failed to create conversation:", convErr);
      // Don't fail the whole appointment creation
    }

    // ── Auto-generate payment link for ALL bookings ──────────────────────
    // IMPORTANT: This must happen BEFORE sendConfirmations so the payment link
    // is available when building confirmation emails/SMS
    let paymentGenerated = false;
    let finalPaymentMethod = payment_method; // Track the actual payment method used

    // Skip payment link generation for quotes and tentative trips — pricing is not finalized
    if (status === "quote" || is_tentative) {
      console.log(
        `[POST] Skipping payment link generation for ${is_tentative ? "TENTATIVE" : "QUOTE"} trip #${appointment.id} — pricing not finalized`,
      );
    } else {
      try {
        // Get settings
        const settingsRows =
          await sql`SELECT key, value FROM settings WHERE tenant_id = 1`;
        const paySettings = {};
        settingsRows.forEach((r) => {
          paySettings[r.key] = r.value;
        });

        // Fetch services data (needed for line items)
        const servicesData = await sql`
          SELECT aserv.service_price, aserv.quantity, s.name as service_name
          FROM appointment_services aserv
          LEFT JOIN services s ON aserv.service_id = s.id
          WHERE aserv.appointment_id = ${appointment.id}
        `;

        // Use original_amount if available (includes credit card fees), otherwise calculate from services
        let grandTotal;
        if (
          appointment.original_amount !== null &&
          appointment.original_amount !== undefined &&
          Number(appointment.original_amount) > 0
        ) {
          grandTotal = Number(appointment.original_amount);
          console.log(
            `[POST] Using original_amount for trip #${appointment.id}: $${grandTotal} (includes any credit card fees)`,
          );
        } else {
          grandTotal = servicesData.reduce(
            (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
            0,
          );
          console.log(
            `[POST] Calculated amount from services for trip #${appointment.id}: $${grandTotal}`,
          );
        }

        if (grandTotal > 0) {
          // Determine which provider to use based on payment_method
          const chosenMethod = payment_method || "Square";

          // Skip payment link generation for cash payments
          if (chosenMethod.toLowerCase() === "cash") {
            console.log(
              `[POST] Payment method is Cash — skipping payment link generation for trip #${appointment.id}`,
            );
            finalPaymentMethod = "Cash";
          }
          // Check if user selected "Square Invoice" or "Credit Card" specifically
          else if (
            chosenMethod === "Square Invoice" ||
            chosenMethod === "Credit Card"
          ) {
            const accessToken =
              paySettings.square_access_token ||
              process.env.SQUARE_ACCESS_TOKEN;
            const locationId =
              paySettings.square_location_id || process.env.SQUARE_LOCATION_ID;

            if (accessToken && locationId) {
              try {
                // Get client info for Square checkout link
                const clientRows = client_id
                  ? await sql(
                      `SELECT name, email, phone FROM clients WHERE id = $1`,
                      [client_id],
                    )
                  : [];
                const client = clientRows[0] || {};

                // Use Square Checkout Links (not invoices) so tipping UI is shown to passengers
                const {
                  url,
                  externalReferenceId,
                  metadata: squareMeta,
                } = await createSquarePaymentLink({
                  trip: appointment,
                  amount: grandTotal,
                  customerInfo: {
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                  },
                  disableTipping: false,
                });

                // Calculate CC fee to store in metadata for webhook processing
                const invoiceBaseAmount = servicesData.reduce(
                  (sum, s) =>
                    sum + Number(s.service_price) * Number(s.quantity || 1),
                  0,
                );
                const invoiceFeePercent = paySettings.credit_card_fee_percent
                  ? Number(paySettings.credit_card_fee_percent)
                  : 4;
                const invoiceCcFee =
                  invoiceBaseAmount > 0
                    ? Math.ceil((invoiceBaseAmount * invoiceFeePercent) / 100)
                    : 0;

                await sql(
                  `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, external_reference_id, metadata)
                   VALUES ($1, 'square', 'link_created', $2, 'USD', $3, $4, $5)`,
                  [
                    appointment.id,
                    grandTotal,
                    url,
                    externalReferenceId,
                    JSON.stringify({
                      type: "checkout",
                      checkout_id: externalReferenceId,
                      order_id: squareMeta.order_id,
                      auto_generated: true,
                      credit_card_fee: invoiceCcFee,
                    }),
                  ],
                );
                paymentGenerated = true;
                finalPaymentMethod = chosenMethod; // preserve "Square Invoice" or "Credit Card" as chosen
                console.log(
                  `Auto-generated Square checkout link (with tipping) for trip #${appointment.id}: ${url}`,
                );
              } catch (squareErr) {
                console.error(
                  "Square checkout link auto-generation failed:",
                  squareErr.message,
                );
              }
            } else {
              console.warn(
                "Square credentials not available — skipping checkout link auto-generation",
              );
            }
          }
          // Try Venmo if selected and configured
          else if (chosenMethod === "Venmo") {
            const venmoHandle = paySettings.venmo_handle;
            const venmoEnabled = paySettings.payment_venmo_enabled === "true";

            if (venmoEnabled && venmoHandle) {
              const cleanHandle = venmoHandle.replace(/^@/, "");
              const note = encodeURIComponent(
                `Trip #${appointment.booking_number} - Booking`,
              );
              const venmoWebUrl = `https://venmo.com/${cleanHandle}?txn=pay&amount=${grandTotal.toFixed(2)}&note=${note}`;
              const venmoAppUrl = `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${grandTotal.toFixed(2)}&note=${note}`;

              await sql(
                `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
                 VALUES ($1, 'venmo', 'link_created', $2, 'USD', $3, $4)`,
                [
                  appointment.id,
                  grandTotal,
                  venmoWebUrl,
                  JSON.stringify({
                    venmo_app_url: venmoAppUrl,
                    venmo_web_url: venmoWebUrl,
                    venmo_handle: cleanHandle,
                    auto_generated: true,
                  }),
                ],
              );
              paymentGenerated = true;
              finalPaymentMethod = "Venmo";
              console.log(
                `Auto-generated Venmo payment link for trip #${appointment.id}: ${venmoWebUrl}`,
              );
            } else {
              console.warn(
                "Venmo selected but not configured — skipping payment link generation",
              );
            }
          }

          // Try Zelle if selected
          else if (chosenMethod === "Zelle") {
            const zelleContact = paySettings.zelle_contact;
            const zelleEnabled = paySettings.payment_zelle_enabled === "true";

            if (zelleEnabled && zelleContact) {
              const zelleUrl = `${process.env.NEXT_PUBLIC_CREATE_APP_URL}/pay/zelle/${appointment.id}`;
              await sql(
                `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, metadata)
                 VALUES ($1, 'zelle', 'manual_pending', $2, 'USD', $3, $4)`,
                [
                  appointment.id,
                  grandTotal,
                  zelleUrl,
                  JSON.stringify({
                    zelle_contact: zelleContact,
                    auto_generated: true,
                  }),
                ],
              );
              paymentGenerated = true;
              finalPaymentMethod = "Zelle";
              console.log(
                `Auto-generated Zelle payment page for trip #${appointment.id}`,
              );
            } else {
              console.warn(
                "Zelle selected but not configured — skipping payment link generation",
              );
            }
          }

          // Default: use Square Payment Link (checkout) ONLY if Square is explicitly selected
          else if (
            chosenMethod === "Square" ||
            chosenMethod === "Square Invoice" ||
            chosenMethod === "Credit Card"
          ) {
            const accessToken =
              paySettings.square_access_token ||
              process.env.SQUARE_ACCESS_TOKEN;
            const locationId =
              paySettings.square_location_id || process.env.SQUARE_LOCATION_ID;

            if (accessToken && locationId) {
              try {
                // Get client info for Square
                const clientRows = client_id
                  ? await sql(
                      `SELECT name, email, phone FROM clients WHERE id = $1`,
                      [client_id],
                    )
                  : [];
                const client = clientRows[0] || {};

                const lineItems = servicesData.map((s) => ({
                  name: s.service_name || "Service",
                  quantity: Number(s.quantity || 1),
                  amount: Number(s.service_price || 0),
                }));

                const { url, externalReferenceId, metadata } =
                  await createSquarePaymentLink({
                    trip: appointment,
                    amount: grandTotal,
                    customerInfo: {
                      name: client.name,
                      email: client.email,
                      phone: client.phone,
                    },
                  });

                await sql(
                  `INSERT INTO payments (appointment_id, provider, status, amount, currency, payment_url, external_reference_id, metadata)
                   VALUES ($1, 'square', 'link_created', $2, 'USD', $3, $4, $5)`,
                  [
                    appointment.id,
                    grandTotal,
                    url,
                    externalReferenceId,
                    JSON.stringify({
                      ...metadata,
                      auto_generated: true,
                    }),
                  ],
                );
                paymentGenerated = true;
                finalPaymentMethod = "Square";
                console.log(
                  `Auto-generated Square payment link for trip #${appointment.id}: ${url}`,
                );
              } catch (squareErr) {
                console.error(
                  "Square auto-payment link failed:",
                  squareErr.message,
                );
              }
            } else {
              console.warn(
                "Square selected but credentials not available — skipping payment link",
              );
            }
          } else {
            console.warn(
              `Unknown payment method "${chosenMethod}" — skipping auto payment link`,
            );
          }

          // Update appointment payment status and method BEFORE sending notification
          if (paymentGenerated) {
            await sql`
              UPDATE appointments
              SET payment_status = 'link_created',
                  payment_amount = ${grandTotal},
                  payment_method = ${finalPaymentMethod}
              WHERE id = ${appointment.id}
            `;

            // Update the appointment object so notification has the latest data
            appointment.payment_status = "link_created";
            appointment.payment_amount = grandTotal;
            appointment.payment_method = finalPaymentMethod;

            console.log(
              `[POST] ✅ Payment link generated and saved BEFORE confirmations for trip #${appointment.id}`,
            );
            console.log(`  - payment_method: "${finalPaymentMethod}"`);
            console.log(`  - payment_status: "link_created"`);
            console.log(`  - payment_amount: $${grandTotal}`);
          }
        }
      } catch (paymentErr) {
        console.error("Failed to auto-generate payment link:", paymentErr);
        // Don't fail the whole appointment creation
      }
    }

    // Trigger confirmation ONLY if send_notification is true
    // New centralized confirmation system handles all passenger, driver, and office notifications
    // Payment link generation happens ABOVE this block, so confirmations will include the payment link
    if (send_notification !== false) {
      try {
        console.log(
          `[POST] Sending confirmations for trip #${appointment.id} with payment_method="${appointment.payment_method}"`,
        );
        await sendConfirmations({
          appointmentId: appointment.id,
          eventType: "booking_created",
          notifyPassenger: true,
          notifyDriver: !!employee_id, // Only notify driver if one is assigned
          notifyOffice: true,
        });
        console.log(
          `[POST /api/appointments] ✅ Confirmations sent successfully for appointment #${appointment.id}`,
        );
      } catch (confirmationError) {
        console.error(
          `[POST /api/appointments] ❌ FAILED to send confirmations for appointment #${appointment.id}:`,
          confirmationError.message,
        );
        console.error(
          "[POST /api/appointments] Confirmation error stack:",
          confirmationError.stack,
        );
        // Log the error but don't fail the whole appointment creation
        // Appointment was created successfully, confirmations can be resent manually
      }
    } else {
      console.log(
        `[POST /api/appointments] Confirmations SKIPPED for appointment #${appointment.id} (send_notification=false)`,
      );
    }

    // ── After-hours alert (passenger bookings only) ────────────────────
    if (booked_by === "Passenger") {
      try {
        const clientRows = client_id
          ? await sql`SELECT name, phone, email FROM clients WHERE id = ${client_id}`
          : [];
        const clientInfo = clientRows[0] || {};
        await sendAfterHoursAlert({
          name: clientInfo.name || "Unknown",
          email: clientInfo.email || null,
          phone: clientInfo.phone || null,
          type: "booking",
          appointmentId: appointment.id,
          clientId: client_id,
        });
      } catch (alertErr) {
        console.error(
          "[AfterHoursAlert] Booking alert failed:",
          alertErr.message,
        );
      }
    }

    // Fetch the payment link that was just created (if any)
    const paymentRows = await sql`
      SELECT id, provider, status, amount, payment_url, metadata
      FROM payments
      WHERE appointment_id = ${appointment.id}
      AND status IN ('pending', 'link_created', 'manual_pending')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const paymentInfo = paymentRows.length > 0 ? paymentRows[0] : null;

    // ── Check if passenger should lose "new passenger" status ──────────
    if (client_id) {
      try {
        // Get the passenger's creation date and new_passenger flag
        const passengerRows = await sql`
          SELECT new_passenger_marked_at, is_new_passenger
          FROM clients
          WHERE id = ${client_id}
        `;

        if (passengerRows.length > 0 && passengerRows[0].is_new_passenger) {
          const passengerCreatedAt = passengerRows[0].new_passenger_marked_at;
          const cutoffDate = new Date("2026-07-26T00:00:00Z");

          // Only process if passenger was created on or after the cutoff date
          if (
            passengerCreatedAt &&
            new Date(passengerCreatedAt) >= cutoffDate
          ) {
            // Count ALL trips (not just completed) for this passenger
            const tripCountRows = await sql`
              SELECT COUNT(*) as count
              FROM appointments
              WHERE client_id = ${client_id}
                AND status != 'deleted'
            `;

            const totalTrips = Number(tripCountRows[0]?.count || 0);

            // If 3 or more trips total, remove new passenger flag
            if (totalTrips >= 3) {
              await sql`
                UPDATE clients
                SET is_new_passenger = false
                WHERE id = ${client_id}
              `;
              console.log(
                `[POST] Passenger ${client_id} has ${totalTrips} total trips — removed new passenger flag`,
              );
            } else {
              console.log(
                `[POST] Passenger ${client_id} has ${totalTrips} trips — still a new passenger`,
              );
            }
          } else {
            console.log(
              `[POST] Passenger ${client_id} was created before 07/26/2026 — not eligible for new passenger status`,
            );
          }
        }
      } catch (newPassengerErr) {
        console.error(
          "[POST] Failed to check new passenger status:",
          newPassengerErr,
        );
        // Don't fail the whole request
      }
    }

    // ── Dispatcher SMS alert (Lisa & Shana) ──────────────────────────
    // Only send when admin explicitly chose to send notifications
    if (send_notification !== false) {
      try {
        const session = await auth();
        const bookingNum = appointment.booking_number || appointment.id;

        if (session?.user?.email === "carwlisak@gmail.com") {
          await sendSms({
            to: "+16189718717",
            message: `A Trip ${bookingNum} has just been booked by LK`,
            label: "DispatcherAlert",
          });
          console.log(
            `[Dispatcher Alert] SMS sent to Tami for new trip #${bookingNum} by LK`,
          );
        } else if (session?.user?.email === "shanap17@gmail.com") {
          await sendSms({
            to: "+16189718717",
            message: `Shana has added or edited trip number ${bookingNum}`,
            label: "DispatcherAlert",
          });
          console.log(
            `[Dispatcher Alert] SMS sent to Tami for new trip #${bookingNum} by Shana`,
          );
        }
      } catch (dispatcherAlertErr) {
        console.error(
          "[Dispatcher Alert] Failed to send SMS to Tami:",
          dispatcherAlertErr.message,
        );
      }
    }

    // ── Log the creation ────────────────────────────────────────────────
    await logChange({
      appointmentId: appointment?.id || null,
      bookingNumber: appointment?.booking_number || null,
      actionType: "created",
      changedBy: session?.user?.email || "unknown",
      passengerName: appointment?.client_name || null,
    });

    return Response.json({
      ...appointment,
      payment: paymentInfo, // Include payment link in response
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to create appointment" },
      { status: 500 },
    );
  }
}
