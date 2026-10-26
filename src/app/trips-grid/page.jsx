"use client";

import React, { useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Calendar,
  User,
  MapPin,
  DollarSign,
  Clock,
  Edit,
  Trash2,
  FileText,
  CreditCard,
  Heart,
  X,
  Plane,
  Briefcase,
  Car,
  StickyNote,
  Receipt,
} from "lucide-react";
import { formatDateTimeCDT } from "@/utils/timezone";
import { PageWithBackButton } from "@/components/PageWithBackButton";

const UnifiedPaymentModal = lazy(() =>
  import("@/components/UnifiedPaymentModal").then((m) => ({
    default: m.UnifiedPaymentModal,
  })),
);
const InvoiceModal = lazy(() =>
  import("@/components/Trips/InvoiceModal").then((m) => ({
    default: m.InvoiceModal,
  })),
);
const DeleteTripModal = lazy(() =>
  import("@/components/Trips/DeleteTripModal").then((m) => ({
    default: m.DeleteTripModal,
  })),
);

export default function TripsGridPage() {
  const queryClient = useQueryClient();
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [paymentTripId, setPaymentTripId] = useState(null);
  const [invoiceTripId, setInvoiceTripId] = useState(null);
  const [deletingTrip, setDeletingTrip] = useState(null);
  const [sendingThankYou, setSendingThankYou] = useState(null);

  // Fetch trips
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const res = await fetch("/api/appointments");
      if (!res.ok) throw new Error("Failed to load trips");
      return res.json();
    },
  });

  // Fetch clients for lookup
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
  });

  // Fetch drivers for lookup
  const { data: drivers = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json();
    },
  });

  // Fetch vehicles for lookup
  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to load vehicles");
      return res.json();
    },
  });

  // Send thank you follow-up
  const handleSendThankYou = async (tripId) => {
    if (
      !confirm(
        "Send thank you follow-up to passenger? This will hide the trip from the main list.",
      )
    )
      return;
    setSendingThankYou(tripId);
    try {
      const res = await fetch("/api/followup/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      if (!res.ok) throw new Error("Failed to send thank you");
      toast.success("Thank you sent!");
      queryClient.invalidateQueries(["appointments"]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSendingThankYou(null);
    }
  };

  // Download receipt
  const handleDownloadReceipt = (tripId) => {
    window.open(`/receipt/${tripId}`, "_blank");
  };

  const getClientName = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || "Unknown";
  };

  const getDriverName = (driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    return driver?.name || "Unassigned";
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    return vehicle?.name || "—";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading trips...</div>
      </div>
    );
  }

  return (
    <PageWithBackButton title="Trips Grid View">
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              All Trips ({trips.length})
            </h1>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTrip(trip)}
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs opacity-90 mb-1">
                        {trip.booking_number || `#${trip.id}`}
                      </div>
                      <div className="font-semibold text-lg">
                        {getClientName(trip.client_id)}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trip.payment_status === "paid"
                          ? "bg-green-500"
                          : trip.payment_status === "partial"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                    >
                      {trip.payment_status || "unpaid"}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Date/Time */}
                  <div className="flex items-center text-sm text-gray-700">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{formatDateTimeCDT(trip.start_time)}</span>
                  </div>

                  {/* Driver */}
                  <div className="flex items-center text-sm text-gray-700">
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    <span>{getDriverName(trip.employee_id)}</span>
                  </div>

                  {/* Vehicle */}
                  {trip.vehicle_id && (
                    <div className="flex items-center text-sm text-gray-700">
                      <Car className="w-4 h-4 mr-2 text-gray-400" />
                      <span>{getVehicleName(trip.vehicle_id)}</span>
                    </div>
                  )}

                  {/* Destination */}
                  <div className="flex items-start text-sm text-gray-700">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                    <span className="flex-1 truncate">
                      {trip.destination || trip.dropoff_address || "—"}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center text-sm font-semibold text-gray-900">
                    <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                    <span>${Number(trip.services_total || 0).toFixed(2)}</span>
                    {trip.balance_due > 0 && (
                      <span className="ml-2 text-xs text-red-600">
                        (${Number(trip.balance_due).toFixed(2)} due)
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="flex items-center text-sm">
                    <Clock className="w-4 h-4 mr-2 text-gray-400" />
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        trip.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : trip.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {trip.status || "pending"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-wrap gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTrip(trip);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors"
                  >
                    <Edit className="w-3 h-3" />
                    View
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaymentTripId(trip.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 transition-colors"
                  >
                    <CreditCard className="w-3 h-3" />
                    Pay
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvoiceTripId(trip.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white text-xs font-medium rounded hover:bg-purple-600 transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    Invoice
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadReceipt(trip.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded hover:bg-indigo-600 transition-colors"
                  >
                    <Receipt className="w-3 h-3" />
                    Receipt
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendThankYou(trip.id);
                    }}
                    disabled={sendingThankYou === trip.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-pink-500 text-white text-xs font-medium rounded hover:bg-pink-600 transition-colors disabled:opacity-50"
                  >
                    <Heart className="w-3 h-3" />
                    {sendingThankYou === trip.id ? "Sending..." : "Thank You"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingTrip(trip);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trip Detail Modal */}
      {selectedTrip && (
        <TripDetailModal
          trip={selectedTrip}
          clients={clients}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => setSelectedTrip(null)}
        />
      )}

      {/* Payment Modal */}
      {paymentTripId && (
        <Suspense fallback={<div>Loading...</div>}>
          <UnifiedPaymentModal
            tripId={paymentTripId}
            onClose={() => {
              setPaymentTripId(null);
              queryClient.invalidateQueries(["appointments"]);
            }}
          />
        </Suspense>
      )}

      {/* Invoice Modal */}
      {invoiceTripId && (
        <Suspense fallback={<div>Loading...</div>}>
          <InvoiceModal
            tripId={invoiceTripId}
            onClose={() => setInvoiceTripId(null)}
          />
        </Suspense>
      )}

      {/* Delete Modal */}
      {deletingTrip && (
        <Suspense fallback={<div>Loading...</div>}>
          <DeleteTripModal
            trip={deletingTrip}
            onClose={() => setDeletingTrip(null)}
            onDeleted={() => {
              queryClient.invalidateQueries(["appointments"]);
              setDeletingTrip(null);
            }}
          />
        </Suspense>
      )}
    </PageWithBackButton>
  );
}

// Trip Detail Modal - Grid view of all fields
function TripDetailModal({ trip, clients, drivers, vehicles, onClose }) {
  const client = clients.find((c) => c.id === trip.client_id);
  const driver = drivers.find((d) => d.id === trip.employee_id);
  const vehicle = vehicles.find((v) => v.id === trip.vehicle_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Trip Details</h2>
            <p className="text-sm opacity-90 mt-1">
              {trip.booking_number || `Trip #${trip.id}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body - Grid Layout */}
        <div className="p-6 space-y-6">
          {/* Passenger Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Passenger Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Name
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {client?.name || "Unknown"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Phone
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {client?.phone || "—"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Email
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {client?.email || "—"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  # of People
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {trip.num_people || "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Trip Details */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Trip Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pickup Time
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {formatDateTimeCDT(trip.start_time)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </label>
                <p className="text-sm mt-1">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      trip.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : trip.status === "cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {trip.status || "pending"}
                  </span>
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Pickup Address
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {trip.pickup_address || trip.departure_location || "—"}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Dropoff Address / Destination
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {trip.dropoff_address || trip.destination || "—"}
                </p>
              </div>
              {trip.return_date && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Return Date
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    {formatDateTimeCDT(trip.return_date)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Driver & Vehicle */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Driver & Vehicle
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Driver
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {driver?.name || "Unassigned"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Vehicle
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {vehicle?.name || "—"}
                </p>
              </div>
              {trip.vehicle_category && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Vehicle Category
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    {trip.vehicle_category}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Flight & Baggage */}
          {(trip.outgoing_flight_info ||
            trip.returning_flight_info ||
            trip.num_bags_checked ||
            trip.num_bags_carry_on) && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Plane className="w-5 h-5 text-blue-600" />
                Flight & Baggage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                {trip.outgoing_flight_info && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Outgoing Flight
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {trip.outgoing_flight_info}
                    </p>
                  </div>
                )}
                {trip.returning_flight_info && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Returning Flight
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {trip.returning_flight_info}
                    </p>
                  </div>
                )}
                {trip.num_bags_checked > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Checked Bags
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {trip.num_bags_checked}
                    </p>
                  </div>
                )}
                {trip.num_bags_carry_on > 0 && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Carry-On Bags
                    </label>
                    <p className="text-sm text-gray-900 mt-1">
                      {trip.num_bags_carry_on}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Payment Information */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Payment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Services Total
                </label>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  ${Number(trip.services_total || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Payment Status
                </label>
                <p className="text-sm mt-1">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      trip.payment_status === "paid"
                        ? "bg-green-100 text-green-700"
                        : trip.payment_status === "partial"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {trip.payment_status || "unpaid"}
                  </span>
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Payments Total
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  ${Number(trip.payments_total || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Balance Due
                </label>
                <p
                  className={`text-sm font-semibold mt-1 ${
                    trip.balance_due > 0 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  ${Number(trip.balance_due || 0).toFixed(2)}
                </p>
              </div>
              {trip.payment_method && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Payment Method
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    {trip.payment_method}
                  </p>
                </div>
              )}
              {trip.tips_total > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tips Total
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    ${Number(trip.tips_total).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}
          {(trip.notes || trip.driver_notes) && (
            <section>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-blue-600" />
                Notes
              </h3>
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                {trip.notes && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Office Notes
                    </label>
                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                      {trip.notes}
                    </p>
                  </div>
                )}
                {trip.driver_notes && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Driver Notes
                    </label>
                    <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
                      {trip.driver_notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Additional Fields */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Booked By
                </label>
                <p className="text-sm text-gray-900 mt-1">
                  {trip.booked_by || "—"}
                </p>
              </div>
              {trip.booker_name && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Booker Name
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    {trip.booker_name}
                  </p>
                </div>
              )}
              {trip.distance_miles && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Distance (miles)
                  </label>
                  <p className="text-sm text-gray-900 mt-1">
                    {trip.distance_miles}
                  </p>
                </div>
              )}
              {trip.is_tentative && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Tentative
                  </label>
                  <p className="text-sm text-yellow-600 font-medium mt-1">
                    Yes {trip.tentative_reason && `(${trip.tentative_reason})`}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
