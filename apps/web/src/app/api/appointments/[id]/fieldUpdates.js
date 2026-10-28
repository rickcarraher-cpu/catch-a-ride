import sql from "@/app/api/utils/sql";
import { randomBytes } from "crypto";

export function toIntOrNull(v) {
  if (v === undefined) return undefined;
  if (v === "" || v === null) return null;
  return Number(v);
}

// Guarded version for FK/assignment fields (employee_id, client_id, vehicle_id, wedding_id).
// Treats empty string as "field wasn't touched by the user" → undefined (no DB update).
// Only an explicit null means "intentionally cleared".
// This prevents stale form data from overwriting concurrent assignments.
export function toIntOrNullGuarded(v) {
  if (v === undefined || v === "") return undefined;
  if (v === null) return null;
  return Number(v);
}

export function toStrOrNull(v) {
  if (v === undefined) return undefined;
  if (v === "") return null;
  return v;
}

export function toDateOrNull(v) {
  if (v === undefined) return undefined;
  if (v === "") return null;
  return v;
}

export function validateReturnTrip(body, existingTrip) {
  const notesValue = body.notes !== undefined ? body.notes : existingTrip.notes;
  const isReturnTrip =
    notesValue && notesValue.toLowerCase().includes("return trip");

  if (isReturnTrip && body.return_date !== undefined && body.return_date) {
    return {
      error:
        "A return trip cannot have its own return date. Please remove the return date or change the trip notes.",
    };
  }

  return null;
}

export async function clearReturnDateIfNeeded(id, body, existingTrip) {
  const notesValue = body.notes !== undefined ? body.notes : existingTrip.notes;
  const isReturnTrip =
    notesValue && notesValue.toLowerCase().includes("return trip");

  if (
    isReturnTrip &&
    existingTrip.return_date &&
    body.return_date === undefined
  ) {
    console.log(
      `[PATCH ${id}] Auto-clearing leftover return_date on return trip`,
    );
    await sql`UPDATE appointments SET return_date = NULL WHERE id = ${id}`;
  }
}

