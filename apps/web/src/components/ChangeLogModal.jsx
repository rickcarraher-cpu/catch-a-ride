"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  Edit3,
  Trash2,
  PlusCircle,
} from "lucide-react";

const ACTION_CONFIG = {
  created: {
    label: "Created",
    icon: PlusCircle,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  updated: {
    label: "Updated",
    icon: Edit3,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
  },
  deleted: {
    label: "Deleted",
    icon: Trash2,
    color: "text-gray-500",
    bg: "bg-gray-50 border-gray-200",
  },
};

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

export default function ChangeLogModal({ onClose }) {
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["change-log"],
    queryFn: async () => {
      const res = await fetch("/api/change-log?limit=500");
      if (!res.ok) throw new Error("Failed to load change log");
      return res.json();
    },
    staleTime: 1000 * 30,
  });

  const entries = data?.entries || [];

  const filtered = entries.filter((e) => {
    const matchesAction =
      filterAction === "all" || e.action_type === filterAction;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      (e.booking_number || "").toLowerCase().includes(searchLower) ||
      (e.passenger_name || "").toLowerCase().includes(searchLower) ||
      (e.changed_by || "").toLowerCase().includes(searchLower) ||
      (e.changed_fields || []).some((f) =>
        f.toLowerCase().includes(searchLower),
      );
    return matchesAction && matchesSearch;
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Change Log</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              All-time record of trip changes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by booking #, passenger, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">All actions</option>
            <option value="created">Created</option>
            <option value="updated">Updated</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        {/* Count */}
        <div className="px-6 py-2 text-xs text-gray-400">
          {isLoading
            ? "Loading..."
            : `${filtered.length} ${filtered.length === 1 ? "entry" : "entries"}`}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Clock size={24} className="animate-spin mr-2" />
              Loading...
            </div>
          )}

          {error && (
            <div className="text-center py-16 text-red-500 text-sm">
              Failed to load change log.
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              No entries found.
            </div>
          )}

          {!isLoading && !error && filtered.length > 0 && (
            <div className="space-y-3 mt-2">
              {filtered.map((entry) => {
                const config =
                  ACTION_CONFIG[entry.action_type] || ACTION_CONFIG.updated;
                const Icon = config.icon;
                return (
                  <div
                    key={entry.id}
                    className={`border rounded-xl p-4 ${config.bg}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Icon
                          size={18}
                          className={`mt-0.5 flex-shrink-0 ${config.color}`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${config.color}`}
                            >
                              {config.label}
                            </span>
                            {entry.booking_number && (
                              <span className="text-sm font-medium text-gray-700">
                                Trip #{entry.booking_number}
                              </span>
                            )}
                            {entry.passenger_name && (
                              <span className="text-sm text-gray-600">
                                — {entry.passenger_name}
                              </span>
                            )}
                          </div>

                          {entry.changed_fields &&
                            entry.changed_fields.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {entry.changed_fields.map((field, i) => (
                                  <span
                                    key={i}
                                    className="inline-block bg-white border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full"
                                  >
                                    {field}
                                  </span>
                                ))}
                              </div>
                            )}

                          <div className="mt-1.5 text-xs text-gray-500">
                            by{" "}
                            <span className="font-medium text-gray-700">
                              {entry.changed_by || "unknown"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {formatDate(entry.changed_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
