import { useState } from "react";
import { MapPin, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

export function MigrateClientAddressesSection() {
  const [status, setStatus] = useState(null); // null | 'running' | 'done' | 'error'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleRun = async () => {
    setStatus("running");
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/clients/migrate-addresses", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Migration failed");
      }

      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-purple-50 rounded-lg">
          <MapPin size={18} className="text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Migrate Client Home Addresses
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            One-time: Parse existing client addresses into structured fields
            (street, city, state, ZIP) so they pre-fill correctly when booking.
          </p>
        </div>
      </div>

      {status === null && (
        <button
          onClick={handleRun}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Migrate Client Addresses
        </button>
      )}

      {status === "running" && (
        <div className="flex items-center gap-2 text-sm text-purple-700">
          <Loader2 size={16} className="animate-spin" />
          Migrating client addresses…
        </div>
      )}

      {status === "done" && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
            <CheckCircle2 size={16} />
            {result.message}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-green-700">
                {result.migrated}
              </p>
              <p className="text-xs text-green-600">Migrated</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-gray-600">{result.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-red-600">{result.failed}</p>
              <p className="text-xs text-red-500">Failed</p>
            </div>
          </div>

          {/* Details table */}
          {result.results && result.results.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden text-xs max-h-80 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-gray-500 font-semibold uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-3 py-1.5 text-left text-gray-500 font-semibold uppercase tracking-wider">
                      Original Address
                    </th>
                    <th className="px-3 py-1.5 text-left text-gray-500 font-semibold uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.results.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-semibold text-gray-700">
                        {r.name}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[200px] truncate">
                        {r.original}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.success ? (
                          <span className="text-green-600 font-semibold">
                            ✓ Migrated
                          </span>
                        ) : (
                          <span className="text-red-600 text-xs">
                            ✗ {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Migration complete. Home addresses will now pre-fill correctly when
            passengers book again.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">
              Migration failed
            </p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <button
              onClick={handleRun}
              className="mt-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
