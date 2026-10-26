import { Plus, Printer } from "lucide-react";

export function DriversHeader({ onAddDriver, onPrint, isLoading, hasDrivers }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Drivers
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your team and their commission rates.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrint}
          disabled={isLoading || !hasDrivers}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer size={18} />
          Print List
        </button>
        <button
          onClick={onAddDriver}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Add Driver
        </button>
      </div>
    </div>
  );
}
