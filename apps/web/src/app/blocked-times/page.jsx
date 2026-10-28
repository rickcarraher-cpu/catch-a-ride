"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarX2,
  Plus,
  Search,
  Trash2,
  XCircle,
  ChevronDown,
  Clock,
  CalendarDays,
  User,
  Filter,
  Pencil,
  Repeat,
  PlayCircle,
} from "lucide-react";
import { toast } from "@/utils/notify";
import BackToDashboard from "@/components/BackToDashboard";
import { buildChicagoTimestamp } from "@/utils/timezone";

export default function BlockedTimesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("one-time"); // "one-time" or "recurring"
  const [search, setSearch] = useState("");
  const [filterDriver, setFilterDriver] = useState("all");
  const [filterStatus, setFilterStatus] = useState("upcoming");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);

  // Fetch all blocked times
  const { data: blockedTimes, isLoading } = useQuery({
    queryKey: ["all-blocked-times"],
    queryFn: async () => {
      const res = await fetch("/api/blocked-times");
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
  });

  // Fetch recurring blocked times
  const { data: recurringBlocks, isLoading: isLoadingRecurring } = useQuery({
    queryKey: ["recurring-blocked-times"],
    queryFn: async () => {
      const res = await fetch("/api/blocked-times/recurring");
      if (!res.ok) throw new Error("Failed to fetch recurring blocked times");
      return res.json();
    },
  });

  // Fetch drivers
  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    staleTime: 0,
    retry: 2,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete blocked time");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      queryClient.invalidateQueries({ queryKey: ["blockedTimes"] });
      toast.success("Blocked time removed");
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete recurring mutation
  const deleteRecurringMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/recurring/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete recurring series");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-times"] });
      toast.success("Recurring series removed");
    },
    onError: (err) => toast.error(err.message),
  });

  // Cleanup past blocked times mutation
  const cleanupPastMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/blocked-times/cleanup-past", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clean up past blocked times");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      queryClient.invalidateQueries({ queryKey: ["blockedTimes"] });
      toast.success(data.message || "Past blocked times removed");
    },
    onError: (err) => toast.error(err.message),
  });

  // Generate blocked times mutation
  const generateMutation = useMutation({
    mutationFn: async (recurring_id = null) => {
      const res = await fetch("/api/blocked-times/recurring/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days_ahead: 30,
          recurring_id,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate blocked times");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      queryClient.invalidateQueries({ queryKey: ["blockedTimes"] });
      toast.success(
        `Generated ${data.generated || 0} blocked time${data.generated !== 1 ? "s" : ""}`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  // Filtering and sorting
  const filtered = useMemo(() => {
    if (!blockedTimes) return [];
    const now = new Date();

    return blockedTimes
      .filter((bt) => {
        // Driver filter
        if (filterDriver !== "all" && bt.employee_id !== Number(filterDriver)) {
          return false;
        }

        // Status filter
        const endDate = new Date(bt.end_time);
        const startDate = new Date(bt.start_time);
        if (filterStatus === "upcoming" && endDate < now) return false;
        if (filterStatus === "past" && endDate >= now) return false;
        if (filterStatus === "active" && (startDate > now || endDate < now))
          return false;

        // Search
        if (search) {
          const term = search.toLowerCase();
          const matchesName = bt.employee_name?.toLowerCase().includes(term);
          const matchesReason = bt.reason?.toLowerCase().includes(term);
          if (!matchesName && !matchesReason) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [blockedTimes, filterDriver, filterStatus, search]);

  // Stats
  const stats = useMemo(() => {
    if (!blockedTimes) return { total: 0, active: 0, upcoming: 0, past: 0 };
    const now = new Date();
    let active = 0;
    let upcoming = 0;
    let past = 0;
    blockedTimes.forEach((bt) => {
      const start = new Date(bt.start_time);
      const end = new Date(bt.end_time);
      if (end < now) past++;
      else if (start > now) upcoming++;
      else active++;
    });
    return { total: blockedTimes.length, active, upcoming, past };
  }, [blockedTimes]);

  return (
    <>
      <div className="space-y-6">
        <BackToDashboard />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Blocked Times
            </h1>
            <p className="text-gray-500 mt-1">
              Manage driver availability and time-off blocks.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                if (confirm("Remove all past blocked times from the system?")) {
                  cleanupPastMutation.mutate();
                }
              }}
              disabled={cleanupPastMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              {cleanupPastMutation.isPending ? "Cleaning..." : "Clean Up Past"}
            </button>
            {activeTab === "one-time" ? (
              <button
                onClick={() => {
                  setEditingBlock(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <Plus size={18} />
                Block Time
              </button>
            ) : (
              <>
                <button
                  onClick={() => generateMutation.mutate(null)}
                  disabled={generateMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <PlayCircle size={18} />
                  {generateMutation.isPending
                    ? "Generating..."
                    : "Generate All"}
                </button>
                <button
                  onClick={() => {
                    setEditingRecurring(null);
                    setIsRecurringModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Plus size={18} />
                  New Recurring
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("one-time")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "one-time"
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            One-Time Blocks
          </button>
          <button
            onClick={() => setActiveTab("recurring")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 inline-flex items-center gap-2 ${
              activeTab === "recurring"
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Repeat size={16} />
            Recurring Series
          </button>
        </div>

        {activeTab === "one-time" ? (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Blocks"
                value={stats.total}
                icon={CalendarX2}
                color="gray"
              />
              <StatCard
                label="Active Now"
                value={stats.active}
                icon={Clock}
                color="red"
              />
              <StatCard
                label="Upcoming"
                value={stats.upcoming}
                icon={CalendarDays}
                color="amber"
              />
              <StatCard
                label="Past"
                value={stats.past}
                icon={CalendarDays}
                color="gray"
                muted
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search by driver name or reason..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                {/* Driver filter */}
                <div className="relative">
                  <select
                    value={filterDriver}
                    onChange={(e) => setFilterDriver(e.target.value)}
                    className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="all">All Drivers</option>
                    {drivers?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>

                {/* Status filter */}
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active Now</option>
                    <option value="upcoming">Upcoming & Active</option>
                    <option value="past">Past</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {isLoading ? (
                <div className="py-16 text-center text-gray-500">
                  Loading blocked times...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarX2
                    size={40}
                    className="mx-auto text-gray-300 mb-3"
                    strokeWidth={1.5}
                  />
                  <p className="text-gray-500 font-medium">
                    No blocked times found
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    {search ||
                    filterDriver !== "all" ||
                    filterStatus !== "upcoming"
                      ? "Try adjusting your filters."
                      : "Add a block to get started."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Driver
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Date Range
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Reason
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((bt) => (
                        <BlockedTimeRow
                          key={bt.id}
                          bt={bt}
                          onEdit={() => {
                            setEditingBlock(bt);
                            setIsModalOpen(true);
                          }}
                          onDelete={() => {
                            if (confirm("Remove this blocked time?")) {
                              deleteMutation.mutate(bt.id);
                            }
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Count footer */}
            {!isLoading && filtered.length > 0 && (
              <p className="text-xs text-gray-400 text-right">
                Showing {filtered.length} of {blockedTimes?.length || 0} blocked
                time{blockedTimes?.length !== 1 ? "s" : ""}
              </p>
            )}
          </>
        ) : (
          <RecurringSection
            recurringBlocks={recurringBlocks || []}
            isLoading={isLoadingRecurring}
            drivers={drivers || []}
            onEdit={(series) => {
              setEditingRecurring(series);
              setIsRecurringModalOpen(true);
            }}
            onDelete={(id) => {
              if (confirm("Delete this recurring series?")) {
                deleteRecurringMutation.mutate(id);
              }
            }}
            onGenerate={(id) => generateMutation.mutate(id)}
            filterDriver={filterDriver}
            setFilterDriver={setFilterDriver}
            search={search}
            setSearch={setSearch}
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <BlockedTimeModal
          editingBlock={editingBlock}
          drivers={drivers || []}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBlock(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingBlock(null);
            queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
          }}
        />
      )}

      {/* Recurring Modal */}
      {isRecurringModalOpen && (
        <RecurringBlockedTimeModal
          editingSeries={editingRecurring}
          drivers={drivers || []}
          onClose={() => {
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
          }}
          onSuccess={() => {
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
            queryClient.invalidateQueries({
              queryKey: ["recurring-blocked-times"],
            });
          }}
        />
      )}
    </>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, muted }) {
  const colorMap = {
    gray: "bg-gray-50 text-gray-600 border-gray-200",
    red: "bg-red-50 text-red-600 border-red-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
  };
  const iconColorMap = {
    gray: "text-gray-400",
    red: "text-red-400",
    amber: "text-amber-400",
  };

  return (
    <div
      className={`rounded-xl border p-4 ${colorMap[color]} ${muted ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon size={18} className={iconColorMap[color]} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

// ── Table Row ─────────────────────────────────────────────────────────────────
function BlockedTimeRow({ bt, onEdit, onDelete }) {
  const startDate = new Date(bt.start_time);
  const endDate = new Date(bt.end_time);
  const now = new Date();

  const isPast = endDate < now;
  const isActive = startDate <= now && endDate >= now;

  // Use CDT for same-day comparison
  const startDateStr = startDate.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
  });
  const endDateStr = endDate.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
  });
  const sameDay = startDateStr === endDateStr;

  // Check all-day using CDT hours
  const startHourCDT = Number(
    startDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }),
  );
  const startMinCDT = Number(
    startDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      minute: "numeric",
    }),
  );
  const endHourCDT = Number(
    endDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      hour12: false,
    }),
  );
  const endMinCDT = Number(
    endDate.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      minute: "numeric",
    }),
  );

  const isAllDay =
    startHourCDT === 0 &&
    startMinCDT === 0 &&
    endHourCDT === 23 &&
    endMinCDT === 59;

  const tzOpts = { timeZone: "America/Chicago" };

  const dateLabel = sameDay
    ? startDate.toLocaleDateString("en-US", {
        ...tzOpts,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : `${startDate.toLocaleDateString("en-US", { ...tzOpts, month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { ...tzOpts, month: "short", day: "numeric", year: "numeric" })}`;

  const timeLabel = isAllDay
    ? "All Day"
    : `${startDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })}`;

  const statusLabel = isPast ? "Past" : isActive ? "Active" : "Upcoming";
  const statusStyles = isPast
    ? "bg-gray-100 text-gray-500"
    : isActive
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700";

  return (
    <tr
      className={`hover:bg-gray-50 transition-colors ${isPast ? "opacity-50" : ""}`}
    >
      {/* Driver */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: bt.employee_color || "#6B7280" }}
          >
            {bt.employee_name?.charAt(0) || "?"}
          </div>
          <span className="font-medium text-gray-900">
            {bt.employee_name || "Unknown"}
          </span>
        </div>
      </td>

      {/* Date Range */}
      <td className="px-4 py-3 text-gray-700">{dateLabel}</td>

      {/* Time */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${isAllDay ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"}`}
        >
          <Clock size={10} />
          {timeLabel}
        </span>
      </td>

      {/* Reason */}
      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
        {bt.reason || (
          <span className="text-gray-300 italic">No reason given</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusStyles}`}
        >
          {statusLabel}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────────────────────
function BlockedTimeModal({ editingBlock, drivers, onClose, onSuccess }) {
  const isEditing = !!editingBlock;

  // Parse existing block into form values
  const parseExisting = () => {
    if (!editingBlock) {
      return {
        employee_id: "",
        start_date: "",
        start_time_val: "09:00",
        end_date: "",
        end_time_val: "17:00",
        all_day: true,
        reason: "",
        type: "blocked",
      };
    }
    const s = new Date(editingBlock.start_time);
    const e = new Date(editingBlock.end_time);

    // Use CDT for hour/minute extraction
    const pad = (n) => String(n).padStart(2, "0");

    // Extract date parts in CDT
    const sYear = s.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
    });
    const sMonth = pad(
      new Date(
        s.toLocaleString("en-US", { timeZone: "America/Chicago" }),
      ).getMonth() + 1,
    );
    const sDay = pad(
      Number(
        s.toLocaleString("en-US", {
          timeZone: "America/Chicago",
          day: "numeric",
        }),
      ),
    );
    const eYear = e.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
    });
    const eMonth = pad(
      new Date(
        e.toLocaleString("en-US", { timeZone: "America/Chicago" }),
      ).getMonth() + 1,
    );
    const eDay = pad(
      Number(
        e.toLocaleString("en-US", {
          timeZone: "America/Chicago",
          day: "numeric",
        }),
      ),
    );

    const sHour = Number(
      s.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hour12: false,
      }),
    );
    const sMin = Number(
      s.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        minute: "numeric",
      }),
    );
    const eHour = Number(
      e.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        hour12: false,
      }),
    );
    const eMin = Number(
      e.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        minute: "numeric",
      }),
    );

    const isAllDay = sHour === 0 && sMin === 0 && eHour === 23 && eMin === 59;

    return {
      employee_id: editingBlock.employee_id || "",
      start_date: `${sYear}-${sMonth}-${sDay}`,
      start_time_val: isAllDay ? "09:00" : `${pad(sHour)}:${pad(sMin)}`,
      end_date: `${eYear}-${eMonth}-${eDay}`,
      end_time_val: isAllDay ? "17:00" : `${pad(eHour)}:${pad(eMin)}`,
      all_day: isAllDay,
      reason: editingBlock.reason || "",
      type: editingBlock.type || "blocked",
    };
  };

  const [form, setForm] = useState(parseExisting);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Use buildChicagoTimestamp to properly handle DST (CDT vs CST)
      const startISO = form.all_day
        ? buildChicagoTimestamp(form.start_date, "00:00")
        : buildChicagoTimestamp(form.start_date, form.start_time_val);
      const endDate = form.end_date || form.start_date;
      const endISO = form.all_day
        ? buildChicagoTimestamp(endDate, "23:59")
        : buildChicagoTimestamp(endDate, form.end_time_val);

      if (isEditing) {
        const res = await fetch(`/api/blocked-times/${editingBlock.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            start_time: startISO,
            end_time: endISO,
            reason: form.reason || null,
            type: form.type,
          }),
        });
        if (!res.ok) throw new Error("Failed to update blocked time");
        return res.json();
      } else {
        const res = await fetch("/api/blocked-times", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: Number(form.employee_id),
            start_time: startISO,
            end_time: endISO,
            reason: form.reason || null,
            type: form.type,
          }),
        });
        if (!res.ok) throw new Error("Failed to create blocked time");
        return res.json();
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Blocked time updated" : "Blocked time added");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const canSave = form.start_date && form.employee_id;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
              <CalendarX2 size={18} className="text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Blocked Time" : "Block Time"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bt-type"
                  value="blocked"
                  checked={form.type === "blocked"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Blocked Hours
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bt-type"
                  value="available"
                  checked={form.type === "available"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Available Hours
                </span>
              </label>
            </div>
            <p className="text-[11px] text-gray-500">
              {form.type === "blocked"
                ? "Driver cannot work during these times"
                : "Driver can ONLY work during these times"}
            </p>
          </div>

          {/* Driver select - always shown */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Driver *
            </label>
            <div className="relative">
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 pr-8 cursor-pointer"
              >
                <option value="">Select a driver...</option>
                {drivers
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* All Day toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDayCheck"
              checked={form.all_day}
              onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label
              htmlFor="allDayCheck"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              All Day
            </label>
          </div>

          {/* Date fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Start Date *
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                value={form.start_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    start_date: e.target.value,
                    end_date: form.end_date || e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          {/* Time fields (if not all day) */}
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Start Time
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  value={form.start_time_val}
                  onChange={(e) =>
                    setForm({ ...form, start_time_val: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  End Time
                </label>
                <input
                  type="time"
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                  value={form.end_time_val}
                  onChange={(e) =>
                    setForm({ ...form, end_time_val: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Reason (optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              placeholder="e.g. Vacation, Car service, Day off..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="px-6 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending
              ? "Saving..."
              : isEditing
                ? "Update Block"
                : "Block Time"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Section ─────────────────────────────────────────────────────────
function RecurringSection({
  recurringBlocks,
  isLoading,
  drivers,
  onEdit,
  onDelete,
  onGenerate,
  filterDriver,
  setFilterDriver,
  search,
  setSearch,
}) {
  const filtered = useMemo(() => {
    return recurringBlocks.filter((series) => {
      if (
        filterDriver !== "all" &&
        series.employee_id !== Number(filterDriver)
      ) {
        return false;
      }
      if (search) {
        const term = search.toLowerCase();
        const matchesName = series.employee_name?.toLowerCase().includes(term);
        const matchesReason = series.reason?.toLowerCase().includes(term);
        if (!matchesName && !matchesReason) return false;
      }
      return true;
    });
  }, [recurringBlocks, filterDriver, search]);

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by driver name or reason..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <select
            value={filterDriver}
            onChange={(e) => setFilterDriver(e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
          >
            <option value="all">All Drivers</option>
            {drivers?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-500">
            Loading recurring series...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Repeat
              size={40}
              className="mx-auto text-gray-300 mb-3"
              strokeWidth={1.5}
            />
            <p className="text-gray-500 font-medium">
              No recurring series found
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {search || filterDriver !== "all"
                ? "Try adjusting your filters."
                : "Create a recurring series to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Occurrences
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((series) => (
                  <RecurringSeriesRow
                    key={series.id}
                    series={series}
                    onEdit={() => onEdit(series)}
                    onDelete={() => onDelete(series.id)}
                    onGenerate={() => onGenerate(series.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ── Recurring Series Row ──────────────────────────────────────────────────────
function RecurringSeriesRow({ series, onEdit, onDelete, onGenerate }) {
  const frequencyLabels = {
    daily: "Daily",
    weekly: "Weekly",
    "bi-weekly": "Bi-Weekly",
    monthly: "Monthly",
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const frequencyDisplay =
    series.frequency === "weekly" || series.frequency === "bi-weekly"
      ? `${frequencyLabels[series.frequency]} (${dayNames[series.day_of_week] || "?"})`
      : frequencyLabels[series.frequency] || series.frequency;

  const occurrencesDisplay =
    series.num_occurrences > 0
      ? `${series.num_occurrences} times`
      : "Unlimited";

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Driver */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: series.employee_color || "#6B7280" }}
          >
            {series.employee_name?.charAt(0) || "?"}
          </div>
          <span className="font-medium text-gray-900">
            {series.employee_name || "Unknown"}
          </span>
        </div>
      </td>

      {/* Time */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          <Clock size={10} />
          {series.start_time} – {series.end_time}
        </span>
      </td>

      {/* Frequency */}
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
          <Repeat size={10} />
          {frequencyDisplay}
        </span>
      </td>

      {/* Reason */}
      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
        {series.reason || (
          <span className="text-gray-300 italic">No reason given</span>
        )}
      </td>

      {/* Occurrences */}
      <td className="px-4 py-3 text-gray-700 text-xs">{occurrencesDisplay}</td>

      {/* Actions */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onGenerate}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Generate"
          >
            <PlayCircle size={14} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Recurring Blocked Time Modal ──────────────────────────────────────────────
function RecurringBlockedTimeModal({
  editingSeries,
  drivers,
  onClose,
  onSuccess,
}) {
  const isEditing = !!editingSeries;

  const [form, setForm] = useState(() => {
    if (!editingSeries) {
      return {
        employee_id: "",
        start_time: "09:00",
        end_time: "17:00",
        frequency: "weekly",
        day_of_week: 1, // Monday
        reason: "",
        num_occurrences: 0,
        type: "blocked",
      };
    }
    return {
      employee_id: editingSeries.employee_id || "",
      start_time: editingSeries.start_time || "09:00",
      end_time: editingSeries.end_time || "17:00",
      frequency: editingSeries.frequency || "weekly",
      day_of_week: editingSeries.day_of_week ?? 1,
      reason: editingSeries.reason || "",
      num_occurrences: editingSeries.num_occurrences || 0,
      type: editingSeries.type || "blocked",
    };
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: Number(form.employee_id),
        start_time: form.start_time,
        end_time: form.end_time,
        frequency: form.frequency,
        day_of_week:
          form.frequency === "weekly" || form.frequency === "bi-weekly"
            ? Number(form.day_of_week)
            : null,
        reason: form.reason || null,
        num_occurrences: Number(form.num_occurrences) || 0,
        type: form.type,
      };

      if (isEditing) {
        const res = await fetch(
          `/api/blocked-times/recurring/${editingSeries.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error("Failed to update recurring series");
        return res.json();
      } else {
        const res = await fetch("/api/blocked-times/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create recurring series");
        return res.json();
      }
    },
    onSuccess: () => {
      toast.success(
        isEditing ? "Recurring series updated" : "Recurring series created",
      );
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const canSave =
    form.employee_id && form.start_time && form.end_time && form.frequency;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Repeat size={18} className="text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Edit Recurring Series" : "New Recurring Series"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurring-type"
                  value="blocked"
                  checked={form.type === "blocked"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Blocked Hours
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="recurring-type"
                  value="available"
                  checked={form.type === "available"}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Available Hours
                </span>
              </label>
            </div>
            <p className="text-[11px] text-gray-500">
              {form.type === "blocked"
                ? "Driver cannot work during these times"
                : "Driver can ONLY work during these times"}
            </p>
          </div>

          {/* Driver select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Driver *
            </label>
            <div className="relative">
              <select
                value={form.employee_id}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
                className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 pr-8 cursor-pointer"
              >
                <option value="">Select a driver...</option>
                {drivers
                  .filter((d) => d.is_active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Start Time *
              </label>
              <input
                type="time"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                value={form.start_time}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                End Time *
              </label>
              <input
                type="time"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Frequency *
            </label>
            <div className="relative">
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({ ...form, frequency: e.target.value })
                }
                className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 pr-8 cursor-pointer"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>

          {/* Day of week (if weekly or bi-weekly) */}
          {(form.frequency === "weekly" || form.frequency === "bi-weekly") && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Day of Week *
              </label>
              <div className="relative">
                <select
                  value={form.day_of_week}
                  onChange={(e) =>
                    setForm({ ...form, day_of_week: e.target.value })
                  }
                  className="w-full appearance-none px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 pr-8 cursor-pointer"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            </div>
          )}

          {/* Number of occurrences */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Number of Occurrences (0 = unlimited)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              value={form.num_occurrences}
              onChange={(e) =>
                setForm({ ...form, num_occurrences: e.target.value })
              }
            />
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Reason (optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Weekly day off, Regular maintenance..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            className="px-6 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {saveMutation.isPending
              ? "Saving..."
              : isEditing
                ? "Update Series"
                : "Create Series"}
          </button>
        </div>
      </div>
    </div>
  );
}
