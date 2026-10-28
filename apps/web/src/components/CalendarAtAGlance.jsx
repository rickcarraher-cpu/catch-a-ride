"use client";

import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getDateStringInCDT } from "@/utils/timezone";

export default function CalendarAtAGlance({ trips = [], drivers = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Navigate months
  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  // Get active trips only (not cancelled or tentative)
  const activeTrips = useMemo(() => {
    return (trips || []).filter(
      (t) =>
        t.status !== "cancelled" && t.status !== "canceled" && !t.is_tentative,
    );
  }, [trips]);

  // Count trips per day for the current month
  const tripCountsByDate = useMemo(() => {
    const counts = {};
    activeTrips.forEach((trip) => {
      const dateStr = getDateStringInCDT(trip.start_time);
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    return counts;
  }, [activeTrips]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDay = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const tripCount = tripCountsByDate[dateStr] || 0;
      const isToday = dateStr === getDateStringInCDT(new Date());

      days.push({ day, dateStr, tripCount, isToday });
    }

    return days;
  }, [currentMonth, tripCountsByDate]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const isCurrentMonth =
    currentMonth.getMonth() === new Date().getMonth() &&
    currentMonth.getFullYear() === new Date().getFullYear();

  const handleDayClick = (dateStr) => {
    window.location.href = `/calendar?date=${dateStr}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900">
              Calendar at a Glance
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isCurrentMonth && (
              <button
                onClick={goToToday}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-md transition-colors"
              >
                Today
              </button>
            )}
            <div className="flex items-center bg-white border border-gray-200 rounded-lg">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-gray-50 rounded-l-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium px-4 min-w-[160px] text-center border-x border-gray-200">
                {monthName}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-gray-50 rounded-r-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-5">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-semibold text-gray-500 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayData, idx) => {
            if (!dayData) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const { day, dateStr, tripCount, isToday } = dayData;

            return (
              <button
                key={day}
                onClick={() => handleDayClick(dateStr)}
                title={`View ${dateStr} schedule`}
                className={`aspect-square rounded-lg border-2 transition-all hover:border-blue-400 hover:shadow-md relative ${
                  isToday
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex flex-col items-center justify-center h-full p-1">
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? "text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {day}
                  </span>
                  {tripCount > 0 && (
                    <span className="mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                      {tripCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          Click a day to open its full schedule
        </p>
      </div>
    </div>
  );
}
