"use client";

import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  User,
  Calendar,
  Car,
  Phone,
  Mail,
  MapPin,
  Luggage,
  PlaneTakeoff,
  PlaneLanding,
  CalendarClock,
  DollarSign,
  CheckCircle2,
  StickyNote,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { useTrips } from "@/hooks/useTrips";
import { getDateStringInCDT } from "@/utils/timezone";
import { getTodayInCDT } from "@/utils/timezone";

// Lazy-load heavy modal component for code splitting
const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const d = params.get("date");
      if (d) {
        const [year, month, day] = d.split("-").map(Number);
        if (year && month && day) return new Date(year, month - 1, day);
      }
    }
    return new Date();
  });
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [deletingTrip, setDeletingTrip] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const paymentRef = useRef(null);

  // Filter state
  const [driverFilter, setDriverFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { trips, clients, drivers, services, transactions } = useTrips({
    fetchAllClients: true, // Include inactive passengers for edit mode
  });

  // Helper: calculate trip end time based on services duration
  const getTripEndTime = (trip) => {
    const start = new Date(trip.start_time);
    const totalDuration = (trip.services || []).reduce(
      (sum, s) =>
        sum + (Number(s.duration_minutes) || 0) * (Number(s.quantity) || 1),
      0,
    );
    const duration = totalDuration > 0 ? totalDuration : 75;
    return new Date(start.getTime() + duration * 60 * 1000);
  };

  // Format time for display
  const formatTime = (date) =>
    new Date(date).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  // Helper: get CDT date string YYYY-MM-DD for a trip's start time
  const getTripCDTDate = (startTime) => {
    if (!startTime) return "";
    return getDateStringInCDT(startTime);
  };

  // Fetch full detail for the selected trip
  const { data: selectedTrip, isLoading: loadingDetail } = useQuery({
    queryKey: ["calendar-trip-detail", selectedTripId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${selectedTripId}`);
      if (!res.ok) throw new Error("Failed to load trip");
      return res.json();
    },
    enabled: !!selectedTripId,
  });

  const paidTripIds = new Set(
    (transactions ?? []).map((t) => t.appointment_id).filter(Boolean),
  );

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/appointments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      setDeletingTrip(null);
      setSelectedTripId(null);
      toast.success("Trip deleted");
    },
    onError: () => toast.error("Failed to delete trip"),
  });

  // Get current date string YYYY-MM-DD in CDT
  const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

  // Filter trips to current date, then apply additional filters
  const dayTrips = trips?.filter(
    (t) =>
      getTripCDTDate(t.start_time) === currentDateStr &&
      t.status !== "cancelled" &&
      !t.is_tentative,
  );

  // Apply driver filter, status filter, and search
  const filteredDayTrips =
    dayTrips?.filter((trip) => {
      // Driver filter
      if (driverFilter !== "all" && trip.employee_id !== Number(driverFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "paid") {
          const isPaid = paidTripIds.has(trip.id);
          if (!isPaid) return false;
        } else if (statusFilter === "unpaid") {
          const isPaid = paidTripIds.has(trip.id);
          if (isPaid) return false;
        } else if (trip.status !== statusFilter) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = trip.client_name?.toLowerCase().includes(query);
        const matchesPhone = trip.client_phone?.includes(query);
        const matchesBooking = trip.booking_number
          ?.toLowerCase()
          .includes(query);
        const matchesDestination = trip.destination
          ?.toLowerCase()
          .includes(query);
        if (
          !matchesName &&
          !matchesPhone &&
          !matchesBooking &&
          !matchesDestination
        ) {
          return false;
        }
      }

      return true;
    }) || [];

  // Get unique driver IDs that have trips on this day
  const driversWithTrips = new Set(
    filteredDayTrips?.map((t) => t.employee_id).filter(Boolean) || [],
  );

  // Active drivers — show ONLY drivers with trips on this day
  const activeDrivers =
    drivers?.filter((d) => {
      if (!d.is_active) return false;
      if (!driversWithTrips.has(d.id)) return false;
      if (driverFilter !== "all" && d.id !== Number(driverFilter)) return false;
      return true;
    }) || [];

  // Unassigned trips — trips with no employee_id (only when showing all drivers)
  const unassignedTrips = filteredDayTrips.filter((t) => !t.employee_id);
  const hasUnassigned = unassignedTrips.length > 0 && driverFilter === "all";

  // Navigation handlers
  // Navigate by day (previously was by month)
  const goToPrev = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleEditTrip = () => {
    if (selectedTrip) {
      setEditingTrip(selectedTrip);
      setIsEditModalOpen(true);
    }
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setEditingTrip(null);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({
      queryKey: ["calendar-trip-detail", selectedTripId],
    });
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
    setEditingTrip(null);
  };

  // Auto-scroll to payment section when it appears
  useEffect(() => {
    if (showPayment && paymentRef.current) {
      setTimeout(() => {
        paymentRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 50);
    }
  }, [showPayment]);

  // Get trips for a specific driver and hour (use filtered trips)
  const getTripsForDriverHour = (driverId, hour) => {
    return (filteredDayTrips || []).filter((trip) => {
      if (trip.employee_id !== driverId) return false;
      const startTime = new Date(trip.start_time);
      const tripHour = startTime.getHours();
      return tripHour === hour;
    });
  };

  // Get unassigned trips for a specific hour
  const getUnassignedTripsForHour = (hour) => {
    return unassignedTrips.filter((trip) => {
      const startTime = new Date(trip.start_time);
      const tripHour = startTime.getHours();
      return tripHour === hour;
    });
  };

  // Generate 24 hours array (0-23)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <div className="max-w-[1800px] mx-auto w-full p-4 flex-1 flex flex-col min-h-0">
        {/* Back to Dashboard */}
        <div className="mb-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </a>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              24-Hour Calendar Grid
            </h1>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={goToPrev}
                className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
                title="Previous Day"
              >
                <ChevronLeft size={16} />
              </button>
              {/* Clickable date that opens a date picker */}
              <label className="relative cursor-pointer">
                <span className="text-sm font-medium px-4 min-w-[200px] text-center block hover:text-blue-600 transition-colors">
                  {currentDate.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [year, month, day] = e.target.value
                      .split("-")
                      .map(Number);
                    if (year && month && day)
                      setCurrentDate(new Date(year, month - 1, day));
                  }}
                  title="Jump to date"
                />
              </label>
              <button
                onClick={goToNext}
                className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
                title="Next Day"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            {/* Today button */}
            {currentDateStr !==
              (() => {
                const t = new Date();
                return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
              })() && (
              <button
                onClick={goToToday}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-md transition-colors border border-blue-100"
              >
                Today
              </button>
            )}
          </div>
          {/* Summary Stats - Inline */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-blue-100 border border-blue-200 rounded-sm" />
              <span className="text-xs font-medium text-gray-600">
                {filteredDayTrips?.length || 0} Trips
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-100 border border-green-200 rounded-sm" />
              <span className="text-xs font-medium text-gray-600">
                {activeDrivers.length} Drivers
              </span>
            </div>
            {hasUnassigned && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-orange-100 border border-orange-200 rounded-sm" />
                <span className="text-xs font-medium text-orange-600">
                  {unassignedTrips.length} Unassigned
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by passenger, phone, booking #, or destination..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Driver Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={16} />
            <select
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 min-w-[140px]"
              value={driverFilter}
              onChange={(e) => setDriverFilter(e.target.value)}
            >
              <option value="all">All Drivers</option>
              {drivers
                ?.filter((d) => d.is_active)
                .map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="quote">Quote</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="approved">Approved</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* 24-Hour Grid - Takes remaining space */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          {activeDrivers.length === 0 && !hasUnassigned ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium text-sm">
                  No trips match your filters
                </p>
                <p className="text-xs mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="sticky left-0 z-30 bg-gray-50 px-2 py-2 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 w-20">
                      Time
                    </th>
                    {hasUnassigned && (
                      <th
                        className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-wider border-r border-gray-200"
                        style={{
                          color: "#D97706",
                          backgroundColor: "#FEF3C7",
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ backgroundColor: "#D97706" }}
                          >
                            ?
                          </div>
                          <span className="truncate text-[9px]">
                            Unassigned
                          </span>
                        </div>
                      </th>
                    )}
                    {activeDrivers.map((driver) => {
                      const firstName = driver.name.split(" ")[0];
                      return (
                        <th
                          key={driver.id}
                          className="px-1 py-2 text-center text-[9px] font-bold uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                          style={{
                            color: driver.color,
                            backgroundColor: driver.color + "10",
                          }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                              style={{ backgroundColor: driver.color }}
                            >
                              {firstName.charAt(0)}
                            </div>
                            <span className="truncate text-[9px]">
                              {firstName}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((hour) => (
                    <tr
                      key={hour}
                      className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-bold text-gray-600 border-r border-gray-200 h-10">
                        {hour === 0
                          ? "12 AM"
                          : hour < 12
                            ? `${hour} AM`
                            : hour === 12
                              ? "12 PM"
                              : `${hour - 12} PM`}
                      </td>
                      {hasUnassigned &&
                        (() => {
                          const unassignedInHour =
                            getUnassignedTripsForHour(hour);
                          return (
                            <td
                              className="px-1.5 py-2 border-r border-gray-100 align-top"
                              style={{
                                backgroundColor:
                                  unassignedInHour.length > 0
                                    ? "#FEF3C708"
                                    : "transparent",
                              }}
                            >
                              <div className="space-y-0.5">
                                {unassignedInHour.map((trip) => (
                                  <button
                                    key={trip.id}
                                    onClick={() => {
                                      setSelectedTripId(trip.id);
                                      setShowPayment(false);
                                    }}
                                    className="w-full text-left p-1.5 rounded-md border transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md"
                                    style={{
                                      backgroundColor: "#FEF3C7",
                                      borderColor: "#F59E0B80",
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-1 mb-0.5">
                                      <span className="text-[9px] font-bold text-gray-500">
                                        {formatTime(trip.start_time)}
                                      </span>
                                      <span className="text-[7px] font-bold uppercase tracking-wider bg-orange-200 text-orange-800 px-1 py-0.5 rounded-full">
                                        {trip.status}
                                      </span>
                                    </div>
                                    <div className="text-[11px] font-bold text-gray-900 mb-0.5 line-clamp-1">
                                      {trip.client_name || "Unknown"}
                                    </div>
                                    {trip.destination && (
                                      <div className="flex items-center gap-0.5 text-[9px] text-gray-600">
                                        <MapPin
                                          size={8}
                                          className="flex-shrink-0"
                                        />
                                        <span className="line-clamp-1">
                                          {trip.destination}
                                        </span>
                                      </div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </td>
                          );
                        })()}
                      {activeDrivers.map((driver) => {
                        const tripsInHour = getTripsForDriverHour(
                          driver.id,
                          hour,
                        );
                        return (
                          <td
                            key={driver.id}
                            className="px-1.5 py-2 border-r border-gray-100 last:border-r-0 align-top"
                            style={{
                              backgroundColor:
                                tripsInHour.length > 0
                                  ? driver.color + "08"
                                  : "transparent",
                            }}
                          >
                            <div className="space-y-0.5">
                              {tripsInHour.map((trip) => (
                                <button
                                  key={trip.id}
                                  onClick={() => {
                                    setSelectedTripId(trip.id);
                                    setShowPayment(false);
                                  }}
                                  className="w-full text-left p-1.5 rounded-md border transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md"
                                  style={{
                                    backgroundColor: driver.color + "15",
                                    borderColor: driver.color + "40",
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-1 mb-0.5">
                                    <span className="text-[9px] font-bold text-gray-500">
                                      {formatTime(trip.start_time)}
                                    </span>
                                    {paidTripIds.has(trip.id) && (
                                      <CheckCircle2
                                        size={9}
                                        className="text-green-600 flex-shrink-0"
                                      />
                                    )}
                                  </div>
                                  <div className="text-[11px] font-bold text-gray-900 mb-0.5 line-clamp-1">
                                    {trip.client_name || "Unknown"}
                                  </div>
                                  {trip.notes &&
                                  trip.notes
                                    .toLowerCase()
                                    .includes("return trip") ? (
                                    <div className="mb-0.5">
                                      <span className="text-[8px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-1 py-0.5 rounded-full border border-purple-200">
                                        Return
                                      </span>
                                    </div>
                                  ) : trip.destination ? (
                                    <div className="mb-0.5">
                                      <span className="text-[8px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded-full border border-indigo-200">
                                        Destination
                                      </span>
                                    </div>
                                  ) : null}
                                  {trip.destination && (
                                    <div className="flex items-center gap-0.5 text-[9px] text-gray-600">
                                      <MapPin
                                        size={8}
                                        className="flex-shrink-0"
                                      />
                                      <span className="line-clamp-1">
                                        {trip.destination}
                                      </span>
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Trip Detail Panel */}
      {selectedTripId && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTripId(null)}
        >
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail || !selectedTrip ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                <Loader2 size={28} className="animate-spin mb-3" />
                <p className="text-sm font-medium">Loading trip details…</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-5 border-b border-gray-200 flex items-start justify-between shrink-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        #{selectedTrip.booking_number}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusStyles(selectedTrip.status)}`}
                      >
                        {selectedTrip.status.charAt(0).toUpperCase() +
                          selectedTrip.status.slice(1)}
                      </span>
                      {paidTripIds.has(selectedTrip.id) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-100 rounded-full text-[10px] font-semibold text-green-700">
                          <CheckCircle2 size={10} /> Paid
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-bold text-gray-900 truncate">
                      {selectedTrip.client_name}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTripId(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-3"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable Detail Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {/* Date & Time */}
                  <DetailRow
                    icon={Calendar}
                    label="Date"
                    value={new Date(selectedTrip.start_time).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                    accent="text-blue-500"
                  />
                  <DetailRow
                    icon={Clock}
                    label="Pickup Time"
                    value={new Date(selectedTrip.start_time).toLocaleTimeString(
                      "en-US",
                      { hour: "numeric", minute: "2-digit", hour12: true },
                    )}
                    accent="text-blue-500"
                  />
                  {/* Only show return date for outgoing trips, not for return trips themselves */}
                  {selectedTrip.return_date &&
                    !(
                      selectedTrip.notes &&
                      selectedTrip.notes.toLowerCase().includes("return trip")
                    ) && (
                      <DetailRow
                        icon={CalendarClock}
                        label="Return Date"
                        value={(() => {
                          // Extract YYYY-MM-DD directly to avoid timezone shifting midnight UTC dates back one day
                          const str =
                            typeof selectedTrip.return_date === "string"
                              ? selectedTrip.return_date
                              : new Date(
                                  selectedTrip.return_date,
                                ).toISOString();
                          const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          if (!match) return "N/A";
                          const [, year, month, day] = match;
                          const d = new Date(
                            `${year}-${month}-${day}T12:00:00Z`,
                          );
                          return d.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          });
                        })()}
                        accent="text-purple-500"
                      />
                    )}
                  {/* For return trips (second leg), show the outgoing flight info as return info */}
                  {selectedTrip.notes &&
                    selectedTrip.notes.toLowerCase().includes("return trip") &&
                    selectedTrip.outgoing_flight_info && (
                      <DetailRow
                        icon={CalendarClock}
                        label="Return Flight Info"
                        value={selectedTrip.outgoing_flight_info}
                        accent="text-purple-500"
                      />
                    )}

                  {/* Driver & Vehicle */}
                  <DetailRow
                    icon={Car}
                    label="Driver"
                    value={selectedTrip.employee_name || "Unassigned"}
                    accent="text-green-500"
                    badge={selectedTrip.employee_color}
                  />
                  {selectedTrip.vehicle_name && (
                    <DetailRow
                      icon={Car}
                      label="Vehicle"
                      value={selectedTrip.vehicle_name}
                    />
                  )}

                  {/* Passenger Details */}
                  {selectedTrip.client_phone && (
                    <DetailRow
                      icon={Phone}
                      label="Phone"
                      value={selectedTrip.client_phone}
                    />
                  )}
                  {selectedTrip.client_email && (
                    <DetailRow
                      icon={Mail}
                      label="Email"
                      value={selectedTrip.client_email}
                    />
                  )}

                  {/* Destination */}
                  {selectedTrip.destination && (
                    <DetailRow
                      icon={MapPin}
                      label="Destination"
                      value={selectedTrip.destination}
                      accent="text-red-400"
                    />
                  )}

                  {/* Passengers & Baggage */}
                  {selectedTrip.num_people && (
                    <DetailRow
                      icon={User}
                      label="Passengers"
                      value={String(selectedTrip.num_people)}
                    />
                  )}
                  {(selectedTrip.num_bags_checked ||
                    selectedTrip.num_bags_carry_on) && (
                    <DetailRow
                      icon={Luggage}
                      label="Baggage"
                      value={[
                        selectedTrip.num_bags_checked
                          ? `${selectedTrip.num_bags_checked} Checked`
                          : null,
                        selectedTrip.num_bags_carry_on
                          ? `${selectedTrip.num_bags_carry_on} Carry-on`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" + ")}
                    />
                  )}

                  {/* Flight Info */}
                  {selectedTrip.outgoing_flight_info && (
                    <DetailRow
                      icon={PlaneTakeoff}
                      label="Outgoing Flight"
                      value={selectedTrip.outgoing_flight_info}
                      accent="text-sky-500"
                    />
                  )}
                  {selectedTrip.returning_flight_info && (
                    <DetailRow
                      icon={PlaneLanding}
                      label="Return Flight"
                      value={selectedTrip.returning_flight_info}
                      accent="text-indigo-500"
                    />
                  )}

                  {/* Notes */}
                  {selectedTrip.notes && (
                    <DetailRow
                      icon={StickyNote}
                      label="Notes"
                      value={selectedTrip.notes}
                    />
                  )}
                  {selectedTrip.driver_notes && (
                    <DetailRow
                      icon={StickyNote}
                      label="Driver Notes"
                      value={selectedTrip.driver_notes}
                      accent="text-orange-500"
                    />
                  )}

                  {/* Booked By */}
                  {selectedTrip.booked_by && (
                    <DetailRow
                      icon={User}
                      label="Booked By"
                      value={(() => {
                        const who = selectedTrip.booker_name
                          ? `${selectedTrip.booked_by} (${selectedTrip.booker_name})`
                          : selectedTrip.booked_by;
                        if (!selectedTrip.created_at) return who;
                        const dt = new Date(selectedTrip.created_at);
                        const dateStr = dt.toLocaleDateString("en-US", {
                          timeZone: "America/Chicago",
                          month: "short",
                          day: "numeric",
                        });
                        const timeStr = dt.toLocaleTimeString("en-US", {
                          timeZone: "America/Chicago",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        });
                        return `${who}  •  ${dateStr}, ${timeStr}`;
                      })()}
                    />
                  )}

                  {/* Services & Pricing */}
                  {selectedTrip.services?.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Services & Pricing
                      </p>
                      <div className="space-y-2">
                        {selectedTrip.services.map((s, i) => {
                          const lineTotal =
                            Number(s.service_price) * Number(s.quantity || 1);
                          return (
                            <div
                              key={i}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-gray-600">
                                {s.service_name}
                                {s.quantity > 1 && (
                                  <span className="text-gray-400 ml-1">
                                    ×{s.quantity}
                                  </span>
                                )}
                              </span>
                              <span className="font-semibold text-gray-900">
                                ${lineTotal.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                        <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                          <span className="font-bold text-gray-900">Total</span>
                          <span className="text-lg font-bold text-blue-600">
                            $
                            {selectedTrip.services
                              .reduce(
                                (sum, s) =>
                                  sum +
                                  Number(s.service_price) *
                                    Number(s.quantity || 1),
                                0,
                              )
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Inline Quick Payment */}
                  {showPayment && !paidTripIds.has(selectedTrip.id) && (
                    <div ref={paymentRef}>
                      <QuickPaymentInline
                        trip={selectedTrip}
                        onClose={() => setShowPayment(false)}
                        onSuccess={() => {
                          setShowPayment(false);
                          queryClient.invalidateQueries(["transactions"]);
                          toast.success("Payment recorded!");
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={handleEditTrip}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                    {selectedTrip.payment_status !== "paid" ? (
                      <button
                        onClick={() => setShowPayment(!showPayment)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                          showPayment
                            ? "bg-green-600 text-white"
                            : "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        <DollarSign size={15} />
                        Pay
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-green-50 border border-green-100 rounded-xl text-sm font-semibold text-green-700">
                        <CheckCircle2 size={15} />
                        Paid
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setDeletingTrip(selectedTrip);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTrip && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Delete Trip?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete the trip for{" "}
                  <span className="font-semibold text-gray-700">
                    {deletingTrip.client_name}
                  </span>{" "}
                  on{" "}
                  <span className="font-semibold text-gray-700">
                    {new Date(deletingTrip.start_time).toLocaleDateString()}
                  </span>
                  . This cannot be undone.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setDeletingTrip(null)}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingTrip.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Trip Modal */}
      {isEditModalOpen && editingTrip && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <TripModal
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={handleEditClose}
            onSuccess={handleEditSuccess}
            onBookReturn={() => {
              handleEditSuccess();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* Detail Row component */
function DetailRow({ icon: Icon, label, value, accent, badge }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className={`mt-0.5 shrink-0 ${accent || "text-gray-400"}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <div className="flex items-center gap-2">
          {badge && (
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: badge }}
            />
          )}
          <p className="text-sm font-medium text-gray-900 break-words">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* Quick Payment Inline */
function QuickPaymentInline({ trip, onClose, onSuccess, ref }) {
  const tripPrice =
    trip.services?.reduce(
      (sum, s) => sum + Number(s.service_price) * (Number(s.quantity) || 1),
      0,
    ) ?? 0;

  const [amountPaid, setAmountPaid] = useState(
    tripPrice > 0 ? tripPrice.toFixed(2) : "",
  );
  const [method, setMethod] = useState("Square");

  const paid = parseFloat(amountPaid) || 0;
  const tip = tripPrice > 0 && paid > tripPrice ? paid - tripPrice : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: trip.id,
          category: "payment",
          method,
          amount: tripPrice > 0 ? tripPrice.toFixed(2) : paid.toFixed(2),
          tip_amount: tip.toFixed(2),
          description: `Payment for Trip #${trip.booking_number} - ${trip.client_name}`,
          transaction_date: getTodayInCDT(), // Use CDT timezone for default date
        }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess,
    onError: () => toast.error("Could not record payment"),
  });

  return (
    <div
      className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-3"
      ref={ref}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
          Record Payment
        </p>
        <button onClick={onClose} className="text-blue-400 hover:text-blue-600">
          <X size={14} />
        </button>
      </div>

      {tripPrice > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-white border border-blue-100 rounded-lg">
          <span className="text-xs font-semibold text-gray-500">
            Trip Price
          </span>
          <span className="text-sm font-bold text-blue-700">
            ${tripPrice.toFixed(2)}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">
            Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">
            Tip ($)
          </label>
          <div
            className={`w-full px-3 py-2 border rounded-lg text-sm font-bold ${
              tip > 0
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-50 border-gray-200 text-gray-400"
            }`}
          >
            {tip > 0 ? `$${tip.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase">
          Method
        </label>
        <select
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="Cash">Cash</option>
          <option value="Farm">Farm</option>
          <option value="Card">Card</option>
          <option value="Venmo">Venmo</option>
          <option value="Zelle">Zelle</option>
          <option value="Square">Square</option>
          <option value="Stripe">Stripe</option>
          <option value="Comp">🎁 Comp</option>
        </select>
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !amountPaid}
        className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Recording…
          </>
        ) : (
          <>
            <CheckCircle2 size={15} /> Record Payment
          </>
        )}
      </button>
    </div>
  );
}

function getStatusStyles(status) {
  switch (status) {
    case "quote":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "confirmed":
      return "bg-green-50 text-green-700 border-green-100";
    case "approved":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "unpaid":
      return "bg-red-50 text-red-700 border-red-100";
    case "pending":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "completed":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "cancelled":
      return "bg-gray-50 text-gray-700 border-gray-100";
    case "no-show":
      return "bg-red-50 text-red-700 border-red-100";
    default:
      return "bg-gray-50 text-gray-700 border-gray-100";
  }
}
