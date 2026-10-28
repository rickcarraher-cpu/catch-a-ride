import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";

export async function sendDriverRemovedNotification(
  id,
  oldEmployeeId,
  changedFields,
  send_notification,
) {
  if (send_notification === false) {
    return;
  }

  console.log(
    `[PATCH ${id}] DRIVER BEING REPLACED - Sending driver_removed notification to old driver (employee_id: ${oldEmployeeId})`,
  );

  try {
    const [oldDriverInfo] = await sql`
      SELECT id, name, email, phone
      FROM employees
      WHERE id = ${oldEmployeeId}
    `;

    if (oldDriverInfo) {
      await sendConfirmations({
        appointmentId: id,
        eventType: "driver_removed",
        notifyPassenger: false,
        notifyDriver: true,
        notifyOffice: false,
        changedFields: Array.from(changedFields),
        oldDriverId: oldDriverInfo.id,
        oldDriverName: oldDriverInfo.name,
        oldDriverEmail: oldDriverInfo.email,
        oldDriverPhone: oldDriverInfo.phone,
      });
      console.log(
        `[PATCH ${id}] ✅ driver_removed notification sent to ${oldDriverInfo.name}`,
      );
    } else {
      console.log(
        `[PATCH ${id}] ⚠️  Old driver info not found for employee_id: ${oldEmployeeId}`,
      );
    }
  } catch (err) {
    console.error(
      `[PATCH ${id}] ❌ driver_removed notification failed:`,
      err.message,
    );
  }
}

export async function sendDriverAssignedNotification(
  id,
  newEmployeeId,
  updated,
  changedFields,
  send_notification,
) {
  if (send_notification === false) {
    console.log(
      `[PATCH ${id}] Skipping driver_assigned confirmations — send_notification=false (admin chose No)`,
    );
    return { sent: false, results: null };
  }

  console.log(
    `[PATCH ${id}] ✅ DRIVER CHANGED - Sending driver_assigned confirmations to employee_id: ${newEmployeeId}`,
  );
  console.log(
    `[PATCH ${id}] New driver_confirmation_token was generated: ${!!updated.driver_confirmation_token}`,
  );

  try {
    const confirmResult = await sendConfirmations({
      appointmentId: id,
      eventType: "driver_assigned",
      notifyPassenger: true,
      notifyDriver: true,
      notifyOffice: true,
      changedFields: Array.from(changedFields),
    });
    console.log(
      `[PATCH ${id}] ✅ Driver confirmations completed:`,
      JSON.stringify(confirmResult.results),
    );
    return { sent: true, results: confirmResult.results };
  } catch (err) {
    console.error(`[PATCH ${id}] ❌ Driver confirmations failed:`, err.message);
    return { sent: true, results: { error: err.message } };
  }
}

export async function sendBookingCancelledNotification(
  id,
  updated,
  changedFields,
  send_notification,
) {
  if (send_notification === false) {
    return null;
  }

  console.log(
    `[PATCH ${id}] Status changed to cancelled — sending booking_cancelled confirmations`,
  );

  try {
    const confirmResult = await sendConfirmations({
      appointmentId: id,
      eventType: "booking_cancelled",
      notifyPassenger: true,
      notifyDriver: !!updated.employee_id,
      notifyOffice: true,
      changedFields: Array.from(changedFields),
    });
    console.log(
      `[PATCH ${id}] booking_cancelled results:`,
      JSON.stringify(confirmResult.results),
    );
    return confirmResult.results;
  } catch (err) {
    console.error(`[PATCH ${id}] booking_cancelled confirmations failed:`, err);
    return { error: err.message };
  }
}

export async function sendBookingChangedNotification(
  id,
  updated,
  changedFields,
  send_notification,
  justCreated,
  driverAssignedNotificationSent = false,
) {
  const userExplicitlyChoseYes = send_notification === true;

  console.log(
    `[PATCH ${id}] Sending booking_changed confirmations with fields:`,
    [...changedFields],
  );
  console.log(
    `[PATCH ${id}] Reason: ${userExplicitlyChoseYes ? "User clicked Yes - Notify" : "Auto-detected changes"}`,
  );

  // If driver_assigned was already sent in this same request, skip passenger and driver
  // notifications to prevent duplicate SMS. Office still gets notified.
  const skipPassengerAndDriver = driverAssignedNotificationSent;
  if (skipPassengerAndDriver) {
    console.log(
      `[PATCH ${id}] ⚠️ driver_assigned already sent — skipping passenger & driver for booking_changed to prevent duplicate SMS`,
    );
  }

  try {
    const confirmResult = await sendConfirmations({
      appointmentId: id,
      eventType: "booking_changed",
      notifyPassenger: !skipPassengerAndDriver,
      notifyDriver: !!updated.employee_id && !skipPassengerAndDriver,
      notifyOffice: true,
      changedFields: Array.from(changedFields),
    });
    console.log(
      `[PATCH ${id}] booking_changed results:`,
      JSON.stringify(confirmResult.results),
    );
    return confirmResult.results;
  } catch (err) {
    console.error(`[PATCH ${id}] Confirmations failed:`, err);
    return { error: err.message };
  }
}
