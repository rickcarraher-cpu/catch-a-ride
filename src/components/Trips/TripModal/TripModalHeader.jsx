import { XCircle, CheckCircle, AlertCircle, Heart } from "lucide-react";

export function TripModalHeader({
  isEditing,
  isTentative,
  onClose,
  bookingNumber,
  startTime,
  displayLongDate,
  passengerConfirmed,
  driverAccepted,
  queueInfo,
  tripStatus,
  lastModifiedBy,
  weddingId,
}) {
  // Use pre-computed display field; fall back to local calculation only if missing
  const formattedDate =
    displayLongDate ||
    (startTime
      ? new Date(startTime).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null);

  return (
    <div className="p-6 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? "Edit Trip" : "New Trip"}
          </h2>
          {isEditing && bookingNumber && (
            <p className="text-xs font-bold text-blue-600 tracking-wider mt-0.5">
              #{bookingNumber}
            </p>
          )}
          {isEditing && formattedDate && (
            <p className="text-xs text-gray-500 mt-0.5">{formattedDate}</p>
          )}
          {isEditing && lastModifiedBy && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last edited by: {lastModifiedBy}
            </p>
          )}
          {queueInfo && (
            <p className="text-xs font-semibold text-amber-600 tracking-wide mt-1">
              📋 Reviewing {queueInfo.current} of {queueInfo.total}
            </p>
          )}
        </div>
        {/* Wedding badge */}
        {weddingId && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200 uppercase tracking-wide inline-flex items-center gap-1">
            <Heart size={11} />
            Wedding Trip
          </span>
        )}
        {isTentative && (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
            ⚠️ Tentative
          </span>
        )}
        {/* Passenger confirmation badge */}
        {passengerConfirmed === "confirmed" && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
            <CheckCircle size={11} />
            Passenger Confirmed
          </span>
        )}
        {passengerConfirmed === "cancelled" && tripStatus === "cancelled" && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
            <AlertCircle size={11} />
            Passenger Cancelled
          </span>
        )}
        {/* Driver acceptance badge */}
        {driverAccepted === "accepted" && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1">
            <CheckCircle size={11} />
            Driver Accepted
          </span>
        )}
        {driverAccepted === "declined" && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
            <AlertCircle size={11} />
            Driver Declined
          </span>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <XCircle size={24} />
      </button>
    </div>
  );
}
