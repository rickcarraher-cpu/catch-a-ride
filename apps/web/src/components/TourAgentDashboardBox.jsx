"use client";
// Tour Agent Dashboard Box - v2

import React, { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bus,
  Plus,
  Eye,
  Edit3,
  Printer,
  Calendar,
  Clock,
  User,
  Users,
  DollarSign,
  MapPin,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";

const TourReviewModal = lazy(
  () => import("@/components/Tours/TourReviewModal"),
);

export default function TourAgentDashboardBox() {
  const queryClient = useQueryClient();
  const [selectedTour, setSelectedTour] = useState(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Fetch tours
  const { data: toursBase = [], isLoading } = useQuery({
    queryKey: ["tours-dashboard-box"],
    queryFn: async () => {
      const res = await fetch("/api/appointments?is_tour=true&window=all");
      if (!res.ok) throw new Error("Failed to fetch tours");
      return res.json();
    },
    staleTime: 60000,
  });

  const tourIds = useMemo(() => toursBase.map((t) => t.id), [toursBase]);

  const { data: allParticipants = [] } = useQuery({
    queryKey: ["tours-box-participants", tourIds],
    queryFn: async () => {
      if (tourIds.length === 0) return [];
      const res = await fetch("/api/tours/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_ids: tourIds }),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: tourIds.length > 0,
    staleTime: 60000,
  });

  const { data: allItinerary = [] } = useQuery({
    queryKey: ["tours-box-itinerary", tourIds],
    queryFn: async () => {
      if (tourIds.length === 0) return [];
      const res = await fetch("/api/tours/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_ids: tourIds }),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: tourIds.length > 0,
    staleTime: 60000,
  });

  const tours = useMemo(() => {
    return toursBase
      .map((tour) => ({
        ...tour,
        tour_participants: allParticipants.filter(
          (p) => p.appointment_id === tour.id,
        ),
        tour_itinerary: allItinerary.filter(
          (i) => i.appointment_id === tour.id,
        ),
      }))
      .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  }, [toursBase, allParticipants, allItinerary]);

  const filteredTours = useMemo(() => {
    if (!search.trim()) return tours;
    const q = search.toLowerCase();
    return tours.filter(
      (t) =>
        (t.client_name || "").toLowerCase().includes(q) ||
        (t.booking_number || "").toLowerCase().includes(q) ||
        (t.employee_name || "").toLowerCase().includes(q) ||
        (t.destination || "").toLowerCase().includes(q),
    );
  }, [tours, search]);

  const displayedTours = showAll ? filteredTours : filteredTours.slice(0, 6);

  const handlePrint = (tour, e) => {
    e.stopPropagation();
    window.open(`/tour-print/${tour.id}`, "_blank");
  };

  const handleEdit = (tour, e) => {
    e.stopPropagation();
    setSelectedTour(tour);
  };

  const handleView = (tour) => {
    setSelectedTour(tour);
  };

  const handleModalClose = () => setSelectedTour(null);

  const handleModalUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["tours-dashboard-box"] });
    queryClient.invalidateQueries({ queryKey: ["tours-box-participants"] });
    queryClient.invalidateQueries({ queryKey: ["tours-box-itinerary"] });
  };

  const statusColor = (status) => {
    const map = {
      approved: "bg-green-100 text-green-700",
      confirmed: "bg-blue-100 text-blue-700",
      completed: "bg-emerald-100 text-emerald-700",
      cancelled: "bg-red-100 text-red-700",
      pending: "bg-yellow-100 text-yellow-700",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden shadow">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus size={18} className="text-purple-100" />
            <h2 className="text-base font-bold tracking-wide uppercase">
              Tour Agent Portal
            </h2>
            <span className="bg-white/20 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              {tours.length} tour{tours.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/tours"
              className="text-xs text-purple-100 hover:text-white font-medium flex items-center gap-1 transition-colors"
            >
              View All <ChevronRight size={13} />
            </a>
          </div>
        </div>

        <div className="bg-white px-5 py-4">
          {/* Action Buttons Row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <a
              href="/trips?new=true&dispatch=true"
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl bg-gradient-to-b from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow transition-all hover:scale-105 hover:shadow-md text-center no-underline"
            >
              <Plus size={22} />
              <span className="text-xs font-bold leading-tight">
                Add a Tour
              </span>
            </a>

            <button
              onClick={() => {
                const first = filteredTours[0];
                if (first) setSelectedTour(first);
                else window.location.href = "/tours";
              }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 shadow transition-all hover:scale-105 hover:shadow-md text-center"
            >
              <Edit3 size={22} />
              <span className="text-xs font-bold leading-tight">
                Edit a Tour
              </span>
            </button>

            <a
              href="/tours"
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl bg-gradient-to-b from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow transition-all hover:scale-105 hover:shadow-md text-center no-underline"
            >
              <Eye size={22} />
              <span className="text-xs font-bold leading-tight">
                View Tour Details
              </span>
            </a>

            <button
              onClick={() => {
                const first = filteredTours[0];
                if (first) window.open(`/tour-print/${first.id}`, "_blank");
                else window.location.href = "/tours";
              }}
              className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow transition-all hover:scale-105 hover:shadow-md text-center"
            >
              <Printer size={22} />
              <span className="text-xs font-bold leading-tight">
                Print Tour Details
              </span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400"
            />
            <input
              type="text"
              placeholder="Search tours by name, booking #, driver…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-purple-50/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Tours List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-purple-500 border-r-transparent" />
            </div>
          ) : filteredTours.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-purple-200 rounded-xl">
              <Bus size={32} className="mx-auto text-purple-300 mb-2" />
              <p className="text-sm text-gray-500">
                {search
                  ? "No tours match your search"
                  : "No tours yet — add one above!"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {displayedTours.map((tour) => {
                  const startDate = tour.start_time
                    ? new Date(tour.start_time)
                    : null;
                  const guestCount = (tour.tour_participants || []).length;
                  const stopCount = (tour.tour_itinerary || []).length;

                  return (
                    <div
                      key={tour.id}
                      onClick={() => handleView(tour)}
                      className="flex items-center gap-3 p-3 border border-purple-100 rounded-xl hover:border-purple-300 hover:bg-purple-50/40 cursor-pointer group transition-all"
                    >
                      {/* Date badge */}
                      <div className="shrink-0 w-11 h-11 rounded-lg bg-purple-100 flex flex-col items-center justify-center text-purple-700">
                        {startDate ? (
                          <>
                            <span className="text-xs font-semibold leading-none">
                              {format(startDate, "MMM")}
                            </span>
                            <span className="text-base font-extrabold leading-none">
                              {format(startDate, "d")}
                            </span>
                          </>
                        ) : (
                          <Bus size={18} className="text-purple-400" />
                        )}
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 truncate">
                            {tour.client_name || "Unknown"}
                          </span>
                          {tour.booking_number && (
                            <span className="text-xs font-mono text-gray-400">
                              #{tour.booking_number}
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${statusColor(tour.status)}`}
                          >
                            {tour.status || "pending"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          {startDate && (
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {format(startDate, "h:mm a")}
                            </span>
                          )}
                          {tour.employee_name && (
                            <span className="flex items-center gap-1">
                              <User size={11} />
                              {tour.employee_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={11} />
                            {guestCount + 1}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={11} />
                            {stopCount} stop{stopCount !== 1 ? "s" : ""}
                          </span>
                          {tour.tour_flat_fee && (
                            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                              <DollarSign size={11} />
                              {Number(tour.tour_flat_fee).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEdit(tour, e)}
                          title="Edit tour"
                          className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={(e) => handlePrint(tour, e)}
                          title="Print tour details"
                          className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                        >
                          <Printer size={14} />
                        </button>
                      </div>

                      {/* Expand arrow */}
                      <ChevronRight
                        size={15}
                        className="text-purple-400 shrink-0 group-hover:text-purple-600 transition-colors"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Show more / less */}
              {filteredTours.length > 6 && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="mt-3 w-full py-2 text-xs font-semibold text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
                >
                  {showAll
                    ? "Show less"
                    : `Show ${filteredTours.length - 6} more tour${filteredTours.length - 6 !== 1 ? "s" : ""}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tour Edit/View Modal */}
      {selectedTour && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <TourReviewModal
            tour={selectedTour}
            onClose={handleModalClose}
            onUpdated={handleModalUpdated}
          />
        </Suspense>
      )}
    </>
  );
}
