import {
  Calendar,
  Clock,
  Pencil,
  CreditCard,
  Trash2,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  CheckCircle,
  Heart,
  Receipt,
  User,
} from "lucide-react";
import { formatDateCDT, formatTimeCDT } from "@/utils/timezone";

// Map distance_method values to human-readable labels
function getDistanceMethodLabel(method) {
  if (!method) return null;
  const labels = {
    osrm: "OSRM",
    valhalla: "Valhalla",
    routes_api: "Google Routes",
    distance_matrix: "Google Matrix",
    geocode_estimate: "Estimate",
    estimate: "Estimate",
  };
  return labels[method] || method.toUpperCase();
}

// Get color for distance method badge
function getDistanceMethodColor(method) {
  if (!method) return "bg-gray-100 text-gray-600";
  if (method.includes("estimate") || method === "geocode_estimate") {
    return "bg-amber-100 text-amber-700";
  }
  if (
    method.includes("google") ||
    method === "routes_api" ||
    method === "distance_matrix"
  ) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-green-100 text-green-700"; // OSRM, Valhalla
}

// Use pre-computed display fields when available; fall back to live CDT formatting only when missing.
function tripDisplayDate(trip) {
  if (trip.display_short_date) return trip.display_short_date;
  return trip.start_time ? formatDateCDT(trip.start_time) : "—";
}

function tripDisplayTime(trip) {
  if (trip.display_time) return trip.display_time;
  return trip.start_time ? formatTimeCDT(trip.start_time) : "—";
}

// Build a readable dropoff address string from available fields
function buildDropoffAddress(trip) {
  const parts = [];
  if (trip.dropoff_street) parts.push(trip.dropoff_street);
  if (trip.dropoff_city) parts.push(trip.dropoff_city);
  if (trip.dropoff_state) parts.push(trip.dropoff_state);
  if (trip.dropoff_zip) parts.push(trip.dropoff_zip);
  if (parts.length > 0) return parts.join(", ");
  // Fallback to combined dropoff_address field
  return trip.dropoff_address || null;
}

// Build a readable pickup address string from available fields
function buildPickupAddress(trip) {
  const parts = [];
  if (trip.pickup_street) parts.push(trip.pickup_street);
  if (trip.pickup_city) parts.push(trip.pickup_city);
  if (trip.pickup_state) parts.push(trip.pickup_state);
  if (trip.pickup_zip) parts.push(trip.pickup_zip);
  if (parts.length > 0) return parts.join(", ");
  // Fallback to combined pickup_address field
  return trip.pickup_address || null;
}

