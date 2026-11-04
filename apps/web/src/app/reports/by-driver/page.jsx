"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Printer,
  Users,
  Calendar,
  Eye,
  Radio,
} from "lucide-react";
import {useDatabaseReport,openReportTrip} from "../../../../app/preview/use-database-reports";
import {
  formatDateCDT,
  getTodayInCDT,
  getDateStringInCDT,
} from "@/utils/timezone";
import { ByDriverSection } from "@/components/Reports/ByDriverSection";

function getWeekBounds(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dayOfWeek = d.getDay();
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  return {
    start: sunday.toISOString().split("T")[0],
    end: saturday.toISOString().split("T")[0],
  };
}

export default function ByDriverReport({initialDate}) {
  const today = getTodayInCDT();
  const [selectedWeek, setSelectedWeek] = useState(
    () => getWeekBounds(initialDate||today).start,
  );
  const [viewMode, setViewMode] = useState("dispatch");
  useEffect(()=>{const u=new URL(window.location.href);u.searchParams.set("date",selectedWeek);window.history.replaceState(null,"",u);},[selectedWeek]);

  const weekBounds = useMemo(() => getWeekBounds(selectedWeek), [selectedWeek]);

  const goBackWeek = () => {
    const d = new Date(selectedWeek + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  };
  const goForwardWeek = () => {
    const d = new Date(selectedWeek + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setSelectedWeek(d.toISOString().split("T")[0]);
  };
  const goThisWeek = () => setSelectedWeek(getWeekBounds(today).start);
  const isCurrentWeek = selectedWeek === getWeekBounds(today).start;

  const displayRange = `${formatDateCDT(weekBounds.start + "T12:00:00", {
    month: "short",
    day: "numeric",
  })} - ${formatDateCDT(weekBounds.end + "T12:00:00", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const {trips:allTrips,isLoading:tripsLoading,drivers:employees,tripsError}=useDatabaseReport(weekBounds.start,weekBounds.end);
  // Never reconstruct extra fare charges in the report; fare is stored services_total.
  const isLoading = tripsLoading || !employees;

  const {
    tripsByDriver,
    weekTotalFare,
    weekTotalTip,
    weekTotalAddons,
    weekTotalTrips,
    weekCancelledTrips,
    weekActiveTrips,
  } = useMemo(() => {
    if (!allTrips || !employees)
      return {
        tripsByDriver: [],
        weekTotalFare: 0,
        weekTotalTip: 0,
        weekTotalAddons: 0,
        weekTotalTrips: 0,
        weekCancelledTrips: 0,
        weekActiveTrips: 0,
      };
    const weekStart = weekBounds.start;
    const weekEnd = weekBounds.end;
    const weekTrips = allTrips.filter((t) => {
      const tripDateCDT = getDateStringInCDT(t.start_time);
      return tripDateCDT >= weekStart && tripDateCDT <= weekEnd;
    });

    let gFare = 0;
    let gTip = 0;
    let gAddons = 0;
    let gTrips = 0;
    let gCanc = 0;
    let gActive = 0;
    const uniqueDriverIds = [
      ...new Set(
        weekTrips.filter((t) => t.employee_id).map((t) => t.employee_id),
      ),
    ];

    const grouped = uniqueDriverIds
      .map((driverId) => {
        const driver = employees.find((e) => e.id === driverId) || {
          id: driverId,
          name: "Unknown Driver",
          color: "#9CA3AF",
          is_active: false,
        };
        const driverTrips = weekTrips
          .filter((t) => t.employee_id === driverId)
          .sort(
            (a, b) =>
              new Date(a.start_time).getTime() -
              new Date(b.start_time).getTime(),
          )
          .map((trip) => ({
            ...trip,
            // Fare = services_total (base fare, already correct in DB)
            fare: parseFloat(trip.services_total || 0),
            tip: parseFloat(trip.tips_total || 0),
            addons: 0,
          }));

        const cancelledCount = driverTrips.filter(
          (t) => t.status === "cancelled" || t.status === "canceled",
        ).length;
        const totalFare = driverTrips.reduce((s, t) => {
          const isCancelled =
            t.status === "cancelled" || t.status === "canceled";
          return isCancelled ? s : s + t.fare;
        }, 0);
        const totalTip = driverTrips.reduce((s, t) => {
          const isCancelled =
            t.status === "cancelled" || t.status === "canceled";
          return isCancelled ? s : s + t.tip;
        }, 0);
        const totalAddons = driverTrips.reduce((s, t) => {
          const isCancelled =
            t.status === "cancelled" || t.status === "canceled";
          return isCancelled ? s : s + t.addons;
        }, 0);
        gFare += totalFare;
        gTip += totalTip;
        gAddons += totalAddons;
        gTrips += driverTrips.length;
        gCanc += cancelledCount;
        gActive += driverTrips.length - cancelledCount;
        return {
          driver,
          trips: driverTrips,
          totalFare,
          totalTip,
          totalAddons,
          cancelledCount,
          activeCount: driverTrips.length - cancelledCount,
        };
      })
      .sort((a, b) => a.driver.name.localeCompare(b.driver.name));

    const unassigned = weekTrips
      .filter((t) => !t.employee_id)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
      )
      .map((trip) => ({
        ...trip,
        // Fare = services_total (base fare, already correct in DB)
        fare: parseFloat(trip.services_total || 0),
        tip: parseFloat(trip.tips_total || 0),
        addons: 0,
      }));
    if (unassigned.length > 0) {
      const uCanc = unassigned.filter(
        (t) => t.status === "cancelled" || t.status === "canceled",
      ).length;
      const uFare = unassigned.reduce((s, t) => {
        const isCancelled = t.status === "cancelled" || t.status === "canceled";
        return isCancelled ? s : s + t.fare;
      }, 0);
      const uTip = unassigned.reduce((s, t) => {
        const isCancelled = t.status === "cancelled" || t.status === "canceled";
        return isCancelled ? s : s + t.tip;
      }, 0);
      const uAddons = unassigned.reduce((s, t) => {
        const isCancelled = t.status === "cancelled" || t.status === "canceled";
        return isCancelled ? s : s + t.addons;
      }, 0);
      gFare += uFare;
      gTip += uTip;
      gAddons += uAddons;
      gTrips += unassigned.length;
      gCanc += uCanc;
      gActive += unassigned.length - uCanc;
      grouped.push({
        driver: { id: "unassigned", name: "Unassigned", color: "#FCD34D" },
        trips: unassigned,
        totalFare: uFare,
        totalTip: uTip,
        totalAddons: uAddons,
        cancelledCount: uCanc,
        activeCount: unassigned.length - uCanc,
      });
    }
    return {
      tripsByDriver: grouped,
      weekTotalFare: gFare,
      weekTotalTip: gTip,
      weekTotalAddons: gAddons,
      weekTotalTrips: gTrips,
      weekCancelledTrips: gCanc,
      weekActiveTrips: gActive,
    };
  }, [allTrips, employees, weekBounds]);

  const handleEditTrip=(id)=>openReportTrip(id,allTrips);
  if(tripsError)return <p role="alert">{tripsError.message} — report not loaded.</p>;
  return (
    <div className="p-6 space-y-6">
      {/* Back to Dashboard */}
      <div className="no-print">
        <a
          href="/preview/database"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
              <Users size={28} className="text-blue-600" />
              Trips by Driver
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Sun – Sat • {displayRange}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1 no-print">
            <button
              onClick={goBackWeek}
              className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
              title="Previous Week"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium px-2">{displayRange}</span>
            <button
              onClick={goForwardWeek}
              className="p-1.5 hover:bg-gray-50 rounded-md transition-colors"
              title="Next Week"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {!isCurrentWeek && (
            <button
              onClick={goThisWeek}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-50 rounded-md no-print"
            >
              This Week
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 no-print">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("dispatch")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === "dispatch" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Radio size={12} className="inline mr-1" />
              Dispatch
            </button>
            <button
              onClick={() => setViewMode("driver")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === "driver" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Eye size={12} className="inline mr-1" />
              Driver
            </button>
          </div>
          <button
            disabled={tripsLoading} onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500 font-medium">Loading report…</p>
          </div>
        ) : tripsByDriver.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              No trips scheduled for this week
            </p>
          </div>
        ) : (
          <>
            {/* Week Totals — TOP */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-900">
                    Week Total ({displayRange}):
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="text-left">
                    <div className="text-xs text-blue-700 font-medium mb-1">
                      # Trips
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-red-700 font-semibold">
                        <span className="text-xs text-red-600 font-medium mr-1">
                          Cancelled:
                        </span>
                        {weekCancelledTrips}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-green-700 font-semibold">
                        <span className="text-xs text-green-600 font-medium mr-1">
                          Active:
                        </span>
                        {weekActiveTrips}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-blue-900 font-bold">
                        <span className="text-xs text-blue-700 font-medium mr-1">
                          Total:
                        </span>
                        {weekTotalTrips}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-6 ml-auto">
                    <div className="text-right">
                      <div className="text-xs text-blue-700 font-medium">
                        Fare
                      </div>
                      <div className="text-xl font-bold text-blue-900">
                        ${weekTotalFare.toFixed(2)}
                      </div>
                    </div>
                    {weekTotalAddons > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-blue-700 font-medium">
                          Add-ons
                        </div>
                        <div className="text-xl font-bold text-blue-700">
                          ${weekTotalAddons.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-xs text-green-700 font-medium">
                        Tip
                      </div>
                      <div className="text-xl font-bold text-green-700">
                        ${weekTotalTip.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-700 font-medium">
                        Grand Total
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        $
                        {(
                          weekTotalFare +
                          weekTotalAddons +
                          weekTotalTip
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {tripsByDriver.map(
              ({
                driver,
                trips,
                totalFare,
                totalTip,
                totalAddons,
                cancelledCount,
                activeCount,
              }) => (
                <ByDriverSection
                  key={driver.id}
                  driver={driver}
                  trips={trips}
                  totalFare={totalFare}
                  totalTip={totalTip}
                  totalAddons={totalAddons}
                  cancelledCount={cancelledCount}
                  activeCount={activeCount}
                  viewMode={viewMode}
                  onEditTrip={handleEditTrip}
                />
              ),
            )}

            {/* Week Grand Total — BOTTOM */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-900">
                    Week Total ({displayRange}):
                  </span>
                </div>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="text-left">
                    <div className="text-xs text-blue-700 font-medium mb-1">
                      # Trips
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-red-700 font-semibold">
                        <span className="text-xs text-red-600 font-medium mr-1">
                          Cancelled:
                        </span>
                        {weekCancelledTrips}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-green-700 font-semibold">
                        <span className="text-xs text-green-600 font-medium mr-1">
                          Active:
                        </span>
                        {weekActiveTrips}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-blue-900 font-bold">
                        <span className="text-xs text-blue-700 font-medium mr-1">
                          Total:
                        </span>
                        {weekTotalTrips}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-6 ml-auto">
                    <div className="text-right">
                      <div className="text-xs text-blue-700 font-medium">
                        Fare
                      </div>
                      <div className="text-xl font-bold text-blue-900">
                        ${weekTotalFare.toFixed(2)}
                      </div>
                    </div>
                    {weekTotalAddons > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-blue-700 font-medium">
                          Add-ons
                        </div>
                        <div className="text-xl font-bold text-blue-700">
                          ${weekTotalAddons.toFixed(2)}
                        </div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-xs text-green-700 font-medium">
                        Tip
                      </div>
                      <div className="text-xl font-bold text-green-700">
                        ${weekTotalTip.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-700 font-medium">
                        Grand Total
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        $
                        {(
                          weekTotalFare +
                          weekTotalAddons +
                          weekTotalTip
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </div>
  );
}
