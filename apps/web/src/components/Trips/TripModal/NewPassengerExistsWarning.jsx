import { AlertTriangle, X } from "lucide-react";

export function NewPassengerExistsWarning({
  existingPassenger,
  onGoToBookingType,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-red-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-600" />
            <h3 className="font-bold text-red-900">Passenger Already Exists</h3>
          </div>
          <button
            onClick={onClose}
            className="text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            This passenger already exists in the system:
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
            <p className="text-sm font-bold text-gray-900">
              {existingPassenger.name}
            </p>
            {existingPassenger.phone && (
              <p className="text-xs text-gray-600">
                Phone: {existingPassenger.phone}
              </p>
            )}
            {existingPassenger.email && (
              <p className="text-xs text-gray-500">
                Email: {existingPassenger.email}
              </p>
            )}
          </div>

          <p className="text-xs text-gray-600">
            You cannot create a duplicate passenger. Please choose to create a
            new trip or clone an existing one for this passenger.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onGoToBookingType}
              className="w-full py-3 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Go to New Trip or Clone Existing
            </button>
            <button
              onClick={onClose}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 font-medium py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
