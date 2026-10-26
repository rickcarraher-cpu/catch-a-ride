"use client";

import { useState } from "react";
import { DollarSign, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function BackfillTipsSection() {
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState("missing"); // "missing" | "all" | "webhook"

  const run = async () => {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch("/api/appointments/recalculate-tips", {
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
      console.error("[BackfillTips]", err);
      setResult({ error: err.message });
      setStatus("error");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 leading-relaxed">
        Square Invoice tips are stored separately from the base payment. Use one
        of the modes below to fix trips where tips aren't showing on receipts.
      </p>

      {/* Mode selector */}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => setMode("webhook")}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
            mode === "webhook"
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          🔍 Restore from Webhook Logs{" "}
          <span className="font-normal text-gray-500 block mt-0.5">
            Finds trips where Square logged a tip but no transaction was saved —
            creates the missing records
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("missing")}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
            mode === "missing"
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Fix Cached Total
          <span className="block font-normal text-gray-500 mt-0.5">
            Trips with tip transactions but $0 cached in tips_total
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`w-full px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all text-left ${
            mode === "all"
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          }`}
        >
          Recalculate All Square Trips
          <span className="block font-normal text-gray-500 mt-0.5">
            Recalculate payment totals for every paid Square trip
          </span>
        </button>
      </div>

      {/* Action button */}
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
            <DollarSign size={15} />
            Run Fix
          </>
        )}
      </button>

      {/* Result */}
      {status === "done" && result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-semibold">Done!</p>
            <p>
              Processed {result.total} trip(s), fixed {result.fixed}.
              {result.errors > 0 && (
                <span className="text-amber-700">
                  {" "}
                  {result.errors} error(s) — check server logs.
                </span>
              )}
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
