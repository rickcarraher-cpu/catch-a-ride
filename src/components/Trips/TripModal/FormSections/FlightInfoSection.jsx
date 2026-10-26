import { useState } from "react";
import { Plane } from "lucide-react";
import { createDateInCDT } from "@/utils/timezone";

// Parse "Airline #FlightNum …" back into separate parts
function parseFlightInfo(info = "") {
  const hashIdx = info.indexOf("#");
  if (hashIdx === -1) return { airline: info.trim(), flightNum: "" };
  return {
    airline: info.substring(0, hashIdx).trim(),
    flightNum: info
      .substring(hashIdx + 1)
      .trim()
      .split(/\s/)[0], // just the number, no trailing notes
  };
}

function parseReturnDateTime(text, currentStartTime) {
  if (!text) return null;

  let hours = null;
  let minutes = null;

  const time12Match = text.match(
    /[@\s]?(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)/i,
  );
  const time24Match = text.match(
    /[@\s]?(\d{1,2}):(\d{2})(?!\s*(am|pm|a\.m\.|p\.m\.))/i,
  );

  if (time12Match) {
    hours = parseInt(time12Match[1], 10);
    minutes = parseInt(time12Match[2], 10);
    const period = time12Match[3].toLowerCase().replace(/\./g, "");
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
  } else if (time24Match) {
    hours = parseInt(time24Match[1], 10);
    minutes = parseInt(time24Match[2], 10);
  }

  const dateMatch = text.match(
    /(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,
  );

  let year = null;
  let month = null;
  let day = null;

  if (dateMatch) {
    month = parseInt(dateMatch[1], 10);
    day = parseInt(dateMatch[2], 10);
    if (dateMatch[3]) {
      year = parseInt(dateMatch[3], 10);
      if (year < 100) year += 2000;
    }
  }

  // ✅ FIX: If no date was found in the text, do NOT fall back to start_time.
  // Previously, a time-only entry like "arrives 2:30pm" would silently set
  // return_date to the departure date, making it look like the passenger is
  // returning the same day they leave. Require an explicit date (e.g. "on 9/30").
  if (month === null) return null;

  // Use CDT-aware date parsing
  if (year === null) {
    const now = new Date();
    year = now.getFullYear();
    // If the parsed date is in the past, assume next year
    const testDate = createDateInCDT(year, month, day, 0, 0);
    if (testDate < now) year += 1;
  }

  if (hours === null) {
    hours = 0;
    minutes = 0;
  }

  // Create date in CDT timezone with proper offset
  const cdtDate = createDateInCDT(year, month, day, hours, minutes);

  // Format as datetime-local string with CDT offset
  const pad = (n) => String(n).padStart(2, "0");
  const isoString = cdtDate.toISOString();
  const datePart = isoString.substring(0, 10);
  return `${datePart}T${pad(hours)}:${pad(minutes)}`;
}

export function FlightInfoSection({ formData, setFormData, isReturnTrip }) {
  // ── Airport detection (MUST be before useState so we can init state from the right field) ──
  // Include "bna" so trips stored with "BNA" as the pickup/dropoff are detected correctly
  const airportKeywords = ["airport", "terminal", "concourse", "bna"];

  const pickupLower = (
    formData.pickup_address ||
    formData.pickup_street ||
    ""
  ).toLowerCase();
  const dropoffLower = (
    formData.dropoff_address ||
    formData.dropoff_street ||
    ""
  ).toLowerCase();

  const isPickupAtAirport =
    formData.pickup_is_airport === true ||
    (formData.pickup_is_airport == null &&
      (airportKeywords.some((kw) => pickupLower.includes(kw)) ||
        formData.pickup_zip === "37214"));

  const isDropoffAtAirport =
    formData.dropoff_is_airport === true ||
    (formData.dropoff_is_airport == null &&
      (airportKeywords.some((kw) => dropoffLower.includes(kw)) ||
        formData.dropoff_zip === "37214"));

  // Nashville airport detection for round-trip auto-logic
  const isBNA =
    isPickupAtAirport ||
    isDropoffAtAirport ||
    pickupLower.includes("nashville") ||
    dropoffLower.includes("nashville");

  // If returning_flight_info is filled but outgoing is empty
  // → this is definitively an arrival/incoming trip regardless of address detection (covers "BNA" stored without
  // airport keywords or ZIP, and prevents the incoming data from being invisible).
  const hasIncomingFlightOnly =
    !!(formData.returning_flight_info || "").trim() &&
    !(formData.outgoing_flight_info || "").trim();

  // If pickup is at airport → passenger ARRIVING (incoming flight)
  // If dropoff is at airport → passenger DEPARTING (outgoing flight)
  // isDropoffAtAirport takes priority — a trip dropping off at the airport is always a departure
  const isArrival =
    hasIncomingFlightOnly ||
    (!isDropoffAtAirport &&
      (isReturnTrip || (isPickupAtAirport && !isDropoffAtAirport)));

  // For arrival trips, incoming flight info is stored in returning_flight_info
  // For departure trips, outgoing flight info is stored in outgoing_flight_info
  // (Booking wizard already uses this convention — TripModal must match it)
  const primaryFlightField = isArrival
    ? "returning_flight_info"
    : "outgoing_flight_info";

  const parsed = parseFlightInfo(formData[primaryFlightField] || "");
  const [airline, setAirline] = useState(parsed.airline);
  const [flightNum, setFlightNum] = useState(parsed.flightNum);
  const [flightTime, setFlightTime] = useState("");
  const [returnAirline, setReturnAirline] = useState("");
  const [returnFlightNum, setReturnFlightNum] = useState("");
  const [returnFlightTime, setReturnFlightTime] = useState("");

  // Outgoing leg of a round trip (has return_date but is not the return leg itself)
  const isRoundTripOutgoing = !!formData.return_date && !isReturnTrip;

  // Only show the full round trip form for the OUTGOING leg (has a return date).
  const showRoundTripMode = isRoundTripOutgoing;

  // For a round trip starting FROM the airport (e.g. BNA → destination):
  const isRoundTripFromAirport =
    showRoundTripMode && isPickupAtAirport && !isDropoffAtAirport;

  // Which DB field each leg maps to in round-trip mode:
  // - Standard RT (home→airport): primaryFlightField = outgoing_flight_info, leg2Field = returning_flight_info
  // - From-airport RT (airport→home): primaryFlightField = returning_flight_info, leg2Field = outgoing_flight_info
  const leg2Field = isRoundTripFromAirport
    ? "outgoing_flight_info"
    : "returning_flight_info";

  // FIX: In round-trip mode the Leg 1 field must always be pinned to the
  // departure-direction field, regardless of whether only the incoming leg
  // has been filled.  Without this, hasIncomingFlightOnly → isArrival=true
  // → primaryFlightField switches to "returning_flight_info", binding both
  // Leg 1 and Leg 2 inputs to the same DB column and making the outbound
  // trip appear to save the incoming flight info as BOTH legs.
  const effectivePrimaryField = showRoundTripMode
    ? isRoundTripFromAirport
      ? "returning_flight_info"
      : "outgoing_flight_info"
    : primaryFlightField;

  const leg1Label = isRoundTripFromAirport
    ? "Incoming Flight"
    : "Outgoing Flight";
  const leg1InfoLabel = isRoundTripFromAirport
    ? "Incoming Flight Info"
    : "Outgoing Flight Info";
  const leg1TimeLabel = isRoundTripFromAirport ? "Arrives" : "Departs";
  const leg1Placeholder = isRoundTripFromAirport
    ? "e.g. American #123, arrives 2:30pm, Gate B12"
    : "e.g. American #123, departs 2:30pm, Gate B12";
  const leg2Label = isRoundTripFromAirport
    ? "Outgoing Flight"
    : "Return Flight";
  const leg2InfoLabel = isRoundTripFromAirport
    ? "Outgoing Flight Info"
    : "Return Flight Info";
  const leg2TimeLabel = isRoundTripFromAirport ? "Departs" : "Arrives";
  const leg2Placeholder = isRoundTripFromAirport
    ? "e.g. Allegiant #331, departs 2:00pm on 6/1"
    : "e.g. Allegiant #331, arrives 2:00pm from Aruba on 6/1";

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

  // Build combined flight info — writes to the correct field based on trip direction
  const updateCombinedOutgoing = (newAirline, newFlightNum, newTime) => {
    let parts = [];
    if (newAirline && newFlightNum)
      parts.push(`${newAirline} #${newFlightNum}`);
    else if (newAirline) parts.push(newAirline);
    else if (newFlightNum) parts.push(`#${newFlightNum}`);

    if (newTime) {
      const timeLabel = isArrival ? "arrives" : "departs";
      parts.push(`${timeLabel} ${formatTime12hr(newTime)}`);
    }

    const combined = parts.join(", ");
    // Use effectivePrimaryField so round-trip mode always writes to the correct leg
    setFormData((prev) => ({ ...prev, [effectivePrimaryField]: combined }));
  };

  // Build combined return flight info with time
  const updateCombinedReturn = (newAirline, newFlightNum, newTime) => {
    let parts = [];
    if (newAirline && newFlightNum)
      parts.push(`${newAirline} #${newFlightNum}`);
    else if (newAirline) parts.push(newAirline);
    else if (newFlightNum) parts.push(`#${newFlightNum}`);

    if (newTime) parts.push(`departs ${formatTime12hr(newTime)}`);
    if (formData.destination) parts.push(`from ${formData.destination}`);

    const combined = parts.join(", ");
    // Use leg2Field so from-airport RT correctly writes to outgoing_flight_info
    // Use functional updater to avoid stale closure overwriting the other leg's field
    setFormData((prev) => ({ ...prev, [leg2Field]: combined }));
  };

  const handleAirlineChange = (val) => {
    setAirline(val);
    updateCombinedOutgoing(val, flightNum, flightTime);
  };

  const handleFlightNumChange = (val) => {
    setFlightNum(val);
    updateCombinedOutgoing(airline, val, flightTime);
  };

  const handleFlightTimeChange = (val) => {
    setFlightTime(val);
    updateCombinedOutgoing(airline, flightNum, val);
  };

  const handleReturnAirlineChange = (val) => {
    setReturnAirline(val);
    updateCombinedReturn(val, returnFlightNum, returnFlightTime);
  };

  const handleReturnFlightNumChange = (val) => {
    setReturnFlightNum(val);
    updateCombinedReturn(returnAirline, val, returnFlightTime);
  };

  const handleReturnFlightTimeChange = (val) => {
    setReturnFlightTime(val);
    updateCombinedReturn(returnAirline, returnFlightNum, val);
  };

  const handleReturningFlightChange = (e) => {
    const value = e.target.value;
    const updates = { [leg2Field]: value };
    const parsedDate = parseReturnDateTime(value, formData.start_time);
    if (parsedDate) {
      updates.return_date = parsedDate;
      console.log("Auto-parsed return date:", parsedDate);
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleReturnDateChange = (e) => {
    setFormData({ ...formData, return_date: e.target.value });
  };

  // REMOVED: BNA auto-set round-trip useEffect
  // Previously this effect set is_round_trip: true whenever returning_flight_info
  // was filled on a BNA trip. This silently converted one-way trips to round-trips
  // and fabricated a return leg the user never requested. Removed.

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-sky-100">
        <Plane size={14} className="text-sky-500" />
        <span className="text-xs font-semibold text-sky-600 uppercase tracking-wider">
          {isReturnTrip && isArrival
            ? "Return Trip"
            : showRoundTripMode
              ? "Round Trip Flight Information"
              : !isArrival
                ? "Departing Trip"
                : "Flight Information"}
        </span>
      </div>

      {/* For ONE-WAY or RETURN trips FROM airport (arrival): show outgoing THEN incoming */}
      {!showRoundTripMode && isArrival && (
        <>
          {/* Outgoing Flight Info — shown above incoming for reference/editing */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Outgoing Flight Info
            </label>
            <input
              type="text"
              placeholder="e.g. American #123, departs 2:30pm, Gate B12"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.outgoing_flight_info || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  outgoing_flight_info: e.target.value,
                })
              }
            />
          </div>

          {/* Incoming Flight — directly below, no gap */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Incoming Flight
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Airline
                </label>
                <input
                  type="text"
                  placeholder="e.g. American, Delta"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={airline}
                  onChange={(e) => handleAirlineChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Flt #
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightNum}
                  onChange={(e) => handleFlightNumChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Arrives
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightTime}
                  onChange={(e) => handleFlightTimeChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Incoming Flight Info
            </label>
            <input
              type="text"
              placeholder="e.g. American #123, arrives 2:30pm from Aruba, Gate B12"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.returning_flight_info || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  returning_flight_info: e.target.value,
                })
              }
            />
            <p className="text-xs text-gray-400">
              Auto-filled from Airline + Flt # + Arrives above. Add
              gate/terminal if needed.
            </p>
          </div>
        </>
      )}

      {/* For ONE-WAY trips TO airport (departure): show outgoing THEN incoming immediately below */}
      {!showRoundTripMode && !isArrival && (
        <>
          {/* Outgoing Flight */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Outgoing Flight
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Airline
                </label>
                <input
                  type="text"
                  placeholder="e.g. American, Delta"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={airline}
                  onChange={(e) => handleAirlineChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Flt #
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightNum}
                  onChange={(e) => handleFlightNumChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Departs
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightTime}
                  onChange={(e) => handleFlightTimeChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Outgoing Flight Info
            </label>
            <input
              type="text"
              placeholder="e.g. American #123, departs 2:30pm, Gate B12"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.outgoing_flight_info || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  outgoing_flight_info: e.target.value,
                })
              }
            />
            <p className="text-xs text-gray-400">
              Auto-filled from Airline + Flt # + Departs above. Add
              gate/terminal if needed.
            </p>
          </div>

          {/* Incoming Flight — immediately below outgoing, no extra gap */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Incoming Flight
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Airline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Allegiant"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnAirline}
                  onChange={(e) => handleReturnAirlineChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Flt #
                </label>
                <input
                  type="text"
                  placeholder="e.g. 331"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnFlightNum}
                  onChange={(e) => handleReturnFlightNumChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Arrives
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnFlightTime}
                  onChange={(e) => handleReturnFlightTimeChange(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Incoming Flight Info
            </label>
            <input
              type="text"
              placeholder="e.g. Allegiant #331, arrives 2:00pm from Aruba"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.returning_flight_info || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  returning_flight_info: e.target.value,
                })
              }
            />
            <p className="text-xs text-gray-400">
              Auto-filled from Airline + Flt # + Arrives above. Add
              gate/terminal if needed.
            </p>
          </div>
        </>
      )}

      {/* For ROUND TRIPS: show both outgoing and return flight sections — keep unchanged */}
      {showRoundTripMode && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
            {isRoundTripFromAirport
              ? "ℹ️ Round trip from airport — first leg: incoming flight (arriving at BNA), return leg: outgoing flight (departing from BNA)"
              : "ℹ️ Round trip — showing both outgoing and return flight information"}
          </div>

          {/* ✈️ Leg 1 Flight: Airline + Flight # + Time */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              {leg1Label}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Airline
                </label>
                <input
                  type="text"
                  placeholder="e.g. American, Delta"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={airline}
                  onChange={(e) => handleAirlineChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Flt #
                </label>
                <input
                  type="text"
                  placeholder="e.g. 123"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightNum}
                  onChange={(e) => handleFlightNumChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  {leg1TimeLabel}
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={flightTime}
                  onChange={(e) => handleFlightTimeChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Full leg 1 flight info */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              {leg1InfoLabel}
            </label>
            <input
              type="text"
              placeholder={leg1Placeholder}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData[effectivePrimaryField] || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  [effectivePrimaryField]: e.target.value,
                }))
              }
            />
            <p className="text-xs text-gray-400">
              Auto-filled from Airline + Flt # + {leg1TimeLabel} above. Add
              gate/terminal if needed.
            </p>
          </div>

          {/* Leg 2 Flight separate fields */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              {leg2Label}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Airline
                </label>
                <input
                  type="text"
                  placeholder="e.g. Allegiant"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnAirline}
                  onChange={(e) => handleReturnAirlineChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Flt #
                </label>
                <input
                  type="text"
                  placeholder="e.g. 331"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnFlightNum}
                  onChange={(e) => handleReturnFlightNumChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  {leg2TimeLabel}
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={returnFlightTime}
                  onChange={(e) => handleReturnFlightTimeChange(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Full leg 2 flight info */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              {leg2InfoLabel}
            </label>
            <input
              type="text"
              placeholder={leg2Placeholder}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData[leg2Field] || ""}
              onChange={handleReturningFlightChange}
            />
            <p className="text-xs text-gray-400">
              Include a date (e.g. "on 9/30") to auto-populate the Return Date
              field below.
            </p>
          </div>

          {/* ✅ Return Date field - MISSING, NOW ADDED */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase">
              Return Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.return_date || ""}
              onChange={handleReturnDateChange}
            />
            <p className="text-xs text-gray-400">
              When does the passenger return? (Auto-filled if you include "on
              9/30" in the Return Flight Info above)
            </p>
          </div>

          {/* International Flight Question - only show if there's return flight info */}
          {formData.returning_flight_info && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-international"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-600"
                  checked={formData.is_international_flight || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_international_flight: e.target.checked,
                      customs_clearance_location: e.target.checked
                        ? formData.customs_clearance_location
                        : "",
                    })
                  }
                />
                <label
                  htmlFor="is-international"
                  className="text-sm font-medium text-gray-700"
                >
                  Is this an international flight?
                </label>
              </div>
              {formData.is_international_flight && (
                <div className="space-y-1.5 pl-6">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Customs Clearance Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BNA Terminal A, Gate C15"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.customs_clearance_location || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customs_clearance_location: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-gray-400">
                    Where will passengers clear customs upon arrival
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
