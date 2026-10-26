import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";
import {
  findOrCreateConversationForAppointment,
  addDriverToConversation,
  removeDriverFromConversation,
} from "@/app/api/utils/conversations";

// Helper: wait for a given number of milliseconds
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Stagger interval between each confirmation send (ms)
// Each confirmation can send 2-3 SMS (passenger + driver) — spacing 3s apart
// keeps us well under the global 5 SMS/sec rate limit in sms-sender.js.
// IMPORTANT: We await all sends before returning so serverless doesn't kill the process.
const STAGGER_MS = 3000;

export async function POST(request) {
  try {
    const body = await request.json();
    const { assignments } = body; // Array of { appointment_id, employee_id, vehicle_id }

    if (!assignments || !Array.isArray(assignments)) {
      return Response.json(
        { error: "assignments array is required" },
        { status: 400 },
      );
    }

    const results = [];
    const errors = [];
    // Collect appointment IDs that need notifications so we can batch them
    const notificationQueue = [];

    for (const assignment of assignments) {
      const { appointment_id, employee_id, vehicle_id } = assignment;

      try {
        // Fetch old appointment data to detect driver changes
        const [oldAppt] = await sql`
          SELECT employee_id, status FROM appointments WHERE id = ${appointment_id}
        `;
        const oldEmployeeId = oldAppt?.employee_id;

        // ✅ SKIP cancelled trips — never assign a driver to a cancelled trip
        if (oldAppt?.status === "cancelled" || oldAppt?.status === "canceled") {
          console.log(
            `[BulkAssign] ⏭️ Skipping cancelled trip #${appointment_id}`,
          );
          results.push({
            appointment_id,
            success: true,
            skipped: true,
            reason: "cancelled",
            notification_queued: false,
          });
          continue;
        }

        // Update appointment with new driver and vehicle
        const newStatus = employee_id ? "confirmed" : null;

        if (newStatus) {
          await sql`
            UPDATE appointments
            SET employee_id = ${employee_id},
                vehicle_id = ${vehicle_id || null},
                status = 'confirmed'
            WHERE id = ${appointment_id}
          `;
        } else {
          await sql`
            UPDATE appointments
            SET employee_id = NULL,
                vehicle_id = ${vehicle_id || null}
            WHERE id = ${appointment_id}
          `;
        }

        console.log(
          `[BulkAssign] Updated appointment ${appointment_id}: driver=${employee_id}, vehicle=${vehicle_id}`,
        );

        // Handle conversation participant changes (non-blocking)
        if (oldEmployeeId !== employee_id) {
          try {
            const conversationId = await findOrCreateConversationForAppointment(
              appointment_id,
              1,
            );

            if (oldEmployeeId) {
              await removeDriverFromConversation(conversationId, oldEmployeeId);
            }

            if (employee_id) {
              const [newDriver] = await sql`
                SELECT id, name, phone FROM employees WHERE id = ${employee_id}
              `;
              if (newDriver) {
                if (newDriver.phone) {
                  await addDriverToConversation(
                    conversationId,
                    newDriver.id,
                    newDriver.phone,
                    newDriver.name,
                  );
                } else {
                  console.warn(
                    `[BulkAssign] Driver ${newDriver.name} (ID ${employee_id}) has no phone number - skipping conversation participant`,
                  );
                }
              } else {
                console.warn(
                  `[BulkAssign] Driver with ID ${employee_id} not found`,
                );
              }
            }
          } catch (convErr) {
            console.error(
              `[BulkAssign] Failed to update conversation for appointment ${appointment_id}:`,
              convErr,
            );
          }
        }

        // Queue notification instead of firing immediately
        const driverWasJustAssigned = !oldEmployeeId && employee_id;
        if (driverWasJustAssigned) {
          notificationQueue.push(appointment_id);
        }

        results.push({
          appointment_id,
          success: true,
          notification_queued: driverWasJustAssigned,
        });
      } catch (err) {
        console.error(
          `[BulkAssign] Failed to assign appointment ${appointment_id}:`,
          err,
        );
        console.error(`[BulkAssign] Error details:`, {
          message: err.message,
          stack: err.stack,
          appointment_id,
          employee_id,
          vehicle_id,
        });
        errors.push({
          appointment_id,
          error: err.message,
        });
      }
    }

    // --- Batched notification sending ---
    // Send confirmations one at a time with a delay between each to avoid
    // hitting external API rate limits (Resend, ClickSend, Quo).
    // AWAITED — old fire-and-forget pattern caused serverless to kill sends.
    let notificationsSent = 0;
    let notificationsFailed = 0;

    if (notificationQueue.length > 0) {
      console.log(
        `[BulkAssign] 📬 Sending ${notificationQueue.length} notification(s) with ${STAGGER_MS}ms delay between each...`,
      );

      for (let i = 0; i < notificationQueue.length; i++) {
        const appointmentId = notificationQueue[i];
        try {
          await sendConfirmations({
            appointmentId,
            eventType: "driver_assigned",
            notifyPassenger: true,
            notifyDriver: true,
            notifyOffice: true,
          });
          notificationsSent++;
          console.log(
            `[BulkAssign] ✅ Notification ${i + 1}/${notificationQueue.length} sent for appointment ${appointmentId}`,
          );
        } catch (err) {
          notificationsFailed++;
          console.error(
            `[BulkAssign] ❌ Notification ${i + 1}/${notificationQueue.length} failed for appointment ${appointmentId}:`,
            err,
          );
        }

        // Wait before sending the next one (skip delay after the last one)
        if (i < notificationQueue.length - 1) {
          await delay(STAGGER_MS);
        }
      }
      console.log(
        `[BulkAssign] 📬 All ${notificationQueue.length} notification(s) processed — ${notificationsSent} sent, ${notificationsFailed} failed.`,
      );
    }

    return Response.json({
      success: true,
      results,
      errors,
      total: assignments.length,
      successful: results.length,
      failed: errors.length,
      notificationsSent,
      notificationsFailed,
    });
  } catch (error) {
    console.error("[BulkAssign] Error:", error);
    return Response.json(
      { error: "Failed to process bulk assignments", detail: error.message },
      { status: 500 },
    );
  }
}
