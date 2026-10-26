import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarX2, Trash2 } from "lucide-react";
import { toast } from "@/utils/notify";
import { buildChicagoTimestamp } from "@/utils/timezone";

export function BlockedTimesSection({ driver }) {
  const queryClient = useQueryClient();
  const [showAddBlocked, setShowAddBlocked] = useState(false);
  const [blockedForm, setBlockedForm] = useState({
    start_date: "",
    start_time_val: "09:00",
    end_date: "",
    end_time_val: "17:00",
    all_day: true,
    reason: "",
    type: "blocked",
  });

  const { data: blockedTimes, refetch: refetchBlocked } = useQuery({
    queryKey: ["blocked-times", driver?.id],
    queryFn: async () => {
      const res = await fetch(`/api/blocked-times?employee_id=${driver.id}`);
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
    enabled: !!driver?.id,
  });

  const addBlockedMutation = useMutation({
    mutationFn: async () => {
      // Use buildChicagoTimestamp to properly handle DST (CDT vs CST)
      const startISO = blockedForm.all_day
        ? buildChicagoTimestamp(blockedForm.start_date, "00:00")
        : buildChicagoTimestamp(
            blockedForm.start_date,
            blockedForm.start_time_val,
          );
      const endDate = blockedForm.end_date || blockedForm.start_date;
      const endISO = blockedForm.all_day
        ? buildChicagoTimestamp(endDate, "23:59")
        : buildChicagoTimestamp(endDate, blockedForm.end_time_val);

      const res = await fetch("/api/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: driver.id,
          start_time: startISO,
          end_time: endISO,
          reason: blockedForm.reason || null,
          type: blockedForm.type,
        }),
      });
      if (!res.ok) throw new Error("Failed to add blocked time");
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        blockedForm.type === "available"
          ? "Available hours added"
          : "Blocked time added",
      );
      setBlockedForm({
        start_date: "",
        start_time_val: "09:00",
        end_date: "",
        end_time_val: "17:00",
        all_day: true,
        reason: "",
        type: "blocked",
      });
      setShowAddBlocked(false);
      refetchBlocked();
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      queryClient.invalidateQueries({ queryKey: ["blockedTimes"] });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteBlockedMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete blocked time");
    },
    onSuccess: () => {
      toast.success("Blocked time removed");
      refetchBlocked();
      queryClient.invalidateQueries({ queryKey: ["all-blocked-times"] });
      queryClient.invalidateQueries({ queryKey: ["blockedTimes"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarX2 size={12} className="text-red-500" />
          Blocked / Available Times
        </label>
        <button
          type="button"
          onClick={() => setShowAddBlocked((v) => !v)}
          className="text-xs font-semibold text-red-600 hover:underline"
        >
          {showAddBlocked ? "Cancel" : "+ Add Time"}
        </button>
      </div>

      {/* Existing blocked times list */}
      {blockedTimes && blockedTimes.length > 0 ? (
        <div className="space-y-1.5">
          {blockedTimes.map((bt) => {
            const startDate = new Date(bt.start_time);
            const endDate = new Date(bt.end_time);
            const tz = "America/Chicago";
            const isAvailable = bt.type === "available";

            const startDateCDT = startDate.toLocaleDateString("en-US", {
              timeZone: tz,
            });
            const endDateCDT = endDate.toLocaleDateString("en-US", {
              timeZone: tz,
            });
            const sameDay = startDateCDT === endDateCDT;

            const startHourCDT = Number(
              startDate.toLocaleString("en-US", {
                timeZone: tz,
                hour: "numeric",
                hour12: false,
              }),
            );
            const startMinCDT = Number(
              startDate.toLocaleString("en-US", {
                timeZone: tz,
                minute: "numeric",
              }),
            );
            const endHourCDT = Number(
              endDate.toLocaleString("en-US", {
                timeZone: tz,
                hour: "numeric",
                hour12: false,
              }),
            );
            const endMinCDT = Number(
              endDate.toLocaleString("en-US", {
                timeZone: tz,
                minute: "numeric",
              }),
            );

            const isAllDay =
              startHourCDT === 0 &&
              startMinCDT === 0 &&
              endHourCDT === 23 &&
              endMinCDT === 59;
            const tzOpts = { timeZone: tz };

            const dateLabel = sameDay
              ? startDate.toLocaleDateString("en-US", {
                  ...tzOpts,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })
              : `${startDate.toLocaleDateString("en-US", { ...tzOpts, month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { ...tzOpts, month: "short", day: "numeric" })}`;

            const timeLabel = isAllDay
              ? "All day"
              : `${startDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { ...tzOpts, hour: "numeric", minute: "2-digit" })}`;

            const isPast = endDate < new Date();

            const bgClass = isPast
              ? "bg-gray-50 border-gray-100 opacity-60"
              : isAvailable
                ? "bg-green-50 border-green-100"
                : "bg-red-50 border-red-100";

            const badgeClass = isPast
              ? "bg-gray-100 text-gray-400"
              : isAvailable
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600";

            return (
              <div
                key={bt.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 border ${bgClass}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isAvailable && !isPast && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-green-600 text-white uppercase tracking-wider">
                        Available
                      </span>
                    )}
                    <p
                      className={`text-sm font-medium ${isPast ? "text-gray-500" : "text-gray-900"}`}
                    >
                      {dateLabel}
                    </p>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}
                    >
                      {timeLabel}
                    </span>
                  </div>
                  {bt.reason && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {bt.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm("Remove this entry?"))
                      deleteBlockedMutation.mutate(bt.id);
                  }}
                  className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0 ml-2"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        !showAddBlocked && (
          <p className="text-xs text-gray-400 italic">
            No blocked or available times set.
          </p>
        )
      )}

      {/* Add blocked/available time inline form */}
      {showAddBlocked && (
        <div
          className={`border rounded-xl p-3 space-y-2 ${blockedForm.type === "available" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}
        >
          {/* Type selector */}
          <div className="flex gap-4 pb-1">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="driver-bt-type"
                value="blocked"
                checked={blockedForm.type === "blocked"}
                onChange={(e) =>
                  setBlockedForm({ ...blockedForm, type: e.target.value })
                }
                className="w-3.5 h-3.5 text-red-600"
              />
              <span className="text-xs font-semibold text-gray-700">
                Blocked Hours
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="driver-bt-type"
                value="available"
                checked={blockedForm.type === "available"}
                onChange={(e) =>
                  setBlockedForm({ ...blockedForm, type: e.target.value })
                }
                className="w-3.5 h-3.5 text-green-600"
              />
              <span className="text-xs font-semibold text-gray-700">
                Available Hours
              </span>
            </label>
          </div>
          <p className="text-[10px] text-gray-500 -mt-1">
            {blockedForm.type === "blocked"
              ? "Driver cannot work these hours"
              : "Driver can ONLY work these hours"}
          </p>

          <div className="flex items-center gap-2 mb-1">
            <input
              type="checkbox"
              id="allDay"
              checked={blockedForm.all_day}
              onChange={(e) =>
                setBlockedForm({ ...blockedForm, all_day: e.target.checked })
              }
              className="w-3.5 h-3.5 text-red-600 border-gray-300 rounded focus:ring-red-500"
            />
            <label
              htmlFor="allDay"
              className="text-xs font-medium text-gray-700 cursor-pointer"
            >
              All Day
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Start Date *
              </label>
              <input
                type="date"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                value={blockedForm.start_date}
                onChange={(e) =>
                  setBlockedForm({
                    ...blockedForm,
                    start_date: e.target.value,
                    end_date: blockedForm.end_date || e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                End Date
              </label>
              <input
                type="date"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                value={blockedForm.end_date}
                min={blockedForm.start_date}
                onChange={(e) =>
                  setBlockedForm({ ...blockedForm, end_date: e.target.value })
                }
              />
            </div>
            {!blockedForm.all_day && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    value={blockedForm.start_time_val}
                    onChange={(e) =>
                      setBlockedForm({
                        ...blockedForm,
                        start_time_val: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                    value={blockedForm.end_time_val}
                    onChange={(e) =>
                      setBlockedForm({
                        ...blockedForm,
                        end_time_val: e.target.value,
                      })
                    }
                  />
                </div>
              </>
            )}
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              Reason (optional)
            </label>
            <input
              type="text"
              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              placeholder="e.g. Vacation, Car service, Day off..."
              value={blockedForm.reason}
              onChange={(e) =>
                setBlockedForm({ ...blockedForm, reason: e.target.value })
              }
            />
          </div>
          <button
            type="button"
            disabled={!blockedForm.start_date || addBlockedMutation.isPending}
            onClick={() => addBlockedMutation.mutate()}
            className={`w-full py-1.5 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors ${blockedForm.type === "available" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {addBlockedMutation.isPending
              ? "Adding…"
              : blockedForm.type === "available"
                ? "Add Available Hours"
                : "Block This Time"}
          </button>
        </div>
      )}
    </div>
  );
}
