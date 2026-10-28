import { useState } from "react";
import {
  CreditCard,
  Search,
  Wrench,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
} from "lucide-react";

const severityColors = {
  high: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    badge: "bg-red-100 text-red-800",
  },
  medium: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-800",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-800",
  },
};

const issueTypeLabels = {
  balance_equals_cc_fee: "Balance = CC Fee",
  stale_cached_totals: "Stale Cached Totals",
  paid_with_small_balance: "Paid w/ Leftover",
  negative_balance: "Negative Balance",
  original_includes_cc_fee: "Original Includes Fee",
  cc_fee_amount_wrong: "CC Fee Amount Wrong",
};

export function FixCreditCardFeesSection() {
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
      const response = await fetch("/api/admin/fix-credit-card-fees");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to scan");
      }

      setScanResults(data);
      // Pre-select all fixable trips
      const fixableIds = new Set(
        data.trips.filter((t) => t.isFixable).map((t) => t.id),
      );
      setSelectedTrips(fixableIds);
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
        `Fix ${tripIds.length} trip(s)? This will remove CC fee transactions, recalculate balances, and mark trips as paid where appropriate.`,
      )
    ) {
      return;
    }

    setFixing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/fix-credit-card-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripIds }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix");
      }

      setFixResults(data);
      setScanResults(null); // Clear scan to show fix results
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!scanResults) return;
    const fixableIds = scanResults.trips
      .filter((t) => t.isFixable)
      .map((t) => t.id);
    if (selectedTrips.size === fixableIds.length) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set(fixableIds));
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
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <CreditCard size={16} />
            Credit Card Fee Cleanup
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Scan for trips with CC fee balance issues, preview what will be
            fixed, then apply.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Scan Button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {scanning ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Scanning all trips...
          </>
        ) : (
          <>
            <Search size={16} />
            {scanResults ? "Re-scan Trips" : "Scan for CC Fee Issues"}
          </>
        )}
      </button>

      {/* Scan Results */}
      {scanResults && (
        <div className="space-y-3">
          {/* Summary Bar */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500">Scanned:</span>{" "}
              <span className="font-semibold">{scanResults.totalScanned}</span>
            </div>
            <div>
              <span className="text-gray-500">Issues found:</span>{" "}
              <span className="font-semibold text-orange-600">
                {scanResults.totalWithIssues}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Fixable:</span>{" "}
              <span className="font-semibold text-green-600">
                {scanResults.totalFixable}
              </span>
            </div>
            <div>
              <span className="text-gray-500">CC Fee Rate:</span>{" "}
              <span className="font-semibold">{scanResults.feePercent}%</span>
            </div>
          </div>

          {scanResults.trips.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">
                  All clear!
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  No trips with credit card fee balance issues found.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Select All / Fix Button Row */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      selectedTrips.size ===
                        scanResults.trips.filter((t) => t.isFixable).length &&
                      selectedTrips.size > 0
                    }
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                  Select all fixable ({scanResults.totalFixable})
                </label>

                <button
                  onClick={handleFix}
                  disabled={fixing || selectedTrips.size === 0}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {fixing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Fixing...
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
              <div className="max-h-[500px] overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2">
                {scanResults.trips.map((trip) => {
                  const worstSeverity = trip.issues.reduce((worst, issue) => {
                    const order = { high: 3, medium: 2, info: 1 };
                    return order[issue.severity] > order[worst]
                      ? issue.severity
                      : worst;
                  }, "info");
                  const colors = severityColors[worstSeverity];

                  return (
                    <div
                      key={trip.id}
                      className={`${colors.bg} ${colors.border} border rounded-lg p-3`}
                    >
                      <div className="flex items-start gap-3">
                        {trip.isFixable && (
                          <input
                            type="checkbox"
                            checked={selectedTrips.has(trip.id)}
                            onChange={() => toggleTrip(trip.id)}
                            className="mt-1 rounded border-gray-300"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-gray-900">
                              {trip.bookingNumber
                                ? `#${trip.bookingNumber}`
                                : `Trip ${trip.id}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {trip.passengerName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(trip.tripDate)}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${trip.paymentStatus === "paid" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
                            >
                              {trip.paymentStatus}
                            </span>
                          </div>

                          {/* Financial Summary */}
                          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-600">
                            <span>
                              Original: <strong>${trip.originalAmount}</strong>
                            </span>
                            <span>
                              Services: <strong>${trip.servicesTotal}</strong>
                            </span>
                            <span>
                              Payments: <strong>${trip.paymentsTotal}</strong>
                            </span>
                            <span>
                              Balance:{" "}
                              <strong
                                className={
                                  parseFloat(trip.balanceDue) > 0
                                    ? "text-red-600"
                                    : parseFloat(trip.balanceDue) < 0
                                      ? "text-orange-600"
                                      : "text-green-600"
                                }
                              >
                                ${trip.balanceDue}
                              </strong>
                            </span>
                            {parseFloat(trip.ccFeeTotal) > 0 && (
                              <span>
                                CC Fees:{" "}
                                <strong className="text-purple-600">
                                  ${trip.ccFeeTotal}
                                </strong>{" "}
                                ({trip.ccFeeCount}x)
                              </span>
                            )}
                          </div>

                          {/* Issues */}
                          <div className="mt-2 space-y-1">
                            {trip.issues.map((issue, idx) => {
                              const issueColors =
                                severityColors[issue.severity];
                              return (
                                <div
                                  key={idx}
                                  className="flex items-start gap-1.5"
                                >
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${issueColors.badge}`}
                                  >
                                    {issueTypeLabels[issue.type] || issue.type}
                                  </span>
                                  <span
                                    className={`text-xs ${issueColors.text}`}
                                  >
                                    {issue.description}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Fix Results */}
      {fixResults && (
        <div
          className={`rounded-lg p-4 ${fixResults.fixedCount > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-green-600" />
            <p className="text-sm font-semibold">
              {fixResults.fixedCount === 0
                ? "No trips needed fixing"
                : `Fixed ${fixResults.fixedCount} trip${fixResults.fixedCount === 1 ? "" : "s"}`}
            </p>
          </div>

          {fixResults.fixedTrips && fixResults.fixedTrips.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fixResults.fixedTrips.map((trip, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-green-200 rounded p-3 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {trip.bookingNumber
                          ? `#${trip.bookingNumber}`
                          : `Trip ${trip.id}`}
                      </span>
                      <span className="text-gray-500 ml-2">
                        {trip.passengerName}
                      </span>
                    </div>
                    <span className="text-green-700 font-semibold">
                      Final balance: ${trip.finalBalance}
                    </span>
                  </div>

                  {trip.issues && trip.issues.length > 0 && (
                    <div className="text-gray-500">
                      <strong>Issues:</strong> {trip.issues.join(" · ")}
                    </div>
                  )}

                  <div className="text-green-700">
                    <strong>Actions:</strong>
                    <ul className="list-disc list-inside ml-1 mt-0.5 space-y-0.5">
                      {trip.actions.map((action, aIdx) => (
                        <li key={aIdx}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Re-scan after fix */}
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
          What this tool detects:
        </p>
        <ul className="text-xs text-blue-700 list-disc list-inside space-y-1 ml-1">
          <li>
            <strong>CC Fee Amount Wrong</strong> — CC fee stored without
            rounding (e.g. $2.64 instead of $3.00); corrects the transaction
            amount to close the balance
          </li>
          <li>
            <strong>Balance = CC Fee</strong> — Trip balance is only the CC fee;
            removes fee and marks paid
          </li>
          <li>
            <strong>Stale Cached Totals</strong> — payments_total doesn&apos;t
            match actual transactions; recalculates
          </li>
          <li>
            <strong>Paid w/ Leftover</strong> — Trip marked paid but small
            balance remains; adjusts original amount
          </li>
          <li>
            <strong>Negative Balance</strong> — Overpaid (CC fee likely
            double-counted); removes duplicate fees
          </li>
          <li>
            <strong>Original Includes Fee</strong> — Informational; original
            amount includes the CC fee (may be correct)
          </li>
        </ul>
      </div>
    </div>
  );
}
