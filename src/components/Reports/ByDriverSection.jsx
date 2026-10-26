import React from "react";
import { ByDriverTripRow } from "./ByDriverTripRow";

const TH =
  "px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50";

// Header row rendered above each trip
function TripHeaderRow({ isDispatch }) {
  return (
    <tr className="bg-gray-50 border-t-2 border-gray-200">
      <th className={TH}>Date & Time</th>
      <th className={TH}>Booking #</th>
      <th className={TH}>Passenger</th>
      <th className={TH}>Status</th>
      <th className={TH}>Pickup</th>
      <th className={TH}>Dropoff</th>
      <th className={`${TH} text-right`}>Fare</th>
      <th className={`${TH} text-right`}>Tip</th>
      <th className={`${TH} text-right`}>Total</th>
      <th className={`${TH} text-center`}>Payment</th>
      <th className={TH}>Method</th>
      {isDispatch && <th className={`${TH} text-center no-print`}>Edit</th>}
    </tr>
  );
}

export function ByDriverSection({
  driver,
  trips,
  totalFare,
  totalTip,
  totalAddons,
  cancelledCount,
  activeCount,
  viewMode,
  onEditTrip,
}) {
  const combinedFareTotal = totalFare + (totalAddons || 0);
  const driverGrandTotal = combinedFareTotal + totalTip;
  const isDispatch = viewMode === "dispatch";

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Driver Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
        style={{
          backgroundColor: driver.color + "10",
          borderLeftWidth: "4px",
          borderLeftColor: driver.color,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: driver.color }}
          >
            {driver.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{driver.name}</h3>
            <p className="text-xs text-gray-500">
              {trips.length} trip{trips.length !== 1 ? "s" : ""} ({activeCount}{" "}
              active, {cancelledCount} cancelled) • Fare: $
              {combinedFareTotal.toFixed(2)} • Tip: ${totalTip.toFixed(2)} •
              Total: ${driverGrandTotal.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* One mini-table per trip so headers repeat above each trip */}
      <div className="overflow-x-auto divide-y divide-gray-200">
        {trips.map((trip) => (
          <table key={trip.id} className="w-full text-left">
            <thead>
              <TripHeaderRow isDispatch={isDispatch} />
            </thead>
            <tbody>
              <ByDriverTripRow
                trip={trip}
                viewMode={viewMode}
                onEdit={onEditTrip}
              />
            </tbody>
          </table>
        ))}
      </div>

      {/* Driver totals footer */}
      <div className="bg-gray-50 border-t-2 border-gray-300 overflow-x-auto">
        <table className="w-full text-left">
          <tfoot>
            <tr>
              <td
                colSpan={6}
                className="px-3 py-2 text-sm font-bold text-gray-900 text-right"
              >
                {driver.name} Total:
              </td>
              <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                ${combinedFareTotal.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-sm font-bold text-green-700 text-right">
                ${totalTip.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">
                ${driverGrandTotal.toFixed(2)}
              </td>
              <td colSpan={isDispatch ? 3 : 2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
