import { useState, useRef } from "react";
import {
  Upload,
  Loader2,
  Users,
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  FileDown,
  TestTube,
} from "lucide-react";
import { toast } from "@/utils/notify";

export function PassengerCsvImportSection() {
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef(null);
  const testFileInputRef = useRef(null);

  const handleExportPassengers = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/clients/export-csv");
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      if (typeof window === "undefined") return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passengers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Passengers exported!");
    } catch (err) {
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (typeof window === "undefined") return;
    const link = document.createElement("a");
    link.href = "/api/clients/export-csv-template";
    link.download = "passenger-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Template downloaded!");
  };

  const handleTestImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }

    setTesting(true);
    setImportResults(null);

    try {
      // Parse CSV file
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (lines.length < 2) {
        throw new Error("CSV file appears empty or has no data rows");
      }

      // Parse headers
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""));

      // Parse rows
      const rows = lines.slice(1).map((line) => {
        const values = [];
        let cur = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            values.push(cur);
            cur = "";
          } else {
            cur += ch;
          }
        }
        values.push(cur);

        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx]?.trim() ?? "";
        });
        return obj;
      });

      // Send to TEST API endpoint
      const res = await fetch("/api/clients/import-csv-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Test failed");
      }

      setImportResults(data);

      if (data.error_count === 0) {
        toast.success("Test complete! Review results below (no changes made)");
      } else {
        toast.warning(data.message);
      }
    } catch (err) {
      toast.error(err.message);
      console.error("Test error:", err);
    } finally {
      setTesting(false);
      if (testFileInputRef.current) {
        testFileInputRef.current.value = "";
      }
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please select a .csv file");
      return;
    }

    setImporting(true);
    setImportResults(null);

    try {
      // Parse CSV file
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());

      if (lines.length < 2) {
        throw new Error("CSV file appears empty or has no data rows");
      }

      // Parse headers
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""));

      // Parse rows
      const rows = lines.slice(1).map((line) => {
        const values = [];
        let cur = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            values.push(cur);
            cur = "";
          } else {
            cur += ch;
          }
        }
        values.push(cur);

        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx]?.trim() ?? "";
        });
        return obj;
      });

      // Send to API
      const res = await fetch("/api/clients/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      setImportResults(data);

      if (data.error_count === 0) {
        toast.success(data.message);
      } else {
        toast.warning(data.message);
      }
    } catch (err) {
      toast.error(err.message);
      console.error("Import error:", err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownloadResults = async () => {
    if (!importResults?.results) return;

    try {
      const res = await fetch("/api/clients/export-import-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: importResults.results }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      if (typeof window === "undefined") return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passenger-import-results-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Results exported!");
    } catch (err) {
      toast.error("Export failed: " + err.message);
    }
  };

  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-1">
        <Users size={16} className="text-blue-600" />
        <h2 className="font-semibold">Passenger CSV Import/Export</h2>
      </div>

      <p className="text-sm text-gray-500">
        Export all passengers to CSV, or upload a CSV to add/update passenger
        records. Matching is done by name or phone number. If a match is found,
        the record is updated with any non-blank data from the import. If no
        match is found, a new passenger is created.
      </p>

      {/* Export & Template Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleExportPassengers}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader2 size={16} />
              Exporting...
            </>
          ) : (
            <>
              <FileDown size={16} />
              Export All Passengers
            </>
          )}
        </button>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
        >
          <FileText size={16} />
          Download Template
        </button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>CSV Format:</strong> Columns should include: name, phone,
          email, notes, notification_preference, street_address, city, state,
          zip_code
        </p>
      </div>

      {/* Add Test Import Section */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <TestTube size={16} className="text-purple-600" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Test Import (No Changes)
          </h3>
        </div>
        <p className="text-xs text-gray-500">
          Upload a CSV to analyze what would happen without making any changes
          to your database.
        </p>
        <label
          htmlFor="passenger-test-file"
          className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            testing
              ? "border-purple-300 bg-purple-50"
              : "border-purple-300 bg-purple-50 hover:border-purple-400 hover:bg-purple-100"
          }`}
        >
          {testing ? (
            <>
              <Loader2 size={24} className="text-purple-500" />
              <span className="text-sm font-medium text-purple-600">
                Analyzing import…
              </span>
            </>
          ) : (
            <>
              <TestTube size={24} className="text-purple-400" />
              <span className="text-sm font-medium text-purple-700">
                Click to test import (no changes will be made)
              </span>
            </>
          )}
          <input
            ref={testFileInputRef}
            id="passenger-test-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={testing}
            onChange={handleTestImportFile}
          />
        </label>
      </div>

      {/* Live Import Section */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-blue-600" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Live Import (Updates Database)
          </h3>
        </div>
        <label
          htmlFor="passenger-import-file"
          className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            importing
              ? "border-blue-300 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          {importing ? (
            <>
              <Loader2 size={16} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-600">
                Importing passengers…
              </span>
            </>
          ) : (
            <>
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                Click to select a <strong>.csv</strong> file
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            id="passenger-import-file"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={importing}
            onChange={handleImportFile}
          />
        </label>
      </div>

      {importResults && (
        <div className="space-y-3">
          {/* Show test mode badge if applicable */}
          {importResults.test_mode && (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-purple-50 border-purple-200 text-purple-800 text-sm font-medium">
              <TestTube size={16} className="text-purple-600" />
              TEST MODE - No changes were made to the database
            </div>
          )}

          <div
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${
              importResults.error_count === 0
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            {importResults.error_count === 0 ? (
              <CheckCircle2 size={16} className="text-green-600" />
            ) : (
              <AlertCircle size={16} className="text-amber-600" />
            )}
            {importResults.message}
          </div>

          <div className="flex gap-4 text-sm">
            <span className="text-blue-700 font-medium">
              ✓ {importResults.new_count} new
            </span>
            <span className="text-green-700 font-medium">
              ↻ {importResults.update_count} updated
            </span>
            {importResults.error_count > 0 && (
              <span className="text-red-600">
                ✕ {importResults.error_count} errors
              </span>
            )}
          </div>

          {/* Show detailed results for test mode */}
          {importResults.test_mode && importResults.results && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 max-h-96 overflow-y-auto">
              <h4 className="font-semibold text-sm text-gray-900 mb-2">
                Detailed Analysis:
              </h4>
              {importResults.results.map((result, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-xs ${
                    result.action === "new"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="font-semibold mb-1">
                    Row {result.row}:{" "}
                    {result.action === "new" ? "🆕 NEW" : "↻ UPDATE"} -{" "}
                    {result.name}
                  </div>
                  <div className="text-gray-700 space-y-0.5">
                    <div>Phone: {result.phone || "(none)"}</div>
                    <div>Email: {result.email || "(none)"}</div>
                    <div>
                      Notification:{" "}
                      <strong>{result.notification_preference}</strong>
                    </div>
                    {result.changes && (
                      <div className="mt-2 pt-2 border-t border-gray-300">
                        <div className="font-semibold mb-1">Changes:</div>
                        {result.changes.map((change, idx) => (
                          <div key={idx} className="text-gray-600">
                            • {change}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {importResults.errors && importResults.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-36 overflow-y-auto">
              {importResults.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-700 font-mono">
                  {err}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleDownloadResults}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Download size={16} />
              Download Results CSV
            </button>

            <button
              onClick={() => setImportResults(null)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear results
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
