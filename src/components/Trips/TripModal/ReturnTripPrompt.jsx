import { Plane } from "lucide-react";

export function ReturnTripPrompt({ trip, returnDate, onDecline, onAccept }) {
  return (
    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-2xl z-10 flex flex-col items-center justify-center gap-6 p-8">
      <div className="w-16 h-16 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
        <Plane size={30} className="text-sky-500" />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900">
          Book the Return Trip?
        </h3>
        <p className="text-sm text-gray-500 mt-2 max-w-xs">
          {trip
            ? "This trip has a return date — would you like to book the return trip now?"
            : "The outbound trip was saved. Would you like to create a return trip with the flight info swapped?"}
        </p>
        {returnDate && (
          <p className="text-xs font-semibold text-sky-600 mt-2">
            📅 Return date:{" "}
            {new Date(returnDate).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <button
          onClick={() => {
            // Redirect to dashboard instead of calling onDecline (which goes to /trips)
            window.location.href = "/dashboard";
          }}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
        >
          No Thanks
        </button>
        <button
          onClick={onAccept}
          className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition-colors"
        >
          Yes, Book Return
        </button>
      </div>
    </div>
  );
}
