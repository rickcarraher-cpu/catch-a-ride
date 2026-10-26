"use client";

import { useState, useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { format } from "date-fns";
import {
  X,
  Heart,
  MapPin,
  Calendar,
  User,
  Phone,
  Mail,
  DollarSign,
  Car,
  Clock,
  FileText,
  Trash2,
  Plus,
  CheckCircle,
  AlertCircle,
  Search,
  Link as LinkIcon,
  Send,
} from "lucide-react";

function toDatetimeLocal(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().slice(0, 16);
}

function toChicagoISO(datetimeLocal) {
  if (!datetimeLocal) return null;
  const chicagoOffset = -6 * 60; // CST is UTC-6
  const localDate = new Date(datetimeLocal);
  const utc = localDate.getTime() - chicagoOffset * 60 * 1000;
  return new Date(utc).toISOString();
}

const Section = ({ title, icon, children, action }) => (
  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-rose-50 border-b border-pink-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

// Add Trip Linker Component
function AddTripToWedding({ weddingId, onTripAdded }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const queryClient = useQueryClient();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a booking number or passenger name");
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/appointments/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();

      // Filter out trips already linked to this wedding
      const unlinkedTrips = (data.appointments || []).filter(
        (apt) => !apt.wedding_id || apt.wedding_id !== weddingId,
      );

      setSearchResults(unlinkedTrips);

      if (unlinkedTrips.length === 0) {
        toast.info("No unlinked trips found matching your search");
      }
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Failed to search for trips");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkTrip = async (appointmentId) => {
    setIsLinking(true);
    try {
      const res = await fetch(`/api/weddings/${weddingId}/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });

      if (!res.ok) throw new Error("Failed to link trip");

      toast.success("Trip linked to wedding");
      queryClient.invalidateQueries({ queryKey: ["weddings-list"] });
      queryClient.invalidateQueries({ queryKey: ["weddings-details"] });

      // Remove from search results
      setSearchResults((prev) => prev.filter((t) => t.id !== appointmentId));

      if (onTripAdded) onTripAdded();
    } catch (err) {
      console.error("Link trip error:", err);
      toast.error("Failed to link trip to wedding");
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by booking number or passenger name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Search size={16} />
          {isSearching ? "Searching..." : "Search"}
        </button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {searchResults.map((trip) => (
            <div
              key={trip.id}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">
                    #{trip.booking_number}
                  </span>
                  <span className="text-sm text-gray-600">
                    {trip.client_name}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(trip.start_time).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(trip.start_time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {trip.employee_name && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {trip.employee_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleLinkTrip(trip.id)}
                disabled={isLinking}
                className="px-3 py-1.5 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <LinkIcon size={14} />
                Link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WeddingReviewModal({
  wedding: initialWedding,
  onClose,
  onUpdated,
}) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    venue_name: "",
    venue_address: "",
    wedding_date: "",
    coordinator_name: "",
    coordinator_phone: "",
    coordinator_email: "",
    special_instructions: "",
    package_price: "",
    payment_status: "unpaid",
    payment_method: "",
  });

  const [trips, setTrips] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isSendingCoordinatorEmail, setIsSendingCoordinatorEmail] =
    useState(false);

  // Add state for sending coordinator summary
  const [isSendingCoordinator, setIsSendingCoordinator] = useState(false);
  // Add state for generated Square links
  const [generatedSquareLinks, setGeneratedSquareLinks] = useState([]);
  const [showLinksModal, setShowLinksModal] = useState(false);

  useEffect(() => {
    if (!initialWedding) return;

    setFormData({
      venue_name: initialWedding.venue_name || "",
      venue_address: initialWedding.venue_address || "",
      wedding_date: toDatetimeLocal(initialWedding.wedding_date),
      coordinator_name: initialWedding.coordinator_name || "",
      coordinator_phone: initialWedding.coordinator_phone || "",
      coordinator_email: initialWedding.coordinator_email || "",
      special_instructions: initialWedding.special_instructions || "",
      package_price: initialWedding.package_price || "",
      payment_status: initialWedding.payment_status || "unpaid",
      payment_method: initialWedding.payment_method || "",
    });
    setTrips(initialWedding.trips || []);
  }, [initialWedding?.id]);

  const handleSave = async () => {
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

    setIsSaving(true);
    try {
      const chicagoWeddingDate = toChicagoISO(formData.wedding_date);

      const res = await fetch(`/api/weddings/${initialWedding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: formData.venue_name,
          venue_address: formData.venue_address,
          wedding_date: chicagoWeddingDate,
          coordinator_name: formData.coordinator_name,
          coordinator_phone: formData.coordinator_phone,
          coordinator_email: formData.coordinator_email,
          special_instructions: formData.special_instructions,
          package_price: Number(formData.package_price) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update wedding");
      }

      queryClient.invalidateQueries(["weddings"]);
      toast.success("Wedding updated ✓");
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save wedding");
    } finally {
      setIsSaving(false);
    }
  };

  // Add mutation for sending coordinator summary
  const sendCoordinatorSummary = async () => {
    if (!formData.coordinator_email) {
      toast.error("No coordinator email on file");
      return;
    }

    setIsSendingCoordinator(true);
    try {
      const res = await fetch(
        `/api/weddings/${initialWedding.id}/send-coordinator-summary`,
        { method: "POST" },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send summary");
      }

      const data = await res.json();
      toast.success(
        `Summary sent to ${formData.coordinator_email} (${data.trips_count} trips)`,
      );
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to send coordinator summary");
    } finally {
      setIsSendingCoordinator(false);
    }
  };

  const handleRemoveTrip = async (tripId) => {
    if (!confirm("Remove this trip from the wedding?")) return;

    try {
      const res = await fetch(
        `/api/weddings/${initialWedding.id}/trips?appointment_id=${tripId}`,
        { method: "DELETE" },
      );

      if (!res.ok) throw new Error("Failed to remove trip");

      setTrips(trips.filter((t) => t.id !== tripId));
      toast.success("Trip removed from wedding");
      queryClient.invalidateQueries(["weddings"]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove trip");
    }
  };

  const handlePayment = async (paymentData) => {
    // If Square Invoice: generate Square links for each trip, don't mark as paid yet
    if (paymentData.payment_method === "Square Invoice") {
      setShowPaymentModal(false);
      const links = [];
      const errors = [];

      for (const trip of trips) {
        try {
          const res = await fetch(`/api/payments/trip/${trip.id}/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: "square",
              disable_tipping: false,
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            if (res.status === 409 && data.existingUrl) {
              links.push({
                tripId: trip.id,
                bookingNumber: trip.booking_number,
                url: data.existingUrl,
                amount: trip.services_total,
                reused: true,
              });
            } else {
              errors.push(
                `Trip #${trip.booking_number || trip.id}: ${data.error}`,
              );
            }
          } else {
            links.push({
              tripId: trip.id,
              bookingNumber: trip.booking_number,
              url: data.payment?.payment_url,
              amount: data.payment?.amount,
              reused: false,
            });
          }
        } catch (err) {
          errors.push(
            `Trip #${trip.booking_number || trip.id}: ${err.message}`,
          );
        }
      }

      if (errors.length > 0) {
        toast.error(`Some links failed: ${errors.join("; ")}`);
      }
      if (links.length > 0) {
        setGeneratedSquareLinks(links);
        setShowLinksModal(true);
        queryClient.invalidateQueries(["weddings"]);
        toast.success(`Generated ${links.length} Square payment link(s)!`);
      }
      return;
    }

    // All other payment methods: mark as paid immediately
    try {
      const res = await fetch(`/api/weddings/${initialWedding.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process payment");
      }

      const data = await res.json();
      toast.success(`Payment processed! ${data.trips_updated} trips updated.`);
      queryClient.invalidateQueries(["weddings"]);
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to process payment");
    }
  };

  if (!initialWedding) return null;

  const totalTripsAmount = trips.reduce(
    (sum, t) => sum + Number(t.services_total || 0),
    0,
  );
  const packagePrice = Number(formData.package_price) || 0;
  const finalAmount = packagePrice > 0 ? packagePrice : totalTripsAmount;
  const isPaid = formData.payment_status === "paid";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Heart size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">
                  Wedding Package
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isPaid
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {isPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
              <div className="text-pink-100 text-sm mt-1.5">
                {initialWedding.client_name || "No passenger assigned"}
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {/* Wedding Details */}
          <Section
            title="Wedding Details"
            icon={<Heart size={15} className="text-pink-600" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Venue Name *
                </label>
                <input
                  type="text"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.venue_name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, venue_name: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Venue Address
                </label>
                <input
                  type="text"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.venue_address}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      venue_address: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">
                  Wedding Date & Time *
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.wedding_date}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, wedding_date: e.target.value }))
                  }
                />
              </div>
            </div>
          </Section>

          {/* Coordinator Info */}
          <Section
            title="Wedding Coordinator"
            icon={<User size={15} className="text-pink-600" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.coordinator_name}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      coordinator_name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Jane Smith"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.coordinator_phone}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      coordinator_phone: e.target.value,
                    }))
                  }
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.coordinator_email}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      coordinator_email: e.target.value,
                    }))
                  }
                  placeholder="coordinator@example.com"
                />
              </div>
            </div>
          </Section>

          {/* Special Instructions */}
          <Section
            title="Special Instructions (All Drivers)"
            icon={<FileText size={15} className="text-pink-600" />}
          >
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 resize-none bg-white"
              rows={4}
              value={formData.special_instructions}
              onChange={(e) =>
                setFormData((f) => ({
                  ...f,
                  special_instructions: e.target.value,
                }))
              }
              placeholder="Any special instructions that apply to all drivers for this wedding..."
            />
          </Section>

          {/* Trips */}
          <Section
            title="Wedding Trips"
            icon={<Car size={16} className="text-pink-600" />}
          >
            {trips.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No trips assigned to this wedding yet
              </p>
            ) : (
              <div className="space-y-2">
                {trips.map((trip, idx) => (
                  <div
                    key={trip.id}
                    className="bg-pink-50 border border-pink-200 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {trip.booking_number && (
                            <span className="text-xs text-gray-500 font-mono">
                              #{trip.booking_number}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-500">Time:</span>
                            <div className="font-semibold text-gray-900">
                              {trip.start_time
                                ? format(
                                    new Date(trip.start_time),
                                    "MMM d, h:mm a",
                                  )
                                : "Not set"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Driver:</span>
                            <div className="font-semibold text-gray-900">
                              {trip.employee_name || "Unassigned"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Vehicle:</span>
                            <div className="font-semibold text-gray-900">
                              {trip.vehicle_name || "Unassigned"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Price:</span>
                            <div className="font-semibold text-emerald-700">
                              ${Number(trip.services_total || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>

                        {trip.pickup_address && (
                          <div className="mt-2 text-xs text-gray-600">
                            <MapPin size={12} className="inline mr-1" />
                            {trip.pickup_address}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemoveTrip(trip.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Pricing */}
          <Section
            title="Pricing"
            icon={<DollarSign size={15} className="text-emerald-600" />}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Package Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-pink-400 bg-white"
                  value={formData.package_price}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      package_price: e.target.value,
                    }))
                  }
                  placeholder="Leave empty to use sum of trip prices"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="space-y-2 text-sm">
                  {packagePrice > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Package price:</span>
                      <span className="font-semibold text-gray-900">
                        ${packagePrice.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-emerald-300 pt-2 flex justify-between">
                    <span className="font-bold text-emerald-900">
                      Total Amount:
                    </span>
                    <span className="text-2xl font-bold text-emerald-700">
                      ${finalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {!isPaid && trips.length > 0 && (
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="w-full px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} />
                  Pay for this wedding
                </button>
              )}

              {isPaid && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <div>
                    <div className="text-sm font-bold text-green-900">
                      Payment Complete
                    </div>
                    <div className="text-xs text-green-700">
                      Paid via {formData.payment_method} on{" "}
                      {initialWedding.payment_date
                        ? format(
                            new Date(initialWedding.payment_date),
                            "MMM d, yyyy",
                          )
                        : "Unknown"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {trips.length > 0 && formData.coordinator_email && (
              <button
                onClick={sendCoordinatorSummary}
                disabled={isSendingCoordinator}
                className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <Send size={16} />
                {isSendingCoordinator ? "Sending..." : "Send to Coordinator"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <CheckCircle size={16} />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          amount={finalAmount}
          onClose={() => setShowPaymentModal(false)}
          onConfirm={handlePayment}
        />
      )}

      {/* Square Links Modal */}
      {showLinksModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle size={20} className="text-emerald-600" />
                Square Payment Links Generated
              </h3>
              <button
                onClick={() => {
                  setShowLinksModal(false);
                  onUpdated?.();
                  onClose();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600">
                Send these links to the passenger for each trip:
              </p>
              {generatedSquareLinks.map((link) => (
                <div
                  key={link.tripId}
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {link.bookingNumber
                        ? `Trip #${link.bookingNumber}`
                        : `Trip ${link.tripId}`}
                      {link.reused && (
                        <span className="ml-2 text-xs text-blue-600">
                          (existing link)
                        </span>
                      )}
                    </span>
                    <span className="text-sm font-bold text-emerald-700">
                      ${Number(link.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={link.url || ""}
                      className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 font-mono truncate"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(link.url);
                        toast.success("Copied!");
                      }}
                      className="px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowLinksModal(false);
                  onUpdated?.();
                  onClose();
                }}
                className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentModal({ amount, onClose, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async () => {
    setIsProcessing(true);
    await onConfirm({
      payment_method: paymentMethod,
      amount: amount,
      payment_date: new Date().toISOString(),
    });
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">
            Process Wedding Payment
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-sm text-emerald-600 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-emerald-700">
              ${amount.toFixed(2)}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-400"
            >
              <option value="Cash">Cash</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Check">Check</option>
              <option value="Venmo">Venmo</option>
              <option value="Zelle">Zelle</option>
              <option value="Square Invoice">Square Invoice</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle
                size={16}
                className="text-blue-600 mt-0.5 shrink-0"
              />
              <p className="text-xs text-blue-800">
                This will mark all trips as paid and pay all drivers their
                commission.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Confirm Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
