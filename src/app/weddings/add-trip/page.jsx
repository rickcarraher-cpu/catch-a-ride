"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Heart,
  ArrowLeft,
  Search,
  Link as LinkIcon,
  CheckCircle,
  Plus,
  X,
  Car,
  Calendar,
  Clock,
  User,
  ChevronDown,
} from "lucide-react";

export default function AddTripToWeddingPage() {
  const queryClient = useQueryClient();
  const [selectedWeddingId, setSelectedWeddingId] = useState("");
  const [tripNumber, setTripNumber] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [foundTrip, setFoundTrip] = useState(null);
  const [linkedTrips, setLinkedTrips] = useState([]);
  const [notFound, setNotFound] = useState(false);

  // Read ?wedding_id= from URL on mount and pre-select
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const wid = params.get("wedding_id");
      if (wid) setSelectedWeddingId(wid);
    }
  }, []);

  // Fetch all weddings
  const { data: weddings = [], isLoading: weddingsLoading } = useQuery({
    queryKey: ["weddings-all"],
    queryFn: async () => {
      const res = await fetch("/api/weddings?window=all");
      if (!res.ok) throw new Error("Failed to fetch weddings");
      const data = await res.json();
      return data.sort(
        (a, b) => new Date(b.wedding_date) - new Date(a.wedding_date),
      );
    },
  });

  const selectedWedding = weddings.find(
    (w) => String(w.id) === String(selectedWeddingId),
  );

  const handleSearch = async () => {
    if (!selectedWeddingId) {
      toast.error("Please select a wedding first");
      return;
    }
    if (!tripNumber.trim()) {
      toast.error("Please enter a trip number");
      return;
    }

    setIsSearching(true);
    setFoundTrip(null);
    setNotFound(false);

    try {
      const res = await fetch(
        `/api/appointments/search?q=${encodeURIComponent(tripNumber.trim())}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      const trips = data.appointments || [];

      // Try exact booking number match first
      const exact = trips.find(
        (t) =>
          t.booking_number?.toLowerCase() === tripNumber.trim().toLowerCase(),
      );
      const match = exact || trips[0] || null;

      if (!match) {
        setNotFound(true);
      } else if (
        match.wedding_id &&
        String(match.wedding_id) === String(selectedWeddingId)
      ) {
        toast.info("That trip is already linked to this wedding");
        setFoundTrip(null);
      } else {
        setFoundTrip(match);
      }
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Failed to search for trip");
    } finally {
      setIsSearching(false);
    }
  };

  const handleLink = async () => {
    if (!foundTrip || !selectedWeddingId) return;

    setIsLinking(true);
    try {
      const res = await fetch(`/api/weddings/${selectedWeddingId}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: foundTrip.id }),
      });

      if (!res.ok) throw new Error("Failed to link trip");

      toast.success(`Trip #${foundTrip.booking_number} linked to wedding!`);
      setLinkedTrips((prev) => [...prev, foundTrip]);
      setFoundTrip(null);
      setTripNumber("");
      setNotFound(false);
      queryClient.invalidateQueries({ queryKey: ["weddings-all"] });
      queryClient.invalidateQueries({ queryKey: ["weddings-list"] });
      queryClient.invalidateQueries({ queryKey: ["weddings-details"] });
    } catch (err) {
      console.error("Link trip error:", err);
      toast.error("Failed to link trip to wedding");
    } finally {
      setIsLinking(false);
    }
  };

  const handleDone = () => {
    window.location.href = "/weddings";
  };

  const handleAddAnother = () => {
    setFoundTrip(null);
    setTripNumber("");
    setNotFound(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-8 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <a
            href="/weddings"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-pink-100 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Weddings
          </a>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Heart size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Add Trips to a Wedding
              </h1>
              <p className="text-pink-100 mt-1 text-sm">
                Select the wedding, enter a trip number, and keep adding until
                you're done
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Step 1: Select Wedding */}
        <div className="bg-white rounded-2xl border-2 border-pink-100 shadow-sm overflow-hidden">
          <div className="bg-pink-50 border-b border-pink-100 px-5 py-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-pink-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              1
            </span>
            <h2 className="text-sm font-bold text-gray-800">Which wedding?</h2>
          </div>
          <div className="p-5">
            {weddingsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin h-4 w-4 border-2 border-pink-400 border-r-transparent rounded-full" />
                Loading weddings...
              </div>
            ) : weddings.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">No weddings found.</p>
                <a
                  href="/weddings"
                  className="text-pink-600 text-sm font-semibold hover:underline"
                >
                  Create a wedding first →
                </a>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedWeddingId}
                  onChange={(e) => {
                    setSelectedWeddingId(e.target.value);
                    setFoundTrip(null);
                    setLinkedTrips([]);
                    setTripNumber("");
                    setNotFound(false);
                  }}
                  className="w-full px-4 py-3 border-2 border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-400 focus:border-pink-400 bg-white appearance-none pr-10 text-sm font-medium text-gray-800"
                >
                  <option value="">— Select a wedding —</option>
                  {weddings.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.venue_name} —{" "}
                      {new Date(w.wedding_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {w.client_name ? ` (${w.client_name})` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none"
                />
              </div>
            )}

            {/* Selected wedding summary */}
            {selectedWedding && (
              <div className="mt-3 bg-pink-50 border border-pink-200 rounded-xl px-4 py-3 flex items-center gap-3">
                <Heart size={16} className="text-pink-500 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {selectedWedding.venue_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(selectedWedding.wedding_date).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                    {selectedWedding.client_name
                      ? ` · ${selectedWedding.client_name}`
                      : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Enter Trip Number (only shown when wedding is selected) */}
        {selectedWeddingId && (
          <div className="bg-white rounded-2xl border-2 border-pink-100 shadow-sm overflow-hidden">
            <div className="bg-pink-50 border-b border-pink-100 px-5 py-3 flex items-center gap-2">
              <span className="w-6 h-6 bg-pink-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                2
              </span>
              <h2 className="text-sm font-bold text-gray-800">
                Enter the trip number to link
              </h2>
            </div>
            <div className="p-5">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">
                    #
                  </span>
                  <input
                    type="text"
                    value={tripNumber}
                    onChange={(e) => {
                      setTripNumber(e.target.value);
                      setFoundTrip(null);
                      setNotFound(false);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="e.g. 26-0199"
                    className="w-full pl-7 pr-4 py-3 border-2 border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-400 focus:border-pink-400 text-sm font-mono"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !tripNumber.trim()}
                  className="px-5 py-3 bg-pink-600 text-white rounded-xl hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2 text-sm font-semibold transition-colors"
                >
                  <Search size={16} />
                  {isSearching ? "Searching..." : "Find"}
                </button>
              </div>

              {/* Not Found */}
              {notFound && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                  No trip found matching <strong>#{tripNumber}</strong>.
                  Double-check the number and try again.
                </div>
              )}

              {/* Found Trip Preview */}
              {foundTrip && (
                <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        <span className="text-sm font-bold text-gray-900">
                          Trip found!
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Booking #:</span>
                          <div className="font-bold text-gray-900 font-mono">
                            #{foundTrip.booking_number}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Passenger:</span>
                          <div className="font-semibold text-gray-900">
                            {foundTrip.client_name || "Unknown"}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Date:</span>
                          <div className="font-semibold text-gray-900">
                            {new Date(foundTrip.start_time).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500">Time:</span>
                          <div className="font-semibold text-gray-900">
                            {new Date(foundTrip.start_time).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </div>
                        </div>
                        {foundTrip.employee_name && (
                          <div className="col-span-2">
                            <span className="text-gray-500">Driver:</span>
                            <div className="font-semibold text-gray-900">
                              {foundTrip.employee_name}
                            </div>
                          </div>
                        )}
                      </div>

                      {foundTrip.wedding_id &&
                        String(foundTrip.wedding_id) !==
                          String(selectedWeddingId) && (
                          <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            ⚠️ This trip is currently linked to a different
                            wedding. Linking it here will move it.
                          </div>
                        )}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={handleLink}
                      disabled={isLinking}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <LinkIcon size={16} />
                      {isLinking ? "Linking..." : "Link to Wedding"}
                    </button>
                    <button
                      onClick={() => {
                        setFoundTrip(null);
                        setTripNumber("");
                      }}
                      className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked Trips Log */}
        {linkedTrips.length > 0 && (
          <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 border-b border-green-200 px-5 py-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-600" />
              <h2 className="text-sm font-bold text-gray-800">
                {linkedTrips.length} trip{linkedTrips.length !== 1 ? "s" : ""}{" "}
                added this session
              </h2>
            </div>
            <div className="p-4 space-y-2">
              {linkedTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"
                >
                  <CheckCircle size={14} className="text-green-600 shrink-0" />
                  <span className="text-sm font-mono font-bold text-gray-900">
                    #{trip.booking_number}
                  </span>
                  {trip.client_name && (
                    <span className="text-sm text-gray-600">
                      · {trip.client_name}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(trip.start_time).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done / Add Another */}
        {selectedWeddingId && (
          <div className="flex gap-3">
            {linkedTrips.length > 0 && (
              <button
                onClick={handleAddAnother}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-pink-300 text-pink-700 text-sm font-semibold rounded-xl hover:bg-pink-50 transition-colors"
              >
                <Plus size={16} />
                Add Another Trip
              </button>
            )}
            <button
              onClick={handleDone}
              className={`flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-colors ${
                linkedTrips.length > 0
                  ? "bg-pink-600 text-white hover:bg-pink-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } ${linkedTrips.length > 0 ? "" : "flex-1"}`}
            >
              <CheckCircle size={16} />
              {linkedTrips.length > 0 ? "Done" : "Back to Weddings"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
