import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, XCircle, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTodayInCDT } from "@/utils/timezone";

export function UnifiedPaymentModal({
  trips: tripsProp,
  preselectedTripId,
  paidTripIds,
  onClose,
  onSuccess,
}) {
  const searchRef = useRef(null);
  const searchContainerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [paymentMode, setPaymentMode] = useState("manual"); // "manual" or "link"
  const [dropdownRect, setDropdownRect] = useState(null);

  const [formData, setFormData] = useState({
    method: "Cash",
    amountPaid: "",
    description: "",
    transaction_date: getTodayInCDT(),
  });

  // Fetch trips internally so search always has data, regardless of what parent passed
  const { data: internalTrips, isLoading: tripsLoading } = useQuery({
    queryKey: ["appointments-for-payment-modal"],
    queryFn: async () => {
      const res = await fetch("/api/appointments");
      if (!res.ok) throw new Error("Failed to load trips");
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Use prop trips if available and non-empty, otherwise fall back to internally fetched trips
  const trips =
    tripsProp && tripsProp.length > 0 ? tripsProp : internalTrips || [];

  // Preselect trip if provided
  useEffect(() => {
    if (preselectedTripId && trips && trips.length > 0) {
      const trip = trips.find(
        (t) => String(t.id) === String(preselectedTripId),
      );
      if (trip) {
        setSelectedTrip(trip);
      }
    }
  }, [preselectedTripId, trips]);

  // Show all trips
  const allTrips = trips || [];

  // Filter trips as user types
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const filtered = allTrips.filter((trip) => {
      const matchId = String(trip.id).includes(q);
      const matchBookingNum = trip.booking_number?.toLowerCase().includes(q);
      const matchClient = trip.client_name?.toLowerCase().includes(q);
      const matchDestination = trip.destination?.toLowerCase().includes(q);
      return matchId || matchBookingNum || matchClient || matchDestination;
    });

    setSearchResults(filtered.slice(0, 10));
  }, [searchQuery, allTrips]);

  // Update dropdown position when results change
  useEffect(() => {
    if (searchResults.length > 0 && searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      setDropdownRect(rect);
    }
  }, [searchResults]);

  // THE TRIP IS KING — read the price from the stored trip record.
  // original_amount = what the customer owes (services + any CC fee).
  // Fall back to services_total if original_amount is not populated.
  const tripPrice =
    selectedTrip != null
      ? Number(
          selectedTrip.original_amount || selectedTrip.services_total || 0,
        ) || null
      : null;

  const paid = parseFloat(formData.amountPaid) || 0;
  const tip =
    tripPrice !== null && paid > 0 ? Math.max(0, paid - tripPrice) : 0;

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, category: "payment" }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      onSuccess();
    },
    onError: () => toast.error("Could not record payment"),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ tripId, provider }) => {
      const res = await fetch(`/api/payments/trip/${tripId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate payment link");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Payment link generated!");
      // Fix: payment URL is at data.payment.payment_url, not data.payment_url
      if (data.payment?.payment_url) {
        window.open(data.payment.payment_url, "_blank");
      }
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSelectTrip = (trip) => {
    setSelectedTrip(trip);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleClearTrip = () => {
    setSelectedTrip(null);
    setFormData({ ...formData, amountPaid: "" });
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!selectedTrip) return;

    if (paymentMode === "manual") {
      mutation.mutate({
        appointment_id: selectedTrip.id,
        method: formData.method,
        amount: tripPrice !== null ? tripPrice.toFixed(2) : paid.toFixed(2),
        tip_amount: tip.toFixed(2),
        description: formData.description,
        transaction_date: formData.transaction_date,
      });
    } else {
      linkMutation.mutate({
        tripId: selectedTrip.id,
        provider: formData.method.toLowerCase(),
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {paymentMode === "manual" ? "Record Payment" : "Send Payment Link"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Trip Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Select Trip
            </label>

            {!selectedTrip ? (
              <div className="relative" ref={searchContainerRef}>
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                  {tripsLoading ? (
                    <Loader2 size={18} className="text-gray-400 animate-spin" />
                  ) : (
                    <Search size={18} className="text-gray-400" />
                  )}
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder={
                      tripsLoading
                        ? "Loading trips..."
                        : "Search by trip #, booking #, passenger, or destination..."
                    }
                    className="flex-1 bg-transparent border-none text-sm focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={tripsLoading}
                  />
                </div>
                {!tripsLoading && allTrips.length > 0 && !searchQuery && (
                  <p className="mt-1 text-xs text-gray-400">
                    {allTrips.length} trips available
                  </p>
                )}

                {/* Search results dropdown — fixed so it's never clipped by modal overflow */}
                {searchResults.length > 0 && dropdownRect && (
                  <div
                    className="bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto"
                    style={{
                      position: "fixed",
                      top: dropdownRect.bottom + 4,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                      zIndex: 9999,
                    }}
                  >
                    {searchResults.map((trip) => {
                      // THE TRIP IS KING — read price from the stored record
                      const tripTotal = Number(
                        trip.original_amount || trip.services_total || 0,
                      );
                      const tripDate = trip.start_time
                        ? new Date(trip.start_time).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : null;
                      return (
                        <button
                          key={trip.id}
                          type="button"
                          onClick={() => handleSelectTrip(trip)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900">
                              {trip.booking_number || "No booking number"}
                            </p>
                            {tripTotal > 0 ? (
                              <span className="text-sm font-bold text-blue-600">
                                ${tripTotal.toFixed(2)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-gray-600">
                              {trip.client_name}
                            </p>
                            {tripDate && (
                              <p className="text-xs text-gray-400">
                                {tripDate}
                              </p>
                            )}
                          </div>
                          {trip.destination && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              → {trip.destination}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {searchQuery.length >= 1 && searchResults.length === 0 && (
                  <div className="mt-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl px-4 py-3">
                    No trips found matching "{searchQuery}"
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-blue-700">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-semibold">Trip Selected</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearTrip}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">
                      {selectedTrip.booking_number ||
                        `Trip #${selectedTrip.id}`}
                    </p>
                    {tripPrice !== null && tripPrice > 0 && (
                      <span className="text-sm font-bold text-blue-600">
                        ${tripPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600">
                      {selectedTrip.client_name}
                    </p>
                    {selectedTrip.start_time && (
                      <p className="text-xs text-gray-500">
                        {new Date(selectedTrip.start_time).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </p>
                    )}
                  </div>
                  {selectedTrip.destination && (
                    <p className="text-xs text-gray-500">
                      → {selectedTrip.destination}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Price display — reads from trip record (THE TRIP IS KING) */}
          {selectedTrip &&
            (() => {
              const displayPrice = Number(
                selectedTrip.original_amount ||
                  selectedTrip.services_total ||
                  0,
              );
              const hasBreakdown =
                selectedTrip.cc_fee_amount > 0 ||
                Number(selectedTrip.services_total) !==
                  Number(selectedTrip.original_amount);

              return hasBreakdown ? (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Price Breakdown
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Services</span>
                    <span className="font-semibold text-gray-900">
                      ${Number(selectedTrip.services_total || 0).toFixed(2)}
                    </span>
                  </div>
                  {Number(selectedTrip.cc_fee_amount || 0) > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">CC Fee</span>
                      <span className="font-semibold text-amber-700">
                        +${Number(selectedTrip.cc_fee_amount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                    <span className="text-sm font-bold text-gray-700">
                      Total
                    </span>
                    <span className="text-lg font-bold text-blue-700">
                      ${displayPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={`px-4 py-3 rounded-xl border flex items-center justify-between ${
                    displayPrice > 0
                      ? "bg-blue-50 border-blue-100"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Trip Price
                  </span>
                  <span className="text-lg font-bold text-blue-700">
                    {displayPrice > 0 ? (
                      `$${displayPrice.toFixed(2)}`
                    ) : (
                      <span className="text-gray-400 text-sm font-medium">
                        No price set
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}

          {/* Payment Mode Toggle */}
          {selectedTrip && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Payment Type
              </label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => {
                    setPaymentMode("manual");
                    setFormData({ ...formData, method: "Cash" });
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                    paymentMode === "manual"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  💵 Manual Record
                </button>
                <button
                  onClick={() => {
                    setPaymentMode("link");
                    setFormData({ ...formData, method: "Square" });
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all ${
                    paymentMode === "link"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  🔗 Send Link
                </button>
              </div>
            </div>
          )}

          {/* Manual Payment Form */}
          {selectedTrip && paymentMode === "manual" && (
            <>
              {/* Amount Paid & auto tip */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount Paid ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.amountPaid}
                    onChange={(e) =>
                      setFormData({ ...formData, amountPaid: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tip ($)
                  </label>
                  <div
                    className={`w-full px-3 py-2 border rounded-lg text-sm font-bold ${
                      tip > 0
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400"
                    }`}
                  >
                    {tip > 0 ? `$${tip.toFixed(2)}` : "—"}
                  </div>
                  <p className="text-[10px] text-gray-400">Paid − Price</p>
                </div>
              </div>

              {/* Method & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Method
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.method}
                    onChange={(e) =>
                      setFormData({ ...formData, method: e.target.value })
                    }
                  >
                    <option value="Cash">Cash</option>
                    <option value="Farm">Farm</option>
                    <option value="Zelle">Zelle</option>
                    <option value="Venmo">Venmo</option>
                    <option value="Comp">🎁 Comp</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                    value={formData.transaction_date}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        transaction_date: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="e.g. Airport run payment"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">
                  <strong>Manual Record:</strong> For tracking payments already
                  received (cash, card reader, etc.)
                </p>
              </div>
            </>
          )}

          {/* Payment Link Form */}
          {selectedTrip && paymentMode === "link" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Payment Provider
                </label>
                <select
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                  value={formData.method}
                  onChange={(e) =>
                    setFormData({ ...formData, method: e.target.value })
                  }
                >
                  <option value="Square">Square</option>
                  <option value="Venmo">Venmo</option>
                  <option value="Zelle">Zelle</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Payment Link:</strong> Generates a secure payment link
                  and sends it to the customer via email/SMS.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              mutation.isPending ||
              linkMutation.isPending ||
              (paymentMode === "manual" && !formData.amountPaid) ||
              !selectedTrip
            }
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending || linkMutation.isPending
              ? "Processing..."
              : paymentMode === "manual"
                ? "Record Payment"
                : "Generate Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
