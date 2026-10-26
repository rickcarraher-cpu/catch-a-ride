export function detectChangedFields(updateKeys, oldAppt, fields) {
  const fieldToLabel = {
    client_id: "Passenger",
    employee_id: "Driver",
    vehicle_id: "Vehicle",
    start_time: "Date",
    notes: "Notes",
    driver_notes: "Driver Notes",
    is_tentative: "Status",
    tentative_reason: "Status",
    num_people: "# of People",
    num_bags_checked: "# of Bags",
    num_bags_carry_on: "# of Bags",
    outgoing_flight_info: "Outgoing Flight",
    returning_flight_info: "Return Information",
    return_date: "Return Date",
    destination: "Destination",
    pickup_address: "Pickup Location",
    dropoff_address: "Dropoff Location",
    payment_method: "Payment Method",
  };

  const changedFields = new Set();

  for (const key of updateKeys) {
    const oldVal = oldAppt?.[key];
    const newVal = fields[key];

    let oldNorm = oldVal ?? "";
    let newNorm = newVal ?? "";

    if (key === "start_time" || key === "return_date") {
      oldNorm = oldVal ? new Date(oldVal).getTime() : "";
      newNorm = newVal ? new Date(newVal).getTime() : "";
    }

    if (oldNorm === null) oldNorm = "";
    if (newNorm === null) newNorm = "";

    if (String(oldNorm) !== String(newNorm)) {
      if (fieldToLabel[key]) {
        changedFields.add(fieldToLabel[key]);
        if (key === "start_time") changedFields.add("Time");
      }
    }
  }

  return changedFields;
}

export function detectServiceChanges(id, oldServices, newServices) {
  const normalize = (arr) =>
    arr
      .map(
        (s) =>
          `${s.service_id}|${Number(s.service_price).toFixed(2)}|${s.quantity || 1}`,
      )
      .sort()
      .join(",");

  const oldSig = normalize(oldServices);
  const newSig = normalize(
    newServices.map((s) => ({
      service_id: s.service_id,
      service_price: s.service_price,
      quantity: s.quantity || 1,
    })),
  );

  console.log(`[PATCH ${id}] Old services signature: "${oldSig}"`);
  console.log(`[PATCH ${id}] New services signature: "${newSig}"`);

  return oldSig !== newSig;
}

export function shouldSendNotification(
  send_notification,
  changedFields,
  justCreated,
  statusChangedToCancelled,
  driverAssignedNotificationSent,
) {
  if (driverAssignedNotificationSent) {
    changedFields.delete("Driver");
    changedFields.delete("Vehicle"); // Vehicle typically changes with driver assignment
    console.log(
      `[shouldSendNotification] Removed "Driver"/"Vehicle" from changedFields — driver_assigned already sent. Remaining: [${[...changedFields].join(", ")}]`,
    );
  }

  const userExplicitlyChoseYes = send_notification === true;
  const autoDetectedChanges = changedFields.size > 0 && !justCreated;

  return (
    (userExplicitlyChoseYes || autoDetectedChanges) &&
    send_notification !== false &&
    !statusChangedToCancelled
  );
}
