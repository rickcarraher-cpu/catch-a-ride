import { getAppointmentWithDetails } from "./appointmentRetrieval";
import { assertTripMutable } from "@/app/api/utils/trip-change-policy";
import { autoCompleteIfEligible } from "@/app/api/utils/auto-complete";
import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { sendSms } from "@/app/api/utils/sms-sender";
import { recalculatePaymentsAndBalance } from "@/app/api/utils/cached-calculations";
import { recalculateDisplayFields } from "@/app/api/utils/cached-display-fields";
import {
  validateReturnTrip,
  clearReturnDateIfNeeded,
  buildUpdateFields,
  applyFieldUpdates,
  autoUpdateStatusBasedOnDriver,
} from "./fieldUpdates";
import {
  saveAppointmentServices,
  calculateOriginalAmount,
  updateOriginalAndPaymentAmount,
  recalculateCommissionForPaidTrip,
  recalculateAmountOnPaymentMethodChange,
} from "./servicesAndPricing";
import { autoGeneratePaymentLink } from "./paymentLinkGeneration";
import {
  autoDeleteSmsThreadOnComplete,
  updateConversationParticipants,
} from "./conversationManagement";
import { createMissingCommission } from "./commissionManagement";
import {
  detectChangedFields,
  detectServiceChanges,
  shouldSendNotification,
} from "./changeDetection";
import {
  sendDriverRemovedNotification,
  sendDriverAssignedNotification,
  sendBookingCancelledNotification,
  sendBookingChangedNotification,
} from "./notificationHandlers";
import { getAppointmentServices } from "./appointmentRetrieval";
import { logChange } from "@/app/api/utils/change-log";

