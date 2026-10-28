import { useState, useEffect } from "react";
import { DollarSign, Users, Clock, Car } from "lucide-react";

export function StepTourPricing({ formData, set }) {
  const [editingFee, setEditingFee] = useState(false);
  const [tempFee, setTempFee] = useState("");
  const [categories, setCategories] = useState([]);

  // Fetch vehicle categories on mount
  useEffect(() => {
    fetch("/api/vehicles/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  // participants = guests (num_people) + 1 driver — always the correct formula
  const numGuests = parseInt(formData.num_people) || 0;
  const participantCount = numGuests + 1;
  const flatFee = parseFloat(formData.tour_flat_fee) || 0;

  // Calculate individual share if divided
  const individualShare =
    formData.tour_payment_split === "divided" && participantCount > 0
      ? Math.ceil(flatFee / participantCount)
      : 0;

  const handleSaveFee = () => {
    const fee = parseFloat(tempFee);
    if (!isNaN(fee) && fee >= 0) {
      set({ tour_flat_fee: fee });
      setEditingFee(false);
    }
  };

  // Calculate duration
  const startTime = formData.time
    ? new Date(`2000-01-01T${formData.time}`)
    : null;
  const endTime = formData.tour_end_time
    ? new Date(`2000-01-01T${formData.tour_end_time}`)
    : null;
  const durationMinutes =
    startTime && endTime ? (endTime - startTime) / (1000 * 60) : 0;
  const durationHours =
    durationMinutes > 0 ? (durationMinutes / 60).toFixed(1) : 0;

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Tour Pricing & Duration
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Set the flat fee and payment structure for this tour
        </p>
      </div>

      {/* Vehicle Preference Section */}
      <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Car size={18} className="text-amber-600" />
          <span className="text-sm font-bold text-amber-900 uppercase tracking-wider">
            Vehicle Preference
          </span>
        </div>
        <div>
          <label className="text-sm font-semibold text-amber-800 block mb-2">
            Preferred Vehicle Type
          </label>
          <select
            value={formData.vehicle_category || ""}
            onChange={(e) => set({ vehicle_category: e.target.value || null })}
            className="w-full px-4 py-3 border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none bg-white text-gray-800 font-medium"
          >
            <option value="" disabled>
              — Select vehicle type —
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        {formData.vehicle_category && (
          <p className="text-xs text-amber-700">
            ✓ Vehicle preference set to{" "}
            <span className="font-semibold">{formData.vehicle_category}</span>
          </p>
        )}
      </div>

      {/* Duration Section */}
      <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          <span className="text-sm font-bold text-blue-900 uppercase tracking-wider">
            Tour Duration
          </span>
        </div>

        {/* Start time */}
        <div>
          <label className="text-sm font-semibold text-blue-800 block mb-2">
            Start Time
          </label>
          <input
            type="time"
            value={formData.time || ""}
            onChange={(e) => set({ time: e.target.value })}
            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>

        {/* End time */}
        <div>
          <label className="text-sm font-semibold text-blue-800 block mb-2">
            End Time
          </label>
          <input
            type="time"
            value={formData.tour_end_time || ""}
            onChange={(e) => set({ tour_end_time: e.target.value })}
            className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>

        {/* Duration display */}
        {durationMinutes > 0 && (
          <div className="p-4 bg-white border-2 border-blue-200 rounded-xl">
            <p className="text-sm text-gray-600">Tour Duration</p>
            <p className="text-2xl font-bold text-blue-900">
              {durationHours} hour{durationHours !== "1.0" ? "s" : ""}
              {durationMinutes % 60 !== 0 && (
                <span className="text-lg"> ({durationMinutes} minutes)</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Flat Fee Section */}
      <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-emerald-600" />
          <span className="text-sm font-bold text-emerald-900 uppercase tracking-wider">
            Flat Fee (No Mileage Calculation)
          </span>
        </div>

        {/* Flat fee input */}
        <div>
          <label className="text-sm font-semibold text-emerald-800 block mb-2">
            Total Flat Fee
          </label>
          {editingFee ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-1">
                <span className="text-gray-600 text-lg">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={tempFee}
                  onChange={(e) => setTempFee(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveFee();
                    if (e.key === "Escape") setEditingFee(false);
                  }}
                  className="flex-1 px-4 py-2 border-2 border-emerald-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
              <button
                onClick={handleSaveFee}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
              >
                Save
              </button>
              <button
                onClick={() => setEditingFee(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                setTempFee(formData.tour_flat_fee || "");
                setEditingFee(true);
              }}
              className="flex items-center justify-between px-4 py-3 bg-white border-2 border-emerald-200 rounded-xl hover:border-emerald-400 cursor-pointer transition-all group"
            >
              <span className="text-gray-900 font-medium text-lg">
                {flatFee > 0 ? `$${flatFee.toFixed(2)}` : "Not set"}
              </span>
              <span className="text-sm text-emerald-600 group-hover:text-emerald-700">
                Click to edit
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-emerald-700">
          💡 For tours, pricing is a flat fee. Mileage to the destination is not
          calculated or used in pricing.
        </p>
      </div>

      {/* Payment Split Section */}
      <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl space-y-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-purple-600" />
          <span className="text-sm font-bold text-purple-900 uppercase tracking-wider">
            Payment Structure
          </span>
        </div>

        <div>
          <label className="text-sm font-semibold text-purple-800 block mb-3">
            How will payment be handled?
          </label>
          <div className="space-y-3">
            {/* Single payer */}
            <button
              type="button"
              onClick={() => set({ tour_payment_split: "single" })}
              className={`w-full p-4 text-left border-2 rounded-2xl transition-all ${
                formData.tour_payment_split === "single"
                  ? "border-purple-500 bg-purple-50 ring-4 ring-purple-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.tour_payment_split === "single"
                      ? "border-purple-500"
                      : "border-gray-400"
                  }`}
                >
                  {formData.tour_payment_split === "single" && (
                    <div className="w-3 h-3 rounded-full bg-purple-600" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    Paid by One Passenger
                  </p>
                  <p className="text-sm text-gray-600">
                    Single payer covers the entire flat fee
                  </p>
                </div>
              </div>
            </button>

            {/* Divided equally */}
            <button
              type="button"
              onClick={() => set({ tour_payment_split: "divided" })}
              className={`w-full p-4 text-left border-2 rounded-2xl transition-all ${
                formData.tour_payment_split === "divided"
                  ? "border-purple-500 bg-purple-50 ring-4 ring-purple-100"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formData.tour_payment_split === "divided"
                      ? "border-purple-500"
                      : "border-gray-400"
                  }`}
                >
                  {formData.tour_payment_split === "divided" && (
                    <div className="w-3 h-3 rounded-full bg-purple-600" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">Divided Equally</p>
                  <p className="text-sm text-gray-600">
                    Split among all passengers (rounded up to nearest dollar)
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Show payment breakdown if divided */}
        {formData.tour_payment_split === "divided" && flatFee > 0 && (
          <div className="p-4 bg-white border-2 border-purple-200 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-purple-900">
              Payment Breakdown
            </p>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Total Flat Fee</span>
              <span className="font-semibold text-gray-900">
                ${flatFee.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Number of Participants</span>
              <span className="font-semibold text-gray-900">
                {participantCount} ({numGuests} guest
                {numGuests !== 1 ? "s" : ""} + 1 driver)
              </span>
            </div>
            <div className="border-t-2 border-purple-200 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-purple-900">
                  Per Person (rounded up)
                </span>
                <span className="text-2xl font-bold text-purple-700">
                  ${individualShare.toFixed(2)}
                </span>
              </div>
            </div>
            <p className="text-xs text-purple-600 mt-2">
              Each participant pays ${individualShare.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xl">ℹ️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Tour Pricing
            </p>
            <p className="text-sm text-blue-800 leading-relaxed">
              Tours use flat-fee pricing instead of mileage-based pricing. The
              destination field is for logistics only and won't be used to
              calculate the price. When divided equally, the fee is split among
              all participants and rounded up to the nearest whole dollar.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
