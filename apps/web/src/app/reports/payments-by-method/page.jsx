"use client";

import React, { useState, useMemo, Suspense, lazy } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Printer,
  CreditCard,
  ArrowLeft,
  Calendar,
  ChevronDown,
  CheckCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { formatTimeCDT } from "@/utils/timezone";
import { useTrips } from "@/hooks/useTrips";

const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);

// --- Week calculation helpers (CDT-aware) ---
function getCDTOffset() {
  // America/Chicago: CDT = UTC-5 in summer, CST = UTC-6 in winter
  // Use Intl to determine offset
  const now = new Date();
  const utc = now.getTime();
  const cdtStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const cdtDate = new Date(cdtStr);
  const offsetMs = utc - cdtDate.getTime();
  return offsetMs;
}

function getTodayCDT() {
  const now = new Date();
  const cdtStr = now.toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  }); // YYYY-MM-DD
  return cdtStr;
}

function getSundayOfWeek(dateStr) {
  // dateStr: "YYYY-MM-DD"
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function getWeekRange(mode) {
  const today = getTodayCDT();
  if (mode === "this") {
    const sun = getSundayOfWeek(today);
    return { start: sun, end: today, label: "This Week" };
  } else {
    // Last week: Sunday–Saturday
    const sun = getSundayOfWeek(today);
    const lastSun = addDays(sun, -7);
    const lastSat = addDays(lastSun, 6);
    return { start: lastSun, end: lastSat, label: "Last Week" };
  }
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPaymentDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTripDate(timestamp) {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const METHOD_ORDER = [
  "Square",
  "Credit Card",
  "Cash",
  "Venmo",
  "Zelle",
  "Check",
  "Invoice",
  "Unspecified",
];

const METHOD_COLORS = {
  Square: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  "Credit Card": {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    dot: "bg-blue-500",
  },
  Cash: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-800",
    dot: "bg-green-500",
  },
  Venmo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-800",
    dot: "bg-indigo-500",
  },
  Zelle: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-800",
    dot: "bg-purple-500",
  },
  Check: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  Invoice: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  Unspecified: {
    bg: "bg-gray-50",
    border: "border-gray-200",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
};

function getMethodStyle(method) {
  return METHOD_COLORS[method] || METHOD_COLORS["Unspecified"];
}

export default function PaymentsByMethodReport() {
  const [weekMode, setWeekMode] = useState("last");
  const [editingTrip, setEditingTrip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const weekRange = useMemo(() => getWeekRange(weekMode), [weekMode]);

  const {
    data: reportData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["payments-by-method", weekRange.start, weekRange.end],
    queryFn: async () => {
      const res = await fetch(
        `/api/reports/payments-by-method?start=${weekRange.start}&end=${weekRange.end}`,
      );
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    staleTime: 0,
  });

  const { clients, drivers, services, fetchTrip } = useTrips({
    fetchTrips: false,
    fetchClients: true,
    fetchDrivers: true,
    fetchServices: true,
  });

  // Group trips by payment method in the desired order
  const groupedTrips = useMemo(() => {
    if (!reportData?.trips) return [];
    const groups = {};
    for (const trip of reportData.trips) {
      const method = trip.payment_method || "Unspecified";
      if (!groups[method]) groups[method] = [];
      groups[method].push(trip);
    }

    // Sort within each group by payment_date
    for (const method in groups) {
      groups[method].sort(
        (a, b) => new Date(a.payment_date) - new Date(b.payment_date),
      );
    }

    // Return in defined order, then any leftover alphabetically
    const defined = METHOD_ORDER.filter((m) => groups[m]);
    const extra = Object.keys(groups)
      .filter((m) => !METHOD_ORDER.includes(m))
      .sort();
    return [...defined, ...extra].map((method) => ({
      method,
      trips: groups[method],
      total: groups[method].reduce(
        (sum, t) => sum + Number(t.payments_total || 0),
        0,
      ),
      tips: groups[method].reduce(
        (sum, t) => sum + Number(t.tips_total || 0),
        0,
      ),
    }));
  }, [reportData]);

  const grandTotal = useMemo(
    () => groupedTrips.reduce((sum, g) => sum + g.total, 0),
    [groupedTrips],
  );

  const grandTips = useMemo(
    () => groupedTrips.reduce((sum, g) => sum + g.tips, 0),
    [groupedTrips],
  );

  const handleRowClick = async (tripId) => {
    try {
      const data = await fetchTrip(tripId);
      setEditingTrip(data);
      setIsModalOpen(true);
    } catch (e) {
      console.error("Failed to load trip:", e);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingTrip(null);
  };

  const handleSuccess = async () => {
    setIsModalOpen(false);
    setEditingTrip(null);
    await queryClient.invalidateQueries({
      queryKey: ["payments-by-method", weekRange.start, weekRange.end],
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        subtitle={`${weekRange.label}: ${formatDateLabel(weekRange.start)} – ${formatDateLabel(weekRange.end)}`}
        showBackButton={false}
      />

      {/* Nav */}
      <div className="flex items-center gap-4 no-print">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        {/* Week Selector */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <button
            onClick={() => setWeekMode("last")}
            className={`px-5 py-2 text-sm font-semibold transition-colors ${
              weekMode === "last"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            Last Week
          </button>
          <button
            onClick={() => setWeekMode("this")}
            className={`px-5 py-2 text-sm font-semibold transition-colors ${
              weekMode === "this"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            This Week
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* Summary Stat Boxes — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            Total Payments
          </p>
          <p className="text-2xl font-bold text-blue-900">
            {isLoading ? "…" : (reportData?.total ?? 0)}
          </p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
            Total Collected
          </p>
          <p className="text-2xl font-bold text-green-900">
            {isLoading
              ? "…"
              : `$${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
            Total Tips
          </p>
          <p className="text-2xl font-bold text-amber-900">
            {isLoading
              ? "…"
              : `$${grandTips.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      {/* Date Range Label for print */}
      <div className="hidden print-block text-center mb-2">
        <p className="text-base font-semibold text-gray-700">
          {weekRange.label}: {formatDateLabel(weekRange.start)} –{" "}
          {formatDateLabel(weekRange.end)}
        </p>
      </div>

      {/* Report Body — always show boxes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-700">
          Failed to load report. Please try again.
        </div>
      ) : (
        <div className="space-y-8">
          {groupedTrips.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">
                No payments recorded for this period
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {weekRange.label}: {formatDateLabel(weekRange.start)} –{" "}
                {formatDateLabel(weekRange.end)}
              </p>
            </div>
          )}
          {groupedTrips.map((group, gi) => {
            const style = getMethodStyle(group.method);
            return (
              <div
                key={group.method}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Group Header */}
                <div
                  className={`px-5 py-3 flex items-center justify-between ${style.bg} border-b ${style.border}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${style.dot}`} />
                    <h2
                      className={`text-base font-bold uppercase tracking-wide ${style.text}`}
                    >
                      {group.method}
                    </h2>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.bg} ${style.border} ${style.text}`}
                    >
                      {group.trips.length} trip
                      {group.trips.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${style.text}`}>
                      $
                      {group.total.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {group.tips > 0 && (
                      <p className="text-xs font-medium text-gray-500">
                        incl. ${group.tips.toFixed(2)} tips
                      </p>
                    )}
                  </div>
                </div>

                {/* Trips Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Date Paid
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Trip Date
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Booking #
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Passenger
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Destination
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Paid
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Tip
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {group.trips.map((trip) => {
                        const destLower = (
                          trip.destination || ""
                        ).toLowerCase();
                        const isReturnTrip = (trip.notes || "")
                          .toLowerCase()
                          .includes("return trip");
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
                            : trip.destination ||
                              trip.dropoff_address ||
                              trip.dropoff_city ||
                              "—";

                        return (
                          <tr
                            key={trip.id}
                            onClick={() => handleRowClick(trip.id)}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            title="Click to edit this trip"
                          >
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 whitespace-nowrap">
                              {formatPaymentDate(trip.payment_date)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-700 whitespace-nowrap">
                              {formatTripDate(trip.start_time)}
                              <div className="text-xs text-blue-600 mt-0.5">
                                {formatTimeCDT(trip.start_time)}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {trip.booking_number ? (
                                <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                  {trip.booking_number}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs italic">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">
                              {trip.client_name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-gray-700">
                              {trip.employee_id ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{
                                      backgroundColor:
                                        trip.employee_color || "#2563EB",
                                    }}
                                  >
                                    {(trip.employee_name || "?").charAt(0)}
                                  </div>
                                  <span className="text-xs">
                                    {trip.employee_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Unassigned
                                </span>
                              )}
                            </td>
                            <td
                              className="px-4 py-2.5 text-sm text-gray-600 max-w-[180px] truncate"
                              title={toDisplay}
                            >
                              {toDisplay}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap">
                              <span className="inline-flex items-center justify-end gap-1">
                                <span className="text-green-500 font-bold text-base leading-none">
                                  ✓
                                </span>
                                $
                                {Number(
                                  trip.payments_total || 0,
                                ).toLocaleString("en-US", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-sm whitespace-nowrap">
                              {Number(trip.tips_total || 0) > 0 ? (
                                <span className="text-green-600 font-semibold">
                                  ${Number(trip.tips_total).toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Group Subtotal Row */}
                    <tfoot>
                      <tr className={`${style.bg} border-t ${style.border}`}>
                        <td
                          colSpan={6}
                          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${style.text} text-right`}
                        >
                          {group.method} Subtotal
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-bold text-base ${style.text} whitespace-nowrap`}
                        >
                          $
                          {group.total.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-semibold text-sm ${style.text}`}
                        >
                          {group.tips > 0 ? `$${group.tips.toFixed(2)}` : ""}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Grand Total */}
          <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Grand Total
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {weekRange.label} · {reportData?.total} payments
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-white">
                $
                {grandTotal.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {grandTips > 0 && (
                <p className="text-xs text-green-400 font-semibold">
                  incl. ${grandTips.toFixed(2)} in tips
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trip Modal */}
      {isModalOpen && editingTrip && (
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
            key={`trip-${editingTrip.id}`}
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={handleClose}
            onSuccess={handleSuccess}
            onBookReturn={handleClose}
          />
        </Suspense>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          body { background: white; }
        }
        .print-block { display: none; }
      `}</style>
    </div>
  );
}
