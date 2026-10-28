import { AlertTriangle, X } from "lucide-react";

export function DuplicatePassengerWarning({
  duplicatePassenger,
  onUseDuplicate,
  onContinueAnyway,
  onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-orange-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-600" />
            <h3 className="font-bold text-orange-900">
              Passenger Already Exists
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-orange-400 hover:text-orange-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-700">
            We found a passenger with similar information already in the system:
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
            <p className="text-sm font-bold text-gray-900">
              {duplicatePassenger.name}
            </p>
            {duplicatePassenger.phone && (
              <p className="text-xs text-gray-600">
                Phone: {duplicatePassenger.phone}
              </p>
            )}
            {duplicatePassenger.email && (
              <p className="text-xs text-gray-500">
                Email: {duplicatePassenger.email}
              </p>
            )}
          </div>

          <p className="text-xs text-gray-600">
            Would you like to use the existing passenger record, or continue
            creating a new one anyway?
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onUseDuplicate}
              className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Use Existing Passenger
            </button>
            <button
              onClick={onContinueAnyway}
              className="w-full py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Create New Record Anyway
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
