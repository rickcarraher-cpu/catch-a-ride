import { Download, Loader2 } from "lucide-react";

export function JsonExportSection({ exporting, handleExport }) {
  return (
    <section className="bg-white p-6 rounded-xl border border-gray-200 space-y-4">
      <div className="flex items-center gap-2 text-gray-900 mb-1">
        <Download size={16} className="text-blue-600" />
        <h2 className="font-semibold">Export All as JSON</h2>
      </div>
      <p className="text-sm text-gray-500">
        One file with all drivers, passengers, services, trips (services
        nested), transactions, recurring trips, working hours, blocked times,
        and settings. API keys excluded.
      </p>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {exporting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Download size={16} />
        )}
        {exporting ? "Preparing…" : "Export All Data as JSON"}
      </button>
    </section>
  );
}
