import React from "react";
import {
  X,
  Calendar,
  Clock,
  User,
  MapPin,
  CreditCard,
  FileText,
  Pencil,
  Trash2,
  CheckCircle,
  DollarSign,
  Phone,
  Mail,
  Plane,
  Briefcase,
  MessageSquare,
  Receipt,
  Heart,
  Eye,
} from "lucide-react";

function buildPickupAddress(trip) {
  const parts = [trip.pickup_street, trip.pickup_city].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return trip.pickup_address || null;
}

function buildDropoffAddress(trip) {
  const parts = [trip.dropoff_street, trip.dropoff_city].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return trip.dropoff_address || null;
}

function tripDisplayDate(trip) {
  if (trip.display_long_date) return trip.display_long_date;
  if (!trip.start_time) return "—";
  return new Date(trip.start_time).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function tripDisplayTime(trip) {
  if (trip.display_time) return trip.display_time;
  if (!trip.start_time) return "—";
  return new Date(trip.start_time).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function TripDetailPanel({
  trip,
  onClose,
  onEdit,
  onDelete,
  onInvoice,
  onPay,
  onSendThankYou,
}) {
  if (!trip) return null;

  const pickupAddress = buildPickupAddress(trip);
  const dropoffAddress = buildDropoffAddress(trip);

  const isReturnTrip = (trip.notes || "").toLowerCase().includes("return trip");
  const destLower = (trip.destination || "").toLowerCase();
  const isAirportDest = ["bna", "terminal", "airport", "concourse"].some((kw) =>
    destLower.includes(kw),
  );
  const toDisplay =
    isReturnTrip && isAirportDest
      ? buildDropoffAddress(trip) || trip.destination
      : trip.destination || dropoffAddress;

  // Trust DB payment_status as source of truth
  const isPaid = trip.payment_status === "paid";

  const bookedByDisplay =
    trip.booked_by === "Online" || trip.booked_by === "Passenger"
      ? "Online Booking"
      : trip.booker_name
        ? trip.booker_name
        : trip.booked_by === "Admin"
          ? "Admin"
          : trip.booked_by || "—";

  const bookingDate = trip.created_at
    ? new Date(trip.created_at).toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
      })
    : null;
  const bookingTime = trip.created_at
    ? new Date(trip.created_at).toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between border-b border-blue-800">
          <div>
            <h2 className="text-xl font-bold text-white">Trip Details</h2>
            {trip.booking_number && (
              <p className="text-sm text-blue-100 font-mono mt-0.5">
                {trip.booking_number}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Banner */}
          {trip.status === "cancelled" && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-sm font-bold text-red-700 uppercase">
                ⚠️ This trip has been cancelled
              </span>
            </div>
          )}

          {/* Date & Time */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Date & Time</h3>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {tripDisplayDate(trip)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Clock size={16} className="text-gray-400" />
              <p className="text-base font-semibold text-gray-700">
                {tripDisplayTime(trip)}
              </p>
            </div>
          </div>

          {/* Passenger Info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <User size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Passenger</h3>
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">
              {trip.client_name || "—"}
            </p>
            {trip.client_phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Phone size={14} />
                <span>{trip.client_phone}</span>
              </div>
            )}
            {trip.client_email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} />
                <span>{trip.client_email}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {trip.client_is_new_passenger && (
                <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                  ✨ New Passenger
                </span>
              )}
              {trip.referral_source && (
                <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">
                  📍 Referred: {trip.referral_source}
                </span>
              )}
              {isReturnTrip && (
                <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Return Trip
                </span>
              )}
              {trip.gift_certificate && (
                <span className="text-xs font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  🎁 Gift Certificate
                </span>
              )}
            </div>
          </div>

          {/* Driver Info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Driver</h3>
            </div>
            {trip.employee_id ? (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: trip.employee_color || "#2563EB" }}
                >
                  {trip.employee_name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">
                    {trip.employee_name}
                  </p>
                  {trip.vehicle_name && (
                    <p className="text-sm text-gray-500">
                      🚗 {trip.vehicle_name}
                    </p>
                  )}
                  {trip.vehicle_category && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Preferred: {trip.vehicle_category}
                    </p>
                  )}
                </div>
              </div>
            ) : trip.requested_driver_name ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-300 flex items-center justify-center text-white font-bold">
                  {trip.requested_driver_name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-semibold text-amber-700">
                    {trip.requested_driver_name}
                  </p>
                  <p className="text-sm text-gray-500">(Requested)</p>
                </div>
              </div>
            ) : (
              <p className="text-orange-600 font-medium italic">Unassigned</p>
            )}
          </div>

          {/* Route */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Route</h3>
            </div>
            {pickupAddress && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Pickup
                </p>
                <p className="text-sm text-gray-700">{pickupAddress}</p>
              </div>
            )}
            {toDisplay && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Destination
                </p>
                <p className="text-sm font-semibold text-indigo-700">
                  {toDisplay}
                </p>
              </div>
            )}
            {trip.distance_miles && (
              <p className="text-xs text-gray-500 mt-2">
                Distance: {trip.distance_miles} miles
              </p>
            )}
          </div>

          {/* Flight Info */}
          {(trip.outgoing_flight_info || trip.returning_flight_info) && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Plane size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-900">Flight Info</h3>
              </div>
              {trip.outgoing_flight_info && (
                <div className="mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Outgoing
                  </p>
                  <p className="text-sm text-gray-700">
                    {trip.outgoing_flight_info}
                  </p>
                </div>
              )}
              {trip.returning_flight_info && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    Return
                  </p>
                  <p className="text-sm text-gray-700">
                    {trip.returning_flight_info}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Status */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Payment</h3>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Status</span>
              {trip.payment_status === "paid" ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle size={14} />
                  PAID
                </span>
              ) : (trip.balance_due ?? 0) > 0 ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200">
                  UNPAID
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200">
                  UNPAID
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Balance Due</span>
              <span className="text-lg font-bold text-gray-900">
                ${Number(trip.balance_due || 0).toFixed(2)}
              </span>
            </div>
            {trip.payment_method && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Method</span>
                <span className="text-sm font-medium text-gray-700">
                  {trip.payment_method}
                </span>
              </div>
            )}
            {Number(trip.tips_total || 0) > 0 && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Tips</span>
                <span className="text-sm font-semibold text-green-700">
                  +${Number(trip.tips_total).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Booking Info */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={18} className="text-blue-600" />
              <h3 className="font-semibold text-gray-900">Booking Info</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Booked By</span>
                <span
                  className={`font-medium ${bookedByDisplay === "Online Booking" ? "text-purple-700" : "text-gray-700"}`}
                >
                  {bookedByDisplay}
                </span>
              </div>
              {trip.booked_by_dispatcher && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Dispatcher</span>
                  <span className="font-medium text-gray-700">
                    {trip.booked_by_dispatcher}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Booked On</span>
                <span className="text-gray-700">
                  {bookingDate ? `${bookingDate}, ${bookingTime}` : bookingTime}
                </span>
              </div>
              {trip.is_tentative && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    ⚠️ Tentative
                  </span>
                  {trip.tentative_reason && (
                    <p className="text-xs text-gray-600 mt-1">
                      {trip.tentative_reason}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {trip.notes && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {trip.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              onClose();
              onEdit(trip.id);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Pencil size={16} />
            Edit Trip
          </button>

          {trip.booking_number && (
            <a
              href={`/booking/${trip.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Eye size={16} />
              View Booking
            </a>
          )}

          {!isPaid && (
            <button
              onClick={() => {
                onClose();
                onPay(trip.id);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <CreditCard size={16} />
              Pay
            </button>
          )}

          {isPaid && !trip.thankyou_sent_at && onSendThankYou && (
            <button
              onClick={() => {
                onClose();
                onSendThankYou(trip.id);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition-colors"
            >
              <Heart size={16} />
              Send Thank You
            </button>
          )}

          <a
            href={`/receipt/${trip.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Receipt size={16} />
            Receipt
          </a>

          <button
            onClick={() => {
              onClose();
              onInvoice(trip.id);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText size={16} />
            Invoice
          </button>

          <button
            onClick={() => {
              onClose();
              onDelete(trip);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors ml-auto"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>
    </>
  );
}
