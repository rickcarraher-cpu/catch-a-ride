import { useState } from "react";

export default function BackfillDispatcherSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleBackfill = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/appointments/backfill-dispatcher", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backfill failed");
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">
          Backfill Dispatcher Names
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Fills in the "Dispatcher" field on existing Admin-booked trips that
          are missing it, using the last-modified-by email to look up the
          employee name.
        </p>
      </div>

      <button
        onClick={handleBackfill}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "Running…" : "Run Backfill"}
      </button>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          ✅ {result.message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          ❌ {error}
        </div>
      )}
    </div>
  );
}
