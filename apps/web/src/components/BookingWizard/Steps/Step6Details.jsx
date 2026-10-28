import { useState, useEffect } from "react";
import {
  Plane,
  Users,
  Briefcase,
  Globe,
  Plus,
  DollarSign,
  CheckCircle,
  MapPin,
  Edit2,
} from "lucide-react";

export function Step6Details({
  formData,
  set,
  isAirport,
  isPassengerMode = false,
  addons = [],
  selectedService = null,
  settings = null,
}) {
  // Check if this is a round-trip
  const isRoundTrip =
    formData.trip_type === "round-trip" || formData.is_round_trip;

  // Detect arrival vs departure for one-way airport trips
  // Pickup at airport = passenger arriving (use "arrives")
  // Dropoff at airport = passenger departing (use "departs")
  const airportKws = ["airport", "terminal", "concourse"];
  const pickupAddrLower = (
    formData.pickup_street ||
    formData.pickup_city ||
    formData.pickup_zip ||
    ""
  ).toLowerCase();
  const dropoffAddrLower = (
    formData.dropoff_street ||
    formData.dropoff_city ||
    formData.dropoff_zip ||
    ""
  ).toLowerCase();
  const isPickupAtAirport =
    formData.pickup_is_airport === true ||
    (formData.pickup_is_airport == null &&
      airportKws.some((kw) => pickupAddrLower.includes(kw)));
  const isDropoffAtAirport =
    formData.dropoff_is_airport === true ||
    (formData.dropoff_is_airport == null &&
      airportKws.some((kw) => dropoffAddrLower.includes(kw)));
  // Arrival: picking up FROM airport. Departure: dropping off AT airport.
  const isArrival = isPickupAtAirport && !isDropoffAtAirport;
  const flightTimeLabel = isArrival ? "Arrives" : "Departs";
  const flightTimeLabelLower = isArrival ? "arrives" : "departs";

  // For a round trip starting FROM the airport (BNA → destination):
  // passenger arrives first (incoming flight) then departs later (outgoing flight).
  // Flip the labels accordingly.
  const isRoundTripFromAirport =
    isRoundTrip && isPickupAtAirport && !isDropoffAtAirport;
  const rtLeg1Label = isRoundTripFromAirport
    ? "Incoming Flight (Arriving)"
    : "Outgoing Flight (Departing)";
  const rtLeg1InfoLabel = isRoundTripFromAirport
    ? "Incoming Flight Info"
    : "Outgoing Flight Info";
  const rtLeg1TimeLabel = isRoundTripFromAirport ? "Arrives" : "Departs";
  const rtLeg1Placeholder = isRoundTripFromAirport
    ? "e.g. American #123, arrives 2:30pm from Aruba, Gate B12"
    : "e.g. American #123, departs 2:30pm, Gate B12";
  const rtLeg2Label = isRoundTripFromAirport
    ? "Outgoing Flight (Departing)"
    : "Incoming Flight (Arriving)";
  const rtLeg2InfoLabel = isRoundTripFromAirport
    ? "Outgoing Flight Info"
    : "Incoming Flight Info";
  const rtLeg2TimeLabel = isRoundTripFromAirport ? "Departs" : "Arrives";
  const rtLeg2Placeholder = isRoundTripFromAirport
    ? "e.g. Allegiant #331, departs 2:00pm on 6/1"
    : "e.g. Allegiant #331, arrives 2:00pm from Aruba on 6/1";

  // Which DB field each round-trip leg maps to:
  // Standard RT (home→airport): Leg1=outgoing_flight_info, Leg2=returning_flight_info
  // From-airport RT (airport→home): Leg1=returning_flight_info (arriving), Leg2=outgoing_flight_info (departing)
  const rtLeg1Field = isRoundTripFromAirport
    ? "returning_flight_info"
    : "outgoing_flight_info";
  const rtLeg2Field = isRoundTripFromAirport
    ? "outgoing_flight_info"
    : "returning_flight_info";

  // Local state for separate airline/flight#/time inputs (airport trips only)
  const [airline, setAirline] = useState(() => {
    const info = formData.outgoing_flight_info || "";
    const idx = info.indexOf("#");
    return idx === -1 ? info.trim() : info.substring(0, idx).trim();
  });
  const [flightNum, setFlightNum] = useState(() => {
    const info = formData.outgoing_flight_info || "";
    const idx = info.indexOf("#");
    return idx === -1
      ? ""
      : info
          .substring(idx + 1)
          .trim()
          .split(/\s/)[0];
  });
  const [flightTime, setFlightTime] = useState("");
  const [returnAirline, setReturnAirline] = useState("");
  const [returnFlightNum, setReturnFlightNum] = useState("");
  const [returnFlightTime, setReturnFlightTime] = useState("");

  // Convert 24hr time to 12hr format (hh:mm am/pm)
  const formatTime12hr = (time24) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    let h = parseInt(hours, 10);
    const period = h >= 12 ? "pm" : "am";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${minutes}${period}`;
  };

  // Auto-build full outgoing flight info — use "arrives" or "departs" based on direction
  const buildOutgoingInfo = (a, fn, ft) => {
    let parts = [];
    if (a && fn) parts.push(`${a} #${fn}`);
    else if (a) parts.push(a);
    else if (fn) parts.push(`#${fn}`);
    if (ft) parts.push(`${flightTimeLabelLower} ${formatTime12hr(ft)}`);
    return parts.join(", ");
  };

  // Auto-build full return flight info
  const buildReturnInfo = (a, fn, ft) => {
    let parts = [];
    if (a && fn) parts.push(`${a} #${fn}`);
    else if (a) parts.push(a);
    else if (fn) parts.push(`#${fn}`);
    if (ft) parts.push(`arrives ${formatTime12hr(ft)}`);
    return parts.join(", ");
  };

  const handleAirlineChange = (val) => {
    setAirline(val);
    const combined = buildOutgoingInfo(val, flightNum, flightTime);
    set({ [rtLeg1Field]: combined });
  };

  const handleFlightNumChange = (val) => {
    setFlightNum(val);
    const combined = buildOutgoingInfo(airline, val, flightTime);
    set({ [rtLeg1Field]: combined });
  };

  const handleFlightTimeChange = (val) => {
    setFlightTime(val);
    const combined = buildOutgoingInfo(airline, flightNum, val);
    set({ [rtLeg1Field]: combined });
  };

  const handleDestinationChange = (val) => {
    set({ destination: val });
  };

  const handleReturnAirlineChange = (val) => {
    setReturnAirline(val);
    const combined = buildReturnInfo(val, returnFlightNum, returnFlightTime);
    set({ [rtLeg2Field]: combined });
  };

  const handleReturnFlightNumChange = (val) => {
    setReturnFlightNum(val);
    const combined = buildReturnInfo(returnAirline, val, returnFlightTime);
    set({ [rtLeg2Field]: combined });
  };

  const handleReturnFlightTimeChange = (val) => {
    setReturnFlightTime(val);
    const combined = buildReturnInfo(returnAirline, returnFlightNum, val);
    set({ [rtLeg2Field]: combined });
  };

  // Filter addons for passenger mode (only those marked can_passenger_request)
  const filteredAddons = isPassengerMode
    ? addons?.filter((addon) => addon.can_passenger_request === true) || []
    : addons || [];

  const vehicleKeywords = ["suv", "luxury vehicle", "vehicle"];
  const vehicleAddons = filteredAddons.filter((addon) =>
    vehicleKeywords.some((kw) => addon.name.toLowerCase().includes(kw)),
  );
  const otherAddons = filteredAddons.filter(
    (addon) =>
      !vehicleKeywords.some((kw) => addon.name.toLowerCase().includes(kw)),
  );
  const selectedVehicleId =
    vehicleAddons.find((v) => formData.selected_addons?.[v.id] > 0)?.id || null;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Trip details</h2>
        <p className="text-sm text-gray-500 mt-1">
          Help us prepare for your ride
        </p>
      </div>

      {/* Service & Pricing Display - NEW SECTION */}
      {selectedService && (
        <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-blue-600" />
            <span className="text-sm font-bold text-blue-900 uppercase tracking-wider">
              Service Detected
            </span>
          </div>
          <div className="bg-white rounded-xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">
                  {selectedService.name}
                </p>
                {selectedService.description && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {selectedService.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                {selectedService.is_variable_price ? (
                  <p className="text-sm text-gray-600 italic">Price varies</p>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      $
                      {Number(
                        formData.service_price ||
                          selectedService.default_price ||
                          0,
                      ).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">Base fare</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-blue-700">
            ℹ️ Service automatically detected based on your pickup and dropoff
            locations
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Passengers & Luggage - ONLY show for airport trips */}
        {isAirport && (
          <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl">
            <div className="flex items-center gap-2 pb-1">
              <Users size={16} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                Passengers & Luggage
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Passenger(s)", key: "num_people", icon: "👥" },
                { label: "Checked Bags", key: "num_bags_checked", icon: "🧳" },
                { label: "Carry-on", key: "num_bags_carry_on", icon: "💼" },
              ].map(({ label, key, icon }) => (
                <div key={key}>
                  <label className="text-xs font-semibold text-indigo-800 block mb-2">
                    {icon} {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData[key] || ""}
                    onChange={(e) => set({ [key]: e.target.value })}
                    className="w-full px-3 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-center text-base placeholder:text-gray-600"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flight Information - ONLY show for airport trips */}
        {isAirport && (
          <div className="space-y-4 p-5 bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 rounded-2xl">
            <div className="flex items-center gap-2 pb-1">
              <Plane size={16} className="text-sky-600" />
              <span className="text-sm font-bold text-sky-900 uppercase tracking-wider">
                Flight Information
              </span>
            </div>

            {/* For one-way trips, show BOTH incoming and outgoing fields */}
            {!isRoundTrip && (
              <>
                {/* Outgoing Flight Section */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                    Outgoing Flight (Departing)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        Airline
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. American, Delta"
                        value={airline}
                        onChange={(e) => handleAirlineChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        Flt #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123"
                        value={flightNum}
                        onChange={(e) => handleFlightNumChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        Departs
                      </label>
                      <input
                        type="time"
                        value={flightTime}
                        onChange={(e) => handleFlightTimeChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-sky-800 block mb-1">
                      Outgoing Flight Info
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. American #123, departs 2:30pm, Gate B12"
                      value={formData.outgoing_flight_info || ""}
                      onChange={(e) =>
                        set({ outgoing_flight_info: e.target.value })
                      }
                      className="w-full px-5 py-3 border-2 border-sky-200 bg-white rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-400 text-sm"
                    />
                  </div>
                </div>

                {/* Incoming/Return Flight Section */}
                <div className="space-y-3 pt-3 border-t-2 border-sky-200">
                  <label className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                    Incoming Flight (Arriving)
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        Airline
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Allegiant"
                        value={returnAirline}
                        onChange={(e) =>
                          handleReturnAirlineChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        Flt #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 331"
                        value={returnFlightNum}
                        onChange={(e) =>
                          handleReturnFlightNumChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        Arrives
                      </label>
                      <input
                        type="time"
                        value={returnFlightTime}
                        onChange={(e) =>
                          handleReturnFlightTimeChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-sky-800 block mb-1">
                      Incoming Flight Info
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Allegiant #331, arrives 2:00pm from Aruba"
                      value={formData.returning_flight_info || ""}
                      onChange={(e) =>
                        set({ returning_flight_info: e.target.value })
                      }
                      className="w-full px-5 py-3 border-2 border-sky-200 bg-white rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-400 text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* For round trips, keep existing behavior */}
            {isRoundTrip && (
              <>
                {/* ✈️ Leg 1 Flight: Airline + Flight # + Time */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                    {rtLeg1Label}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        Airline
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. American, Delta"
                        value={airline}
                        onChange={(e) => handleAirlineChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        Flt #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 123"
                        value={flightNum}
                        onChange={(e) => handleFlightNumChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-2">
                        {rtLeg1TimeLabel}
                      </label>
                      <input
                        type="time"
                        value={flightTime}
                        onChange={(e) => handleFlightTimeChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Full leg 1 flight info */}
                <div>
                  <label className="text-xs font-semibold text-sky-800 block mb-1">
                    {rtLeg1InfoLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={rtLeg1Placeholder}
                    value={formData[rtLeg1Field] || ""}
                    onChange={(e) => set({ [rtLeg1Field]: e.target.value })}
                    className="w-full px-5 py-3 border-2 border-sky-200 bg-white rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-400 text-sm"
                  />
                </div>

                {/* Leg 2 Flight */}
                <div className="space-y-3 pt-3 border-t-2 border-sky-200">
                  <label className="text-xs font-bold text-sky-800 uppercase tracking-wider">
                    {rtLeg2Label}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        Airline
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Allegiant"
                        value={returnAirline}
                        onChange={(e) =>
                          handleReturnAirlineChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        Flt #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 331"
                        value={returnFlightNum}
                        onChange={(e) =>
                          handleReturnFlightNumChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-sky-700 block mb-1">
                        {rtLeg2TimeLabel}
                      </label>
                      <input
                        type="time"
                        value={returnFlightTime}
                        onChange={(e) =>
                          handleReturnFlightTimeChange(e.target.value)
                        }
                        className="w-full px-4 py-3 bg-white border-2 border-sky-200 rounded-xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Full Leg 2 Flight Info */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-sky-800 block mb-1">
                    {rtLeg2InfoLabel}
                  </label>
                  <input
                    type="text"
                    placeholder={rtLeg2Placeholder}
                    value={formData[rtLeg2Field] || ""}
                    onChange={(e) => set({ [rtLeg2Field]: e.target.value })}
                    className="w-full px-5 py-3 border-2 border-sky-200 bg-white rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-400 text-sm"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* International Flight Question - show for airport trips */}
        {isAirport && (
          <div className="space-y-3 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-emerald-600" />
              <label className="text-sm font-bold text-emerald-900">
                Is this an international flight?
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  set({
                    is_international_flight: false,
                    customs_clearance_location: "",
                  });
                }}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                  formData.is_international_flight === false
                    ? "border-emerald-600 bg-white ring-2 ring-emerald-400 text-emerald-900 shadow-lg"
                    : "border-emerald-200 bg-white/50 text-emerald-700 hover:border-emerald-300"
                }`}
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  set({
                    is_international_flight: true,
                  });
                }}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${
                  formData.is_international_flight === true
                    ? "border-emerald-600 bg-white ring-2 ring-emerald-400 text-emerald-900 shadow-lg"
                    : "border-emerald-200 bg-white/50 text-emerald-700 hover:border-emerald-300"
                }`}
              >
                Yes
              </button>
            </div>

            {formData.is_international_flight === true && (
              <div
                className="space-y-2 pt-3 border-t-2 border-emerald-200"
                data-testid="customs-clearance-section"
              >
                <label className="text-sm font-semibold text-emerald-800 block">
                  Where will you clear Customs?{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nashville International Airport, Miami Terminal D"
                  value={formData.customs_clearance_location || ""}
                  onChange={(e) =>
                    set({ customs_clearance_location: e.target.value })
                  }
                  className="w-full px-5 py-4 bg-white border-2 border-emerald-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all placeholder:text-gray-600"
                />
                <p className="text-xs text-emerald-700">
                  Enter the airport/terminal where you'll go through customs
                </p>
              </div>
            )}
          </div>
        )}

        {/* Destination */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Destination{" "}
            <span className="text-gray-400 font-normal">
              {isRoundTrip
                ? "(where you're traveling to/from — e.g., Aruba, Miami)"
                : "(optional — e.g. city, terminal, hotel)"}
            </span>
          </label>
          <input
            type="text"
            placeholder={
              isRoundTrip
                ? "e.g., Aruba (applies to both outgoing & return flights)"
                : "e.g., Aruba, Southwest Terminal, Opryland Hotel…"
            }
            value={formData.destination || ""}
            onChange={(e) => handleDestinationChange(e.target.value)}
            className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-gray-600"
          />
          {isRoundTrip && (
            <p className="text-xs text-sky-700 mt-1">
              💡 This destination will be used for both your outgoing and return
              flight information
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            placeholder="Any special needs or requests? (e.g., need a car seat, prefer a Yukon, wheelchair accessible, pet-friendly, extra stops, etc.)"
            value={formData.notes || ""}
            onChange={(e) => set({ notes: e.target.value })}
            rows={4}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all resize-none placeholder:text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            Let us know about any special needs, preferences, or requests for
            your trip
          </p>
        </div>
      </div>

      {/* Add-ons section — shown at the bottom of step 6 in passenger mode */}
      {isPassengerMode && filteredAddons.length > 0 && (
        <div className="space-y-4 pt-4 border-t-2 border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Any add-ons?</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Select any extras needed for this trip
            </p>
          </div>

          {/* Vehicle add-ons (radio) */}
          {vehicleAddons.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                Vehicle Type (choose one)
              </p>
              {vehicleAddons.map((addon) => {
                const isSelected = selectedVehicleId === addon.id;
                return (
                  <div
                    key={addon.id}
                    onClick={() => {
                      const newAddons = { ...formData.selected_addons };
                      vehicleAddons.forEach((v) => {
                        delete newAddons[v.id];
                      });
                      if (!isSelected) newAddons[addon.id] = 1;
                      set({ selected_addons: newAddons });
                    }}
                    className={`p-4 border-2 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-1 w-5 h-5 text-blue-600 border-2 border-blue-300"
                      />
                      <div className="flex-1">
                        <p
                          className={`font-bold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}
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
                            <p className="text-sm text-blue-700 font-semibold mt-1">
                              ${Number(addon.default_price).toFixed(2)}
                            </p>
                          )}
                        {addon.is_variable_price && !isSelected && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            Pricing provided upon confirmation
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Other add-ons (checkboxes) */}
          {otherAddons.length > 0 && (
            <div className="space-y-2">
              {vehicleAddons.length > 0 && (
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Additional Services
                </p>
              )}
              {otherAddons.map((addon) => {
                const isSelected = formData.selected_addons?.[addon.id] > 0;
                const quantity = formData.selected_addons?.[addon.id] || 0;
                const needsQuantity =
                  addon.name.toLowerCase().includes("stop") ||
                  addon.name.toLowerCase().includes("car seat");

                return (
                  <div
                    key={addon.id}
                    className={`p-4 border-2 rounded-2xl transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
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
                          className="mt-1 w-5 h-5 text-emerald-600 rounded border-2 border-emerald-300"
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
                          {addon.is_variable_price && (
                            <p className="text-xs text-gray-500 mt-1 italic">
                              Pricing provided upon confirmation
                            </p>
                          )}
                        </div>
                      </label>
                      {needsQuantity && isSelected && (
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
