export function PassengerBaggageSection({
  formData,
  setFormData,
  isAirportTrip,
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase">
        Passenger & Baggage (Optional)
      </label>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-500"># of People</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.num_people}
            onChange={(e) =>
              setFormData({ ...formData, num_people: e.target.value })
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Checked Bags</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.num_bags_checked}
            onChange={(e) =>
              setFormData({
                ...formData,
                num_bags_checked: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">Carry-On Bags</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.num_bags_carry_on}
            onChange={(e) =>
              setFormData({
                ...formData,
                num_bags_carry_on: e.target.value,
              })
            }
          />
        </div>
      </div>

      {/* Golf Bags & Car Seats row */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-xs text-gray-500">🏌️ Golf Bags</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.num_golf_bags || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                num_golf_bags: e.target.value,
              })
            }
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500">🧸 Car Seats</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
            value={formData.num_car_seats || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                num_car_seats: e.target.value,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
