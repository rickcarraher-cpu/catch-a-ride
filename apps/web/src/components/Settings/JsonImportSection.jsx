import {
  Upload,
  Loader2,
  FileJson,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export function JsonImportSection({
  importing,
  importResults,
  setImportResults,
  fileInputRef,
  handleImportFile,
}) {
  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-1">
        <Upload size={16} className="text-blue-600" />
        <h2 className="font-semibold">Import from JSON</h2>
      </div>
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
        <AlertCircle size={15} className="text-red-600 mt-0.5 shrink-0" />
        <p className="text-xs text-red-700 font-medium">
          <strong>REPLACES all data.</strong> All existing drivers, passengers,
          services, trips, and transactions are permanently deleted before
          loading. Export a backup first.
        </p>
      </div>
      <label
        htmlFor="import-file"
        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${importing ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"}`}
      >
        {importing ? (
          <>
            <Loader2 size={28} className="text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-600">
              Importing…
            </span>
          </>
        ) : (
          <>
            <FileJson size={28} className="text-gray-400" />
            <div className="text-center">
              <span className="text-sm font-medium text-gray-700">
                Click to select a JSON export file
              </span>
              <p className="text-xs text-gray-400 mt-1">
                Only .json files from this app are supported
              </p>
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          id="import-file"
          type="file"
          accept=".json,application/json"
          className="hidden"
          disabled={importing}
          onChange={handleImportFile}
        />
      </label>
      {importResults && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${importResults.total_errors === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
          >
            {importResults.total_errors === 0 ? (
              <CheckCircle2 size={16} className="text-green-600" />
            ) : (
              <AlertCircle size={16} className="text-amber-600" />
            )}
            {importResults.message}
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">
                    Section
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    Inserted
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    Skipped
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-600">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(importResults.results || {}).map(
                  ([section, r]) => (
                    <tr
                      key={section}
                      className={r.errors?.length > 0 ? "bg-red-50" : ""}
                    >
                      <td className="px-4 py-2 font-medium text-gray-700 capitalize">
                        {section.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-2 text-right text-green-700">
                        {r.inserted ?? r.updated ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {r.skipped ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {r.errors?.length || 0}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {importResults.total_errors > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1 max-h-36 overflow-y-auto">
              {Object.entries(importResults.results || {})
                .flatMap(([, r]) => r.errors || [])
                .map((err, i) => (
                  <p key={i} className="text-xs text-red-700 font-mono">
                    {err}
                  </p>
                ))}
            </div>
          )}
          <button
            onClick={() => setImportResults(null)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear results
          </button>
        </div>
      )}
    </section>
  );
}
