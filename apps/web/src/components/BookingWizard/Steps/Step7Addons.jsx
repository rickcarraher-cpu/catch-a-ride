import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export function Step7Addons({
  formData,
  set,
  addons,
  isPassengerMode = false,
  settings = null,
}) {
  // Check if this is a round trip
  const isRoundTrip = formData.is_round_trip && formData.return_date;

  // --- Pending vehicle: tracks which vehicle was clicked in round-trip mode
  // before any leg is checked (so the leg checkboxes can appear).
  const [pendingVehicleId, setPendingVehicleId] = useState(null);

  // --- Business hours helpers (for SBH addon filtering) ---
  const bhStart = settings?.business_hours_start || "06:00";
  const bhEnd = settings?.business_hours_end || "20:00";
  const toMin = (t) => {
    const [h, m] = (t || "00:00").split(":").map(Number);
    return h * 60 + m;
  };
  const isOutsideHours = (time) => {
    if (!time) return false;
    const t = toMin(time);
    return t < toMin(bhStart) || t >= toMin(bhEnd);
  };
  const outgoingOutsideHours = isOutsideHours(formData.time);
  const incomingOutsideHours =
    isRoundTrip && isOutsideHours(formData.return_time);
  const isSBHAddon = (addon) => addon.name.toLowerCase().includes("sbh");

  // Filter addons: in passenger mode, only show addons where can_passenger_request=true
  const filteredAddons = isPassengerMode
    ? addons?.filter((addon) => addon.can_passenger_request === true) || []
    : addons || [];

  // Separate vehicle add-ons from other add-ons
  const vehicleKeywords = ["suv", "luxury vehicle", "vehicle"];
  const vehicleAddons =
    filteredAddons?.filter((addon) =>
      vehicleKeywords.some((kw) => addon.name.toLowerCase().includes(kw)),
    ) || [];
  const otherAddons =
    filteredAddons?.filter(
      (addon) =>
        !vehicleKeywords.some((kw) => addon.name.toLowerCase().includes(kw)),
    ) || [];

  // SBH addons only visible when the relevant leg is outside business hours
  const visibleOtherAddons = otherAddons.filter((addon) => {
    if (!isSBHAddon(addon)) return true;
    if (!isRoundTrip) return outgoingOutsideHours;
    return outgoingOutsideHours || incomingOutsideHours;
  });

  // Auto-select car seat addon if num_car_seats was entered in Step 6
  useEffect(() => {
    if (formData.num_car_seats && Number(formData.num_car_seats) > 0) {
      const carSeatAddon = filteredAddons.find((addon) =>
        addon.name.toLowerCase().includes("car seat"),
      );
      if (carSeatAddon && !formData.selected_addons?.[carSeatAddon.id]) {
        const newAddons = { ...formData.selected_addons };
        newAddons[carSeatAddon.id] = Number(formData.num_car_seats);
        set({ selected_addons: newAddons });
      }
    }
  }, [formData.num_car_seats, filteredAddons]);

  // Find which vehicle is currently selected (if any)
  const selectedVehicleId =
    vehicleAddons.find((v) => formData.selected_addons?.[v.id] > 0)?.id || null;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Any add-ons?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select any extras needed for this trip
        </p>
      </div>

      <div className="space-y-6">
        {/* Vehicle Selection */}
        {vehicleAddons.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
              Vehicle Type (choose one)
            </h3>
            {vehicleAddons.map((addon) => {
              const isSelected = selectedVehicleId === addon.id;
              // isPending: vehicle was clicked in round-trip mode, legs not yet chosen
              const isPending =
                isRoundTrip && pendingVehicleId === addon.id && !isSelected;
              const addonLegs = formData.addon_legs?.[addon.id] || [];
              const outgoingSelected = addonLegs.includes("outgoing");
              const incomingSelected = addonLegs.includes("incoming");
              const anyLegSelected = outgoingSelected || incomingSelected;

              // Vehicle addons with $0 default price always need a custom price (effectively variable)
              const effectivelyVariable =
                addon.is_variable_price ||
                (!isPassengerMode && Number(addon.default_price || 0) === 0);

              const handleVehicleSelect = () => {
                const newAddons = { ...formData.selected_addons };
                const newLegs = { ...(formData.addon_legs || {}) };
                const newPrices = { ...(formData.addon_prices || {}) };
                // Deselect all vehicles first
                vehicleAddons.forEach((v) => {
                  delete newAddons[v.id];
                  delete newLegs[v.id];
                  delete newPrices[`${v.id}_outgoing`];
                  delete newPrices[`${v.id}_incoming`];
                  delete newPrices[v.id];
                });
                if (!isSelected && !isPending) {
                  if (!isRoundTrip) {
                    newAddons[addon.id] = 1;
                    setPendingVehicleId(null);
                  } else {
                    // Round-trip: mark as pending so leg checkboxes appear
                    setPendingVehicleId(addon.id);
                  }
                } else {
                  // Clicking the already-active vehicle deselects it
                  setPendingVehicleId(null);
                }
                set({
                  selected_addons: newAddons,
                  addon_legs: newLegs,
                  addon_prices: newPrices,
                });
              };

              const handleLegToggle = (leg, checked) => {
                const newLegs = { ...(formData.addon_legs || {}) };
                const currentLegs = newLegs[addon.id] || [];
                if (checked) {
                  newLegs[addon.id] = [...new Set([...currentLegs, leg])];
                } else {
                  newLegs[addon.id] = currentLegs.filter((l) => l !== leg);
                  if (newLegs[addon.id].length === 0) delete newLegs[addon.id];
                  const newPrices = { ...(formData.addon_prices || {}) };
                  delete newPrices[`${addon.id}_${leg}`];
                  set({ addon_prices: newPrices });
                }
                const newAddons = { ...formData.selected_addons };
                const totalLegs = newLegs[addon.id]?.length || 0;
                if (totalLegs > 0) {
                  newAddons[addon.id] = 1;
                  setPendingVehicleId(null); // Committed — legs confirmed
                } else {
                  delete newAddons[addon.id];
                  // Back to pending so leg checkboxes stay visible
                  setPendingVehicleId(addon.id);
                }
                set({ addon_legs: newLegs, selected_addons: newAddons });
              };

              const cardActive = isRoundTrip
                ? isSelected || isPending || anyLegSelected
                : isSelected;

              return (
                <div
                  key={addon.id}
                  className={`p-4 border-2 rounded-2xl transition-all ${
                    cardActive
                      ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Radio row - clicking selects/deselects this vehicle */}
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={handleVehicleSelect}
                  >
                    <input
                      type="radio"
                      checked={isSelected || isPending || anyLegSelected}
                      onChange={() => {}}
                      className="mt-1 w-5 h-5 text-blue-600 focus:ring-2 focus:ring-blue-600 border-2 border-blue-300"
                    />
                    <div className="flex-1">
                      <p
                        className={`font-bold text-sm ${cardActive ? "text-blue-900" : "text-gray-900"}`}
                      >
                        {addon.name}
                      </p>
                      {addon.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {addon.description}
                        </p>
                      )}
                      {/* One-way: show fixed price immediately */}
                      {!isRoundTrip &&
                        !effectivelyVariable &&
                        Number(addon.default_price) > 0 && (
                          <p className="text-sm text-blue-700 font-semibold mt-1">
                            ${Number(addon.default_price).toFixed(2)}
                          </p>
                        )}
                      {/* Round-trip fixed price: show per-leg note */}
                      {isRoundTrip &&
                        !effectivelyVariable &&
                        Number(addon.default_price) > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            ${Number(addon.default_price).toFixed(2)} per leg —
                            select which leg(s) apply
                          </p>
                        )}
                      {/* Round-trip or one-way: pending price note */}
                      {isRoundTrip &&
                        effectivelyVariable &&
                        !isPassengerMode && (
                          <p className="text-xs text-blue-600 mt-1">
                            Select which leg(s) apply, then enter price
                          </p>
                        )}
                      {/* Variable price passenger mode */}
                      {effectivelyVariable && isPassengerMode && (
                        <p className="text-xs text-gray-500 mt-1 italic">
                          Pricing provided upon confirmation
                        </p>
                      )}
                      {/* Variable price dispatch one-way: no price yet */}
                      {effectivelyVariable &&
                        !isPassengerMode &&
                        !isRoundTrip &&
                        !isSelected && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            Pricing provided upon confirmation
                          </p>
                        )}
                    </div>
                  </div>

                  {/* ONE-WAY: variable price input */}
                  {!isRoundTrip &&
                    effectivelyVariable &&
                    isSelected &&
                    !isPassengerMode && (
                      <div
                        className="mt-3 pt-3 border-t border-blue-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label className="text-xs text-blue-800 font-semibold block mb-1.5">
                          Set price for this vehicle:
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-lg font-medium">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.addon_prices?.[addon.id] ?? ""}
                            onChange={(e) =>
                              set({
                                addon_prices: {
                                  ...(formData.addon_prices || {}),
                                  [addon.id]: e.target.value,
                                },
                              })
                            }
                            className="w-32 px-3 py-2 border-2 border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-500"
                          />
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          Leave blank if price TBD
                        </p>
                      </div>
                    )}

                  {/* ROUND TRIP: leg selection appears after vehicle is clicked */}
                  {isRoundTrip &&
                    (isSelected || isPending || anyLegSelected) && (
                      <div
                        className="mt-3 pt-3 border-t border-blue-200 space-y-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                          Which leg(s) need this vehicle?
                        </p>
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={outgoingSelected}
                              onChange={(e) =>
                                handleLegToggle("outgoing", e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600 rounded border-2 border-blue-300"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Outgoing
                            </span>
                            {!effectivelyVariable &&
                              Number(addon.default_price) > 0 && (
                                <span className="text-sm text-blue-700 font-semibold">
                                  ${Number(addon.default_price).toFixed(2)}
                                </span>
                              )}
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={incomingSelected}
                              onChange={(e) =>
                                handleLegToggle("incoming", e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-600 rounded border-2 border-blue-300"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Incoming
                            </span>
                            {!effectivelyVariable &&
                              Number(addon.default_price) > 0 && (
                                <span className="text-sm text-blue-700 font-semibold">
                                  ${Number(addon.default_price).toFixed(2)}
                                </span>
                              )}
                          </label>
                        </div>

                        {/* Variable price: per-leg inputs */}
                        {effectivelyVariable &&
                          !isPassengerMode &&
                          (outgoingSelected || incomingSelected) && (
                            <div className="space-y-3 pt-2">
                              {outgoingSelected && (
                                <div>
                                  <label className="text-xs text-blue-800 font-semibold block mb-1.5">
                                    Outgoing price:
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600 text-lg font-medium">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={
                                        formData.addon_prices?.[
                                          `${addon.id}_outgoing`
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        set({
                                          addon_prices: {
                                            ...(formData.addon_prices || {}),
                                            [`${addon.id}_outgoing`]:
                                              e.target.value,
                                          },
                                        })
                                      }
                                      className="w-32 px-3 py-2 border-2 border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                              {incomingSelected && (
                                <div>
                                  <label className="text-xs text-blue-800 font-semibold block mb-1.5">
                                    Incoming price:
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-600 text-lg font-medium">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="0.00"
                                      value={
                                        formData.addon_prices?.[
                                          `${addon.id}_incoming`
                                        ] ?? ""
                                      }
                                      onChange={(e) =>
                                        set({
                                          addon_prices: {
                                            ...(formData.addon_prices || {}),
                                            [`${addon.id}_incoming`]:
                                              e.target.value,
                                          },
                                        })
                                      }
                                      className="w-32 px-3 py-2 border-2 border-blue-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-500"
                                    />
                                  </div>
                                </div>
                              )}
                              <p className="text-xs text-blue-600">
                                Leave blank if price TBD
                              </p>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}

        {/* Other Add-ons (Checkboxes - multiple can be selected) */}
        {visibleOtherAddons.length > 0 && (
          <div className="space-y-3">
            {vehicleAddons.length > 0 && (
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Additional Services
              </h3>
            )}
            {visibleOtherAddons.map((addon) => {
              const isSelected = formData.selected_addons?.[addon.id] > 0;
              const quantity = formData.selected_addons?.[addon.id] || 0;
              const needsQuantity =
                addon.name.toLowerCase().includes("stop") ||
                addon.name.toLowerCase().includes("car seat");

              // For SBH addons in round trip, restrict which leg checkboxes appear
              const addonIsSBH = isSBHAddon(addon);
              const showOutgoingLeg = !addonIsSBH || outgoingOutsideHours;
              const showIncomingLeg = !addonIsSBH || incomingOutsideHours;

              // Round trip leg selection
              const addonLegs = formData.addon_legs?.[addon.id] || [];
              const outgoingSelected = addonLegs.includes("outgoing");
              const incomingSelected = addonLegs.includes("incoming");

              return (
                <div
                  key={addon.id}
                  className={`p-4 border-2 rounded-2xl transition-all ${
                    isSelected || outgoingSelected || incomingSelected
                      ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100 scale-[1.01]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {!isRoundTrip ? (
                      // ONE-WAY: Single checkbox
                      <label className="flex items-start gap-3 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const newAddons = { ...formData.selected_addons };
                            const newStopDesc = {
                              ...(formData.stop_descriptions || {}),
                            };
                            const newAddonPrices = {
                              ...(formData.addon_prices || {}),
                            };
                            if (e.target.checked) {
                              newAddons[addon.id] = 1;
                            } else {
                              delete newAddons[addon.id];
                              delete newStopDesc[addon.id];
                              delete newAddonPrices[addon.id];
                            }
                            set({
                              selected_addons: newAddons,
                              stop_descriptions: newStopDesc,
                              addon_prices: newAddonPrices,
                            });
                          }}
                          className="mt-1 w-5 h-5 text-emerald-600 focus:ring-2 focus:ring-emerald-600 rounded border-2 border-emerald-300"
                        />
                        <div className="flex-1">
                          <p
                            className={`font-bold text-sm ${isSelected ? "text-emerald-900" : "text-gray-900"}`}
                          >
                            {addon.name}
                          </p>
                          {addon.description && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {addon.description}
                            </p>
                          )}
                          {!addon.is_variable_price &&
                            Number(addon.default_price) > 0 && (
                              <p className="text-sm text-emerald-700 font-semibold mt-1">
                                ${Number(addon.default_price).toFixed(2)}
                                {needsQuantity ? " each" : ""}
                              </p>
                            )}
                          {addon.is_variable_price &&
                            (!isSelected || isPassengerMode) && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Pricing provided upon confirmation
                              </p>
                            )}
                        </div>
                      </label>
                    ) : (
                      // ROUND TRIP: Leg checkboxes (restricted for SBH addons)
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p
                              className={`font-bold text-sm ${outgoingSelected || incomingSelected ? "text-emerald-900" : "text-gray-900"}`}
                            >
                              {addon.name}
                            </p>
                            {addon.description && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {addon.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-4">
                          {showOutgoingLeg && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={outgoingSelected}
                                onChange={(e) => {
                                  const newLegs = {
                                    ...(formData.addon_legs || {}),
                                  };
                                  const currentLegs = newLegs[addon.id] || [];
                                  if (e.target.checked) {
                                    newLegs[addon.id] = [
                                      ...new Set([...currentLegs, "outgoing"]),
                                    ];
                                  } else {
                                    newLegs[addon.id] = currentLegs.filter(
                                      (leg) => leg !== "outgoing",
                                    );
                                    if (newLegs[addon.id].length === 0)
                                      delete newLegs[addon.id];
                                    const newAddonPrices = {
                                      ...(formData.addon_prices || {}),
                                    };
                                    delete newAddonPrices[
                                      `${addon.id}_outgoing`
                                    ];
                                    set({ addon_prices: newAddonPrices });
                                  }
                                  const newAddons = {
                                    ...formData.selected_addons,
                                  };
                                  const totalLegs =
                                    newLegs[addon.id]?.length || 0;
                                  if (totalLegs > 0) {
                                    newAddons[addon.id] = needsQuantity
                                      ? formData.selected_addons?.[addon.id] ||
                                        1
                                      : 1;
                                  } else {
                                    delete newAddons[addon.id];
                                  }
                                  set({
                                    addon_legs: newLegs,
                                    selected_addons: newAddons,
                                  });
                                }}
                                className="w-4 h-4 text-emerald-600 focus:ring-2 focus:ring-emerald-600 rounded border-2 border-emerald-300"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Outgoing?
                              </span>
                            </label>
                          )}

                          {showIncomingLeg && (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={incomingSelected}
                                onChange={(e) => {
                                  const newLegs = {
                                    ...(formData.addon_legs || {}),
                                  };
                                  const currentLegs = newLegs[addon.id] || [];
                                  if (e.target.checked) {
                                    newLegs[addon.id] = [
                                      ...new Set([...currentLegs, "incoming"]),
                                    ];
                                  } else {
                                    newLegs[addon.id] = currentLegs.filter(
                                      (leg) => leg !== "incoming",
                                    );
                                    if (newLegs[addon.id].length === 0)
                                      delete newLegs[addon.id];
                                    const newAddonPrices = {
                                      ...(formData.addon_prices || {}),
                                    };
                                    delete newAddonPrices[
                                      `${addon.id}_incoming`
                                    ];
                                    set({ addon_prices: newAddonPrices });
                                  }
                                  const newAddons = {
                                    ...formData.selected_addons,
                                  };
                                  const totalLegs =
                                    newLegs[addon.id]?.length || 0;
                                  if (totalLegs > 0) {
                                    newAddons[addon.id] = needsQuantity
                                      ? formData.selected_addons?.[addon.id] ||
                                        1
                                      : 1;
                                  } else {
                                    delete newAddons[addon.id];
                                  }
                                  set({
                                    addon_legs: newLegs,
                                    selected_addons: newAddons,
                                  });
                                }}
                                className="w-4 h-4 text-emerald-600 focus:ring-2 focus:ring-emerald-600 rounded border-2 border-emerald-300"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                Incoming?
                              </span>
                            </label>
                          )}
                        </div>

                        {(outgoingSelected || incomingSelected) && (
                          <div className="mt-2">
                            {!addon.is_variable_price &&
                              Number(addon.default_price) > 0 && (
                                <p className="text-sm text-emerald-700 font-semibold">
                                  ${Number(addon.default_price).toFixed(2)}
                                  {needsQuantity ? " each" : " per leg"}
                                </p>
                              )}
                            {addon.is_variable_price && isPassengerMode && (
                              <p className="text-xs text-gray-500 italic">
                                Pricing provided upon confirmation
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {needsQuantity && isSelected && !isRoundTrip && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 font-medium whitespace-nowrap">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={
                            addon.name.toLowerCase().includes("stop") ? 5 : 8
                          }
                          value={quantity}
                          onChange={(e) => {
                            const newAddons = { ...formData.selected_addons };
                            const val = parseInt(e.target.value) || 1;
                            const maxLimit = addon.name
                              .toLowerCase()
                              .includes("stop")
                              ? 5
                              : 8;
                            newAddons[addon.id] = Math.max(
                              1,
                              Math.min(val, maxLimit),
                            );
                            set({ selected_addons: newAddons });
                          }}
                          className="w-16 px-2 py-1.5 border-2 border-emerald-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    )}

                    {needsQuantity &&
                      (outgoingSelected || incomingSelected) &&
                      isRoundTrip && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-600 font-medium whitespace-nowrap">
                            Qty (per leg)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={
                              addon.name.toLowerCase().includes("stop") ? 5 : 8
                            }
                            value={quantity}
                            onChange={(e) => {
                              const newAddons = { ...formData.selected_addons };
                              const val = parseInt(e.target.value) || 1;
                              const maxLimit = addon.name
                                .toLowerCase()
                                .includes("stop")
                                ? 5
                                : 8;
                              newAddons[addon.id] = Math.max(
                                1,
                                Math.min(val, maxLimit),
                              );
                              set({ selected_addons: newAddons });
                            }}
                            className="w-16 px-2 py-1.5 border-2 border-emerald-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-600"
                          />
                        </div>
                      )}
                  </div>

                  {/* Price input for variable-price addon (ONE-WAY) */}
                  {addon.is_variable_price &&
                    isSelected &&
                    !isPassengerMode &&
                    !isRoundTrip && (
                      <div className="mt-3 pt-3 border-t border-emerald-200">
                        <label className="text-xs text-emerald-800 font-semibold block mb-1.5">
                          Set price for this add-on
                          {needsQuantity ? " (per unit)" : ""}:
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 text-lg font-medium">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.addon_prices?.[addon.id] ?? ""}
                            onChange={(e) => {
                              set({
                                addon_prices: {
                                  ...(formData.addon_prices || {}),
                                  [addon.id]: e.target.value,
                                },
                              });
                            }}
                            className="w-32 px-3 py-2 border-2 border-emerald-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500"
                          />
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">
                          Leave blank if price is to be determined later
                        </p>
                      </div>
                    )}

                  {/* Price input for variable-price addon (ROUND TRIP - per leg) */}
                  {addon.is_variable_price &&
                    (outgoingSelected || incomingSelected) &&
                    !isPassengerMode &&
                    isRoundTrip && (
                      <div className="mt-3 pt-3 border-t border-emerald-200 space-y-3">
                        {outgoingSelected && (
                          <div>
                            <label className="text-xs text-emerald-800 font-semibold block mb-1.5">
                              Outgoing price{needsQuantity ? " (per unit)" : ""}
                              :
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-lg font-medium">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={
                                  formData.addon_prices?.[
                                    `${addon.id}_outgoing`
                                  ] ?? ""
                                }
                                onChange={(e) => {
                                  set({
                                    addon_prices: {
                                      ...(formData.addon_prices || {}),
                                      [`${addon.id}_outgoing`]: e.target.value,
                                    },
                                  });
                                }}
                                className="w-32 px-3 py-2 border-2 border-emerald-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        )}
                        {incomingSelected && (
                          <div>
                            <label className="text-xs text-emerald-800 font-semibold block mb-1.5">
                              Incoming price{needsQuantity ? " (per unit)" : ""}
                              :
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 text-lg font-medium">
                                $
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={
                                  formData.addon_prices?.[
                                    `${addon.id}_incoming`
                                  ] ?? ""
                                }
                                onChange={(e) => {
                                  set({
                                    addon_prices: {
                                      ...(formData.addon_prices || {}),
                                      [`${addon.id}_incoming`]: e.target.value,
                                    },
                                  });
                                }}
                                className="w-32 px-3 py-2 border-2 border-emerald-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-emerald-600">
                          Leave blank if price is to be determined later
                        </p>
                      </div>
                    )}

                  {/* Stop description textarea */}
                  {isSelected && addon.name.toLowerCase().includes("stop") && (
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <label className="text-xs text-emerald-800 font-semibold block mb-1.5">
                        Please describe the stop(s):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Stop at CVS on Main Street, then Walmart on Oak Ave"
                        value={formData.stop_descriptions?.[addon.id] || ""}
                        onChange={(e) =>
                          set({
                            stop_descriptions: {
                              ...(formData.stop_descriptions || {}),
                              [addon.id]: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 bg-white border-2 border-emerald-300 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none placeholder:text-gray-600"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!vehicleAddons.length && !visibleOtherAddons.length && (
          <div className="text-center py-8 text-gray-400">
            <Plus size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No add-ons available</p>
            <p className="text-xs mt-1">You can skip this step</p>
          </div>
        )}
      </div>
    </>
  );
}
