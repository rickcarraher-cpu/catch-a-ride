import { useState } from "react";
import { getDatePartsInCDT } from "@/utils/timezone";

// Convert a timestamp to YYYY-MM-DDTHH:MM in CDT timezone
// so datetime-local inputs display the correct CDT time
function toLocalDateTimeInput(utcString) {
  if (!utcString) return "";

  // Create a Date object from the string
  const d = new Date(utcString);

  // Check if the date is valid
  if (isNaN(d.getTime())) return "";

  // Get CDT date/time components (not browser's local timezone)
  const parts = getDatePartsInCDT(d);

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function useTripForm({
  trip,
  prefillData,
  preselectedDriverId,
  services,
}) {
  const init = prefillData && !trip ? prefillData : null;
  const isReturnTrip = !!init;

  // Extract services from either trip.services or trip.appointment_services
  const tripServices = trip?.services || trip?.appointment_services || [];

  // If structured address fields are missing but flat address strings exist, fall back to them
  // so editing an online-booked return trip shows the addresses instead of blank fields
  const resolvedPickupStreet =
    trip?.pickup_street || trip?.pickup_address || "";
  const resolvedDropoffStreet =
    trip?.dropoff_street || trip?.dropoff_address || "";
  const resolvedInitPickupStreet =
    init?.pickup_street || init?.pickup_address || "";
  const resolvedInitDropoffStreet =
    init?.dropoff_street || init?.dropoff_address || "";

  const [formData, setFormData] = useState({
    client_id: init?.client_id ?? trip?.client_id ?? "",
    employee_id:
      init?.employee_id ?? trip?.employee_id ?? preselectedDriverId ?? "",
    vehicle_id: init?.vehicle_id ?? trip?.vehicle_id ?? "",
    vehicle_category: init?.vehicle_category ?? trip?.vehicle_category ?? null,
    start_time: init?.start_time
      ? toLocalDateTimeInput(init.start_time)
      : trip?.start_time
        ? toLocalDateTimeInput(trip.start_time)
        : "",
    status: init?.status ?? trip?.status ?? "pending",
    booked_by: init?.booked_by ?? trip?.booked_by ?? "Admin",
    booker_name: init?.booker_name ?? trip?.booker_name ?? "",
    notes: init?.notes ?? trip?.notes ?? "",
    driver_notes: init?.driver_notes ?? trip?.driver_notes ?? "",
    is_tentative: init?.is_tentative ?? trip?.is_tentative ?? false,
    tentative_reason: init?.tentative_reason ?? trip?.tentative_reason ?? "",
    num_people: init?.num_people ?? trip?.num_people ?? "",
    num_bags_checked: init?.num_bags_checked ?? trip?.num_bags_checked ?? "",
    num_bags_carry_on: init?.num_bags_carry_on ?? trip?.num_bags_carry_on ?? "",
    num_golf_bags: init?.num_golf_bags ?? trip?.num_golf_bags ?? "",
    num_car_seats: init?.num_car_seats ?? trip?.num_car_seats ?? "",
    outgoing_flight_info:
      init?.outgoing_flight_info ?? trip?.outgoing_flight_info ?? "",
    returning_flight_info:
      init?.returning_flight_info ?? trip?.returning_flight_info ?? "",
    return_date: init?.return_date
      ? toLocalDateTimeInput(init.return_date)
      : trip?.return_date
        ? toLocalDateTimeInput(trip.return_date)
        : "",
    destination: init?.destination ?? trip?.destination ?? "",
    pickup_address: init?.pickup_address ?? trip?.pickup_address ?? "",
    pickup_street: resolvedInitPickupStreet || resolvedPickupStreet || "",
    pickup_city: init?.pickup_city ?? trip?.pickup_city ?? "",
    pickup_state: init?.pickup_state ?? trip?.pickup_state ?? "",
    pickup_zip: init?.pickup_zip ?? trip?.pickup_zip ?? "",
    dropoff_address: init?.dropoff_address ?? trip?.dropoff_address ?? "",
    dropoff_street: resolvedInitDropoffStreet || resolvedDropoffStreet || "",
    dropoff_city: init?.dropoff_city ?? trip?.dropoff_city ?? "",
    dropoff_state: init?.dropoff_state ?? trip?.dropoff_state ?? "",
    dropoff_zip: init?.dropoff_zip ?? trip?.dropoff_zip ?? "",
    payment_method: init?.payment_method ?? trip?.payment_method ?? "",
    distance_miles: init?.distance_miles ?? trip?.distance_miles ?? null,
    distance_method: init?.distance_method ?? trip?.distance_method ?? null,
    distance_note: null,
    save_as_home_address: false,
    services:
      (init?.services ?? tripServices)?.map((s) => ({
        service_id: s.service_id,
        service_name: s.service_name || "",
        service_price: s.service_price,
        duration_minutes: s.duration_minutes,
        quantity: s.quantity || 1,
        stop_description: s.stop_description || "",
      })) ?? [],
    gift_certificate: init?.gift_certificate ?? trip?.gift_certificate ?? "",
    // Wedding link
    wedding_id: init?.wedding_id ?? trip?.wedding_id ?? null,
  });

  // ✅ Airport trip detection: explicit flags, service type, OR address/ZIP detection.
  // ZIP 37214 = BNA airport. Exclude "hilton" mentions to avoid BNA Hilton hotel false positives.
  const hasAirportService = formData.services.some((s) => {
    const match = services?.find((svc) => svc.id == s.service_id);
    return match?.is_airport_service;
  });

  // Check explicit is_airport flags (set when selecting preferred locations in wizard)
  const hasFlaggedAirport =
    formData.pickup_is_airport || formData.dropoff_is_airport;

  // Address/ZIP-based detection for existing trips (flags not persisted in DB)
  const airportKeywords = ["airport", "terminal", "concourse"];
  const pickupAddrLower = (
    formData.pickup_address ||
    formData.pickup_street ||
    ""
  ).toLowerCase();
  const dropoffAddrLower = (
    formData.dropoff_address ||
    formData.dropoff_street ||
    ""
  ).toLowerCase();
  const allAddrText = `${pickupAddrLower} ${dropoffAddrLower} ${(formData.destination || "").toLowerCase()}`;
  const isBNAHilton = allAddrText.includes("hilton");

  const hasAddressAirport =
    !isBNAHilton &&
    (airportKeywords.some((kw) => pickupAddrLower.includes(kw)) ||
      airportKeywords.some((kw) => dropoffAddrLower.includes(kw)) ||
      formData.pickup_zip === "37214" ||
      formData.dropoff_zip === "37214");

  const isAirportTrip =
    hasFlaggedAirport || hasAirportService || hasAddressAirport;

  // A trip is a "return trip" if it was opened via prefillData (Book Return flow)
  // OR if the existing trip's notes contain "return trip"
  const notesValue = init?.notes ?? trip?.notes ?? "";
  const computedIsReturnTrip =
    !!init || notesValue.toLowerCase().includes("return trip");

  return {
    formData,
    setFormData,
    isAirportTrip,
    isReturnTrip: computedIsReturnTrip,
  };
}
