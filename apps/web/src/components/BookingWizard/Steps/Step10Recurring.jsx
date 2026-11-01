"use client";

import { Repeat, Calendar, Hash, Info } from "lucide-react";

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function Step10Recurring({ formData, set }) {
  const showDayOfWeek =
    formData.frequency === "weekly" || formData.frequency === "bi-weekly";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recurring Schedule</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure how often this trip should repeat
        </p>
      </div>

      {/* Frequency */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Repeat size={16} className="text-blue-600" />
          Frequency
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: "daily", label: "Daily", icon: "📅" },
            { value: "weekly", label: "Weekly", icon: "📆" },
            { value: "bi-weekly", label: "Bi-Weekly", icon: "🗓️" },
            { value: "monthly", label: "Monthly", icon: "🗓️" },
          ].map((freq) => (
            <button
              key={freq.value}
              type="button"
              onClick={() => set({ frequency: freq.value })}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                formData.frequency === freq.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{freq.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900">{freq.label}</p>
                  <p className="text-xs text-gray-500">
                    Repeats {freq.label.toLowerCase()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Day of Week (only for weekly/bi-weekly) */}
      {showDayOfWeek && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Calendar size={16} className="text-blue-600" />
            Day of Week
          </label>
          <select
            value={formData.day_of_week}
            onChange={(e) => set({ day_of_week: e.target.value })}
            className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
          >
            <option value="">Select day...</option>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Number of Occurrences */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Hash size={16} className="text-blue-600" />
          Number of Trips
        </label>
        <input
          type="number"
          value={formData.num_occurrences}
          onChange={(e) => set({ num_occurrences: e.target.value })}
          min="0"
          placeholder="Leave empty for unlimited"
          className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
        />
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span>
            Leave empty or enter 0 for unlimited recurring trips. Enter a number
            to limit how many trips will be generated.
          </span>
        </p>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">How Recurring Trips Work</p>
            <ul className="space-y-1 text-blue-800">
              <li>
                • The series will start on the date you selected in step 3
              </li>
              <li>
                • Trips are generated when you click "Generate" in the recurring
                trips list
              </li>
              <li>
                • Each generated trip can be edited or cancelled independently
              </li>
              <li>
                • Modifying this series won't affect already-generated trips
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