export function buildUpdateFields(
  body,
  existingTrip,
  oldEmployeeId,
  oldClientId,
) {
  const {
    client_id,
    employee_id,
    start_time,
    status,
    booked_by,
    booker_name,
    notes,
    is_tentative,
    tentative_reason,
    num_people,
    num_bags_checked,
    num_bags_carry_on,
    num_car_seats,
    num_golf_bags,
    outgoing_flight_info,
    returning_flight_info,
    return_date,
    driver_notes,
    vehicle_id,
    vehicle_category,
    destination,
    pickup_address,
    dropoff_address,
    payment_method,
    distance_miles: client_distance_miles,
    distance_method: client_distance_method,
    is_international_flight,
    customs_clearance_location,
    // Tour fields
    is_tour,
    tour_end_time,
    tour_participant_type,
    tour_flat_fee,
    tour_payment_split,
    gift_certificate,
    // Wedding field
    wedding_id,
    // Direct price override (used by time-based quote when no services exist)
    original_amount,
  } = body;

  const fields = {
    // Use toIntOrNullGuarded for FK assignment fields so that "" means "no change"
    // rather than "set to null". This prevents stale Edit Trip form data from
    // silently clearing a driver that was assigned via Schedule Builder concurrently.
    client_id: toIntOrNullGuarded(client_id),
    employee_id: toIntOrNullGuarded(employee_id),
    vehicle_id: toIntOrNullGuarded(vehicle_id),
    vehicle_category: toStrOrNull(vehicle_category),
    wedding_id: toIntOrNullGuarded(wedding_id),
    start_time: start_time !== undefined ? start_time : undefined,
    status: status !== undefined ? status : undefined,
    booked_by: booked_by !== undefined ? booked_by : undefined,
    booker_name: booker_name !== undefined ? booker_name : undefined,
    notes: notes !== undefined ? notes : undefined,
    is_tentative: is_tentative !== undefined ? is_tentative : undefined,
    tentative_reason:
      tentative_reason !== undefined ? tentative_reason : undefined,
    num_people: toIntOrNull(num_people),
    num_bags_checked: toIntOrNull(num_bags_checked),
    num_bags_carry_on: toIntOrNull(num_bags_carry_on),
    num_car_seats: toIntOrNull(num_car_seats),
    num_golf_bags: toIntOrNull(num_golf_bags),
    outgoing_flight_info: toStrOrNull(outgoing_flight_info),
    returning_flight_info: toStrOrNull(returning_flight_info),
    return_date: toDateOrNull(return_date),
    driver_notes: driver_notes !== undefined ? driver_notes : undefined,
    destination: destination !== undefined ? destination : undefined,
    pickup_address: pickup_address !== undefined ? pickup_address : undefined,
    dropoff_address:
      dropoff_address !== undefined ? dropoff_address : undefined,
    pickup_street: toStrOrNull(body.pickup_street),
    pickup_city: toStrOrNull(body.pickup_city),
    pickup_state: toStrOrNull(body.pickup_state),
    pickup_zip: toStrOrNull(body.pickup_zip),
    dropoff_street: toStrOrNull(body.dropoff_street),
    dropoff_city: toStrOrNull(body.dropoff_city),
    dropoff_state: toStrOrNull(body.dropoff_state),
    dropoff_zip: toStrOrNull(body.dropoff_zip),
    payment_method: toStrOrNull(payment_method),
    distance_miles:
      client_distance_miles !== undefined && client_distance_miles !== null
        ? Number(client_distance_miles)
        : undefined,
    distance_method:
      client_distance_method !== undefined
        ? toStrOrNull(client_distance_method)
        : undefined,
    is_international_flight:
      is_international_flight !== undefined
        ? is_international_flight
        : undefined,
    customs_clearance_location: toStrOrNull(customs_clearance_location),
    // Tour fields
    is_tour: is_tour !== undefined ? is_tour : undefined,
    tour_end_time: toDateOrNull(tour_end_time),
    tour_participant_type: toStrOrNull(tour_participant_type),
    tour_flat_fee:
      tour_flat_fee !== undefined
        ? tour_flat_fee !== null && tour_flat_fee !== ""
          ? Number(tour_flat_fee)
          : 0
        : undefined,
    tour_payment_split: toStrOrNull(tour_payment_split),
    gift_certificate:
      gift_certificate !== undefined
        ? toStrOrNull(gift_certificate)
        : undefined,
    // Direct price override — only applied when explicitly provided and no services block will override it
    original_amount:
      original_amount !== undefined && original_amount !== null
        ? Number(original_amount)
        : undefined,
  };

  // If cancelling, force balance_due to zero
  if (status === "cancelled") {
    fields.balance_due = 0;
  }

  // Generate new confirmation tokens if driver or passenger changed
  const driverChanged =
    fields.employee_id !== undefined && fields.employee_id !== oldEmployeeId;
  const passengerChanged =
    fields.client_id !== undefined && fields.client_id !== oldClientId;

  if (driverChanged && fields.employee_id !== null) {
    fields.driver_confirmation_token = randomBytes(32).toString("hex");
    fields.driver_accepted = "pending";
    fields.driver_response_at = null;
    fields.driver_declined_reason = null;
    // Clear tentative flag when driver is reassigned to a new driver.
    // Reassignment always resolves a prior scheduling conflict that caused tentative status.
    // This matches what schedule-builder/assign already does unconditionally.
    // Only skip if the caller is deliberately setting is_tentative = true at the same time.
    if (fields.is_tentative !== true) {
      fields.is_tentative = false;
      fields.tentative_reason = null;
    }
    console.log(`[PATCH] Driver changed - generated new confirmation token`);
  } else if (driverChanged && fields.employee_id === null) {
    fields.driver_confirmation_token = null;
    fields.driver_accepted = null;
    fields.driver_response_at = null;
    fields.driver_declined_reason = null;
  }

  if (passengerChanged && fields.client_id !== null) {
    fields.passenger_confirmation_token = randomBytes(32).toString("hex");
    fields.passenger_confirmed = "pending";
    fields.passenger_response_at = null;
    fields.passenger_cancelled_reason = null;
    console.log(`[PATCH] Passenger changed - generated new confirmation token`);
  } else if (passengerChanged && fields.client_id === null) {
    fields.passenger_confirmation_token = null;
    fields.passenger_confirmed = null;
    fields.passenger_response_at = null;
    fields.passenger_cancelled_reason = null;
  }

  return fields;
}

