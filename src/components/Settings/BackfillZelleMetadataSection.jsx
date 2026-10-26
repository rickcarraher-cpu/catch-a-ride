import { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";

export function BackfillZelleMetadataSection() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/backfill-zelle-metadata");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load preview");
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  const handleRun = async () => {
    if (
      !confirm(
        `This will update ${preview?.missing ?? "all"} Zelle payment record(s) with your configured Zelle contact info. Continue?`,
      )
    )
      return;

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/payments/backfill-zelle-metadata", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to run backfill");
      setResult(data);
      fetchPreview(); // Refresh preview count
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status preview */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={14} className="animate-spin" />
          Checking records...
        </div>
      ) : (
        preview && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Zelle payments:</span>
              <span className="font-semibold text-gray-800">
                {preview.total}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Missing contact info:</span>
              <span
                className={`font-semibold ${preview.missing > 0 ? "text-orange-600" : "text-green-600"}`}
              >
                {preview.missing > 0
                  ? `${preview.missing} need update`
                  : "✓ All up to date"}
              </span>
            </div>
            {preview.configured_contact && (
              <div className="pt-1 border-t border-gray-200 text-xs text-gray-500 space-y-0.5">
                <p className="font-medium text-gray-600">Will fill in with:</p>
                {preview.configured_contact.email && (
                  <p>Email: {preview.configured_contact.email}</p>
                )}
                {preview.configured_contact.phone && (
                  <p>Phone: {preview.configured_contact.phone}</p>
                )}
                <p>Name: {preview.configured_contact.name}</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Success result */}
      {result && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
          <CheckCircle size={14} className="text-green-600 mt-0.5 shrink-0" />
          <p className="text-xs text-green-700">{result.message}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRun}
          disabled={running || loading || (preview && preview.missing === 0)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              <Zap size={14} />
              Backfill Zelle Contact Info
            </>
          )}
        </button>
        <button
          onClick={fetchPreview}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Search size={13} />
          Refresh
        </button>
      </div>
    </div>
  );
}
