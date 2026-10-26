import { useState } from "react";
import { Plane, X } from "lucide-react";

export function FlightInfoPrompt({ formData, setFormData, onClose }) {
  // Detect if this is a pickup from airport or dropoff to airport
  // Priority 1: explicit flags (set when a preferred location is selected)
  // Priority 2: keyword fallback for manually typed addresses
  const airportKeywords = ["airport", "terminal", "concourse"];

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
      airportKeywords.some((kw) => pickupLower.includes(kw)));

  const isDropoffAtAirport =
    formData.dropoff_is_airport === true ||
    (formData.dropoff_is_airport == null &&
      airportKeywords.some((kw) => dropoffLower.includes(kw)));

  // If pickup is at airport → returning flight. If dropoff → outgoing flight.
  const defaultIsOutgoing = isDropoffAtAirport;

  const [flightInfo, setFlightInfo] = useState("");
  const [isOutgoing, setIsOutgoing] = useState(defaultIsOutgoing);
  const [isInternational, setIsInternational] = useState(false);
  const [customsLocation, setCustomsLocation] = useState("");

  const handleSave = () => {
    const updates = { ...formData };

    if (isOutgoing) {
      updates.outgoing_flight_info = flightInfo;
    } else {
      updates.returning_flight_info = flightInfo;
    }

    if (isInternational) {
      updates.is_international_flight = true;
      updates.customs_clearance_location = customsLocation;
    }

    setFormData(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-500 to-cyan-500 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 text-white">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Plane size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Airport Trip Detected</h2>
              <p className="text-sm opacity-90">
                {isDropoffAtAirport ? "Drop-off at BNA" : "Pick-up from BNA"}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Flight Information <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                isOutgoing
                  ? "e.g. American #123, departs 2:30pm, Gate B12"
                  : "e.g. American #123, arrives 2:30pm from Aruba, Gate B12"
              }
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-sky-500 focus:ring-4 focus:ring-sky-100 outline-none transition-all"
              value={flightInfo}
              onChange={(e) => setFlightInfo(e.target.value)}
              autoFocus
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isInternational}
                onChange={(e) => setIsInternational(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-sky-600 focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-sm font-medium text-gray-700">
                International Flight
              </span>
            </label>

            {isInternational && (
              <div className="mt-3 pl-7">
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-2">
                  Customs Clearance Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. BNA Terminal A, Gate C15"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-100 outline-none"
                  value={customsLocation}
                  onChange={(e) => setCustomsLocation(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={!flightInfo.trim()}
            className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Save Flight Info
          </button>
        </div>
      </div>
    </div>
  );
}
