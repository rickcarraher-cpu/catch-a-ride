"use client";

import { useState, useCallback } from "react";

function formatDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(val) {
  return `$${Number(val || 0).toFixed(2)}`;
}

export default function FixPaidStatusPage() {
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handlePreview = useCallback(async () => {
    setError(null);
    setResult(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/appointments/fix-paid-status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!preview || preview.trips.length === 0) return;
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        `Mark ${preview.trips.length} trip(s) as paid? Stale payment links will be superseded. This cannot be undone.`,
      );
    if (!confirmed) return;

    setError(null);
    setApplyLoading(true);
    try {
      const res = await fetch("/api/appointments/fix-paid-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to apply fixes");
      setResult(data);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setApplyLoading(false);
    }
  }, [preview]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ✅ Fix Trips Paid in Full
          </h1>
          <p className="text-gray-500 text-sm">
            Finds trips where the passenger's money was received in full
            (payments + tips) but the trip is still not marked paid — typically
            Venmo trips where the gas-fee portion was recorded as a tip. Then
            recalculates totals and marks them paid.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition text-sm"
          >
            {previewLoading ? "Loading…" : "🔍 Preview Affected Trips"}
          </button>
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
            <h2 className="text-lg font-semibold text-gray-800">
              Preview — {preview.trips.length} Trip
              {preview.trips.length !== 1 ? "s" : ""} Affected
            </h2>

            {preview.trips.length === 0 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                ✅ No trips need fixing — all clear!
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
                          Total Received
                        </th>
                        <th className="px-4 py-3 font-semibold border-b text-right text-red-600">
                          Balance Shown
                        </th>
                        <th className="px-4 py-3 font-semibold border-b">
                          Status
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
                          <td className="px-4 py-3 border-b border-gray-100 text-right font-semibold text-green-700">
                            {formatCurrency(trip.total_received)}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100 text-right font-semibold text-red-600">
                            {formatCurrency(trip.balance_due)}
                          </td>
                          <td className="px-4 py-3 border-b border-gray-100">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              {trip.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleApply}
                    disabled={applyLoading}
                    className="bg-green-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {applyLoading
                      ? "Applying…"
                      : `✅ Mark ${preview.trips.length} Trip${preview.trips.length !== 1 ? "s" : ""} as Paid`}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    This recalculates each trip's totals and marks it paid.
                    Stale payment links are superseded. This action cannot be
                    undone.
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
                        Old Status
                      </th>
                      <th className="px-4 py-3 font-semibold border-b text-right">
                        Old Balance
                      </th>
                      <th className="px-4 py-3 font-semibold border-b text-right text-green-600">
                        New Balance
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
                        <td className="px-4 py-3 border-b border-gray-100">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            {trip.old_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right text-red-600">
                          {formatCurrency(trip.old_balance)}
                        </td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-semibold text-green-600">
                          {formatCurrency(trip.new_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
              ← Run another check
            </button>
          </div>
        )}

        {/* Back link */}
        <a
          href="/reports/unpaid-trips"
          className="block text-blue-600 hover:text-blue-800 underline text-sm"
        >
          ← Back to Unpaid Trips Report
        </a>
      </div>
    </div>
  );
}
