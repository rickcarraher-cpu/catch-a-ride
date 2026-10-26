"use client";

import { useState } from "react";
import { MessageSquare, AlertTriangle } from "lucide-react";

export function SmsFormatTestSection() {
  const [tripNumber, setTripNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    if (!tripNumber.trim()) {
      alert("Please enter a trip number (format: 26-1580)");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/sms/format-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripNumber: tripNumber.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load trip");
      }

      setResult(data);
    } catch (err) {
      alert(err.message || "Failed to test format");
    } finally {
      setLoading(false);
    }
  };

  /**
   * GSM-7 character set for proper segment calculation
   */
  const GSM_7_CHARS =
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
    "^{}\\[~]|€";

  /**
   * Check if message uses only GSM-7 characters
   */
  const isGSM7 = (message) => {
    if (!message) return true;
    for (let i = 0; i < message.length; i++) {
      if (!GSM_7_CHARS.includes(message[i])) {
        return false;
      }
    }
    return true;
  };

  const calculateSegments = (message) => {
    if (!message) return 1;
    const length = message.length;
    const isGsm7 = isGSM7(message);

    if (isGsm7) {
      // GSM-7 encoding
      if (length <= 160) return 1;
      return Math.ceil(length / 153);
    } else {
      // UCS-2 (Unicode) encoding
      if (length <= 70) return 1;
      return Math.ceil(length / 67);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-2">
        <MessageSquare size={18} className="text-purple-600" />
        <h2 className="font-semibold text-lg">📏 SMS Format Comparison</h2>
      </div>
      <p className="text-sm text-gray-700">
        Test and compare the <strong>current SMS format</strong> (3 segments)
        vs. a new <strong>shorter format</strong> (1 segment) for any trip.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={tripNumber}
          onChange={(e) => setTripNumber(e.target.value)}
          placeholder="Enter trip # (e.g. 26-1580)"
          className="flex-1 px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-600"
        />
        <button
          onClick={handleTest}
          disabled={loading || !tripNumber.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Loading..." : "Compare Formats"}
        </button>
      </div>

      {result && (
        <div className="space-y-4 mt-6">
          {/* Trip Info */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Trip Information
            </p>
            <p className="text-sm text-gray-600">
              <strong>#{result.tripNumber}</strong> • {result.passengerName}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {result.tripDate} • ${result.balance} due ({result.paymentMethod})
            </p>
          </div>

          {/* Current Format */}
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-red-900">
                ❌ Current Format (Long)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                  {result.current.segments} segment
                  {result.current.segments > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-red-600">
                  {result.current.chars} chars
                </span>
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded p-3 text-sm text-gray-800 font-mono whitespace-pre-wrap break-words">
              {result.current.message}
            </div>
          </div>

          {/* Shorter Format */}
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-green-900">
                ✅ Shorter Format
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                  {result.shorter.segments} segment
                  {result.shorter.segments > 1 ? "s" : ""}
                </span>
                <span className="text-xs text-green-600">
                  {result.shorter.chars} chars
                </span>
              </div>
            </div>
            <div className="bg-white border border-green-200 rounded p-3 text-sm text-gray-800 font-mono whitespace-pre-wrap break-words">
              {result.shorter.message}
            </div>
          </div>

          {/* Savings Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-blue-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-semibold text-blue-900 mb-1">
                  💰 Cost Savings
                </p>
                <p className="text-sm text-blue-800">
                  The shorter format saves{" "}
                  <strong>
                    {result.current.segments - result.shorter.segments} segment
                    {result.current.segments - result.shorter.segments > 1
                      ? "s"
                      : ""}
                  </strong>{" "}
                  ({result.current.chars - result.shorter.chars} characters) per
                  message.
                  {result.current.segments > result.shorter.segments && (
                    <span className="block mt-1">
                      This reduces SMS costs by approximately{" "}
                      <strong>
                        {Math.round(
                          ((result.current.segments - result.shorter.segments) /
                            result.current.segments) *
                            100,
                        )}
                        %
                      </strong>
                      .
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
