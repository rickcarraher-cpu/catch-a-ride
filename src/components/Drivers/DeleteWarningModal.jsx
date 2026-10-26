import { Trash2 } from "lucide-react";

export function DeleteWarningModal({ driver, trips, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-red-100 bg-red-50 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 size={22} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Cannot Delete Driver
            </h2>
            <p className="text-sm text-gray-600 mt-0.5">
              <span className="font-semibold text-gray-900">{driver.name}</span>{" "}
              has upcoming assignments. Before you can delete this driver, you
              must reassign or cancel the following trips:
            </p>
          </div>
        </div>

        {/* Trip list */}
        <div className="p-4 max-h-64 overflow-y-auto space-y-2">
          {trips.map((trip) => {
            const tripDate = new Date(trip.start_time).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const destination =
              trip.destination ||
              trip.dropoff_address ||
              trip.dropoff_city ||
              "—";
            return (
              <div
                key={trip.id}
                className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-bold text-gray-900">
                    {trip.booking_number
                      ? `#${trip.booking_number}`
                      : `Trip ${trip.id}`}
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {tripDate} · {destination}
                  </p>
                </div>
                <a
                  href="/trips"
                  className="ml-3 text-xs font-semibold text-blue-600 hover:underline shrink-0"
                >
                  Go to Trips
                </a>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
