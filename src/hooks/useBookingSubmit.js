import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { normalizePhone } from "@/utils/phoneNormalizer";
import { buildAddress } from "@/utils/addressParser";

// Build a timestamp with the correct America/Chicago UTC offset (-05:00 CDT or -06:00 CST)
// Without this, bare strings like "2026-06-19T08:00:00" get treated as UTC by PostgreSQL,
// causing times to display 5 hours early (8 AM entered → 3 AM stored).
function buildChicagoTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return `${dateStr}T${timeStr}:00`;

  // Try Intl.DateTimeFormat with longOffset (Chrome 99+, Firefox 102+, Safari 15.4+)
  try {
    const probe = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(probe);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    // longOffset gives "GMT-05:00" or "GMT-06:00"
    if (
      tzName.startsWith("GMT") &&
      (tzName.includes("+") || tzName.includes("-"))
    ) {
      const offset = tzName.slice(3); // "-05:00" or "-06:00"
      return `${dateStr}T${timeStr}:00${offset}`;
    }
  } catch (_) {}

  // Fallback: DST is active (CDT, -05:00) roughly March through November
  // CST (-06:00) is November through March
  const month = parseInt(dateStr.slice(5, 7), 10);
  const offset = month >= 3 && month <= 11 ? "-05:00" : "-06:00";
  return `${dateStr}T${timeStr}:00${offset}`;
}

