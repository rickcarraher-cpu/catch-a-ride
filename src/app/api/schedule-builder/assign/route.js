import sql from "@/app/api/utils/sql";
import { sendConfirmations } from "@/app/api/utils/confirmations/confirmationService";
import {
  findOrCreateConversationForAppointment,
  addDriverToConversation,
  removeDriverFromConversation,
} from "@/app/api/utils/conversations";
import { randomBytes } from "crypto";
import { snapshotDriverCommissionRate } from "@/app/api/appointments/[id]/fieldUpdates";
import { validateDriverAssignment } from "@/app/api/utils/validate-driver-assignment";

export async function POST(request) {
  try {
    const { assignments, skipNotifications = false } = await request.json();

    // assignments is an array of { appointmentId, employeeId, vehicleId }
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return Response.json(
        { error: "No assignments provided" },
        { status: 400 },
      );
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NEW: Two-phase flow
    // - If skipNotifications: true (legacy/frontend manual mode): DB first, return queue
    // - If skipNotifications: false (new safe mode): Send notification first, then update DB
    // ═══════════════════════════════════════════════════════════════════════

    if (skipNotifications) {
      // ─── LEGACY MODE: Update DB, return notification queue for frontend ───
      const updates = [];
      const notificationQueue = [];
      const failedAssignments = [];

      for (const { appointmentId, employeeId, vehicleId } of assignments) {
        if (!appointmentId) continue;

        const [existing] = await sql`
          SELECT id, employee_id, vehicle_id, status, start_time, duration_minutes FROM appointments WHERE id = ${appointmentId}
        `;
        if (!existing) continue;

        if (existing.status === "cancelled" || existing.status === "canceled") {
          console.log(
            `[schedule-builder/assign] ⏭️ Skipping cancelled trip #${appointmentId}`,
          );
          continue;
        }

        // ═══ VALIDATE ASSIGNMENT AGAINST BLOCKED/AVAILABLE HOURS ═══
        if (employeeId) {
          const tripStart = new Date(existing.start_time);
          const tripDuration = existing.duration_minutes || 75;
          const tripEnd = new Date(
            tripStart.getTime() + tripDuration * 60 * 1000,
          );

          const validation = await validateDriverAssignment(
            employeeId,
            tripStart,
            tripEnd,
          );
          if (!validation.valid) {
            console.log(
              `[schedule-builder/assign] ❌ Trip #${appointmentId} assignment blocked: ${validation.reason}`,
            );
            failedAssignments.push({
              appointmentId,
              employeeId,
              reason: validation.reason,
              conflictingBlocks: validation.conflictingBlocks,
            });
            continue; // Skip this assignment
          }
        }

        const oldEmployeeId = existing.employee_id;
        const newEmployeeId = employeeId || null;
        const newVehicleId = vehicleId || null;
        const driverChanged = oldEmployeeId !== newEmployeeId;
        const vehicleChanged = existing.vehicle_id !== newVehicleId;
        const driverWasJustAssigned = !oldEmployeeId && newEmployeeId;

        let tokenFields = {};
        if (driverChanged && newEmployeeId !== null) {
          tokenFields = {
            driver_confirmation_token: randomBytes(32).toString("hex"),
            driver_accepted: "pending",
            driver_response_at: null,
            driver_declined_reason: null,
          };
        } else if (driverChanged && newEmployeeId === null) {
          tokenFields = {
            driver_confirmation_token: null,
            driver_accepted: null,
            driver_response_at: null,
            driver_declined_reason: null,
          };
        }

        // ─── Legacy mode setClauses section ───
        const setClauses = [`employee_id = $1`, `vehicle_id = $2`];
        const values = [newEmployeeId, newVehicleId];
        let paramIdx = 3;

        // If driver changed, always clear any tentative flag — reassignment resolves the conflict
        if (driverChanged) {
          setClauses.push(`is_tentative = $${paramIdx}`);
          values.push(false);
          paramIdx++;
          setClauses.push(`tentative_reason = $${paramIdx}`);
          values.push(null);
          paramIdx++;
        }

        for (const [key, val] of Object.entries(tokenFields)) {
          setClauses.push(`${key} = $${paramIdx}`);
          values.push(val);
          paramIdx++;
        }

        const oldHadDriver = !!oldEmployeeId;
        const newHasDriver = !!newEmployeeId;
        if (!oldHadDriver && newHasDriver && existing.status === "pending") {
          setClauses.push(`status = $${paramIdx}`);
          values.push("confirmed");
          paramIdx++;
        } else if (
          oldHadDriver &&
          !newHasDriver &&
          existing.status === "confirmed"
        ) {
          setClauses.push(`status = $${paramIdx}`);
          values.push("pending");
          paramIdx++;
        }

        values.push(appointmentId);
        const result = await sql(
          `UPDATE appointments SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING id, employee_id, vehicle_id`,
          values,
        );

        if (result.length > 0) {
          updates.push(result[0]);
        }

        if (driverChanged && newEmployeeId) {
          await snapshotDriverCommissionRate(appointmentId, newEmployeeId);
        }

        if (driverChanged) {
          try {
            const conversationId = await findOrCreateConversationForAppointment(
              appointmentId,
              1,
            );
            if (oldEmployeeId) {
              await removeDriverFromConversation(conversationId, oldEmployeeId);
            }
            if (newEmployeeId) {
              const [newDriver] = await sql`
                SELECT id, name, phone FROM employees WHERE id = ${newEmployeeId}
              `;
              if (newDriver && newDriver.phone) {
                await addDriverToConversation(
                  conversationId,
                  newDriver.id,
                  newDriver.phone,
                  newDriver.name,
                );
              }
            }
          } catch (convErr) {
            console.error(
              `[schedule-builder/assign] Conversation update failed for appt #${appointmentId}:`,
              convErr,
            );
          }
        }

        if (driverWasJustAssigned && newEmployeeId) {
          try {
            const [apptStatus] = await sql`
              SELECT payment_status, payment_amount, booking_number
              FROM appointments WHERE id = ${appointmentId}
            `;

            if (apptStatus?.payment_status === "paid") {
              const existingCommission = await sql`
                SELECT id FROM transactions
                WHERE appointment_id = ${appointmentId}
                  AND category = 'expense'
                  AND method = 'Commission'
                LIMIT 1
              `;

              if (existingCommission.length === 0) {
                const [driverInfo] = await sql`
                  SELECT id, name, salary_rate FROM employees WHERE id = ${newEmployeeId}
                `;

                if (driverInfo?.salary_rate) {
                  const [servicesRow] = await sql`
                    SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
                    FROM appointment_services WHERE appointment_id = ${appointmentId}
                  `;
                  const servicesTotal = Number(
                    servicesRow?.services_total || 0,
                  );
                  const commissionBase =
                    servicesTotal > 0
                      ? servicesTotal
                      : Number(apptStatus.payment_amount || 0);
                  const commissionAmount = (
                    commissionBase * Number(driverInfo.salary_rate)
                  ).toFixed(2);
                  const tripRef =
                    apptStatus.booking_number || `#${appointmentId}`;
                  const expenseDesc = `Commission for ${driverInfo.name} (${Math.round(driverInfo.salary_rate * 100)}%) — Trip ${tripRef}`;

                  await sql`
                    INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
                    VALUES (1, ${appointmentId}, 'expense', 'Commission', ${commissionAmount}, 0, ${expenseDesc}, CURRENT_DATE, ${driverInfo.id})
                  `;
                  console.log(
                    `[schedule-builder/assign] ✓ Retroactive commission $${commissionAmount} for ${driverInfo.name} on paid trip #${appointmentId}`,
                  );
                }
              }
            }
          } catch (commErr) {
            console.error(
              `[schedule-builder/assign] Retroactive commission failed for appt #${appointmentId}:`,
              commErr.message,
            );
          }
        }

        if (driverChanged && newEmployeeId) {
          notificationQueue.push(appointmentId);
        }
      }

      return Response.json({
        success: true,
        updated: updates.length,
        assignments: updates,
        notificationsQueued: notificationQueue.length,
        notificationQueue,
        failedAssignments,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ─── NEW SAFE MODE: Notify first, THEN persist to DB ──────────────────
    // ═══════════════════════════════════════════════════════════════════════

    let notificationsSent = 0;
    let notificationsFailed = 0;
    const updates = [];
    const failedAssignments = [];

    for (const { appointmentId, employeeId, vehicleId } of assignments) {
      if (!appointmentId) continue;

      const [existing] = await sql`
        SELECT id, employee_id, vehicle_id, status, start_time, duration_minutes FROM appointments WHERE id = ${appointmentId}
      `;
      if (!existing) continue;

      if (existing.status === "cancelled" || existing.status === "canceled") {
        console.log(
          `[schedule-builder/assign] ⏭️ Skipping cancelled trip #${appointmentId}`,
        );
        continue;
      }

      // ═══ VALIDATE ASSIGNMENT AGAINST BLOCKED/AVAILABLE HOURS ═══
      if (employeeId) {
        const tripStart = new Date(existing.start_time);
        const tripDuration = existing.duration_minutes || 75;
        const tripEnd = new Date(
          tripStart.getTime() + tripDuration * 60 * 1000,
        );

        const validation = await validateDriverAssignment(
          employeeId,
          tripStart,
          tripEnd,
        );
        if (!validation.valid) {
          console.log(
            `[schedule-builder/assign] ❌ Trip #${appointmentId} assignment blocked: ${validation.reason}`,
          );
          failedAssignments.push({
            appointmentId,
            employeeId,
            vehicleId,
            reason: validation.reason,
            conflictingBlocks: validation.conflictingBlocks,
          });
          notificationsFailed++;
          continue; // Skip this assignment
        }
      }

      const oldEmployeeId = existing.employee_id;
      const newEmployeeId = employeeId || null;
      const driverChanged = oldEmployeeId !== newEmployeeId;

      // Skip if no driver change (only vehicle change doesn't require notification)
      if (!driverChanged || !newEmployeeId) {
        // Still update vehicle if needed
        if (existing.vehicle_id !== vehicleId) {
          await sql`
            UPDATE appointments SET vehicle_id = ${vehicleId || null}
            WHERE id = ${appointmentId}
          `;
          updates.push({
            id: appointmentId,
            employee_id: existing.employee_id,
            vehicle_id: vehicleId,
          });
        }
        continue;
      }

      // ── Step 1: Send notification FIRST ───────────────────────────────────
      console.log(
        `[schedule-builder/assign] 📬 Sending notification for trip #${appointmentId} BEFORE DB update...`,
      );

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
          `[schedule-builder/assign] ✅ Notification sent successfully for trip #${appointmentId}`,
        );
      } catch (notifErr) {
        notificationsFailed++;
        console.error(
          `[schedule-builder/assign] ❌ Notification FAILED for trip #${appointmentId}:`,
          notifErr,
        );
        failedAssignments.push({
          appointmentId,
          employeeId,
          vehicleId,
          error: notifErr.message,
        });
        // ⚠️ IMPORTANT: Do NOT update database if notification fails
        continue;
      }

      // ── Step 2: Only NOW update the database ──────────────────────────────
      console.log(
        `[schedule-builder/assign] 💾 Notification succeeded — updating DB for trip #${appointmentId}...`,
      );

      const newVehicleId = vehicleId || null;
      const driverWasJustAssigned = !oldEmployeeId && newEmployeeId;

      let tokenFields = {};
      if (newEmployeeId !== null) {
        tokenFields = {
          driver_confirmation_token: randomBytes(32).toString("hex"),
          driver_accepted: "pending",
          driver_response_at: null,
          driver_declined_reason: null,
        };
      }

      const setClauses = [`employee_id = $1`, `vehicle_id = $2`];
      const values = [newEmployeeId, newVehicleId];
      let paramIdx = 3;

      // Driver changed — clear any tentative flag (reassignment resolves the conflict)
      setClauses.push(`is_tentative = $${paramIdx}`);
      values.push(false);
      paramIdx++;
      setClauses.push(`tentative_reason = $${paramIdx}`);
      values.push(null);
      paramIdx++;

      for (const [key, val] of Object.entries(tokenFields)) {
        setClauses.push(`${key} = $${paramIdx}`);
        values.push(val);
        paramIdx++;
      }

      const oldHadDriver = !!oldEmployeeId;
      const newHasDriver = !!newEmployeeId;
      if (!oldHadDriver && newHasDriver && existing.status === "pending") {
        setClauses.push(`status = $${paramIdx}`);
        values.push("confirmed");
        paramIdx++;
      }

      values.push(appointmentId);
      const result = await sql(
        `UPDATE appointments SET ${setClauses.join(", ")} WHERE id = $${paramIdx} RETURNING id, employee_id, vehicle_id`,
        values,
      );

      if (result.length > 0) {
        updates.push(result[0]);
      }

      // Snapshot commission rate
      if (newEmployeeId) {
        await snapshotDriverCommissionRate(appointmentId, newEmployeeId);
      }

      // Update conversation participants
      try {
        const conversationId = await findOrCreateConversationForAppointment(
          appointmentId,
          1,
        );
        if (oldEmployeeId) {
          await removeDriverFromConversation(conversationId, oldEmployeeId);
        }
        if (newEmployeeId) {
          const [newDriver] = await sql`
            SELECT id, name, phone FROM employees WHERE id = ${newEmployeeId}
          `;
          if (newDriver && newDriver.phone) {
            await addDriverToConversation(
              conversationId,
              newDriver.id,
              newDriver.phone,
              newDriver.name,
            );
          }
        }
      } catch (convErr) {
        console.error(
          `[schedule-builder/assign] Conversation update failed for appt #${appointmentId}:`,
          convErr,
        );
      }

      // Retroactive commission for paid trips
      if (driverWasJustAssigned && newEmployeeId) {
        try {
          const [apptStatus] = await sql`
            SELECT payment_status, payment_amount, booking_number
            FROM appointments WHERE id = ${appointmentId}
          `;

          if (apptStatus?.payment_status === "paid") {
            const existingCommission = await sql`
              SELECT id FROM transactions
              WHERE appointment_id = ${appointmentId}
                AND category = 'expense'
                AND method = 'Commission'
              LIMIT 1
            `;

            if (existingCommission.length === 0) {
              const [driverInfo] = await sql`
                SELECT id, name, salary_rate FROM employees WHERE id = ${newEmployeeId}
              `;

              if (driverInfo?.salary_rate) {
                const [servicesRow] = await sql`
                  SELECT COALESCE(SUM(service_price * COALESCE(quantity, 1)), 0) as services_total
                  FROM appointment_services WHERE appointment_id = ${appointmentId}
                `;
                const servicesTotal = Number(servicesRow?.services_total || 0);
                const commissionBase =
                  servicesTotal > 0
                    ? servicesTotal
                    : Number(apptStatus.payment_amount || 0);
                const commissionAmount = (
                  commissionBase * Number(driverInfo.salary_rate)
                ).toFixed(2);
                const tripRef =
                  apptStatus.booking_number || `#${appointmentId}`;
                const expenseDesc = `Commission for ${driverInfo.name} (${Math.round(driverInfo.salary_rate * 100)}%) — Trip ${tripRef}`;

                await sql`
                  INSERT INTO transactions (tenant_id, appointment_id, category, method, amount, tip_amount, description, transaction_date, employee_id)
                  VALUES (1, ${appointmentId}, 'expense', 'Commission', ${commissionAmount}, 0, ${expenseDesc}, CURRENT_DATE, ${driverInfo.id})
                `;
                console.log(
                  `[schedule-builder/assign] ✓ Retroactive commission $${commissionAmount} for ${driverInfo.name} on paid trip #${appointmentId}`,
                );
              }
            }
          }
        } catch (commErr) {
          console.error(
            `[schedule-builder/assign] Retroactive commission failed for appt #${appointmentId}:`,
            commErr.message,
          );
        }
      }

      // 3s delay between each assignment to stay under SMS rate limits
      if (
        assignments.indexOf({ appointmentId, employeeId, vehicleId }) <
        assignments.length - 1
      ) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.log(
      `[schedule-builder/assign] ✅ Safe mode complete: ${notificationsSent} sent, ${notificationsFailed} failed, ${updates.length} DB updates`,
    );

    return Response.json({
      success: true,
      updated: updates.length,
      assignments: updates,
      notificationsQueued: 0,
      notificationsSent,
      notificationsFailed,
      failedAssignments,
    });
  } catch (error) {
    console.error("Error assigning drivers:", error);
    return Response.json(
      { error: "Failed to assign drivers" },
      { status: 500 },
    );
  }
}
