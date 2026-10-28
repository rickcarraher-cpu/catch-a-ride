import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  UserCheck,
  UserPlus,
  Phone,
  Mail,
  CheckCircle2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Search,
  FileText,
  Loader2,
  ArrowRight,
  Calendar,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";

const CITY_ZIP_MAP = {
  hendersonville: "37075",
  gallatin: "37066",
  whitehouse: "37188",
  "white house": "37188",
  goodlettsville: "37072",
  goodletsville: "37072",
  portland: "37148",
  madison: "37155",
  springfield: "37172",
  greenbrier: "37073",
};

export function Step1Name({
  formData,
  set,
  onNext,
  canProceed,
  lookupType,
  setLookupType,
  lookupValue,
  setLookupValue,
  lookupStatus,
  setLookupStatus,
  lookupMutation,
  isPassengerMode = false,
  allMatches = [],
  matchIndex = 0,
  nextMatch,
  prevMatch,
  onMatchChange,
}) {
  const [travelChoice, setTravelChoice] = useState(null); // null | 'yes' | 'no'
  const [showEditPrompt, setShowEditPrompt] = useState(false); // Show "want to change?" prompt
  const [isEditing, setIsEditing] = useState(false); // User chose to edit

  // In passenger mode: skip "Have you travelled before?" — go straight to phone lookup
  useEffect(() => {
    if (isPassengerMode && travelChoice === null) {
      setTravelChoice("yes");
      // Force phone-only lookup in passenger mode
      if (setLookupType) setLookupType("phone");
    }
  }, [isPassengerMode]);

  // In passenger mode, always keep lookup type as phone
  useEffect(() => {
    if (isPassengerMode && lookupType !== "phone") {
      setLookupType("phone");
    }
  }, [isPassengerMode, lookupType]);

  // Clone trip state - supports both booking number and name search
  const [cloneMode, setCloneMode] = useState(false);
  const [cloneSearchMode, setCloneSearchMode] = useState("passenger"); // 'passenger' | 'number'
  const [cloneBookingNumber, setCloneBookingNumber] = useState("");
  const [cloneNameSearch, setCloneNameSearch] = useState("");
  const [cloneMatchedPassenger, setCloneMatchedPassenger] = useState(null);
  const [cloneAllTrips, setCloneAllTrips] = useState([]);
  const [cloneSelectedTrip, setCloneSelectedTrip] = useState(null);

  // Clone lookup by booking number
  const cloneLookupMutation = useMutation({
    mutationFn: async (number) => {
      const res = await fetch(
        `/api/appointments/lookup?booking_number=${encodeURIComponent(number)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to look up booking");
      return res.json();
    },
    onSuccess: (data) => {
      if (data) {
        if (data.status === "deleted") {
          toast.error("That trip has been deleted and cannot be cloned.");
          return;
        }
        setCloneSelectedTrip(data);
      } else {
        toast.error("No booking found with that number");
      }
    },
    onError: () => {
      toast.error("Failed to look up booking");
    },
  });

  // Clone lookup by passenger name
  const cloneNameSearchMutation = useMutation({
    mutationFn: async (query) => {
      const clientsRes = await fetch(
        `/api/clients?search=${encodeURIComponent(query)}`,
      );
      if (!clientsRes.ok) throw new Error("Failed to search clients");
      const clientsData = await clientsRes.json();
      const q = query.toLowerCase();
      const digits = query.replace(/\D/g, "");
      const matchingClients = (clientsData || []).filter((c) => {
        // Exclude inactive clients from clone search
        if (c.is_active === false) return false;
        if (c.name && c.name.toLowerCase().includes(q)) return true;
        if (c.email && c.email.toLowerCase().includes(q)) return true;
        if (digits.length >= 3 && c.phone) {
          const clientDigits = c.phone.replace(/\D/g, "");
          if (clientDigits.includes(digits)) return true;
        }
        return false;
      });
      if (matchingClients.length === 0) return { passenger: null, trips: [] };
      const client = matchingClients[0];
      const tripsRes = await fetch(`/api/clients/${client.id}/appointments`);
      if (!tripsRes.ok) throw new Error("Failed to fetch passenger trips");
      const allTrips = await tripsRes.json();
      const activeTrips = allTrips.filter((t) => t.status !== "deleted");
      return {
        passenger: { id: client.id, name: client.name },
        trips: activeTrips.sort(
          (a, b) => new Date(b.start_time) - new Date(a.start_time),
        ),
      };
    },
    onSuccess: (data) => {
      if (!data.passenger) {
        toast.error("No passenger found");
        return;
      }
      setCloneMatchedPassenger(data.passenger);
      setCloneAllTrips(data.trips);
      if (data.trips.length === 0) {
        toast("Passenger found, but no trips on record.");
      } else {
        toast.success(
          `Found ${data.trips.length} trip(s) for ${data.passenger.name}`,
        );
      }
    },
    onError: () => {
      toast.error("Search failed. Please try again.");
    },
  });

  const handleCloneTrip = (tripData) => {
    // Parse notes to extract other notes (skip Pickup:/Dropoff: lines)
    let otherNotes = "";
    if (tripData.notes) {
      const lines = tripData.notes.split("\n");
      for (const line of lines) {
        if (!line.startsWith("Pickup: ") && !line.startsWith("Dropoff: ")) {
          otherNotes += (otherNotes ? "\n" : "") + line;
        }
      }
    }

    // Services may come as appointment_services or services depending on the API
    const tripServices =
      tripData.appointment_services || tripData.services || [];

    // Pre-fill all form data from the cloned trip
    set({
      // Passenger info
      name: tripData.client_name || "",
      phone: tripData.client_phone || "",
      email: tripData.client_email || "",
      notification_preference:
        tripData.client_notification_preference || "both",
      client_id: tripData.client_id || null,

      // Trip details
      service_id: tripServices[0]?.service_id || "",
      service_price: tripServices[0]?.service_price || "",

      // Locations
      pickup: tripData.pickup_address || "",
      pickup_street: tripData.pickup_street || "",
      pickup_city: tripData.pickup_city || "",
      pickup_state: tripData.pickup_state || "",
      pickup_zip: tripData.pickup_zip || "",
      dropoff: tripData.dropoff_address || "",
      dropoff_street: tripData.dropoff_street || "",
      dropoff_city: tripData.dropoff_city || "",
      dropoff_state: tripData.dropoff_state || "",
      dropoff_zip: tripData.dropoff_zip || "",
      destination: tripData.destination || "",
      distance_miles: tripData.distance_miles || null,

      // Passenger details
      num_people: tripData.num_people || "",
      num_bags_checked: tripData.num_bags_checked || "",
      num_bags_carry_on: tripData.num_bags_carry_on || "",
      num_car_seats: tripData.num_car_seats || "",
      num_golf_bags: tripData.num_golf_bags || "",

      // Flight info
      outgoing_flight_info: tripData.outgoing_flight_info || "",
      returning_flight_info: tripData.returning_flight_info || "",
      is_international_flight: tripData.is_international_flight || false,
      customs_clearance_location: tripData.customs_clearance_location || "",

      // Other
      payment_method: tripData.payment_method || "",
      requested_driver_name: tripData.requested_driver_name || "",
      notes: otherNotes,

      // Clear date/time so user enters new ones
      date: "",
      time: "",
      return_date: "",
      return_time: "",
    });

    toast.success(
      `Trip #${tripData.booking_number} cloned! All details copied.`,
    );

    // Exit clone mode and advance to next step
    setCloneMode(false);
    setCloneSelectedTrip(null);
    onNext();
  };

  const showNameInput =
    travelChoice === "no" ||
    (travelChoice === "yes" && lookupStatus === "not_found");

  const isSearching = travelChoice === "yes" && !lookupStatus;

  // When passenger is found, show the edit prompt instead of auto-advancing
  useEffect(() => {
    if (lookupStatus === "found" && formData.name) {
      setShowEditPrompt(true);
    }
  }, [lookupStatus, formData.name]);

  // In passenger mode: when phone lookup returns not_found, pre-fill the phone field
  useEffect(() => {
    if (isPassengerMode && lookupStatus === "not_found" && lookupValue) {
      set({ phone: lookupValue });
    }
  }, [isPassengerMode, lookupStatus, lookupValue]);

  const handleNoChangesNeeded = () => {
    setShowEditPrompt(false);
    setIsEditing(false);
    onNext();
  };

  const handleYesWantToEdit = () => {
    setShowEditPrompt(false);
    setIsEditing(true);
  };

  const handleConfirmEdits = () => {
    // IMPORTANT: Ensure phone and email are saved before advancing
    // This fixes the issue where phone changes weren't being persisted
    console.log(
      "[Step1Name] Confirming edits with phone:",
      formData.phone,
      "email:",
      formData.email,
    );

    onNext();
  };

  // Dynamic text based on mode
  const traveledQuestion = isPassengerMode
    ? "Have you travelled with us before?"
    : "Have they travelled with us before?";

  const traveledHelpText = isPassengerMode
    ? "This helps us find your information"
    : "This helps us find their information";

  const lookupHeading = isPassengerMode
    ? "Find Your Profile"
    : "Find Client Profile";

  const lookupSubtext = isPassengerMode
    ? "Search by phone or email"
    : "Search by phone or email";

  const notFoundText = isPassengerMode
    ? "No profile found — fill in your details below and we'll create one for you."
    : "No profile found — fill in their details below and we'll create one for them.";

  const foundMessage = isPassengerMode
    ? `Welcome back, ${formData.name}!`
    : `Found client ${formData.name}!`;

  const changeQuestion = isPassengerMode
    ? "Do you have any information you want to change?"
    : "Do they have any information you want to change?";

  const changeHelpText = isPassengerMode
    ? "We found your profile - review and update if needed"
    : "We found their profile - review and update if needed";

  const editHeading = isPassengerMode
    ? "Update Your Information"
    : "Update Client Information";

  const editSubtext = isPassengerMode
    ? "Make changes to your profile"
    : "Make changes to their profile";

  const nameQuestion = isPassengerMode
    ? "What's your name?"
    : "What's their name?";

  const nameHelpText = isPassengerMode
    ? "Enter your name"
    : "Enter their name?";

  // New function to validate city and state before proceeding
  const validateAndProceed = () => {
    // Only validate city/state for new passengers (not found or never traveled)
    if (showNameInput) {
      if (!formData.home_city?.trim()) {
        toast.error("Please enter a city");
        return;
      }
      if (!formData.home_state?.trim()) {
        toast.error("Please enter a state");
        return;
      }
    }
    onNext();
  };

  return (
    <>
      {/* ── Clone Trip Button (shown at the top before any choice) ── */}
      {!cloneMode && travelChoice === null && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setCloneMode(true)}
            className="w-full py-4 px-4 rounded-2xl border-2 border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100 transition-all group text-center"
          >
            <Copy
              size={20}
              className="inline-block text-purple-600 group-hover:scale-110 transition-transform mb-1"
            />
            <div className="text-sm font-bold text-purple-900">
              Clone Past Trip
            </div>
            <div className="text-xs text-purple-600">
              Copy all details from previous booking
            </div>
          </button>
        </div>
      )}

      {/* ── Clone Trip Mode ── */}
      {cloneMode && (
        <div className="space-y-4">
          <div className="text-center space-y-2 mb-4">
            <h3 className="text-lg font-bold text-gray-900">
              Find Trip to Clone
            </h3>
            <p className="text-sm text-gray-500">
              Search by passenger name or booking number to copy trip details.
            </p>
          </div>

          {/* Toggle: By Name / By Number */}
          {!cloneSelectedTrip && !cloneMatchedPassenger && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCloneSearchMode("passenger");
                  setCloneBookingNumber("");
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  cloneSearchMode === "passenger"
                    ? "border-purple-700 bg-purple-700 text-white"
                    : "border-purple-200 text-purple-700 hover:border-purple-400 bg-white"
                }`}
              >
                <Search size={14} />
                By Name
              </button>
              <button
                type="button"
                onClick={() => {
                  setCloneSearchMode("number");
                  setCloneNameSearch("");
                  setCloneMatchedPassenger(null);
                  setCloneAllTrips([]);
                }}
                className={`py-2 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  cloneSearchMode === "number"
                    ? "border-purple-700 bg-purple-700 text-white"
                    : "border-purple-200 text-purple-700 hover:border-purple-400 bg-white"
                }`}
              >
                <FileText size={14} />
                Booking #
              </button>
            </div>
          )}

          {/* Mode: Booking Number */}
          {!cloneSelectedTrip &&
            !cloneMatchedPassenger &&
            cloneSearchMode === "number" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 26-0001"
                    className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
                    value={cloneBookingNumber}
                    onChange={(e) => setCloneBookingNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && cloneBookingNumber.trim()) {
                        cloneLookupMutation.mutate(cloneBookingNumber.trim());
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() =>
                      cloneLookupMutation.mutate(cloneBookingNumber.trim())
                    }
                    disabled={
                      !cloneBookingNumber.trim() ||
                      cloneLookupMutation.isPending
                    }
                    className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {cloneLookupMutation.isPending ? "Looking up…" : "Look Up"}
                  </button>
                </div>
              </div>
            )}

          {/* Mode: Passenger Name Search */}
          {!cloneSelectedTrip &&
            !cloneMatchedPassenger &&
            cloneSearchMode === "passenger" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Passenger name (e.g. John Smith)"
                    className="flex-1 px-4 py-3 bg-white border border-purple-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={cloneNameSearch}
                    onChange={(e) => setCloneNameSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        cloneNameSearch.trim().length >= 2
                      ) {
                        cloneNameSearchMutation.mutate(cloneNameSearch.trim());
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() =>
                      cloneNameSearchMutation.mutate(cloneNameSearch.trim())
                    }
                    disabled={
                      cloneNameSearch.trim().length < 2 ||
                      cloneNameSearchMutation.isPending
                    }
                    className="px-5 py-3 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors whitespace-nowrap flex items-center gap-2"
                  >
                    {cloneNameSearchMutation.isPending && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {cloneNameSearchMutation.isPending
                      ? "Searching…"
                      : "Search"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 pl-1">
                  Also searches by phone or email
                </p>
              </div>
            )}

          {/* Trip list after name search */}
          {!cloneSelectedTrip &&
            cloneMatchedPassenger &&
            cloneAllTrips.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {cloneAllTrips.length} trip(s) for{" "}
                    {cloneMatchedPassenger.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCloneMatchedPassenger(null);
                      setCloneAllTrips([]);
                      setCloneNameSearch("");
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ← New Search
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {cloneAllTrips.map((trip) => {
                    const pickupAddr =
                      trip.pickup_address ||
                      `${trip.pickup_street || ""}, ${trip.pickup_city || ""}`.trim() ||
                      "No pickup address";
                    const dropoffAddr =
                      trip.dropoff_address ||
                      `${trip.dropoff_street || ""}, ${trip.dropoff_city || ""}`.trim() ||
                      trip.destination ||
                      "No destination";
                    return (
                      <button
                        key={trip.id}
                        onClick={() => setCloneSelectedTrip(trip)}
                        className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-purple-600 text-sm">
                              #{trip.booking_number || trip.id}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                trip.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : trip.status === "confirmed"
                                    ? "bg-blue-100 text-blue-700"
                                    : trip.status === "pending"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {trip.status}
                            </span>
                          </div>
                          <ArrowRight
                            size={14}
                            className="text-gray-400 mt-0.5"
                          />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                          <Calendar size={11} />
                          {format(
                            new Date(trip.start_time),
                            "MMM d, yyyy 'at' h:mm a",
                          )}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          <span className="font-medium">From:</span>{" "}
                          {pickupAddr}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          <span className="font-medium">To:</span> {dropoffAddr}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Selected trip confirmation */}
          {cloneSelectedTrip && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-purple-700">
                  ✓ Trip #
                  {cloneSelectedTrip.booking_number || cloneSelectedTrip.id}{" "}
                  selected
                </span>
                <button
                  type="button"
                  onClick={() => setCloneSelectedTrip(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs font-medium"
                >
                  Change
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 font-medium">
                ✏️ All trip details will be copied. You can modify them in the
                next steps.
              </div>

              <button
                type="button"
                onClick={() => handleCloneTrip(cloneSelectedTrip)}
                className="w-full py-3 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
              >
                Continue with This Trip
              </button>
            </div>
          )}

          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              setCloneMode(false);
              setCloneSelectedTrip(null);
              setCloneBookingNumber("");
              setCloneNameSearch("");
              setCloneMatchedPassenger(null);
              setCloneAllTrips([]);
              setCloneSearchMode("passenger");
            }}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium"
          >
            ← Back to Regular Booking
          </button>
        </div>
      )}

      {/* ── Regular booking flow (only shown when not in clone mode) ── */}
      {!cloneMode && (
        <>
          {/* ── Have you/Has this passenger travelled with us before? ── */}
          {travelChoice === null && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {traveledQuestion}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{traveledHelpText}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTravelChoice("yes")}
                  className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all"
                >
                  <UserCheck size={28} className="text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-800">Yes</span>
                  <span className="text-xs text-indigo-500">
                    {isPassengerMode ? "Look up my profile" : "Look up client"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTravelChoice("no")}
                  className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 transition-all"
                >
                  <UserPlus size={28} className="text-gray-600" />
                  <span className="text-sm font-bold text-gray-800">No</span>
                  <span className="text-xs text-gray-500">New booking</span>
                </button>
              </div>
            </>
          )}

          {/* ── Lookup by phone or email ── */}
          {isSearching && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {isPassengerMode
                    ? "What's your phone number?"
                    : lookupHeading}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isPassengerMode
                    ? "We'll use this to find your profile or create a new one"
                    : lookupSubtext}
                </p>
              </div>

              {/* Name / Phone / Email toggle — hidden in passenger mode (phone only) */}
              {!isPassengerMode && (
                <div className={`grid gap-3 grid-cols-3`}>
                  {[
                    { value: "name", label: "Name", icon: UserCheck },
                    { value: "phone", label: "Phone", icon: Phone },
                    { value: "email", label: "Email", icon: Mail },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const selected = lookupType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setLookupType(opt.value);
                          setLookupValue("");
                          setLookupStatus(null);
                        }}
                        className={`py-3 px-4 rounded-2xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                            : "border-gray-200 text-gray-600 hover:border-gray-400 bg-white"
                        }`}
                      >
                        <Icon size={16} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  autoFocus
                  type={
                    isPassengerMode
                      ? "tel"
                      : lookupType === "phone"
                        ? "tel"
                        : lookupType === "email"
                          ? "email"
                          : "text"
                  }
                  placeholder={
                    isPassengerMode
                      ? "(555) 000-0000"
                      : lookupType === "phone"
                        ? "(555) 000-0000"
                        : lookupType === "email"
                          ? "your@email.com"
                          : "John Doe"
                  }
                  value={lookupValue}
                  onChange={(e) => {
                    setLookupValue(e.target.value);
                    setLookupStatus(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && lookupValue.trim()) {
                      lookupMutation.mutate({
                        type: isPassengerMode ? "phone" : lookupType,
                        value: lookupValue,
                      });
                    }
                  }}
                  className="flex-1 px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    lookupMutation.mutate({
                      type: isPassengerMode ? "phone" : lookupType,
                      value: lookupValue,
                    })
                  }
                  disabled={!lookupValue.trim() || lookupMutation.isPending}
                  className="px-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {lookupMutation.isPending
                    ? "Searching…"
                    : isPassengerMode
                      ? "Continue"
                      : "Find Client"}
                </button>
              </div>

              {/* Back button — only shown in dispatch mode */}
              {!isPassengerMode && (
                <button
                  type="button"
                  onClick={() => {
                    setTravelChoice(null);
                    setLookupValue("");
                    setLookupStatus(null);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors text-center w-full"
                >
                  ← Back
                </button>
              )}
            </>
          )}

          {/* ── Not found notice ── */}
          {travelChoice === "yes" && lookupStatus === "not_found" && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-600">
              {notFoundText}
            </div>
          )}

          {/* ── Passenger found - Edit confirmation prompt ── */}
          {showEditPrompt && lookupStatus === "found" && (
            <>
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{foundMessage}</span>
              </div>

              {/* Match navigation — only shown for name searches with multiple results */}
              {allMatches.length > 1 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (prevMatch) {
                        setShowEditPrompt(false);
                        setTimeout(() => {
                          prevMatch();
                          setShowEditPrompt(true);
                        }, 0);
                      }
                    }}
                    disabled={matchIndex === 0}
                    className="flex items-center gap-1 text-sm font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <span className="text-sm text-amber-800 font-medium">
                    Match {matchIndex + 1} of {allMatches.length} — not them?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (nextMatch) {
                        setShowEditPrompt(false);
                        setTimeout(() => {
                          nextMatch();
                          setShowEditPrompt(true);
                        }, 0);
                      }
                    }}
                    disabled={matchIndex === allMatches.length - 1}
                    className="flex items-center gap-1 text-sm font-semibold text-amber-700 disabled:opacity-30 hover:text-amber-900 transition-colors"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Show found passenger information */}
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Current Information
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="w-20 text-xs font-semibold text-gray-500">
                      Name:
                    </div>
                    <div className="flex-1 text-sm font-medium text-gray-900">
                      {formData.name || "—"}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-20 text-xs font-semibold text-gray-500">
                      Phone:
                    </div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formData.phone || "—"}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-20 text-xs font-semibold text-gray-500">
                      Email:
                    </div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formData.email || "—"}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-20 text-xs font-semibold text-gray-500">
                      Notify via:
                    </div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formData.notification_preference === "both"
                        ? "📧💬 Email & SMS"
                        : formData.notification_preference === "email"
                          ? "📧 Email Only"
                          : formData.notification_preference === "sms"
                            ? "💬 SMS Only"
                            : "🔕 None"}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-20 text-xs font-semibold text-gray-500">
                      Address:
                    </div>
                    <div className="flex-1 text-sm text-gray-900">
                      {formData.pickup || "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {changeQuestion}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{changeHelpText}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleNoChangesNeeded}
                  className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-green-200 bg-green-50 hover:border-green-400 hover:bg-green-100 transition-all"
                >
                  <CheckCircle2 size={28} className="text-green-600" />
                  <span className="text-sm font-bold text-green-800">No</span>
                  <span className="text-xs text-green-500">
                    Looks good, continue
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleYesWantToEdit}
                  className="flex flex-col items-center gap-2 py-5 px-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 hover:border-indigo-400 hover:bg-indigo-100 transition-all"
                >
                  <Edit2 size={28} className="text-indigo-600" />
                  <span className="text-sm font-bold text-indigo-800">Yes</span>
                  <span className="text-xs text-indigo-500">
                    Edit information
                  </span>
                </button>
              </div>
            </>
          )}

          {/* ── Edit passenger information inline ── */}
          {isEditing && lookupStatus === "found" && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editHeading}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{editSubtext}</p>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={(e) => set({ name: e.target.value })}
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                </div>

                {/* Phone — always required */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                </div>

                {/* Optional Fields Notice */}
                <div className="pt-2 pb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Optional Information
                  </p>
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="passenger@email.com (optional)"
                    value={formData.email}
                    onChange={(e) => set({ email: e.target.value })}
                    autoComplete="off"
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                </div>

                {/* CC Emails */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Additional CC Emails
                  </label>
                  <input
                    type="text"
                    placeholder="spouse@example.com, assistant@example.com (optional)"
                    value={formData.cc_emails || ""}
                    onChange={(e) => set({ cc_emails: e.target.value })}
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                  <p className="text-xs text-gray-400 mt-1 pl-1">
                    Separate with commas - all emails will receive booking
                    confirmations
                  </p>
                </div>

                {/* Notification Preference */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Notification Preference
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "both", emoji: "📧💬", label: "Email & SMS" },
                      { value: "email", emoji: "📧", label: "Email Only" },
                      { value: "sms", emoji: "💬", label: "SMS Only" },
                      { value: "none", emoji: "🔕", label: "None" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          set({ notification_preference: opt.value })
                        }
                        className={`p-3 rounded-2xl border-2 text-center transition-all ${
                          formData.notification_preference === opt.value
                            ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="text-xl mb-1">{opt.emoji}</div>
                        <div className="text-xs font-semibold text-gray-800">
                          {opt.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Referral Source */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    How did you hear about us?
                  </label>
                  <input
                    type="text"
                    placeholder="Google, friend referral, social media, etc. (optional)"
                    value={formData.referral_source || ""}
                    onChange={(e) => set({ referral_source: e.target.value })}
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                </div>

                {/* Pickup Address */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    {isPassengerMode ? "Your Home Address" : "Home Address"}{" "}
                    <span className="text-gray-400 font-normal">
                      (pickup address)
                    </span>
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Street address (e.g. 123 Main St)"
                      value={formData.home_street || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const syncPickup =
                          !formData.pickup_location_type ||
                          formData.pickup_location_type === "home";
                        set({
                          home_street: val,
                          street_address: val,
                          ...(syncPickup ? { pickup_street: val } : {}),
                        });
                      }}
                      className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <input
                          type="text"
                          placeholder="City"
                          value={formData.home_city || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const key = val.trim().toLowerCase();
                            const syncPickup =
                              !formData.pickup_location_type ||
                              formData.pickup_location_type === "home";
                            if (CITY_ZIP_MAP[key]) {
                              set({
                                home_city: val,
                                city: val,
                                home_state: "TN",
                                state: "TN",
                                home_zip: CITY_ZIP_MAP[key],
                                zip_code: CITY_ZIP_MAP[key],
                                ...(syncPickup
                                  ? {
                                      pickup_city: val,
                                      pickup_state: "TN",
                                      pickup_zip: CITY_ZIP_MAP[key],
                                    }
                                  : {}),
                              });
                            } else {
                              set({
                                home_city: val,
                                city: val,
                                ...(syncPickup ? { pickup_city: val } : {}),
                              });
                            }
                          }}
                          className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          placeholder="State"
                          value={formData.home_state || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const syncPickup =
                              !formData.pickup_location_type ||
                              formData.pickup_location_type === "home";
                            set({
                              home_state: val,
                              state: val,
                              ...(syncPickup ? { pickup_state: val } : {}),
                            });
                          }}
                          maxLength={2}
                          className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="text"
                          placeholder="ZIP"
                          value={formData.home_zip || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const syncPickup =
                              !formData.pickup_location_type ||
                              formData.pickup_location_type === "home";
                            set({
                              home_zip: val,
                              zip_code: val,
                              ...(syncPickup ? { pickup_zip: val } : {}),
                            });
                          }}
                          className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmEdits}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors"
              >
                Confirm Changes & Continue
              </button>
            </>
          )}

          {/* ── Name input (only shown for new passengers or not found) ── */}
          {showNameInput && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {nameQuestion}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {nameHelpText} — Name, phone, city, and state are required!
                </p>
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => set({ name: e.target.value })}
                onKeyDown={(e) =>
                  e.key === "Enter" && canProceed && validateAndProceed()
                }
                className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
              />

              {/* Phone — always required */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>

              {/* Optional Fields Notice */}
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Optional Information
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="passenger@email.com (optional)"
                  value={formData.email}
                  onChange={(e) => set({ email: e.target.value })}
                  autoComplete="off"
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>

              {/* CC Emails */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Additional CC Emails
                </label>
                <input
                  type="text"
                  placeholder="spouse@example.com, assistant@example.com (optional)"
                  value={formData.cc_emails || ""}
                  onChange={(e) => set({ cc_emails: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                />
                <p className="text-xs text-gray-400 mt-1 pl-1">
                  Separate with commas - all emails will receive booking
                  confirmations
                </p>
              </div>

              {/* Notification Preference */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  Notification Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "both", emoji: "📧💬", label: "Email & SMS" },
                    { value: "email", emoji: "📧", label: "Email Only" },
                    { value: "sms", emoji: "💬", label: "SMS Only" },
                    { value: "none", emoji: "🔕", label: "None" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        set({ notification_preference: opt.value })
                      }
                      className={`p-3 rounded-2xl border-2 text-center transition-all ${
                        formData.notification_preference === opt.value
                          ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-xl mb-1">{opt.emoji}</div>
                      <div className="text-xs font-semibold text-gray-800">
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Referral Source */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  How did you hear about us?
                </label>
                <input
                  type="text"
                  placeholder="Google, friend referral, social media, etc. (optional)"
                  value={formData.referral_source || ""}
                  onChange={(e) => set({ referral_source: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>

              {/* Home Address - NOW REQUIRED for city and state */}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">
                  {isPassengerMode ? "Your Home Address" : "Home Address"}
                </label>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Street address (optional)"
                    value={formData.home_street || ""}
                    onChange={(e) =>
                      set({
                        home_street: e.target.value,
                        street_address: e.target.value,
                      })
                    }
                    className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="City"
                        value={formData.home_city || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const key = val.trim().toLowerCase();
                          if (CITY_ZIP_MAP[key]) {
                            set({
                              home_city: val,
                              city: val,
                              home_state: "TN",
                              state: "TN",
                              home_zip: CITY_ZIP_MAP[key],
                              zip_code: CITY_ZIP_MAP[key],
                            });
                          } else {
                            set({ home_city: val, city: val });
                          }
                        }}
                        className={`px-4 py-3 text-base border-2 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600 ${
                          !formData.home_city?.trim()
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200"
                        }`}
                      />
                      <p className="text-xs text-red-500 font-medium pl-1">
                        Required *
                      </p>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="State"
                        value={formData.home_state || ""}
                        onChange={(e) =>
                          set({
                            home_state: e.target.value,
                            state: e.target.value,
                          })
                        }
                        className={`px-4 py-3 text-base border-2 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600 ${
                          !formData.home_state?.trim()
                            ? "border-red-300 bg-red-50"
                            : "border-gray-200"
                        }`}
                      />
                      <p className="text-xs text-red-500 font-medium pl-1">
                        Required *
                      </p>
                    </div>
                    <input
                      type="text"
                      placeholder="ZIP"
                      value={formData.home_zip || ""}
                      onChange={(e) =>
                        set({
                          home_zip: e.target.value,
                          zip_code: e.target.value,
                        })
                      }
                      className="px-4 py-3 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
                    />
                  </div>
                </div>
              </div>

              {/* Helpful hint about optional fields coming next */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>Next step:</strong> We'll collect trip details
                  (date, time, location)
                </p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
