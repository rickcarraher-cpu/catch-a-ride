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
  Pencil,
  Repeat,
  PlayCircle,
  Users,
} from "lucide-react";
import { toast } from "@/utils/notify";
import BackToDashboard from "@/components/BackToDashboard";
import { buildChicagoTimestamp } from "@/utils/timezone";

export default function AdminManageAvailabilityPage() {
  const queryClient = useQueryClient();
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [activeTab, setActiveTab] = useState("one-time"); // "one-time" or "recurring"
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);

  // Fetch all drivers
  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    staleTime: 0,
  });

  // Fetch blocked times for selected driver
  const { data: blockedTimes, isLoading: loadingBlocked } = useQuery({
    queryKey: ["driver-blocked-times", selectedDriverId],
    queryFn: async () => {
      if (!selectedDriverId) return [];
      const res = await fetch(
        `/api/blocked-times?employee_id=${selectedDriverId}`,
      );
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
    enabled: !!selectedDriverId,
  });

  // Fetch recurring blocked times for selected driver
  const { data: recurringBlocks, isLoading: loadingRecurring } = useQuery({
    queryKey: ["driver-recurring-blocks", selectedDriverId],
    queryFn: async () => {
      if (!selectedDriverId) return [];
      const res = await fetch("/api/blocked-times/recurring");
      if (!res.ok) throw new Error("Failed to fetch recurring blocks");
      const data = await res.json();
      return data.filter((s) => s.employee_id === Number(selectedDriverId));
    },
    enabled: !!selectedDriverId,
  });

  // Delete one-time blocked time
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete blocked time");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["driver-blocked-times", selectedDriverId],
      });
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      toast.success("Blocked time removed");
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete recurring series
  const deleteRecurringMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/recurring/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete recurring series");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["driver-recurring-blocks", selectedDriverId],
      });
      queryClient.invalidateQueries({ queryKey: ["recurring-blocked-times"] });
      toast.success("Recurring series removed");
    },
    onError: (err) => toast.error(err.message),
  });

  // Generate blocked times from recurring series
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
      queryClient.invalidateQueries({
        queryKey: ["driver-blocked-times", selectedDriverId],
      });
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      toast.success(
        `Generated ${data.generated || 0} blocked time${data.generated !== 1 ? "s" : ""}`,
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const selectedDriver = drivers?.find(
    (d) => String(d.id) === String(selectedDriverId),
  );

  // Separate blocked times into upcoming and past
  const { upcoming, past } = useMemo(() => {
    if (!blockedTimes) return { upcoming: [], past: [] };
    const now = new Date();
    const u = [];
    const p = [];
    blockedTimes.forEach((bt) => {
      const endDate = new Date(bt.end_time);
      if (endDate >= now) {
        u.push(bt);
      } else {
        p.push(bt);
      }
    });
    return { upcoming: u, past: p };
  }, [blockedTimes]);

  return (
    <>
      <div className="space-y-6">
        <BackToDashboard />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Manage Driver Availability
            </h1>
            <p className="text-gray-500 mt-1">
              Select a driver to manage their blocked times and working hours.
            </p>
          </div>

          {/* Driver Selection Dropdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Users size={16} />
              Select Driver
            </label>
            <div className="relative">
              <select
                value={selectedDriverId}
                onChange={(e) => {
                  setSelectedDriverId(e.target.value);
                  setActiveTab("one-time");
                }}
                className="w-full appearance-none px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
              >
                <option value="">Choose a driver...</option>
                {drivers
                  ?.slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {!d.is_active ? " (Inactive)" : ""}
                    </option>
                  ))}
              </select>
              <ChevronDown
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Show content only when driver is selected */}
        {selectedDriverId && selectedDriver ? (
          <>
            {/* Driver Info Card */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                  style={{ backgroundColor: selectedDriver.color || "#2563EB" }}
                >
                  {selectedDriver.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedDriver.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                    {selectedDriver.phone && (
                      <span>{selectedDriver.phone}</span>
                    )}
                    {selectedDriver.phone && selectedDriver.email && (
                      <span className="text-gray-300">•</span>
                    )}
                    {selectedDriver.email && (
                      <span>{selectedDriver.email}</span>
                    )}
                  </div>
                </div>
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

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
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

            {/* Content Area */}
            {activeTab === "one-time" ? (
              <>
                {/* Upcoming Blocked Times */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarDays size={18} className="text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Upcoming & Active ({upcoming.length})
                    </h3>
                  </div>

                  {loadingBlocked ? (
                    <div className="text-center py-8 text-gray-500">
                      Loading blocked times...
                    </div>
                  ) : upcoming.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarX2
                        size={40}
                        className="mx-auto text-gray-300 mb-2"
                      />
                      <p className="text-gray-500">No upcoming blocked times</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Click "Block Time" above to add time off
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcoming.map((bt) => (
                        <BlockedTimeCard
                          key={bt.id}
                          blockedTime={bt}
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
                    </div>
                  )}
                </div>

                {/* Past Blocked Times */}
                {past.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock size={18} className="text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-600">
                        Past ({past.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {past.slice(0, 5).map((bt) => {
                        const startDate = new Date(bt.start_time);
                        const endDate = new Date(bt.end_time);
                        const sameDay =
                          startDate.toDateString() === endDate.toDateString();
                        const dateLabel = sameDay
                          ? startDate.toLocaleDateString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })
                          : `${startDate.toLocaleDateString([], { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;

                        return (
                          <div
                            key={bt.id}
                            className="flex items-center justify-between rounded-lg px-4 py-2 bg-gray-50 border border-gray-100 opacity-60"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-500">
                                {dateLabel}
                              </p>
                              {bt.reason && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {bt.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {past.length > 5 && (
                      <p className="text-xs text-gray-400 text-center mt-3">
                        Showing 5 of {past.length} past blocked times
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Recurring Tab
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Repeat size={18} className="text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Recurring Series ({recurringBlocks?.length || 0})
                  </h3>
                </div>

                {loadingRecurring ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading recurring series...
                  </div>
                ) : !recurringBlocks || recurringBlocks.length === 0 ? (
                  <div className="text-center py-10">
                    <Repeat
                      size={40}
                      className="mx-auto text-gray-300 mb-3"
                      strokeWidth={1.5}
                    />
                    <p className="text-gray-500 font-medium">
                      No recurring series yet
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Click "New Recurring" above to set one up
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recurringBlocks.map((series) => (
                      <RecurringSeriesCard
                        key={series.id}
                        series={series}
                        onEdit={() => {
                          setEditingRecurring(series);
                          setIsRecurringModalOpen(true);
                        }}
                        onDelete={() => {
                          if (confirm("Delete this recurring series?")) {
                            deleteRecurringMutation.mutate(series.id);
                          }
                        }}
                        onGenerate={() => generateMutation.mutate(series.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No driver selected</p>
            <p className="text-sm text-gray-400 mt-1">
              Select a driver from the dropdown above to manage their
              availability
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && selectedDriverId && (
        <BlockedTimeModal
          editingBlock={editingBlock}
          driverId={selectedDriverId}
          driverName={selectedDriver?.name}
          onClose={() => {
            setIsModalOpen(false);
            setEditingBlock(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingBlock(null);
            queryClient.invalidateQueries({
              queryKey: ["driver-blocked-times", selectedDriverId],
            });
            queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
          }}
        />
      )}

      {/* Recurring Modal */}
      {isRecurringModalOpen && selectedDriverId && (
        <RecurringBlockedTimeModal
          editingSeries={editingRecurring}
          driverId={selectedDriverId}
          driverName={selectedDriver?.name}
          onClose={() => {
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
          }}
          onSuccess={() => {
            setIsRecurringModalOpen(false);
            setEditingRecurring(null);
            queryClient.invalidateQueries({
              queryKey: ["driver-recurring-blocks", selectedDriverId],
            });
            queryClient.invalidateQueries({
              queryKey: ["recurring-blocked-times"],
            });
          }}
        />
      )}
    </>
  );
}

// ── Blocked Time Card ─────────────────────────────────────────────────────────
function BlockedTimeCard({ blockedTime, onEdit, onDelete }) {
  const startDate = new Date(blockedTime.start_time);
  const endDate = new Date(blockedTime.end_time);
  const now = new Date();

  const sameDay = startDate.toDateString() === endDate.toDateString();
  const isAllDay =
    startDate.getHours() === 0 &&
    startDate.getMinutes() === 0 &&
    endDate.getHours() === 23 &&
    endDate.getMinutes() === 59;

  const dateLabel = sameDay
    ? startDate.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : `${startDate.toLocaleDateString([], { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;

  const timeLabel = isAllDay
    ? "All day"
    : `${startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

  const isActive = startDate <= now && endDate >= now;

  return (
    <div
      className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
        isActive ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium ${
              isActive ? "text-red-900" : "text-gray-900"
            }`}
          >
            {dateLabel}
          </p>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded ${
              isActive ? "bg-red-200 text-red-700" : "bg-gray-200 text-gray-700"
            }`}
          >
            {timeLabel}
          </span>
          {isActive && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-600 text-white">
              ACTIVE
            </span>
          )}
        </div>
        {blockedTime.reason && (
          <p className="text-xs text-gray-600 mt-1">{blockedTime.reason}</p>
        )}
      </div>
      <div className="flex items-center gap-1 ml-3">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Recurring Series Card ─────────────────────────────────────────────────────
function RecurringSeriesCard({ series, onEdit, onDelete, onGenerate }) {
  const frequencyLabels = {
    daily: "Daily",
    weekly: "Weekly",
    "bi-weekly": "Bi-Weekly",
    monthly: "Monthly",
  };
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const freqDisplay =
    series.frequency === "weekly" || series.frequency === "bi-weekly"
      ? `${frequencyLabels[series.frequency]} (${dayNames[series.day_of_week] ?? "?"})`
      : frequencyLabels[series.frequency] || series.frequency;

  return (
    <div className="flex items-center justify-between rounded-lg px-4 py-3 bg-purple-50 border border-purple-100">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">
            {freqDisplay}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-100 text-purple-700">
            {series.start_time} – {series.end_time}
          </span>
          <span className="text-xs text-gray-500">
            {series.num_occurrences > 0
              ? `${series.num_occurrences} times`
              : "Unlimited"}
          </span>
        </div>
        {series.reason && (
          <p className="text-xs text-gray-500 mt-1">{series.reason}</p>
        )}
      </div>
      <div className="flex items-center gap-1 ml-3 shrink-0">
        <button
          onClick={onGenerate}
          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          title="Generate"
        >
          <PlayCircle size={15} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Blocked Time Modal ────────────────────────────────────────────────────────
function BlockedTimeModal({
  editingBlock,
  driverId,
  driverName,
  onClose,
  onSuccess,
}) {
  const isEditing = !!editingBlock;

  const parseExisting = () => {
    if (!editingBlock) {
      return {
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

    const pad = (n) => String(n).padStart(2, "0");
    const sYear = s.getFullYear();
    const sMonth = pad(s.getMonth() + 1);
    const sDay = pad(s.getDate());
    const eYear = e.getFullYear();
    const eMonth = pad(e.getMonth() + 1);
    const eDay = pad(e.getDate());

    const isAllDay =
      s.getHours() === 0 &&
      s.getMinutes() === 0 &&
      e.getHours() === 23 &&
      e.getMinutes() === 59;

    return {
      start_date: `${sYear}-${sMonth}-${sDay}`,
      start_time_val: isAllDay
        ? "09:00"
        : `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      end_date: `${eYear}-${eMonth}-${eDay}`,
      end_time_val: isAllDay
        ? "17:00"
        : `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      all_day: isAllDay,
      reason: editingBlock.reason || "",
      type: editingBlock.type || "blocked",
    };
  };

  const [form, setForm] = useState(parseExisting);

  const saveMutation = useMutation({
    mutationFn: async () => {
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
            employee_id: Number(driverId),
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
            employee_id: Number(driverId),
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
      toast.success(isEditing ? "Entry updated" : "Entry added");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const canSave = form.start_date;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${form.type === "available" ? "bg-green-100" : "bg-red-100"}`}
            >
              <CalendarX2
                size={18}
                className={
                  form.type === "available" ? "text-green-600" : "text-red-600"
                }
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Entry" : "Add Availability Entry"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{driverName}</p>
            </div>
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
                  name="admin-bt-type"
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
                  name="admin-bt-type"
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
            className={`px-6 py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${form.type === "available" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {saveMutation.isPending
              ? "Saving..."
              : isEditing
                ? `Update ${form.type === "available" ? "Available" : "Block"}`
                : form.type === "available"
                  ? "Add Available Hours"
                  : "Block This Time"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Blocked Time Modal ──────────────────────────────────────────────
function RecurringBlockedTimeModal({
  editingSeries,
  driverId,
  driverName,
  onClose,
  onSuccess,
}) {
  const isEditing = !!editingSeries;

  const [form, setForm] = useState(() => {
    if (!editingSeries) {
      return {
        start_time: "09:00",
        end_time: "17:00",
        frequency: "weekly",
        day_of_week: 1,
        reason: "",
        num_occurrences: 0,
        type: "blocked",
      };
    }
    return {
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
        employee_id: Number(driverId),
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

  const canSave = form.start_time && form.end_time && form.frequency;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
              <Repeat size={18} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Recurring Series" : "New Recurring Series"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{driverName}</p>
            </div>
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
                  name="admin-recurring-type"
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
                  name="admin-recurring-type"
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

          {/* Day of week */}
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
