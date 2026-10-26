"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Link2,
  CheckCircle,
  ExternalLink,
  Clock,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { useTrips } from "@/hooks/useTrips";
import { ResendInvoiceButton } from "@/components/Reports/ResendInvoiceButton";

const TripModal = React.lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Group style per payment method
const METHOD_STYLES = {
  "Square Invoice": {
    header: "bg-blue-700",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  Venmo: {
    header: "bg-indigo-700",
    border: "border-indigo-200",
    badge: "bg-indigo-100 text-indigo-800 border-indigo-200",
    dot: "bg-indigo-500",
  },
  Zelle: {
    header: "bg-purple-700",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
  },
  Cash: {
    header: "bg-green-700",
    border: "border-green-200",
    badge: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-600",
  },
  "Not Specified": {
    header: "bg-gray-600",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
  },
};

function getStyle(method) {
  return (
    METHOD_STYLES[method] || {
      header: "bg-slate-700",
      border: "border-slate-200",
      badge: "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-500",
    }
  );
}

// ── Send Payment Link button ──────────────────────────────────────────────────
// REMOVED: Payment links must only be sent through Edit Trip.
// The report is read-only — it does NOT alter trip data.

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UnpaidTripsReport() {
  const queryClient = useQueryClient();
  const [editingTrip, setEditingTrip] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { fetchTrip, clients, drivers, services } = useTrips({
    fetchTrips: false,
    fetchClients: true,
    fetchDrivers: true,
    fetchServices: true,
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["unpaid-trips-report"],
    queryFn: async () => {
      const res = await fetch("/api/payments/overdue");
      if (!res.ok) throw new Error("Failed to fetch unpaid trips");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const trips = useMemo(() => {
    return data?.trips || [];
  }, [data]);

  const summary = data?.summary || {};

  // Group trips by payment method
  const grouped = useMemo(() => {
    const groups = {};
    trips.forEach((t) => {
      const m = t.payment_method || "Not Specified";
      if (!groups[m]) groups[m] = [];
      groups[m].push(t);
    });
    // Sort each group by trip date ascending
    Object.values(groups).forEach((g) =>
      g.sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    );
    // Order: Square Invoice, Venmo, Zelle, Cash, Not Specified, then alphabetical
    const ORDER = ["Square Invoice", "Venmo", "Zelle", "Cash", "Not Specified"];
    const defined = ORDER.filter((m) => groups[m]);
    const rest = Object.keys(groups)
      .filter((m) => !ORDER.includes(m))
      .sort();
    return [...defined, ...rest].map((method) => ({
      method,
      trips: groups[method],
      totalDue: groups[method].reduce((s, t) => s + t.balance_due, 0),
    }));
  }, [trips]);

  const handleOpenTrip = async (id) => {
    try {
      const d = await fetchTrip(id);
      setEditingTrip(d);
      setIsModalOpen(true);
    } catch (e) {
      console.error("Failed to load trip:", e);
      toast.error("Could not load trip");
    }
  };

  const handleModalSuccess = async () => {
    if (editingTrip?.id) {
      await queryClient.invalidateQueries({
        queryKey: ["unpaid-trips-report"],
      });
      try {
        const refreshed = await fetchTrip(editingTrip.id);
        refreshed._refreshTs = Date.now();
        setEditingTrip(refreshed);
      } catch {
        setIsModalOpen(false);
        setEditingTrip(null);
      }
    } else {
      setIsModalOpen(false);
      setEditingTrip(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={16} />
              Dashboard
            </a>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <AlertCircle size={22} className="text-red-600" />
                Unpaid Trips
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Grouped by payment method · All trips with balance due
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-sm font-semibold text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Summary stats ── */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-red-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                Total Unpaid
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                {summary.total_unpaid || 0}
              </p>
              <p className="text-sm font-semibold text-red-600">
                ${Number(summary.total_amount_due || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white border border-orange-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">
                Past Due
              </p>
              <p className="text-2xl font-bold text-orange-700 mt-1">
                {summary.past_due_count || 0}
              </p>
              <p className="text-sm font-semibold text-orange-600">
                ${Number(summary.past_due_amount || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">
                Link Sent
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                {summary.with_payment_link || 0}
              </p>
              <p className="text-sm text-blue-500">have active link</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                No Link Yet
              </p>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {summary.without_payment_link || 0}
              </p>
              <p className="text-sm text-gray-400">need a link</p>
            </div>
          </div>
        )}

        {/* ── Loading / Error ── */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={36} className="animate-spin text-blue-600" />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-700">
            <AlertTriangle size={28} className="mx-auto mb-2 opacity-60" />
            Failed to load unpaid trips.{" "}
            <button
              onClick={() => refetch()}
              className="underline font-semibold"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty ── */}
        {!isLoading && !error && trips.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl py-16 text-center">
            <CheckCircle size={40} className="mx-auto text-green-400 mb-3" />
            <p className="text-lg font-semibold text-gray-700">
              All caught up!
            </p>
            <p className="text-sm text-gray-400 mt-1">
              No trips with an outstanding balance.
            </p>
          </div>
        )}

        {/* ── Groups ── */}
        {!isLoading &&
          !error &&
          grouped.map(({ method, trips: groupTrips, totalDue }) => {
            const style = getStyle(method);
            return (
              <div
                key={method}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
              >
                {/* Group header */}
                <div
                  className={`${style.header} text-white px-5 py-3 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold uppercase tracking-wide">
                      {method}
                    </span>
                    <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {groupTrips.length} trip
                      {groupTrips.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-lg font-bold">
                    ${totalDue.toFixed(2)} due
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Trip Date
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Booking #
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Passenger
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Destination
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                          Balance Due
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Payment Link
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Last Link Sent
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {groupTrips.map((trip) => {
                        const isPastDue = trip.is_past_due;
                        const link = trip.active_payment_link;

                        // Smart destination for return trips
                        const isReturn = (trip.notes || "")
                          .toLowerCase()
                          .includes("return trip");
                        const destLower = (
                          trip.destination || ""
                        ).toLowerCase();
                        const isAirport = [
                          "bna",
                          "terminal",
                          "airport",
                          "concourse",
                        ].some((kw) => destLower.includes(kw));
                        const destDisplay =
                          isReturn && isAirport
                            ? trip.destination || "—"
                            : trip.destination || "—";

                        // Is this a cash trip? If so, no payment links should ever show
                        const isCash =
                          (trip.payment_method || "").toLowerCase() === "cash";

                        return (
                          <tr
                            key={trip.id}
                            className={`transition-colors ${
                              isPastDue ? "bg-red-50/60" : ""
                            } hover:bg-blue-50/50`}
                          >
                            {/* Trip Date */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-semibold text-gray-900">
                                {fmtDate(trip.start_time)}
                              </p>
                              <p className="text-xs text-blue-600">
                                {fmtTime(trip.start_time)}
                              </p>
                              {isPastDue && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded">
                                  PAST DUE
                                </span>
                              )}
                            </td>

                            {/* Booking # */}
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleOpenTrip(trip.id)}
                                className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Click to open trip"
                              >
                                {trip.booking_number || `#${trip.id}`}
                              </button>
                            </td>

                            {/* Passenger */}
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-gray-900">
                                {trip.client_name || "—"}
                              </p>
                              {trip.client_phone && (
                                <p className="text-xs text-gray-500">
                                  {trip.client_phone}
                                </p>
                              )}
                            </td>

                            {/* Driver */}
                            <td className="px-4 py-3">
                              {trip.employee_name ? (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{
                                      backgroundColor:
                                        trip.employee_color || "#2563EB",
                                    }}
                                  >
                                    {trip.employee_name.charAt(0)}
                                  </div>
                                  <span className="text-sm text-gray-700">
                                    {trip.employee_name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            {/* Destination */}
                            <td className="px-4 py-3 max-w-[180px]">
                              <p
                                className="text-sm text-gray-700 truncate"
                                title={destDisplay}
                              >
                                {destDisplay}
                              </p>
                              {trip.services && trip.services.length > 0 && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate">
                                  {trip.services
                                    .filter((s) => !s.is_addon)
                                    .map((s) => s.name)
                                    .join(", ")}
                                </p>
                              )}
                            </td>

                            {/* Trip Status */}
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                  trip.status === "confirmed"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : trip.status === "completed"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-gray-50 text-gray-600 border-gray-200"
                                }`}
                              >
                                {trip.status}
                              </span>
                            </td>

                            {/* Balance Due */}
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <p className="text-base font-bold text-red-700">
                                ${Number(trip.balance_due).toFixed(2)}
                              </p>
                              {trip.original_amount > 0 &&
                                trip.payments_total > 0 && (
                                  <p className="text-[10px] text-gray-400">
                                    of $
                                    {Number(trip.original_amount).toFixed(2)}
                                  </p>
                                )}
                            </td>

                            {/* Payment Link */}
                            <td className="px-4 py-3">
                              {isCash ? (
                                <span className="text-xs text-gray-400 italic">
                                  Cash — no link
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1.5">
                                  {link?.payment_url && (
                                    <a
                                      href={link.payment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                                    >
                                      <ExternalLink size={9} />
                                      View link
                                    </a>
                                  )}
                                  <ResendInvoiceButton
                                    trip={trip}
                                    onSuccess={() =>
                                      queryClient.invalidateQueries({
                                        queryKey: ["unpaid-trips-report"],
                                      })
                                    }
                                  />
                                </div>
                              )}
                            </td>

                            {/* Last Link Sent */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {isCash ? (
                                <span className="text-xs text-gray-400 italic">
                                  —
                                </span>
                              ) : link ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                    <Link2 size={11} />
                                    {link.provider?.toUpperCase()}
                                  </span>
                                  <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Clock size={9} />
                                    {fmtDateTime(link.created_at)}
                                  </span>
                                  <span className="text-[10px] text-gray-400 capitalize">
                                    {link.status}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">
                                  None sent
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Group total row */}
                    <tfoot>
                      <tr className={`${style.header} text-white`}>
                        <td
                          colSpan={6}
                          className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-right opacity-80"
                        >
                          {method} Subtotal
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-base whitespace-nowrap">
                          ${totalDue.toFixed(2)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}

        {/* ── Grand Total ── */}
        {!isLoading && !error && trips.length > 0 && (
          <div className="bg-gray-900 text-white rounded-xl px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Grand Total Outstanding
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {summary.total_unpaid} unpaid trips
              </p>
            </div>
            <p className="text-3xl font-bold text-white">
              ${Number(summary.total_amount_due || 0).toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {/* ── Trip Modal ── */}
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
            key={`trip-${editingTrip.id}-${editingTrip._refreshTs || ""}`}
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={() => {
              setIsModalOpen(false);
              setEditingTrip(null);
            }}
            onSuccess={handleModalSuccess}
            onBookReturn={() => {}}
          />
        </Suspense>
      )}
    </div>
  );
}