export async function GET(request, { params }) {
  const { id } = params;
  try {
    const result = await getAppointmentWithDetails(id);

    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch appointment" },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    console.log(`PATCH /api/appointments/${id} - Received body:`, body);

    // Get logged-in user email for audit trail
    const session = await auth();
    const userEmail = session?.user?.email || "unknown";

    const send_notification = body.send_notification;
    let notificationResults = null;

    // Fetch existing trip
    const [existingTrip] = await sql`
      SELECT * FROM appointments WHERE id = ${id} AND tenant_id = 1
    `;

    if (!existingTrip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    const oldStatus = existingTrip.status;

    // Enforce 30-day change policy
    try {
      assertTripMutable(existingTrip);
    } catch (error) {
      if (error.code === "TRIP_NOT_MUTABLE") {
        return Response.json(
          { error: error.message, code: "TRIP_NOT_MUTABLE" },
          { status: 403 },
        );
      }
      throw error;
    }

    // Validate return trip
    const validationError = validateReturnTrip(body, existingTrip);
    if (validationError) {
      return Response.json(validationError, { status: 400 });
    }

    await clearReturnDateIfNeeded(id, body, existingTrip);

    // Snapshot old appointment
    const [oldAppt] = await sql`
      SELECT a.*, c.name AS client_name, e.name AS employee_name, v.name AS vehicle_name
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      WHERE a.id = ${id}
    `;
    const oldEmployeeId = oldAppt?.employee_id;
    const oldClientId = oldAppt?.client_id;

    // Build update fields
    const fields = buildUpdateFields(
      body,
      existingTrip,
      oldEmployeeId,
      oldClientId,
    );

    // Track who made this change
    fields.last_modified_by = userEmail;

    console.log("Fields to update:", fields);

    // ═══════════════════════════════════════════════════════════════════
    // GUARD: payment_status is a CACHED field — it must never be set
    // directly from the request body. It is derived from transactions by
    // recalculatePaymentsAndBalance(). Writing it here (e.g. from a manual
    // "mark as paid" action) creates the exact data inconsistency where a
    // trip shows Date Paid but has $0 in payments. The correct way to mark
    // a trip paid is to record a payment transaction, which triggers the
    // recalculation automatically.
    // ═══════════════════════════════════════════════════════════════════
    if (body.payment_status !== undefined) {
      console.warn(
        `[PATCH ${id}] Ignoring payment_status='${body.payment_status}' from request — payment_status is derived from payment transactions and cannot be set directly.`,
      );
    }

    // Apply updates
    const updateKeys = await applyFieldUpdates(id, fields, oldEmployeeId);

    console.log("Update keys:", updateKeys);

    // Handle distance
    const userProvidedDistance =
      body.distance_miles !== undefined && body.distance_miles !== null;
    let distanceRecalculated = false;
    let newDistanceMiles = null;

    const [fresh] = await sql`
      SELECT distance_miles FROM appointments WHERE id = ${id}
    `;
    newDistanceMiles = fresh?.distance_miles;

    if (userProvidedDistance) {
      newDistanceMiles = Number(body.distance_miles);
      console.log(
        `[PATCH ${id}] Using manually-provided distance: ${newDistanceMiles} mi`,
      );
    }

    // Auto-update status based on driver assignment
    await autoUpdateStatusBasedOnDriver(id, body.status, fields, oldAppt);

    // Read old services before updating
    let oldServices = [];
    if (body.services !== undefined) {
      oldServices = await sql`
        SELECT service_id, service_price, duration_minutes, quantity
        FROM appointment_services WHERE appointment_id = ${id}
        ORDER BY service_id
      `;
    }

    // Update services
    if (body.services !== undefined) {
      await saveAppointmentServices(id, body.services);

      const baseAmount = body.services.reduce(
        (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
        0,
      );

      const effectivePaymentMethod =
        fields.payment_method !== undefined
          ? fields.payment_method
          : existingTrip.payment_method;

      // calculateOriginalAmount now returns { originalAmount, ccFeeAmount }
      const { originalAmount, ccFeeAmount } = await calculateOriginalAmount(
        body.services,
        baseAmount,
        body.payment_method || existingTrip.payment_method,
      );
      await updateOriginalAndPaymentAmount(id, originalAmount, ccFeeAmount);

      await recalculateCommissionForPaidTrip(
        id,
        existingTrip,
        fields,
        baseAmount,
      );
    }

    // Recalculate amount if payment method changed
    if (body.services === undefined && fields.payment_method !== undefined) {
      await recalculateAmountOnPaymentMethodChange(id, existingTrip, fields);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RECALCULATE DISPLAY FIELDS
    // ═══════════════════════════════════════════════════════════════════════
    // If any field that affects display values changed (dates, addresses, payment method),
    // recalculate and save the display fields to the database
    const displayAffectingFields = [
      "start_time",
      "return_date",
      "tour_end_time",
      "payment_method",
      "pickup_address",
      "pickup_street",
      "pickup_city",
      "pickup_state",
      "pickup_zip",
      "dropoff_address",
      "dropoff_street",
      "dropoff_city",
      "dropoff_state",
      "dropoff_zip",
    ];

    const displayFieldsChanged = displayAffectingFields.some(
      (field) => updateKeys.includes(field) || fields[field] !== undefined,
    );

    if (displayFieldsChanged) {
      console.log(
        `[PATCH ${id}] Display-affecting fields changed — recalculating display fields...`,
      );
      try {
        await recalculateDisplayFields(id);
      } catch (displayErr) {
        console.error(
          `[PATCH ${id}] Failed to recalculate display fields:`,
          displayErr.message,
        );
        // Don't fail the whole update if display field calculation fails
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ALWAYS RECALCULATE CACHED FINANCIALS ON EVERY SAVE
    // ═══════════════════════════════════════════════════════════════════════
    // This repairs any data inconsistency (e.g. a Date Paid with no payments,
    // or a stale balance) every time the trip is saved — not just when services
    // or payment method changed. Cheap operation, guarantees consistency.
    try {
      await recalculatePaymentsAndBalance(id);
    } catch (recalcErr) {
      console.error(
        `[PATCH ${id}] Failed to recalculate payments/balance:`,
        recalcErr.message,
      );
      // Don't fail the whole update if recalculation fails
    }

    // Fetch updated appointment
    let [updated] = await sql`
      SELECT a.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email,
             e.name AS employee_name, e.color AS employee_color, e.profile_image_url as employee_profile_image,
             v.name AS vehicle_name,
             va.profile_image_url as vehicle_profile_image_url,
             va.profile_description as vehicle_profile_description
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN vehicle_assignments va ON va.vehicle_id = a.vehicle_id AND va.employee_id = a.employee_id
      WHERE a.id = ${id}
    `;

    const newStatus = updated.status;
    const statusChangedToCompleted =
      oldStatus !== "completed" && newStatus === "completed";
    const statusChangedToCancelled =
      oldStatus !== "cancelled" && newStatus === "cancelled";

    // Zero out balance when trip is cancelled
    if (statusChangedToCancelled) {
      await sql`
        UPDATE appointments
        SET balance_due = 0
        WHERE id = ${id}
      `;
      updated.balance_due = 0;
      console.log(`[PATCH ${id}] Trip cancelled — balance_due zeroed out`);
    }

    // Auto-delete SMS thread if completed
    await autoDeleteSmsThreadOnComplete(id, oldStatus, newStatus);

    // Update conversation participants
    const newEmployeeId = updated.employee_id;
    await updateConversationParticipants(id, oldEmployeeId, newEmployeeId);

    // Detect changed fields
    const changedFields = detectChangedFields(updateKeys, oldAppt, fields);

    // Detect service changes
    if (body.services !== undefined) {
      const servicesChanged = detectServiceChanges(
        id,
        oldServices,
        body.services,
      );
      if (servicesChanged) {
        changedFields.add("Pricing");
      }
    }

    // ── Log the change ──────────────────────────────────────────────────
    {
      const actionType = statusChangedToCancelled
        ? "cancelled"
        : statusChangedToCompleted
          ? "completed"
          : "updated";
      await logChange({
        appointmentId: Number(id),
        bookingNumber: updated?.booking_number || null,
        actionType,
        changedFields: [...changedFields],
        changedBy: userEmail,
        passengerName: updated?.client_name || null,
      });
    }

    // Determine notification triggers
    const driverChanged = oldEmployeeId !== newEmployeeId;
    const driverWasJustAssigned = !oldEmployeeId && newEmployeeId;
    const driverJustAssignedOrChanged = driverChanged && !!newEmployeeId;
    const driverBeingReplaced =
      oldEmployeeId && newEmployeeId && oldEmployeeId !== newEmployeeId;

    let driverAssignedNotificationSent = false;

    // Send driver_removed notification
    if (driverBeingReplaced) {
      await sendDriverRemovedNotification(
        id,
        oldEmployeeId,
        changedFields,
        send_notification,
      );
    }

    // Send driver_assigned notification
    if (driverJustAssignedOrChanged) {
      const result = await sendDriverAssignedNotification(
        id,
        newEmployeeId,
        updated,
        changedFields,
        send_notification,
      );
      if (result.sent) {
        notificationResults = result.results;
        driverAssignedNotificationSent = true;
      }
    } else if (driverChanged && !newEmployeeId) {
      console.log(
        `[PATCH ${id}] Driver was removed (unassigned) — no confirmation sent`,
      );
    }

    // Auto-generate payment link
    await autoGeneratePaymentLink(id, updated, existingTrip, fields);

    // ── COMP payment method: auto-mark as fully paid, driver earns commission ──
    if (
      (updated.payment_method || "").toLowerCase() === "comp" &&
      updated.payment_status !== "paid"
    ) {
      try {
        // Check if a Comp transaction already exists to avoid duplicates
        const existingCompTx = await sql`
          SELECT id FROM transactions
          WHERE appointment_id = ${id} AND method = 'Comp' AND category = 'payment'
          LIMIT 1
        `;

        if (existingCompTx.length === 0) {
          const [servicesRow] = await sql`
            SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
            FROM appointment_services WHERE appointment_id = ${id}
          `;
          const servicesTotal = Number(
            servicesRow?.services_total ||
              updated.services_total ||
              updated.original_amount ||
              0,
          );

          if (servicesTotal > 0) {
            const tripRef = updated.booking_number || `#${id}`;
            await sql`
              INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
              VALUES (1, ${id}, 'payment', 'Comp', ${servicesTotal}, 0, ${`Comp — Trip ${tripRef}`}, CURRENT_DATE, ${updated.employee_id || null})
            `;
            console.log(
              `[PATCH ${id}] COMP — inserted payment transaction $${servicesTotal}`,
            );
          }

          // Recalculate cached balance/payments fields
          await recalculatePaymentsAndBalance(id);

          // Mark the appointment as paid
          await sql`
            UPDATE appointments
            SET payment_status = 'paid', payment_date = CURRENT_TIMESTAMP, payment_amount = ${updated.services_total || updated.original_amount || 0}
            WHERE id = ${id}
          `;
          console.log(`[PATCH ${id}] COMP — trip auto-marked as paid`);
        }

        // Re-fetch updated so createMissingCommission sees paid status
        [updated] = await sql`
          SELECT a.*, c.name AS client_name, c.phone AS client_phone, c.email AS client_email,
                 e.name AS employee_name, e.color AS employee_color, e.profile_image_url as employee_profile_image,
                 v.name AS vehicle_name,
                 va.profile_image_url as vehicle_profile_image_url,
                 va.profile_description as vehicle_profile_description
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN employees e ON a.employee_id = e.id
          LEFT JOIN vehicles v ON a.vehicle_id = v.id
          LEFT JOIN vehicle_assignments va ON va.vehicle_id = a.vehicle_id AND va.employee_id = a.employee_id
          WHERE a.id = ${id}
        `;
      } catch (compErr) {
        console.error(
          `[PATCH ${id}] COMP auto-payment error:`,
          compErr.message,
        );
      }
    }

    // Create missing commission
    await createMissingCommission(id, updated, driverChanged);

    // Determine if we should send notifications
    const createdAt = existingTrip?.created_at
      ? new Date(existingTrip.created_at)
      : null;
    const ageMs = createdAt ? Date.now() - createdAt.getTime() : Infinity;
    const justCreated = ageMs < 10 * 1000;

    // Send booking_cancelled or booking_changed
    if (statusChangedToCancelled && send_notification !== false) {
      notificationResults = await sendBookingCancelledNotification(
        id,
        updated,
        changedFields,
        send_notification,
      );
    } else {
      const shouldNotify = shouldSendNotification(
        send_notification,
        changedFields,
        justCreated,
        statusChangedToCancelled,
        driverAssignedNotificationSent,
      );

      if (shouldNotify) {
        notificationResults = await sendBookingChangedNotification(
          id,
          updated,
          changedFields,
          send_notification,
          justCreated,
          driverAssignedNotificationSent,
        );
      } else if (send_notification === false) {
        console.log(
          `[PATCH ${id}] Skipping booking_changed — send_notification=false`,
        );
      } else if (justCreated && changedFields.size > 0) {
        console.log(
          `[PATCH ${id}] Skipping booking_changed — trip was just created (${Math.round(
            ageMs / 1000,
          )}s ago), booking_created already sent`,
        );
      } else {
        console.log(
          `[PATCH ${id}] Skipping booking_changed — no fields changed`,
        );
      }
    }

    // Auto-complete if payment status changed to paid
    const paymentStatusChanged =
      body.payment_status !== undefined &&
      body.payment_status === "paid" &&
      existingTrip.payment_status !== "paid";

    if (paymentStatusChanged) {
      console.log(
        `[PATCH ${id}] Payment status changed to paid - checking auto-complete eligibility`,
      );
      try {
        await autoCompleteIfEligible(id);
      } catch (autoCompleteErr) {
        console.error(
          `[PATCH ${id}] Auto-complete error:`,
          autoCompleteErr.message,
        );
      }
    }

    // ── Dispatcher SMS alert (Lisa & Shana) ──────────────────────────
    // Only send when admin explicitly chose to send notifications
    if (send_notification !== false) {
      try {
        const session = await auth();
        const bookingNum = updated.booking_number || id;

        if (session?.user?.email === "carwlisak@gmail.com") {
          await sendSms({
            to: "+16189718717",
            message: `A Trip ${bookingNum} has just been booked by LK`,
            label: "DispatcherAlert",
          });
          console.log(
            `[Dispatcher Alert] SMS sent to Tami for edited trip #${bookingNum} by LK`,
          );
        } else if (session?.user?.email === "shanap17@gmail.com") {
          await sendSms({
            to: "+16189718717",
            message: `Shana has added or edited trip number ${bookingNum}`,
            label: "DispatcherAlert",
          });
          console.log(
            `[Dispatcher Alert] SMS sent to Tami for edited trip #${bookingNum} by Shana`,
          );
        }
      } catch (dispatcherAlertErr) {
        console.error(
          "[Dispatcher Alert] Failed to send SMS to Tami:",
          dispatcherAlertErr.message,
        );
      }
    }

    // Fetch updated services
    const updatedServices = await getAppointmentServices(id);

    return Response.json({
      ...updated,
      distance_recalculated: distanceRecalculated,
      distance_miles: newDistanceMiles,
      appointment_services: updatedServices,
      notification_results: notificationResults,
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to update appointment" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    // Authorization check: verify user has permission to cancel trips
    const session = await auth();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return Response.json(
        { error: "Unauthorized - not logged in" },
        { status: 401 },
      );
    }

    // Check if user is admin or has can_cancel_trip permission
    const [employee] = await sql`
      SELECT is_admin, can_cancel_trip 
      FROM employees 
      WHERE email = ${userEmail} AND tenant_id = 1
    `;

    if (!employee) {
      return Response.json(
        { error: "Unauthorized - user not found" },
        { status: 403 },
      );
    }

    const canCancel = employee.is_admin || employee.can_cancel_trip;

    if (!canCancel) {
      return Response.json(
        {
          error:
            "You do not have permission to cancel trips. Please contact an administrator.",
        },
        { status: 403 },
      );
    }

    // Existing delete logic
    const [snap] = await sql`
      SELECT a.*,
        c.name AS client_name, c.phone AS client_phone, c.email AS client_email,
        e.name AS employee_name,
        v.name AS vehicle_name
      FROM appointments a
      LEFT JOIN clients   c ON a.client_id   = c.id
      LEFT JOIN employees e ON a.employee_id = e.id
      LEFT JOIN vehicles  v ON a.vehicle_id  = v.id
      WHERE a.id = ${id} AND a.tenant_id = 1
    `;

    const servicesSnap = snap
      ? await sql`
          SELECT aps.*, s.name AS service_name
          FROM appointment_services aps
          LEFT JOIN services s ON aps.service_id = s.id
          WHERE aps.appointment_id = ${id}
        `
      : [];

    // Soft delete — also clear payment status so deleted trips can never
    // resurface as "unpaid" in reports that trust payment_status
    await sql`
      UPDATE appointments 
      SET status = 'deleted', balance_due = 0, payment_status = 'cancelled'
      WHERE id = ${id} AND tenant_id = 1
    `;

    // Supersede any pending payment links so background jobs stop
    // polling them and restoring the balance on deleted trips
    await sql`
      UPDATE payments
      SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
      WHERE appointment_id = ${id}
        AND status IN ('pending', 'link_created', 'manual_pending')
    `;

    // ── Log the deletion ────────────────────────────────────────────────
    await logChange({
      appointmentId: Number(id),
      bookingNumber: snap?.booking_number || null,
      actionType: "deleted",
      changedBy: userEmail,
      passengerName: snap?.client_name || null,
    });

    console.log(
      `[Delete] Trip #${id} deleted by ${userEmail} - no notifications sent (disabled by user preference)`,
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error.message || "Failed to delete appointment" },
      { status: 500 },
    );
  }
}
