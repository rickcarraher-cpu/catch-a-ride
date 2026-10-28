"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  LayoutList,
  Users,
  Search,
} from "lucide-react";
import { useTrips } from "@/hooks/useTrips";
import { getTodayInCDT, formatDateCDT, formatTimeCDT } from "@/utils/timezone";
import PageHeader from "@/components/PageHeader";

export default function AllTripsReport() {
  // Force refresh data every time this page opens
  const [selectedDate, setSelectedDate] = useState(() => getTodayInCDT());
  const [searchQuery, setSearchQuery] = useState("");

  const goBack = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const goForward = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const goToday = () => {
    setSelectedDate(getTodayInCDT());
  };

  const isToday = selectedDate === getTodayInCDT();

  const displayDate = formatDateCDT(selectedDate + "T12:00:00", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const {
    trips: allTrips,
    isLoading: tripsLoading,
    drivers: employees,
  } = useTrips({
    fetchTrips: true,
    fetchDrivers: true,
  });

  // Helper to get driver info — must be defined before useMemo that uses it
  const getDriverName = (employeeId) => {
    if (!employeeId) return "Unassigned";
    const driver = employees?.find((e) => e.id === employeeId);
    return driver?.name || "Unknown";
  };

  const getDriverColor = (employeeId) => {
    if (!employeeId) return "#FCD34D";
    const driver = employees?.find((e) => e.id === employeeId);
    return driver?.color || "#2563EB";
  };

  // Filter trips to selected day and sort by TIME ONLY (ascending)
  const sortedTrips = useMemo(() => {
    if (!allTrips) return [];

    const dayStart = new Date(selectedDate + "T00:00:00");
    const dayEnd = new Date(selectedDate + "T23:59:59");

    // Filter to selected day
    const dayTrips = allTrips.filter((t) => {
      const tripDate = new Date(t.start_time);
      return tripDate >= dayStart && tripDate <= dayEnd;
    });

    // ✅ Apply search filter
    const searchFiltered = dayTrips.filter((trip) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      const driverName = getDriverName(trip.employee_id).toLowerCase();
      const passengerName = (trip.client_name || "").toLowerCase();
      const bookingNumber = (trip.booking_number || "").toLowerCase();
      const destination = (
        trip.destination ||
        trip.dropoff_address ||
        ""
      ).toLowerCase();

      return (
        bookingNumber.includes(query) ||
        passengerName.includes(query) ||
        driverName.includes(query) ||
        destination.includes(query)
      );
    });

    // ✅ SORT BY TIME ONLY (ASCENDING) - NO DRIVER GROUPING
    return searchFiltered.sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time),
    );
  }, [allTrips, selectedDate, searchQuery, employees]);

  return (
    <div className="p-6 space-y-6">
      {/* Dynamic page header - pulls title from routes configuration */}
      <PageHeader subtitle={displayDate} showBackButton={false} />

      {/* Additional back link and view passengers */}
      <div className="flex items-center gap-4">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>
        <a
          href="/passengers"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <Users size={16} />
          View Passengers
        </a>
      </div>

      {/* Date navigation and print button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <label className="relative cursor-pointer">
            <span className="text-sm font-medium px-2">{displayDate}</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>
          <button
            onClick={goForward}
            className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          {!isToday && (
            <button
              onClick={goToday}
              className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-50 rounded-md"
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by booking #, passenger, driver, or destination..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm font-medium"
            >
              Clear
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-gray-500 mt-2">
            Found {sortedTrips.length} trip{sortedTrips.length !== 1 ? "s" : ""}{" "}
            matching "{searchQuery}"
          </p>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {tripsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
          </div>
        ) : sortedTrips.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              No trips scheduled for this day
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Booking #
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Booked
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Passenger
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTrips.map((trip) => {
                  const driverName = getDriverName(trip.employee_id);
                  const driverColor = getDriverColor(trip.employee_id);

                  // Smart destination display for return trips
                  const isReturnTrip = (trip.notes || "")
                    .toLowerCase()
                    .includes("return trip");
                  const destLower = (trip.destination || "").toLowerCase();
                  const isAirportDest = [
                    "bna",
                    "terminal",
                    "airport",
                    "concourse",
                  ].some((kw) => destLower.includes(kw));
                  const toDisplay =
                    isReturnTrip && isAirportDest
                      ? [trip.dropoff_street, trip.dropoff_city]
                          .filter(Boolean)
                          .join(", ") || trip.dropoff_address
                      : trip.destination || trip.dropoff_address;

                  // Best available flight info
                  const flightInfo =
                    trip.returning_flight_info ||
                    (isReturnTrip
                      ? trip.outgoing_flight_info
                      : trip.outgoing_flight_info) ||
                    null;

                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-bold text-blue-600 whitespace-nowrap">
                        {formatTimeCDT(trip.start_time)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {trip.booking_number ? (
                          <span className="font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                            {trip.booking_number}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {trip.created_at
                          ? new Date(trip.created_at).toLocaleString("en-US", {
                              timeZone: "America/Chicago",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {trip.client_name}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: driverColor }}
                          >
                            {driverName.charAt(0)}
                          </div>
                          <span className="text-gray-700">{driverName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div>{toDisplay || "—"}</div>
                        {flightInfo && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            ✈ {flightInfo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {trip.payment_status === "paid" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                            PAID
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            Unpaid
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        ${Number(trip.balance_due || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
