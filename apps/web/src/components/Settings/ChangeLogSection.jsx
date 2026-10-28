"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";

async function fetchChangeLog(limit) {
  const res = await fetch(`/api/change-log?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch change log");
  return res.json();
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ACTION_COLORS = {
  created: "bg-green-100 text-green-800",
  updated: "bg-blue-100 text-blue-800",
  deleted: "bg-red-100 text-red-800",
  cancelled: "bg-orange-100 text-orange-800",
  payment: "bg-purple-100 text-purple-800",
};

function getActionColor(action) {
  if (!action) return "bg-gray-100 text-gray-700";
  const key = action.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(ACTION_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-100 text-gray-700";
}

export function ChangeLogSection() {
  const [limit, setLimit] = useState(100);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["change-log", limit],
    queryFn: () => fetchChangeLog(limit),
    staleTime: 30_000,
  });

  const entries = data?.entries || [];

  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return (
          (e.booking_number || "").toLowerCase().includes(q) ||
          (e.passenger_name || "").toLowerCase().includes(q) ||
          (e.changed_by || "").toLowerCase().includes(q) ||
          (e.action_type || "").toLowerCase().includes(q) ||
          (e.notes || "").toLowerCase().includes(q) ||
          (e.changed_fields || []).some((f) => f.toLowerCase().includes(q))
        );
      })
    : entries;

  const toggleRow = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-indigo-600" />
          <h3 className="text-base font-semibold text-gray-800">Change Log</h3>
          <span className="text-xs text-gray-400">
            recent trip & data changes
          </span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Search + Limit */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by booking #, passenger, user, action…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
          <option value={200}>Last 200</option>
          <option value={500}>Last 500</option>
        </select>
      </div>

      {/* State: loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <div className="h-4 w-4 border-2 border-indigo-500 border-r-transparent rounded-full animate-spin" />
          Loading change log…
        </div>
      )}

      {/* State: error */}
      {isError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          Failed to load change log. Try refreshing.
        </div>
      )}

      {/* State: empty */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-sm text-gray-400 py-4 text-center">
          {search
            ? "No entries match your search."
            : "No change log entries found."}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                  When
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Booking #
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Passenger
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Action
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">
                  Changed By
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">
                  Fields Changed
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((entry) => {
                const isOpen = expanded[entry.id];
                const fields = entry.changed_fields || [];
                const MAX_FIELDS = 3;
                const visibleFields = isOpen
                  ? fields
                  : fields.slice(0, MAX_FIELDS);
                const hasMore = fields.length > MAX_FIELDS;

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {formatDate(entry.changed_at)}
                    </td>
                    <td className="px-3 py-2.5 font-mono font-medium text-gray-800 whitespace-nowrap">
                      {entry.booking_number ? (
                        <a
                          href={`/trips?booking=${entry.booking_number}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {entry.booking_number}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                      {entry.passenger_name || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${getActionColor(entry.action_type)}`}
                      >
                        {entry.action_type || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {entry.changed_by || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {fields.length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 items-center">
                          {visibleFields.map((f, i) => (
                            <span
                              key={i}
                              className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[11px]"
                            >
                              {f}
                            </span>
                          ))}
                          {hasMore && (
                            <button
                              onClick={() => toggleRow(entry.id)}
                              className="flex items-center gap-0.5 text-indigo-600 hover:text-indigo-800 text-[11px] font-medium"
                            >
                              {isOpen ? (
                                <>
                                  <ChevronUp size={12} /> less
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={12} /> +
                                  {fields.length - MAX_FIELDS} more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[200px] truncate">
                      {entry.notes || <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-gray-400">
          Showing {filtered.length}{" "}
          {filtered.length === 1 ? "entry" : "entries"}
          {search ? " (filtered)" : ""}
        </p>
      )}
    </div>
  );
}
