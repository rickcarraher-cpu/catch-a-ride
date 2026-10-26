"use client";

import React, { useState } from "react";
import { Phone, CheckCircle, AlertCircle, XCircle } from "lucide-react";

/**
 * Fix Phone Numbers Section
 *
 * One-click utility to normalize all passenger phone numbers to E.164 format (+1XXXXXXXXXX).
 * Critical for ensuring SMS notifications work properly.
 */
export function FixPhoneNumbersSection() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [scanResults, setScanResults] = useState(null);
  const [fixResults, setFixResults] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResults(null);
    setFixResults(null);

    try {
      const res = await fetch("/api/clients/fix-phone-numbers");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to scan phone numbers");
      }

      const data = await res.json();
      setScanResults(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleFix = async () => {
    setFixing(true);
    setError(null);
    setFixResults(null);

    try {
      const res = await fetch("/api/clients/fix-phone-numbers", {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fix phone numbers");
      }

      const data = await res.json();
      setFixResults(data);
      setScanResults(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800 mb-2">
          <strong>Why this matters:</strong> SMS notifications require phone
          numbers in E.164 format (+1XXXXXXXXXX).
        </p>
        <p className="text-xs text-blue-600">
          When passengers are created without the +1 prefix, SMS silently fails.
          This utility scans all passengers and normalizes phone numbers to the
          correct format.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleScan}
          disabled={scanning || fixing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Phone size={16} />
          {scanning ? "Scanning..." : "Preview Changes"}
        </button>

        {scanResults && scanResults.summary.needsFix > 0 && (
          <button
            onClick={handleFix}
            disabled={fixing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <CheckCircle size={16} />
            {fixing
              ? "Fixing..."
              : `Fix ${scanResults.summary.needsFix} Phone Number${scanResults.summary.needsFix !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800 font-medium">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Scan Results */}
      {scanResults && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-800 mb-2">
              Scan Results
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white rounded p-2 border border-gray-200">
                <p className="text-gray-500">Total Passengers</p>
                <p className="text-lg font-bold text-gray-800">
                  {scanResults.summary.total}
                </p>
              </div>
              <div className="bg-green-50 rounded p-2 border border-green-200">
                <p className="text-green-600">Already Correct</p>
                <p className="text-lg font-bold text-green-700">
                  {scanResults.summary.alreadyCorrect}
                </p>
              </div>
              <div className="bg-yellow-50 rounded p-2 border border-yellow-200">
                <p className="text-yellow-600">Need Fix</p>
                <p className="text-lg font-bold text-yellow-700">
                  {scanResults.summary.needsFix}
                </p>
              </div>
              <div className="bg-red-50 rounded p-2 border border-red-200">
                <p className="text-red-600">Invalid</p>
                <p className="text-lg font-bold text-red-700">
                  {scanResults.summary.invalid}
                </p>
              </div>
            </div>
          </div>

          {/* Passengers Needing Fix */}
          {scanResults.needsFix.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Passengers to be Fixed ({scanResults.needsFix.length})
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {scanResults.needsFix.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded p-2 text-xs border border-yellow-100"
                  >
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-red-600 line-through">
                        {item.before}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-600 font-medium">
                        {item.after}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalid Phone Numbers */}
          {scanResults.invalid.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-2">
                Invalid Phone Numbers ({scanResults.invalid.length})
              </p>
              <p className="text-xs text-red-600 mb-2">
                These phone numbers cannot be automatically fixed. Please update
                them manually.
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {scanResults.invalid.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded p-2 text-xs border border-red-100"
                  >
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-red-600 mt-1">{item.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scanResults.summary.needsFix === 0 &&
            scanResults.summary.invalid === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    All phone numbers are correctly formatted! 🎉
                  </p>
                </div>
              </div>
            )}
        </div>
      )}

      {/* Fix Results */}
      {fixResults && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={20} className="text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Fix Complete!
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="bg-white rounded p-2 border border-gray-200">
                <p className="text-gray-500">Total Processed</p>
                <p className="text-lg font-bold text-gray-800">
                  {fixResults.summary.total}
                </p>
              </div>
              <div className="bg-green-100 rounded p-2 border border-green-300">
                <p className="text-green-600">Fixed</p>
                <p className="text-lg font-bold text-green-700">
                  {fixResults.summary.fixed}
                </p>
              </div>
              <div className="bg-gray-100 rounded p-2 border border-gray-300">
                <p className="text-gray-600">Skipped</p>
                <p className="text-lg font-bold text-gray-700">
                  {fixResults.summary.skipped}
                </p>
              </div>
              <div className="bg-red-50 rounded p-2 border border-red-200">
                <p className="text-red-600">Errors</p>
                <p className="text-lg font-bold text-red-700">
                  {fixResults.summary.errors}
                </p>
              </div>
            </div>
          </div>

          {/* Fixed Passengers */}
          {fixResults.fixed.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-800 mb-2">
                Successfully Fixed ({fixResults.fixed.length})
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {fixResults.fixed.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded p-2 text-xs border border-green-100"
                  >
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500 line-through">
                        {item.before}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="text-green-600 font-medium">
                        {item.after}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {fixResults.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm font-medium text-red-800 mb-2">
                Errors ({fixResults.errors.length})
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {fixResults.errors.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded p-2 text-xs border border-red-100"
                  >
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-gray-600 mt-1">{item.phone}</p>
                    <p className="text-red-600 mt-1">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
