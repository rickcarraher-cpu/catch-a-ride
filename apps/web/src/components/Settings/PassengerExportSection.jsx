"use client";

import React, { useState } from "react";
import { Download, Loader2, Users } from "lucide-react";

export function PassengerExportSection() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/clients/export-passengers-excel");
      if (!res.ok) {
        let msg = "Export failed";
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch (_) {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `passengers-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[PassengerExport] Error:", err);
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-1">
        <Users size={16} className="text-green-600" />
        <h2 className="font-semibold">Export Passengers (Excel/CSV)</h2>
      </div>
      <p className="text-sm text-gray-500">
        Downloads a CSV of every passenger who has at least one trip in the
        system (any status). No duplicates. Columns:{" "}
        <span className="font-medium text-gray-700">
          First Name, Last Name, Phone Number, Email, Company, Role
        </span>
        . Open in Excel or Google Sheets.
      </p>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {exporting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {exporting ? "Preparing…" : "Export Passengers to CSV"}
      </button>
    </section>
  );
}
