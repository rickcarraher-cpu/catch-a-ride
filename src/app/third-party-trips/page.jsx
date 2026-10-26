"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  DollarSign,
  Filter,
  X,
  Search,
  MapPin,
  Plus,
} from "lucide-react";

export default function ThirdPartyTripsPage() {
  const [filters, setFilters] = useState({
    partner_id: "",
    status: "",
    payment_status: "",
    start_date: "",
    end_date: "",
  });
  const [search, setSearch] = useState("");

  // Check if ?new=true to redirect to creation page
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true") {
        window.location.href = "/third-party-trips/create";
      }
    }
  }, []);

  // Fetch partner companies for filter dropdown
  const { data: partnersData } = useQuery({
    queryKey: ["partner-companies-active"],
    queryFn: async () => {
      const res = await fetch("/api/partner-companies?status=active");
      if (!res.ok) throw new Error("Failed to fetch partners");
      return res.json();
    },
  });

  const partners = partnersData?.companies || [];

  // Fetch third-party trips
  const { data: tripsData, isLoading } = useQuery({
    queryKey: ["third-party-trips", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.partner_id) params.append("partner_id", filters.partner_id);
      if (filters.status) params.append("status", filters.status);
      if (filters.payment_status)
        params.append("payment_status", filters.payment_status);
      if (filters.start_date) params.append("start_date", filters.start_date);
      if (filters.end_date) params.append("end_date", filters.end_date);

      const res = await fetch(`/api/third-party-trips?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch third-party trips");
      return res.json();
    },
  });

  const trips = tripsData?.trips || [];

  // Filter by search
  const filteredTrips = useMemo(() => {
    if (!search.trim()) return trips;
    const q = search.toLowerCase();
    return trips.filter(
      (t) =>
        (t.booking_number || "").toLowerCase().includes(q) ||
        (t.passenger_payer_name || "").toLowerCase().includes(q) ||
        (t.partner_name || "").toLowerCase().includes(q) ||
        (t.pickup_address || "").toLowerCase().includes(q) ||
        (t.dropoff_address || "").toLowerCase().includes(q),
    );
  }, [trips, search]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <Building2 size={24} className="text-teal-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Third-Party Drives
              </h1>
              <p className="text-sm text-gray-500">
                {filteredTrips.length} trip
                {filteredTrips.length !== 1 ? "s" : ""} found
              </p>
            </div>
          </div>
          <a
            href="/third-party-trips/create"
            className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 shadow no-underline"
          >
            <Plus size={16} />
            Create 3rd Party Drive
          </a>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} className="text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              value={filters.partner_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, partner_id: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            >
              <option value="">All Partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={filters.payment_status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, payment_status: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            >
              <option value="">All Payment Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
            </select>

            <input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, start_date: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              placeholder="Start Date"
            />

            <input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, end_date: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
              placeholder="End Date"
            />
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by booking #, passenger, partner, or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div
              className="h-12 w-12 border-4 border-teal-600 border-r-transparent rounded-full"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Trips List */}
        {!isLoading && filteredTrips.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              No Third-Party Trips Found
            </h3>
            <p className="text-gray-500 mb-6">
              {search || Object.values(filters).some((v) => v)
                ? "Try adjusting your filters or search terms"
                : "Create your first third-party drive"}
            </p>
            <a
              href="/third-party-trips/create"
              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors inline-flex items-center gap-2 no-underline"
            >
              <Plus size={16} />
              Create 3rd Party Drive
            </a>
          </div>
        )}

        {!isLoading && filteredTrips.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Booking #
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Date/Time
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Passenger
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Partner
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">
                      Payment
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrips.map((trip) => (
                    <tr
                      key={trip.id}
                      className="hover:bg-teal-50 cursor-pointer transition-colors"
                      onClick={() =>
                        (window.location.href = `/trips?id=${trip.id}`)
                      }
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-teal-700">
                          {trip.booking_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Calendar size={14} />
                          <span>
                            {trip.start_time
                              ? new Date(trip.start_time).toLocaleDateString()
                              : "—"}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {trip.start_time
                            ? new Date(trip.start_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {trip.passenger_payer_name ||
                              trip.client_name ||
                              "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-teal-500" />
                          <span className="text-gray-700">
                            {trip.partner_company_name ||
                              trip.partner_name ||
                              "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 max-w-xs">
                          <MapPin
                            size={14}
                            className="text-gray-400 mt-0.5 shrink-0"
                          />
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div className="truncate">
                              {trip.pickup_address || trip.pickup_street || "—"}
                            </div>
                            <div className="truncate text-gray-500">
                              →{" "}
                              {trip.dropoff_address ||
                                trip.dropoff_street ||
                                "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">
                          {trip.driver_name || trip.employee_name || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} className="text-green-600" />
                          <span className="font-semibold text-gray-900">
                            {trip.services_total
                              ? Number(trip.services_total).toFixed(2)
                              : trip.original_amount
                                ? Number(trip.original_amount).toFixed(2)
                                : "0.00"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                            trip.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : trip.status === "confirmed"
                                ? "bg-blue-100 text-blue-700"
                                : trip.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {trip.status || "pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                            trip.payment_status === "paid"
                              ? "bg-green-100 text-green-700"
                              : trip.payment_status === "partially_paid"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {trip.payment_status || "unpaid"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
