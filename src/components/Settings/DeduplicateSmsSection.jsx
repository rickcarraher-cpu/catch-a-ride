"use client";

import { useState } from "react";
import {
  MessageSquare,
  Search,
  Trash2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export function DeduplicateSmsSection() {
  const [scanning, setScanning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [removeResult, setRemoveResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResult(null);
    setRemoveResult(null);
    setConfirmed(false);

    try {
      const res = await fetch("/api/sms/deduplicate");
      if (!res.ok) throw new Error("Scan failed");
      const data = await res.json();
      setScanResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to scan for duplicates. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setError(null);

    try {
      const res = await fetch("/api/sms/deduplicate", { method: "POST" });
      if (!res.ok) throw new Error("Remove failed");
      const data = await res.json();
      setRemoveResult(data);
      setScanResult(null);
      setConfirmed(false);
    } catch (err) {
      console.error(err);
      setError("Failed to remove duplicates. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={16} className="text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          Remove Duplicate SMS Messages
        </h3>
      </div>
      <p className="text-xs text-gray-500">
        Scans your SMS log for messages that are identical (same phone number,
        message text, direction, and timestamp) and removes the extras — keeping
        one copy of each.
      </p>

      {/* Scan button */}
      {!scanResult && !removeResult && (
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Search size={14} />
          {scanning ? "Scanning..." : "Scan for Duplicates"}
        </button>
      )}

      {/* Scan results */}
      {scanResult && (
        <div className="space-y-4">
          <div
            className={`rounded-lg p-4 border ${
              scanResult.totalToRemove === 0
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            {scanResult.totalToRemove === 0 ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={16} />
                <span className="text-sm font-medium">
                  No duplicates found — your SMS log is clean!
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle size={16} />
                  <span className="text-sm font-semibold">
                    Found {scanResult.totalToRemove} duplicate
                    {scanResult.totalToRemove !== 1 ? "s" : ""} across{" "}
                    {scanResult.duplicateGroups} group
                    {scanResult.duplicateGroups !== 1 ? "s" : ""}
                  </span>
                </div>
                {scanResult.preview && scanResult.preview.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-amber-700 font-medium">
                      Sample duplicates:
                    </p>
                    {scanResult.preview.map((item, i) => (
                      <div
                        key={i}
                        className="bg-white border border-amber-200 rounded px-3 py-2 text-xs text-gray-600"
                      >
                        <span className="font-medium text-gray-800">
                          {item.phone}
                        </span>
                        {" · "}
                        <span
                          className={
                            item.direction === "outbound"
                              ? "text-blue-600"
                              : "text-green-600"
                          }
                        >
                          {item.direction === "outbound" ? "Sent" : "Received"}
                        </span>
                        {" · "}
                        <span className="text-red-600 font-medium">
                          {item.toRemove} extra{item.toRemove !== 1 ? "s" : ""}
                        </span>
                        <div className="text-gray-500 mt-0.5 truncate">
                          {item.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {scanResult.totalToRemove > 0 && (
            <div className="space-y-3">
              {!confirmed ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfirmed(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 size={14} />
                    Remove {scanResult.totalToRemove} Duplicate
                    {scanResult.totalToRemove !== 1 ? "s" : ""}
                  </button>
                  <button
                    onClick={() => setScanResult(null)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-800">
                    ⚠️ Are you sure? This will permanently delete{" "}
                    {scanResult.totalToRemove} SMS record
                    {scanResult.totalToRemove !== 1 ? "s" : ""} from the
                    database.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRemove}
                      disabled={removing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={14} />
                      {removing ? "Removing..." : "Yes, Remove Duplicates"}
                    </button>
                    <button
                      onClick={() => setConfirmed(false)}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {scanResult.totalToRemove === 0 && (
            <button
              onClick={() => setScanResult(null)}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      {/* Success result */}
      {removeResult && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">
                {removeResult.message}
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Your SMS log has been cleaned up.
              </p>
            </div>
          </div>
          <button
            onClick={() => setRemoveResult(null)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Search size={14} />
            Scan Again
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
