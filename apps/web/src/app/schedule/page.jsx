"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getDateStringInCDT } from "@/utils/timezone";
import { TripsTable } from "@/components/Trips/TripsTable";
import { useDatabaseSchedule } from "../../../app/preview/use-database-schedule";
import { getTodayInCDT, formatDateCDT } from "@/utils/timezone";
import { PageWithBackButton } from "@/components/PageWithBackButton";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  CalendarX2,
} from "lucide-react";
import { DriverScheduleSection } from "@/components/Schedule/DriverScheduleSection";

export default function SchedulePage({initialDate}) {
  const [selectedDate, setSelectedDate] = useState(() => initialDate || getTodayInCDT());
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  // DEFAULT VIEW: "time" = All Trips in ascending time order (NOT "driver")
  const [viewMode, setViewMode] = useState("time");

  const {trips,isLoading,tripsError,drivers,blockedTimes}=useDatabaseSchedule(selectedDate);
  const paidTripIds=new Set(trips.filter(t=>t.payment_status==='paid').map(t=>t.id));
  const unsupported=()=>alert('This financial, sending or destructive action is not enabled in test schedules.');
  useEffect(()=>{const url=new URL(window.location.href);url.searchParams.set('date',selectedDate);window.history.replaceState(null,'',url);},[selectedDate]);

  const goBack = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
    setCurrentPage(1);
  };

  const goForward = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
    setCurrentPage(1);
  };

  const goToday = () => {
    setSelectedDate(getTodayInCDT());
    setCurrentPage(1);
  };

  const isToday = selectedDate === getTodayInCDT();

  const displayDate = formatDateCDT(selectedDate + "T12:00:00", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Filter trips to selected date - for "By Time" view, sort by time ascending
  const filteredTrips = useMemo(() => {
    if (!trips) return [];


    const filtered = trips
      .filter((trip) => {
        return (
          getDateStringInCDT(trip.start_time) === selectedDate &&
          trip.status !== "cancelled"
        );
      })
      .filter((trip) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          trip.client_name?.toLowerCase().includes(s) ||
          trip.booking_number?.toLowerCase().includes(s) ||
          trip.client_phone?.toLowerCase().includes(s) ||
          trip.destination?.toLowerCase().includes(s) ||
          trip.employee_name?.toLowerCase().includes(s)
        );
      });

    // Sort by time ascending for "By Time" view
    if (viewMode === "time") {
      filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }

    return filtered;
  }, [trips, selectedDate, search, viewMode]);

  // Filter blocked times to selected date - use CDT-aware date comparison
  const filteredBlockedTimes = useMemo(() => {
    if (!blockedTimes) return [];
    const tz = "America/Chicago";

    return blockedTimes.filter((block) => {
      const blockStart = new Date(block.start_time);
      const blockEnd = new Date(block.end_time);

      // Convert block start/end to CDT date strings (en-CA gives YYYY-MM-DD)
      const blockStartDate = blockStart.toLocaleDateString("en-CA", {
        timeZone: tz,
      });
      const blockEndDate = blockEnd.toLocaleDateString("en-CA", {
        timeZone: tz,
      });

      // Block matches the selected date if selectedDate falls within [blockStartDate, blockEndDate]
      return blockStartDate <= selectedDate && blockEndDate >= selectedDate;
    });
  }, [blockedTimes, selectedDate]);

  // Group trips and blocked times by driver for driver view
  const driverSchedules = useMemo(() => {
    if (!drivers || viewMode !== "driver") return [];

    return drivers
      .filter((d) => d.is_active || filteredTrips.some(t=>t.employee_id===d.id) || filteredBlockedTimes.some(b=>b.employee_id===d.id))
      .map((driver) => {
        const driverTrips = filteredTrips
          .filter((t) => t.employee_id === driver.id)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)); // sort by time ascending
        const driverBlocks = filteredBlockedTimes.filter(
          (b) => b.employee_id === driver.id,
        );

        return {
          driver,
          trips: driverTrips,
          blockedTimes: driverBlocks,
        };
      })
      .filter((ds) => ds.trips.length > 0 || ds.blockedTimes.length > 0)
      .sort((a, b) => a.driver.name.localeCompare(b.driver.name));
  }, [drivers, filteredTrips, filteredBlockedTimes, viewMode]);

  // Unassigned trips for driver view
  const unassignedScheduleTrips = useMemo(() => {
    if (viewMode !== "driver") return [];
    return filteredTrips.filter((t) => !t.employee_id);
  }, [filteredTrips, viewMode]);

  const handleFetchTrip=(id)=>{
    const trip=trips.find(t=>t.id===id);
    if(!String(trip?.booking_number||'').startsWith('TEST-')){alert('Imported trips are read-only in this test window.');return;}
    window.location.href='/preview/database-edit?id='+id;
  };
  const handleNewTrip=()=>{window.location.href='/preview/database-book';};
  const handleDelete=unsupported;
  const handleSendThankYou=unsupported;
  return (
    <PageWithBackButton>
      <div className="space-y-4">
        {/* Header with Date Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              {isToday ? "Today's Schedule" : "Daily Schedule"}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{displayDate}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode("time")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "time"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                All Trips
              </button>
              <button
                onClick={() => setViewMode("driver")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "driver"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                By Driver
              </button>
            </div>

            {/* Date picker */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
              <button
                onClick={goBack}
                className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
                title="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <label className="relative cursor-pointer">
                <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded-md transition-colors">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </span>
                </div>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                      setCurrentPage(1);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </label>
              <button
                onClick={goForward}
                className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
                title="Next day"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {!isToday && (
              <button
                onClick={goToday}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-2 bg-blue-50 rounded-lg transition-colors"
              >
                Today
              </button>
            )}

            <button
              onClick={handleNewTrip}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus size={16} />
              New Trip
            </button>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by passenger, booking #, phone, destination, or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              <span className="font-semibold text-gray-900">
                {filteredTrips.length}
              </span>{" "}
              {filteredTrips.length === 1 ? "trip" : "trips"}
            </span>
            {filteredBlockedTimes.length > 0 && (
              <>
                <div className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="flex items-center gap-1">
                  <CalendarX2 size={14} className="text-red-500" />
                  <span className="font-semibold text-gray-900">
                    {filteredBlockedTimes.length}
                  </span>{" "}
                  blocked
                </span>
              </>
            )}
          </div>
        </div>

        {/* Content based on view mode */}
        {viewMode === "time" ? (
          <TripsTable sampleMode databaseReview
            trips={filteredTrips}
            isLoading={isLoading}
            error={tripsError}
            onEdit={handleFetchTrip}
            onDelete={handleDelete}
            onInvoice={unsupported}
            onPay={unsupported}
            onSendThankYou={null}
            paidTripIds={paidTripIds}
            currentPage={currentPage}
            pageSize={50}
            onPageChange={setCurrentPage}
          />
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                Loading schedule...
              </div>
            ) : driverSchedules.length === 0 &&
              unassignedScheduleTrips.length === 0 ? (
              <div className="text-center py-12">
                <CalendarX2 size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">
                  No trips or blocked times for this date
                </p>
              </div>
            ) : (
              driverSchedules.map(({ driver, trips, blockedTimes }) => (
                <DriverScheduleSection databaseReview
                  key={driver.id}
                  driver={driver}
                  trips={trips}
                  blockedTimes={blockedTimes}
                  onTripClick={handleFetchTrip}
                  onEdit={handleFetchTrip}
                  onDelete={handleDelete}
                  onInvoice={unsupported}
                  onPay={unsupported}
                  onSendThankYou={null}
                  paidTripIds={paidTripIds}
                />
              ))
            )}
            {/* Unassigned trips section */}
            {unassignedScheduleTrips.length > 0 && (
              <div className="bg-white rounded-xl border border-orange-200 overflow-hidden shadow-sm">
                <div
                  className="px-4 py-3 border-b border-orange-100"
                  style={{ backgroundColor: "#FEF3C7" }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: "#D97706" }}
                    />
                    <span className="font-semibold text-gray-900 text-sm">
                      Unassigned
                    </span>
                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                      {unassignedScheduleTrips.length}{" "}
                      {unassignedScheduleTrips.length === 1 ? "trip" : "trips"}
                    </span>
                  </div>
                </div>
                <TripsTable sampleMode databaseReview
                  trips={[...unassignedScheduleTrips].sort(
                    (a, b) => new Date(a.start_time) - new Date(b.start_time),
                  )}
                  isLoading={false}
                  error={null}
                  onEdit={handleFetchTrip}
                  onDelete={handleDelete}
                  onInvoice={unsupported}
                  onPay={unsupported}
                  onSendThankYou={null}
                  paidTripIds={paidTripIds}
                  currentPage={1}
                  pageSize={200}
                  onPageChange={() => {}}
                />
              </div>
            )}
          </div>
        )}
      </div>

    </PageWithBackButton>
  );
}
