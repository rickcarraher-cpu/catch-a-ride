export function canProceedToNextStep(
  step,
  formData,
  isAirport,
  isDispatch = false,
) {
  // Step 1: Name required; home address is optional
  if (step === 1) {
    if (!formData.name?.trim()) {
      return false;
    }
    return true;
  }

  // Step 4: Number of passengers required (at least 1)
  if (step === 4) {
    const numPeople = parseInt(formData.num_people, 10);
    if (!formData.num_people || isNaN(numPeople) || numPeople < 1) {
      return false;
    }
    return true;
  }

  // Step 5 (dispatch only): Vehicle category required
  if (step === 5 && isDispatch) {
    if (!formData.vehicle_category) {
      return false;
    }
    return true;
  }

  // All other steps: can always proceed
  return true;
}

export function getValidationErrors(
  step,
  formData,
  isAirport,
  isDispatch = false,
) {
  const errors = [];

  // Step 1: Name required only
  if (step === 1) {
    if (!formData.name?.trim()) {
      errors.push("Please select a trip or enter passenger information");
    }
  }

  // Step 4: Number of passengers required
  if (step === 4) {
    const numPeople = parseInt(formData.num_people, 10);
    if (!formData.num_people || isNaN(numPeople) || numPeople < 1) {
      errors.push("Please enter the number of passengers (at least 1)");
    }
  }

  // Step 5 (dispatch only): Vehicle category required
  if (step === 5 && isDispatch) {
    if (!formData.vehicle_category) {
      errors.push("Please select a vehicle type");
    }
  }

  return errors;
}

/**
 * Hard-required fields for final submission.
 * Only passenger name and date/time are required.
 */
export function getAllValidationErrors(
  formData,
  services = [],
  requireVehicleCategory = false,
) {
  const errors = [];

  // Passenger name is required
  if (!formData.name?.trim()) {
    errors.push("Passenger name is required");
  }

  // Date and time are required
  if (!formData.date) {
    errors.push("Date is required");
  }

  if (!formData.time) {
    errors.push("Time is required");
  }

  // Round trip: return date and time are required
  if (formData.is_round_trip || formData.trip_type === "round-trip") {
    if (!formData.return_date) {
      errors.push("Return date is required for round trips");
    }
    if (!formData.return_time) {
      errors.push("Return time is required for round trips");
    }
  }

  // Dispatch mode: vehicle category is required
  if (requireVehicleCategory && !formData.vehicle_category) {
    errors.push("Vehicle type is required");
  }

  return errors;
}

/**
 * Returns true when the user has filled in only the bare minimum
 * (name/phone + date) with no location, service, or trip details.
 * Used to show a friendly "Are you sure?" confirmation popup.
 */
export function isSparseSubmission(formData) {
  const hasLocation =
    formData.pickup?.trim() ||
    formData.pickup_street?.trim() ||
    formData.dropoff?.trim() ||
    formData.dropoff_street?.trim() ||
    formData.destination?.trim();
  const hasService = !!formData.service_id;
  const hasDetails =
    formData.num_people ||
    formData.outgoing_flight_info?.trim() ||
    formData.notes?.trim() ||
    formData.special_requests?.trim() ||
    formData.time;
  return !hasLocation && !hasService && !hasDetails;
}

/**
 * Kept for backward compatibility — returns an array of missing optional field labels.
 * BookingWizardMain imports this; use isSparseSubmission for the confirmation check.
 */
export function getMissingOptionalFields(formData, isAirportTrip = false) {
  const missing = [];

  // Only warn about truly optional fields that passengers might want to provide
  if (!formData.time) missing.push("Time");
  if (!formData.email?.trim()) missing.push("Email address");

  // For airport trips, suggest flight info
  if (isAirportTrip && !formData.outgoing_flight_info?.trim()) {
    missing.push("Flight information");
  }

  return missing;
}
