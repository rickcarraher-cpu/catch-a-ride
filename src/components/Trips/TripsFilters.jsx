import { Search, Filter } from "lucide-react";

export function TripsFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  searchType = "passenger",
  onSearchTypeChange,
}) {
  return (
    <div className="flex flex-col md:flex-row gap-2">
      <div className="flex-1 space-y-2">
        {/* Search Type Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSearchTypeChange("passenger")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              searchType === "passenger"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Passenger
          </button>
          <button
            onClick={() => onSearchTypeChange("booking")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              searchType === "booking"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Booking #
          </button>
          <button
            onClick={() => onSearchTypeChange("driver")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              searchType === "driver"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Driver
          </button>
          <button
            onClick={() => onSearchTypeChange("destination")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              searchType === "destination"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Destination
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder={
              searchType === "passenger"
                ? "Search by passenger name or phone..."
                : searchType === "booking"
                  ? "Search by booking number..."
                  : searchType === "driver"
                    ? "Search by driver name..."
                    : "Search by destination..."
            }
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="text-gray-400" size={16} />
        <select
          className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="quote">Quote</option>
          <option value="needs_review">Needs Review</option>
          <option value="pending">Pending</option>
          <option value="tentative">Tentative</option>
          <option value="confirmed">Confirmed</option>
          <option value="approved">Approved</option>
          <option value="in-progress">In Progress</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no-show">No Show</option>
        </select>
      </div>
    </div>
  );
}
