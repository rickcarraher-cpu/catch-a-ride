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
import WeddingReviewModal from "@/components/Weddings/WeddingReviewModal";

export default function WeddingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedWedding, setSelectedWedding] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch all weddings
  const { data: weddingsRaw = [], isLoading } = useQuery({
    queryKey: ["weddings-list"],
    queryFn: async () => {
      const res = await fetch(`/api/weddings?window=all`);
      if (!res.ok) throw new Error("Failed to fetch weddings");
      return res.json();
    },
  });

  const weddingIds = useMemo(() => weddingsRaw.map((w) => w.id), [weddingsRaw]);

  // Fetch full details (including trips) for all weddings
  const { data: weddingsWithDetails = [] } = useQuery({
    queryKey: ["weddings-details", weddingIds],
    queryFn: async () => {
      const promises = weddingsRaw.map(async (w) => {
        const res = await fetch(`/api/weddings/${w.id}`);
        if (!res.ok) return w;
        return res.json();
      });
      return Promise.all(promises);
    },
    enabled: weddingIds.length > 0,
  });

  const weddings =
    weddingsWithDetails.length > 0 ? weddingsWithDetails : weddingsRaw;

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

  const handleWeddingClick = (wedding) => setSelectedWedding(wedding);
  const handleModalClose = () => setSelectedWedding(null);
  const handleModalUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ["weddings-list"] });
    queryClient.invalidateQueries({ queryKey: ["weddings-details"] });
  };

  const paymentBadge = (status) =>
    status === "paid"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-yellow-50 text-yellow-700 border-yellow-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <a
            href="/dashboard"
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
                href="/weddings/add-trip"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition-all shadow-md"
              >
                <Plus size={18} />
                Add Trips
              </a>
              <button
                onClick={() => setShowCreateModal(true)}
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
                      href={`/weddings/add-trip?wedding_id=${wedding.id}`}
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

      {/* Wedding Review Modal */}
      {selectedWedding && (
        <WeddingReviewModal
          wedding={selectedWedding}
          onClose={handleModalClose}
          onUpdated={handleModalUpdated}
        />
      )}

      {/* Create Wedding Modal */}
      {showCreateModal && (
        <CreateWeddingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["weddings-list"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Create Wedding Modal ──────────────────────────────────────────────────────
function CreateWeddingModal({ onClose, onCreated }) {
  const [formData, setFormData] = useState({
    venue_name: "",
    venue_address: "",
    wedding_date: "",
    coordinator_name: "",
    coordinator_phone: "",
    coordinator_email: "",
    special_instructions: "",
    package_price: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/weddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create wedding");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Wedding package created!");
      onCreated();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = () => {
    if (!formData.venue_name.trim()) {
      toast.error("Venue name is required");
      return;
    }
    if (!formData.wedding_date) {
      toast.error("Wedding date is required");
      return;
    }
    if (!formData.coordinator_name.trim()) {
      toast.error("Coordinator name is required");
      return;
    }
    if (!formData.coordinator_email.trim()) {
      toast.error("Coordinator email is required");
      return;
    }
    if (!formData.coordinator_phone.trim()) {
      toast.error("Coordinator phone is required");
      return;
    }
    createMutation.mutate({
      ...formData,
      package_price: Number(formData.package_price) || 0,
    });
  };

  const field = (key) => ({
    value: formData[key],
    onChange: (e) => setFormData((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart size={22} className="text-white" />
            <h2 className="text-lg font-bold text-white">
              New Wedding Package
            </h2>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Venue Name <span className="text-red-500">*</span>
              </label>
              <input
                {...field("venue_name")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="The Grand Ballroom"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Venue Address
              </label>
              <input
                {...field("venue_address")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="123 Main St, Nashville, TN"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Wedding Date <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                {...field("wedding_date")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Coordinator Name <span className="text-red-500">*</span>
              </label>
              <input
                {...field("coordinator_name")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Coordinator Phone <span className="text-red-500">*</span>
              </label>
              <input
                {...field("coordinator_phone")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="(615) 555-0123"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Coordinator Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                {...field("coordinator_email")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="jane@venue.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Package Price ($)
              </label>
              <input
                type="number"
                {...field("package_price")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Special Instructions (All Drivers)
              </label>
              <textarea
                {...field("special_instructions")}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400 resize-none"
                rows={3}
                placeholder="Any special instructions for all drivers..."
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="px-5 py-2.5 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle size={15} />
            {createMutation.isPending ? "Creating..." : "Create Wedding"}
          </button>
        </div>
      </div>
    </div>
  );
}
