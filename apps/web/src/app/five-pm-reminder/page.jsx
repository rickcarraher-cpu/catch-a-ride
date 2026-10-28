"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Car,
  Calendar,
  ArrowLeft,
} from "lucide-react";

export default function FivePMReminderPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  // Fetch trips for the selected date only (midnight to 11:59:59 PM)
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["confirmation-status", selectedDate],
    queryFn: async () => {
      // Start of selected date (midnight)
      const startDate = new Date(selectedDate + "T00:00:00");
      // End of selected date (11:59:59 PM)
      const endDate = new Date(selectedDate + "T23:59:59");

      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: "500",
      });

      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to load trips");
      const data = await res.json();
      return Array.isArray(data) ? data : data.appointments || [];
    },
  });

  // Filter out cancelled trips and group by confirmation status
  const stats = useMemo(() => {
    const activeTrips = trips.filter((t) => t.status !== "cancelled");

    const passengerPending = activeTrips.filter(
      (t) => t.passenger_confirmed === "pending" || !t.passenger_confirmed,
    );
    const passengerConfirmed = activeTrips.filter(
      (t) => t.passenger_confirmed === "confirmed",
    );
    const passengerCancelled = activeTrips.filter(
      (t) => t.passenger_confirmed === "cancelled",
    );

    const driverPending = activeTrips.filter(
      (t) => t.driver_accepted === "pending" || !t.driver_accepted,
    );
    const driverAccepted = activeTrips.filter(
      (t) => t.driver_accepted === "accepted",
    );
    const driverDeclined = activeTrips.filter(
      (t) => t.driver_accepted === "declined",
    );

    const fullyConfirmed = activeTrips.filter(
      (t) =>
        t.passenger_confirmed === "confirmed" &&
        t.driver_accepted === "accepted",
    );

    return {
      total: activeTrips.length,
      passengerPending,
      passengerConfirmed,
      passengerCancelled,
      driverPending,
      driverAccepted,
      driverDeclined,
      fullyConfirmed,
    };
  }, [trips]);

  const formatTime = (dt) => {
    return new Date(dt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Chicago",
    });
  };

  const formatDate = (dt) => {
    return new Date(dt).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "America/Chicago",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors mb-2"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </a>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Clock size={28} className="text-blue-600" />5 PM Confirmation
                Report
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Driver and passenger confirmation status for upcoming trips
              </p>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Report Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total Trips
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Fully Confirmed
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {stats.fullyConfirmed.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Passenger Pending
                </p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {stats.passengerPending.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <User size={24} className="text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Driver Pending
                </p>
                <p className="text-3xl font-bold text-purple-600 mt-1">
                  {stats.driverPending.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Car size={24} className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Passenger Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User size={20} />
                Passenger Confirmations
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Pending */}
              {stats.passengerPending.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Pending ({stats.passengerPending.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.passengerPending.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-orange-50 border border-orange-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.client_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} •{" "}
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                            {trip.destination && (
                              <p className="text-xs text-gray-500 mt-1">
                                → {trip.destination}
                              </p>
                            )}
                          </div>
                          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
                            PENDING
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmed */}
              {stats.passengerConfirmed.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Confirmed ({stats.passengerConfirmed.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.passengerConfirmed.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-green-50 border border-green-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.client_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} •{" "}
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                          </div>
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                            ✓ CONFIRMED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancelled */}
              {stats.passengerCancelled.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                    <XCircle size={16} />
                    Cancelled ({stats.passengerCancelled.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.passengerCancelled.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.client_name || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} •{" "}
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                          </div>
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                            ✗ CANCELLED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.passengerPending.length === 0 &&
                stats.passengerConfirmed.length === 0 &&
                stats.passengerCancelled.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No passenger confirmations for this date range
                  </p>
                )}
            </div>
          </div>

          {/* Driver Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Car size={20} />
                Driver Acceptances
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Pending */}
              {stats.driverPending.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-orange-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Pending ({stats.driverPending.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.driverPending.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-orange-50 border border-orange-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.employee_name || "Unassigned"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} • {trip.client_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                          </div>
                          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
                            PENDING
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accepted */}
              {stats.driverAccepted.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Accepted ({stats.driverAccepted.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.driverAccepted.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-green-50 border border-green-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.employee_name || "Unassigned"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} • {trip.client_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                          </div>
                          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                            ✓ ACCEPTED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Declined */}
              {stats.driverDeclined.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-2">
                    <XCircle size={16} />
                    Declined ({stats.driverDeclined.length})
                  </h3>
                  <div className="space-y-2">
                    {stats.driverDeclined.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-red-50 border border-red-200 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {trip.employee_name || "Unassigned"}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              #{trip.booking_number} • {trip.client_name}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(trip.start_time)} at{" "}
                              {formatTime(trip.start_time)}
                            </p>
                            {trip.driver_declined_reason && (
                              <p className="text-xs text-red-600 mt-1 italic">
                                Reason: {trip.driver_declined_reason}
                              </p>
                            )}
                          </div>
                          <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                            ✗ DECLINED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stats.driverPending.length === 0 &&
                stats.driverAccepted.length === 0 &&
                stats.driverDeclined.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No driver acceptances for this date range
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
