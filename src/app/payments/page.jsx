"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  DollarSign,
  Search,
  Filter,
  Calendar,
  CreditCard,
  User,
  Undo2,
  XCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { UnifiedPaymentModal } from "@/components/UnifiedPaymentModal";
import { PageWithBackButton } from "@/components/PageWithBackButton";

// Safe date-only formatter: avoids UTC midnight → CDT previous-day shift
function formatDateOnly(dateStr) {
  if (!dateStr) return "—";
  const s = String(dateStr).slice(0, 10);
  if (s.length < 10) return s;
  const [yr, mo, dy] = s.split("-").map(Number);
  return new Date(yr, mo - 1, dy).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Lazy load TripModal
const TripModal = React.lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((mod) => ({
    default: mod.TripModal,
  })),
);

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preselectedTripId, setPreselectedTripId] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Trip modal state
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Open modal with pre-selected trip if appointment_id is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apptId = params.get("appointment_id");
    if (apptId) {
      setPreselectedTripId(apptId);
      setIsModalOpen(true);
      window.history.replaceState(null, "", "/payments");
    }
  }, []);

  // Fetch all payments (no date filtering)
  const { data: transactions, isLoading: paymentsLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?category=payment`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  // Server-side text search across all time (enabled only when searching)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["payments-search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        `/api/transactions?category=payment&q=${encodeURIComponent(debouncedSearch)}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!debouncedSearch.trim(),
    staleTime: 0,
  });

  // Use search results when searching, all payments otherwise
  const isSearching = !!debouncedSearch.trim();
  const activeTransactions = isSearching
    ? (searchResults ?? [])
    : (transactions ?? []);
  const isLoading = isSearching ? searchLoading : paymentsLoading;

  const { data: trips } = useQuery({
    queryKey: ["confirmed-trips"],
    queryFn: () => fetch("/api/appointments").then((r) => r.json()),
  });

  // Fetch clients, drivers, and services for TripModal
  const { data: clients } = useQuery({
    queryKey: ["clients", { include_inactive: true }],
    queryFn: async () => {
      const res = await fetch("/api/clients?include_inactive=true");
      return res.json();
    },
    enabled: isTripModalOpen,
  });

  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      return res.json();
    },
    enabled: isTripModalOpen,
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      return res.json();
    },
    enabled: isTripModalOpen,
  });

  const reverseMutation = useMutation({
    mutationFn: async (appointmentId) => {
      if (!appointmentId) throw new Error("No trip linked to this payment");
      const res = await fetch(
        `/api/appointments/${appointmentId}/reverse-payment`,
        {
          method: "POST",
        },
      );
      if (!res.ok) throw new Error(`Reverse failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment reversed — trip is now unpaid");
      queryClient.removeQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reverse payment");
    },
  });

  const handleOpenTrip = async (appointmentId) => {
    if (!appointmentId) {
      toast.error("No trip associated with this payment");
      return;
    }

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      const tripData = await res.json();
      setEditingTrip(tripData);
      setIsTripModalOpen(true);
    } catch (error) {
      console.error("Error fetching trip:", error);
      toast.error("Failed to open trip record");
    }
  };

  const handleCloseTripModal = () => {
    setIsTripModalOpen(false);
    setEditingTrip(null);
  };

  const handleTripSuccess = () => {
    setIsTripModalOpen(false);
    setEditingTrip(null);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
  };

  return (
    <>
      <PageWithBackButton>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Payments
              </h1>
              <p className="text-gray-500 mt-1">
                Track revenue, tips, and driver commissions.
              </p>
            </div>
            <button
              onClick={() => {
                setPreselectedTripId(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Record Payment
            </button>
          </div>

          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by trip #, passenger name, or description..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {search && (
              <div className="mt-2 text-xs text-gray-600">
                Showing {activeTransactions?.length || 0} of{" "}
                {transactions?.length || 0} payments
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label="Total Revenue"
              value={
                activeTransactions?.reduce(
                  (sum, t) => sum + Number(t.amount),
                  0,
                ) || 0
              }
              icon={DollarSign}
              color="blue"
            />
            <StatCard
              label="Total Tips"
              value={
                activeTransactions?.reduce(
                  (sum, t) => sum + Number(t.tip_amount),
                  0,
                ) || 0
              }
              icon={Plus}
              color="green"
            />
            <StatCard
              label="Net Commission"
              value={
                activeTransactions?.reduce(
                  (sum, t) => sum + Number(t.amount) * 0.2,
                  0,
                ) || 0
              }
              icon={CreditCard}
              color="orange"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Trip
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Loading payments...
                    </td>
                  </tr>
                ) : activeTransactions?.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      {search
                        ? "No payments match your search."
                        : "No payments recorded."}
                    </td>
                  </tr>
                ) : (
                  activeTransactions?.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Calendar size={14} className="text-gray-400" />
                          {t.trip_date
                            ? formatDateOnly(t.trip_date)
                            : formatDateOnly(t.transaction_date)}
                        </div>
                        {t.trip_date && (
                          <div className="text-xs text-gray-400 ml-5 mt-0.5">
                            paid {formatDateOnly(t.transaction_date)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {t.appointment_id ? (
                          <button
                            onClick={() => handleOpenTrip(t.appointment_id)}
                            className="text-left hover:bg-blue-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
                          >
                            <p className="text-sm font-semibold text-blue-600 hover:text-blue-800">
                              {t.booking_number || `Trip #${t.appointment_id}`}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {t.passenger_name ||
                                t.description ||
                                "Service payment"}
                            </p>
                          </button>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {t.booking_number || "Payment"}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {t.passenger_name ||
                                t.description ||
                                "Service payment"}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                          {t.method}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">
                          ${Number(t.amount).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() =>
                            reverseMutation.mutate(t.appointment_id)
                          }
                          disabled={reverseMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
                          title="Reverse this payment — removes all payment records and sets trip back to unpaid"
                        >
                          <Undo2 size={14} />
                          {reverseMutation.isPending
                            ? "Reversing..."
                            : "Reverse"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWithBackButton>

      {isModalOpen && (
        <UnifiedPaymentModal
          trips={trips}
          preselectedTripId={preselectedTripId}
          paidTripIds={
            new Set(
              (transactions ?? []).map((t) => t.appointment_id).filter(Boolean),
            )
          }
          onClose={() => {
            setIsModalOpen(false);
            setPreselectedTripId(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setPreselectedTripId(null);
            queryClient.invalidateQueries(["payments"]);
          }}
        />
      )}

      {isTripModalOpen && editingTrip && (
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
            onClose={handleCloseTripModal}
            onSuccess={handleTripSuccess}
            onBookReturn={() => {}}
          />
        </Suspense>
      )}
    </>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200">
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center border ${colors[color]}`}
        >
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            $
            {Number(value).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
