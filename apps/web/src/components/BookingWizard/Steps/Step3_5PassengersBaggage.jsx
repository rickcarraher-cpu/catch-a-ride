import { Users, Briefcase, Luggage } from "lucide-react";

export function Step3_5PassengersBaggage({
  formData,
  set,
  isPassengerMode = true,
}) {
  const mainTitle = isPassengerMode
    ? "How many passengers and bags?"
    : "Passenger and baggage details";

  const mainSubtext = isPassengerMode
    ? "Help us prepare the right vehicle for your trip"
    : "Enter passenger count and luggage details";

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{mainTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{mainSubtext}</p>
      </div>

      <div className="space-y-5">
        {/* Passengers & Standard Luggage */}
        <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl">
          <div className="flex items-center gap-2 pb-1">
            <Users size={16} className="text-indigo-600" />
            <span className="text-sm font-bold text-indigo-900 uppercase tracking-wider">
              Passengers & Luggage
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-indigo-800 block mb-2">
                👥 Passenger(s) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="1"
                value={formData.num_people || ""}
                onChange={(e) => set({ num_people: e.target.value })}
                className="w-full px-3 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-center text-base placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-indigo-800 block mb-2">
                🧳 Checked Bags
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formData.num_bags_checked || ""}
                onChange={(e) => set({ num_bags_checked: e.target.value })}
                className="w-full px-3 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-center text-base placeholder:text-gray-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-indigo-800 block mb-2">
                💼 Carry-on
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={formData.num_bags_carry_on || ""}
                onChange={(e) => set({ num_bags_carry_on: e.target.value })}
                className="w-full px-3 py-3 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-center text-base placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Special Items (optional) */}
        <div className="space-y-3 p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl">
          <div className="flex items-center gap-2 pb-1">
            <Luggage size={16} className="text-amber-600" />
            <span className="text-sm font-bold text-amber-900 uppercase tracking-wider">
              Special Items (Optional)
            </span>
          </div>
          <textarea
            placeholder="Golf Bags, Strollers, Car Seats etc. — Example: 1 Golf Bag, 1 Stroller, 2 Car Seats"
            value={formData.special_items || ""}
            onChange={(e) => set({ special_items: e.target.value })}
            rows={2}
            className="w-full px-3 py-3 bg-white border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100 outline-none transition-all text-base placeholder:text-gray-400 resize-none"
          />
        </div>

        {isPassengerMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800">
            💡 <strong>Note:</strong> Passenger count is required. Bag counts
            are optional but help us prepare the right vehicle.
          </div>
        )}
      </div>
    </>
  );
}
