"use client";

import React, { useState, Suspense, lazy } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  CreditCard,
  Loader2,
  Calendar,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { formatTimeCDT } from "@/utils/timezone";

const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.default || m,
  })),
);

const fmt = (val) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val || 0);

const METHOD_COLORS = {
  Square: "bg-blue-50 border-blue-200 text-blue-800",
  "Credit Card": "bg-sky-50 border-sky-200 text-sky-800",
  Cash: "bg-green-50 border-green-200 text-green-800",
  Check: "bg-amber-50 border-amber-200 text-amber-800",
  Venmo: "bg-indigo-50 border-indigo-200 text-indigo-800",
  Zelle: "bg-purple-50 border-purple-200 text-purple-800",
  Invoice: "bg-orange-50 border-orange-200 text-orange-800",
  "Not Specified": "bg-gray-50 border-gray-200 text-gray-700",
};

function getDestination(trip) {
  const isReturn = (trip.notes || "").toLowerCase().includes("return trip");
  const destLower = (trip.destination || "").toLowerCase();
  const isAirport = ["bna", "terminal", "airport", "concourse"].some((kw) =>
    destLower.includes(kw),
  );
  if (isReturn && isAirport) {
    return (
      [trip.dropoff_street, trip.dropoff_city].filter(Boolean).join(", ") ||
      trip.dropoff_address
    );
  }
  return trip.destination || trip.dropoff_address || "—";
}

function getFlightInfo(trip) {
  const isReturn = (trip.notes || "").toLowerCase().includes("return trip");
  return isReturn
    ? trip.returning_flight_info || trip.outgoing_flight_info
    : trip.outgoing_flight_info || null;
}

function fmtPaymentDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function WeeklyPaymentsReport() {
  const [weekType, setWeekType] = useState("this_week");
  const [editingTrip, setEditingTrip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fetchingId, setFetchingId] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["weekly-payments-report", weekType],
    queryFn: async () => {
      const res = await fetch(`/api/reports/weekly-payments?week=${weekType}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const groupedTrips = data?.groupedTrips || {};
  const totals = data?.totals || {};
  const grandTotal = data?.grandTotal || {};
  const dateRange = data?.dateRange || {};
  const paymentMethods = Object.keys(groupedTrips);

  const handleRowClick = async (trip) => {
    setFetchingId(trip.id);
    try {
      const res = await fetch(`/api/appointments/${trip.id}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      const fullTrip = await res.json();
      setEditingTrip(fullTrip);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      setEditingTrip(trip);
      setIsModalOpen(true);
    } finally {
      setFetchingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <PageHeader
        subtitle={
          dateRange.label && dateRange.start
            ? `${dateRange.label}: ${dateRange.start} → ${dateRange.end}`
            : "Weekly Payments by Method"
        }
        showBackButton={false}
      />

      <div className="no-print flex items-center gap-4">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>
      </div>

      {/* Week Selector + Print */}
      <div className="no-print flex items-center justify-between flex-wrap gap-4">
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {[
            { key: "this_week", label: "This Week (Sun–Now)" },
            { key: "last_week", label: "Last Week (Sun–Sat)" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setWeekType(opt.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                weekType === opt.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* Summary Cards */}
      {!isLoading && !error && grandTotal.count > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
              Total Trips
            </p>
            <p className="text-2xl font-bold text-blue-900">
              {grandTotal.count}
            </p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-1">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-green-900">
              {fmt(grandTotal.payments_total)}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
              Total Tips
            </p>
            <p className="text-2xl font-bold text-amber-900">
              {fmt(grandTotal.tips_total)}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="mr-2 animate-spin" />
          Loading payments...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          Failed to load report. Please try again.
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && grandTotal.count === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            No paid trips found for this period.
          </p>
        </div>
      )}

      {/* Payment Method Groups */}
      {!isLoading &&
        !error &&
        paymentMethods.map((method) => {
          const trips = groupedTrips[method];
          const methodTotals = totals[method] || {};
          const colorClass =
            METHOD_COLORS[method] || METHOD_COLORS["Not Specified"];

          return (
            <div key={method}>
              {/* Group Header */}
              <div
                className={`flex items-center justify-between px-5 py-3 rounded-t-xl border ${colorClass}`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard size={16} />
                  <span className="text-base font-bold">{method}</span>
                  <span className="text-sm font-medium opacity-70">
                    &nbsp;· {methodTotals.count} trip
                    {methodTotals.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold">
                    {fmt(methodTotals.payments_total)}
                  </span>
                  {methodTotals.tips_total > 0 && (
                    <span className="ml-3 text-sm font-medium opacity-70">
                      + {fmt(methodTotals.tips_total)} tips
                    </span>
                  )}
                </div>
              </div>

              {/* Trips Table */}
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl overflow-hidden mb-8">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Paid Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Trip Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Booking #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Passenger
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Destination
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Tips
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trips.map((trip) => {
                        const dest = getDestination(trip);
                        const flight = getFlightInfo(trip);
                        return (
                          <tr
                            key={trip.id}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            onClick={() => handleRowClick(trip)}
                          >
                            <td className="px-4 py-3 text-sm font-semibold text-gray-700 whitespace-nowrap">
                              {fetchingId === trip.id ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin text-blue-500"
                                />
                              ) : (
                                fmtPaymentDate(trip.payment_date)
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              <div className="font-medium">
                                {new Date(trip.start_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    timeZone: "America/Chicago",
                                    month: "short",
                                    day: "numeric",
                                  },
                                )}
                              </div>
                              <div className="text-xs text-blue-600">
                                {formatTimeCDT(trip.start_time)}
                              </div>
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
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                              {trip.client_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                {trip.employee_name && (
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{
                                      backgroundColor:
                                        trip.employee_color || "#6b7280",
                                    }}
                                  >
                                    {trip.employee_name.charAt(0)}
                                  </div>
                                )}
                                <span className="text-gray-700">
                                  {trip.employee_name || "Unassigned"}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <div>{dest}</div>
                              {flight && (
                                <div className="text-xs text-blue-600 mt-0.5">
                                  ✈ {flight}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                              {fmt(trip.payments_total)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-amber-700 font-semibold">
                              {trip.tips_total > 0 ? fmt(trip.tips_total) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                        <td
                          colSpan="6"
                          className="px-4 py-3 text-sm text-gray-700"
                        >
                          {method} Subtotal &nbsp;· {methodTotals.count} trip
                          {methodTotals.count !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {fmt(methodTotals.payments_total)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-amber-700">
                          {methodTotals.tips_total > 0
                            ? fmt(methodTotals.tips_total)
                            : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

      {/* Grand Total Bar */}
      {!isLoading && !error && grandTotal.count > 0 && (
        <div className="bg-gray-900 text-white rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Grand Total &nbsp;· {grandTotal.count} trips &nbsp;·{" "}
              {paymentMethods.length} method
              {paymentMethods.length !== 1 ? "s" : ""}
            </p>
            <p className="text-3xl font-bold">
              {fmt(grandTotal.payments_total)}
            </p>
          </div>
          {grandTotal.tips_total > 0 && (
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Total Tips
              </p>
              <p className="text-2xl font-bold text-amber-400">
                {fmt(grandTotal.tips_total)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TripModal */}
      {isModalOpen && editingTrip && (
        <Suspense fallback={null}>
          <TripModal
            trip={editingTrip}
            drivers={drivers}
            services={services}
            onClose={() => {
              setIsModalOpen(false);
              setEditingTrip(null);
            }}
            onSuccess={() => {
              setIsModalOpen(false);
              setEditingTrip(null);
              queryClient.invalidateQueries(["weekly-payments-report"]);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
