import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Home } from "lucide-react";

export function Step4Location({
  formData,
  set,
  lookupMutation,
  isPassengerMode = false,
  services,
}) {
  // Fetch preferred locations from API (always call at top level for hook rules)
  const { data: preferredLocations = [], isLoading: locationsLoading } =
    useQuery({
      queryKey: ["preferred-locations"],
      queryFn: async () => {
        const res = await fetch("/api/settings/preferred-locations");
        if (!res.ok) throw new Error("Failed to fetch locations");
        return res.json();
      },
    });

  // Wizard state for pickup (always initialize at top level)
  const [pickupFlow, setPickupFlow] = useState(() => {
    if (
      formData.pickup_location_type === "home" ||
      (formData.pickup_street && !formData.pickup_location_type)
    )
      return "complete";
    if (formData.pickup_location_type === "preferred") return "complete";
    if (formData.pickup_location_type === "other") return "manual";
    return "initial";
  });

  // Wizard state for dropoff (always initialize at top level)
  const [dropoffFlow, setDropoffFlow] = useState(() => {
    if (
      formData.dropoff_location_type === "home" ||
      (formData.dropoff_street && !formData.dropoff_location_type)
    )
      return "complete";
    if (formData.dropoff_location_type === "preferred") return "complete";
    if (formData.dropoff_location_type === "other") return "manual";
    return "initial";
  });

  // Auto-complete pickup when manual_with_legacy fields are filled
  useEffect(() => {
    if (
      pickupFlow === "manual_with_legacy" &&
      formData.pickup_street &&
      formData.pickup_city &&
      formData.pickup_state &&
      formData.pickup_zip
    ) {
      set({ pickup_location_type: "home" });
      setPickupFlow("complete");
    }
  }, [
    pickupFlow,
    formData.pickup_street,
    formData.pickup_city,
    formData.pickup_state,
    formData.pickup_zip,
  ]);

  // Auto-complete dropoff when manual_with_legacy fields are filled
  useEffect(() => {
    if (
      dropoffFlow === "manual_with_legacy" &&
      formData.dropoff_street &&
      formData.dropoff_city &&
      formData.dropoff_state &&
      formData.dropoff_zip
    ) {
      set({ dropoff_location_type: "home" });
      setDropoffFlow("complete");
    }
  }, [
    dropoffFlow,
    formData.dropoff_street,
    formData.dropoff_city,
    formData.dropoff_state,
    formData.dropoff_zip,
  ]);

  // Use dedicated home address fields (populated from passenger lookup and
  // preserved even after pickup/dropoff fields are reset)
  // Check both structured fields and legacy address field for backward compatibility
  const hasStructuredAddress = !!(
    formData.home_street &&
    formData.home_city &&
    formData.home_state &&
    formData.home_zip
  );

  const hasLegacyAddress = !!formData.home_address_legacy?.trim();

  // Also consider existing pickup/dropoff that were set as "home" type
  // (e.g. when editing an existing trip where home_* fields aren't populated)
  const hasHomeFromExistingPickup = !!(
    formData.pickup_location_type === "home" &&
    formData.pickup_street &&
    formData.pickup_city &&
    formData.pickup_state &&
    formData.pickup_zip
  );

  const hasHomeFromExistingDropoff = !!(
    formData.dropoff_location_type === "home" &&
    formData.dropoff_street &&
    formData.dropoff_city &&
    formData.dropoff_state &&
    formData.dropoff_zip
  );

  const hasPassengerAddress =
    hasStructuredAddress ||
    hasLegacyAddress ||
    hasHomeFromExistingPickup ||
    hasHomeFromExistingDropoff;

  // Handle pickup home selection
  const handlePickupHome = (isHome) => {
    if (isHome && hasPassengerAddress) {
      if (hasStructuredAddress) {
        // Use structured address fields
        set({
          pickup_street: formData.home_street,
          pickup_city: formData.home_city,
          pickup_state: formData.home_state,
          pickup_zip: formData.home_zip,
          pickup_is_preset: false,
          pickup_preferred_label: "",
          pickup_location_type: "home",
        });
      } else if (hasLegacyAddress) {
        // Use legacy address field - user will need to enter structured details
        set({
          pickup_street: "",
          pickup_city: "",
          pickup_state: "",
          pickup_zip: "",
          pickup_is_preset: false,
          pickup_preferred_label: "",
          pickup_location_type: "home_legacy",
        });
        // Set flow to manual so user can enter structured address
        setPickupFlow("manual_with_legacy");
        return;
      }
      setPickupFlow("complete");
    } else {
      setPickupFlow("preferred");
    }
  };

  // Handle pickup preferred location selection
  const handlePickupPreferred = (locationId) => {
    if (locationId === "OTHER") {
      setPickupFlow("manual");
      set({
        pickup_is_preset: false,
        pickup_preferred_label: "",
        pickup_location_type: "other",
        pickup_is_airport: false,
      });
    } else {
      const loc = preferredLocations.find((l) => l.id === locationId);
      if (loc) {
        const isAirport = loc.is_airport || false;
        const updates = {
          pickup_street: loc.street,
          pickup_city: loc.city,
          pickup_state: loc.state,
          pickup_zip: loc.zip,
          pickup_is_preset: true,
          pickup_preferred_label: loc.label,
          pickup_location_type: "preferred",
          pickup_is_airport: isAirport,
        };
        // If this pickup is not an airport and the dropoff is also not an airport,
        // clear any stale flight info (e.g. copied from a cloned airport trip)
        if (!isAirport && !formData.dropoff_is_airport) {
          updates.outgoing_flight_info = "";
          updates.returning_flight_info = "";
          updates.is_international_flight = false;
          updates.customs_clearance_location = "";
        }
        set(updates);
        setPickupFlow("complete");
      }
    }
  };

  // Handle dropoff home selection
  const handleDropoffHome = (isHome) => {
    if (isHome && hasPassengerAddress) {
      if (hasStructuredAddress) {
        // Use structured address fields
        set({
          dropoff_street: formData.home_street,
          dropoff_city: formData.home_city,
          dropoff_state: formData.home_state,
          dropoff_zip: formData.home_zip,
          dropoff_is_preset: false,
          dropoff_preferred_label: "",
          dropoff_location_type: "home",
        });
        setDropoffFlow("complete");
      } else if (hasLegacyAddress) {
        // Use legacy address field - user will need to enter structured details
        set({
          dropoff_street: "",
          dropoff_city: "",
          dropoff_state: "",
          dropoff_zip: "",
          dropoff_is_preset: false,
          dropoff_preferred_label: "",
          dropoff_location_type: "home_legacy",
        });
        // Set flow to manual so user can enter structured address
        setDropoffFlow("manual_with_legacy");
        return;
      }
    } else {
      setDropoffFlow("preferred");
    }
  };

  // Handle dropoff preferred location selection
  const handleDropoffPreferred = (locationId) => {
    if (locationId === "OTHER") {
      setDropoffFlow("manual");
      set({
        dropoff_is_preset: false,
        dropoff_preferred_label: "",
        dropoff_location_type: "other",
        destination: "", // Clear destination when choosing custom address
        dropoff_is_airport: false,
      });
    } else {
      const loc = preferredLocations.find((l) => l.id === locationId);
      if (loc) {
        // Check if this is a "HOME" location - if so, use passenger's home address instead
        const isHomeLocation = loc.label.toLowerCase().includes("home");

        if (isHomeLocation && hasPassengerAddress) {
          // Use passenger's home address (same logic as handleDropoffHome)
          if (hasStructuredAddress) {
            set({
              dropoff_street: formData.home_street,
              dropoff_city: formData.home_city,
              dropoff_state: formData.home_state,
              dropoff_zip: formData.home_zip,
              dropoff_is_preset: false,
              dropoff_preferred_label: loc.label, // Keep the "HOME" label for display
              dropoff_location_type: "home",
              destination: "", // Clear destination for home trips
              dropoff_is_airport: false,
              // Clear stale flight info if pickup is also not an airport
              ...(!formData.pickup_is_airport
                ? {
                    outgoing_flight_info: "",
                    returning_flight_info: "",
                    is_international_flight: false,
                    customs_clearance_location: "",
                  }
                : {}),
            });
            setDropoffFlow("complete");
          } else if (hasLegacyAddress) {
            // Use legacy address field - user will need to enter structured details
            set({
              dropoff_street: "",
              dropoff_city: "",
              dropoff_state: "",
              dropoff_zip: "",
              dropoff_is_preset: false,
              dropoff_preferred_label: loc.label,
              dropoff_location_type: "home_legacy",
              dropoff_is_airport: false,
            });
            setDropoffFlow("manual_with_legacy");
          }
        } else {
          // Regular preferred location — use the is_airport flag directly (no keyword guessing)
          const isAirport = loc.is_airport || false;

          const updates = {
            dropoff_street: loc.street,
            dropoff_city: loc.city,
            dropoff_state: loc.state,
            dropoff_zip: loc.zip,
            dropoff_is_preset: true,
            dropoff_preferred_label: loc.label,
            dropoff_location_type: "preferred",
            destination: isAirport ? "" : loc.label, // Clear destination for airport trips
            dropoff_is_airport: isAirport,
          };
          // If this dropoff is not an airport and the pickup is also not an airport,
          // clear any stale flight info (e.g. copied from a cloned airport trip)
          if (!isAirport && !formData.pickup_is_airport) {
            updates.outgoing_flight_info = "";
            updates.returning_flight_info = "";
            updates.is_international_flight = false;
            updates.customs_clearance_location = "";
          }
          set(updates);
          setDropoffFlow("complete");
        }
      }
    }
  };

  // Reset pickup selection
  const resetPickup = () => {
    // If the pickup was "home" type, preserve those address values as home fields
    // so the HOME button stays enabled after clicking Change
    const homeFieldUpdates = {};
    if (
      formData.pickup_location_type === "home" &&
      formData.pickup_street &&
      !formData.home_street
    ) {
      homeFieldUpdates.home_street = formData.pickup_street;
      homeFieldUpdates.home_city = formData.pickup_city;
      homeFieldUpdates.home_state = formData.pickup_state;
      homeFieldUpdates.home_zip = formData.pickup_zip;
    }

    setPickupFlow("initial");
    set({
      pickup_street: "",
      pickup_city: "",
      pickup_state: "",
      pickup_zip: "",
      pickup_is_preset: false,
      pickup_preferred_label: "",
      pickup_location_type: "",
      pickup_is_airport: false,
      ...homeFieldUpdates,
    });
  };

  // Reset dropoff selection
  const resetDropoff = () => {
    // If the dropoff was "home" type, preserve those address values as home fields
    // so the HOME button stays enabled after clicking Change
    const homeFieldUpdates = {};
    if (
      formData.dropoff_location_type === "home" &&
      formData.dropoff_street &&
      !formData.home_street
    ) {
      homeFieldUpdates.home_street = formData.dropoff_street;
      homeFieldUpdates.home_city = formData.dropoff_city;
      homeFieldUpdates.home_state = formData.dropoff_state;
      homeFieldUpdates.home_zip = formData.dropoff_zip;
    }

    setDropoffFlow("initial");
    set({
      dropoff_street: "",
      dropoff_city: "",
      dropoff_state: "",
      dropoff_zip: "",
      dropoff_is_preset: false,
      dropoff_preferred_label: "",
      dropoff_location_type: "",
      dropoff_is_airport: false,
      ...homeFieldUpdates,
    });
  };

  // Render pickup section based on flow state
  const renderPickupSection = () => {
    if (pickupFlow === "initial") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Pickup Location
          </h3>
          <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl">
            <p className="text-base font-medium text-blue-900 mb-4">
              Is the pickup at {isPassengerMode ? "your" : "their"} home?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handlePickupHome(true)}
                disabled={!hasPassengerAddress}
                className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Home size={20} />
                Yes, Home
              </button>
              <button
                type="button"
                onClick={() => handlePickupHome(false)}
                className="flex-1 py-3 px-5 bg-white hover:bg-gray-50 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl transition-all"
              >
                No, Other Location
              </button>
            </div>
            {!hasPassengerAddress && (
              <p className="text-xs text-blue-700 mt-2">
                No home address on file — we'll need to collect location details
              </p>
            )}
          </div>
        </div>
      );
    }

    if (pickupFlow === "preferred") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Pickup Location
          </h3>
          <div className="p-5 bg-purple-50 border-2 border-purple-200 rounded-2xl">
            <p className="text-base font-medium text-purple-900 mb-4">
              Is the pickup one of these locations?
            </p>
            {locationsLoading ? (
              <p className="text-purple-700 text-sm">Loading locations...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {preferredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handlePickupPreferred(loc.id)}
                    className="py-3 px-5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    {loc.emoji || "📍"} {loc.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handlePickupPreferred("OTHER")}
                  className="py-3 px-5 bg-white hover:bg-gray-50 border-2 border-purple-600 text-purple-600 font-semibold rounded-xl transition-all text-sm"
                >
                  ✏️ Another Address
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={resetPickup}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    if (pickupFlow === "manual_with_legacy") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Pickup Location
            </h3>
            <button
              type="button"
              onClick={resetPickup}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
            <p className="text-sm font-medium text-blue-900 mb-2">
              We have your address on file:
            </p>
            <p className="text-sm text-blue-700 font-semibold mb-3">
              {formData.home_address_legacy}
            </p>
            <p className="text-xs text-blue-600">
              Please enter it below in structured format so we can provide
              better service
            </p>
          </div>
          <div className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Street address (e.g. 123 Main St)"
              value={formData.pickup_street || ""}
              onChange={(e) => set({ pickup_street: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.pickup_city || ""}
                  onChange={(e) => set({ pickup_city: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State"
                  value={formData.pickup_state || ""}
                  onChange={(e) => set({ pickup_state: e.target.value })}
                  maxLength={2}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="ZIP code"
              value={formData.pickup_zip || ""}
              onChange={(e) => set({ pickup_zip: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <button
              type="button"
              disabled={
                !formData.pickup_street ||
                !formData.pickup_city ||
                !formData.pickup_state ||
                !formData.pickup_zip
              }
              onClick={() => {
                set({ pickup_location_type: "other" });
                setPickupFlow("complete");
              }}
              className="w-full py-3 px-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              Confirm Pickup Address →
            </button>
          </div>
        </div>
      );
    }

    if (pickupFlow === "manual") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Pickup Location
            </h3>
            <button
              type="button"
              onClick={resetPickup}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Street address (e.g. 123 Main St)"
              value={formData.pickup_street || ""}
              onChange={(e) => set({ pickup_street: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.pickup_city || ""}
                  onChange={(e) => set({ pickup_city: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State"
                  value={formData.pickup_state || ""}
                  onChange={(e) => set({ pickup_state: e.target.value })}
                  maxLength={2}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="ZIP code"
              value={formData.pickup_zip || ""}
              onChange={(e) => set({ pickup_zip: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <button
              type="button"
              disabled={
                !formData.pickup_street ||
                !formData.pickup_city ||
                !formData.pickup_state ||
                !formData.pickup_zip
              }
              onClick={() => {
                set({ pickup_location_type: "other" });
                setPickupFlow("complete");
              }}
              className="w-full py-3 px-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              Confirm Pickup Address →
            </button>
          </div>
        </div>
      );
    }

    if (pickupFlow === "complete") {
      const displayText =
        formData.pickup_location_type === "home"
          ? "Home Address"
          : formData.pickup_location_type === "preferred"
            ? formData.pickup_preferred_label || "Preferred Location"
            : "Custom Address";

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Pickup Location
            </h3>
            <button
              type="button"
              onClick={resetPickup}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="p-5 bg-green-50 border-2 border-green-300 rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✓</div>
              <div className="flex-1">
                <p className="font-bold text-green-900">{displayText}</p>
                <p className="text-sm text-green-700">
                  {formData.pickup_street}
                  <br />
                  {formData.pickup_city}, {formData.pickup_state}{" "}
                  {formData.pickup_zip}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Render dropoff section based on flow state
  const renderDropoffSection = () => {
    if (dropoffFlow === "initial") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Dropoff Location (Destination)
          </h3>
          <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl">
            <p className="text-base font-medium text-blue-900 mb-4">
              Is the destination {isPassengerMode ? "your" : "their"} home?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDropoffHome(true)}
                disabled={!hasPassengerAddress}
                className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Home size={20} />
                Yes, Home
              </button>
              <button
                type="button"
                onClick={() => handleDropoffHome(false)}
                className="flex-1 py-3 px-5 bg-white hover:bg-gray-50 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl transition-all"
              >
                No, Other Location
              </button>
            </div>
            {!hasPassengerAddress && (
              <p className="text-xs text-blue-700 mt-2">
                No home address on file
              </p>
            )}
          </div>
        </div>
      );
    }

    if (dropoffFlow === "preferred") {
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Dropoff Location
          </h3>
          <div className="p-5 bg-purple-50 border-2 border-purple-200 rounded-2xl">
            <p className="text-base font-medium text-purple-900 mb-4">
              Is the dropoff one of these locations?
            </p>
            {locationsLoading ? (
              <p className="text-purple-700 text-sm">Loading locations...</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-3">
                {preferredLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleDropoffPreferred(loc.id)}
                    className="py-3 px-5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    {loc.emoji || "📍"} {loc.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleDropoffPreferred("OTHER")}
                  className="py-3 px-5 bg-white hover:bg-gray-50 border-2 border-purple-600 text-purple-600 font-semibold rounded-xl transition-all text-sm"
                >
                  ✏️ Another Address
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={resetDropoff}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              ← Back
            </button>
          </div>
        </div>
      );
    }

    if (dropoffFlow === "manual_with_legacy") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Dropoff Location
            </h3>
            <button
              type="button"
              onClick={resetDropoff}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl">
            <p className="text-sm font-medium text-blue-900 mb-2">
              We have your address on file:
            </p>
            <p className="text-sm text-blue-700 font-semibold mb-3">
              {formData.home_address_legacy}
            </p>
            <p className="text-xs text-blue-600">
              Please enter it below in structured format so we can provide
              better service
            </p>
          </div>
          <div className="space-y-3">
            <input
              autoFocus
              type="text"
              placeholder="Street address (e.g. 456 Oak Ave)"
              value={formData.dropoff_street || ""}
              onChange={(e) => set({ dropoff_street: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.dropoff_city || ""}
                  onChange={(e) => set({ dropoff_city: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State"
                  value={formData.dropoff_state || ""}
                  onChange={(e) => set({ dropoff_state: e.target.value })}
                  maxLength={2}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="ZIP code"
              value={formData.dropoff_zip || ""}
              onChange={(e) => set({ dropoff_zip: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <button
              type="button"
              disabled={
                !formData.dropoff_street ||
                !formData.dropoff_city ||
                !formData.dropoff_state ||
                !formData.dropoff_zip
              }
              onClick={() => {
                set({ dropoff_location_type: "other" });
                setDropoffFlow("complete");
              }}
              className="w-full py-3 px-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              Confirm Dropoff Address →
            </button>
          </div>
        </div>
      );
    }

    if (dropoffFlow === "manual") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Dropoff Location
            </h3>
            <button
              type="button"
              onClick={resetDropoff}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="space-y-3">
            {/* Destination name field — admin/dispatch only, not shown to passengers */}
            {!isPassengerMode && (
              <input
                autoFocus
                type="text"
                placeholder="Where are you going? (e.g. BNA Airport, Restaurant Name)"
                value={formData.destination || ""}
                onChange={(e) => set({ destination: e.target.value })}
                className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
              />
            )}
            <input
              autoFocus={isPassengerMode}
              type="text"
              placeholder="Street address (e.g. 456 Oak Ave)"
              value={formData.dropoff_street || ""}
              onChange={(e) => set({ dropoff_street: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.dropoff_city || ""}
                  onChange={(e) => set({ dropoff_city: e.target.value })}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State"
                  value={formData.dropoff_state || ""}
                  onChange={(e) => set({ dropoff_state: e.target.value })}
                  maxLength={2}
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="ZIP code"
              value={formData.dropoff_zip || ""}
              onChange={(e) => set({ dropoff_zip: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all placeholder:text-gray-600"
            />
            <button
              type="button"
              disabled={
                !formData.dropoff_street ||
                !formData.dropoff_city ||
                !formData.dropoff_state ||
                !formData.dropoff_zip
              }
              onClick={() => {
                set({ dropoff_location_type: "other" });
                setDropoffFlow("complete");
              }}
              className="w-full py-3 px-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
            >
              Confirm Dropoff Address →
            </button>
          </div>
        </div>
      );
    }

    if (dropoffFlow === "complete") {
      const displayText =
        formData.dropoff_location_type === "home"
          ? "Home Address"
          : formData.dropoff_location_type === "preferred"
            ? formData.dropoff_preferred_label || "Preferred Location"
            : "Custom Address";

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Dropoff Location
            </h3>
            <button
              type="button"
              onClick={resetDropoff}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Change
            </button>
          </div>
          <div className="p-5 bg-green-50 border-2 border-green-300 rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✓</div>
              <div className="flex-1">
                <p className="font-bold text-green-900">{displayText}</p>
                <p className="text-sm text-green-700">
                  {formData.dropoff_street}
                  <br />
                  {formData.dropoff_city}, {formData.dropoff_state}{" "}
                  {formData.dropoff_zip}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Render: Check is_tour AFTER all hooks are called
  if (formData.is_tour) {
    return (
      <>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Logistics Destination
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            General area or destination name for logistics (optional —
            participants have individual pickup/dropoff locations)
          </p>
        </div>

        <div className="p-5 bg-purple-50 border-2 border-purple-200 rounded-2xl space-y-3">
          <label className="text-sm font-semibold text-purple-900">
            Destination Name{" "}
            <span className="text-purple-600 font-normal text-xs">
              (optional)
            </span>
          </label>
          <input
            type="text"
            placeholder="e.g., Downtown Nashville, Broadway District, Music Row"
            value={formData.destination || ""}
            onChange={(e) => set({ destination: e.target.value })}
            className="w-full px-5 py-4 text-base bg-white border-2 border-purple-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all placeholder:text-gray-600"
          />
          <p className="text-xs text-purple-700">
            ℹ️ This field is for logistics only. Each participant already has
            their own pickup and drop-off locations.
          </p>
        </div>
      </>
    );
  }

  // Standard location flow (non-tour trips)
  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Where are you going?
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We'll start with pickup, then destination
        </p>
      </div>

      <div className="space-y-8">
        {/* Pickup Section */}
        {renderPickupSection()}

        {/* Only show dropoff after pickup is complete */}
        {pickupFlow === "complete" && renderDropoffSection()}
      </div>
    </>
  );
}
