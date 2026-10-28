"use client";

import { useState, useEffect } from "react";

export default function FixTrip262049Page() {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    fetch("/api/fix-trip-26-2049")
      .then((r) => r.json())
      .then((d) => setCurrent(d))
      .catch(console.error);
  }, []);

  const handleFix = async () => {
    setLoading(true);
    setStatus("Applying fix for trip 26-2049 (ID: 20366)…");
    setResult(null);
    try {
      const response = await fetch("/api/fix-trip-26-2049", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setStatus("✅ Fix applied successfully!");
        setResult(data);
        // Refresh current
        const r2 = await fetch("/api/fix-trip-26-2049");
        setCurrent(await r2.json());
      } else {
        setStatus(`❌ Error: ${data.error || "Failed"}`);
        setResult(data);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const trip = current?.trip;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">Fix Trip 26-2049</h1>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h2 className="font-semibold text-yellow-900 mb-2">Issue:</h2>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>
                <strong>original_amount</strong> was set equal to services_total
                ($292.50) — missing the CC fee
              </li>
              <li>
                <strong>cc_fee_amount</strong> was recorded as $8 (Math.round of
                4% × $210) — should be $9 (Math.ceil)
              </li>
              <li>
                <strong>balance_due</strong> shows $74.50 — should be $86.50
              </li>
              <li>
                ServicesSection TOTAL showed $301.00 (due to Math.ceil on
                subtotal) — should be $301.50
              </li>
            </ul>
          </div>

          {trip && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded">
              <h2 className="font-semibold text-gray-700 mb-3">
                Current DB Values (ID 20366):
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["services_total", trip.services_total],
                  ["original_amount", trip.original_amount],
                  ["cc_fee_amount", trip.cc_fee_amount],
                  ["payments_total", trip.payments_total],
                  ["balance_due", trip.balance_due],
                  ["payment_status", trip.payment_status],
                ].map(([label, val]) => (
                  <div
                    key={label}
                    className="flex justify-between bg-white border border-gray-100 rounded px-3 py-1.5"
                  >
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900">
                      {val !== null ? `${val}` : "null"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h2 className="font-semibold text-green-900 mb-2">Fix will set:</h2>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>
                original_amount → <strong>$304.50</strong> ($292.50 services +
                $12 total CC fee)
              </li>
              <li>
                cc_fee_amount → <strong>$9.00</strong> (Math.ceil of 4% × $210
                base)
              </li>
              <li>
                balance_due → <strong>$86.50</strong> ($304.50 − $210 payment −
                $8 cc paid)
              </li>
            </ul>
            <p className="text-xs text-green-700 mt-2">
              Note: The Services section "TOTAL" display is separately fixed by
              removing the Math.ceil rounding on the subtotal, so it will show
              $292.50 + $9 = $301.50 as expected.
            </p>
          </div>

          <button
            onClick={handleFix}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? "Applying fix…" : "🔧 Apply Fix for Trip 26-2049"}
          </button>

          {status && (
            <div
              className={`p-4 rounded ${status.startsWith("✅") ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
            >
              <p className="font-semibold mb-2">{status}</p>
              {result && (
                <div className="space-y-2">
                  {result.before && (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="font-semibold text-gray-600">Field</div>
                      <div className="font-semibold text-gray-600">Before</div>
                      <div className="font-semibold text-gray-600">After</div>
                      {["original_amount", "cc_fee_amount", "balance_due"].map(
                        (f) => (
                          <>
                            <div key={`${f}-k`} className="text-gray-500">
                              {f}
                            </div>
                            <div key={`${f}-b`} className="text-red-600">
                              {result.before[f]}
                            </div>
                            <div key={`${f}-a`} className="text-green-600">
                              {result.after[f]}
                            </div>
                          </>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <a
            href="/trips"
            className="block text-blue-600 hover:text-blue-800 underline text-sm"
          >
            ← Back to Trips
          </a>
        </div>
      </div>
    </div>
  );
}
