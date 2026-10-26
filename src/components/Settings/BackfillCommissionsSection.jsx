"use client";

import { useState } from "react";
import { DollarSign, Search, CheckCircle, AlertCircle } from "lucide-react";

export function BackfillCommissionsSection() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const res = await fetch("/api/payments/backfill-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: true }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to run preview");
    } finally {
      setLoading(false);
    }
  }

  async function handleFix() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/payments/backfill-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dry_run: false }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setResult(data);
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create commissions");
    } finally {
      setLoading(false);
    }
  }

  const tripsToFix = preview?.trips ?? result?.trips ?? [];
  const hasPreview = !!preview;
  const hasDone = !!result;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign size={16} className="text-green-600" />
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Fix Missing Driver Commissions
        </h3>
      </div>

      <p className="text-xs text-gray-500">
        Scans all paid trips with an assigned driver and creates any missing
        commission transactions. Also detects commissions with incorrect amounts
        (e.g. services changed after payment) and corrects them. Safe to run
        multiple times — will never create duplicates.
      </p>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {hasDone && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong>{result.message}</strong>
            {result.errors > 0 && (
              <span className="text-red-600 ml-1">
                ({result.errors} error{result.errors !== 1 ? "s" : ""} — check
                logs)
              </span>
            )}
          </span>
        </div>
      )}

      {hasPreview && tripsToFix.length === 0 && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <CheckCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong>All good!</strong> No trips with missing or incorrect
            commissions found.
          </span>
        </div>
      )}

      {tripsToFix.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
          <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-200">
            <span className="font-semibold text-gray-700">
              {hasDone ? "Commissions Fixed" : "Trips to Fix"} (
              {tripsToFix.length})
            </span>
          </div>
          <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
            {tripsToFix.map((trip) => (
              <div
                key={trip.appointment_id}
                className="px-3 py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">
                    {trip.booking_number || `#${trip.appointment_id}`}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {trip.driver} · {trip.salary_rate}
                  </span>
                  {trip.action === "correct" && (
                    <span className="ml-2 text-orange-600">
                      ${trip.old_commission} → ${trip.new_commission}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {trip.action !== "correct" && (
                    <span className="font-semibold text-gray-800">
                      ${trip.commission_amount}
                    </span>
                  )}
                  {trip.status === "created" && (
                    <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                      ✓ Created
                    </span>
                  )}
                  {trip.status === "corrected" && (
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                      ✓ Corrected
                    </span>
                  )}
                  {trip.status === "error" && (
                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                      Error
                    </span>
                  )}
                  {trip.status === "would_create" && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">
                      Missing
                    </span>
                  )}
                  {trip.status === "would_correct" && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                      Wrong Amount
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!hasDone && (
          <button
            onClick={handlePreview}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Search size={14} />
            {loading && !hasPreview ? "Scanning..." : "Preview"}
          </button>
        )}

        {hasPreview && tripsToFix.length > 0 && (
          <button
            onClick={handleFix}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <DollarSign size={14} />
            {loading
              ? "Fixing..."
              : `Fix ${tripsToFix.length} Commission${tripsToFix.length !== 1 ? "s" : ""}`}
          </button>
        )}

        {hasDone && (
          <button
            onClick={() => {
              setResult(null);
              setPreview(null);
              setError(null);
            }}
            className="px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Run Again
          </button>
        )}
      </div>
    </div>
  );
}
