"use client";

import { useState } from "react";
import { CreditCard, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function BackfillCcFeeAmountSection() {
  const [status, setStatus] = useState(null); // null | "running" | "done" | "error"
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("missing"); // "missing" | "all"

  const run = async () => {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch("/api/appointments/backfill-cc-fee-amount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Unknown error");
      }
      setResult(data);
      setStatus("done");
    } catch (err) {
      console.error("[BackfillCcFee]", err);
      setResult({ error: err.message });
      setStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 leading-relaxed">
        Populates the{" "}
        <code className="bg-gray-100 px-1 rounded text-xs">cc_fee_amount</code>{" "}
        field on existing trips that have a credit-card payment method (Credit
        Card, Square, Square Invoice). The fee is recalculated from each trip's
        services total using the current CC fee % setting.
      </p>

      {/* Mode selector */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setMode("missing")}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
            mode === "missing"
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Fix Missing Only
          <span className="block font-normal text-gray-500 mt-0.5">
            Only updates trips where{" "}
            <code className="bg-gray-100 px-0.5 rounded">cc_fee_amount</code> is
            null or $0
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
            mode === "all"
              ? "border-amber-500 bg-amber-50 text-amber-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Recalculate All CC Trips
          <span className="block font-normal text-gray-500 mt-0.5">
            Recalculates and overwrites{" "}
            <code className="bg-gray-100 px-0.5 rounded">cc_fee_amount</code> on
            every Credit Card / Square / Square Invoice trip
          </span>
        </button>
      </div>

      {/* Run button */}
      <button
        onClick={run}
        disabled={status === "running"}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === "running" ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Running…
          </>
        ) : (
          <>
            <CreditCard size={15} />
            Run Fix
          </>
        )}
      </button>

      {/* Success result */}
      {status === "done" && result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800 space-y-0.5">
            <p className="font-semibold">Done!</p>
            <p>
              Found <strong>{result.total}</strong> trip(s) — updated{" "}
              <strong>{result.fixed}</strong>, skipped{" "}
              <strong>{result.skipped}</strong> (no base amount).
              {result.errors > 0 && (
                <span className="text-amber-700">
                  {" "}
                  {result.errors} error(s) — check server logs.
                </span>
              )}
            </p>
            <p className="text-xs text-green-700">
              Fee % used: {result.feePercent}%
            </p>
            {result.errorList?.length > 0 && (
              <ul className="mt-1 text-xs text-red-700 list-disc list-inside">
                {result.errorList.map((e) => (
                  <li key={e.id}>
                    Trip #{e.id}: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Error result */}
      {status === "error" && result?.error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Error</p>
            <p>{result.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
