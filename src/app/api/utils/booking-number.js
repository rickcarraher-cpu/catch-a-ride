import sql from "@/app/api/utils/sql";

/**
 * Generate the next sequential booking number in format yy-nnnn.
 * Uses a retry loop to handle race conditions where two requests
 * read the same max booking_number at the same time.
 *
 * @param {number} offset - Optional offset to add (default 0)
 * @returns {Promise<string>} The next booking number (e.g., "26-0001")
 */
export async function generateNextBookingNumber(offset = 0) {
  const currentYear = new Date().getFullYear();
  const yearSuffix = String(currentYear).slice(-2);

  // Find the highest booking number for the current year
  const result = await sql`
    SELECT booking_number 
    FROM appointments 
    WHERE booking_number LIKE ${yearSuffix + "-%"}
    ORDER BY booking_number DESC 
    LIMIT 1
  `;

  let nextNumber = 1;

  if (result.length > 0 && result[0].booking_number) {
    const parts = result[0].booking_number.split("-");
    if (parts.length === 2) {
      const currentSequence = parseInt(parts[1], 10);
      nextNumber = currentSequence + 1;
    }
  }

  nextNumber += offset;

  const formattedNumber = String(nextNumber).padStart(4, "0");
  return `${yearSuffix}-${formattedNumber}`;
}

/**
 * Insert an appointment with automatic booking number retry.
 * If a duplicate booking_number collision occurs, it increments
 * and retries up to maxRetries times.
 *
 * For appointments with status="needs_review", no booking number is assigned (null).
 */
export async function insertAppointmentWithBookingNumber(
  values,
  maxRetries = 10,
) {
  // Do not assign booking number for needs_review status
  const shouldSkipBookingNumber = values.status === "needs_review";

  if (shouldSkipBookingNumber) {
    const [appointment] = await sql`
      INSERT INTO appointments (
        tenant_id, client_id, employee_id, start_time, status, booked_by, booker_name, booked_by_dispatcher, notes,
        is_tentative, tentative_reason, num_people, num_bags_checked, num_bags_carry_on,
        num_car_seats, num_golf_bags, special_items,
        outgoing_flight_info, returning_flight_info, return_date, driver_notes, vehicle_id, vehicle_category,
        destination, booking_number, payment_method, requested_driver_name, 
        pickup_address, dropoff_address,
        pickup_street, pickup_city, pickup_state, pickup_zip,
        dropoff_street, dropoff_city, dropoff_state, dropoff_zip,
        driver_confirmation_token, passenger_confirmation_token,
        is_international_flight, customs_clearance_location,
        driver_accepted, passenger_confirmed,
        is_tour, tour_end_time, tour_participant_type, tour_flat_fee, tour_payment_split,
        last_modified_by, needs_receipt, gift_certificate, wedding_id
      )
      VALUES (
        1, ${values.client_id}, ${values.employee_id}, ${values.start_time},
        ${values.status}, ${values.booked_by}, ${values.booker_name}, ${values.booked_by_dispatcher || null}, ${values.notes},
        ${values.is_tentative}, ${values.tentative_reason}, ${values.num_people},
        ${values.num_bags_checked}, ${values.num_bags_carry_on},
        ${values.num_car_seats || null}, ${values.num_golf_bags || null}, ${values.special_items || null},
        ${values.outgoing_flight_info},
        ${values.returning_flight_info}, ${values.return_date}, ${values.driver_notes},
        ${values.vehicle_id}, ${values.vehicle_category || null}, ${values.destination}, NULL, ${values.payment_method},
        ${values.requested_driver_name}, ${values.pickup_address}, ${values.dropoff_address},
        ${values.pickup_street}, ${values.pickup_city}, ${values.pickup_state}, ${values.pickup_zip},
        ${values.dropoff_street}, ${values.dropoff_city}, ${values.dropoff_state}, ${values.dropoff_zip},
        ${values.driver_confirmation_token || null}, ${values.passenger_confirmation_token || null},
        ${values.is_international_flight || false}, ${values.customs_clearance_location || null},
        ${values.driver_accepted || "pending"}, ${values.passenger_confirmed || "pending"},
        ${values.is_tour || false}, ${values.tour_end_time || null}, ${values.tour_participant_type || null},
        ${values.tour_flat_fee || 0}, ${values.tour_payment_split || null},
        ${values.last_modified_by || null}, ${values.needs_receipt || false}, ${values.gift_certificate || null}, ${values.wedding_id || null}
      )
      RETURNING *
    `;
    return appointment;
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const bookingNumber = await generateNextBookingNumber(attempt);

    try {
      const [appointment] = await sql`
        INSERT INTO appointments (
          tenant_id, client_id, employee_id, start_time, status, booked_by, booker_name, booked_by_dispatcher, notes,
          is_tentative, tentative_reason, num_people, num_bags_checked, num_bags_carry_on,
          num_car_seats, num_golf_bags, special_items,
          outgoing_flight_info, returning_flight_info, return_date, driver_notes, vehicle_id, vehicle_category,
          destination, booking_number, payment_method, requested_driver_name, 
          pickup_address, dropoff_address,
          pickup_street, pickup_city, pickup_state, pickup_zip,
          dropoff_street, dropoff_city, dropoff_state, dropoff_zip,
          driver_confirmation_token, passenger_confirmation_token,
          is_international_flight, customs_clearance_location,
          driver_accepted, passenger_confirmed,
          is_tour, tour_end_time, tour_participant_type, tour_flat_fee, tour_payment_split,
          last_modified_by, needs_receipt, gift_certificate, wedding_id
        )
        VALUES (
          1, ${values.client_id}, ${values.employee_id}, ${values.start_time},
          ${values.status}, ${values.booked_by}, ${values.booker_name}, ${values.booked_by_dispatcher || null}, ${values.notes},
          ${values.is_tentative}, ${values.tentative_reason}, ${values.num_people},
          ${values.num_bags_checked}, ${values.num_bags_carry_on},
          ${values.num_car_seats || null}, ${values.num_golf_bags || null}, ${values.special_items || null},
          ${values.outgoing_flight_info},
          ${values.returning_flight_info}, ${values.return_date}, ${values.driver_notes},
          ${values.vehicle_id}, ${values.vehicle_category || null}, ${values.destination}, ${bookingNumber}, ${values.payment_method},
          ${values.requested_driver_name}, ${values.pickup_address}, ${values.dropoff_address},
          ${values.pickup_street}, ${values.pickup_city}, ${values.pickup_state}, ${values.pickup_zip},
          ${values.dropoff_street}, ${values.dropoff_city}, ${values.dropoff_state}, ${values.dropoff_zip},
          ${values.driver_confirmation_token || null}, ${values.passenger_confirmation_token || null},
          ${values.is_international_flight || false}, ${values.customs_clearance_location || null},
          ${values.driver_accepted || "pending"}, ${values.passenger_confirmed || "pending"},
          ${values.is_tour || false}, ${values.tour_end_time || null}, ${values.tour_participant_type || null},
          ${values.tour_flat_fee || 0}, ${values.tour_payment_split || null},
          ${values.last_modified_by || null}, ${values.needs_receipt || false}, ${values.gift_certificate || null}, ${values.wedding_id || null}
        )
        RETURNING *
      `;
      return appointment;
    } catch (err) {
      const isDuplicate =
        err.message && err.message.includes("appointments_booking_number_key");
      if (!isDuplicate || attempt === maxRetries - 1) {
        throw err;
      }
      console.warn(
        `Booking number ${bookingNumber} already exists, retrying (attempt ${attempt + 1})...`,
      );
    }
  }
}
