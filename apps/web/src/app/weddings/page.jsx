import AdvancedReviewDetails from "@/components/AdvancedReviewDetails";
import {loadAdvanced} from "../../../app/preview/advanced-fetch";
"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Heart,
  Search,
  Calendar,
  Clock,
  User,
  DollarSign,
  MapPin,
  ArrowLeft,
  X,
  Car,
  Plus,
  CheckCircle,
} from "lucide-react";
import { formatDateCDT } from "@/utils/timezone";


export default function WeddingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedWedding, setSelectedWedding] = useState(null);

  const {data:weddings=[],isLoading,error}=useQuery({queryKey:['advanced-weddings'],queryFn:()=>loadAdvanced('weddings'),retry:false});
  // Filter by search
  const filteredWeddings = useMemo(() => {
    if (!search.trim()) return weddings;
    const q = search.toLowerCase().trim();
    return weddings.filter((w) => {
      return (
        (w.venue_name || "").toLowerCase().includes(q) ||
        (w.client_name || "").toLowerCase().includes(q) ||
        (w.coordinator_name || "").toLowerCase().includes(q)
      );
    });
  }, [weddings, search]);

  // Sort by wedding_date descending (newest first)
  const sortedWeddings = useMemo(() => {
    return [...filteredWeddings].sort(
      (a, b) => new Date(b.wedding_date) - new Date(a.wedding_date),
    );
  }, [filteredWeddings]);

  const handleWeddingClick=(record)=>setSelectedWedding(record);
  const paymentBadge = (status) =>
    status === "paid"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-yellow-50 text-yellow-700 border-yellow-200";

  if(error)return <p role="alert">{error.message} — review unavailable.</p>;
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <a
            href="/preview/database"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-pink-100 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Heart size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Wedding Packages
                </h1>
                <p className="text-pink-100 mt-1">
                  {sortedWeddings.length} wedding
                  {sortedWeddings.length !== 1 ? "s" : ""} found
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                aria-disabled="true" title="Wedding trip creation disconnected"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-all shadow-md"
              >
                <Plus size={18} />
                Add Trips
              </a>
              <button
                disabled title="Creation not connected"
                className="flex items-center gap-2 px-4 py-2.5 bg-white text-pink-700 text-sm font-semibold rounded-xl hover:bg-pink-50 transition-all shadow-md"
              >
                <Plus size={18} />
                New Wedding
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-6 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-6">
          <div className="relative">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400"
              size={22}
            />
            <input
              type="text"
              placeholder="Search by client, venue, or coordinator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-4 border-2 border-pink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base bg-pink-50/30"
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

      {/* Weddings Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-12 w-12 border-4 border-pink-600 border-r-transparent rounded-full" />
          </div>
        ) : sortedWeddings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-pink-200">
            <Heart size={56} className="mx-auto text-pink-300 mb-4" />
            <p className="text-gray-600 font-semibold text-lg">
              {search ? "No weddings match your search" : "No weddings found"}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Click "New Wedding" to create your first wedding package
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sortedWeddings.map((wedding) => {
              const trips = wedding.trips || [];

              return (
                <div
                  key={wedding.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleWeddingClick(wedding);
                  }}
                  className="bg-white rounded-2xl border-2 border-pink-100 hover:border-pink-300 hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-bold text-lg truncate">
                          {wedding.client_name || "Unknown Client"}
                        </div>
                        {wedding.venue_name && (
                          <div className="text-pink-100 text-xs mt-1 truncate">
                            💒 {wedding.venue_name}
                          </div>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${paymentBadge(wedding.payment_status)}`}
                      >
                        {wedding.payment_status === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4">
                    {/* Wedding Date */}
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={16} className="text-pink-500 shrink-0" />
                      <span className="font-semibold">
                        {formatDateCDT(wedding.wedding_date, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Coordinator */}
                    {wedding.coordinator_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User size={16} className="text-pink-500 shrink-0" />
                        <span className="text-gray-700 font-medium">
                          {wedding.coordinator_name}
                        </span>
                      </div>
                    )}

                    {/* Venue Address */}
                    {wedding.venue_address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin size={16} className="text-pink-500 shrink-0" />
                        <span className="text-gray-500 truncate">
                          {wedding.venue_address}
                        </span>
                      </div>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 pt-2 border-t border-pink-100">
                      <div className="flex items-center gap-1.5">
                        <Car size={16} className="text-pink-500" />
                        <span className="text-sm font-bold text-gray-700">
                          {trips.length}
                        </span>
                        <span className="text-xs text-gray-500">
                          {trips.length === 1 ? "trip" : "trips"}
                        </span>
                      </div>
                    </div>

                    {/* Package Price */}
                    {wedding.package_price > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign size={18} className="text-emerald-600" />
                          <span className="text-2xl font-bold text-emerald-700">
                            ${Number(wedding.package_price).toFixed(0)}
                          </span>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">
                          Package
                        </span>
                      </div>
                    )}

                    {/* Payment Status */}
                    <div className="pt-2">
                      {wedding.payment_status === "paid" ? (
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
                    <div className="text-xs text-pink-600 font-semibold group-hover:text-pink-700 flex items-center gap-1">
                      Click to review & edit
                      <span className="group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </div>
                  </div>
                  {/* Add: "Add Trips" quick link at bottom of card */}
                  <div className="px-5 pb-4 pt-0 flex justify-end">
                    <a
                      aria-disabled="true" title="Wedding trip creation disconnected"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 text-pink-700 text-xs font-semibold rounded-lg hover:bg-pink-200 transition-colors"
                    >
                      <Plus size={12} />
                      Add Trips
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedWedding&&<AdvancedReviewDetails record={selectedWedding} onClose={()=>setSelectedWedding(null)}/>}
    </div>
  );
}
