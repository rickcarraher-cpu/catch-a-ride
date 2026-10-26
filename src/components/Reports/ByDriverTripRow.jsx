import { Pencil, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { formatDateCDT, formatTimeCDT } from "@/utils/timezone";

function getStatusStyle(status) {
  switch (status) {
    case "confirmed":
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "completed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "cancelled":
    case "canceled":
      return "bg-red-100 text-red-800 border-red-200";
    case "quote":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
}

function getPaymentBadge(trip) {
  const balanceDue = Number(trip.balance_due ?? 0);
  const ps = trip.payment_status || "unpaid";
  const todayCDT = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const tripDateCDT = new Date(trip.start_time).toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const isPastDue = balanceDue > 0 && tripDateCDT < todayCDT;

  // Trust DB payment_status first — if the record says paid, it's paid
  if (ps === "paid") {
    return (
      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
        ✓ PAID
      </span>
    );
  }

  // Check balance_due - if there's a balance, it's unpaid
  if (balanceDue > 0) {
    if (isPastDue) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-300 w-fit">
            ⚠ PAST DUE
          </span>
          <span className="text-xs font-semibold text-red-700">
            ${balanceDue.toFixed(2)}
          </span>
          {trip.payment_method && (
            <span className="text-[10px] font-medium text-gray-600">
              via {trip.payment_method}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 w-fit">
          UNPAID
        </span>
        <span className="text-xs font-semibold text-orange-700">
          ${balanceDue.toFixed(2)}
        </span>
        {trip.payment_method && (
          <span className="text-[10px] font-medium text-gray-600">
            via {trip.payment_method}
          </span>
        )}
      </div>
    );
  }

  // Fallback to payment_status for edge cases
  if (ps === "partial")
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 w-fit">
          PARTIAL
        </span>
        {balanceDue > 0 && (
          <span className="text-xs font-semibold text-orange-700">
            ${balanceDue.toFixed(2)}
          </span>
        )}
        {trip.payment_method && (
          <span className="text-[10px] font-medium text-gray-600">
            via {trip.payment_method}
          </span>
        )}
      </div>
    );
  if (ps === "link_created")
    return (
      <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
        LINK SENT
      </span>
    );
  if (ps === "manual_pending")
    return (
      <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
        PENDING
      </span>
    );

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 w-fit">
        UNPAID
      </span>
      {balanceDue > 0 && (
        <span className="text-xs font-semibold text-orange-700">
          ${balanceDue.toFixed(2)}
        </span>
      )}
      {trip.payment_method && (
        <span className="text-[10px] font-medium text-gray-600">
          via {trip.payment_method}
        </span>
      )}
    </div>
  );
}

export function ByDriverTripRow({ trip, viewMode, onEdit }) {
  const isDispatch = viewMode === "dispatch";
  const isCancelled = trip.status === "cancelled" || trip.status === "canceled";

  // Use pre-calculated values from parent component
  const fare = Number(trip.fare || 0);
  const addons = Number(trip.addons || 0);
  const regularAddons = Number(trip.regularAddons || 0);
  const gas = Math.max(0, addons - regularAddons);
  const tip = Number(trip.tip || 0);

  // Combined fare = base fare + all add-ons (incl. gas)
  const combinedFare = fare + addons;
  // Total = Combined Fare + Tip
  const tripTotal = combinedFare + tip;

  // Build breakdown shown above the fare value when add-ons exist
  const breakdownParts = [];
  if (addons > 0 || gas > 0 || regularAddons > 0) {
    breakdownParts.push(`Base`);
    if (gas > 0) breakdownParts.push(`Gas`);
    if (addons > 0) breakdownParts.push(`Addons`);
  }
  const fareBreakdown = breakdownParts.join(" + ");

  const displayDate =
    trip.display_short_date ||
    formatDateCDT(trip.start_time, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  const displayTime = trip.display_time || formatTimeCDT(trip.start_time);
  const pickupAddr = trip.pickup_street || trip.pickup_address || "";
  const dropoffAddr =
    trip.dropoff_street || trip.dropoff_address || trip.destination || "";

  return (
    <tr
      className={`hover:bg-gray-50 transition-colors ${isCancelled ? "opacity-60" : ""}`}
    >
      {/* Date & Time */}
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        <div className="font-medium text-gray-900">{displayDate}</div>
        <div className="text-xs text-blue-600 font-semibold">{displayTime}</div>
      </td>
      {/* Booking # */}
      <td className="px-3 py-2">
        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
          {trip.booking_number || "—"}
        </span>
      </td>
      {/* Passenger */}
      <td className="px-3 py-2 text-sm text-gray-900 font-medium">
        {trip.client_name || "—"}
      </td>
      {/* Status */}
      <td className="px-3 py-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded border ${getStatusStyle(trip.status)}`}
        >
          {trip.status || "pending"}
        </span>
      </td>
      {/* Pickup */}
      <td
        className="px-3 py-2 text-xs text-gray-600 max-w-[180px] truncate"
        title={pickupAddr}
      >
        {pickupAddr || "—"}
      </td>
      {/* Dropoff */}
      <td
        className="px-3 py-2 text-xs text-gray-600 max-w-[180px] truncate"
        title={dropoffAddr}
      >
        {dropoffAddr || "—"}
      </td>
      {/* Fare = base + all add-ons, with breakdown shown above */}
      <td
        className={`px-3 py-2 text-sm text-right font-semibold ${isCancelled ? "text-gray-300 line-through" : "text-gray-900"}`}
      >
        {fareBreakdown ? (
          <div className="text-xs text-gray-400 font-normal whitespace-nowrap mb-0.5">
            {fareBreakdown}
          </div>
        ) : null}
        <div>${combinedFare.toFixed(2)}</div>
      </td>
      {/* Tip */}
      <td
        className={`px-3 py-2 text-sm text-right font-semibold ${isCancelled ? "text-gray-300 line-through" : "text-green-700"}`}
      >
        {tip > 0 ? `$${tip.toFixed(2)}` : "—"}
      </td>
      {/* Total = Combined Fare + Tip */}
      <td
        className={`px-3 py-2 text-sm text-right font-bold ${isCancelled ? "text-gray-300 line-through" : "text-gray-900"}`}
      >
        ${tripTotal.toFixed(2)}
      </td>
      {/* Payment */}
      <td className="px-3 py-2 text-center">{getPaymentBadge(trip)}</td>
      {/* Payment Method */}
      <td className="px-3 py-2 text-xs text-gray-500 capitalize">
        {trip.display_payment_method || trip.payment_method || "—"}
      </td>
      {/* Actions (dispatch only) */}
      {isDispatch && (
        <td className="px-3 py-2 text-center no-print">
          <button
            onClick={() => onEdit(trip.id)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Trip"
          >
            <Pencil size={14} />
          </button>
        </td>
      )}
    </tr>
  );
}