export function useBookingSubmit(
  services,
  addons,
  setValidationErrors,
  setBookingResult,
  setStep,
  bookedBy = "Online",
) {
  const mutation = useMutation({
    mutationFn: async (data) => {
      // Validate required fields before submission
      const errors = [];

      // Passenger name is required
      if (!data.name?.trim()) {
        errors.push("Passenger name is required");
      }

      // Date and time are required
      if (!data.date) {
        errors.push("Date is required");
      }

      if (!data.time) {
        errors.push("Time is required");
      }

      // If round trip is selected, return date and time are required
      if (data.is_round_trip) {
        if (!data.return_date) {
          errors.push("Return date is required for round trips");
        }
        if (!data.return_time) {
          errors.push("Return time is required for round trips");
        }
      }

      if (errors.length > 0) {
        setValidationErrors(errors);
        // Don't show generic toast - let the parent component show the detailed popup
        return Promise.reject(new Error("Validation failed"));
      }

      setValidationErrors([]);

      // Build pickup_address from structured fields if available, otherwise use pickup field
      let pickupAddress = data.pickup || null;
      if (
        data.pickup_street ||
        data.pickup_city ||
        data.pickup_state ||
        data.pickup_zip
      ) {
        pickupAddress = buildAddress({
          street_address: data.pickup_street,
          city: data.pickup_city,
          state: data.pickup_state,
          zip_code: data.pickup_zip,
        });
      }

      // Build dropoff_address from structured fields if available, otherwise use dropoff field
      let dropoffAddress = data.dropoff || null;
      if (
        data.dropoff_street ||
        data.dropoff_city ||
        data.dropoff_state ||
        data.dropoff_zip
      ) {
        dropoffAddress = buildAddress({
          street_address: data.dropoff_street,
          city: data.dropoff_city,
          state: data.dropoff_state,
          zip_code: data.dropoff_zip,
        });
      }

      // 1. Resolve the passenger record and save any edited info back to it.
      // Prefer client_id captured during lookup (handles name changes), then
      // fall back to matching by phone AND name (exact match only).
      let clientId = data.client_id || null;

      if (!clientId) {
        const listRes = await fetch("/api/clients");
        if (listRes.ok) {
          const allClients = await listRes.json();

          // Check for matching phone AND name (for reusing existing passenger)
          const existingExactMatch = allClients.find(
            (c) =>
              c.phone &&
              data.phone &&
              normalizePhone(c.phone) === normalizePhone(data.phone) &&
              c.name.toLowerCase().trim() === data.name.toLowerCase().trim(),
          );
          if (existingExactMatch) {
            clientId = existingExactMatch.id;
          }
        }
      }

      // Build home address from structured fields
      let homeAddress = null;
      if (data.home_street && data.home_city) {
        homeAddress = buildAddress({
          street_address: data.home_street,
          city: data.home_city,
          state: data.home_state,
          zip_code: data.home_zip,
        });
      }

      // Builds the payload of edited passenger info to persist on an existing record
      const buildClientUpdate = () => {
        const update = {
          name: data.name?.trim() || undefined,
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
          notification_preference: data.notification_preference,
          cc_emails: data.cc_emails?.trim() || null,
          referral_source: data.referral_source?.trim() || null,
        };
        // Address: use the pickup address as home if checkbox is checked,
        // otherwise save the home address fields as entered
        if (data.save_address_as_home && pickupAddress) {
          update.address = pickupAddress;
          update.street_address = data.pickup_street || null;
          update.city = data.pickup_city || null;
          update.state = data.pickup_state || null;
          update.zip_code = data.pickup_zip || null;
        } else if (data.home_street && data.home_city) {
          update.address = homeAddress;
          update.street_address = data.home_street;
          update.city = data.home_city;
          update.state = data.home_state || null;
          update.zip_code = data.home_zip || null;
        }
        // Drop undefined fields so we only send what we have
        Object.keys(update).forEach(
          (k) => update[k] === undefined && delete update[k],
        );
        return update;
      };

      if (clientId) {
        // Save the passenger's edited info to their existing record so it
        // shows up everywhere (passengers page, future bookings, emails)
        const updateRes = await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildClientUpdate()),
        });
        if (!updateRes.ok) {
          // Record may no longer exist — fall back to creating a new passenger
          console.error("Failed to update passenger record:", updateRes.status);
          clientId = null;
        }
      }

      if (!clientId) {
        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email || null,
            phone: data.phone && data.phone.trim() ? data.phone : null,
            notes: data.passenger_notes || "Created via online booking",
            notification_preference: data.notification_preference,
            street_address: data.home_street || null,
            city: data.home_city || null,
            state: data.home_state || null,
            zip_code: data.home_zip || null,
            address: homeAddress,
            cc_emails: data.cc_emails || null,
            referral_source: data.referral_source || null, // ADD: Include referral source when creating new passenger
          }),
        });

        if (!clientRes.ok) {
          if (clientRes.status === 409) {
            // Duplicate passenger found — reuse their existing record instead of failing
            const dupData = await clientRes.json().catch(() => ({}));
            if (dupData.existing_id) {
              clientId = dupData.existing_id;
              // Save any edited info to the reused record (best effort)
              await fetch(`/api/clients/${clientId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildClientUpdate()),
              }).catch(() => {});
            } else {
              throw new Error(
                "Booking Failed. Failed to create passenger record",
              );
            }
          } else {
            throw new Error(
              "Booking Failed. Failed to create passenger record",
            );
          }
        } else {
          const client = await clientRes.json();
          clientId = client.id;
        }
      } else if (data.save_address_as_home && pickupAddress) {
        // Update existing client's address if checkbox is checked
        await fetch(`/api/clients/${clientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: pickupAddress,
            street_address: data.pickup_street || null,
            city: data.pickup_city || null,
            state: data.pickup_state || null,
            zip_code: data.pickup_zip || null,
          }),
        });
      }

      // 2. Build notes including pickup/dropoff
      const notesParts = [];
      if (pickupAddress) notesParts.push(`Pickup: ${pickupAddress}`);
      if (dropoffAddress) notesParts.push(`Dropoff: ${dropoffAddress}`);
      if (data.notes) notesParts.push(data.notes);
      if (data.special_requests)
        notesParts.push(`Special Requests: ${data.special_requests}`);
      // Add stop descriptions if any stop addons were described
      if (data.stop_descriptions && addons) {
        Object.entries(data.stop_descriptions).forEach(([addonId, desc]) => {
          if (desc && desc.trim()) {
            const addon = addons.find((a) => a.id == addonId);
            const label = addon?.name || "Additional Stop";
            notesParts.push(`${label}: ${desc.trim()}`);
          }
        });
      }
      if (data.requested_driver_name)
        notesParts.push(
          `Driver Requested: ${data.requested_driver_name} - Not Confirmed.`,
        );
      const combinedNotes = notesParts.join("\n") || null;

      // 3. Build start_time with America/Chicago offset so PostgreSQL stores the correct local time
      const startTime = buildChicagoTimestamp(data.date, data.time);

      // 4. Build services array
      const selectedService = services?.find((s) => s.id == data.service_id);
      // Fallback: if no service was selected (auto-detection missed), use "Custom" or first service
      const effectiveService =
        selectedService ||
        services?.find((s) => s.name.toLowerCase().includes("custom")) ||
        (services && services.length > 0 ? services[0] : null);
      const servicePrice =
        data.service_price !== "" &&
        data.service_price !== undefined &&
        data.service_price !== null
          ? Number(data.service_price)
          : (effectiveService?.default_price ?? 0);

      const tripServices = effectiveService
        ? [
            {
              service_id: effectiveService.id,
              service_price: servicePrice,
              duration_minutes: effectiveService.duration_minutes,
              quantity: 1,
            },
          ]
        : [];

      // Add selected add-ons to services array
      if (data.selected_addons && addons) {
        Object.entries(data.selected_addons).forEach(([addonId, quantity]) => {
          if (quantity > 0) {
            const addon = addons.find((a) => a.id == addonId);
            if (addon) {
              // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
              // Only apply tip-percentage calculation for non-gas tip addons.
              const isGasFeeAddon = (addon.name || "")
                .toLowerCase()
                .includes("gas");
              let addonPrice = Number(addon.default_price || 0);
              if (addon.is_tip_addon && !isGasFeeAddon && servicePrice > 0) {
                const tipPercent = addonPrice;
                if (tipPercent > 0) {
                  addonPrice = Math.ceil((servicePrice * tipPercent) / 100);
                }
              }

              tripServices.push({
                service_id: addon.id,
                service_price: addonPrice,
                duration_minutes: addon.duration_minutes || 0,
                quantity: quantity,
              });
            }
          }
        });
      }

      // 5. Create the first appointment (or only appointment if not round trip)
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          start_time: buildChicagoTimestamp(data.date, data.time),
          status: bookedBy === "Online" ? "needs_review" : "approved",
          booked_by: bookedBy,
          notes: combinedNotes,
          services: tripServices,
          num_people: data.num_people ? Number(data.num_people) : null,
          num_bags_checked: data.num_bags_checked
            ? Number(data.num_bags_checked)
            : null,
          num_bags_carry_on: data.num_bags_carry_on
            ? Number(data.num_bags_carry_on)
            : null,
          num_car_seats: data.num_car_seats ? Number(data.num_car_seats) : null,
          num_golf_bags: data.num_golf_bags ? Number(data.num_golf_bags) : null,
          special_items: data.special_items?.trim() || null,
          outgoing_flight_info: data.outgoing_flight_info || null,
          returning_flight_info: data.returning_flight_info || null,
          // FIX: Only set return_date if this is NOT a roundtrip
          // For roundtrips, we create two separate trips, so return_date should be null
          // For one-way trips with a return flight stored for reference, keep the return_date
          return_date: data.is_round_trip
            ? null
            : data.return_date && data.return_time
              ? buildChicagoTimestamp(data.return_date, data.return_time)
              : null,
          destination: data.destination || null,
          payment_method: data.payment_method || null,
          requested_driver_name: data.requested_driver_name || null,
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          pickup_street: data.pickup_street || null,
          pickup_city: data.pickup_city || null,
          pickup_state: data.pickup_state || null,
          pickup_zip: data.pickup_zip || null,
          dropoff_street: data.dropoff_street || null,
          dropoff_city: data.dropoff_city || null,
          dropoff_state: data.dropoff_state || null,
          dropoff_zip: data.dropoff_zip || null,
          is_international_flight: data.is_international_flight || false,
          customs_clearance_location: data.customs_clearance_location || null,
          needs_receipt: data.needs_receipt === true,
          wedding_id: data.wedding_id ? Number(data.wedding_id) : null,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to create booking");
      }
      const result = await res.json();

      // 5b. If round trip, create the return trip appointment
      if (data.is_round_trip && data.return_date && data.return_time) {
        // Swap pickup/dropoff for return trip - swap BOTH flat strings AND structured fields
        // Return trip pickup = original dropoff
        const returnPickupAddress = dropoffAddress || null;
        const returnPickupStreet = data.dropoff_street || null;
        const returnPickupCity = data.dropoff_city || null;
        const returnPickupState = data.dropoff_state || null;
        const returnPickupZip = data.dropoff_zip || null;

        // Return trip dropoff = original pickup
        const returnDropoffAddress = pickupAddress || null;
        const returnDropoffStreet = data.pickup_street || null;
        const returnDropoffCity = data.pickup_city || null;
        const returnDropoffState = data.pickup_state || null;
        const returnDropoffZip = data.pickup_zip || null;

        const returnNotesParts = [];
        if (returnPickupAddress)
          returnNotesParts.push(`Pickup: ${returnPickupAddress}`);
        if (returnDropoffAddress)
          returnNotesParts.push(`Dropoff: ${returnDropoffAddress}`);
        if (data.notes) returnNotesParts.push(data.notes);
        // Add stop descriptions if any stop addons were described
        if (data.stop_descriptions && addons) {
          Object.entries(data.stop_descriptions).forEach(([addonId, desc]) => {
            if (desc && desc.trim()) {
              const addon = addons.find((a) => a.id == addonId);
              const label = addon?.name || "Additional Stop";
              returnNotesParts.push(`${label}: ${desc.trim()}`);
            }
          });
        }
        if (data.requested_driver_name)
          returnNotesParts.push(
            `Driver Requested: ${data.requested_driver_name} - Not Confirmed.`,
          );
        returnNotesParts.push(
          `Return trip for booking #${result.booking_number}`,
        );
        const returnNotes = returnNotesParts.join("\n");

        const returnStartTime = buildChicagoTimestamp(
          data.return_date,
          data.return_time,
        );

        const returnAppRes = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            start_time: returnStartTime,
            status: bookedBy === "Online" ? "needs_review" : "pending",
            booked_by: bookedBy,
            notes: returnNotes,
            services: tripServices,
            num_people: data.num_people ? Number(data.num_people) : null,
            num_bags_checked: data.num_bags_checked
              ? Number(data.num_bags_checked)
              : null,
            num_bags_carry_on: data.num_bags_carry_on
              ? Number(data.num_bags_carry_on)
              : null,
            num_car_seats: data.num_car_seats
              ? Number(data.num_car_seats)
              : null,
            num_golf_bags: data.num_golf_bags
              ? Number(data.num_golf_bags)
              : null,
            special_items: data.special_items?.trim() || null,
            // FIX: Return trip is an ARRIVAL trip (passenger coming home from airport)
            // so the flight info belongs in returning_flight_info, NOT outgoing_flight_info
            outgoing_flight_info: null,
            returning_flight_info: data.returning_flight_info || null,
            return_date: null,
            destination: data.destination || null,
            payment_method: data.payment_method || null,
            requested_driver_name: data.requested_driver_name || null,
            // Carry over distance from outbound trip (same route reversed)
            distance_miles:
              result.distance_miles || data.distance_miles || null,
            // Swapped addresses - flat strings
            pickup_address: returnPickupAddress,
            dropoff_address: returnDropoffAddress,
            // Swapped addresses - structured fields
            pickup_street: returnPickupStreet,
            pickup_city: returnPickupCity,
            pickup_state: returnPickupState,
            pickup_zip: returnPickupZip,
            dropoff_street: returnDropoffStreet,
            dropoff_city: returnDropoffCity,
            dropoff_state: returnDropoffState,
            dropoff_zip: returnDropoffZip,
            is_international_flight: data.is_international_flight || false,
            customs_clearance_location: data.customs_clearance_location || null,
          }),
        });

        if (returnAppRes.ok) {
          const returnTrip = await returnAppRes.json();
          result.return_trip = returnTrip;
          result.is_round_trip = true;
        } else {
          console.error(
            "Failed to create return trip, but outbound booking was successful",
          );
        }
      }

      // 6. If recurring is enabled, also create the recurring series
      if (data.is_recurring && data.recurring_frequency) {
        try {
          const recurringRes = await fetch("/api/recurring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: clientId,
              employee_id: null,
              start_time: data.time,
              frequency: data.recurring_frequency,
              notes: combinedNotes,
              vehicle_id: null,
              destination: data.destination || null,
              num_people: data.num_people ? Number(data.num_people) : null,
              num_bags_checked: data.num_bags_checked
                ? Number(data.num_bags_checked)
                : null,
              num_bags_carry_on: data.num_bags_carry_on
                ? Number(data.num_bags_carry_on)
                : null,
              outgoing_flight_info: data.outgoing_flight_info || null,
              returning_flight_info: data.returning_flight_info || null,
              return_date: data.return_date || null,
              payment_method: data.payment_method || null,
              requested_driver_name: data.requested_driver_name || null,
              template_appointment_id: result.id || null,
              services_data: tripServices,
              num_occurrences: 0,
            }),
          });

          if (recurringRes.ok) {
            const recurringData = await recurringRes.json();
            result.recurring_series_created = true;
            result.recurring_series_id = recurringData.id;
          } else {
            const recurringErr = await recurringRes.json().catch(() => ({}));
            console.error(
              "Failed to create recurring series:",
              recurringErr.error || recurringRes.statusText,
            );
          }
        } catch (error) {
          console.error("Error creating recurring series:", error);
          // Don't fail the entire booking if recurring creation fails
        }
      }

      return result;
    },
    onSuccess: (result) => {
      toast.success("Booking request sent!");
      setBookingResult(result);
      setStep(3);
      setValidationErrors([]);
    },
    onError: (err) => {
      if (err.message !== "Validation failed") {
        toast.error(
          err.message || "Failed to submit booking. Please try again.",
        );
      }
    },
  });

  return mutation;
}
