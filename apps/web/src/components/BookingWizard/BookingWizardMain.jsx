"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/utils/notify";

import { WelcomeScreen } from "./WelcomeScreen";
import { IntentSelection } from "./IntentSelection";
import { SendMessageScreen } from "./SendMessageScreen";
import { WizardHeader } from "./WizardHeader";
import { WizardNavigation } from "./WizardNavigation";
import { StepCard } from "./StepCard";

import { Step1Name } from "./Steps/Step1Name";
import { Step2TripType } from "./Steps/Step2TripType";
import { Step3DateTime } from "./Steps/Step3DateTime";
import { Step3_5PassengersBaggage } from "./Steps/Step3_5PassengersBaggage";
import { Step3_5VehicleType } from "./Steps/Step3_5VehicleType";
import { Step4Location } from "./Steps/Step4Location";
// Step5Service removed - service now auto-detected in Step4Location
import { Step6Details } from "./Steps/Step6Details";
import { Step7Addons } from "./Steps/Step7Addons";
import { Step7_5Pricing } from "./Steps/Step7_5Pricing";
import { Step8AdminOptions } from "./Steps/Step8AdminOptions";
import { Step9Review } from "./Steps/Step9Review";
import { Step10Recurring } from "./Steps/Step10Recurring"; // NEW: Import recurring step
import { StepTourParticipantType } from "./Steps/StepTourParticipantType";
import { StepTourParticipants } from "./Steps/StepTourParticipants";
import { StepTourItinerary } from "./Steps/StepTourItinerary";
import { StepTourPricing } from "./Steps/StepTourPricing";

import { Bell, BellOff, FileText, AlertCircle } from "lucide-react";

import {
  STEPS,
  DISPATCH_STEPS,
  RECURRING_STEPS,
  TOUR_DISPATCH_STEPS,
  INITIAL_FORM,
} from "./constants";
import {
  getValidationErrors,
  getAllValidationErrors,
  getMissingOptionalFields,
} from "./validation";

import { AfterHoursModal } from "./AfterHoursModal";

