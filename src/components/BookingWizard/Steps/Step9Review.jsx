import { useState } from "react";
import { buildAddress } from "@/utils/addressParser";
import { Loader2, Clock, Edit2, CheckCircle2 } from "lucide-react";

function formatDateTime(date, time) {
  if (!date) return "";

  // Handle datetime-local format (YYYY-MM-DDTHH:MM)
  if (date.includes("T")) {
    const dt = new Date(date);
    // Validate date is finite
    if (isNaN(dt.getTime())) return "";
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    const year = dt.getFullYear();
    let h = dt.getHours();
    const mm = String(dt.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${month}/${day}/${year} ${h}:${mm} ${ampm}`;
  }

  // Handle separate date and time
  const [y, m, d] = date.split("-");
  const datePart = `${m}/${d}/${y}`;
  if (!time) return datePart;
  const [hh, mm] = time.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${datePart} ${h}:${mm} ${ampm}`;
}

export function Step9Review({
  formData,
  set,
  selectedService,
  addons,
  validationErrors,
  isPassengerMode = false,
  ratePerMile = null,
  onSubmit = null,
  isSubmitting = false,
}) {
  const [estimatedMiles, setEstimatedMiles] = useState(
    formData.distance_miles || null,
  );
  const [editingDistance, setEditingDistance] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [tempDistance, setTempDistance] = useState("");
  const [tempPrice, setTempPrice] = useState("");

  // Check if passenger has provided minimal information (only name and date)
  const hasMinimalInfo = (() => {
    const hasPhone = formData.phone && formData.phone.trim();
    const hasEmail = formData.email && formData.email.trim();
    const hasTime = formData.time && formData.time.trim();
    const hasPickup =
      formData.pickup || formData.pickup_street || formData.pickup_city;
    const hasDropoff =
      formData.dropoff || formData.dropoff_street || formData.dropoff_city;
    const hasDestination = formData.destination && formData.destination.trim();
    const hasService = formData.service_id;
    const hasNotes = formData.notes && formData.notes.trim();
    const hasSpecialRequests =
      formData.special_requests && formData.special_requests.trim();

    // If they have NONE of these details, they only have name + date
    return (
      !hasPhone &&
      !hasEmail &&
      !hasTime &&
      !hasPickup &&
      !hasDropoff &&
      !hasDestination &&
      !hasService &&
      !hasNotes &&
      !hasSpecialRequests
    );
  })();

  // Build pickup/dropoff display strings from structured fields (for display only)
  const pickupDisplay =
    formData.pickup_street ||
    formData.pickup_city ||
    formData.pickup_state ||
    formData.pickup_zip
      ? buildAddress({
          street_address: formData.pickup_street,
          city: formData.pickup_city,
          state: formData.pickup_state,
          zip_code: formData.pickup_zip,
        })
      : formData.pickup;

  const dropoffDisplay =
    formData.dropoff_street ||
    formData.dropoff_city ||
    formData.dropoff_state ||
    formData.dropoff_zip
      ? buildAddress({
          street_address: formData.dropoff_street,
          city: formData.dropoff_city,
          state: formData.dropoff_state,
          zip_code: formData.dropoff_zip,
        })
      : formData.dropoff;

  // Calculate service price (base price) - MOVED HERE so it's available for tip addon calculation
  const servicePrice = (() => {
    if (
      formData.service_price !== "" &&
      formData.service_price !== undefined &&
      formData.service_price !== null
    ) {
      return Number(formData.service_price);
    }
    if (selectedService) {
      return Number(selectedService.default_price ?? 0);
    }
    return 0;
  })();

  // Add-ons breakdown
  const addonDetails = (() => {
    if (!formData.selected_addons || !addons) return [];
    const isRoundTrip = formData.is_round_trip && formData.return_date;

    return Object.entries(formData.selected_addons)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const addon = addons.find((a) => a.id == id);
        if (!addon) return null;

        if (isRoundTrip && formData.addon_legs?.[id]) {
          const legs = formData.addon_legs[id];
          // Only show on the outbound trip if outgoing leg is selected
          if (!legs.includes("outgoing")) return null;

          const customPrice = formData.addon_prices?.[`${id}_outgoing`];
          const hasCustomPrice =
            customPrice !== undefined &&
            customPrice !== "" &&
            customPrice !== null;
          const unitPrice = hasCustomPrice
            ? Number(customPrice)
            : Number(addon.default_price || 0);

          // FIX: Handle tip addons specially - calculate as percentage of service price, rounded UP
          // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
          const isGasFeeAddon = (addon.name || "")
            .toLowerCase()
            .includes("gas");
          let totalPrice;
          if (addon.is_tip_addon && !isGasFeeAddon && servicePrice > 0) {
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
            name: addon.name + " (outgoing)",
            quantity: qty,
            unitPrice,
            totalPrice,
            isVariable: addon.is_variable_price,
            hasCustomPrice,
          };
        }

        // One-way or no leg selection
        const customPrice = formData.addon_prices?.[id];
        const hasCustomPrice =
          customPrice !== undefined &&
          customPrice !== "" &&
          customPrice !== null;
        const unitPrice = hasCustomPrice
          ? Number(customPrice)
          : Number(addon.default_price || 0);

        // FIX: Handle tip addons specially - calculate as percentage of service price, rounded UP
        // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
        const isGasFeeAddon2 = (addon.name || "").toLowerCase().includes("gas");
        let totalPrice;
        if (addon.is_tip_addon && !isGasFeeAddon2 && servicePrice > 0) {
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
          quantity: qty,
          unitPrice,
          totalPrice,
          isVariable: addon.is_variable_price,
          hasCustomPrice,
        };
      })
      .filter(Boolean);
  })();

  // Calculate add-ons total
  const addonsTotal = (() => {
    let total = 0;
    addonDetails.forEach((addon) => {
      if (!addon.isVariable || addon.hasCustomPrice) {
        // FIX: Use addon.id for lookup instead of name matching
        const addonDef = addons.find((a) => a.id == addon.id);
        const isGasFeeAddonDef = (addonDef?.name || "")
          .toLowerCase()
          .includes("gas");
        if (addonDef?.is_tip_addon && !isGasFeeAddonDef) {
          // Tip addon: calculate as percentage of service price, rounded UP
          let tipPercent = addon.unitPrice;
          if (tipPercent <= 0) {
            const match = (addonDef.name || "").match(/(\d+)%/);
            tipPercent = match ? Number(match[1]) : 0;
          }
          if (tipPercent > 0 && servicePrice > 0) {
            const tipAmount = Math.ceil((servicePrice * tipPercent) / 100);
            total += tipAmount;
          }
        } else {
          // Regular addon: use totalPrice directly
          total += addon.totalPrice;
        }
      }
    });
    return total;
  })();

  // Calculate car seats and golf bags fees (if they have prices in services)
  // Note: These might be included in add-ons or could be separate
  const carSeatsFee = 0; // Placeholder - set to actual fee if applicable
  const golfBagsFee = 0; // Placeholder - set to actual fee if applicable

  // Calculate subtotal (service + add-ons + extras)
  const subtotal = servicePrice + addonsTotal + carSeatsFee + golfBagsFee;

  // Calculate Square processing fee if Square Invoice is selected
  // Server rounds up base amount and fee separately with Math.ceil
  const processingFee = (() => {
    if (formData.payment_method === "Square Invoice" && subtotal > 0) {
      // Fetch fee percentage from settings would be ideal, but default to 4%
      // to match server-side calculation
      const feePercent = 4;
      return Math.round((subtotal * feePercent) / 100);
    }
    return 0;
  })();

  const totalWithFee = Math.ceil(subtotal) + processingFee;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isPassengerMode ? "Review & Payment" : "Review & Payment"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isPassengerMode
            ? "Review your trip details and choose a payment method"
            : "Review your trip details and choose payment method"}
        </p>
      </div>

      {/* Minimal Info Warning - Ask for Message */}
      {hasMinimalInfo && (
        <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0 mt-1">
              <span className="text-white text-xl">✉️</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900 text-lg mb-2">
                Since you didn't enter any details, is there a message you would
                like to include?
              </p>
              <p className="text-amber-800 mb-3 text-sm">
                If this is urgent, but during normal business hours, you can
                call{" "}
                <a
                  href="tel:6157568152"
                  className="font-semibold underline hover:text-amber-900"
                >
                  (615) 756-8152
                </a>
                .
              </p>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Enter your message here... (pickup location, time, any special requests, etc.)"
                rows={6}
                className="w-full px-4 py-3 border-2 border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-gray-900 placeholder:text-gray-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* NEW: Referred By Field - For passenger-facing bookings */}
      {isPassengerMode && (
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            How did you hear about us? (optional)
          </label>
          <input
            type="text"
            value={formData.referral_source || ""}
            onChange={(e) => set({ referral_source: e.target.value })}
            placeholder="e.g., Google, Facebook, Friend, etc."
            className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
          />
        </div>
      )}

      {/* Inline Editable Distance & Price - DISPATCH MODE ONLY, NOT FOR TOURS */}
      {!isPassengerMode && !formData.is_tour && (
        <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl">
          <div className="flex items-center gap-2 pb-1">
            <Edit2 size={16} className="text-indigo-600" />
            <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
              Distance & Pricing (Editable)
            </span>
          </div>

          {/* Distance */}
          <div>
            <label className="text-sm font-semibold text-indigo-800 block mb-2">
              Distance (miles)
            </label>
            {editingDistance ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  autoFocus
                  value={tempDistance}
                  onChange={(e) => setTempDistance(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const miles = parseFloat(tempDistance);
                      if (!isNaN(miles) && miles >= 0) {
                        set({ distance_miles: miles });
                        setEstimatedMiles(miles);
                        setEditingDistance(false);
                      }
                    }
                    if (e.key === "Escape") {
                      setEditingDistance(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <button
                  onClick={() => {
                    const miles = parseFloat(tempDistance);
                    if (!isNaN(miles) && miles >= 0) {
                      set({ distance_miles: miles });
                      setEstimatedMiles(miles);
                      setEditingDistance(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingDistance(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setTempDistance(formData.distance_miles || "");
                  setEditingDistance(true);
                }}
                className="flex items-center justify-between px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl hover:border-indigo-400 cursor-pointer transition-all group"
              >
                <span className="text-gray-900 font-medium">
                  {formData.distance_miles
                    ? `${Number(formData.distance_miles).toFixed(1)} miles`
                    : "Not set"}
                </span>
                <Edit2
                  size={16}
                  className="text-indigo-400 group-hover:text-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Service Price */}
          <div>
            <label className="text-sm font-semibold text-indigo-800 block mb-2">
              Service Price
            </label>
            {editingPrice ? (
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-gray-600 text-lg">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={tempPrice}
                    onChange={(e) => setTempPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const price = parseFloat(tempPrice);
                        if (!isNaN(price) && price >= 0) {
                          set({ service_price: price });
                          setEditingPrice(false);
                        }
                      }
                      if (e.key === "Escape") {
                        setEditingPrice(false);
                      }
                    }}
                    className="flex-1 px-4 py-2 border-2 border-indigo-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    const price = parseFloat(tempPrice);
                    if (!isNaN(price) && price >= 0) {
                      set({ service_price: price });
                      setEditingPrice(false);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingPrice(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setTempPrice(
                    formData.service_price !== undefined &&
                      formData.service_price !== null &&
                      formData.service_price !== ""
                      ? formData.service_price
                      : selectedService?.default_price || "",
                  );
                  setEditingPrice(true);
                }}
                className="flex items-center justify-between px-4 py-3 bg-white border-2 border-indigo-200 rounded-xl hover:border-indigo-400 cursor-pointer transition-all group"
              >
                <span className="text-gray-900 font-medium">
                  {formData.service_price !== undefined &&
                  formData.service_price !== null &&
                  formData.service_price !== ""
                    ? `$${Number(formData.service_price).toFixed(2)}`
                    : selectedService?.default_price
                      ? `$${Number(selectedService.default_price).toFixed(2)} (default)`
                      : "Not set"}
                </span>
                <Edit2
                  size={16}
                  className="text-indigo-400 group-hover:text-indigo-600"
                />
              </div>
            )}
            <p className="text-xs text-indigo-700 mt-1">
              Click to override the service price for this trip
            </p>
          </div>
        </div>
      )}

      {/* Total Trip Price Breakdown - NOT FOR TOURS */}
      {!isPassengerMode &&
        !formData.is_tour &&
        (selectedService || servicePrice > 0 || addonsTotal > 0) &&
        (() => {
          const isRoundTrip = formData.is_round_trip && formData.return_date;

          // Build per-leg addon lists & totals
          const buildLegAddons = (leg) => {
            if (!formData.selected_addons || !addons) return [];
            return Object.entries(formData.selected_addons)
              .filter(([_, qty]) => qty > 0)
              .map(([id, qty]) => {
                const addon = addons.find((a) => a.id == id);
                if (!addon) return null;
                if (isRoundTrip && formData.addon_legs?.[id]) {
                  if (!formData.addon_legs[id].includes(leg)) return null;
                  const customPrice = formData.addon_prices?.[`${id}_${leg}`];
                  const hasCustomPrice =
                    customPrice !== undefined &&
                    customPrice !== "" &&
                    customPrice !== null;
                  const unitPrice = hasCustomPrice
                    ? Number(customPrice)
                    : Number(addon.default_price || 0);

                  // FIX: Handle tip addons - calculate as percentage of service price, rounded UP
                  // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
                  const isGasFeeAddon3 = (addon.name || "")
                    .toLowerCase()
                    .includes("gas");
                  let totalPrice;
                  if (
                    addon.is_tip_addon &&
                    !isGasFeeAddon3 &&
                    servicePrice > 0
                  ) {
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
                    quantity: qty,
                    unitPrice,
                    totalPrice,
                    isVariable: addon.is_variable_price,
                    hasCustomPrice,
                  };
                }
                if (!isRoundTrip && leg === "outgoing") {
                  const customPrice = formData.addon_prices?.[id];
                  const hasCustomPrice =
                    customPrice !== undefined &&
                    customPrice !== "" &&
                    customPrice !== null;
                  const unitPrice = hasCustomPrice
                    ? Number(customPrice)
                    : Number(addon.default_price || 0);

                  // FIX: Handle tip addons - calculate as percentage of service price, rounded UP
                  // Gas fee addons are NEVER percentage-based — always use flat dollar default_price.
                  const isGasFeeAddon4 = (addon.name || "")
                    .toLowerCase()
                    .includes("gas");
                  let totalPrice;
                  if (
                    addon.is_tip_addon &&
                    !isGasFeeAddon4 &&
                    servicePrice > 0
                  ) {
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
                    quantity: qty,
                    unitPrice,
                    totalPrice,
                    isVariable: addon.is_variable_price,
                    hasCustomPrice,
                  };
                }
                return null;
              })
              .filter(Boolean);
          };

          const outLegAddons = buildLegAddons("outgoing");
          const inLegAddons = buildLegAddons("incoming");

          const legAddonTotal = (list) =>
            list.reduce((s, a) => {
              if (!a.isVariable || a.hasCustomPrice) {
                // FIX: Use a.id for lookup instead of matching by name
                const addonDef = addons.find((addon) => addon.id == a.id);
                const isGasFeeAddonLeg = (addonDef?.name || "")
                  .toLowerCase()
                  .includes("gas");
                if (addonDef?.is_tip_addon && !isGasFeeAddonLeg) {
                  // Tip addon: calculate as percentage of service price, rounded UP
                  let tipPercent = a.unitPrice;
                  if (tipPercent <= 0) {
                    const match = (addonDef.name || "").match(/(\d+)%/);
                    tipPercent = match ? Number(match[1]) : 0;
                  }
                  if (tipPercent > 0 && servicePrice > 0) {
                    return s + Math.ceil((servicePrice * tipPercent) / 100);
                  }
                  return s;
                }
                // Regular addon
                return s + a.totalPrice;
              }
              return s;
            }, 0);

          const outLegAddonsTotal = legAddonTotal(outLegAddons);
          const inLegAddonsTotal = legAddonTotal(inLegAddons);

          // For round trips: service price applies to each leg separately
          const outLegSubtotal = servicePrice + outLegAddonsTotal;
          const inLegSubtotal = servicePrice + inLegAddonsTotal;
          const combinedSubtotal = isRoundTrip
            ? outLegSubtotal + inLegSubtotal
            : subtotal;

          const combinedProcessingFee = (() => {
            if (
              formData.payment_method === "Square Invoice" &&
              combinedSubtotal > 0
            ) {
              return Math.round((combinedSubtotal * 4) / 100);
            }
            return 0;
          })();

          const combinedTotal =
            Math.ceil(combinedSubtotal) + combinedProcessingFee;

          return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-emerald-200">
                <span className="text-lg font-bold text-emerald-900">
                  💰 Total Trip Price{isRoundTrip ? " — Both Legs" : ""}
                </span>
              </div>

              {/* Variable price warning */}
              {selectedService &&
                servicePrice === 0 &&
                selectedService.is_variable_price && (
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <p className="text-sm text-amber-800">
                      <strong>{selectedService.name}</strong> is a
                      variable-price service. Please set the price above before
                      saving.
                    </p>
                  </div>
                )}

              {isRoundTrip ? (
                <div className="space-y-4">
                  {/* ── OUTGOING LEG ── */}
                  <div className="rounded-xl border border-blue-200 overflow-hidden">
                    <div className="bg-blue-100 px-3 py-2 flex items-center gap-2">
                      <span className="text-blue-700 text-sm">✈️</span>
                      <span className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                        Outgoing Leg
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5 text-sm bg-white">
                      {selectedService && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">
                            {selectedService.name}
                            {estimatedMiles && Number(estimatedMiles) > 0 && (
                              <span className="text-gray-400 text-xs">
                                {" "}
                                • {Number(estimatedMiles).toFixed(1)} mi
                              </span>
                            )}
                          </span>
                          <span className="font-semibold text-gray-900">
                            ${servicePrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {outLegAddons.map((a, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center text-xs"
                        >
                          <span className="text-gray-500">
                            {a.name}
                            {a.quantity > 1 && ` ×${a.quantity}`}
                          </span>
                          <span className="font-medium text-gray-700">
                            {a.isVariable && !a.hasCustomPrice ? (
                              <span className="italic text-gray-400">TBD</span>
                            ) : (
                              `$${a.totalPrice.toFixed(2)}`
                            )}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1.5 border-t border-blue-100 font-semibold">
                        <span className="text-blue-800">Outgoing Subtotal</span>
                        <span className="text-blue-900">
                          ${outLegSubtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── RETURN LEG ── */}
                  <div className="rounded-xl border border-emerald-200 overflow-hidden">
                    <div className="bg-emerald-100 px-3 py-2 flex items-center gap-2">
                      <span className="text-emerald-700 text-sm">🔄</span>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                        Return Leg
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5 text-sm bg-white">
                      {selectedService && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">
                            {selectedService.name}
                          </span>
                          <span className="font-semibold text-gray-900">
                            ${servicePrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {inLegAddons.length > 0 ? (
                        inLegAddons.map((a, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center text-xs"
                          >
                            <span className="text-gray-500">
                              {a.name}
                              {a.quantity > 1 && ` ×${a.quantity}`}
                            </span>
                            <span className="font-medium text-gray-700">
                              {a.isVariable && !a.hasCustomPrice ? (
                                <span className="italic text-gray-400">
                                  TBD
                                </span>
                              ) : (
                                `$${a.totalPrice.toFixed(2)}`
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          No add-ons for this leg
                        </p>
                      )}
                      <div className="flex justify-between items-center pt-1.5 border-t border-emerald-100 font-semibold">
                        <span className="text-emerald-800">
                          Return Subtotal
                        </span>
                        <span className="text-emerald-900">
                          ${inLegSubtotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Extras */}
                  {(Number(formData.num_car_seats) > 0 ||
                    Number(formData.num_golf_bags) > 0) && (
                    <div className="text-sm space-y-1">
                      {Number(formData.num_car_seats) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            🧸 Car Seats (×{formData.num_car_seats})
                          </span>
                          <span className="text-xs text-gray-400 italic">
                            Included
                          </span>
                        </div>
                      )}
                      {Number(formData.num_golf_bags) > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">
                            🏌️ Golf Bags (×{formData.num_golf_bags})
                          </span>
                          <span className="text-xs text-gray-400 italic">
                            Included
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Combined totals */}
                  <div className="space-y-2 pt-2 border-t-2 border-emerald-200">
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-gray-700">
                        Combined Subtotal
                      </span>
                      <span className="font-bold text-gray-900">
                        ${combinedSubtotal.toFixed(2)}
                      </span>
                    </div>
                    {combinedProcessingFee > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">
                          Processing Fee{" "}
                          <span className="text-xs text-gray-400">(4%)</span>
                        </span>
                        <span className="font-medium text-gray-700">
                          ${combinedProcessingFee.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t-2 border-emerald-300">
                      <span className="text-xl font-bold text-emerald-900">
                        Grand Total
                      </span>
                      <span className="text-2xl font-bold text-emerald-700">
                        ${combinedTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ONE-WAY: flat list as before */
                <div className="space-y-2">
                  {selectedService && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">
                        {selectedService.name}
                        {estimatedMiles && Number(estimatedMiles) > 0 && (
                          <span className="text-sm text-gray-500">
                            {" "}
                            • {Number(estimatedMiles).toFixed(1)} mi
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-gray-900">
                        ${servicePrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {addonDetails.map((addon, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-gray-600">
                        {addon.name}
                        {addon.quantity > 1 && ` (×${addon.quantity})`}
                      </span>
                      <span className="font-medium text-gray-800">
                        {addon.isVariable && !addon.hasCustomPrice ? (
                          <span className="text-xs text-gray-500 italic">
                            TBD
                          </span>
                        ) : (
                          `$${addon.totalPrice.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  ))}
                  {Number(formData.num_car_seats) > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        🧸 Car Seats (×{formData.num_car_seats})
                      </span>
                      <span className="text-xs text-gray-500 italic">
                        Included
                      </span>
                    </div>
                  )}
                  {Number(formData.num_golf_bags) > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        🏌️ Golf Bags (×{formData.num_golf_bags})
                      </span>
                      <span className="text-xs text-gray-500 italic">
                        Included
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                    <span className="font-semibold text-gray-800">
                      Subtotal
                    </span>
                    <span className="font-bold text-gray-900">
                      ${subtotal.toFixed(2)}
                    </span>
                  </div>
                  {processingFee > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        Processing Fee{" "}
                        <span className="text-xs text-gray-400">(4%)</span>
                      </span>
                      <span className="font-medium text-gray-700">
                        ${processingFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-300">
                    <span className="text-xl font-bold text-emerald-900">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-emerald-700">
                      ${totalWithFee.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-xs text-emerald-700 pt-2 border-t border-emerald-200">
                ℹ️ Price calculated from service selection + all add-ons + extras
                (car seats, golf bags, etc.)
              </p>
            </div>
          );
        })()}

      {/* Payment Method Selection - Show for both passenger and dispatch */}
      <div>
        <p className="font-semibold text-gray-700 mb-3">
          {isPassengerMode ? "How would you like to pay?" : "Payment Method"}
        </p>
        <div className="space-y-3">
          {["Square Invoice", "Venmo", "Zelle", "Cash", "Farm"].map(
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
                {method}
              </button>
            ),
          )}
        </div>
        {isPassengerMode && (
          <p className="text-xs text-gray-500 mt-2">
            Optional — you can choose your preferred payment method, or we'll
            follow up with you.
          </p>
        )}
      </div>

      {/* Full Booking Summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 text-sm">
        {isPassengerMode && (
          <p className="text-center text-base font-semibold text-indigo-700 mb-2">
            ⬇️ Scroll down to submit this request
          </p>
        )}
        <p className="font-bold text-gray-700 mb-3">📋 Trip Summary</p>

        {/* Passenger / Contact */}
        <SummaryRow label="Name" value={formData.name} />
        <SummaryRow label="Phone" value={formData.phone} />
        {formData.email && <SummaryRow label="Email" value={formData.email} />}

        {/* Payment Method */}
        {formData.payment_method && (
          <SummaryRow label="Payment Method" value={formData.payment_method} />
        )}

        {/* Dispatcher Name (Admin-only) */}
        {!isPassengerMode && formData.booker_name && (
          <SummaryRow label="Booked By" value={formData.booker_name} />
        )}

        {/* Passengers & Bags */}
        {(formData.num_people ||
          formData.num_bags_checked ||
          formData.num_bags_carry_on) && (
          <SummaryRow
            label="Passengers / Bags"
            value={`${formData.num_people || 0} passenger(s), ${formData.num_bags_checked || 0} checked, ${formData.num_bags_carry_on || 0} carry-on`}
          />
        )}

        {/* Car seats & golf bags */}
        {(Number(formData.num_car_seats) > 0 ||
          Number(formData.num_golf_bags) > 0) && (
          <SummaryRow
            label="Extras"
            value={[
              Number(formData.num_car_seats) > 0
                ? `${formData.num_car_seats} car seat(s)`
                : null,
              Number(formData.num_golf_bags) > 0
                ? `${formData.num_golf_bags} golf bag(s)`
                : null,
            ]
              .filter(Boolean)
              .join(", ")}
          />
        )}

        {/* Customs clearance */}
        {formData.customs_clearance_location && (
          <SummaryRow
            label="Customs Clearance"
            value={formData.customs_clearance_location}
          />
        )}

        {formData.special_requests && (
          <SummaryRow
            label="Special Requests"
            value={formData.special_requests}
          />
        )}

        {formData.notes && <SummaryRow label="Notes" value={formData.notes} />}

        {formData.requested_driver_name && (
          <SummaryRow
            label="Preferred Driver"
            value={formData.requested_driver_name}
          />
        )}

        {formData.vehicle_category && (
          <SummaryRow label="Vehicle Type" value={formData.vehicle_category} />
        )}

        {formData.referral_source && (
          <SummaryRow
            label="How They Heard About Us"
            value={formData.referral_source}
          />
        )}
      </div>

      {/* ── LEG DETAILS ──────────────────────────────────────────────── */}
      {(() => {
        const isRoundTrip = formData.is_round_trip && formData.return_date;

        // Helper: collect addons for a specific leg (or all addons for one-way)
        const legAddons = (leg) => {
          if (!formData.selected_addons || !addons) return [];
          return Object.entries(formData.selected_addons)
            .filter(([_, qty]) => qty > 0)
            .map(([id, qty]) => {
              const addon = addons.find((a) => a.id == id);
              if (!addon) return null;
              const vehicleKeywords = ["suv", "luxury vehicle", "vehicle"];
              const isVehicleAddon = vehicleKeywords.some((kw) =>
                addon.name.toLowerCase().includes(kw),
              );
              const effectivelyVariable =
                addon.is_variable_price ||
                (isVehicleAddon && Number(addon.default_price || 0) === 0);

              if (isRoundTrip && formData.addon_legs?.[id]) {
                const legs = formData.addon_legs[id];
                if (!legs.includes(leg)) return null;
                const customPrice = formData.addon_prices?.[`${id}_${leg}`];
                const hasCustomPrice =
                  customPrice !== undefined &&
                  customPrice !== "" &&
                  customPrice !== null;
                const unitPrice = hasCustomPrice
                  ? Number(customPrice)
                  : Number(addon.default_price || 0);
                return {
                  name: addon.name,
                  quantity: qty,
                  unitPrice,
                  totalPrice: unitPrice * qty,
                  isVariable: effectivelyVariable,
                  hasCustomPrice,
                };
              }
              // One-way — show all selected addons
              if (!isRoundTrip && leg === "outgoing") {
                const customPrice = formData.addon_prices?.[id];
                const hasCustomPrice =
                  customPrice !== undefined &&
                  customPrice !== "" &&
                  customPrice !== null;
                const unitPrice = hasCustomPrice
                  ? Number(customPrice)
                  : Number(addon.default_price || 0);
                return {
                  name: addon.name,
                  quantity: qty,
                  unitPrice,
                  totalPrice: unitPrice * qty,
                  isVariable: effectivelyVariable,
                  hasCustomPrice,
                };
              }
              return null;
            })
            .filter(Boolean);
        };

        const outgoingAddons = legAddons("outgoing");
        const incomingAddons = legAddons("incoming");

        if (isRoundTrip) {
          return (
            <div className="space-y-4">
              {/* OUTGOING LEG */}
              <div className="border-2 border-blue-300 rounded-2xl overflow-hidden">
                <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-white text-lg">✈️</span>
                  <span className="text-white font-bold text-sm uppercase tracking-wider">
                    Outgoing Leg
                  </span>
                </div>
                <div className="bg-blue-50 p-4 space-y-2 text-sm">
                  <SummaryRow
                    label="Date & Time"
                    value={formatDateTime(formData.date, formData.time)}
                  />
                  {pickupDisplay && (
                    <SummaryRow label="Pickup" value={pickupDisplay} />
                  )}
                  {dropoffDisplay && (
                    <SummaryRow label="Dropoff" value={dropoffDisplay} />
                  )}
                  {formData.destination && (
                    <SummaryRow
                      label="Destination"
                      value={formData.destination}
                    />
                  )}
                  {formData.outgoing_flight_info && (
                    <SummaryRow
                      label="Flight"
                      value={formData.outgoing_flight_info}
                    />
                  )}
                  {selectedService && (
                    <SummaryRow label="Service" value={selectedService.name} />
                  )}
                  {outgoingAddons.length > 0 && (
                    <div className="pt-2 border-t border-blue-200 space-y-1">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
                        Add-ons
                      </p>
                      {outgoingAddons.map((a, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-600">
                            {a.name}
                            {a.quantity > 1 && ` ×${a.quantity}`}
                          </span>
                          <span className="font-medium text-gray-800">
                            {a.isVariable && !a.hasCustomPrice ? (
                              <span className="text-xs text-gray-400 italic">
                                TBD
                              </span>
                            ) : (
                              `$${a.totalPrice.toFixed(2)}`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RETURN LEG */}
              <div className="border-2 border-emerald-300 rounded-2xl overflow-hidden">
                <div className="bg-emerald-600 px-4 py-2.5 flex items-center gap-2">
                  <span className="text-white text-lg">🔄</span>
                  <span className="text-white font-bold text-sm uppercase tracking-wider">
                    Return Leg
                  </span>
                </div>
                <div className="bg-emerald-50 p-4 space-y-2 text-sm">
                  <SummaryRow
                    label="Date & Time"
                    value={formatDateTime(
                      formData.return_date,
                      formData.return_time || "",
                    )}
                  />
                  {/* Reversed addresses for return */}
                  {dropoffDisplay && (
                    <SummaryRow label="Pickup" value={dropoffDisplay} />
                  )}
                  {pickupDisplay && (
                    <SummaryRow label="Dropoff" value={pickupDisplay} />
                  )}
                  {formData.destination && (
                    <SummaryRow
                      label="Destination"
                      value={formData.destination}
                    />
                  )}
                  {formData.returning_flight_info && (
                    <SummaryRow
                      label="Flight"
                      value={formData.returning_flight_info}
                    />
                  )}
                  {selectedService && (
                    <SummaryRow label="Service" value={selectedService.name} />
                  )}
                  {incomingAddons.length > 0 && (
                    <div className="pt-2 border-t border-emerald-200 space-y-1">
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                        Add-ons
                      </p>
                      {incomingAddons.map((a, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center"
                        >
                          <span className="text-gray-600">
                            {a.name}
                            {a.quantity > 1 && ` ×${a.quantity}`}
                          </span>
                          <span className="font-medium text-gray-800">
                            {a.isVariable && !a.hasCustomPrice ? (
                              <span className="text-xs text-gray-400 italic">
                                TBD
                              </span>
                            ) : (
                              `$${a.totalPrice.toFixed(2)}`
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {incomingAddons.length === 0 && (
                    <p className="text-xs text-gray-400 italic">
                      No add-ons selected for this leg
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        }

        // ONE-WAY: single leg card
        return (
          <div className="border-2 border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-gray-700 px-4 py-2.5 flex items-center gap-2">
              <span className="text-white text-lg">🗺️</span>
              <span className="text-white font-bold text-sm uppercase tracking-wider">
                Trip Details
              </span>
            </div>
            <div className="bg-white p-4 space-y-2 text-sm">
              <SummaryRow
                label="Date & Time"
                value={formatDateTime(formData.date, formData.time)}
              />
              {pickupDisplay && (
                <SummaryRow label="Pickup" value={pickupDisplay} />
              )}
              {dropoffDisplay && (
                <SummaryRow label="Dropoff" value={dropoffDisplay} />
              )}
              {formData.destination && (
                <SummaryRow label="Destination" value={formData.destination} />
              )}
              {formData.outgoing_flight_info && (
                <SummaryRow
                  label="Outgoing Flight"
                  value={formData.outgoing_flight_info}
                />
              )}
              {formData.returning_flight_info && (
                <SummaryRow
                  label="Incoming Flight (Arriving)"
                  value={formData.returning_flight_info}
                />
              )}
              {selectedService && (
                <SummaryRow label="Service" value={selectedService.name} />
              )}
              {outgoingAddons.length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                    Add-ons
                  </p>
                  {outgoingAddons.map((a, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-gray-600">
                        {a.name}
                        {a.quantity > 1 && ` ×${a.quantity}`}
                      </span>
                      <span className="font-medium text-gray-800">
                        {a.isVariable && !a.hasCustomPrice ? (
                          <span className="text-xs text-gray-400 italic">
                            TBD
                          </span>
                        ) : (
                          `$${a.totalPrice.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tour Details Summary — shown when booking a tour */}
      {formData.is_tour && (
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 space-y-4">
          <p className="font-bold text-purple-900 flex items-center gap-2 text-base">
            🚌 Tour Details
          </p>

          {/* Timing & fee row */}
          <div className="grid grid-cols-2 gap-3">
            {formData.time && (
              <div className="bg-white rounded-xl p-3 border border-purple-100">
                <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">
                  Start Time
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {formData.time}
                </p>
              </div>
            )}
            {formData.tour_end_time && (
              <div className="bg-white rounded-xl p-3 border border-purple-100">
                <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">
                  End Time
                </p>
                <p className="text-sm font-bold text-gray-900 mt-1">
                  {formData.tour_end_time}
                </p>
              </div>
            )}
          </div>

          {/* Flat fee */}
          {formData.tour_flat_fee && Number(formData.tour_flat_fee) > 0 && (
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider">
                Flat Fee
              </p>
              <p className="text-lg font-bold text-emerald-700 mt-1">
                ${Number(formData.tour_flat_fee).toFixed(2)}
                {formData.tour_payment_split === "divided" &&
                  formData.tour_participants?.length > 0 && (
                    <span className="text-sm text-gray-500 font-normal ml-2">
                      ($
                      {Math.ceil(
                        Number(formData.tour_flat_fee) /
                          formData.tour_participants.length,
                      ).toFixed(2)}
                      /person)
                    </span>
                  )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {formData.tour_payment_split === "divided"
                  ? "Divided equally among participants"
                  : "Paid by one passenger"}
              </p>
            </div>
          )}

          {/* Free-form itinerary notes */}
          {formData.tour_notes && (
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider mb-1">
                Itinerary Notes
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {formData.tour_notes}
              </p>
            </div>
          )}

          {/* Participants */}
          {formData.tour_participants &&
            formData.tour_participants.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-purple-700 font-semibold uppercase tracking-wider">
                  Participants ({formData.tour_participants.length})
                </p>
                {formData.tour_participants.map((p, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl p-3 border border-purple-100 text-sm"
                  >
                    <p className="font-semibold text-gray-900">
                      {i + 1}. {p.name}
                    </p>
                    {p.phone && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        📱 {p.phone}
                      </p>
                    )}
                    {p.email && (
                      <p className="text-gray-500 text-xs">✉️ {p.email}</p>
                    )}
                    {p.pickup_location && (
                      <p className="text-gray-600 text-xs mt-1">
                        🟢 Pickup: {p.pickup_location}
                      </p>
                    )}
                    {p.dropoff_location && (
                      <p className="text-gray-600 text-xs">
                        🔴 Drop-off: {p.dropoff_location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

          {/* Structured itinerary stops */}
          {formData.tour_itinerary && formData.tour_itinerary.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-purple-700 font-semibold uppercase tracking-wider">
                Stops ({formData.tour_itinerary.length})
              </p>
              {formData.tour_itinerary.map((stop, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl p-3 border border-purple-100 flex items-start gap-3 text-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {stop.location}
                    </p>
                    {stop.description && (
                      <p className="text-gray-500 text-xs mt-0.5">
                        {stop.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
          {validationErrors.map((e, i) => (
            <p key={i} className="text-sm text-red-700">
              • {e}
            </p>
          ))}
        </div>
      )}

      {/* Business Hours Message - passenger-facing only */}
      {isPassengerMode && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <Clock size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 mb-1">
                After-Hours Submissions
              </p>
              <p className="text-sm text-blue-800 leading-relaxed">
                Please be aware that if this is sent outside of business hours,
                it will not be processed until after 8 am. Thank you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Question */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-800">
            Do You Need a Receipt?
          </span>
          <span className="text-xs text-gray-400 font-normal">(optional)</span>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => set({ needs_receipt: true })}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all ${
              formData.needs_receipt === true
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            ✓ Yes
          </button>
          <button
            type="button"
            onClick={() => set({ needs_receipt: false })}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm border-2 transition-all ${
              formData.needs_receipt === false
                ? "border-gray-500 bg-gray-100 text-gray-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}
          >
            ✕ No
          </button>
        </div>
      </div>

      {/* Submit Button */}
      {onSubmit && (
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full py-5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={22} className="animate-spin" /> Submitting…
            </>
          ) : (
            <>
              <CheckCircle2 size={22} /> Submit Booking
            </>
          )}
        </button>
      )}
    </>
  );
}

function SummaryRow({ label, value, valueClass = "" }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span
        className={`font-medium text-right max-w-[60%] ${valueClass || "text-gray-900"}`}
      >
        {value}
      </span>
    </div>
  );
}
