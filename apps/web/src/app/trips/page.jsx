"use client";
// Trips management page - v2

import React, {
  useState,
  useEffect,
  lazy,
  Suspense,
  useCallback,
  useRef,
} from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { RotationWidget } from "@/components/Trips/RotationWidget";
import { TripsHeader } from "@/components/Trips/TripsHeader";
import { TripsFilters } from "@/components/Trips/TripsFilters";
import { TripsTable } from "@/components/Trips/TripsTable";
import { DeleteTripModal } from "@/components/Trips/DeleteTripModal";
import { useTrips } from "@/hooks/useTrips";
import { filterTrips } from "@/utils/trips/filterTrips";
import { X, CheckCircle2, Download, Printer } from "lucide-react";
import {
  formatDateTimeCDT,
  getTodayInCDT,
  getDateStringInCDT,
} from "@/utils/timezone";
import { PageWithBackButton } from "@/components/PageWithBackButton";

// Lazy-load heavy modal components for code splitting
const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);
const InvoiceModal = lazy(() =>
  import("@/components/Trips/InvoiceModal").then((m) => ({
    default: m.InvoiceModal,
  })),
);
const UnifiedPaymentModal = lazy(() =>
  import("@/components/UnifiedPaymentModal").then((m) => ({
    default: m.UnifiedPaymentModal,
  })),
);
const DispatchBookingWizard = lazy(() =>
  import("@/components/Trips/TripModal/DispatchBookingWizard").then((m) => ({
    default: m.DispatchBookingWizard,
  })),
);

