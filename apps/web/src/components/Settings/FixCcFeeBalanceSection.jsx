"use client";

import { useState } from "react";
import {
  Search,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

export function FixCcFeeBalanceSection() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [fixResults, setFixResults] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTrips, setSelectedTrips] = useState(new Set());

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setFixResults(null);

    try {
      const response = await fetch("/api/appointments/fix-cc-fee-balance");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scan");
      }

      setScanResults(data);
      // Pre-select all affected trips
      const allIds = new Set(data.trips.map((t) => t.id));
      setSelectedTrips(allIds);
    } catch (err) {
      console.error("Scan error:", err);
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleFix = async () => {
    const tripIds = Array.from(selectedTrips);
    if (tripIds.length === 0) {
      alert("No trips selected to fix.");
      return;
    }

    if (
      !confirm(
        `Recalculate balance on ${tripIds.length} trip(s)? This will exclude CC fees from payments_total and correct the balance_due.`,
      )
    ) {
      return;
    }

    setFixing(true);
    setError(null);

    try {
      const response = await fetch("/api/appointments/fix-cc-fee-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix");
      }

      setFixResults(data);
      setScanResults(null);
    } catch (err) {
      console.error("Fix error:", err);
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const toggleTrip = (id) => {
    setSelectedTrips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!scanResults) return;
    const allIds = scanResults.trips.map((t) => t.id);
    if (selectedTrips.size === allIds.length) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set(allIds));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 leading-relaxed">
        Finds trips where CC fee transactions were incorrectly counted in
        payments_total, making the balance_due lower than it should be. Fixes
        the balance so CC fees are treated as a business cost, not a customer
        payment.
      </p>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {scanning ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Scanning trips…
          </>
        ) : (
          <>
            <Search size={16} />
            {scanResults ? "Re-scan" : "Scan for CC Fee Balance Issues"}
          </>
        )}
      </button>

      {/* Scan Results */}
      {scanResults && (
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Affected:</span>{" "}
              <span className="font-semibold text-orange-600">
                {scanResults.totalAffected}
              </span>
            </div>
          </div>

          {scanResults.trips.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  All clear!
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  No trips with CC fee balance issues found.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Select All / Fix Button */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedTrips.size === scanResults.trips.length &&
                      selectedTrips.size > 0
                    }
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                  Select all ({scanResults.trips.length})
                </label>

                <button
                  onClick={handleFix}
                  disabled={fixing || selectedTrips.size === 0}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {fixing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Fixing…
                    </>
                  ) : (
                    <>
                      <Wrench size={16} />
                      Fix Selected ({selectedTrips.size})
                    </>
                  )}
                </button>
              </div>

              {/* Trip List */}
              <div className="max-h-[400px] overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                {scanResults.trips.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTrips.has(trip.id)}
                        onChange={() => toggleTrip(trip.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">
                            #{trip.bookingNumber || trip.id}
                          </span>
                          <span className="text-xs text-gray-500">
                            {trip.passengerName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(trip.tripDate)}
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                              trip.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {trip.paymentStatus}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-600">
                          <span>
                            Original: <strong>${trip.originalAmount}</strong>
                          </span>
                          <span>
                            Payments (actual):{" "}
                            <strong>${trip.actualPayments}</strong>
                          </span>
                          <span>
                            CC Fees:{" "}
                            <strong className="text-purple-600">
                              ${trip.ccFeeTotal}
                            </strong>{" "}
                            ({trip.ccFeeCount}x)
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-1 text-xs">
                          <span className="text-red-600">
                            Current balance:{" "}
                            <strong>${trip.currentBalanceDue}</strong>{" "}
                            <span className="text-gray-400">(wrong)</span>
                          </span>
                          <span className="text-green-700">
                            Correct balance:{" "}
                            <strong>${trip.correctBalance}</strong>
                          </span>
                          <span className="text-amber-600">
                            Difference: <strong>${trip.difference}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Fix Results */}
      {fixResults && (
        <div
          className={`rounded-lg p-4 ${
            fixResults.changed > 0
              ? "bg-green-50 border border-green-200"
              : "bg-gray-50 border border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <p className="text-sm font-semibold">{fixResults.message}</p>
          </div>

          {fixResults.fixedTrips && fixResults.fixedTrips.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fixResults.fixedTrips.map((trip) => (
                <div
                  key={trip.id}
                  className="bg-white border border-green-200 rounded p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      #{trip.bookingNumber || trip.id}
                    </span>
                    <span className="text-green-700 font-semibold">
                      Balance: ${trip.before.balanceDue} → $
                      {trip.after.balanceDue}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    Payments total: ${trip.before.paymentsTotal} → $
                    {trip.after.paymentsTotal}
                  </div>
                </div>
              ))}
            </div>
          )}

          {fixResults.errorList && fixResults.errorList.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-red-700 font-semibold">Errors:</p>
              <ul className="text-xs text-red-600 list-disc list-inside">
                {fixResults.errorList.map((e) => (
                  <li key={e.id}>
                    Trip #{e.id}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleScan}
            className="mt-3 w-full px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            Re-scan to verify
          </button>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800 font-semibold mb-1.5">
          What this fixes:
        </p>
        <ul className="text-xs text-blue-700 list-disc list-inside space-y-1 ml-1">
          <li>
            <strong>CC fees counted as payments</strong> — payments_total
            incorrectly included CC fee transactions, making it look like the
            customer paid more than they did
          </li>
          <li>
            <strong>Balance too low</strong> — balance_due was reduced by the CC
            fee amount (e.g. $78.50 instead of $86.50)
          </li>
          <li>
            After fixing, CC fees remain as transactions but only actual
            customer payments reduce the balance
          </li>
        </ul>
      </div>
    </div>
  );
}
