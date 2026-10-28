import { AlertTriangle } from "lucide-react";

export function DeleteTripModal({ trip, onCancel, onConfirm, isDeleting }) {
  if (!trip) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Delete Trip?
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to{" "}
              <span className="font-semibold text-red-600">delete</span> instead
              of <span className="font-semibold text-blue-600">cancel</span>?
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Trip for{" "}
              <span className="font-semibold text-gray-700">
                {trip.client_name}
              </span>{" "}
              on{" "}
              <span className="font-semibold text-gray-700">
                {new Date(trip.start_time).toLocaleDateString()}
              </span>
              . This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
