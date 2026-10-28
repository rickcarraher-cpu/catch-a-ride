import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function NotSpecifiedPaymentsSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["not-specified-payments"],
    queryFn: async () => {
      const res = await fetch(
        "/api/appointments/search?payment_method=Not Specified",
      );
      if (!res.ok) throw new Error("Failed to fetch trips");
      return res.json();
    },
    enabled: isExpanded,
  });

  const trips = data?.results || [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
            Payment Method Not Specified
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Review trips where payment method was not set
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          {isExpanded ? "Hide" : "Show List"}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {isLoading
                ? "Loading..."
                : `${trips.length} trip${trips.length !== 1 ? "s" : ""} found`}
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={isFetching ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle size={16} />
              Failed to load trips. Please try again.
            </div>
          )}

          {!isLoading && !error && trips.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm font-medium text-green-700">
                ✓ No trips with unspecified payment method
              </p>
            </div>
          )}

          {!isLoading && !error && trips.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                        Booking #
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                        Passenger
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                        Trip Date
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {trips.map((trip) => (
                      <tr
                        key={trip.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {trip.booking_number || `#${trip.id}`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">
                            {trip.client_name || "Unknown"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">
                            {trip.start_time
                              ? new Date(trip.start_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/trips?search=${trip.booking_number || trip.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            View Trip
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
