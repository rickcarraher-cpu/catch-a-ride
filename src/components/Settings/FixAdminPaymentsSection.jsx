import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Search,
  CheckCircle,
  XCircle,
  Loader,
} from "lucide-react";

export function FixAdminPaymentsSection() {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [trips, setTrips] = useState(null);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  async function handleScan() {
    setScanning(true);
    setError(null);
    setResults(null);
    setSelected([]);
    setConfirmed(false);
    try {
      const res = await fetch("/api/admin/fix-admin-payments");
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setTrips(data.trips || []);
      // Pre-select all by default
      setSelected((data.trips || []).map((t) => t.appointment_id));
    } catch (err) {
      console.error(err);
      setError(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function toggleSelect(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAll() {
    if (!trips) return;
    if (selected.length === trips.length) {
      setSelected([]);
    } else {
      setSelected(trips.map((t) => t.appointment_id));
    }
  }

  async function handleFix() {
    if (!selected.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fix-admin-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_ids: selected, dry_run: false }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setResults(data);
      setTrips(null);
      setSelected([]);
      setConfirmed(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Fix failed");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setTrips(null);
    setSelected([]);
    setResults(null);
    setError(null);
    setConfirmed(false);
  }

  const hasDone = !!results;
  const hasTrips = trips !== null;

  return (
    <div className="bg-white border border-orange-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Revert Admin-Fix Payments
        </h3>
      </div>

      <p className="text-xs text-gray-500">
        Scans for trips where the admin "force-paid" tool was accidentally
        applied. These trips have extra transactions marked{" "}
        <code className="bg-gray-100 px-1 rounded">(admin fix)</code> that
        inflate the payment totals. Select which trips to revert — this removes
        the duplicated transactions and recalculates the correct balance.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <XCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results after fix */}
      {hasDone && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>{results.message}</strong>
            </span>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 font-semibold text-gray-700">
              Results ({results.results?.length})
            </div>
            <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {results.results?.map((r) => (
                <div
                  key={r.appointment_id}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900">
                      {r.booking_number || `#${r.appointment_id}`}
                    </span>
                    {r.removed_amount != null && (
                      <span className="ml-2 text-gray-500">
                        removed ${parseFloat(r.removed_amount).toFixed(2)} (
                        {r.removed_transactions} txn
                        {r.removed_transactions !== 1 ? "s" : ""})
                      </span>
                    )}
                  </div>
                  <div>
                    {r.status === "fixed" && (
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                        ✓ Fixed
                      </span>
                    )}
                    {r.status === "no_fix_transactions" && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                        No fix txns
                      </span>
                    )}
                    {r.status === "not_found" && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">
                        Not found
                      </span>
                    )}
                    {r.status === "error" && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        Error
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Scan Again
          </button>
        </div>
      )}

      {/* Trip list for selection */}
      {hasTrips && !hasDone && (
        <div className="space-y-3">
          {trips.length === 0 ? (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                <strong>All clear!</strong> No admin-fix transactions found.
              </span>
            </div>
          ) : (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    Trips with admin-fix transactions ({trips.length})
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selected.length === trips.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                </div>
                <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                  {trips.map((trip) => {
                    const isSelected = selected.includes(trip.appointment_id);
                    return (
                      <label
                        key={trip.appointment_id}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? "bg-orange-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(trip.appointment_id)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-900">
                            {trip.booking_number}
                          </span>
                          <span className="ml-2 text-gray-500">
                            {trip.client_name}
                          </span>
                          <span className="ml-2 text-gray-400">
                            {trip.start_time
                              ? new Date(trip.start_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    timeZone: "America/Chicago",
                                  },
                                )
                              : ""}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0 space-y-0.5">
                          <div className="text-gray-500">
                            Orig:{" "}
                            <strong>
                              $
                              {parseFloat(trip.original_amount || 0).toFixed(2)}
                            </strong>{" "}
                            · Paid:{" "}
                            <strong className="text-orange-600">
                              ${parseFloat(trip.payments_total || 0).toFixed(2)}
                            </strong>
                          </div>
                          <div className="text-gray-400">
                            {trip.fix_count} fix txn
                            {trip.fix_count != 1 ? "s" : ""} = $
                            {parseFloat(trip.fix_total || 0).toFixed(2)} extra
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Confirm checkbox before allowing fix */}
              {selected.length > 0 && (
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                  />
                  <span className="text-xs text-gray-600">
                    I understand this will permanently delete the admin-fix
                    transactions for <strong>{selected.length}</strong> trip
                    {selected.length !== 1 ? "s" : ""} and recalculate their
                    payment totals. This cannot be undone (take a backup first
                    if unsure).
                  </span>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                {selected.length > 0 && (
                  <button
                    onClick={handleFix}
                    disabled={loading || !confirmed}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader size={14} className="animate-spin" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        Revert {selected.length} Trip
                        {selected.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Scan button (initial state) */}
      {!hasTrips && !hasDone && (
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {scanning ? (
            <>
              <Loader size={14} className="animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search size={14} />
              Scan for Admin-Fix Transactions
            </>
          )}
        </button>
      )}
    </div>
  );
}
