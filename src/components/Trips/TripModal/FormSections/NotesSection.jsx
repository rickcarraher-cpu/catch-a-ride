import { useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { FlightInfoPrompt } from "../FlightInfoPrompt";

export function NotesSection({ formData, setFormData }) {
  const [pendingCancelStatus, setPendingCancelStatus] = useState(false);
  const [showFlightPrompt, setShowFlightPrompt] = useState(false);

  // Detect if this is a one-way BNA trip
  const detectBNATrip = () => {
    const pickupLower = (
      formData.pickup_address ||
      formData.pickup_street ||
      ""
    ).toLowerCase();
    const dropoffLower = (
      formData.dropoff_address ||
      formData.dropoff_street ||
      ""
    ).toLowerCase();
    const pickupZip = formData.pickup_zip || "";
    const dropoffZip = formData.dropoff_zip || "";
    const destLower = (formData.destination || "").toLowerCase();
    const airportKeywords = ["airport", "terminal", "concourse"];

    // Check if ANY field mentions "hilton" — BNA Hilton is a hotel, not the airport
    const allText = `${pickupLower} ${dropoffLower} ${destLower}`;
    const isBNAHilton = allText.includes("hilton");

    const isPickupAtAirport =
      !isBNAHilton &&
      (airportKeywords.some((kw) => pickupLower.includes(kw)) ||
        pickupZip === "37214");
    const isDropoffAtAirport =
      !isBNAHilton &&
      (airportKeywords.some((kw) => dropoffLower.includes(kw)) ||
        dropoffZip === "37214");

    // One-way trip: either pickup OR dropoff is BNA, but not both
    return (
      (isPickupAtAirport && !isDropoffAtAirport) ||
      (!isPickupAtAirport && isDropoffAtAirport)
    );
  };

  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    if (newStatus === "confirmed" && !formData.payment_method) return;

    if (newStatus === "cancelled") {
      // Show confirmation before applying
      setPendingCancelStatus(true);
      return;
    }

    // Check if this is "approved" status on a one-way BNA trip
    if (newStatus === "approved" && detectBNATrip()) {
      // Only show flight info prompt if flight information is missing
      const hasOutgoingFlightInfo =
        formData.outgoing_flight_info && formData.outgoing_flight_info.trim();
      const hasReturningFlightInfo =
        formData.returning_flight_info && formData.returning_flight_info.trim();

      if (!hasOutgoingFlightInfo && !hasReturningFlightInfo) {
        // Show flight info prompt only if no flight info exists
        setFormData({ ...formData, status: newStatus });
        setShowFlightPrompt(true);
        return;
      }
    }

    setFormData({ ...formData, status: newStatus });
  };

  const handleConfirmCancel = () => {
    setFormData({ ...formData, status: "cancelled" });
    setPendingCancelStatus(false);
  };

  const handleDismissCancel = () => {
    setPendingCancelStatus(false);
  };

  return (
    <>
      {/* Flight Info Prompt */}
      {showFlightPrompt && (
        <FlightInfoPrompt
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowFlightPrompt(false)}
        />
      )}

      {/* Cancel Status Confirmation Dialog */}
      {pendingCancelStatus && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
                <AlertTriangle size={28} className="text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Cancel This Trip?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Are you sure you want to mark this trip as{" "}
                  <span className="font-semibold text-orange-600">
                    Cancelled
                  </span>
                  ? This will update the trip status and may trigger
                  notifications.
                </p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleDismissCancel}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Keep Trip
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors"
              >
                Yes, Cancel Trip
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Notes
        </label>
        <p className="text-xs text-gray-400 mb-1">
          For manually entered information only. System data (addresses, return
          dates) is stored in dedicated fields.
        </p>
        <textarea
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[80px]"
          placeholder="Special instructions, passenger preferences, internal notes..."
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Driver Requested
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          placeholder="Passenger's requested driver name (if any)..."
          value={formData.requested_driver_name || ""}
          onChange={(e) =>
            setFormData({ ...formData, requested_driver_name: e.target.value })
          }
        />
        <p className="text-xs text-gray-400">
          Enter the driver name the passenger requested (if they requested a
          specific driver)
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Driver Notes
        </label>
        <textarea
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[80px]"
          placeholder="Miles: "
          value={formData.driver_notes}
          onChange={(e) =>
            setFormData({ ...formData, driver_notes: e.target.value })
          }
        />
      </div>

      {/* Gift Certificate */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          🎁 Gift Certificate
        </label>
        <textarea
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[60px]"
          placeholder="Gift certificate description or code..."
          value={formData.gift_certificate || ""}
          onChange={(e) =>
            setFormData({ ...formData, gift_certificate: e.target.value })
          }
        />
        <p className="text-xs text-gray-400">
          Enter gift certificate details for this trip (code, description, etc.)
        </p>
      </div>

      {/* STATUS - moved from PassengerDriverSection to end of form */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase">
          Status
        </label>
        <select
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
          value={formData.status}
          onChange={handleStatusChange}
        >
          <option value="quote">Quote</option>
          <option value="needs_review">Needs Review</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="confirmed" disabled={!formData.payment_method}>
            Confirmed
            {!formData.payment_method ? " (requires payment method)" : ""}
          </option>
          <option value="approved">Approved (assigned by dispatcher)</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
        </select>
        {/* Tentative toggle */}
        <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            checked={!!formData.is_tentative}
            onChange={(e) =>
              setFormData({ ...formData, is_tentative: e.target.checked })
            }
          />
          <span className="text-xs font-semibold text-amber-600">
            ⚠️ Mark as Tentative
          </span>
        </label>
        {formData.is_tentative && (
          <input
            type="text"
            className="w-full mt-1 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400"
            placeholder="Reason for tentative status..."
            value={formData.tentative_reason || ""}
            onChange={(e) =>
              setFormData({ ...formData, tentative_reason: e.target.value })
            }
          />
        )}
        {formData.status === "confirmed" && !formData.payment_method && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertCircle size={12} />
            <span>Payment method required for confirmed status</span>
          </div>
        )}
        {!formData.payment_method && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <AlertCircle size={12} />
            <span>Set payment method above to enable "Confirmed" status</span>
          </div>
        )}
      </div>
    </>
  );
}
