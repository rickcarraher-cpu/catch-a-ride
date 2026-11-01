import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";

const STALE_TIME = 1000 * 60 * 2; // 2 minutes — reuse cached data on revisit
const GC_TIME = 1000 * 60 * 30; // 30 minutes — keep data in memory after unmount

/**
 * Selective data fetching hook for trips/appointments
 * @param {Object} options - Configuration options
 * @param {boolean} options.fetchTrips - Whether to fetch appointments (default: true)
 * @param {boolean} options.fetchClients - Whether to fetch clients (default: true)
 * @param {boolean} options.fetchAllClients - Whether to fetch ALL clients including inactive (default: false)
 * @param {boolean} options.fetchDrivers - Whether to fetch drivers (default: true)
 * @param {boolean} options.fetchServices - Whether to fetch services (default: true)
 * @param {boolean} options.fetchBlockedTimes - Whether to fetch blocked times (default: false)
 * @param {boolean} options.fetchTransactions - Whether to fetch transactions (default: false)
 * @param {string} options.startDate - ISO date string for start of date range
 * @param {string} options.endDate - ISO date string for end of date range
 * @param {number} options.limit - Limit number of appointments returned
 * @param {number} options.offset - Offset for pagination
 * @param {string} options.paymentStatus - Filter by payment status
 * @param {string} options.dateWindow - 'default' for ±30 days, 'all' for everything, or omit for default
 */
export function useTrips(options = {}) {
  const {
    fetchTrips = true,
    fetchClients = true,
    fetchAllClients = false,
    fetchDrivers = true,
    fetchServices = true,
    fetchBlockedTimes = false,
    fetchTransactions = false,
    startDate,
    endDate,
    limit,
    offset,
    paymentStatus,
    dateWindow, // 'all' to load all trips, undefined/missing for default ±30 day window
    refetchOnMount, // pass 'always' to force refetch every time the component mounts
    refetchInterval = false, // e.g. 30000 for 30-second polling
  } = options;

  const queryClient = useQueryClient();

  // Build query params for appointments
  const buildAppointmentsUrl = () => {
    const params = new URLSearchParams();
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);
    if (limit) params.append("limit", limit.toString());
    if (offset) params.append("offset", offset.toString());
    if (paymentStatus) params.append("payment_status", paymentStatus);
    if (dateWindow === "all") params.append("window", "all");
    const queryString = params.toString();
    return `/api/appointments${queryString ? `?${queryString}` : ""}`;
  };

  const {
    data: trips,
    isLoading,
    error: tripsError,
  } = useQuery({
    queryKey: [
      "appointments",
      { startDate, endDate, limit, offset, paymentStatus, dateWindow },
    ],
    queryFn: async () => {
      const res = await fetch(buildAppointmentsUrl());
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load trips");
      }
      return res.json();
    },
    staleTime: 0, // Always fetch fresh data - no caching (was STALE_TIME)
    gcTime: GC_TIME,
    retry: (failureCount, error) => {
      if (error?.message === "UNAUTHORIZED") return false;
      return failureCount < 2;
    },
    enabled: fetchTrips,
    refetchOnMount: "always", // Always refetch when component mounts (was refetchOnMount || true)
    refetchInterval,
  });

  // Redirect to sign-in if auth has expired
  useEffect(() => {
    if (
      tripsError?.message === "UNAUTHORIZED" &&
      typeof window !== "undefined"
    ) {
      window.location.href =
        "/account/signin?callbackUrl=" +
        encodeURIComponent(window.location.pathname);
    }
  }, [tripsError]);

  // Server-side search — searches ALL trips regardless of date window
  const searchTrips = useCallback(
    async (query, searchLimit = 50, searchType = "all") => {
      if (!query || query.trim().length < 2) return { results: [], total: 0 };
      const params = new URLSearchParams();
      params.append("q", query.trim());
      params.append("limit", searchLimit.toString());
      if (searchType) params.append("searchType", searchType);
      const res = await fetch(`/api/appointments/search?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to search trips");
      }
      return res.json();
    },
    [],
  );

  const { data: clients } = useQuery({
    queryKey: ["clients", { includeInactive: fetchAllClients }],
    queryFn: async () => {
      const url = fetchAllClients
        ? "/api/clients?include_inactive=true"
        : "/api/clients";
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load clients");
      }
      return res.json();
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: (failureCount, error) => {
      if (error?.message === "UNAUTHORIZED") return false;
      return failureCount < 2;
    },
    enabled: fetchClients,
  });

  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load drivers");
      }
      return res.json();
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    enabled: fetchDrivers,
    refetchOnMount: refetchOnMount || true,
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load services");
      }
      return res.json();
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    enabled: fetchServices,
  });

  const { data: blockedTimes } = useQuery({
    queryKey: ["blockedTimes"],
    queryFn: async () => {
      const res = await fetch("/api/blocked-times");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load blocked times");
      }
      return res.json();
    },
    staleTime: 0, // Always fetch fresh — blocked times can be changed on other pages
    gcTime: GC_TIME,
    refetchOnWindowFocus: true,
    retry: 2,
    enabled: fetchBlockedTimes,
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const res = await fetch("/api/transactions?category=payment");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load transactions");
      }
      return res.json();
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 2,
    enabled: fetchTransactions,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete trip");
      }
      return res.json();
    },
    onSuccess: async () => {
      // Invalidate and immediately refetch to update UI without manual refresh
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.refetchQueries({
        queryKey: ["appointments"],
        type: "active",
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Trip deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete trip"),
  });

  const fetchTrip = async (id) => {
    const res = await fetch(`/api/appointments/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load trip details");
    }
    return res.json();
  };

  return {
    trips,
    isLoading,
    tripsError,
    clients,
    drivers,
    services,
    blockedTimes,
    transactions,
    deleteMutation,
    fetchTrip,
    searchTrips,
  };
}
