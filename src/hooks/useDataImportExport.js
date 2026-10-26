import { useState, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function useDataExport() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/data/export");
      if (!res.ok) {
        // Try to get error details from response
        let errorMessage = "Export request failed";
        try {
          const errorData = await res.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // If we can't parse JSON, use status text
          errorMessage = `Export failed with status ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `limoservice-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Export failed: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, handleExport };
}

export function useDataImport() {
  const queryClient = useQueryClient();
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Please select a .json file");
      return;
    }
    setImporting(true);
    setImportResults(null);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON — file could not be parsed.");
      }
      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportResults(data);
      if (data.total_errors === 0) {
        toast.success("Import completed successfully!");
      } else {
        toast.warning(`Import finished with ${data.total_errors} error(s).`);
      }
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return {
    importing,
    importResults,
    setImportResults,
    fileInputRef,
    handleImportFile,
  };
}
