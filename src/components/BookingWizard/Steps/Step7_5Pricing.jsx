import { useState, useEffect, useCallback } from "react";
import {
  Edit2,
  MapPin,
  DollarSign,
  Calculator,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";

export function Step7_5Pricing({
  formData,
  set,
  selectedService,
  addons,
  isPassengerMode = false,
  ratePerMile = null,
  manualMileage = false,
}) {
  const [editingDistance, setEditingDistance] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [tempDistance, setTempDistance] = useState("");
  const [tempPrice, setTempPrice] = useState("");
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState(null);
  const [durationText, setDurationText] = useState(null);

  // ── TIME-BASED PRICE HELPERS ──────────────────────────────────────────
  const isTimeBased = !!formData.is_time_based;
  const rawHours = parseFloat(formData.trip_duration_hours) || 0;
  const roundedHours = rawHours > 0 ? Math.ceil(rawHours * 4) / 4 : 0;
  const timeBasedPrice = roundedHours * 55;

  // When time-based, lock the price in on load (in case it wasn't already set)
  useEffect(() => {
    if (isTimeBased && roundedHours > 0) {
      set({ service_price: timeBasedPrice });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeBased, roundedHours]);

  // Build address strings for display and distance calc
  const pickupAddr = [
    formData.pickup_street,
    formData.pickup_city,
    formData.pickup_state,
    formData.pickup_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const dropoffAddr = [
    formData.dropoff_street,
    formData.dropoff_city,
    formData.dropoff_state,
    formData.dropoff_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const pickupDisplay = pickupAddr || formData.pickup || "Not set";
  const dropoffDisplay = dropoffAddr || formData.dropoff || "Not set";

  // Helper to auto-apply mileage price when distance changes
  const applyMileagePrice = (miles) => {
    if (ratePerMile && ratePerMile > 0 && miles && miles > 0) {
      const calculatedPrice = Math.max(
        Math.ceil(ratePerMile * Number(miles)),
        50,
      );
      set({ service_price: calculatedPrice });
    }
  };

  // Auto-calculate distance when step loads if we have both addresses and no distance yet
  const calculateDistance = useCallback(async () => {
    // Skip distance calculation entirely for time-based trips
    if (isTimeBased) return;

    const origin = pickupAddr || formData.pickup;
    const destination = dropoffAddr || formData.dropoff;

    if (!origin || !destination) {
      setDistanceError(
        "Both pickup and dropoff addresses are needed to calculate distance.",
      );
      return;
    }

    setCalculatingDistance(true);
    setDistanceError(null);

    try {
      const res = await fetch("/api/appointments/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to calculate distance");
      }

      const data = await res.json();
      if (data.miles !== undefined && data.miles !== null) {
        set({
          distance_miles: data.miles,
          distance_method: data.method || null,
          distance_note: data.note || null,
        });
        applyMileagePrice(data.miles);
        if (data.duration) {
          setDurationText(data.duration);
        }
      }
    } catch (err) {
      console.error("Distance calculation error:", err);
      setDistanceError(err.message || "Could not calculate distance");
    } finally {
      setCalculatingDistance(false);
    }
  }, [
    pickupAddr,
    dropoffAddr,
    formData.pickup,
    formData.dropoff,
    set,
    ratePerMile,
    isTimeBased,
  ]);

  // Auto-calculate on mount — skip for time-based trips and manual mileage mode
  useEffect(() => {
    if (isTimeBased) return;
    if (manualMileage) return;
    const hasAddresses =
      (pickupAddr || formData.pickup) && (dropoffAddr || formData.dropoff);
    const hasNoDistance =
      !formData.distance_miles && formData.distance_miles !== 0;
    if (hasAddresses && hasNoDistance) {
      calculateDistance();
    }
  }, []);

  // Derived values for price display
  const servicePrice = parseFloat(formData.service_price) || 0;

  // Calculate add-ons total from formData.selected_addons
  const selectedAddons = Object.entries(formData.selected_addons || {})
    .filter(([_, qty]) => qty > 0)
    .map(([id, qty]) => {
      const addon = addons?.find((a) => a.id == id);
      if (!addon) return null;
      const customPrice = formData.addon_prices?.[id];
      const hasCustomPrice =
        customPrice !== undefined && customPrice !== "" && customPrice !== null;
      const unitPrice = hasCustomPrice
        ? Number(customPrice)
        : Number(addon.default_price || 0);

      // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
      const isGasFeeAddon = (addon.name || "").toLowerCase().includes("gas");
      // Handle tip addons - calculate as percentage of service price, rounded UP
      let totalPrice;
      if (addon.is_tip_addon && !isGasFeeAddon && servicePrice > 0) {
        // Use unitPrice as the percentage, or parse from name as fallback
        let tipPercent = unitPrice;
        if (tipPercent <= 0) {
          const match = addon.name.match(/(\d+)%/);
          tipPercent = match ? Number(match[1]) : 0;
        }
        if (tipPercent > 0) {
          totalPrice = Math.ceil((servicePrice * tipPercent) / 100);
        } else {
          totalPrice = 0;
        }
      } else {
        totalPrice = unitPrice * qty;
      }

      return {
        id: addon.id,
        name: addon.name,
        qty,
        unitPrice,
        totalPrice,
        isVariable: addon.is_variable_price,
        hasCustomPrice,
        isTip: !!addon.is_tip_addon && !isGasFeeAddon,
      };
    })
    .filter(Boolean);

  const addonsSubtotal = selectedAddons.reduce((sum, a) => {
    if (!a.isVariable || a.hasCustomPrice) {
      return sum + a.totalPrice;
    }
    return sum;
  }, 0);

  // Split for display purposes
  const regularAddonTotal = selectedAddons
    .filter((a) => !a.isTip && (!a.isVariable || a.hasCustomPrice))
    .reduce((sum, a) => sum + a.totalPrice, 0);
  const tipAddonTotal = selectedAddons
    .filter((a) => a.isTip)
    .reduce((sum, a) => sum + a.totalPrice, 0);
  const tipAddons = selectedAddons.filter((a) => a.isTip);

  const extraStops = (formData.services || []).filter(
    (s) => s.stop_description,
  );
  const extraStopTotal = extraStops.reduce(
    (sum, s) => sum + parseFloat(s.service_price || 0),
    0,
  );

  const addonTotal = addonsSubtotal;

  const subtotal = servicePrice + addonTotal + extraStopTotal;
  const ccFeeRate = parseFloat(formData.cc_fee_rate) || 0;
  const ccFee =
    formData.payment_method === "Square Invoice"
      ? parseFloat((subtotal * ccFeeRate).toFixed(2))
      : 0;
  const totalWithFee = subtotal + ccFee;

  // ── DISTANCE METHOD LABEL ─────────────────────────────────────────────
  const distanceMethodLabel =
    formData.distance_method === "osrm"
      ? "via OSRM"
      : formData.distance_method === "valhalla"
        ? "via Valhalla"
        : formData.distance_method === "google_distance_matrix"
          ? "via Google Distance Matrix"
          : formData.distance_method === "google_routes"
            ? "via Google Routes API"
            : formData.distance_method === "geocode_estimate"
              ? "⚠️ Estimate (straight-line)"
              : formData.distance_method
                ? `via ${formData.distance_method}`
                : null;

  return (
    <>
      {/* ── TIME-BASED PRICING BANNER — shown when is_time_based is true ── */}
      {isTimeBased && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-blue-600" />
            <h3 className="text-lg font-bold text-blue-900">Time-Based Trip</h3>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
              Status: Quote
            </span>
          </div>
          <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-blue-700">
              <span>Entered duration:</span>
              <span className="font-semibold">
                {rawHours} hr{rawHours !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex justify-between text-blue-700">
              <span>Rounded up to nearest 15 min:</span>
              <span className="font-semibold">
                {roundedHours} hr{roundedHours !== 1 ? "s" : ""} (
                {Math.round(roundedHours * 60)} min)
              </span>
            </div>
            <div className="flex justify-between text-blue-700">
              <span>Rate:</span>
              <span className="font-semibold">$55.00 / hr</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-blue-100">
              <span className="font-bold text-blue-900">Calculated Price:</span>
              <span className="text-xl font-extrabold text-emerald-700">
                ${timeBasedPrice.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="text-xs text-blue-600">
            Distance calculation is skipped for time-based trips. You can still
            override the price below.
          </p>
        </div>
      )}

      {/* ── DISTANCE SECTION — hidden for time-based trips ────────────── */}
      {!isTimeBased && (
        <>
          {/* Addresses */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MapPin size={20} className="text-pink-500" />
              Route
            </h3>

            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pickup
                  </p>
                  <p className="text-sm text-gray-900 font-medium">
                    {pickupDisplay}
                  </p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-gray-300 ml-1 h-4" />
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Dropoff
                  </p>
                  <p className="text-sm text-gray-900 font-medium">
                    {dropoffDisplay}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Distance */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Calculator size={20} className="text-blue-500" />
              Distance
            </h3>

            {distanceError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {distanceError}
              </div>
            )}

            {durationText && !editingDistance && (
              <div className="mb-2 text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} />
                Drive time: {durationText}
              </div>
            )}

            {/* API method label */}
            {formData.distance_method && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Source</span>
                <span className="text-xs text-gray-400 italic">
                  {distanceMethodLabel}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {editingDistance ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Miles"
                    value={tempDistance}
                    onChange={(e) => setTempDistance(e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-blue-400 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-blue-100"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      const miles = parseFloat(tempDistance);
                      if (!isNaN(miles)) {
                        set({
                          distance_miles: miles,
                          distance_method: "manual",
                        });
                        applyMileagePrice(miles);
                      }
                      setEditingDistance(false);
                    }}
                    className="px-4 py-3 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingDistance(false)}
                    className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                    <span>
                      {formData.distance_miles
                        ? `${Number(formData.distance_miles).toFixed(1)} miles`
                        : "Not calculated"}
                    </span>
                    {formData.distance_miles &&
                      (() => {
                        const m = formData.distance_method;
                        const isEstimate = (m || "").includes("estimate");
                        const isManual = m === "manual";
                        const label =
                          m === "osrm"
                            ? "OSRM"
                            : m === "valhalla"
                              ? "Valhalla"
                              : m === "google_distance_matrix" ||
                                  m === "distance_matrix"
                                ? "Google"
                                : m === "google_routes" || m === "routes_api"
                                  ? "Google Routes"
                                  : isEstimate
                                    ? "⚠️ Estimate"
                                    : isManual
                                      ? "Manual"
                                      : "Auto";
                        const badgeColor = isEstimate
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : isManual
                            ? "bg-gray-100 text-gray-500 border-gray-300"
                            : "bg-blue-100 text-blue-600 border-blue-200";
                        const prefix = isEstimate ? "" : isManual ? "✏️ " : "✓ ";
                        return (
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                          >
                            {prefix}
                            {label}
                          </span>
                        );
                      })()}
                  </div>
                  <button
                    onClick={() => {
                      setTempDistance(formData.distance_miles || "");
                      setEditingDistance(true);
                    }}
                    className="p-3 border-2 border-gray-200 rounded-2xl hover:border-blue-400 transition-colors"
                    title="Edit distance"
                  >
                    <Edit2 size={18} className="text-gray-500" />
                  </button>
                  {manualMileage && (
                    <div className="text-xs text-gray-500">
                      <span className="font-semibold">Manual mode:</span>{" "}
                      Distance is not automatically calculated. Use the "Save"
                      button to apply the entered value.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rate per mile hint */}
            {ratePerMile && ratePerMile > 0 && formData.distance_miles && (
              <p className="text-xs text-gray-500 mt-2">
                Rate: ${ratePerMile}/mile ×{" "}
                {Number(formData.distance_miles).toFixed(1)} mi = $
                {Math.max(
                  Math.ceil(ratePerMile * Number(formData.distance_miles)),
                  50,
                ).toFixed(2)}{" "}
                (min $50)
              </p>
            )}
          </div>
        </>
      )}

      {/* ── PRICE SECTION — always shown ─────────────────────────────── */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3">
          <DollarSign size={20} className="text-emerald-500" />
          Price
        </h3>

        {editingPrice ? (
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Price"
              value={tempPrice}
              onChange={(e) => setTempPrice(e.target.value)}
              className="flex-1 px-4 py-3 border-2 border-emerald-400 rounded-2xl text-base focus:outline-none focus:ring-4 focus:ring-emerald-100"
              autoFocus
            />
            <button
              onClick={() => {
                const price = parseFloat(tempPrice);
                if (!isNaN(price)) {
                  set({ service_price: price });
                }
                setEditingPrice(false);
              }}
              className="px-4 py-3 bg-emerald-600 text-white font-semibold rounded-2xl hover:bg-emerald-700 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditingPrice(false)}
              className="px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-xl font-bold text-emerald-700">
              {servicePrice > 0 ? `$${servicePrice.toFixed(2)}` : "Not set"}
            </div>
            <button
              onClick={() => {
                setTempPrice(formData.service_price || "");
                setEditingPrice(true);
              }}
              className="p-3 border-2 border-gray-200 rounded-2xl hover:border-emerald-400 transition-colors"
              title="Edit price"
            >
              <Edit2 size={18} className="text-gray-500" />
            </button>
          </div>
        )}
      </div>

      {/* Price breakdown (addons, extras, CC fee) */}
      {(addonTotal > 0 || extraStopTotal > 0 || ccFee > 0) && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-bold text-emerald-900 mb-2">
            Price Breakdown
          </p>

          {servicePrice > 0 && (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>Base service</span>
              <span className="font-semibold">${servicePrice.toFixed(2)}</span>
            </div>
          )}

          {regularAddonTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>Add-ons</span>
              <span className="font-semibold">
                ${regularAddonTotal.toFixed(2)}
              </span>
            </div>
          )}

          {extraStopTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>Extra stops</span>
              <span className="font-semibold">
                ${extraStopTotal.toFixed(2)}
              </span>
            </div>
          )}

          {tipAddonTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>
                Tip (
                {tipAddons
                  .map((a) => {
                    let pct = a.unitPrice;
                    if (pct <= 0) {
                      const match = (a.name || "").match(/(\d+)%/);
                      pct = match ? Number(match[1]) : 0;
                    }
                    return `${pct}%`;
                  })
                  .join(", ")}{" "}
                of service)
              </span>
              <span className="font-semibold">${tipAddonTotal.toFixed(2)}</span>
            </div>
          )}

          {ccFee > 0 && (
            <div className="flex justify-between text-sm text-emerald-800">
              <span>CC fee ({(ccFeeRate * 100).toFixed(1)}%)</span>
              <span className="font-semibold">${ccFee.toFixed(2)}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-300">
            <span className="text-xl font-bold text-emerald-900">Total</span>
            <span className="text-2xl font-bold text-emerald-700">
              ${totalWithFee.toFixed(2)}
            </span>
          </div>

          <p className="text-xs text-emerald-700 pt-2 border-t border-emerald-200">
            ℹ️ Price calculated from service selection + all add-ons + extras
          </p>
        </div>
      )}

      {/* Payment Method */}
      <div>
        <p className="font-semibold text-gray-700 mb-3">Payment Method</p>
        <div className="space-y-3">
          {["Square Invoice", "Venmo", "Zelle", "Cash", "Comp"].map(
            (method) => (
              <button
                key={method}
                onClick={() => set({ payment_method: method })}
                className={`w-full p-4 text-left border-2 rounded-2xl transition-all font-semibold text-gray-900 ${
                  formData.payment_method === method
                    ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 scale-[1.02]"
                    : "border-gray-200 hover:border-gray-300 hover:scale-[1.01]"
                }`}
              >
                {method === "Comp" ? "🎁 Comp" : method}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  );
}
