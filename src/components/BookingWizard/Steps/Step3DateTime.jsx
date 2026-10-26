import { AlertTriangle, Clock, Plane } from "lucide-react";

function getAfterHoursAddon(addons) {
  if (!addons) return null;
  return addons.find((a) => {
    const n = a.name.toLowerCase();
    return (
      n.includes("after hour") ||
      n.includes("before hour") ||
      n.includes("off hour") ||
      n.includes("after-hour")
    );
  });
}

function isOutsideBusinessHours(time, settings) {
  if (!time) return false;
  const start = settings?.business_hours_start || "06:00";
  const end = settings?.business_hours_end || "22:00";
  return time < start || time >= end;
}

function formatDisplayTime(t) {
  if (!t) return t;
  const [hh, mm] = t.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mm} ${ampm}`;
}

// Get today's date in local timezone (YYYY-MM-DD format)
function getTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function Step3DateTime({
  formData,
  set,
  addons,
  settings,
  isPassengerMode = true,
}) {
  const handleTimeChange = (newTime) => {
    set({ time: newTime });
  };

  const handleReturnDateChange = (newDate) => {
    set({ return_date: newDate });
  };

  const handleReturnTimeChange = (newTime) => {
    set({ return_time: newTime });
  };

  const outside = isOutsideBusinessHours(formData.time, settings);
  const afterHoursAddon = getAfterHoursAddon(addons);
  const start = settings?.business_hours_start || "06:00";
  const end = settings?.business_hours_end || "22:00";

  const isRoundTrip =
    formData.trip_type === "round-trip" || formData.is_round_trip;

  const mainTitle = isRoundTrip
    ? isPassengerMode
      ? "When do you need your rides?"
      : "When are the trips?"
    : isPassengerMode
      ? "When do you need a ride?"
      : "When is the trip?";

  const mainSubtext = isRoundTrip
    ? "Pick dates and times for both trips"
    : "Pick a date and time";

  const afterHoursNote = isPassengerMode
    ? afterHoursAddon
      ? `You may want to add the "${afterHoursAddon.name}" add-on.`
      : " An additional fee may apply."
    : afterHoursAddon
      ? `Consider adding the "${afterHoursAddon.name}" add-on.`
      : " An additional fee may apply.";

  const returnTripNote = isPassengerMode
    ? "Your pickup and dropoff locations will be automatically reversed for the return trip"
    : "Pickup and dropoff locations will be automatically reversed for the return trip";

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{mainTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{mainSubtext}</p>
      </div>
      <div className="space-y-5">
        {/* Outbound Trip Section */}
        <div className="space-y-4">
          {isRoundTrip && (
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-indigo-600" />
              <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
                Incoming Trip
              </span>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              min={isPassengerMode ? getTodayLocal() : undefined}
              onChange={(e) => set({ date: e.target.value })}
              className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-100 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              {isPassengerMode ? "Pickup Time" : "Pickup Time"}
            </label>
            {/* Advisory note removed from here — moved to Incoming/Return Time below */}
            <input
              type="time"
              value={formData.time}
              onChange={(e) => handleTimeChange(e.target.value)}
              className={`w-full px-5 py-4 text-base border-2 rounded-2xl outline-none transition-all ${
                outside
                  ? "border-amber-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  : "border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-100"
              }`}
            />
          </div>

          {/* After-hours notice */}
          {outside && formData.time && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl">
              <AlertTriangle
                size={20}
                className="text-amber-600 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Outside Normal Business Hours
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Normal hours are {formatDisplayTime(start)} –{" "}
                  {formatDisplayTime(end)}.{afterHoursNote}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Return Trip Section - only show for round trips */}
        {isRoundTrip && (
          <div className="space-y-4 p-5 bg-purple-50 border-2 border-purple-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <Plane size={16} className="text-purple-600 rotate-180" />
              <span className="text-sm font-bold text-purple-900 uppercase tracking-wider">
                Return Trip
              </span>
            </div>

            <div>
              <label className="text-sm font-semibold text-purple-800 block mb-2">
                Return Date
              </label>
              <input
                type="date"
                value={formData.return_date || ""}
                min={
                  isPassengerMode ? formData.date || getTodayLocal() : undefined
                }
                onChange={(e) => handleReturnDateChange(e.target.value)}
                className="w-full px-5 py-4 text-base bg-white border-2 border-purple-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-purple-800 block mb-2">
                Return Time
              </label>
              {/* Advisory note for passengers about baggage pickup timing */}
              {isPassengerMode && (
                <div className="mb-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-xl">
                  <span className="text-amber-500 shrink-0 mt-0.5">ℹ️</span>
                  <p className="text-xs text-amber-800 font-medium">
                    Add 15 minutes for carry-on and 30 minutes for checked
                    luggage
                  </p>
                </div>
              )}
              <input
                type="time"
                value={formData.return_time || ""}
                onChange={(e) => handleReturnTimeChange(e.target.value)}
                className="w-full px-5 py-4 text-base bg-white border-2 border-purple-200 rounded-2xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all"
              />
            </div>

            <div className="flex items-start gap-2 p-3 bg-purple-100 rounded-xl">
              <span className="text-purple-700 text-xs">ℹ️</span>
              <p className="text-xs text-purple-700 font-medium">
                {returnTripNote}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
