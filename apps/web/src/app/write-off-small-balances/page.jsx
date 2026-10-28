"use client";

import { useState, useCallback, useMemo } from "react";

function getTodayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function WriteOffSmallBalancesPage() {
  const [threshold, setThreshold] = useState("9");
  const [cutoffDate, setCutoffDate] = useState(getTodayString);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const cutoffLabel = useMemo(() => formatDateLabel(cutoffDate), [cutoffDate]);

  const handlePreview = useCallback(async () => {
    setError(null);
    setResult(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/appointments/write-off-small-balances?threshold=${encodeURIComponent(threshold)}&cutoffDate=${encodeURIComponent(cutoffDate)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }, [threshold, cutoffDate]);

  const handleApply = useCallback(async () => {
    if (!preview || preview.trips.length === 0) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        `Are you sure you want to write off ${preview.trips.length} trip(s)? This cannot be undone.`,
      );
    if (!confirmed) return;

    setError(null);
    setApplyLoading(true);
    try {
      const res = await fetch("/api/appointments/write-off-small-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold: parseFloat(threshold), cutoffDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply write-offs");
      setResult(data);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setApplyLoading(false);
    }
  }, [preview, threshold, cutoffDate]);

  const formatCurrency = (val) => `$${Number(val).toFixed(2)}`;

  const formatDate = (dt) => {
    if (!dt) return "—";
    return new Date(dt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ✏️ Write Off Small Balances
          </h1>
          <p className="text-gray-500 text-sm">
            Finds trips on or before <strong>{cutoffLabel}</strong> with a small
            remaining balance, creates a write-off transaction, and marks them
            as paid.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Cutoff Date (include trips on or before)
              </label>
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => {
                  setCutoffDate(e.target.value);
                  setPreview(null);
                  setResult(null);
                  setError(null);
                }}
                className="border border-gray-300 rounded px-3 py-2 w-44 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400">
                Only trips on or before this date will be included.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Maximum Balance Threshold
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => {
                    setThreshold(e.target.value);
                    setPreview(null);
                    setResult(null);
                    setError(null);
                  }}
                  className="border border-gray-300 rounded px-3 py-2 w-28 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <p className="text-xs text-gray-400">
                Trips with a balance between $0.01 and ${threshold || "?"} will
                be written off.
              </p>
            </div>

            <button
              onClick={handlePreview}
              disabled={previewLoading || !threshold || !cutoffDate}
              className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
            >
              {previewLoading ? "Loading…" : "🔍 Preview Affected Trips"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Preview Results */}
        {preview && (
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                Preview — {preview.trips.length} Trip
                {preview.trips.length !== 1 ? "s" : ""} Affected
              </h2>
              <span className="text-sm text-gray-400">
                Threshold: {formatCurrency(preview.threshold)}
              </span>
            </div>

            {preview.trips.length === 0 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                ✅ No trips need adjustment — all clear!
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3 font-semibold border-b">
                          Booking #
                        </th>
                        <th className="px-4 py-3 font-semibold border-b">
                          Passenger
                        </th>
                        <th className="px-4 py-3 font-semibold border-b">
                          Trip Date
                        </th>
                        <th className="px-4 py-3 font-semibold border-b text-right">
                          Original
                        </th>
                        <th className="px-4 py-3 font-semibold border-b text-right">
                          Paid
                        </th>
                        <th className="px-4 py-3 font-semibold border-b text-right text-red-600">
                          Balance Due
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.trips.map((trip, i) => (
                        <tr
                          key={trip.id}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="px-4 py-3 font-mono text-blue-700 border-b border-gray-100">
                            {trip.booking_number || `#${trip.id}`}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100">
                            {trip.client_name || "—"}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-gray-500">
                            {formatDate(trip.start_time)}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-right">
                            {formatCurrency(trip.original_amount)}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-right">
                            {formatCurrency(trip.payments_total)}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-right font-semibold text-red-600">
                            {formatCurrency(trip.balance_due)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-yellow-50">
                        <td
                          colSpan={5}
                          className="px-4 py-3 text-sm font-semibold text-gray-700"
                        >
                          Total to Write Off
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">
                          {formatCurrency(
                            preview.trips.reduce(
                              (sum, t) => sum + Number(t.balance_due),
                              0,
                            ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleApply}
                    disabled={applyLoading}
                    className="bg-red-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {applyLoading
                      ? "Applying…"
                      : `✅ Apply Write-Offs to ${preview.trips.length} Trip${preview.trips.length !== 1 ? "s" : ""}`}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    This will create a write-off transaction and mark each trip
                    as paid. This action cannot be undone.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="bg-white rounded-lg shadow-lg p-8 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-semibold text-lg">
                ✅ {result.message}
              </p>
              <p className="text-green-700 text-sm mt-1">
                Threshold used: {formatCurrency(result.threshold)}
              </p>
            </div>

            {result.trips && result.trips.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 font-semibold border-b">
                        Booking #
                      </th>
                      <th className="px-4 py-3 font-semibold border-b">
                        Passenger
                      </th>
                      <th className="px-4 py-3 font-semibold border-b">
                        Trip Date
                      </th>
                      <th className="px-4 py-3 font-semibold border-b text-right text-green-600">
                        Written Off
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trips.map((trip, i) => (
                      <tr
                        key={trip.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="px-4 py-3 font-mono text-blue-700 border-b border-gray-100">
                          {trip.booking_number || `#${trip.id}`}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100">
                          {trip.client_name || "—"}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 text-gray-500">
                          {formatDate(trip.start_time)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-semibold text-green-600">
                          {formatCurrency(trip.write_off_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-green-50">
                      <td
                        colSpan={3}
                        className="px-4 py-3 text-sm font-semibold text-gray-700"
                      >
                        Total Written Off
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        {formatCurrency(
                          result.trips.reduce(
                            (sum, t) => sum + Number(t.write_off_amount),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <button
              onClick={() => {
                setResult(null);
                setPreview(null);
                setError(null);
              }}
              className="text-blue-600 hover:text-blue-800 underline text-sm"
            >
              ← Run another write-off
            </button>
          </div>
        )}

        {/* Back link */}
        <a
          href="/trips"
          className="block text-blue-600 hover:text-blue-800 underline text-sm"
        >
          ← Back to Trips
        </a>
      </div>
    </div>
  );
}
