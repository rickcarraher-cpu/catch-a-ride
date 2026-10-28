import { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { TripModalHeader } from "./TripModalHeader";
import { TripModalForm } from "./TripModalForm";
import { TripModalFooter } from "./TripModalFooter";
import { ReturnTripPrompt } from "./ReturnTripPrompt";
import { SaveConfirmPrompt } from "./SaveConfirmPrompt";
import {
  IntentSelection,
  AdminBookingFlow,
  BookingTypeChoice,
} from "./AdminBookingFlow";
import { SendMessageForm } from "./SendMessageForm";
import PassengerLookupSection from "./PassengerLookupSection";
import NewPassengerSection from "./NewPassengerSection";
import TripCloneSection from "./TripCloneSection";
import { TransactionsSection } from "./TransactionsSection";
import { DuplicatePassengerWarning } from "./DuplicatePassengerWarning";
import { NewPassengerExistsWarning } from "./NewPassengerExistsWarning";
import { MessagePassengerModal } from "./MessagePassengerModal";
import { useTripForm } from "@/hooks/useTripForm";
import { buildAddress } from "@/utils/addressParser";

// Append the correct America/Chicago UTC offset to a bare "YYYY-MM-DDTHH:MM" string
// so PostgreSQL stores the correct local time instead of treating it as UTC.
// Without this, "2026-06-19T08:00" is stored as 8 AM UTC → displays as 3 AM CDT.
function addChicagoOffset(localStr) {
  if (!localStr) return localStr;

  const datePart = localStr.slice(0, 10);

  // Validate the date string format before proceeding
  if (!/^\d{4}-\d{2}-\d{2}/.test(localStr)) {
    console.error("Invalid date format passed to addChicagoOffset:", localStr);
    return localStr;
  }

  try {
    const probe = new Date(`${datePart}T12:00:00Z`);

    // Validate the date is valid before using formatToParts
    if (isNaN(probe.getTime())) {
      console.error("Invalid date passed to addChicagoOffset:", localStr);
      return localStr;
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(probe);
    const tzName =
      parts.find((p) => p.type === "timeZoneName")?.value || "GMT-05:00";
    const offset = tzName.replace("GMT", ""); // "-05:00" or "-06:00"
    // Only append offset if the string doesn't already have one
    if (localStr.includes("+") || localStr.match(/-\d{2}:\d{2}$/))
      return localStr;
    const withSeconds = localStr.length === 16 ? `${localStr}:00` : localStr;
    return `${withSeconds}${offset}`;
  } catch (err) {
    console.error("Error in addChicagoOffset:", err);
    return localStr;
  }
}

export function TripModal({
  trip,
  prefillData,
  clients,
  drivers,
  services,
  preselectedDriverId,
  onClose,
  onSuccess,
  onBookReturn,
}) {
  const queryClient = useQueryClient();
  const [showReturnPrompt, setShowReturnPrompt] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showSaveConfirmPrompt, setShowSaveConfirmPrompt] = useState(false);
  // Optional fields warning state
  const [showOptionalWarning, setShowOptionalWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'approve-send' | 'save-without-sending'
  const [missingOptional, setMissingOptional] = useState([]);

  // Track if save is in progress to prevent duplicate submissions
  const isSavingRef = useRef(false);
  // Track when "No — Save & Go to All Trips" is chosen so onSuccess can force-close the modal
  const shouldCloseRef = useRef(false);

  // Duplicate passenger detection state (for returning passenger who selected existing)
  const [duplicatePassenger, setDuplicatePassenger] = useState(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // New passenger already exists state (for new passenger flow)
  const [existingPassenger, setExistingPassenger] = useState(null);
  const [showExistsWarning, setShowExistsWarning] = useState(false);

  // Fetch settings for rate_per_mile and business hours
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      return res.json();
    },
    staleTime: 0, // Always fetch fresh settings to ensure business hours are current
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
  const ratePerMile = settings?.rate_per_mile
    ? parseFloat(settings.rate_per_mile)
    : null;

  // Fetch clients with include_inactive when editing a trip
  // Always fetch our own list when editing, so passenger search works
  // regardless of which page opened the modal
  const { data: allClients } = useQuery({
    queryKey: ["clients", { include_inactive: !!trip }],
    queryFn: async () => {
      const url = trip ? "/api/clients?include_inactive=true" : "/api/clients";
      const res = await fetch(url);
      return res.json();
    },
    enabled: !!trip || !clients, // Always fetch when editing a trip, or when no clients prop
  });

  // When editing, prefer our own fetched clients (includes inactive);
  // for new bookings, use provided clients or fetched clients
  const clientsToUse = trip ? allClients || clients : clients || allClients;

  // NEW: Settings update handler for PassengerLookupSection
  const handleSettingsUpdate = async (key, value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update settings");
      }
      // Invalidate settings query to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
    }
  };

  // Admin booking flow state (only for NEW bookings)
  const isNewBooking = !trip && !prefillData;
  const [bookingFlowStep, setBookingFlowStep] = useState(
    isNewBooking ? "intent-selection" : "form",
  );
  // Steps: 'intent-selection' | 'send-message' | 'initial' | 'booking-type' | 'passenger-lookup' | 'new-passenger' | 'trip-clone' | 'form'
  const [isReturningPassenger, setIsReturningPassenger] = useState(false);

  const { formData, setFormData, isAirportTrip, isReturnTrip } = useTripForm({
    trip,
    prefillData,
    preselectedDriverId,
    services,
  });

  // Calculate trip price from services for TransactionsSection
  const tripPrice = Math.ceil(
    formData.services?.reduce(
      (sum, s) => sum + Number(s.service_price) * (Number(s.quantity) || 1),
      0,
    ) || 0,
  );

  // ── Intent Selection Handlers ──────────────────────────────────────────────
  const handleBookTrip = () => {
    setBookingFlowStep("initial");
  };

  const handleSendMessage = () => {
    setBookingFlowStep("send-message");
  };

  const handleBackToIntent = () => {
    setBookingFlowStep("intent-selection");
  };

  // ── Admin Flow Handlers ────────────────────────────────────────────────────
  const handleNewPassenger = () => {
    setIsReturningPassenger(false);
    setBookingFlowStep("new-passenger");
  };

  const handleReturningPassenger = () => {
    setIsReturningPassenger(true);
    setBookingFlowStep("passenger-lookup");
  };

  const handleNewBookingChoice = () => {
    setBookingFlowStep("passenger-lookup");
  };

  const handleCloneTripChoice = () => {
    setBookingFlowStep("trip-clone");
  };

  const handleSelectPassenger = (client) => {
    // Check if user chose "New Passenger" flow but selected an existing passenger
    if (!isReturningPassenger && client && client.id) {
      setDuplicatePassenger(client);
      setShowDuplicateWarning(true);
      return;
    }

    const updates = { ...formData, client_id: client.id };
    // Prefill pickup address from passenger's home address (not destination)
    if (client.address && !formData.pickup_address) {
      updates.pickup_address = client.address;
      updates._pickup_prefilled = true;
    }
    // Also populate structured pickup fields from client address components
    if (client.street_address && !formData.pickup_street) {
      updates.pickup_street = client.street_address;
      updates.pickup_city = client.city;
      updates.pickup_state = client.state;
      updates.pickup_zip = client.zip_code;
      updates._pickup_prefilled = true;
    }
    setFormData(updates);
    setBookingFlowStep("form");
    toast.success(
      `Passenger ${client.name} selected — pickup pre-filled from home address`,
    );
  };

  const handleUseDuplicatePassenger = () => {
    // User chose to use the existing passenger
    const client = duplicatePassenger;
    const updates = { ...formData, client_id: client.id };
    if (client.address && !formData.pickup_address) {
      updates.pickup_address = client.address;
      updates._pickup_prefilled = true;
    }
    if (client.street_address && !formData.pickup_street) {
      updates.pickup_street = client.street_address;
      updates.pickup_city = client.city;
      updates.pickup_state = client.state;
      updates.pickup_zip = client.zip_code;
      updates._pickup_prefilled = true;
    }
    setFormData(updates);
    setShowDuplicateWarning(false);
    setDuplicatePassenger(null);
    setBookingFlowStep("form");
    toast.success(`Using existing passenger ${client.name}`);
  };

  const handleContinueAnyway = () => {
    // User chose to create a new record anyway
    setShowDuplicateWarning(false);
    const client = duplicatePassenger;
    const updates = { ...formData, client_id: client.id };
    if (client.address && !formData.pickup_address) {
      updates.pickup_address = client.address;
      updates._pickup_prefilled = true;
    }
    if (client.street_address && !formData.pickup_street) {
      updates.pickup_street = client.street_address;
      updates.pickup_city = client.city;
      updates.pickup_state = client.state;
      updates.pickup_zip = client.zip_code;
      updates._pickup_prefilled = true;
    }
    setFormData(updates);
    setBookingFlowStep("form");
    setDuplicatePassenger(null);
    toast.info("Continuing with existing passenger record");
  };

  const handleCloseDuplicateWarning = () => {
    setShowDuplicateWarning(false);
    setDuplicatePassenger(null);
  };

  const handlePassengerExists = (passenger) => {
    // New passenger tried to be created but already exists
    setExistingPassenger(passenger);
    setShowExistsWarning(true);
  };

  const handleGoToBookingType = () => {
    // Close the exists warning and go to booking type selection
    setShowExistsWarning(false);
    setExistingPassenger(null);
    setBookingFlowStep("booking-type");
  };

  const handleCloseExistsWarning = () => {
    setShowExistsWarning(false);
    setExistingPassenger(null);
  };

  const handleSelectTrip = async (tripData, options = {}) => {
    // Clone all trip details — keep every field from the original trip.
    // Only clear start_time (user must pick new date/time).
    // Preserve original status (e.g. "quote") instead of resetting to "pending".
    let otherNotes = "";
    if (tripData.notes) {
      const lines = tripData.notes.split("\n");
      for (const line of lines) {
        if (line.startsWith("Pickup: ") || line.startsWith("Dropoff: ")) {
          // Strip embedded address lines from notes — addresses are stored in dedicated fields
          continue;
        }
        otherNotes += (otherNotes ? "\n" : "") + line;
      }
    }

    // NEW: Fetch passenger's home address if HOME options are selected
    let homeAddress = null;
    if (options.useHomeForPickup || options.useHomeForDropoff) {
      try {
        const clientRes = await fetch(`/api/clients/${tripData.client_id}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          homeAddress = {
            street: clientData.street_address || "",
            city: clientData.city || "",
            state: clientData.state || "",
            zip: clientData.zip_code || "",
          };
        }
      } catch (err) {
        console.error("Failed to fetch passenger home address:", err);
        toast.error("Could not load passenger home address");
      }
    }

    // Determine pickup address based on HOME option
    const pickupStreet =
      options.useHomeForPickup && homeAddress
        ? homeAddress.street
        : tripData.pickup_street || tripData.pickup_address || "";
    const pickupCity =
      options.useHomeForPickup && homeAddress
        ? homeAddress.city
        : tripData.pickup_city || "";
    const pickupState =
      options.useHomeForPickup && homeAddress
        ? homeAddress.state
        : tripData.pickup_state || "";
    const pickupZip =
      options.useHomeForPickup && homeAddress
        ? homeAddress.zip
        : tripData.pickup_zip || "";

    // Determine dropoff address based on HOME option
    const dropoffStreet =
      options.useHomeForDropoff && homeAddress
        ? homeAddress.street
        : tripData.dropoff_street || tripData.dropoff_address || "";
    const dropoffCity =
      options.useHomeForDropoff && homeAddress
        ? homeAddress.city
        : tripData.dropoff_city || "";
    const dropoffState =
      options.useHomeForDropoff && homeAddress
        ? homeAddress.state
        : tripData.dropoff_state || "";
    const dropoffZip =
      options.useHomeForDropoff && homeAddress
        ? homeAddress.zip
        : tripData.dropoff_zip || "";

    setFormData({
      // Clone tracking flags — cleared on first location edit
      _isClone: true,
      _clonedPickup: true,
      _clonedDropoff: true,
      client_id: tripData.client_id || "",
      employee_id: tripData.employee_id || "",
      vehicle_id: tripData.vehicle_id || "",
      start_time: "", // Must pick new date/time
      status: tripData.status || "pending",
      booked_by: "Admin",
      booker_name: tripData.booker_name || "",
      notes: otherNotes,
      driver_notes: tripData.driver_notes || "",
      is_tentative: false,
      tentative_reason: "",
      num_people: tripData.num_people || "",
      num_bags_checked: tripData.num_bags_checked ?? "",
      num_bags_carry_on: tripData.num_bags_carry_on ?? "",
      num_golf_bags: tripData.num_golf_bags ?? "",
      num_car_seats: tripData.num_car_seats ?? "",
      outgoing_flight_info: tripData.outgoing_flight_info || "",
      returning_flight_info: tripData.returning_flight_info || "",
      is_international_flight: tripData.is_international_flight || false,
      customs_clearance_location: tripData.customs_clearance_location || "",
      return_date: "",
      destination: tripData.destination || "",
      payment_method: tripData.payment_method || "",
      requested_driver_name: tripData.requested_driver_name || "",
      // Use HOME address or clone pickup address fields
      pickup_address: tripData.pickup_address || "",
      pickup_street: pickupStreet,
      pickup_city: pickupCity,
      pickup_state: pickupState,
      pickup_zip: pickupZip,
      // Use HOME address or clone dropoff address fields
      dropoff_address: tripData.dropoff_address || "",
      dropoff_street: dropoffStreet,
      dropoff_city: dropoffCity,
      dropoff_state: dropoffState,
      dropoff_zip: dropoffZip,
      // Clone distance
      distance_miles: tripData.distance_miles || null,
      // Clone services with all details including stop_description
      services:
        (tripData.appointment_services || tripData.services)?.map((s) => ({
          service_id: s.service_id,
          service_name: s.service_name || "",
          service_price: s.service_price,
          duration_minutes: s.duration_minutes,
          quantity: s.quantity || 1,
          stop_description: s.stop_description || "",
        })) || [],
    });
    setBookingFlowStep("form");

    // Build success message with HOME address info
    let successMsg = `Trip #${tripData.booking_number || tripData.id} cloned`;
    if (options.useHomeForPickup && options.useHomeForDropoff) {
      successMsg += " with HOME for pickup & dropoff";
    } else if (options.useHomeForPickup) {
      successMsg += " with HOME for pickup";
    } else if (options.useHomeForDropoff) {
      successMsg += " with HOME for dropoff";
    }
    successMsg += " — set a new date/time, review all fields, and save";

    toast.success(successMsg);
  };

  const handleSkipLookup = () => {
    setBookingFlowStep("new-passenger");
  };

  const handlePassengerCreated = (client) => {
    const updates = { ...formData, client_id: client.id };
    // Prefill pickup address from passenger's home address
    if (client.address && !formData.pickup_address) {
      updates.pickup_address = client.address;
      updates._pickup_prefilled = true;
    }
    // Also populate structured pickup fields from client address components
    if (client.street_address && !formData.pickup_street) {
      updates.pickup_street = client.street_address;
      updates.pickup_city = client.city;
      updates.pickup_state = client.state;
      updates.pickup_zip = client.zip_code;
      updates._pickup_prefilled = true;
    }
    setFormData(updates);
    setBookingFlowStep("form");
  };

  const handleBackToInitial = () => {
    setBookingFlowStep("intent-selection");
    setIsReturningPassenger(false);
  };

  const handleBackToBookingType = () => {
    setBookingFlowStep("initial");
  };

  const handleBackToPassengerLookup = () => {
    setBookingFlowStep("passenger-lookup");
  };

  const handleMessagePassenger = () => {
    if (!formData.client_id) {
      toast.error("No passenger selected for this trip");
      return;
    }
    setShowMessageModal(true);
  };

  // Get current client data for the message modal
  const currentClient = clientsToUse?.find((c) => c.id === formData.client_id);

  // ── Validation helpers ─────────────────────────────────────────────────────
  const validateRequired = () => {
    const missing = [];
    if (!formData.client_id) missing.push("Passenger");
    if (!formData.start_time) missing.push("Date & Time");
    // vehicle_category is only required for new trips; existing trips may predate this field
    if (!trip && !formData.vehicle_category) missing.push("Vehicle Preference");
    if (missing.length > 0) {
      toast.error(`Please fill in required fields: ${missing.join(", ")}`);
      return false;
    }
    return true;
  };

  const getOptionalMissing = () => {
    const missing = [];
    if (!formData.employee_id) missing.push("Driver");
    if (!formData.payment_method) missing.push("Payment Method");
    if (!formData.services || formData.services.length === 0)
      missing.push("Services");
    return missing;
  };

  const applyReturnTripFix = () => {
    const isRt =
      formData.notes && formData.notes.toLowerCase().includes("return trip");
    if (isRt && formData.return_date) {
      setFormData((prev) => ({ ...prev, return_date: "" }));
    }
  };

  // ── Approve & Send Confirmations (one-click) ───────────────────────────────
  const handleApproveAndSend = () => {
    if (!validateRequired()) return;
    applyReturnTripFix();
    const missing = getOptionalMissing();
    if (missing.length > 0) {
      setMissingOptional(missing);
      setPendingAction("approve-send");
      setShowOptionalWarning(true);
      return;
    }
    mutation.mutate({
      ...formData,
      status: "approved",
      send_notification: true,
    });
  };

  // ── Save Without Sending (shows existing two-step prompt) ─────────────────
  const handleSave = () => {
    // Prevent double-submit if mutation is already in progress
    if (mutation.isPending) {
      console.log(
        "[TripModal] Save already in progress, ignoring duplicate click",
      );
      return;
    }

    if (!validateRequired()) return;
    applyReturnTripFix();

    // For edits: skip ALL prompts and save directly without sending
    if (trip) {
      console.log(
        "[TripModal] Editing existing trip - saving without notification",
      );
      console.log("[TripModal] Form data:", formData);
      shouldCloseRef.current = false;
      mutation.mutate({ ...formData, send_notification: false });
      return;
    }

    const missing = getOptionalMissing();
    if (missing.length > 0) {
      setMissingOptional(missing);
      setPendingAction("save-without-sending");
      setShowOptionalWarning(true);
      return;
    }
    setShowSaveConfirmPrompt(true);
  };

  // ── Optional warning handlers ──────────────────────────────────────────────
  const handleOptionalWarningContinue = () => {
    setShowOptionalWarning(false);
    const action = pendingAction;
    setPendingAction(null);
    setMissingOptional([]);
    if (action === "approve-send") {
      mutation.mutate({
        ...formData,
        status: "approved",
        send_notification: true,
      });
    } else if (trip) {
      // For edits: save directly without prompt or redirect
      shouldCloseRef.current = false;
      mutation.mutate({ ...formData, send_notification: false });
    } else {
      setShowSaveConfirmPrompt(true);
    }
  };

  const handleOptionalWarningCancel = () => {
    setShowOptionalWarning(false);
    setPendingAction(null);
    setMissingOptional([]);
  };

  const handleConfirmSave = (sendNotification) => {
    // Prevent multiple submissions if mutation is already in progress
    if (mutation.isPending) {
      console.log("Mutation already in progress, ignoring duplicate call");
      return;
    }

    setShowSaveConfirmPrompt(false);

    if (sendNotification === "quote") {
      // Save as quote — no notifications, status set to "quote"
      shouldCloseRef.current = true; // quotes should always close the modal
      mutation.mutate({
        ...formData,
        status: "quote",
        send_notification: false,
      });
    } else {
      // "No — Save & Go to All Trips" passes false → force close
      // "Yes — Send Confirmations" passes true → let page decide (re-fetch)
      shouldCloseRef.current = sendNotification === false;
      mutation.mutate({ ...formData, send_notification: sendNotification });
    }
  };

  const handleCancelSave = () => {
    setShowSaveConfirmPrompt(false);
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Strip internal UI flags before sending to API
      const {
        _pickup_prefilled,
        save_as_home_address,
        _isClone,
        _clonedPickup,
        _clonedDropoff,
        ...cleanData
      } = data;

      // Build pickup_address and dropoff_address from structured fields
      const pickup_address =
        data.pickup_street ||
        data.pickup_city ||
        data.pickup_state ||
        data.pickup_zip
          ? buildAddress({
              street_address: data.pickup_street,
              city: data.pickup_city,
              state: data.pickup_state,
              zip_code: data.pickup_zip,
            })
          : data.pickup_address || "";

      const dropoff_address =
        data.dropoff_street ||
        data.dropoff_city ||
        data.dropoff_state ||
        data.dropoff_zip
          ? buildAddress({
              street_address: data.dropoff_street,
              city: data.dropoff_city,
              state: data.dropoff_state,
              zip_code: data.dropoff_zip,
            })
          : data.dropoff_address || "";

      // Build notes with stop descriptions appended
      let finalNotes = cleanData.notes || "";
      if (cleanData.services) {
        cleanData.services.forEach((service) => {
          if (service.stop_description?.trim()) {
            const serviceDef = services?.find(
              (s) => s.id == service.service_id,
            );
            const label = serviceDef?.name || "Additional Stop";
            if (finalNotes) finalNotes += "\n";
            finalNotes += `${label}: ${service.stop_description.trim()}`;
          }
        });
      }

      // If this is a return trip, force return_date to null — return trips cannot have their own return date
      const notesLower = (finalNotes || "").toLowerCase();
      const isReturnTrip = notesLower.includes("return trip");
      const finalReturnDate = isReturnTrip ? null : cleanData.return_date;

      console.log("Saving trip with data:", cleanData);
      console.log("Return flight info:", cleanData.returning_flight_info);
      console.log("Return date:", finalReturnDate);
      console.log("Is return trip (clearing return_date):", isReturnTrip);
      console.log("Pickup address (built):", pickup_address);
      console.log("Dropoff address (built):", dropoff_address);
      console.log("Destination:", cleanData.destination);
      console.log("Send notification:", cleanData.send_notification);

      const url = trip ? `/api/appointments/${trip.id}` : "/api/appointments";
      const method = trip ? "PATCH" : "POST";

      console.log(`[TripModal] ${method} ${url}`);

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cleanData,
          notes: finalNotes,
          pickup_address,
          dropoff_address,
          start_time: addChicagoOffset(cleanData.start_time),
          return_date: isReturnTrip
            ? null
            : addChicagoOffset(cleanData.return_date),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[TripModal] Save failed:", err);
        throw new Error(err.error || "Failed to save trip");
      }

      const result = await res.json();

      // If "Save as passenger home address" is checked, update the client record
      if (save_as_home_address && data.client_id && pickup_address) {
        try {
          await fetch(`/api/clients/${data.client_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              address: pickup_address,
              street_address: data.pickup_street || null,
              city: data.pickup_city || null,
              state: data.pickup_state || null,
              zip_code: data.pickup_zip || null,
            }),
          });
          toast.info("Passenger home address updated ✓");
        } catch (err) {
          console.error("Failed to update passenger home address:", err);
        }
      }

      console.log("Server response:", result);
      console.log("Distance from server:", result.distance_miles);
      return result;
    },
    onSuccess: async (result) => {
      console.log("[TripModal] Save successful, invalidating queries");

      // Force immediate refetch of appointments to show changes right away
      await queryClient.invalidateQueries({
        queryKey: ["appointments"],
        refetchType: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["appointments"],
        type: "active",
      });

      // Only update formData with new distance when EDITING an existing trip
      if (trip && result?.distance_miles != null) {
        setFormData((prev) => ({
          ...prev,
          distance_miles: result.distance_miles,
        }));
      }

      // Show distance toast if it was recalculated server-side
      if (result?.distance_recalculated) {
        toast.info(
          `Distance updated: ${Number(result.distance_miles).toFixed(1)} miles`,
          { duration: 4000 },
        );
      }

      toast.success(
        trip ? "Trip updated successfully ✓" : "Trip created successfully ✓",
      );

      // Show notification delivery results so admin can see if SMS worked
      if (result?.notification_results) {
        const nr = result.notification_results;
        if (nr.error) {
          toast.error(`Notifications failed: ${nr.error}`, { duration: 6000 });
        } else {
          const sent = [];
          if (nr.passenger?.email === "sent") sent.push("📧 Passenger email");
          if (nr.passenger?.sms === "sent") sent.push("📱 Passenger SMS");
          if (nr.driver?.email === "sent") sent.push("📧 Driver email");
          if (nr.driver?.sms === "sent") sent.push("📱 Driver SMS");
          if (nr.office?.email === "sent") sent.push("📧 Office email");

          const failed = [];
          if (nr.passenger?.sms === "failed") failed.push("Passenger SMS");
          if (nr.driver?.sms === "failed") failed.push("Driver SMS");
          if (nr.passenger?.email === "failed") failed.push("Passenger email");
          if (nr.driver?.email === "failed") failed.push("Driver email");

          if (sent.length > 0) {
            toast.info(`Sent: ${sent.join(", ")}`, { duration: 5000 });
          }
          if (failed.length > 0) {
            // Build a specific reason from the backend response
            const smsReason =
              nr.passenger?.sms_reason || nr.driver?.sms_reason || null;
            const reasonText = smsReason
              ? ` — ${smsReason}`
              : " — check Settings → SMS Provider";
            toast.error(`⚠️ Failed: ${failed.join(", ")}${reasonText}`, {
              duration: 10000,
            });
          }
        }
      }

      // Show return trip prompt logic
      if (!trip && formData.return_date && onBookReturn) {
        setShowReturnPrompt(true);
      } else {
        // Pass forceClose flag so the parent page can close modal when "Save Without Sending" was chosen
        onSuccess(shouldCloseRef.current);
      }
    },
    onError: (err) => {
      console.error("[TripModal] Save error:", err);
      toast.error(err.message || "Failed to save trip");
    },
  });

  // ── Known destination → structured address resolver ────────────────────────
  const resolveKnownDestination = (destination) => {
    if (!destination) return null;
    const d = destination.toLowerCase().trim();
    if (
      d === "bna" ||
      d === "bna airport" ||
      d === "nashville international airport" ||
      d === "nashville airport"
    ) {
      return {
        street: "1 Terminal Dr",
        city: "Nashville",
        state: "TN",
        zip: "37214",
      };
    }
    if (d === "the farm") {
      return {
        street: "732 Rock Springs Rd",
        city: "Castalian Springs",
        state: "TN",
        zip: "",
      };
    }
    if (d === "downtown") {
      return {
        street: "501 Broadway",
        city: "Nashville",
        state: "TN",
        zip: "37203",
      };
    }
    return null;
  };

  const buildReturnPrefill = () => {
    // For the return trip pickup: use original dropoff structured fields.
    // If those are empty but destination is a known keyword, resolve it to an address.
    // If still empty, fall back to the flat dropoff_address string in the street field.
    const resolvedDest =
      !formData.dropoff_street && formData.destination
        ? resolveKnownDestination(formData.destination)
        : null;

    const returnPickupStreet =
      formData.dropoff_street ||
      resolvedDest?.street ||
      formData.dropoff_address ||
      formData.destination ||
      "";
    const returnPickupCity = formData.dropoff_city || resolvedDest?.city || "";
    const returnPickupState =
      formData.dropoff_state || resolvedDest?.state || "";
    const returnPickupZip = formData.dropoff_zip || resolvedDest?.zip || "";

    // For the return trip dropoff: use original pickup structured fields.
    // If those are empty, fall back to the flat pickup_address string in the street field.
    const returnDropoffStreet =
      formData.pickup_street || formData.pickup_address || "";
    const returnDropoffCity = formData.pickup_city || "";
    const returnDropoffState = formData.pickup_state || "";
    const returnDropoffZip = formData.pickup_zip || "";

    return {
      client_id: formData.client_id,
      employee_id: "",
      vehicle_id: "",
      start_time: formData.return_date || "",
      status: "pending",
      booked_by: formData.booked_by,
      booker_name: formData.booker_name,
      notes: "Return trip",
      driver_notes: "",
      is_tentative: false,
      tentative_reason: "",
      num_people: formData.num_people,
      num_bags_checked: formData.num_bags_checked,
      num_bags_carry_on: formData.num_bags_carry_on,
      num_golf_bags: formData.num_golf_bags,
      num_car_seats: formData.num_car_seats,
      // FIX: The return trip is an ARRIVAL (airport → home).
      // The incoming/returning flight info describes the flight arriving back,
      // which is exactly what the return trip needs in returning_flight_info.
      // Do NOT swap it to outgoing_flight_info — that causes it to disappear
      // because FlightInfoSection looks at returning_flight_info for arrival trips.
      // Preserve both fields as-is so the return trip has the correct incoming flight.
      outgoing_flight_info: formData.outgoing_flight_info || "",
      returning_flight_info: formData.returning_flight_info || "",
      return_date: "",
      payment_method: formData.payment_method || "",
      // ✅ Return trip MUST have same distance as outgoing trip (same route, reversed)
      distance_miles: formData.distance_miles || null,
      // Pickup = original dropoff (resolved from destination keyword if needed)
      pickup_address: formData.dropoff_address || formData.destination || "",
      pickup_street: returnPickupStreet,
      pickup_city: returnPickupCity,
      pickup_state: returnPickupState,
      pickup_zip: returnPickupZip,
      // Dropoff = original pickup (home address)
      dropoff_address: formData.pickup_address || "",
      dropoff_street: returnDropoffStreet,
      dropoff_city: returnDropoffCity,
      dropoff_state: returnDropoffState,
      dropoff_zip: returnDropoffZip,
      // Destination is not relevant on return trips
      destination: "",
      // ✅ Clone services with exact same price AND duration (drive time × 2 is already stored in duration_minutes)
      // Return trip drives the same route backwards, so duration should match the outgoing trip
      services: formData.services.map((s) => ({
        service_id: s.service_id,
        service_name: s.service_name || "",
        service_price: s.service_price,
        duration_minutes: s.duration_minutes, // Same drive time × 2 as outgoing
        quantity: s.quantity || 1,
        stop_description: s.stop_description || "",
      })),
    };
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {showDuplicateWarning && duplicatePassenger && (
          <DuplicatePassengerWarning
            duplicatePassenger={duplicatePassenger}
            onUseDuplicate={handleUseDuplicatePassenger}
            onContinueAnyway={handleContinueAnyway}
            onClose={handleCloseDuplicateWarning}
          />
        )}

        {showExistsWarning && existingPassenger && (
          <NewPassengerExistsWarning
            existingPassenger={existingPassenger}
            onGoToBookingType={handleGoToBookingType}
            onClose={handleCloseExistsWarning}
          />
        )}

        {showSaveConfirmPrompt && (
          <SaveConfirmPrompt
            isEditing={!!trip}
            onConfirm={handleConfirmSave}
            onCancel={handleCancelSave}
          />
        )}

        {/* Optional fields warning dialog */}
        {showOptionalWarning && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-100 rounded-full mb-3">
                  <span className="text-2xl">⚠️</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Some fields are incomplete
                </h3>
                <p className="text-sm text-gray-600 mt-2">
                  The following optional fields are missing:
                </p>
                <ul className="mt-3 space-y-1">
                  {missingOptional.map((field) => (
                    <li
                      key={field}
                      className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5"
                    >
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={handleOptionalWarningContinue}
                  className="w-full px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Continue Anyway
                </button>
                <button
                  onClick={handleOptionalWarningCancel}
                  className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Go Back &amp; Fix
                </button>
              </div>
            </div>
          </div>
        )}

        {showReturnPrompt && (
          <ReturnTripPrompt
            trip={trip}
            returnDate={formData.return_date}
            onDecline={() => onSuccess()}
            onAccept={() => onBookReturn(buildReturnPrefill())}
          />
        )}

        {showMessageModal && (
          <MessagePassengerModal
            client={currentClient}
            trip={trip}
            onClose={() => setShowMessageModal(false)}
          />
        )}

        {/* ── Intent Selection (first step for new bookings) ────────────────── */}
        {bookingFlowStep === "intent-selection" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <IntentSelection
              onBookTrip={handleBookTrip}
              onSendMessage={handleSendMessage}
            />
          </>
        )}

        {/* ── Send Message Flow ──────────────────────────────────────────────── */}
        {bookingFlowStep === "send-message" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <SendMessageForm
              onBack={handleBackToIntent}
              onSuccess={onSuccess}
            />
          </>
        )}

        {/* ── Admin Booking Flow (only for new bookings) ────────────────────── */}
        {bookingFlowStep === "initial" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <AdminBookingFlow
              onNewPassenger={handleNewPassenger}
              onReturningPassenger={handleReturningPassenger}
              onCloneTrip={handleCloneTripChoice}
            />
          </>
        )}

        {bookingFlowStep === "booking-type" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <BookingTypeChoice
              onNewBooking={handleNewBookingChoice}
              onCloneTrip={handleCloneTripChoice}
              onBack={handleBackToInitial}
            />
          </>
        )}

        {bookingFlowStep === "passenger-lookup" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <PassengerLookupSection
              clients={clientsToUse}
              onSelectPassenger={handleSelectPassenger}
              onSkip={handleSkipLookup}
              onBack={handleBackToBookingType}
              settings={settings}
              onSettingsUpdate={handleSettingsUpdate}
              isEditMode={!!trip} // Pass true when editing an existing trip
            />
          </>
        )}

        {bookingFlowStep === "new-passenger" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <NewPassengerSection
              clients={clientsToUse}
              onPassengerCreated={handlePassengerCreated}
              onPassengerExists={handlePassengerExists}
              onBack={handleBackToPassengerLookup}
              isOnlineBooking={false}
              settings={settings}
            />
          </>
        )}

        {bookingFlowStep === "trip-clone" && (
          <>
            <TripModalHeader
              isEditing={false}
              isTentative={false}
              onClose={onClose}
            />
            <TripCloneSection
              onSelectTrip={handleSelectTrip}
              onSkip={handleSkipLookup}
              onBack={handleBackToBookingType}
            />
          </>
        )}

        {/* ── Main Trip Form ────────────────────────────────────────────────── */}
        {bookingFlowStep === "form" && (
          <>
            <TripModalHeader
              isEditing={!!trip}
              isTentative={formData.is_tentative}
              bookingNumber={trip?.booking_number}
              startTime={trip?.start_time}
              displayLongDate={trip?.display_long_date}
              passengerConfirmed={trip?.passenger_confirmed}
              driverAccepted={trip?.driver_accepted}
              tripStatus={trip?.status}
              lastModifiedBy={trip?.last_modified_by}
              weddingId={trip?.wedding_id || formData.wedding_id}
              onClose={onClose}
            />

            <TripModalForm
              formData={formData}
              setFormData={setFormData}
              clients={clientsToUse}
              drivers={drivers}
              services={services}
              isAirportTrip={isAirportTrip}
              isReturnTrip={isReturnTrip}
              trip={trip}
              tripPrice={tripPrice}
              ratePerMile={ratePerMile}
              settings={settings}
            />

            <TripModalFooter
              formData={formData}
              setFormData={setFormData}
              isEditing={!!trip}
              isSaving={mutation.isPending}
              onCancel={onClose}
              onSave={handleSave}
              onApproveAndSend={handleApproveAndSend}
              tripId={trip?.id}
              onMessagePassenger={handleMessagePassenger}
              trip={trip}
            />
          </>
        )}
      </div>
    </div>
  );
}
