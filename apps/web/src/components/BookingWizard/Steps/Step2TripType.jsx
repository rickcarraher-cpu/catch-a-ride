import {
  ArrowRight,
  ArrowLeftRight,
  Mail,
  Bell,
  Bus,
  Clock,
  DollarSign,
} from "lucide-react";

export function Step2TripType({
  formData,
  set,
  isPassengerMode = true,
  enableTourBooking = false,
}) {
  // Helper: round up to nearest 15 min (0.25 hr) and calculate price
  const calcTimeBased = (rawHours) => {
    const h = parseFloat(rawHours);
    if (!rawHours || isNaN(h) || h <= 0) return { roundedHours: 0, price: 0 };
    const roundedHours = Math.ceil(h * 4) / 4;
    const price = roundedHours * 55;
    return { roundedHours, price };
  };

  const { roundedHours, price: calcPrice } = calcTimeBased(
    formData.trip_duration_hours,
  );

  const handleTripTypeSelection = (type) => {
    set({
      trip_type: type,
      is_round_trip: type === "round-trip",
      is_tour: type === "tour",
      ...(type === "one-way" && {
        return_date: "",
        return_time: "",
        tour_end_time: "",
        tour_participants: [],
        tour_itinerary: [],
      }),
      ...(type === "round-trip" && {
        tour_end_time: "",
        tour_participants: [],
        tour_itinerary: [],
      }),
      ...(type === "tour" && {
        return_date: "",
        return_time: "",
        vehicle_category: "Luxury Van", // Lock to Luxury Van
      }),
    });
  };

  const contactTitle = isPassengerMode
    ? "Contact & Trip Details"
    : "Passenger Contact & Trip Details";
  const contactSubtext = isPassengerMode
    ? "How should we reach you? (Optional)"
    : "How should we reach the passenger? (Optional)";
  const emailPlaceholder = isPassengerMode
    ? "passenger@email.com"
    : "passenger@email.com";
  const notifQuestion = isPassengerMode
    ? "How would you like to receive your confirmation?"
    : "How should the passenger receive their confirmation?";
  const roundTripNote = isPassengerMode
    ? "Your pickup and dropoff locations will be automatically reversed for the return trip"
    : "Pickup and dropoff locations will be automatically reversed for the return trip";

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{contactTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{contactSubtext}</p>
      </div>

      {/* Email - Optional */}
      <div>
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
          <Mail size={16} className="text-gray-400" />
          Email Address{" "}
          <span className="text-gray-400 font-normal text-xs">(Optional)</span>
        </label>
        <input
          type="email"
          placeholder={emailPlaceholder}
          value={formData.email}
          onChange={(e) => set({ email: e.target.value })}
          className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-600"
        />
      </div>

      {/* Notification Preference */}
      <div>
        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
          <Bell size={16} className="text-gray-400" />
          {notifQuestion}
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
              onClick={() => set({ notification_preference: opt.value })}
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

      {/* Divider */}
      <div className="border-t-2 border-gray-200 my-2"></div>

      {/* ── TIME-BASED TRIP QUESTION — ADMIN ONLY ────────────────────── */}
      {!isPassengerMode && (
        <>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock size={22} className="text-blue-500" />
              Is this trip based on time?
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Time-based trips are saved as a Quote. Price = duration × $55/hr
              (rounded up to nearest 15 min).
            </p>
          </div>

          <div className="flex gap-3">
            {/* YES */}
            <button
              type="button"
              onClick={() => set({ is_time_based: true, status: "quote" })}
              className={`flex-1 p-4 rounded-2xl border-2 font-bold text-base transition-all ${
                formData.is_time_based === true
                  ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100 text-blue-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              ✓ Yes
            </button>
            {/* NO (default) */}
            <button
              type="button"
              onClick={() =>
                set({
                  is_time_based: false,
                  status: "pending",
                  trip_duration_hours: "",
                })
              }
              className={`flex-1 p-4 rounded-2xl border-2 font-bold text-base transition-all ${
                formData.is_time_based === false
                  ? "border-gray-500 bg-gray-100 ring-4 ring-gray-200 text-gray-800"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              ✕ No
            </button>
          </div>

          {/* Duration input — shown when Yes is selected */}
          {formData.is_time_based && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-2">
                  <Clock size={15} />
                  Duration (hours, e.g. 1.5 = 1 hr 30 min)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="e.g. 2.5"
                  value={formData.trip_duration_hours}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const { roundedHours: rh, price: p } = calcTimeBased(raw);
                    set({
                      trip_duration_hours: raw,
                      ...(raw && parseFloat(raw) > 0
                        ? { service_price: p }
                        : { service_price: "" }),
                    });
                  }}
                  className="w-full px-5 py-4 text-base border-2 border-blue-300 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:text-gray-500"
                />
              </div>

              {/* Price preview */}
              {formData.trip_duration_hours &&
                parseFloat(formData.trip_duration_hours) > 0 && (
                  <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm text-blue-700">
                      <span>Rounded duration:</span>
                      <span className="font-semibold">
                        {roundedHours} hr{roundedHours !== 1 ? "s" : ""} (
                        {Math.round(roundedHours * 60)} min)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-blue-700">Rate:</span>
                      <span className="text-sm font-semibold text-blue-700">
                        $55 / hr
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-blue-100">
                      <span className="text-base font-bold text-blue-900 flex items-center gap-1">
                        <DollarSign size={16} />
                        Calculated Price:
                      </span>
                      <span className="text-xl font-extrabold text-emerald-700">
                        ${calcPrice.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600">
                      ℹ️ Status will be saved as <strong>Quote</strong>. Price is
                      pre-filled but can be overridden in the Pricing step.
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Divider before one-way/round-trip */}
          <div className="border-t-2 border-gray-200 my-2"></div>
        </>
      )}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {enableTourBooking
            ? "What type of trip is this?"
            : "Is this a one-way or round-trip?"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          We'll help you plan accordingly
        </p>
      </div>

      <div className="space-y-3">
        {/* One-Way Option */}
        <button
          type="button"
          onClick={() => handleTripTypeSelection("one-way")}
          className={`w-full p-6 text-left border-2 rounded-2xl transition-all ${
            formData.trip_type === "one-way"
              ? "border-pink-500 bg-pink-50 ring-4 ring-pink-100 scale-[1.02]"
              : "border-gray-200 hover:border-gray-300 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  formData.trip_type === "one-way"
                    ? "bg-pink-500"
                    : "bg-gray-200"
                }`}
              >
                <ArrowRight
                  size={24}
                  className={
                    formData.trip_type === "one-way"
                      ? "text-white"
                      : "text-gray-500"
                  }
                />
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">One-Way Trip</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Single journey from pickup to destination
                </p>
              </div>
            </div>
            {formData.trip_type === "one-way" && (
              <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </div>
        </button>

        {/* Round-Trip Option */}
        <button
          type="button"
          onClick={() => handleTripTypeSelection("round-trip")}
          className={`w-full p-6 text-left border-2 rounded-2xl transition-all ${
            formData.trip_type === "round-trip"
              ? "border-pink-500 bg-pink-50 ring-4 ring-pink-100 scale-[1.02]"
              : "border-gray-200 hover:border-gray-300 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  formData.trip_type === "round-trip"
                    ? "bg-pink-500"
                    : "bg-gray-200"
                }`}
              >
                <ArrowLeftRight
                  size={24}
                  className={
                    formData.trip_type === "round-trip"
                      ? "text-white"
                      : "text-gray-500"
                  }
                />
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">Round-Trip</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Book both outbound and return rides together
                </p>
              </div>
            </div>
            {formData.trip_type === "round-trip" && (
              <div className="w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </div>
        </button>

        {/* Tour Option - Only show if enabled */}
        {enableTourBooking && (
          <button
            type="button"
            onClick={() => handleTripTypeSelection("tour")}
            className={`w-full p-6 text-left border-2 rounded-2xl transition-all ${
              formData.trip_type === "tour"
                ? "border-purple-500 bg-purple-50 ring-4 ring-purple-100 scale-[1.02]"
                : "border-gray-200 hover:border-gray-300 hover:scale-[1.01]"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    formData.trip_type === "tour"
                      ? "bg-purple-500"
                      : "bg-gray-200"
                  }`}
                >
                  <Bus
                    size={24}
                    className={
                      formData.trip_type === "tour"
                        ? "text-white"
                        : "text-gray-500"
                    }
                  />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900">Tour</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Multi-passenger shared ride with multiple stops (Luxury Van,
                    max 8)
                  </p>
                </div>
              </div>
              {formData.trip_type === "tour" && (
                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Show additional info for round-trip */}
      {formData.trip_type === "round-trip" && (
        <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <ArrowLeftRight size={20} className="text-purple-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-purple-900">
                Round-Trip Benefits
              </p>
              <ul className="text-xs text-purple-700 mt-2 space-y-1">
                <li>• Book both trips at once</li>
                <li>• {roundTripNote}</li>
                <li>• Saves time and ensures the return ride is scheduled</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Show additional info for tour */}
      {formData.trip_type === "tour" && (
        <div className="mt-4 p-4 bg-purple-50 border-2 border-purple-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <Bus size={20} className="text-purple-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-purple-900">Tour Features</p>
              <ul className="text-xs text-purple-700 mt-2 space-y-1">
                <li>• Luxury Van only (8 passenger maximum)</li>
                <li>• Flat-fee pricing (no mileage calculation)</li>
                <li>
                  • Individual pickup and drop-off locations for each
                  participant
                </li>
                <li>• Custom itinerary with multiple stops</li>
                <li>• Payment can be split equally among participants</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