// Build a timestamp with the correct America/Chicago UTC offset so PostgreSQL
// stores the right local time (without this, bare strings are treated as UTC).
function buildChicagoTimestamp(dateStr, timeStr) {
  if (!dateStr) return null;
  const time = timeStr || "00:00";
  try {
    const probe = new Date(`${dateStr}T12:00:00Z`);

    // Validate the date before using formatToParts
    if (isNaN(probe.getTime())) {
      console.error("Invalid date passed to buildChicagoTimestamp:", {
        dateStr,
        timeStr,
      });
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(probe);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (
      tzName.startsWith("GMT") &&
      (tzName.includes("+") || tzName.includes("-"))
    ) {
      const offset = tzName.slice(3);
      return `${dateStr}T${time}:00${offset}`;
    }
  } catch (err) {
    console.error("Error in buildChicagoTimestamp:", err);
    return null;
  }
  const month = parseInt(dateStr.slice(5, 7), 10);
  const offset = month >= 3 && month <= 11 ? "-05:00" : "-06:00";
  return `${dateStr}T${time}:00${offset}`;
}

export function BookingWizardMain({
  settings,
  services,
  preferredLocations,
  isPassengerMode = true,
  isRecurringMode = false,
  drivers = [],
  vehicles = [],
  onClose = null,
  onSuccess = null,
  prefillData = null,
  startWithTour = false,
}) {
  // Extract rate_per_mile from settings for auto-price calculation
  const ratePerMile = settings?.rate_per_mile
    ? parseFloat(settings.rate_per_mile)
    : null;

  // Extract manual_mileage setting — when true, dispatch enters miles manually
  const manualMileage = settings?.manual_mileage === "yes";

  // Passenger mode starts at after-hours modal, dispatch starts at booking
  const initialScreen = isPassengerMode ? "afterhours" : "booking";
  const [screen, setScreen] = useState(initialScreen);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(() => {
    // Apply passenger default city/state/zip from settings
    const defaults = { ...INITIAL_FORM };
    if (settings?.default_passenger_city) {
      defaults.home_city = settings.default_passenger_city;
      defaults.city = settings.default_passenger_city;
    }
    if (settings?.default_passenger_state) {
      defaults.home_state = settings.default_passenger_state;
      defaults.state = settings.default_passenger_state;
    }
    if (settings?.default_passenger_zip) {
      defaults.home_zip = settings.default_passenger_zip;
      defaults.zip_code = settings.default_passenger_zip;
    }
    // If launching as a tour, pre-select tour trip type
    if (startWithTour) {
      defaults.trip_type = "tour";
      defaults.is_tour = true;
    }
    return defaults;
  });

  // Reactive stepsConfig — updates automatically when formData.is_tour changes
  const stepsConfig = isRecurringMode
    ? RECURRING_STEPS
    : isPassengerMode
      ? STEPS
      : formData.is_tour
        ? TOUR_DISPATCH_STEPS
        : DISPATCH_STEPS;
  const [submissionError, setSubmissionError] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const [showValidationErrorModal, setShowValidationErrorModal] =
    useState(false);
  const [validationErrorsList, setValidationErrorsList] = useState([]);

  // Save prompt state for dispatch mode (quote / send confirmations)
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [savePromptStep, setSavePromptStep] = useState("quote"); // "quote" | "confirmations"

  // Track pending send_notification override for missing fields dialog
  const [pendingSendNotification, setPendingSendNotification] = useState(null);

  // Add ref for scrollable content
  const scrollContainerRef = useRef(null);

  // Ref-based guard to prevent double-submit (isPending has a small timing gap)
  const isSubmittingRef = useRef(false);

  // Add ref to track successful submission
  const hasSucceededRef = useRef(false);

  // Scroll to top when step changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [step]);

  // Passenger lookup state for Step 1
  const [lookupType, setLookupType] = useState("name");
  const [lookupValue, setLookupValue] = useState("");
  const [lookupStatus, setLookupStatus] = useState(null);
  const [allMatches, setAllMatches] = useState([]);
  const [matchIndex, setMatchIndex] = useState(0);

  // Helper to populate formData from a client object
  const populateFromClient = (client) => {
    const hasStructuredAddress = !!(
      client.street_address &&
      client.city &&
      client.state &&
      client.zip_code
    );

    // Build full address from components
    const fullAddress = [
      client.street_address,
      client.city,
      client.state,
      client.zip_code,
    ]
      .filter(Boolean)
      .join(", ");

    // IMPORTANT: Preserve phone and email when populating from client
    setFormData((prev) => ({
      ...prev,
      name: client.name || "",
      phone: client.phone || prev.phone || "", // Keep existing phone if client doesn't have one
      email: client.email || prev.email || "", // Keep existing email if client doesn't have one
      notification_preference: client.notification_preference || "both",
      pickup: fullAddress || null,
      pickup_street: client.street_address || null,
      pickup_city: client.city || null,
      pickup_state: client.state || null,
      pickup_zip: client.zip_code || null,
      home_street: client.street_address || null,
      home_city: client.city || null,
      home_state: client.state || null,
      home_zip: client.zip_code || null,
      home_address_legacy: hasStructuredAddress ? "" : client.address || "",
      client_id: client.id,
      cc_emails: client.cc_emails || "",
      referral_source: "", // Always clear — this is per-booking, not carried from client
    }));
  };

  // Passenger lookup mutation
  const lookupMutation = useMutation({
    mutationFn: async ({ type, value }) => {
      const res = await fetch("/api/appointments/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      if (!res.ok) throw new Error("Lookup failed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.found && data.client) {
        const matches = data.all_matches || [data.client];
        setAllMatches(matches);
        setMatchIndex(0);
        populateFromClient(data.client);
        setLookupStatus("found");
      } else {
        setAllMatches([]);
        setMatchIndex(0);
        setLookupStatus("not_found");
      }
    },
    onError: () => {
      toast.error("Error looking up passenger");
      setLookupStatus("error");
      setAllMatches([]);
      setMatchIndex(0);
    },
  });

  const nextMatch = () => {
    const nextIndex = matchIndex + 1;
    if (nextIndex < allMatches.length) {
      setMatchIndex(nextIndex);
      populateFromClient(allMatches[nextIndex]);
    }
  };

  const prevMatch = () => {
    const prevIndex = matchIndex - 1;
    if (prevIndex >= 0) {
      setMatchIndex(prevIndex);
      populateFromClient(allMatches[prevIndex]);
    }
  };

  // Booking submission mutation
  const submitMutation = useMutation({
    mutationFn: async (data) => {
      // NEW: Recurring mode uses different endpoint
      if (isRecurringMode) {
        const res = await fetch("/api/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(
            errorData.error || "Failed to create recurring series",
          );
        }
        return res.json();
      }

      // Regular appointment submission (existing code)
      console.log("Mutation received data:", {
        _is_round_trip: data._is_round_trip,
        _return_date: data._return_date,
        _return_time: data._return_time,
      });

      // Create a clean payload without the metadata fields
      const {
        _is_round_trip,
        _return_date,
        _return_time,
        _addon_legs,
        _addon_prices,
        _addon_quantities,
        ...cleanPayload
      } = data;

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanPayload),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit booking");
      }
      const result = await res.json();

      console.log("Outbound trip created:", result);
      console.log(
        "Checking round trip:",
        _is_round_trip,
        _return_date,
        _return_time,
      );

      // If round trip, create the return trip appointment
      if (_is_round_trip && _return_date && _return_time) {
        console.log("Creating return trip...");

        const returnStartTime = buildChicagoTimestamp(
          _return_date,
          _return_time,
        );

        // Build return trip services array (base service + incoming leg addons)
        const returnTripServices = [];

        // Add the base service to return trip
        if (data.services && data.services.length > 0) {
          const baseService = data.services[0]; // Primary service
          returnTripServices.push(baseService);
        }

        // Calculate base service price for tip addon percentage calculation
        const returnBaseServicePrice = data.services?.[0]?.service_price
          ? Number(data.services[0].service_price)
          : 0;

        // Add incoming leg addons to return trip
        if (data._addon_legs) {
          const addonsList = services?.filter((s) => s.is_addon) || [];
          Object.entries(data._addon_legs).forEach(([addonId, legs]) => {
            if (legs.includes("incoming")) {
              const addon = addonsList.find((a) => a.id == addonId);
              if (addon) {
                const customPrice = data._addon_prices?.[`${addonId}_incoming`];
                const hasCustomPrice =
                  customPrice !== undefined &&
                  customPrice !== "" &&
                  customPrice !== null;
                let addonPrice = hasCustomPrice
                  ? Number(customPrice)
                  : Number(addon.default_price);

                // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
                const isGasFeeAddon = (addon.name || "")
                  .toLowerCase()
                  .includes("gas");
                // FIX: Tip addons store a percentage in default_price — calculate the actual dollar amount
                if (
                  addon.is_tip_addon &&
                  !isGasFeeAddon &&
                  !hasCustomPrice &&
                  returnBaseServicePrice > 0
                ) {
                  const tipPercent = Number(addon.default_price || 0);
                  if (tipPercent > 0) {
                    addonPrice = Math.ceil(
                      (returnBaseServicePrice * tipPercent) / 100,
                    );
                  }
                }

                // Quantity-based addons (stops, car seats) keep their per-leg qty.
                // All other addons (flat fees) always charge qty=1 per trip.
                const needsQty =
                  addon.name.toLowerCase().includes("stop") ||
                  addon.name.toLowerCase().includes("car seat");
                const rawQty = data._addon_quantities?.[addonId] || 1;
                returnTripServices.push({
                  service_id: addon.id,
                  service_price: addonPrice,
                  duration_minutes: addon.duration_minutes || 0,
                  quantity: needsQty ? rawQty : 1,
                });
              }
            }
          });
        }

        // Reverse pickup/dropoff for return trip
        const returnPayload = {
          ...cleanPayload,
          start_time: returnStartTime,
          services:
            returnTripServices.length > 0
              ? returnTripServices
              : cleanPayload.services,
          pickup_address: cleanPayload.dropoff_address || null,
          pickup_street: cleanPayload.dropoff_street || null,
          pickup_city: cleanPayload.dropoff_city || null,
          pickup_state: cleanPayload.dropoff_state || null,
          pickup_zip: cleanPayload.dropoff_zip || null,
          dropoff_address: cleanPayload.pickup_address || null,
          dropoff_street: cleanPayload.pickup_street || null,
          dropoff_city: cleanPayload.pickup_city || null,
          dropoff_state: cleanPayload.pickup_state || null,
          dropoff_zip: cleanPayload.pickup_zip || null,
          // Carry over distance from outbound trip (same route, just reversed)
          distance_miles:
            cleanPayload.distance_miles || result.distance_miles || null,
          // FIX: The return leg is an ARRIVAL trip (BNA → home).
          // The outbound trip's returning_flight_info = the arriving flight back at BNA.
          // Keep it as returning_flight_info on the return trip (that's where arrival
          // flight data lives). Previously it was incorrectly swapped to outgoing_flight_info,
          // causing "fabricated" flight info to appear on the return leg confirmation.
          outgoing_flight_info: null,
          returning_flight_info: cleanPayload.returning_flight_info || null,
          return_date: null,
          notes: cleanPayload.notes
            ? `${cleanPayload.notes}\n\nReturn trip for booking #${result.booking_number || result.id}`
            : `Return trip for booking #${result.booking_number || result.id}`,
        };

        try {
          const returnRes = await fetch("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(returnPayload),
          });

          if (returnRes.ok) {
            const returnTrip = await returnRes.json();
            console.log("Return trip created successfully:", returnTrip);
            result.return_trip = returnTrip;
            result.is_round_trip = true;
          } else {
            const errorData = await returnRes.json();
            console.error("Failed to create return trip:", errorData);
          }
        } catch (err) {
          console.error("Error creating return trip:", err);
          // Don't fail the entire booking if return trip creation fails
        }
      } else {
        console.log(
          "Skipping return trip creation - not a round trip or missing date/time",
        );
      }

      return result;
    },
    onSuccess: (data) => {
      hasSucceededRef.current = true; // Track successful submission
      if (isRecurringMode) {
        toast.success("Recurring series created successfully ✓");
        if (onSuccess) onSuccess();
      } else if (!isPassengerMode) {
        // Dispatch mode: navigate to /trips and open the newly created trip(s)
        const message = data.is_round_trip
          ? "Round-trip created successfully ✓"
          : "Trip created successfully ✓";
        toast.success(message);

        // Build URL with trip ID(s) to auto-open
        const tripIds = [];
        if (data.id) tripIds.push(data.id);
        if (data.return_trip?.id) tripIds.push(data.return_trip.id);

        // Navigate to /trips with the first trip ID to open
        if (tripIds.length > 0) {
          window.location.href = `/trips?id=${tripIds[0]}`;
        } else if (onSuccess) {
          onSuccess();
        }
      } else {
        // Passenger mode: show confirmation screen
        const message = data.is_round_trip
          ? "Round-trip booking submitted successfully!"
          : "Booking submitted successfully!";
        toast.success(message);
        setScreen("confirmation");
        setFormData((prev) => ({
          ...prev,
          booking_number: data.booking_number,
        }));
      }
    },
    onError: (error) => {
      // Only show error if booking didn't already succeed
      if (!hasSucceededRef.current) {
        console.error("Booking submission error:", error);
        setSubmissionError(error.message);
        toast.error(
          isRecurringMode
            ? "Failed to create recurring series"
            : "Failed to submit booking",
        );
      }
    },
    onSettled: () => {
      isSubmittingRef.current = false;
    },
  });

  const set = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // ── Service detection helpers ───────────────────────────────────────
  // Helper: check if current formData indicates an airport trip (used in multiple places)
  const checkIsAirportTrip = () => {
    // Only trigger airport fields if: explicit is_airport flag from preferred location, OR service is airport service
    if (formData.pickup_is_airport || formData.dropoff_is_airport) return true;
    const svc = services?.find((s) => s.id == formData.service_id);
    if (svc?.is_airport_service) return true;
    return false;
  };

  const detectService = (pickupAddr, dropoffAddr) => {
    if (!services) return null;
    const pickup = pickupAddr.toLowerCase();
    const dropoff = dropoffAddr.toLowerCase();

    // Check preferred location labels first
    const preferredLabel = (
      formData.pickup_preferred_label ||
      formData.dropoff_preferred_label ||
      ""
    ).toLowerCase();
    if (preferredLabel) {
      const found = services.find((s) => {
        const sName = s.name.toLowerCase();
        return (
          preferredLabel.includes(sName) ||
          sName
            .split(" ")
            .some((word) => word.length > 3 && preferredLabel.includes(word))
        );
      });
      if (found) return found;
    }

    // Check if this looks like BNA Hilton (hotel shares airport ZIP 37214)
    const combinedAddr = `${pickup} ${dropoff}`;
    const isBNAHilton = combinedAddr.includes("hilton");

    // Detect service by address keywords
    let name;
    if (
      pickup.includes("terminal") ||
      dropoff.includes("terminal") ||
      pickup.includes("airport") ||
      dropoff.includes("airport") ||
      (!isBNAHilton && (pickup.includes("37214") || dropoff.includes("37214")))
    ) {
      name = "BNA";
    } else if (
      pickup.includes("broadway") ||
      dropoff.includes("broadway") ||
      pickup.includes("downtown") ||
      dropoff.includes("downtown") ||
      pickup.includes("37203") ||
      dropoff.includes("37203")
    ) {
      name = "Downtown";
    } else if (
      pickup.includes("rock springs") ||
      dropoff.includes("rock springs") ||
      pickup.includes("castilian") ||
      dropoff.includes("castilian") ||
      pickup.includes("37031") ||
      dropoff.includes("37031")
    ) {
      name = "The Farm";
    } else {
      name = "Custom";
    }

    return (
      services.find((s) => s.name.toLowerCase().includes(name.toLowerCase())) ||
      null
    );
  };

  const applyDetectedServicePricing = (detectedService) => {
    if (!detectedService) return;
    // For passenger bookings, always use the default_price
    set({
      service_id: detectedService.id,
      service_price: String(detectedService.default_price || 0),
    });
  };
  // ─────────────────────────────────────────────────────────────────────

  const handleNext = () => {
    // Service auto-detection happens after Location step.
    // In standard dispatch mode, Location is step 6.
    // In tour mode, Location is step 8.
    const locationStep = formData.is_tour ? 8 : 6;
    if (step === locationStep && services) {
      const pickupAddr =
        `${formData.pickup_street || ""}, ${formData.pickup_city || ""}, ${formData.pickup_state || ""} ${formData.pickup_zip || ""}`.trim();
      const dropoffAddr =
        `${formData.dropoff_street || ""}, ${formData.dropoff_city || ""}, ${formData.dropoff_state || ""} ${formData.dropoff_zip || ""}`.trim();
      let svc = detectService(pickupAddr, dropoffAddr);
      // Fallback: if no service detected, use "Custom" or first available service
      if (!svc && services.length > 0) {
        svc =
          services.find((s) => s.name.toLowerCase().includes("custom")) ||
          services[0];
      }
      applyDetectedServicePricing(svc);
      // Fall through to normal step increment
    }

    if (step < stepsConfig.length) {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    // REMOVED: No longer skip Step 4 when going back

    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const processSubmission = async (overrides = {}) => {
    // Guard against double-submit
    if (submitMutation.isPending || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    // NEW: Recurring mode submission
    if (isRecurringMode) {
      // Build services array (primary service + add-ons)
      const selectedServiceData = services?.find(
        (s) => s.id == formData.service_id,
      );
      const addonsList = services?.filter((s) => s.is_addon) || [];
      const tripServices = [];
      if (selectedServiceData) {
        const servicePrice =
          formData.service_price !== "" &&
          formData.service_price !== undefined &&
          formData.service_price !== null
            ? Number(formData.service_price)
            : Number(selectedServiceData.default_price ?? 0);
        tripServices.push({
          service_id: selectedServiceData.id,
          service_price: servicePrice,
          duration_minutes: selectedServiceData.duration_minutes,
          quantity: 1,
        });
      }
      if (formData.selected_addons && addonsList.length > 0) {
        Object.entries(formData.selected_addons).forEach(
          ([addonId, quantity]) => {
            if (quantity > 0) {
              const addon = addonsList.find((a) => a.id == addonId);
              if (addon) {
                const customPrice = formData.addon_prices?.[addonId];
                const hasCustomPrice =
                  customPrice !== undefined &&
                  customPrice !== "" &&
                  customPrice !== null;
                const addonPrice = hasCustomPrice
                  ? Number(customPrice)
                  : Number(addon.default_price);
                tripServices.push({
                  service_id: addon.id,
                  service_price: addonPrice,
                  duration_minutes: addon.duration_minutes || 0,
                  quantity: quantity,
                });
              }
            }
          },
        );
      }

      // Build recurring payload
      const recurringPayload = {
        client_id: formData.client_id || null,
        employee_id: formData.employee_id || null,
        vehicle_id: formData.vehicle_id || null,
        start_time: formData.time || "09:00",
        frequency: formData.frequency || "weekly",
        num_occurrences: formData.num_occurrences
          ? Number(formData.num_occurrences)
          : 0,
        day_of_week:
          formData.day_of_week != null ? Number(formData.day_of_week) : null,
        services_data: tripServices,
        destination: formData.destination || null,
        num_people: formData.num_people ? Number(formData.num_people) : null,
        num_bags_checked: formData.num_bags_checked
          ? Number(formData.num_bags_checked)
          : null,
        num_bags_carry_on: formData.num_bags_carry_on
          ? Number(formData.num_bags_carry_on)
          : null,
        num_car_seats: formData.num_car_seats
          ? Number(formData.num_car_seats)
          : null,
        num_golf_bags: formData.num_golf_bags
          ? Number(formData.num_golf_bags)
          : null,
        outgoing_flight_info: formData.outgoing_flight_info || null,
        returning_flight_info: formData.returning_flight_info || null,
        return_date: formData.return_date || null,
        is_international_flight: formData.is_international_flight || false,
        customs_clearance_location: formData.customs_clearance_location || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        driver_notes: formData.driver_notes || null,
        is_tentative: formData.is_tentative || false,
        tentative_reason: formData.tentative_reason || null,
        requested_driver_name: formData.requested_driver_name || null,
      };

      submitMutation.mutate(recurringPayload);
      return;
    }

    // EXISTING: Regular appointment submission logic
    // Build start_time with proper Chicago timezone offset
    const startTime = buildChicagoTimestamp(formData.date, formData.time);

    // Resolve client_id — use existing or create a new client record
    let resolvedClientId = formData.client_id || null;
    if (
      !resolvedClientId &&
      (formData.name?.trim() || formData.phone?.trim())
    ) {
      try {
        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name?.trim() || "Unknown",
            email: formData.email || null,
            phone: formData.phone?.trim() || null,
            notification_preference: formData.notification_preference || "both",
            notes: isPassengerMode
              ? "Created via online booking"
              : "Created via dispatcher",
            // Save home address fields when creating new client
            street_address:
              formData.home_street || formData.street_address || null,
            city: formData.home_city || formData.city || null,
            state: formData.home_state || formData.state || null,
            zip_code: formData.home_zip || formData.zip_code || null,
            referral_source: formData.referral_source || null, // ADD: Save referral source when creating new client
          }),
        });
        const clientData = await clientRes.json();
        if (clientRes.ok) {
          resolvedClientId = clientData.id;
        } else if (clientRes.status === 409 && clientData.existing_id) {
          // Duplicate passenger — use the existing record so the booking still links correctly
          resolvedClientId = clientData.existing_id;
          toast.warning(
            `Passenger already exists in the system — using their existing profile.`,
            { duration: 5000 },
          );
          console.log(
            "[BookingWizard] Duplicate passenger detected, using existing client id:",
            resolvedClientId,
          );
        }
      } catch (err) {
        console.error("Failed to create client:", err);
      }
    } else if (resolvedClientId) {
      // Update existing client with latest phone/email/notification preference
      try {
        await fetch(`/api/clients/${resolvedClientId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: formData.phone?.trim() || null,
            email: formData.email || null,
            notification_preference: formData.notification_preference || "both",
            // Update home address if provided
            street_address:
              formData.home_street || formData.street_address || null,
            city: formData.home_city || formData.city || null,
            state: formData.home_state || formData.state || null,
            zip_code: formData.home_zip || formData.zip_code || null,
            referral_source: formData.referral_source || null, // ADD: Update referral source when updating existing client
          }),
        });
        console.log(
          "[BookingWizard] Updated client phone/email/address for client_id:",
          resolvedClientId,
        );
      } catch (err) {
        console.error("Failed to update client:", err);
      }
    }

    // Build services array (primary service + add-ons)
    const selectedServiceData = services?.find(
      (s) => s.id == formData.service_id,
    );
    const addonsList = services?.filter((s) => s.is_addon) || [];
    const tripServices = [];
    if (selectedServiceData) {
      const servicePrice =
        formData.service_price !== "" &&
        formData.service_price !== undefined &&
        formData.service_price !== null
          ? Number(formData.service_price)
          : Number(selectedServiceData.default_price ?? 0);
      tripServices.push({
        service_id: selectedServiceData.id,
        service_price: servicePrice,
        duration_minutes: selectedServiceData.duration_minutes,
        quantity: 1,
      });
    }

    // Add-ons: handle both one-way and round-trip with leg selection
    if (formData.selected_addons && addonsList.length > 0) {
      const isRoundTrip = formData.is_round_trip && formData.return_date;

      // Calculate the base service price for tip addon percentage calculation
      const baseServicePrice = selectedServiceData
        ? formData.service_price !== "" &&
          formData.service_price !== undefined &&
          formData.service_price !== null
          ? Number(formData.service_price)
          : Number(selectedServiceData.default_price ?? 0)
        : 0;

      Object.entries(formData.selected_addons).forEach(
        ([addonId, quantity]) => {
          if (quantity > 0) {
            const addon = addonsList.find((a) => a.id == addonId);
            if (addon) {
              // For round trips with leg selection
              if (isRoundTrip && formData.addon_legs?.[addonId]) {
                const legs = formData.addon_legs[addonId];

                // Add addon for outgoing leg only (incoming will be added to return trip)
                if (legs.includes("outgoing")) {
                  const customPrice =
                    formData.addon_prices?.[`${addonId}_outgoing`];
                  const hasCustomPrice =
                    customPrice !== undefined &&
                    customPrice !== "" &&
                    customPrice !== null;
                  let addonPrice = hasCustomPrice
                    ? Number(customPrice)
                    : Number(addon.default_price);

                  // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
                  const isGasFeeAddon = (addon.name || "")
                    .toLowerCase()
                    .includes("gas");
                  // FIX: Tip addons store a percentage in default_price — calculate the actual dollar amount
                  if (
                    addon.is_tip_addon &&
                    !isGasFeeAddon &&
                    !hasCustomPrice &&
                    baseServicePrice > 0
                  ) {
                    const tipPercent = Number(addon.default_price || 0);
                    if (tipPercent > 0) {
                      addonPrice = Math.ceil(
                        (baseServicePrice * tipPercent) / 100,
                      );
                    }
                  }

                  // Quantity-based addons (stops, car seats) keep their per-leg qty.
                  // All other addons (flat fees like FALL BREAK) always charge qty=1 per trip.
                  const needsQty =
                    addon.name.toLowerCase().includes("stop") ||
                    addon.name.toLowerCase().includes("car seat");
                  tripServices.push({
                    service_id: addon.id,
                    service_price: addonPrice,
                    duration_minutes: addon.duration_minutes || 0,
                    quantity: needsQty ? quantity : 1,
                  });
                }
              } else {
                // One-way trip or round trip without leg selection (use old behavior)
                const customPrice = formData.addon_prices?.[addonId];
                const hasCustomPrice =
                  customPrice !== undefined &&
                  customPrice !== "" &&
                  customPrice !== null;
                let addonPrice = hasCustomPrice
                  ? Number(customPrice)
                  : Number(addon.default_price);

                // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
                const isGasFeeAddon = (addon.name || "")
                  .toLowerCase()
                  .includes("gas");
                // FIX: Tip addons store a percentage in default_price — calculate the actual dollar amount
                if (
                  addon.is_tip_addon &&
                  !isGasFeeAddon &&
                  !hasCustomPrice &&
                  baseServicePrice > 0
                ) {
                  const tipPercent = Number(addon.default_price || 0);
                  if (tipPercent > 0) {
                    addonPrice = Math.ceil(
                      (baseServicePrice * tipPercent) / 100,
                    );
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
          }
        },
      );
    }

    // Build notes (include special requests/stop descriptions)
    const notesParts = [];
    if (formData.notes) notesParts.push(formData.notes);
    // REMOVED: No longer auto-add special requests, stop descriptions, or requested driver to notes
    const combinedNotes = notesParts.join("\n") || null;

    // Build submission payload with all required API fields
    const payload = {
      client_id: resolvedClientId,
      start_time: startTime,

      // Addresses
      pickup_address: formData.pickup || null,
      pickup_street: formData.pickup_street || null,
      pickup_city: formData.pickup_city || null,
      pickup_state: formData.pickup_state || null,
      pickup_zip: formData.pickup_zip || null,
      dropoff_address: formData.dropoff || null,
      dropoff_street: formData.dropoff_street || null,
      dropoff_city: formData.dropoff_city || null,
      dropoff_state: formData.dropoff_state || null,
      dropoff_zip: formData.dropoff_zip || null,
      destination: formData.destination || null,
      distance_miles: formData.distance_miles || null,

      // Vehicle preference
      vehicle_category: formData.vehicle_category || null,

      // Services array
      services: tripServices,

      // Passenger details
      num_people: formData.num_people ? Number(formData.num_people) : null,
      num_bags_checked: formData.num_bags_checked
        ? Number(formData.num_bags_checked)
        : null,
      num_bags_carry_on: formData.num_bags_carry_on
        ? Number(formData.num_bags_carry_on)
        : null,
      num_car_seats: formData.num_car_seats
        ? Number(formData.num_car_seats)
        : null,
      num_golf_bags: formData.num_golf_bags
        ? Number(formData.num_golf_bags)
        : null,

      // Flight info
      outgoing_flight_info: formData.outgoing_flight_info || null,
      returning_flight_info: formData.returning_flight_info || null,
      // IMPORTANT: Apply buildChicagoTimestamp to return_date so PostgreSQL
      // stores it with the correct timezone (bare dates default to UTC midnight
      // which shifts back one day in Central time)
      return_date: formData.return_date
        ? buildChicagoTimestamp(
            formData.return_date.includes("T")
              ? formData.return_date.slice(0, 10)
              : formData.return_date,
            formData.return_date.includes("T") &&
              formData.return_date.length === 16
              ? formData.return_date.slice(11, 16)
              : formData.return_time || "12:00",
          )
        : null,
      is_international_flight: formData.is_international_flight || false,
      customs_clearance_location: formData.customs_clearance_location || null,

      // Payment & notes
      payment_method: formData.payment_method || null,
      notes: combinedNotes,
      requested_driver_name: formData.requested_driver_name || null,

      // Tour fields
      is_tour: formData.is_tour || false,
      tour_end_time:
        formData.tour_end_time && formData.date
          ? buildChicagoTimestamp(formData.date, formData.tour_end_time)
          : null,
      tour_participant_type: formData.tour_participant_type || null,
      tour_flat_fee: formData.tour_flat_fee
        ? Number(formData.tour_flat_fee)
        : null,
      tour_payment_split: formData.tour_payment_split || null,
      tour_participants: formData.tour_participants || null,
      tour_itinerary: formData.tour_itinerary || null,

      // Receipt
      needs_receipt: formData.needs_receipt === true,

      // Source
      // When confirmations are sent (send_notification=true), status should be "approved"
      // Otherwise use overrides.status, or default to "needs_review" (passenger) / "pending" (dispatch)
      status:
        overrides.status ||
        (overrides.send_notification === true
          ? "approved"
          : isPassengerMode
            ? "needs_review"
            : "pending"),
      booked_by: isPassengerMode ? "Passenger" : "Admin",

      // IMPORTANT: Enable notifications so emails are sent
      send_notification:
        overrides.send_notification !== undefined
          ? overrides.send_notification
          : true,

      // IMPORTANT: Driver and passenger confirmations should start as 'pending'
      // so they must manually accept/confirm the trip
      driver_accepted: "pending",
      passenger_confirmed: "pending",

      // Round trip metadata (for mutation function to use)
      _is_round_trip: formData.is_round_trip,
      _return_date: formData.return_date,
      _return_time: formData.return_time,
      _addon_legs: formData.addon_legs || null,
      _addon_prices: formData.addon_prices || null,
      _addon_quantities: formData.selected_addons || null,
    };

    // Dispatch-only fields
    if (!isPassengerMode) {
      payload.employee_id = formData.employee_id || null;
      payload.vehicle_id = formData.vehicle_id || null;
      payload.is_tentative = formData.is_tentative || false;
      payload.tentative_reason = formData.tentative_reason || null;
      payload.booker_name = formData.booker_name || null;
      payload.driver_notes = formData.driver_notes || null;
      payload.wedding_id = formData.wedding_id
        ? Number(formData.wedding_id)
        : null;
      // Only override status from formData if overrides.status was NOT set (e.g. "quote")
      if (!overrides.status && overrides.send_notification !== true) {
        payload.status = formData.status || "pending";
      }
    }

    submitMutation.mutate(payload);
  };

  const handleSubmit = async () => {
    // Guard against double-submit
    if (submitMutation.isPending) return;

    setSubmissionError(null);

    // In dispatch mode, vehicle type is required
    if (!isPassengerMode && !isRecurringMode && !formData.vehicle_category) {
      setValidationErrorsList(["Vehicle type is required"]);
      setShowValidationErrorModal(true);
      return;
    }

    // Check required fields (only passenger name + email or phone)
    const errors = getAllValidationErrors(formData, services);
    if (errors.length > 0) {
      setValidationErrorsList(errors);
      setShowValidationErrorModal(true);
      return;
    }

    // In recurring mode, skip optional-fields dialog — just submit
    if (isRecurringMode) {
      await processSubmission();
      return;
    }

    // In dispatch mode, show the quote/confirmation prompt before submitting
    if (!isPassengerMode) {
      // Auto-save as Quote when trip is time-based (no prompt needed)
      if (formData.is_time_based) {
        await processSubmission({ status: "quote", send_notification: false });
        return;
      }
      setSavePromptStep("quote");
      setShowSavePrompt(true);
      return;
    }

    // Passenger mode: check for missing optional fields then submit
    // Detect if this is an airport trip from addresses and service
    const isAirportTripForSubmit = checkIsAirportTrip();

    // Check for missing optional fields
    const missing = getMissingOptionalFields(formData, isAirportTripForSubmit);
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowConfirmDialog(true);
    } else {
      await processSubmission();
    }
  };

  const handleApproveAndSend = async () => {
    // Guard against double-submit
    if (submitMutation.isPending) return;

    setSubmissionError(null);

    // In dispatch mode, vehicle type is required
    if (!isPassengerMode && !isRecurringMode && !formData.vehicle_category) {
      setValidationErrorsList(["Vehicle type is required"]);
      setShowValidationErrorModal(true);
      return;
    }

    // Check required fields
    const errors = getAllValidationErrors(formData, services);
    if (errors.length > 0) {
      setValidationErrorsList(errors);
      setShowValidationErrorModal(true);
      return;
    }

    // Check for missing optional fields
    const isAirportTrip = checkIsAirportTrip();
    const missing = getMissingOptionalFields(formData, isAirportTrip);
    if (missing.length > 0) {
      setMissingFields(missing);
      setPendingSendNotification(true); // Remember to send confirmations after user confirms
      setShowConfirmDialog(true);
    } else {
      // Directly submit with confirmations enabled
      await processSubmission({ send_notification: true });
    }
  };

  const handleSavePromptConfirm = async (choice) => {
    setShowSavePrompt(false);

    if (choice === "quote") {
      // Save as quote — no notifications, status = "quote"
      await processSubmission({ status: "quote", send_notification: false });
    } else if (choice === true) {
      // Send confirmations
      // Check for missing optional fields first
      const isAirportTrip = checkIsAirportTrip();
      const missing = getMissingOptionalFields(formData, isAirportTrip);
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowConfirmDialog(true);
      } else {
        await processSubmission({ send_notification: true });
      }
    } else {
      // No — save without notifications
      // Check for missing optional fields first
      const isAirportTrip = checkIsAirportTrip();
      const missing = getMissingOptionalFields(formData, isAirportTrip);
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowConfirmDialog(true);
      } else {
        await processSubmission({ send_notification: false });
      }
    }
  };

  const handleConfirmSubmit = async () => {
    // Guard against double-submit
    if (submitMutation.isPending || isSubmittingRef.current) return;
    setShowConfirmDialog(false);

    // Use the pending send_notification override if set
    const overrides =
      pendingSendNotification !== null
        ? { send_notification: pendingSendNotification }
        : {};

    await processSubmission(overrides);
    setPendingSendNotification(null); // Reset after submission
  };

  const handleCancelConfirm = () => {
    setShowConfirmDialog(false);
    setPendingSendNotification(null); // Reset if user cancels
    // User can go back and fill in the missing fields
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel this booking?")) {
      if (!isPassengerMode && onClose) {
        onClose();
      } else {
        setScreen("booking");
        setStep(1);
        const resetForm = { ...INITIAL_FORM };
        // Remove default city/state/zip - start fresh
        setFormData(resetForm);
        setLookupStatus(null);
        setLookupValue("");
      }
    }
  };

  // Validation
  const validationErrors = getValidationErrors(step, formData);
  // In dispatch mode, vehicle type is required at step 5 — block "Next" until selected
  const isVehicleStepBlocked =
    !isPassengerMode && step === 5 && !formData.vehicle_category;
  const canProceed = validationErrors.length === 0 && !isVehicleStepBlocked;

  const currentStepInfo = stepsConfig[step - 1];

  // Get selected service for display
  const selectedService = services?.find((s) => s.id == formData.service_id);

  // ✅ Airport trip detection: ONLY based on explicit preferred location flags OR service type
  // Do NOT use address keywords — a hotel near the airport (e.g. BNA Hilton) should NOT trigger airport fields
  const hasFlaggedAirport =
    formData.pickup_is_airport || formData.dropoff_is_airport;

  const isAirportTrip =
    hasFlaggedAirport || selectedService?.is_airport_service;

  // Determine if this is an airport trip so Step6Details shows the right fields
  const isAirport = isAirportTrip;

  // Get add-ons
  const addons = services?.filter((s) => s.is_addon) || [];

  const enableTourBooking =
    startWithTour || settings?.enable_tour_booking === "yes";

  // ═══════════════════════════════════════════════════════
  // SCREEN ROUTING
  // ═══════════════════════════════════════════════════════

  // ── After-hours modal — shown FIRST in passenger mode ───────────────
  if (screen === "afterhours") {
    return (
      <AfterHoursModal
        settings={settings}
        onContinue={() => setScreen("welcome")}
      />
    );
  }

  if (screen === "welcome") {
    return (
      <WelcomeScreen settings={settings} onStart={() => setScreen("intent")} />
    );
  }

  if (screen === "intent") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <IntentSelection
            onBookTrip={() => setScreen("booking")}
            onSendMessage={() => setScreen("message")}
          />
        </div>
      </div>
    );
  }

  if (screen === "message") {
    return (
      <SendMessageScreen
        onBack={() => setScreen("booking")}
        onSuccess={() => setScreen("booking")}
      />
    );
  }

  if (screen === "confirmation") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 space-y-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {isPassengerMode
              ? "Booking Request Has Been Submitted"
              : "Trip Created!"}
          </h1>
          <p className="text-lg text-gray-600">
            {isPassengerMode
              ? "Your request has been received. Once we review it, you will hear back from us."
              : "Trip created successfully. Passenger will be notified."}
          </p>
          {isPassengerMode && settings.business_phone && (
            <p className="text-base text-gray-600">
              Questions? Please call{" "}
              <a
                href={`tel:${settings.business_phone}`}
                className="font-semibold text-purple-600 hover:text-purple-800 underline"
              >
                {settings.business_phone}
              </a>
            </p>
          )}
          {!isPassengerMode && formData.booking_number && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
              <p className="text-sm text-gray-500 mb-1">Booking Number</p>
              <p className="text-2xl font-bold text-gray-900">
                {formData.booking_number}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              if (onSuccess) {
                // Dispatch mode: call success callback to close modal
                onSuccess();
              } else {
                // Passenger mode: reset wizard for another booking
                setScreen("booking");
                setStep(1);
                const resetForm = { ...INITIAL_FORM };
                if (settings?.default_passenger_city) {
                  resetForm.home_city = settings.default_passenger_city;
                  resetForm.city = settings.default_passenger_city;
                }
                if (settings?.default_passenger_state) {
                  resetForm.home_state = settings.default_passenger_state;
                  resetForm.state = settings.default_passenger_state;
                }
                if (settings?.default_passenger_zip) {
                  resetForm.home_zip = settings.default_passenger_zip;
                  resetForm.zip_code = settings.default_passenger_zip;
                }
                setFormData(resetForm);
              }
            }}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-2xl transition-all"
          >
            {isPassengerMode ? "Book Another Trip" : "Done"}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // BOOKING FLOW
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-start justify-center px-4 py-12 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <WizardHeader
            step={step}
            totalSteps={stepsConfig.length}
            steps={stepsConfig}
          />

          {/* Step Content - Now scrollable with ref */}
          <div
            ref={scrollContainerRef}
            className="p-8 max-h-[calc(100vh-300px)] overflow-y-auto"
          >
            <StepCard>
              <div className="min-h-[400px]">
                {step === 1 && (
                  <Step1Name
                    formData={formData}
                    set={set}
                    onNext={handleNext}
                    canProceed={canProceed}
                    lookupType={lookupType}
                    setLookupType={setLookupType}
                    lookupValue={lookupValue}
                    setLookupValue={setLookupValue}
                    lookupStatus={lookupStatus}
                    setLookupStatus={setLookupStatus}
                    lookupMutation={lookupMutation}
                    isPassengerMode={isPassengerMode}
                    allMatches={allMatches}
                    matchIndex={matchIndex}
                    nextMatch={nextMatch}
                    prevMatch={prevMatch}
                  />
                )}

                {step === 2 && (
                  <Step2TripType
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                    enableTourBooking={enableTourBooking}
                  />
                )}

                {step === 3 && (
                  <Step3DateTime
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                  />
                )}

                {/* Step 4 */}
                {step === 4 && !formData.is_tour && (
                  <Step3_5PassengersBaggage
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                  />
                )}
                {step === 4 && formData.is_tour && (
                  <StepTourParticipantType formData={formData} set={set} />
                )}

                {/* Step 5 */}
                {step === 5 && !formData.is_tour && (
                  <Step3_5VehicleType
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                  />
                )}
                {step === 5 && formData.is_tour && (
                  <StepTourParticipants formData={formData} set={set} />
                )}

                {/* Step 6 */}
                {step === 6 && !formData.is_tour && (
                  <Step4Location
                    formData={formData}
                    set={set}
                    preferredLocations={preferredLocations}
                    isPassengerMode={isPassengerMode}
                    services={services}
                  />
                )}
                {step === 6 && formData.is_tour && (
                  <StepTourItinerary formData={formData} set={set} />
                )}

                {/* Step 7 */}
                {step === 7 && !formData.is_tour && (
                  <Step6Details
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                    isAirport={isAirportTrip}
                    addons={isPassengerMode ? addons : []}
                    selectedService={selectedService}
                    settings={settings}
                  />
                )}
                {step === 7 && formData.is_tour && (
                  <StepTourPricing formData={formData} set={set} />
                )}

                {/* Step 8 */}
                {step === 8 && isPassengerMode && !formData.is_tour && (
                  <Step9Review
                    formData={formData}
                    set={set}
                    selectedService={selectedService}
                    addons={addons}
                    validationErrors={validationErrors}
                    isPassengerMode={isPassengerMode}
                    onSubmit={handleSubmit}
                    isSubmitting={submitMutation.isPending}
                  />
                )}
                {step === 8 && !isPassengerMode && !formData.is_tour && (
                  <Step7Addons
                    formData={formData}
                    set={set}
                    addons={addons}
                    isPassengerMode={isPassengerMode}
                    settings={settings}
                  />
                )}
                {step === 8 && formData.is_tour && (
                  <Step4Location
                    formData={formData}
                    set={set}
                    preferredLocations={preferredLocations}
                    isPassengerMode={isPassengerMode}
                    services={services}
                  />
                )}

                {/* Step 9 */}
                {step === 9 && !isPassengerMode && !formData.is_tour && (
                  <Step7_5Pricing
                    formData={formData}
                    set={set}
                    selectedService={selectedService}
                    addons={addons}
                    isPassengerMode={isPassengerMode}
                    ratePerMile={ratePerMile}
                    manualMileage={manualMileage}
                  />
                )}
                {step === 9 && formData.is_tour && (
                  <Step6Details
                    formData={formData}
                    set={set}
                    isPassengerMode={isPassengerMode}
                    isAirport={isAirportTrip}
                    addons={[]}
                    selectedService={selectedService}
                    settings={settings}
                  />
                )}

                {/* Step 10 */}
                {step === 10 && !isPassengerMode && !formData.is_tour && (
                  <Step9Review
                    formData={formData}
                    set={set}
                    selectedService={selectedService}
                    addons={addons}
                    validationErrors={validationErrors}
                    isPassengerMode={isPassengerMode}
                  />
                )}
                {step === 10 && formData.is_tour && (
                  <Step9Review
                    formData={formData}
                    set={set}
                    selectedService={selectedService}
                    addons={addons}
                    validationErrors={validationErrors}
                    isPassengerMode={isPassengerMode}
                  />
                )}

                {/* Step 11 */}
                {step === 11 &&
                  !isPassengerMode &&
                  !isRecurringMode &&
                  !formData.is_tour && (
                    <Step8AdminOptions
                      formData={formData}
                      set={set}
                      drivers={drivers}
                      vehicles={vehicles}
                      isPassengerMode={isPassengerMode}
                      selectedService={selectedService}
                      addons={addons}
                      onSubmit={handleSubmit}
                      onApproveAndSend={handleApproveAndSend}
                      isSubmitting={submitMutation.isPending}
                    />
                  )}
                {step === 11 && isRecurringMode && (
                  <Step8AdminOptions
                    formData={formData}
                    set={set}
                    drivers={drivers}
                    vehicles={vehicles}
                    isPassengerMode={isPassengerMode}
                    selectedService={selectedService}
                    addons={addons}
                  />
                )}
                {step === 11 && formData.is_tour && !isRecurringMode && (
                  <Step8AdminOptions
                    formData={formData}
                    set={set}
                    drivers={drivers}
                    vehicles={vehicles}
                    isPassengerMode={isPassengerMode}
                    selectedService={selectedService}
                    addons={addons}
                    onSubmit={handleSubmit}
                    onApproveAndSend={handleApproveAndSend}
                    isSubmitting={submitMutation.isPending}
                  />
                )}

                {/* Step 12 - Recurring (recurring mode only) */}
                {step === 12 && isRecurringMode && (
                  <Step10Recurring formData={formData} set={set} />
                )}

                {/* Step 13 - Review (recurring mode only) */}
                {step === 13 && isRecurringMode && (
                  <Step9Review
                    formData={formData}
                    set={set}
                    selectedService={selectedService}
                    addons={addons}
                    validationErrors={validationErrors}
                    isPassengerMode={isPassengerMode}
                    isSubmitting={submitMutation.isPending}
                  />
                )}
              </div>
            </StepCard>

            {/* Navigation */}
            <WizardNavigation
              step={step}
              totalSteps={stepsConfig.length}
              onPrev={handlePrev}
              onNext={handleNext}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              canProceed={canProceed}
              isSubmitting={submitMutation.isPending}
              currentStepInfo={currentStepInfo}
              submissionErrorMessage={submissionError}
              validationErrors={validationErrors}
              hideButtons={step === 11 && !isPassengerMode && !isRecurringMode}
            />
          </div>
        </div>

        {/* Confirmation Dialog for Missing Optional Fields */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-12 space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-gray-900">
                  Are you sure?
                </h2>
                <p className="text-lg text-gray-500">
                  You didn't enter any information for:
                </p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 space-y-3">
                {missingFields.map((field, i) => (
                  <p key={i} className="text-center text-gray-700 font-medium">
                    {field}
                  </p>
                ))}
              </div>

              <p className="text-center text-sm text-gray-500">
                We'll follow up to collect these details later.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmSubmit}
                  className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-2xl transition-all shadow-lg"
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Anyway"}
                </button>
                <button
                  onClick={handleCancelConfirm}
                  className="w-full px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-lg font-semibold rounded-2xl transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Prompt: Quote / Send Confirmations (dispatch mode only) */}
        {showSavePrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            {savePromptStep === "quote" ? (
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-full mb-3">
                    <FileText size={28} className="text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Is this a Quote?
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Quotes are saved without sending any notifications to the
                    driver or passenger.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleSavePromptConfirm("quote")}
                    className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText size={18} />
                    Yes — Save as Quote
                  </button>
                  <button
                    onClick={() => setSavePromptStep("confirmations")}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    No — Continue
                  </button>
                  <button
                    onClick={() => setShowSavePrompt(false)}
                    className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
                    <Bell size={28} className="text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Send Confirmations?
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Send notifications to the <strong>driver</strong>{" "}
                    (acceptance link) and <strong>passenger</strong>{" "}
                    (confirmation)?
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => handleSavePromptConfirm(true)}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Bell size={18} />
                    Yes — Send Confirmations
                  </button>
                  <button
                    onClick={() => handleSavePromptConfirm(false)}
                    className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <BellOff size={18} />
                    No — Save & Go to All Trips
                  </button>
                  <button
                    onClick={() => setShowSavePrompt(false)}
                    className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