/**
 * When a driver is assigned or changed on a trip, snapshot their current
 * salary_rate into trip_commission_rate — but ONLY if no override is already set.
 * This locks the rate at assignment time so future rate changes don't bleed back.
 */
async function snapshotDriverCommissionRate(appointmentId, employeeId) {
  try {
    const [tripRow] = await sql`
      SELECT trip_commission_rate FROM appointments WHERE id = ${appointmentId}
    `;
    // Already has an explicit override — don't touch it
    if (
      tripRow?.trip_commission_rate !== null &&
      tripRow?.trip_commission_rate !== undefined
    ) {
      return;
    }
    const [driver] = await sql`
      SELECT salary_rate FROM employees WHERE id = ${employeeId}
    `;
    if (!driver?.salary_rate) return;
    await sql`
      UPDATE appointments
      SET trip_commission_rate = ${driver.salary_rate}
      WHERE id = ${appointmentId}
    `;
    console.log(
      `[snapshotDriverRate] Locked commission rate ${driver.salary_rate} on trip #${appointmentId} for driver ${employeeId}`,
    );
  } catch (err) {
    console.error(
      `[snapshotDriverRate] Failed for trip #${appointmentId}:`,
      err.message,
    );
  }
}

export { snapshotDriverCommissionRate };

export async function applyFieldUpdates(id, fields, oldEmployeeId = undefined) {
  const updateKeys = Object.keys(fields).filter((k) => fields[k] !== undefined);

  if (updateKeys.length > 0) {
    const setClause = updateKeys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = updateKeys.map((k) => fields[k]);
    await sql(
      `UPDATE appointments SET ${setClause} WHERE id = $${updateKeys.length + 1}`,
      [...values, id],
    );
  }

  // If driver was just assigned or changed, lock in their rate immediately
  const newEmployeeId = fields.employee_id;
  const driverChanged =
    newEmployeeId !== undefined &&
    newEmployeeId !== null &&
    newEmployeeId !== oldEmployeeId;
  if (driverChanged) {
    await snapshotDriverCommissionRate(id, newEmployeeId);
  }

  return updateKeys;
}

export async function autoUpdateStatusBasedOnDriver(
  id,
  status,
  fields,
  oldAppt,
) {
  const statusExplicitlySent = status !== undefined;
  const newEmployeeIdVal =
    fields.employee_id !== undefined
      ? fields.employee_id
      : oldAppt?.employee_id;

  if (!statusExplicitlySent && fields.employee_id !== undefined) {
    const oldHadDriver = !!oldAppt?.employee_id;
    const newHasDriver = !!newEmployeeIdVal;

    if (!oldHadDriver && newHasDriver) {
      // ✅ Only upgrade pending → confirmed (never cancelled → confirmed)
      await sql`UPDATE appointments SET status = 'confirmed' WHERE id = ${id} AND status = 'pending'`;
    } else if (oldHadDriver && !newHasDriver) {
      // ✅ Only downgrade confirmed → pending (never cancelled → pending)
      await sql`UPDATE appointments SET status = 'pending' WHERE id = ${id} AND status = 'confirmed'`;
    }
  }
}
