"use client";

import React, { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { format } from "date-fns";
import {
  Bus,
  Search,
  Calendar,
  Clock,
  User,
  Users,
  DollarSign,
  MapPin,
  ArrowLeft,
  X,
} from "lucide-react";
import { formatTimeCDT, formatDateCDT } from "@/utils/timezone";
import TourReviewModal from "@/components/Tours/TourReviewModal";

function formatHHMM(hhmm) {
  if (!hhmm) return "";
  // If it's a full ISO string, extract HH:MM from it
  let time = hhmm;
  if (hhmm.includes("T")) {
    const d = new Date(hhmm);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${ampm}`;
  }
  // bare "HH:MM" string
  const [hh, mm] = time.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mm} ${ampm}`;
}

export default function ToursPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTour, setSelectedTour] = useState(null);

  // Fetch tours (appointments where is_tour = true)
  const { data: toursBase = [], isLoading: toursLoading } = useQuery({
    queryKey: ["tours-list"],
    queryFn: async () => {
      const res = await fetch("/api/appointments?is_tour=true&window=all");
      if (!res.ok) throw new Error("Failed to fetch tours");
      return res.json();
    },
  });

  const tourIds = useMemo(() => toursBase.map((t) => t.id), [toursBase]);

  // Fetch participants for all tours
  const { data: allParticipants = [] } = useQuery({
    queryKey: ["tours-participants", tourIds],
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
  });

  // Fetch itinerary for all tours
  const { data: allItinerary = [] } = useQuery({
    queryKey: ["tours-itinerary", tourIds],
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
  });

  // Merge participants and itinerary into tour objects
  const toursRaw = useMemo(() => {
    return toursBase.map((tour) => ({
      ...tour,
      tour_participants: allParticipants.filter(
        (p) => p.appointment_id === tour.id,
      ),
      tour_itinerary: allItinerary.filter((i) => i.appointment_id === tour.id),
    }));
  }, [toursBase, allParticipants, allItinerary]);

  // Filter tours by search
  const filteredTours = useMemo(() => {
    if (!search.trim()) return toursRaw;
    const q = search.toLowerCase().trim();
    return toursRaw.filter((tour) => {
      const passengerName = (tour.client_name || "").toLowerCase();
      const bookingNumber = (tour.booking_number || "").toLowerCase();
      const driverName = (tour.employee_name || "").toLowerCase();
      const destination = (
        tour.destination ||
        tour.dropoff_address ||
        ""
      ).toLowerCase();
      return (
        passengerName.includes(q) ||
        bookingNumber.includes(q) ||
        driverName.includes(q) ||
        destination.includes(q)
      );
    });
  }, [toursRaw, search]);

  // Sort by start_time descending (newest first)
  const sortedTours = useMemo(() => {
    return [...filteredTours].sort(
      (a, b) => new Date(b.start_time) - new Date(a.start_time),
    );
  }, [filteredTours]);

  const handleTourClick = (tour) => {
    setSelectedTour(tour);
  };

  const handleModalClose = () => {
    setSelectedTour(null);
  };

  const handleModalUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["tours-list"] });
    queryClient.invalidateQueries({ queryKey: ["tours-participants"] });
    queryClient.invalidateQueries({ queryKey: ["tours-itinerary"] });
  };

  const statusBadge = (status) => {
    const styles = {
      approved: "bg-green-50 text-green-700 border-green-200",
      confirmed: "bg-blue-50 text-blue-700 border-blue-200",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    };
    return styles[status] || "bg-gray-50 text-gray-700 border-gray-200";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-100 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Bus size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Review Tours</h1>
              <p className="text-purple-100 mt-1">
                {sortedTours.length} tour{sortedTours.length !== 1 ? "s" : ""}{" "}
                found
                {search && ` matching "${search}"`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 p-6">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400"
              size={22}
            />
            <input
              type="text"
              placeholder="Search by passenger, booking #, driver, or destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-4 border-2 border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base bg-purple-50/30"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full p-1"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tours Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {toursLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-r-transparent rounded-full" />
          </div>
        ) : sortedTours.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-purple-200">
            <Bus size={56} className="mx-auto text-purple-300 mb-4" />
            <p className="text-gray-600 font-semibold text-lg">
              {search ? "No tours match your search" : "No tours found"}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Tours are created via the dispatch wizard with "Tour" trip type
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedTours.map((tour) => {
              const participants = tour.tour_participants || [];
              const stops = tour.tour_itinerary || [];

              return (
                <div
                  key={tour.id}
                  onClick={() => handleTourClick(tour)}
                  className="bg-white rounded-2xl border-2 border-purple-100 hover:border-purple-300 hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-lg truncate">
                          {tour.client_name || "Unknown Passenger"}
                        </div>
                        {tour.booking_number && (
                          <div className="text-purple-100 text-xs font-mono mt-1">
                            #{tour.booking_number}
                          </div>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusBadge(tour.status)}`}
                      >
                        {tour.status || "pending"}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    {/* Date/Time */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar
                        size={16}
                        className="text-purple-500 shrink-0"
                      />
                      <span className="font-semibold">
                        {formatDateCDT(tour.start_time, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <Clock
                        size={14}
                        className="text-purple-400 ml-2 shrink-0"
                      />
                      <span className="text-gray-500">
                        {formatTimeCDT(tour.start_time)}
                        {tour.tour_end_time &&
                          ` – ${formatHHMM(tour.tour_end_time)}`}
                      </span>
                    </div>

                    {/* Driver */}
                    {tour.employee_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User size={16} className="text-purple-500 shrink-0" />
                        <span className="text-gray-700 font-medium">
                          {tour.employee_name}
                        </span>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 pt-2 border-t border-purple-100">
                      <div className="flex items-center gap-1.5">
                        <Users size={16} className="text-purple-500" />
                        <span className="text-sm font-bold text-gray-700">
                          {participants.length}
                        </span>
                        <span className="text-xs text-gray-500">
                          {participants.length === 1
                            ? "participant"
                            : "participants"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-purple-500" />
                        <span className="text-sm font-bold text-gray-700">
                          {stops.length}
                        </span>
                        <span className="text-xs text-gray-500">
                          {stops.length === 1 ? "stop" : "stops"}
                        </span>
                      </div>
                    </div>

                    {/* Fee */}
                    {tour.tour_flat_fee && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign size={18} className="text-emerald-600" />
                          <span className="text-2xl font-bold text-emerald-700">
                            ${Number(tour.tour_flat_fee).toFixed(0)}
                          </span>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">
                          {tour.tour_payment_split === "divided"
                            ? "Divided"
                            : "Single"}
                        </span>
                      </div>
                    )}

                    {/* Payment Status */}
                    <div className="pt-2">
                      {tour.payment_status === "paid" ? (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200 uppercase">
                          ✓ Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 uppercase">
                          Unpaid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="px-5 pb-4">
                    <div className="text-xs text-purple-600 font-semibold group-hover:text-purple-700 flex items-center gap-1">
                      Click to review & edit
                      <span className="group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TourReviewModal */}
      {selectedTour && (
        <TourReviewModal
          tour={selectedTour}
          onClose={handleModalClose}
          onUpdated={handleModalUpdated}
        />
      )}
    </div>
  );
}
