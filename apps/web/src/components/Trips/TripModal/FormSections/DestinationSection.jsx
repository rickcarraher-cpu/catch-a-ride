import { useState, useEffect, useRef } from "react";
import { MapPin, Route, PenLine, Home, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/utils/notify";

// Map distance_method values to human-readable labels
function getDistanceMethodLabel(method) {
  if (!method) return null;
  const labels = {
    osrm: "OSRM",
    valhalla: "Valhalla",
    routes_api: "Google Routes",
    distance_matrix: "Google Matrix",
    geocode_estimate: "Estimate",
    estimate: "Estimate",
  };
  return labels[method] || method.toUpperCase();
}

// Get color for distance method badge
function getDistanceMethodColor(method) {
  if (!method) return "bg-gray-100 text-gray-600";
  if (method.includes("estimate") || method === "geocode_estimate") {
    return "bg-amber-100 text-amber-700";
  }
  if (
    method.includes("google") ||
    method === "routes_api" ||
    method === "distance_matrix"
  ) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-green-100 text-green-700"; // OSRM, Valhalla
}

export function DestinationSection({
  formData,
  setFormData,
  isReturnTrip,
  services,
  ratePerMile,
  manualMileage,
}) {
  // ── Auto-distance calculation state ──────────────────────────────────────
  const [calculating, setCalculating] = useState(false);

  // Guard: only recalculate distance when the user has actually typed in a
  // location field. Programmatic auto-fills (e.g. destination → dropoff fields)
  // must NOT change the mileage or fare when opening an existing trip.
  const userEditedLocationRef = useRef(false);

  // Build a stable address string from structured fields
  const buildAddr = (street, city, state, zip) => {
    const parts = [];
    if (street) parts.push(street.trim());
    if (city) parts.push(city.trim());
    if (state) parts.push(state.trim());
    if (zip) parts.push(zip.trim());
    return parts.join(", ");
  };

  // Track the original addresses when modal opened so we only recalculate
  // if the user has actually changed the from/to addresses.
  const openedAddressesRef = useRef(null);
  if (openedAddressesRef.current === null) {
    const initOrigin = buildAddr(
      formData.pickup_street,
      formData.pickup_city,
      formData.pickup_state,
      formData.pickup_zip,
    );
    const initDest =
      buildAddr(
        formData.dropoff_street,
        formData.dropoff_city,
        formData.dropoff_state,
        formData.dropoff_zip,
      ) ||
      formData.destination ||
      "";
    openedAddressesRef.current = {
      origin: initOrigin,
      dest: initDest,
      hadDistance: !!formData.distance_miles,
    };
  }

  // lastCalcRef prevents duplicate calls for the same key
  const lastCalcRef = useRef(() => {
    if (!formData.distance_miles) return "";
    const initOrigin = buildAddr(
      formData.pickup_street,
      formData.pickup_city,
      formData.pickup_state,
      formData.pickup_zip,
    );
    const initDest =
      buildAddr(
        formData.dropoff_street,
        formData.dropoff_city,
        formData.dropoff_state,
        formData.dropoff_zip,
      ) ||
      formData.destination ||
      "";
    return `${initOrigin}|${initDest}`;
  });
  // Resolve if it's a function (first render)
  if (typeof lastCalcRef.current === "function") {
    lastCalcRef.current = lastCalcRef.current();
  }

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Helper: auto-update main service price from miles × rate (rounded up), $50 minimum
  // Also sets duration_minutes on the main service if provided
  const applyMileagePrice = (miles, updatedFormData, durationMinutes) => {
    let newFormData = { ...updatedFormData };
    const shouldUpdatePrice =
      ratePerMile && ratePerMile > 0 && miles && miles > 0;
    const calculatedPrice = shouldUpdatePrice
      ? Math.max(Math.ceil(ratePerMile * Number(miles)), 50)
      : null;

    // Find the first main (non-addon) service and update its price + duration
    const updatedServices = newFormData.services.map((s, i) => {
      const serviceDef = services?.find((ser) => ser.id == s.service_id);
      const isAddon = serviceDef?.is_addon || false;
      // Update only the first main service
      if (
        !isAddon &&
        i ===
          newFormData.services.findIndex((ss) => {
            const sd = services?.find((ser) => ser.id == ss.service_id);
            return !sd?.is_addon;
          })
      ) {
        const updated = { ...s };
        if (calculatedPrice !== null) {
          updated.service_price = calculatedPrice;
        }
        // Compute duration as driving time × 2, but never below the service's own default (75 min minimum)
        if (durationMinutes != null && durationMinutes > 0) {
          const minDuration = serviceDef?.duration_minutes || 75;
          updated.duration_minutes = Math.max(durationMinutes * 2, minDuration);
        }
        return updated;
      }
      return s;
    });
    return { ...newFormData, services: updatedServices };
  };

  // ── Clone-aware location editing ──────────────────────────────────────────
  // When a cloned trip's pickup location is edited, clear all cloned pickup fields
  // and distance so the user starts fresh. Only triggers on first edit after clone.
  const handleClonedPickupEdit = (fieldName, value) => {
    userEditedLocationRef.current = true; // user explicitly changed a pickup field
    if (formData._isClone && formData._clonedPickup) {
      // First edit of a cloned pickup — clear all pickup fields and distance
      setFormData({
        ...formData,
        pickup_street: fieldName === "pickup_street" ? value : "",
        pickup_city: fieldName === "pickup_city" ? value : "",
        pickup_state: fieldName === "pickup_state" ? value : "",
        pickup_zip: fieldName === "pickup_zip" ? value : "",
        pickup_address: "",
        distance_miles: null,
        _clonedPickup: false, // Only reset once
        _pickup_prefilled: false,
      });
    } else {
      setFormData({
        ...formData,
        [fieldName]: value,
        _pickup_prefilled: false,
      });
    }
  };

  // Same for dropoff: clear all cloned dropoff fields and distance on first edit
  const handleClonedDropoffEdit = (fieldName, value) => {
    userEditedLocationRef.current = true; // user explicitly changed a dropoff/destination field
    if (formData._isClone && formData._clonedDropoff) {
      // First edit of a cloned dropoff — clear all dropoff fields, destination, and distance
      setFormData({
        ...formData,
        dropoff_street: fieldName === "dropoff_street" ? value : "",
        dropoff_city: fieldName === "dropoff_city" ? value : "",
        dropoff_state: fieldName === "dropoff_state" ? value : "",
        dropoff_zip: fieldName === "dropoff_zip" ? value : "",
        dropoff_address: "",
        destination: fieldName === "destination" ? value : "",
        distance_miles: null,
        _clonedDropoff: false, // Only reset once
      });
    } else {
      setFormData({
        ...formData,
        [fieldName]: value,
      });
    }
  };

  // Clear destination on return trips
  useEffect(() => {
    if (isReturnTrip && formData.destination) {
      setFormData({ ...formData, destination: "" });
    }
  }, [isReturnTrip]);

  // Auto-fill dropoff address when destination is recognized (only if NOT a return trip)
  // Only auto-fill if the dropoff fields are currently empty (user hasn't filled them yet)
  useEffect(() => {
    if (isReturnTrip) return; // Skip auto-fill for return trips
    // Don't auto-fill if dropoff street is already populated (prevents overwriting on edit open)
    if (formData.dropoff_street) return;
    const dest = (formData.destination || "").toLowerCase().trim();
    if (dest === "the farm") {
      setFormData({
        ...formData,
        dropoff_street: "732 Rock Springs Rd",
        dropoff_city: "Castalian Springs",
        dropoff_state: "TN",
        dropoff_zip: "37031",
      });
    } else if (dest === "downtown") {
      setFormData({
        ...formData,
        dropoff_street: "501 Broadway",
        dropoff_city: "Nashville",
        dropoff_state: "TN",
        dropoff_zip: "37203",
      });
    } else if (
      dest === "bna" ||
      dest === "bna airport" ||
      dest === "nashville international airport" ||
      dest === "nashville airport"
    ) {
      setFormData({
        ...formData,
        dropoff_street: "1 Terminal Dr",
        dropoff_city: "Nashville",
        dropoff_state: "TN",
        dropoff_zip: "37214",
      });
    }
  }, [formData.destination, isReturnTrip]);

  // Auto-fill notes and driver_notes for special pickup locations
  useEffect(() => {
    const dest = (formData.destination || "").toLowerCase().trim();

    const NISSAN_NOTE =
      "Standard Pick up Woodland St and 5th in the Church Parking Lot.  This is a 20 minute walk from the stadium.  You need to go out gates 2. 3, 4 or 5 go up a block to the light at Woodall and make a right.  Come up to 5th Street and we will be on the corner, in the Church Parking lot or the lot across the street, if open.";
    const DOWNTOWN_NOTE = "5th and Commerce behind Assemble Food Hall";
    const ASCEND_NOTE = "1st ave south and Peabody";

    let autoNote = null;
    if (
      dest.includes("pick up for nissan") ||
      dest === "(pick up for nissan)"
    ) {
      autoNote = NISSAN_NOTE;
    } else if (
      dest.includes("pick up for downtown") ||
      dest === "(pick up for downtown)"
    ) {
      autoNote = DOWNTOWN_NOTE;
    } else if (dest.includes("ascend") || dest === "(ascend)") {
      autoNote = ASCEND_NOTE;
    }

    if (!autoNote) return;

    const needsNotes = !formData.notes || formData.notes.trim() === "";
    const needsDriverNotes =
      !formData.driver_notes || formData.driver_notes.trim() === "";

    if (needsNotes || needsDriverNotes) {
      setFormData({
        ...formData,
        notes: needsNotes ? autoNote : formData.notes,
        driver_notes: needsDriverNotes ? autoNote : formData.driver_notes,
      });
    }
  }, [formData.destination]);

  // Build entries with original index and is_addon flag from the services catalog
  const serviceEntries = formData.services.map((s, i) => {
    const serviceDef = services?.find((ser) => ser.id == s.service_id);
    return { ...s, _origIdx: i, _isAddon: serviceDef?.is_addon || false };
  });
  const mainEntries = serviceEntries.filter((s) => !s._isAddon);
  const addonEntries = serviceEntries.filter((s) => s._isAddon);

  const addService = (serviceId) => {
    const service = services.find((s) => s.id == serviceId);
    if (!service) return;

    // If distance and rate_per_mile are available, calculate price from mileage
    // (only for main services, not addons)
    let autoPrice;
    if (
      !service.is_addon &&
      formData.distance_miles &&
      ratePerMile &&
      ratePerMile > 0
    ) {
      // Calculate from mileage: miles × rate, rounded up, $50 minimum
      autoPrice = Math.max(
        Math.ceil(Number(formData.distance_miles) * ratePerMile),
        50,
      );
    } else {
      // Fall back to default pricing
      autoPrice = service.is_variable_price ? 0 : service.default_price;
    }

    setFormData({
      ...formData,
      services: [
        ...formData.services,
        {
          service_id: service.id,
          service_price: autoPrice,
          duration_minutes: service.duration_minutes,
          quantity: 1,
        },
      ],
    });
  };

  const removeService = (index) => {
    const s = [...formData.services];
    s.splice(index, 1);
    setFormData({ ...formData, services: s });
  };

  const updateServiceField = (index, field, value) => {
    const s = [...formData.services];
    s[index][field] = value;
    setFormData({ ...formData, services: s });
  };

  const hasMainService = mainEntries.length > 0;

  // Build full address string for display and fallback
  const buildFullAddress = (street, city, state, zip) => {
    const parts = [];
    if (street) parts.push(street.trim());
    if (city) parts.push(city.trim());
    if (state) parts.push(state.trim());
    if (zip) parts.push(zip.trim());
    return parts.join(", ");
  };

  // Origin: full pickup address
  const origin = buildFullAddress(
    formData.pickup_street,
    formData.pickup_city,
    formData.pickup_state,
    formData.pickup_zip,
  );

  // Destination: full dropoff address, or fallback to destination field
  const dest =
    buildFullAddress(
      formData.dropoff_street,
      formData.dropoff_city,
      formData.dropoff_state,
      formData.dropoff_zip,
    ) ||
    formData.destination ||
    "";

  const canCalculate = !!(origin && dest);

  // ── Auto-calculate distance when both addresses are complete ─────────────
  const pickupComplete = !!(
    formData.pickup_street &&
    (formData.pickup_city || formData.pickup_zip)
  );
  const dropoffComplete = !!(
    formData.dropoff_street &&
    (formData.dropoff_city || formData.dropoff_zip)
  );
  const canAutoCalculate = pickupComplete && dropoffComplete;

  useEffect(() => {
    if (!canAutoCalculate) return;
    // ── Skip auto-calculation when manual mileage mode is enabled ──────────
    if (manualMileage) return;

    // Only recalculate if the user actually typed in a location field.
    // This prevents auto-fill effects (destination keyword → dropoff address fields)
    // from triggering a recalculation and silently changing the fare on edit open.
    if (!userEditedLocationRef.current) return;

    const key = `${origin}|${dest}`;
    // Don't recalculate if the key is the same as last calculated
    if (key === lastCalcRef.current) return;

    // Always check if addresses actually changed from when the modal opened —
    // prevents auto-calc (and toast) from firing just because a trip has
    // complete addresses but no saved distance.
    const addressesChanged =
      origin !== openedAddressesRef.current.origin ||
      dest !== openedAddressesRef.current.dest;
    if (!addressesChanged) {
      // Addresses haven't changed — mark key as calculated and skip
      lastCalcRef.current = key;
      return;
    }

    const timer = setTimeout(async () => {
      setCalculating(true);
      try {
        const res = await fetch("/api/appointments/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination: dest }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error("Distance calculation failed:", err.error);
          toast.error(err.error || "Could not calculate distance");
          return;
        }
        const data = await res.json();
        lastCalcRef.current = key;
        const currentFormData = formDataRef.current;
        const updated = applyMileagePrice(
          data.miles,
          {
            ...currentFormData,
            distance_miles: data.miles,
            distance_method: data.method || null,
            distance_note: data.note || null,
          },
          data.durationMinutes || null,
        );
        setFormData(updated);

        // Show warning toast for estimate methods
        const isEstimate = (data.method || "").includes("estimate");
        if (isEstimate) {
          toast.warning(
            `Distance: ~${data.miles} mi (ESTIMATE — Google Maps was unavailable, please verify)`,
            { duration: 8000 },
          );
        } else {
          toast.success(`Distance: ${data.miles} mi (${data.duration})`);
        }
      } catch (err) {
        console.error("Distance calc error:", err);
      } finally {
        setCalculating(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [origin, dest, canAutoCalculate]);

  return (
    <div className="space-y-4">
      {/* ════════════════ DESTINATION & ADDRESSES FIRST ════════════════ */}

      {/* Destination field */}
      <div className="space-y-1.5">
        {isReturnTrip ? (
          <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <MapPin size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Return trip:</span> Mileage is
              calculated using pickup and dropoff addresses only.
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Destination{" "}
              <span className="text-gray-400 text-xs font-normal">
                (airport, hotel name, etc.)
              </span>
            </label>
            <input
              type="text"
              placeholder="BNA, HOME, DT, RYMAN, etc."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.destination}
              onChange={(e) => {
                handleClonedDropoffEdit("destination", e.target.value);
              }}
            />
            <p className="text-xs text-gray-400">
              Tip: type "BNA", "The Farm", or "Downtown" to auto-fill dropoff
              address
            </p>
          </div>
        )}
      </div>

      {/* Dropoff Address - NOW BEFORE PICKUP */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Dropoff Location{" "}
          <span className="text-gray-400 text-xs font-normal">(optional)</span>
        </label>
        <input
          type="text"
          placeholder="Street address (e.g. 456 Oak Ave)"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.dropoff_street || ""}
          onChange={(e) => {
            handleClonedDropoffEdit("dropoff_street", e.target.value);
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <input
              type="text"
              placeholder="City"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.dropoff_city || ""}
              onChange={(e) => {
                handleClonedDropoffEdit("dropoff_city", e.target.value);
              }}
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="State"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.dropoff_state || ""}
              onChange={(e) => {
                handleClonedDropoffEdit("dropoff_state", e.target.value);
              }}
              maxLength={2}
            />
          </div>
        </div>
        <input
          type="text"
          placeholder="ZIP code"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.dropoff_zip || ""}
          onChange={(e) => {
            handleClonedDropoffEdit("dropoff_zip", e.target.value);
          }}
        />
      </div>

      {/* Pickup Address - NOW AFTER DROPOFF */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Pickup / Departure Location
        </label>
        <input
          type="text"
          placeholder="Street address (e.g. 123 Main St)"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.pickup_street || ""}
          onChange={(e) => {
            handleClonedPickupEdit("pickup_street", e.target.value);
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <input
              type="text"
              placeholder="City"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.pickup_city || ""}
              onChange={(e) => {
                handleClonedPickupEdit("pickup_city", e.target.value);
              }}
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="State"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.pickup_state || ""}
              onChange={(e) => {
                handleClonedPickupEdit("pickup_state", e.target.value);
              }}
              maxLength={2}
            />
          </div>
        </div>
        <input
          type="text"
          placeholder="ZIP code"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.pickup_zip || ""}
          onChange={(e) => {
            handleClonedPickupEdit("pickup_zip", e.target.value);
          }}
        />
        {formData._pickup_prefilled && formData.pickup_street && (
          <p className="text-xs text-blue-500 flex items-center gap-1">
            🏠 Pre-filled from passenger's home address — change if pickup is
            different
          </p>
        )}

        {/* Save as passenger home address checkbox */}
        {formData.client_id &&
          (formData.pickup_street || formData.pickup_city) && (
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={formData.save_as_home_address || false}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    save_as_home_address: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="flex items-center gap-1 text-xs text-blue-700 font-semibold">
                <Home size={12} />
                Save as passenger's home address
              </span>
            </label>
          )}
      </div>

      {/* ── Manual Mileage Entry ─────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
          <Route size={12} />
          Distance (miles)
          {calculating && !manualMileage && (
            <span className="flex items-center gap-1 text-blue-500 font-normal normal-case ml-2">
              <Loader2 size={12} className="animate-spin" />
              Calculating...
            </span>
          )}
          {manualMileage && (
            <span className="text-orange-500 font-normal normal-case ml-2 text-[10px] bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
              ✏️ Manual entry required
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="any"
            placeholder={
              manualMileage
                ? "Enter miles manually"
                : "Auto-calculated or enter manually"
            }
            className={`w-48 px-3 py-2 bg-white rounded-lg text-sm focus:ring-2 focus:ring-blue-600 ${manualMileage ? "border-2 border-orange-400" : "border border-blue-300"}`}
            value={
              formData.distance_miles != null && formData.distance_miles !== ""
                ? Number(formData.distance_miles)
                : ""
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const miles = isNaN(val) ? null : Math.ceil(val);
              const updated = applyMileagePrice(miles, {
                ...formData,
                distance_miles: miles,
              });
              setFormData(updated);
            }}
          />
          <span className="text-sm text-gray-500">miles</span>
        </div>
      </div>

      {/* ── Distance Result Display ───────────────────────────────── */}
      {formData.distance_miles != null &&
        Number(formData.distance_miles) > 0 &&
        (() => {
          const isEstimate = (formData.distance_method || "").includes(
            "estimate",
          );
          const methodLabels = {
            routes_api: "Google Routes API",
            distance_matrix: "Google Distance Matrix",
            osrm: "OSRM Routing",
            valhalla: "Valhalla Routing",
            geocode_estimate: "Estimate (straight-line × 1.5)",
            estimate: "Estimate (straight-line × 1.5)",
            photon_estimate: "Estimate (straight-line × 1.5)",
          };
          const methodLabel =
            methodLabels[formData.distance_method] ||
            formData.distance_method ||
            "Manual entry"; // fallback when no method recorded
          return (
            <div className="space-y-2">
              <div
                className={`flex flex-col gap-1 border rounded-lg px-3 py-2 ${
                  isEstimate
                    ? "bg-amber-50 border-amber-300"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <MapPin
                    size={14}
                    className={`shrink-0 ${isEstimate ? "text-amber-500" : "text-blue-500"}`}
                  />
                  <span
                    className={`text-sm font-semibold ${
                      isEstimate ? "text-amber-700" : "text-blue-700"
                    }`}
                  >
                    {isEstimate ? "~" : ""} {Number(formData.distance_miles)}{" "}
                    miles
                    {(() => {
                      const mainService = formData.services?.find((s) => {
                        const serviceDef = services?.find(
                          (ser) => ser.id == s.service_id,
                        );
                        return !serviceDef?.is_addon;
                      });
                      const storedDuration = mainService?.duration_minutes;
                      const oneWay = storedDuration
                        ? Math.round(storedDuration / 2)
                        : null;
                      const blocked = storedDuration;

                      if (oneWay && blocked) {
                        return (
                          <span className="text-xs font-normal ml-2">
                            (~{oneWay} min drive · {blocked} min duration)
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </span>
                  {/* Method badge inline next to mileage */}
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isEstimate
                        ? "bg-amber-100 text-amber-700 border-amber-300"
                        : methodLabel === "Manual entry"
                          ? "bg-gray-100 text-gray-500 border-gray-300"
                          : "bg-blue-100 text-blue-600 border-blue-200"
                    }`}
                  >
                    {isEstimate
                      ? "⚠️ "
                      : methodLabel === "Manual entry"
                        ? "✏️ "
                        : "✓ "}
                    {methodLabel}
                  </span>
                </div>
                {isEstimate && (
                  <p className="text-xs ml-5 text-amber-700 font-semibold">
                    This is an estimate — Google Maps routing was unavailable.
                    Please verify the actual mileage.
                  </p>
                )}
                {ratePerMile > 0 && (
                  <div className="flex items-center gap-1 ml-5">
                    {(() => {
                      const raw = Math.ceil(
                        ratePerMile * Number(formData.distance_miles),
                      );
                      const final = Math.max(raw, 50);
                      const minApplied = final > raw;
                      return (
                        <span className="text-xs text-gray-500">
                          ${Number(ratePerMile).toFixed(2)}/mi ×{" "}
                          {Number(formData.distance_miles)} mi
                          {minApplied ? (
                            <>
                              →{" "}
                              <span className="text-amber-600 font-semibold">
                                $50 min applied
                              </span>
                            </>
                          ) : (
                            <>
                              ={" "}
                              <span className="font-bold text-gray-700">
                                {final}
                              </span>
                            </>
                          )}
                          <span className="text-gray-400 ml-1">
                            (editable above)
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
        })}

      {/* ════════════════ MAIN SERVICE (after destination) ════════════════ */}

      {/* Main Service */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase">
            Main Service
          </span>
          {hasMainService && (
            <button
              type="button"
              onClick={() => removeService(mainEntries[0]._origIdx)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Remove
            </button>
          )}
        </div>
        {!hasMainService ? (
          <select
            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            onChange={(e) => {
              addService(e.target.value);
              e.target.value = "";
            }}
            value=""
          >
            <option value="">Select main service…</option>
            {services
              ?.filter((s) => s.is_active && !s.is_addon)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        ) : (
          <div className="space-y-2">
            {mainEntries.map((entry) => {
              const origIdx = entry._origIdx;
              const lineTotal = Math.ceil(
                Number(entry.service_price) * Number(entry.quantity || 1),
              );
              return (
                <div
                  key={origIdx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 flex-wrap"
                >
                  <span className="text-xs font-bold text-blue-600 w-10 shrink-0">
                    COST
                  </span>
                  <div className="flex-1 min-w-[80px]">
                    <p className="text-sm font-semibold text-gray-900">
                      {services?.find((ser) => ser.id == entry.service_id)
                        ?.name ||
                        entry.service_name ||
                        "Service"}
                    </p>
                  </div>
                  <div className="w-32 flex flex-col gap-0.5">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Price
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500 font-semibold">
                        $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                        value={entry.service_price}
                        onChange={(e) =>
                          updateServiceField(
                            origIdx,
                            "service_price",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                  {/* remove old duration field, keep only new highlighted one below */}
                  <div className="flex flex-col gap-0.5 bg-blue-50 border border-blue-300 rounded-lg px-2 py-1.5 min-w-[90px]">
                    <label className="text-[10px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                      ⏱ Duration
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        placeholder="75"
                        title="Duration (minutes)"
                        className="w-14 px-2 py-1 text-sm font-bold text-blue-900 border-2 border-blue-400 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={entry.duration_minutes || ""}
                        onChange={(e) =>
                          updateServiceField(
                            origIdx,
                            "duration_minutes",
                            e.target.value,
                          )
                        }
                      />
                      <span className="text-xs font-semibold text-blue-600">
                        mins
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-14 text-right">
                    ${lineTotal}
                  </span>
                  <button
                    onClick={() => removeService(origIdx)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add-ons section */}
      {addonEntries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">
              ✦ Add-ons
            </span>
            <select
              className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 transition-colors cursor-pointer border-none outline-none"
              onChange={(e) => {
                addService(e.target.value);
                e.target.value = "";
              }}
              value=""
            >
              <option value="">+ Add more</option>
              {services
                ?.filter((s) => s.is_active && s.is_addon)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2 pt-1">
            {addonEntries.map((entry) => {
              const origIdx = entry._origIdx;
              const lineTotal = Math.ceil(
                Number(entry.service_price) * Number(entry.quantity || 1),
              );
              const serviceDef = services?.find(
                (ser) => ser.id == entry.service_id,
              );
              const isStopAddon = serviceDef?.name
                .toLowerCase()
                .includes("stop");

              return (
                <div key={origIdx} className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-xs font-bold text-gray-400 w-10 shrink-0">
                      PLUS
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {serviceDef?.name || "Add-on"}
                      </p>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        placeholder="Price"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                        value={entry.service_price}
                        onChange={(e) =>
                          updateServiceField(
                            origIdx,
                            "service_price",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="w-16">
                      <input
                        type="number"
                        placeholder="Qty"
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded"
                        value={entry.quantity}
                        onChange={(e) =>
                          updateServiceField(
                            origIdx,
                            "quantity",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-14 text-right">
                      ${lineTotal}
                    </span>
                    <button
                      onClick={() => removeService(origIdx)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {isStopAddon && (
                    <div className="ml-14 mr-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <label className="text-xs text-purple-800 font-semibold block mb-1.5">
                        Where is the stop?
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Stop at CVS on Main Street, then Walmart on Oak Ave"
                        value={entry.stop_description || ""}
                        onChange={(e) => {
                          const s = [...formData.services];
                          s[origIdx] = {
                            ...s[origIdx],
                            stop_description: e.target.value,
                          };
                          setFormData({ ...formData, services: s });
                        }}
                        className="w-full px-3 py-2 bg-white border-2 border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add service buttons */}
      {formData.services.length > 0 &&
        services?.some((s) => s.is_active && s.is_addon) &&
        addonEntries.length === 0 && (
          <div className="flex justify-end gap-3">
            <select
              className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full hover:bg-purple-100 transition-colors cursor-pointer border-none outline-none"
              onChange={(e) => {
                addService(e.target.value);
                e.target.value = "";
              }}
              value=""
            >
              <option value="">+ Add add-on</option>
              {services
                ?.filter((s) => s.is_active && s.is_addon)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        )}
    </div>
  );
}
