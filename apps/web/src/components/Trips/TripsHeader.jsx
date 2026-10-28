import { Plus, FileText, List, Calendar, History, Info } from "lucide-react";
import { useState } from "react";

export function TripsHeader({
  onNewTrip,
  onViewAllTripsReport,
  totalCount,
  filteredCount,
  isSearchActive,
}) {
  const [showMethodInfo, setShowMethodInfo] = useState(false);
  const showCount = typeof totalCount === "number";
  const isFiltered =
    showCount &&
    typeof filteredCount === "number" &&
    filteredCount !== totalCount;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">
            Trips
          </h1>
          <div className="relative">
            <button
              onMouseEnter={() => setShowMethodInfo(true)}
              onMouseLeave={() => setShowMethodInfo(false)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="Distance calculation methods"
            >
              <Info size={16} />
            </button>
            {showMethodInfo && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50 text-sm">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-500" />
                  Distance Calculation Methods
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 shrink-0">
                      OSRM
                    </span>
                    <span className="text-gray-600">
                      Free OpenStreetMap routing (most common)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 shrink-0">
                      Valhalla
                    </span>
                    <span className="text-gray-600">
                      Alternate free routing service
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 shrink-0">
                      Google Routes
                    </span>
                    <span className="text-gray-600">
                      Google's premium routing API
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 shrink-0">
                      Google Matrix
                    </span>
                    <span className="text-gray-600">
                      Google Distance Matrix API
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 shrink-0">
                      Estimate
                    </span>
                    <span className="text-gray-600">
                      Straight-line × 1.6 (verify manually)
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                  The system tries multiple APIs in order until one succeeds.
                  Estimates are used only when all routing services fail.
                </p>
              </div>
            )}
          </div>
          {showCount && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {isFiltered ? `${filteredCount} / ${totalCount}` : totalCount}
            </span>
          )}
          {/* Show "All Time" indicator always */}
          {!isSearchActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
              <Calendar size={11} />
              All Time
            </span>
          )}
          {isSearchActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Searching all trips...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Date window toggle removed */}
          {onViewAllTripsReport && (
            <button
              onClick={onViewAllTripsReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <List size={14} />
              All Trips
            </button>
          )}
          <button
            onClick={onNewTrip}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            New Trip
          </button>
        </div>
      </div>
    </div>
  );
}
