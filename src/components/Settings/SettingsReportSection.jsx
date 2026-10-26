import React, { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";

export function SettingsReportSection() {
  const [generating, setGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/settings/export-docx", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settings-report-${new Date().toISOString().split("T")[0]}.docx`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error generating settings report:", error);
      alert("Failed to generate settings report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={20} className="text-blue-600" />
        <h2 className="font-semibold text-lg text-gray-900">
          Settings Configuration Report
        </h2>
      </div>

      <p className="text-sm text-gray-600">
        Generate a comprehensive Word document (.docx) containing all your
        current settings organized by category. Perfect for documentation,
        audits, or sharing configuration details with your team.
      </p>

      <div className="bg-white border border-blue-200 rounded-lg p-4 space-y-2">
        <p className="text-xs font-semibold text-blue-800">
          📋 Report includes:
        </p>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>General Settings (business info, notifications, pricing)</li>
          <li>Booking & Online Form configuration</li>
          <li>Message Templates</li>
          <li>SMS Configuration (provider, credentials)</li>
          <li>Data & Import/Export settings</li>
          <li>System Settings (authentication, rotation)</li>
        </ul>
      </div>

      <button
        onClick={handleGenerateReport}
        disabled={generating}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all ${
          generating
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
        }`}
      >
        {generating ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating Report...
          </>
        ) : (
          <>
            <Download size={18} />
            Download Settings Report (.docx)
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 italic">
        💡 Tip: Open the downloaded file in Microsoft Word, Google Docs, or any
        compatible word processor.
      </p>
    </section>
  );
}