export default function TripsPage() {
  const queryClient = useQueryClient();

  // Fetch settings for company name
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const [search, setSearch] = useState("");
  const [searchType, setSearchType] = useState("passenger");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [deletingTrip, setDeletingTrip] = useState(null);
  const [invoiceTripId, setInvoiceTripId] = useState(null);
  const [paymentTripId, setPaymentTripId] = useState(null);
  const [preselectedDriver, setPreselectedDriver] = useState(null);
  const [returnPrefill, setReturnPrefill] = useState(null);
  const [clientIdFilter, setClientIdFilter] = useState(null);
  const [preselectedClientId, setPreselectedClientId] = useState(null);
  const [isNewTripMode, setIsNewTripMode] = useState(false);
  const [sendingThankYou, setSendingThankYou] = useState(null);
  const [showNewTripWizard, setShowNewTripWizard] = useState(false);
  const [showAllTripsReport, setShowAllTripsReport] = useState(false);
  const [allTripsData, setAllTripsData] = useState(null);
  const [startAsTour, setStartAsTour] = useState(false);
  // Key counter to force fresh TripModal mount on each new trip open
  const [newTripKey, setNewTripKey] = useState(0);

  // returnTo: if set, closing the modal navigates back to this page instead of staying on /trips
  const [returnTo, setReturnTo] = useState(null);

  // Date window removed - always load all trips
  // const [dateWindow, setDateWindow] = useState(undefined); // REMOVED

  // Server-side search state
  const [serverSearchResults, setServerSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef(null);

  // Use selective data fetching - fetch ALL trips without date restrictions
  const {
    trips,
    isLoading,
    tripsError,
    clients,
    drivers,
    services,
    transactions,
    deleteMutation,
    fetchTrip,
    searchTrips,
  } = useTrips({
    fetchTrips: true,
    fetchClients: true,
    fetchAllClients: true,
    fetchDrivers: true,
    fetchServices: true,
    fetchBlockedTimes: false,
    fetchTransactions: true,
    dateWindow: "all", // Always load all trips
    refetchInterval: 5 * 1000, // Auto-refresh every 5 seconds so changes appear almost immediately when returning from edit trip
  });

  // Redirect to sign-in if auth has expired
  React.useEffect(() => {
    if (
      tripsError?.message === "UNAUTHORIZED" &&
      typeof window !== "undefined"
    ) {
      window.location.href =
        "/account/signin?callbackUrl=" +
        encodeURIComponent(window.location.pathname);
    }
  }, [tripsError]);

  // Create set of paid trip IDs from transactions
  const paidTripIds = new Set(
    (transactions ?? [])
      .filter((t) => t.category === "payment" && t.appointment_id)
      .map((t) => t.appointment_id),
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const isNew = params.get("new");
    const clientId = params.get("client_id");
    const filterParam = params.get("filter") || params.get("status");
    const openModal = params.get("open_modal");
    const returnToParam = params.get("returnTo");

    if (returnToParam) setReturnTo(returnToParam);
    if (clientId) setClientIdFilter(Number(clientId));
    if (filterParam) {
      setStatusFilter(filterParam);
    }

    if (id) {
      handleFetchTrip(id);
    } else if (isNew) {
      setIsNewTripMode(true);
      setIsModalOpen(true);
      setEditingTrip(null);
      setShowNewTripWizard(true);
      if (params.get("tour") === "true") {
        setStartAsTour(true);
      }
    } else if (openModal === "true" && clientId) {
      // Auto-open trip modal with passenger pre-selected
      setPreselectedClientId(Number(clientId));
      setIsModalOpen(true);
      setShowNewTripWizard(true);
    }
  }, []);

  const handleFetchTrip = async (id) => {
    try {
      const data = await fetchTrip(id);
      setEditingTrip(data);
      setIsModalOpen(true);
    } catch (error) {
      // Error already handled in useTrips
    }
  };

  // Reset page to 1 when filters change
  const handleSearchChange = useCallback(
    (val) => {
      setSearch(val);
      setCurrentPage(1);

      // Clear previous debounce timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      const trimmed = val.trim();
      if (trimmed.length < 2) {
        // Clear server search results — fall back to windowed local data
        setServerSearchResults(null);
        setIsSearching(false);
        return;
      }

      // Debounce server-side search by 400ms
      setIsSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const data = await searchTrips(trimmed, 100, searchType);
          setServerSearchResults(data.results || []);
        } catch (err) {
          console.error("Server search failed:", err);
          // Fall back to client-side filtering on the windowed data
          setServerSearchResults(null);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [searchTrips, searchType],
  );

  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    setCurrentPage(1);
    // Re-trigger search if there's an active search query and switching type
    const trimmed = search.trim();
    if (trimmed.length >= 2) {
      setIsSearching(true);
      // Clear previous timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      // Immediately search with new type
      searchTrips(trimmed, 100, type)
        .then((data) => {
          setServerSearchResults(data.results || []);
        })
        .catch((err) => {
          console.error("Server search failed:", err);
          setServerSearchResults(null);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  // Determine which trips to display:
  // - If server search results are available (user searched), use those with client-side status filter
  // - Otherwise, use the windowed local trips with client-side filters
  const isUsingServerSearch =
    search.trim().length >= 2 && serverSearchResults !== null;

  const baseTrips = isUsingServerSearch ? serverSearchResults : trips || [];

  const filteredTrips = filterTrips(
    baseTrips,
    statusFilter,
    isUsingServerSearch ? "" : search, // Don't re-apply text search if server already filtered
    searchType,
  ).filter((trip) => !clientIdFilter || trip.client_id === clientIdFilter);

  const filteredPassengerName = clientIdFilter
    ? filteredTrips[0]?.client_name ||
      clients?.find((c) => c.id === clientIdFilter)?.name ||
      "Passenger"
    : null;

  const handleBookReturn = (prefill) => {
    setIsModalOpen(false);
    setEditingTrip(null);
    setPreselectedDriver(null);
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    window.history.replaceState(null, "", "/trips");
    setTimeout(() => {
      setReturnPrefill(prefill);
      setIsModalOpen(true);
    }, 50);
  };

  const handleSuccess = async (forceClose = false) => {
    // If we were editing an existing trip AND didn't choose "Save & Go to All Trips",
    // stay on the modal with refreshed data (e.g. after "Approve & Send")
    if (editingTrip && editingTrip.id && !forceClose) {
      const tripId = editingTrip.id;
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      try {
        const refreshedData = await fetchTrip(tripId);
        refreshedData._refreshTs = Date.now();
        setEditingTrip(refreshedData);
      } catch (error) {
        console.error("Failed to refresh trip after save:", error);
        // Trip WAS saved — we just couldn't re-fetch fresh data.
        // Keep the modal open with a warning instead of closing, so
        // the user doesn't mistake a fetch error for a failed save.
        toast.warning("Trip saved ✓ — close and reopen to see latest data", {
          duration: 6000,
        });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    } else {
      // Capture trip info BEFORE clearing state so we can look for return trip
      const closedTrip = editingTrip;
      const passengerName = closedTrip?.client_name || "";

      // New trip, return prefill, or "Save & Go to All Trips" — close the modal
      setIsModalOpen(false);
      setEditingTrip(null);
      setPreselectedDriver(null);
      setReturnPrefill(null);
      setPreselectedClientId(null);

      // Filter by passenger name so all their trips are visible
      if (passengerName && passengerName.length >= 2) {
        setSearchType("passenger");
        setSearch(passengerName);
        setIsSearching(true);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTrips(passengerName, 100, "passenger")
          .then((data) => setServerSearchResults(data.results || []))
          .catch(() => setServerSearchResults(null))
          .finally(() => setIsSearching(false));
      } else {
        setSearch("");
        setServerSearchResults(null);
      }
      setCurrentPage(1);

      // Force fresh data fetch so updated trip info shows immediately
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.refetchQueries({
        queryKey: ["appointments"],
        type: "active",
      });

      // If the closed trip had a return_date, try to find and open the return trip
      if (closedTrip && closedTrip.client_id && closedTrip.return_date) {
        const returnDate = new Date(closedTrip.return_date);
        const returnTrip = trips?.find(
          (t) =>
            t.client_id === closedTrip.client_id &&
            t.id !== closedTrip.id &&
            t.notes?.toLowerCase().includes("return trip") &&
            Math.abs(new Date(t.start_time) - returnDate) < 24 * 60 * 60 * 1000,
        );
        if (returnTrip) {
          setTimeout(() => handleFetchTrip(returnTrip.id), 150);
        }
      }

      window.history.replaceState(null, "", "/trips");
    }
  };

  const handleClose = () => {
    // Capture trip info BEFORE clearing state so we can look for return trip
    const closedTrip = editingTrip;
    const passengerName = closedTrip?.client_name || "";

    setIsModalOpen(false);
    setEditingTrip(null);
    setPreselectedDriver(null);
    setReturnPrefill(null);
    setPreselectedClientId(null);

    // Force fresh data fetch so updated trip info shows immediately
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.refetchQueries({ queryKey: ["appointments"], type: "active" });

    // If we came from another page (e.g. communication log), go back there
    if (returnTo) {
      window.location.href = returnTo;
      return;
    }

    // Filter by passenger name so all their trips are visible
    if (passengerName && passengerName.length >= 2) {
      setSearchType("passenger");
      setSearch(passengerName);
      setIsSearching(true);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTrips(passengerName, 100, "passenger")
        .then((data) => setServerSearchResults(data.results || []))
        .catch(() => setServerSearchResults(null))
        .finally(() => setIsSearching(false));
    } else {
      setSearch("");
      setServerSearchResults(null);
    }
    setCurrentPage(1);

    if (isNewTripMode) {
      setIsNewTripMode(false);
      window.location.href = "/trips";
    } else {
      window.history.replaceState(null, "", "/trips");
    }
  };

  const handleNewTrip = () => {
    // Clear ALL state to ensure fresh wizard flow
    setPreselectedDriver(null);
    setEditingTrip(null);
    setReturnPrefill(null);
    setStartAsTour(false);
    setPreselectedClientId(null);
    setClientIdFilter(null);
    setNewTripKey((k) => k + 1); // force fresh modal mount
    setIsModalOpen(true);
    setShowNewTripWizard(true);
    // Clear URL parameters to prevent any lingering state
    window.history.replaceState(null, "", "/trips");
  };

  const handleAcceptDriver = (driver) => {
    setPreselectedDriver(driver);
    setEditingTrip(null);
    setIsModalOpen(true);
  };

  const handleDeleteTrip = () => {
    if (deletingTrip) {
      deleteMutation.mutate(deletingTrip.id, {
        onSuccess: () => {
          // If a server-side search is active, re-run it so results refresh
          // without the deleted trip — all other filter state is preserved
          const trimmed = search.trim();
          if (trimmed.length >= 2) {
            setIsSearching(true);
            searchTrips(trimmed, 100, searchType)
              .then((data) => {
                setServerSearchResults(data.results || []);
              })
              .catch((err) => {
                console.error(
                  "Server search refresh after delete failed:",
                  err,
                );
                setServerSearchResults(null);
              })
              .finally(() => {
                setIsSearching(false);
              });
          }
        },
      });
      setDeletingTrip(null);
    }
  };

  const handleSendThankYou = async (appointmentId) => {
    setSendingThankYou(appointmentId);
    try {
      const res = await fetch("/api/followup/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send thank you message");
      }

      const result = await res.json();

      // Build success message based on what was sent
      const channels = [];
      if (result.smsSent) channels.push("SMS");
      if (result.emailSent) channels.push("Email");

      if (channels.length > 0) {
        toast.success(`Thank you message sent via ${channels.join(" and ")}!`);
      } else {
        toast.success("Thank you message sent!");
      }

      // Refresh trips to update thankyou_sent_at
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err) {
      console.error("Failed to send thank you:", err);
      toast.error(err.message || "Failed to send thank you message");
    } finally {
      setSendingThankYou(null);
    }
  };

  const handleViewAllTripsReport = async () => {
    try {
      const res = await fetch("/api/reports/all-trips");
      if (!res.ok) {
        throw new Error("Failed to fetch all trips report");
      }
      const data = await res.json();
      setAllTripsData(data);
      setShowAllTripsReport(true);
    } catch (error) {
      console.error("Error fetching all trips report:", error);
      toast.error("Failed to load all trips report");
    }
  };

  return (
    <PageWithBackButton companyName={settings?.business_name || ""}>
      {!isNewTripMode && !returnTo && (
        <div className="space-y-2">
          <TripsHeader
            onNewTrip={handleNewTrip}
            totalCount={trips?.length}
            filteredCount={filteredTrips?.length}
            onViewAllTripsReport={handleViewAllTripsReport}
            // dateWindow prop removed
            // onDateWindowChange prop removed
            isSearchActive={isUsingServerSearch || isSearching}
          />

          {clientIdFilter && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-blue-800">
                Showing trips for:{" "}
                <span className="text-blue-600">{filteredPassengerName}</span>
              </span>
              <button
                onClick={() => {
                  window.location.href = "/passengers";
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
              >
                ← Back to Passengers
              </button>
            </div>
          )}

          <TripsFilters
            search={search}
            onSearchChange={handleSearchChange}
            searchType={searchType}
            onSearchTypeChange={handleSearchTypeChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
          />

          <TripsTable
            trips={filteredTrips}
            isLoading={isLoading || isSearching}
            error={tripsError}
            onEdit={handleFetchTrip}
            onDelete={setDeletingTrip}
            onInvoice={setInvoiceTripId}
            onPay={setPaymentTripId}
            onSendThankYou={handleSendThankYou}
            currentPage={currentPage}
            pageSize={50}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <DeleteTripModal
        trip={deletingTrip}
        onCancel={() => setDeletingTrip(null)}
        onConfirm={handleDeleteTrip}
        isDeleting={deleteMutation.isPending}
      />

      {/* New trip: use DispatchBookingWizard for direct booking flow */}
      {isModalOpen && !editingTrip && !returnPrefill && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <DispatchBookingWizard
            key={`new-trip-${newTripKey}`}
            trip={null}
            prefillData={null}
            clients={clients}
            drivers={drivers}
            services={services}
            preselectedClientId={preselectedClientId}
            startAsTour={startAsTour}
            onClose={handleClose}
            onSuccess={handleSuccess}
          />
        </Suspense>
      )}

      {/* Edit existing trip or return trip prefill: use TripModal */}
      {isModalOpen && (editingTrip || returnPrefill) && (
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
            key={
              editingTrip
                ? `trip-${editingTrip.id}-${editingTrip._refreshTs || ""}`
                : "return-prefill"
            }
            trip={editingTrip}
            prefillData={returnPrefill}
            clients={clients}
            drivers={drivers}
            services={services}
            preselectedDriverId={preselectedDriver?.id}
            onClose={handleClose}
            onSuccess={handleSuccess}
            onBookReturn={handleBookReturn}
          />
        </Suspense>
      )}

      {paymentTripId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <UnifiedPaymentModal
            trips={trips}
            preselectedTripId={paymentTripId}
            paidTripIds={paidTripIds}
            onClose={() => setPaymentTripId(null)}
            onSuccess={() => {
              setPaymentTripId(null);
              queryClient.invalidateQueries(["appointments"]);
              queryClient.invalidateQueries(["transactions"]);
            }}
          />
        </Suspense>
      )}

      {invoiceTripId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <InvoiceModal
            tripId={invoiceTripId}
            onClose={() => setInvoiceTripId(null)}
          />
        </Suspense>
      )}

      {showAllTripsReport && (
        <AllTripsReportModal
          data={allTripsData}
          onClose={() => setShowAllTripsReport(false)}
        />
      )}
    </PageWithBackButton>
  );
}

function ImportReportModal({ data, onClose }) {
  const fmt = (dtStr) => {
    if (!dtStr) return "—";
    try {
      return new Date(dtStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dtStr;
    }
  };

  const reportItems = data?.import_report || [];
  const listedOnly = data?.listed_only || [];
  const importDate = data?.timestamp ? fmt(data.timestamp) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Last Import Report
            </h3>
            {importDate && (
              <p className="text-xs text-gray-500 mt-0.5">
                Imported on {importDate}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {!data ? (
          /* No report available */
          <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              No import report yet
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Import trips from an ICS file in Settings to see a report here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-green-700 font-medium">
                  ✓ {data.inserted ?? 0} trips created
                </span>
                <span className="text-blue-600">
                  + {data.clients_created ?? 0} new clients
                </span>
                {(data.addons_created ?? 0) > 0 && (
                  <span className="text-purple-600">
                    + {data.addons_created} add-ons linked
                  </span>
                )}
                {listedOnly.length > 0 && (
                  <span className="text-amber-600">
                    📋 {listedOnly.length} blocked events listed
                  </span>
                )}
                {(data.errors?.length ?? 0) > 0 && (
                  <span className="text-red-600">
                    ✕ {data.errors.length} errors
                  </span>
                )}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Trip report table */}
              {reportItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                    <CheckCircle2 size={14} />
                    Imported Trips ({reportItems.length})
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-blue-200">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-50 border-b border-blue-200">
                        <tr>
                          <th className="text-left p-2.5 font-semibold text-blue-900">
                            Date / Time
                          </th>
                          <th className="text-left p-2.5 font-semibold text-blue-900">
                            Booking #
                          </th>
                          <th className="text-left p-2.5 font-semibold text-blue-900">
                            Passenger
                          </th>
                          <th className="text-left p-2.5 font-semibold text-blue-900">
                            Calendar Title
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportItems.map((item, i) => (
                          <tr
                            key={i}
                            className="border-b border-blue-100 hover:bg-blue-50/50"
                          >
                            <td className="p-2.5 text-gray-700 whitespace-nowrap">
                              {fmt(item.date_time)}
                            </td>
                            <td className="p-2.5">
                              <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded font-semibold text-xs">
                                {item.booking_number}
                              </span>
                            </td>
                            <td className="p-2.5 font-medium text-gray-900">
                              {item.passenger_name}
                            </td>
                            <td
                              className="p-2.5 text-gray-600 max-w-[200px] truncate"
                              title={item.calendar_title}
                            >
                              {item.calendar_title}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportItems.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No import report data available.
                </div>
              )}

              {/* Listed-only blocked events */}
              {listedOnly.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <div className="text-sm font-semibold text-amber-700">
                    Blocked Events — Listed Only ({listedOnly.length})
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {listedOnly.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-xs text-amber-800 bg-white/60 rounded-lg px-3 py-1.5"
                      >
                        <span className="font-semibold">
                          {fmt(item.start_time)}
                        </span>
                        <span className="text-amber-500">|</span>
                        <span>{item.driver_name || "Unknown"}</span>
                        <span
                          className="text-amber-600 truncate max-w-[200px]"
                          title={item.event_name}
                        >
                          {item.event_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {data.errors && data.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-sm font-semibold text-red-700 mb-1">
                    Errors
                  </div>
                  {data.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-700 font-mono">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AllTripsReportModal({ data, onClose }) {
  const fmt = (dtStr) => {
    if (!dtStr) return "—";
    try {
      return new Date(dtStr).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dtStr;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!data?.trips) return;

    const headers = [
      "Booking #",
      "Date/Time",
      "Passenger",
      "Phone",
      "Email",
      "Driver",
      "Vehicle",
      "Services",
      "Amount",
      "Payment Status",
      "Trip Status",
      "Pickup",
      "Dropoff",
      "Destination",
      "Distance (mi)",
      "People",
      "Notes",
    ];

    const rows = data.trips.map((trip) => [
      trip.booking_number || "",
      fmt(trip.start_time),
      trip.client_name || "",
      trip.client_phone || "",
      trip.client_email || "",
      trip.employee_name || "Unassigned",
      trip.vehicle_name || "",
      trip.services
        .map((s) => `${s.service_name} ($${s.service_price})`)
        .join("; "),
      trip.payment_amount || "0",
      trip.payment_status || "unpaid",
      trip.status || "pending",
      trip.pickup_address || "",
      trip.dropoff_address || "",
      trip.destination || "",
      trip.distance_miles || "",
      trip.num_people || "",
      trip.notes || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-trips-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const trips = data?.trips || [];
  const totalAmount = trips.reduce(
    (sum, t) => sum + (Number(t.payment_amount) || 0),
    0,
  );
  const paidTrips = trips.filter((t) => t.payment_status === "paid").length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              All Trips Report
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {trips.length} total trips • {paidTrips} paid • $
              {totalAmount.toFixed(2)} total revenue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download size={14} />
              Download CSV
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {trips.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No trips found in the database.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Booking #
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Date/Time
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Passenger
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Driver
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Services
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Amount
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Payment
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Status
                    </th>
                    <th className="text-left p-2.5 font-semibold text-gray-600">
                      Destination
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr
                      key={trip.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="p-2.5">
                        {trip.booking_number ? (
                          <span className="inline-block px-2 py-0.5 bg-blue-600 text-white rounded font-semibold">
                            {trip.booking_number}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-gray-700 whitespace-nowrap">
                        {fmt(trip.start_time)}
                      </td>
                      <td className="p-2.5">
                        <div className="font-medium text-gray-900">
                          {trip.client_name || "Unknown"}
                        </div>
                        <div className="text-gray-400">
                          {trip.client_phone || "—"}
                        </div>
                      </td>
                      <td className="p-2.5 text-gray-700">
                        {trip.employee_name || (
                          <span className="text-orange-500 italic">
                            Unassigned
                          </span>
                        )}
                        {trip.vehicle_name && (
                          <div className="text-gray-400">
                            🚗 {trip.vehicle_name}
                          </div>
                        )}
                      </td>
                      <td className="p-2.5">
                        {trip.services.length > 0 ? (
                          <div className="space-y-0.5">
                            {trip.services.map((svc, idx) => (
                              <div key={idx} className="text-blue-700">
                                {svc.service_name}{" "}
                                {svc.quantity > 1 && `(×${svc.quantity})`}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="p-2.5 font-semibold text-green-700">
                        ${Number(trip.payment_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            trip.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : trip.payment_status === "partial"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {trip.payment_status || "unpaid"}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            trip.status === "confirmed"
                              ? "bg-blue-100 text-blue-700"
                              : trip.status === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {trip.status || "pending"}
                        </span>
                      </td>
                      <td
                        className="p-2.5 text-gray-600 max-w-[200px] truncate"
                        title={trip.destination}
                      >
                        {trip.destination || trip.dropoff_address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Total:{" "}
            <span className="font-semibold text-gray-700">{trips.length}</span>{" "}
            trips
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