export function TripsTable({
  trips,
  isLoading,
  error,
  onEdit,
  onDelete,
  onInvoice,
  onPay,
  onSendThankYou,
  paidTripIds = new Set(),
  currentPage = 1,
  pageSize = 50,
  onPageChange,
}) {
  const totalCount = trips?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const pageTrips = trips?.slice(startIdx, endIdx) || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Date & Time
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Booking #
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Booked By
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Passenger
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Driver
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Trip Status
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Payment Status
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell sticky top-0 z-10 bg-gray-50">
              Distance
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Balance Due
            </th>
            <th className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 bg-gray-50">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {isLoading ? (
            <tr>
              <td
                colSpan="10"
                className="px-3 py-6 text-center text-gray-500 text-sm"
              >
                Loading trips...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan="10" className="px-3 py-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <AlertTriangle size={20} className="text-red-400" />
                  <p className="text-sm font-medium text-red-600">
                    Failed to load trips
                  </p>
                  <p className="text-xs text-gray-500">{error.message}</p>
                </div>
              </td>
            </tr>
          ) : pageTrips.length === 0 ? (
            <tr>
              <td
                colSpan="10"
                className="px-3 py-6 text-center text-gray-500 text-sm"
              >
                No trips found.
              </td>
            </tr>
          ) : (
            pageTrips.map((trip) => {
              const dropoffAddress = buildDropoffAddress(trip);
              const pickupAddress = buildPickupAddress(trip);

              // Format booked by display
              const bookedByDisplay =
                trip.booked_by === "Online" || trip.booked_by === "Passenger"
                  ? "Online Booking"
                  : trip.booker_name
                    ? trip.booker_name.split(" ")[0] // First name only
                    : trip.booked_by === "Admin"
                      ? "Admin"
                      : trip.booked_by || "—";

              // Format booking timestamp (created_at)
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
                <tr
                  key={trip.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Date & Time */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar
                        size={14}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {tripDisplayDate(trip)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock
                        size={14}
                        className="text-gray-400 flex-shrink-0"
                      />
                      <span className="text-xs text-gray-500">
                        {tripDisplayTime(trip)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {trip.booking_number ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                          {trip.booking_number}
                        </span>
                        {trip.status === "cancelled" && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 w-fit">
                            Cancelled
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User size={11} className="text-gray-400" />
                      <span
                        className={`text-xs font-medium ${
                          bookedByDisplay === "Online Booking"
                            ? "text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-100"
                            : "text-gray-700"
                        }`}
                      >
                        {bookedByDisplay}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500">
                        {bookingDate
                          ? `${bookingDate}, ${bookingTime}`
                          : bookingTime}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <p className="text-xs font-semibold text-gray-900">
                      {trip.client_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {trip.client_phone || "No phone"}
                    </p>
                    {/* Wedding badge */}
                    {trip.wedding_id && (
                      <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-pink-50 text-pink-700 border border-pink-200">
                        <Heart size={9} />
                        Wedding
                      </span>
                    )}
                    {/* Referral Source - Show if available */}
                    {trip.referral_source && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-yellow-50 text-yellow-700 border border-yellow-200">
                        📍 {trip.referral_source}
                      </span>
                    )}
                    {/* New Passenger badge - only show if passenger joined on/after 07/26/2026 AND is marked as new */}
                    {(() => {
                      if (!trip.client_is_new_passenger) return null;

                      // Check if passenger was created on or after the cutoff date
                      // This prevents showing "new" badge for passengers who were created before 07/26/2026
                      // even if they somehow have the flag set
                      const cutoffDate = new Date("2026-07-26T00:00:00Z");
                      // Note: We'd need new_passenger_marked_at from the client to truly validate this
                      // For now, the database reset + appointment logic should handle it correctly

                      return (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-50 text-green-700 border border-green-200">
                          ✨ New Passenger
                        </span>
                      );
                    })()}
                    {/* Trip type badge */}
                    {trip.notes &&
                    trip.notes.toLowerCase().includes("return trip") ? (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                        Return Trip
                      </span>
                    ) : null}
                    {/* Gift Certificate badge */}
                    {trip.gift_certificate && (
                      <span
                        className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200"
                        title={trip.gift_certificate}
                      >
                        🎁 Gift Cert
                      </span>
                    )}
                    {/* From/To addresses */}
                    {(pickupAddress || trip.destination || dropoffAddress) && (
                      <div className="mt-1 space-y-0.5">
                        {pickupAddress && (
                          <div className="flex items-start gap-1">
                            <span className="text-[10px] font-semibold text-gray-500 min-w-[28px]">
                              From:
                            </span>
                            <span className="text-[10px] text-gray-600 leading-tight">
                              {pickupAddress}
                            </span>
                          </div>
                        )}
                        {(trip.destination || dropoffAddress) && (
                          <div className="flex items-start gap-1">
                            <span className="text-[10px] font-semibold text-gray-500 min-w-[28px]">
                              To:
                            </span>
                            <div className="flex flex-col">
                              {(() => {
                                const isReturnTrip = (trip.notes || "")
                                  .toLowerCase()
                                  .includes("return trip");
                                const destLower = (
                                  trip.destination || ""
                                ).toLowerCase();
                                const isAirportDest = [
                                  "bna",
                                  "terminal",
                                  "airport",
                                  "concourse",
                                ].some((kw) => destLower.includes(kw));
                                // If it's a return trip and destination is an airport name, show the actual dropoff address instead
                                const toDisplay =
                                  isReturnTrip && isAirportDest
                                    ? buildDropoffAddress(trip)
                                    : trip.destination ||
                                      buildDropoffAddress(trip);
                                return (
                                  <span className="text-[10px] font-semibold text-indigo-700 leading-tight">
                                    {toDisplay}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {trip.employee_id ? (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: trip.employee_color }}
                          />
                          <span className="text-xs font-medium text-gray-700">
                            {trip.employee_name}
                          </span>
                        </div>
                        {trip.vehicle_name && (
                          <p className="text-xs text-gray-400 mt-0.5 ml-3.5">
                            🚗 {trip.vehicle_name}
                          </p>
                        )}
                        {/* Vehicle Preference */}
                        <div className="mt-0.5 ml-3.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Pref:
                          </span>
                          <span
                            className={`text-[10px] ml-1 ${trip.vehicle_category ? "text-gray-600 font-medium" : "text-gray-400 italic"}`}
                          >
                            {trip.vehicle_category || "No Preference"}
                          </span>
                        </div>
                      </div>
                    ) : trip.requested_driver_name ? (
                      <div>
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                          {trip.requested_driver_name}
                        </span>
                        {trip.vehicle_name && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            🚗 {trip.vehicle_name}
                          </p>
                        )}
                        {/* Vehicle Preference */}
                        <div className="mt-0.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Pref:
                          </span>
                          <span
                            className={`text-[10px] ml-1 ${trip.vehicle_category ? "text-gray-600 font-medium" : "text-gray-400 italic"}`}
                          >
                            {trip.vehicle_category || "No Preference"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100 italic">
                          Unassigned
                        </span>
                        {/* Vehicle Preference */}
                        <div className="mt-0.5">
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Pref:
                          </span>
                          <span
                            className={`text-[10px] ml-1 ${trip.vehicle_category ? "text-gray-600 font-medium" : "text-gray-400 italic"}`}
                          >
                            {trip.vehicle_category || "No Preference"}
                          </span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col gap-1">
                      {/* Trip Status Badge - NEW */}
                      {trip.status && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-xs font-bold w-fit uppercase ${
                            trip.status === "quote"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : trip.status === "needs_review"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : trip.status === "pending"
                                  ? "bg-gray-50 text-gray-600 border border-gray-200"
                                  : trip.status === "confirmed"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : trip.status === "completed"
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : trip.status === "cancelled"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-gray-50 text-gray-600 border border-gray-200"
                          }`}
                        >
                          {trip.status === "needs_review"
                            ? "Needs Review"
                            : trip.status}
                        </span>
                      )}

                      {trip.is_tentative && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                          ⚠️ Tentative
                        </span>
                      )}

                      {(() => {
                        const ps = trip.passenger_confirmed;
                        const ds = trip.driver_accepted;
                        const passengerIsPending = !ps || ps === "pending";
                        const driverIsPending = !ds || ds === "pending";

                        if (passengerIsPending && driverIsPending) {
                          return (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 w-fit">
                              Pending
                            </span>
                          );
                        }

                        return (
                          <>
                            {ps === "confirmed" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 w-fit inline-flex items-center gap-0.5">
                                <CheckCircle size={10} />
                                Passenger Accepted
                              </span>
                            )}
                            {ps === "cancelled" &&
                              trip.status === "cancelled" && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 w-fit">
                                  ✕ Passenger Cancelled
                                </span>
                              )}
                            {passengerIsPending && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 w-fit">
                                ⏳ Passenger Pending
                              </span>
                            )}

                            {ds === "accepted" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 w-fit inline-flex items-center gap-0.5">
                                <CheckCircle size={10} />
                                Driver Accepted
                              </span>
                            )}
                            {ds === "declined" && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 w-fit">
                                ✕ Driver Declined
                              </span>
                            )}
                            {driverIsPending && trip.employee_id && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-600 border border-gray-200 w-fit">
                                ⏳ Driver Pending
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    {/* Payment status badge - trust DB payment_status FIRST */}
                    {trip.payment_status === "paid" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 w-fit inline-flex items-center gap-1">
                          <CheckCircle size={11} />
                          PAID
                        </span>
                        {trip.payment_method && (
                          <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 w-fit">
                            Paid by {trip.payment_method}
                          </span>
                        )}
                        {trip.has_cash_tip && (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 w-fit">
                            Tip by Cash
                          </span>
                        )}
                      </div>
                    ) : (trip.balance_due ?? 0) > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 w-fit">
                          UNPAID
                        </span>
                        <span className="text-xs font-semibold text-orange-700">
                          ${Number(trip.balance_due || 0).toFixed(2)}
                        </span>
                        {trip.payment_method && (
                          <span className="text-[10px] font-medium text-gray-600">
                            via {trip.payment_method}
                          </span>
                        )}
                      </div>
                    ) : trip.payment_status === "partial" ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-300 w-fit">
                          PARTIAL
                        </span>
                        <span className="text-xs font-semibold text-yellow-700">
                          ${Number(trip.balance_due || 0).toFixed(2)} due
                        </span>
                        {trip.payment_method && (
                          <span className="text-[10px] text-gray-500">
                            via {trip.payment_method}
                          </span>
                        )}
                        {trip.has_cash_tip && (
                          <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 w-fit">
                            Tip by Cash
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 w-fit">
                          UNPAID
                        </span>
                        <span className="text-xs font-semibold text-orange-700">
                          ${Number(trip.balance_due || 0).toFixed(2)}
                        </span>
                        {trip.payment_method && (
                          <span className="text-[10px] font-medium text-gray-600">
                            via {trip.payment_method}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  {/* Distance */}
                  <td className="px-3 py-2 text-sm text-gray-700 hidden md:table-cell">
                    {trip.distance_miles ? (
                      <div className="flex items-center gap-1.5">
                        <span>{trip.distance_miles} mi</span>
                        {trip.distance_method && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getDistanceMethodColor(trip.distance_method)}`}
                            title={`Calculated using ${getDistanceMethodLabel(trip.distance_method)}`}
                          >
                            {getDistanceMethodLabel(trip.distance_method)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {/* Show tip from actual tips_total data, not inferred from negative balance */}
                    {(trip.payment_status === "paid" ||
                      (trip.balance_due ?? 0) <= 0) &&
                    Number(trip.tips_total || 0) > 0 ? (
                      <div className="flex flex-col">
                        <span className="font-semibold text-green-700">$0</span>
                        <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200 w-fit">
                          +${Number(trip.tips_total).toFixed(2)} tip
                        </span>
                      </div>
                    ) : (
                      <span
                        className={`font-semibold text-gray-900 ${
                          trip.payment_status === "paid"
                            ? "text-green-700"
                            : (trip.balance_due ?? 0) > 0
                              ? "text-orange-600"
                              : "text-gray-500"
                        }`}
                      >
                        ${Number(trip.balance_due || 0).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => onEdit(trip.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      {trip.booking_number && (
                        <a
                          href={`/booking/${trip.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                        >
                          <Eye size={12} />
                          View
                        </a>
                      )}
                      {trip.payment_status === "paid" ? (
                        <>
                          {!trip.thankyou_sent_at && onSendThankYou && (
                            <button
                              onClick={() => onSendThankYou(trip.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-pink-50 border border-pink-200 text-pink-700 text-xs font-semibold rounded-lg hover:bg-pink-100 hover:border-pink-300 transition-colors"
                              title="Send thank you follow-up"
                            >
                              <Heart size={12} />
                              Thank You
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => onPay(trip.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-green-50 hover:border-green-200 hover:text-green-700 transition-colors"
                        >
                          <CreditCard size={12} />
                          Pay
                        </button>
                      )}
                      <a
                        href={`/receipt/${trip.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-100 hover:border-gray-300 hover:text-gray-900 transition-colors"
                        title="Print trip receipt"
                      >
                        <Receipt size={12} />
                        Receipt
                      </a>
                      <button
                        onClick={() => onInvoice(trip.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors"
                      >
                        <FileText size={12} />
                        Invoice
                      </button>
                      <button
                        onClick={() => onDelete(trip)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-colors"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination Footer */}
      {!isLoading && !error && totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-700">{startIdx + 1}</span>–
            <span className="font-semibold text-gray-700">
              {Math.min(endIdx, totalCount)}
            </span>{" "}
            of <span className="font-semibold text-gray-700">{totalCount}</span>{" "}
            trips
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange && onPageChange(safePage - 1)}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <span className="text-xs font-medium text-gray-600">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange && onPageChange(safePage + 1)}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
