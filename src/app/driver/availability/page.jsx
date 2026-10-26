"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import { toast } from "@/utils/notify";
import { buildChicagoTimestamp } from "@/utils/timezone";
import {
  CalendarX2,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  CalendarDays,
  Repeat,
  PlayCircle,
  Pencil,
  X,
} from "lucide-react";

// Driver Availability Page - Manage blocked times and recurring schedules
export default function DriverAvailabilityPage() {
  const { data: user, loading: userLoading } = useUser();
  const { signInWithCredentials } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null); // track which block is being edited
  const [activeTab, setActiveTab] = useState("one-time"); // "one-time" | "recurring"

  // Recurring modal state
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const [recurringForm, setRecurringForm] = useState({
    start_time: "09:00",
    end_time: "17:00",
    frequency: "weekly",
    day_of_week: 1,
    reason: "",
    num_occurrences: 0,
    type: "blocked",
  });

  // Driver login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Form state for adding blocked/available time
  const [form, setForm] = useState({
    start_date: "",
    start_time_val: "09:00",
    end_date: "",
    end_time_val: "17:00",
    all_day: true,
    reason: "",
    type: "blocked",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await fetch("/api/driver/employee");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch driver information");
        }
        const data = await res.json();
        setEmployee(data.employee);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchEmployee();
    } else if (!userLoading && !user) {
      setLoading(false);
    }
  }, [user, userLoading]);

  // Fetch blocked times for this driver
  const { data: blockedTimes, refetch: refetchBlocked } = useQuery({
    queryKey: ["driver-blocked-times", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const res = await fetch(`/api/blocked-times?employee_id=${employee.id}`);
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
    enabled: !!employee?.id,
  });

  // Fetch recurring blocked times for this driver
  const { data: recurringBlocks, refetch: refetchRecurring } = useQuery({
    queryKey: ["driver-recurring-blocked-times", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const res = await fetch("/api/blocked-times/recurring");
      if (!res.ok) throw new Error("Failed to fetch recurring blocks");
      const data = await res.json();
      return data.filter((s) => s.employee_id === employee.id);
    },
    enabled: !!employee?.id,
  });

  // Add one-time mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      const startISO = form.all_day
        ? buildChicagoTimestamp(form.start_date, "00:00")
        : buildChicagoTimestamp(form.start_date, form.start_time_val);
      const endDate = form.end_date || form.start_date;
      const endISO = form.all_day
        ? buildChicagoTimestamp(endDate, "23:59")
        : buildChicagoTimestamp(endDate, form.end_time_val);

      const res = await fetch("/api/blocked-times", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employee.id,
          start_time: startISO,
          end_time: endISO,
          reason: form.reason || null,
          type: form.type,
        }),
      });
      if (!res.ok) throw new Error("Failed to add blocked time");
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        form.type === "available"
          ? "Available hours added"
          : "Blocked time added",
      );
      setForm({
        start_date: "",
        start_time_val: "09:00",
        end_date: "",
        end_time_val: "17:00",
        all_day: true,
        reason: "",
        type: "blocked",
      });
      setShowAddForm(false);
      refetchBlocked();
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete one-time mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/blocked-times/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete blocked time");
    },
    onSuccess: () => {
      toast.success("Blocked time removed");
      refetchBlocked();
    },
    onError: (err) => toast.error(err.message),
  });

  // Update one-time mutation (PATCH)
  const updateMutation = useMutation({
    mutationFn: async () => {
      const startISO = form.all_day
        ? buildChicagoTimestamp(form.start_date, "00:00")
        : buildChicagoTimestamp(form.start_date, form.start_time_val);
      const endDate = form.end_date || form.start_date;
      const endISO = form.all_day
        ? buildChicagoTimestamp(endDate, "23:59")
        : buildChicagoTimestamp(endDate, form.end_time_val);

      const res = await fetch(`/api/blocked-times/${editingBlock.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: startISO,
          end_time: endISO,
          reason: form.reason || null,
          type: form.type,
        }),
      });
      if (!res.ok) throw new Error("Failed to update blocked time");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Entry updated");
      setForm({
        start_date: "",
        start_time_val: "09:00",
        end_date: "",
        end_time_val: "17:00",
        all_day: true,
        reason: "",
        type: "blocked",
      });
      setShowAddForm(false);
      setEditingBlock(null);
      refetchBlocked();
    },
    onError: (err) => toast.error(err.message),
  });

  // Open form pre-filled for editing — preserve type
  const openEditForm = (bt) => {
    const startDate = new Date(bt.start_time);
    const endDate = new Date(bt.end_time);
    const pad = (n) => String(n).padStart(2, "0");
    const tz = "America/Chicago";

    const sYear = startDate.toLocaleString("en-US", {
      timeZone: tz,
      year: "numeric",
    });
    const sMonth = pad(
      Number(
        startDate.toLocaleString("en-US", { timeZone: tz, month: "numeric" }),
      ),
    );
    const sDay = pad(
      Number(
        startDate.toLocaleString("en-US", { timeZone: tz, day: "numeric" }),
      ),
    );
    const eYear = endDate.toLocaleString("en-US", {
      timeZone: tz,
      year: "numeric",
    });
    const eMonth = pad(
      Number(
        endDate.toLocaleString("en-US", { timeZone: tz, month: "numeric" }),
      ),
    );
    const eDay = pad(
      Number(endDate.toLocaleString("en-US", { timeZone: tz, day: "numeric" })),
    );

    const sh = Number(
      startDate.toLocaleString("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      }),
    );
    const sm = Number(
      startDate.toLocaleString("en-US", { timeZone: tz, minute: "numeric" }),
    );
    const eh = Number(
      endDate.toLocaleString("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
      }),
    );
    const em = Number(
      endDate.toLocaleString("en-US", { timeZone: tz, minute: "numeric" }),
    );

    const isAllDay = sh === 0 && sm === 0 && eh === 23 && em >= 59;
    setEditingBlock(bt);
    setForm({
      start_date: `${sYear}-${sMonth}-${sDay}`,
      start_time_val: isAllDay ? "09:00" : `${pad(sh)}:${pad(sm)}`,
      end_date: `${eYear}-${eMonth}-${eDay}`,
      end_time_val: isAllDay ? "17:00" : `${pad(eh)}:${pad(em)}`,
      all_day: isAllDay,
      reason: bt.reason || "",
      type: bt.type || "blocked",
    });
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save recurring series (create or update)
  const saveRecurringMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: employee.id,
        start_time: recurringForm.start_time,
        end_time: recurringForm.end_time,
        frequency: recurringForm.frequency,
        day_of_week:
          recurringForm.frequency === "weekly" ||
          recurringForm.frequency === "bi-weekly"
            ? Number(recurringForm.day_of_week)
            : null,
        reason: recurringForm.reason || null,
        num_occurrences: Number(recurringForm.num_occurrences) || 0,
        type: recurringForm.type,
      };
      const url = editingRecurring
        ? `/api/blocked-times/recurring/${editingRecurring.id}`
        : "/api/blocked-times/recurring";
      const method = editingRecurring ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(
          `Failed to ${editingRecurring ? "update" : "create"} recurring series`,
        );
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        editingRecurring
          ? "Recurring series updated"
          : "Recurring series created",
      );
      setShowRecurringModal(false);
      setEditingRecurring(null);
      setRecurringForm({
        start_time: "09:00",
        end_time: "17:00",
        frequency: "weekly",
        day_of_week: 1,
        reason: "",
        num_occurrences: 0,
        type: "blocked",
      });
      refetchRecurring();
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
      toast.success("Recurring series removed");
      refetchRecurring();
    },
    onError: (err) => toast.error(err.message),
  });

  // Generate blocked times from recurring series
  const generateMutation = useMutation({
    mutationFn: async (seriesId) => {
      const res = await fetch("/api/blocked-times/recurring/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days_ahead: 30,
          recurring_id: seriesId || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate blocked times");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Generated ${data.generated || 0} blocked time${data.generated !== 1 ? "s" : ""}`,
      );
      refetchBlocked();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleDriverLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/verify-driver-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid email or password");
      }

      await signInWithCredentials({
        email: loginEmail,
        password: loginPassword,
        callbackUrl: "/driver/availability",
        redirect: true,
      });
    } catch (err) {
      console.error(err);
      setLoginError(err.message || "Invalid email or password");
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/account/logout";
  };

  // Separate blocked times into upcoming and past
  const { upcoming, past } = useMemo(() => {
    if (!blockedTimes) return { upcoming: [], past: [] };
    const now = new Date();
    const u = [];
    const p = [];
    blockedTimes.forEach((bt) => {
      const endDate = new Date(bt.end_time);
      if (endDate >= now) u.push(bt);
      else p.push(bt);
    });
    return { upcoming: u, past: p };
  }, [blockedTimes]);

  const openEditRecurring = (series) => {
    setEditingRecurring(series);
    setRecurringForm({
      start_time: series.start_time,
      end_time: series.end_time,
      frequency: series.frequency,
      day_of_week: series.day_of_week ?? 1,
      reason: series.reason || "",
      num_occurrences: series.num_occurrences || 0,
      type: series.type || "blocked",
    });
    setShowRecurringModal(true);
  };

  const openNewRecurring = () => {
    setEditingRecurring(null);
    setRecurringForm({
      start_time: "09:00",
      end_time: "17:00",
      frequency: "weekly",
      day_of_week: 1,
      reason: "",
      num_occurrences: 0,
      type: "blocked",
    });
    setShowRecurringModal(true);
  };

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const FREQ_LABELS = {
    daily: "Daily",
    weekly: "Weekly",
    "bi-weekly": "Bi-Weekly",
    monthly: "Monthly",
  };

  // Show driver login form if not authenticated
  if (!userLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
        <form
          onSubmit={handleDriverLogin}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
        >
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg
                className="h-8 w-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Driver Portal</h1>
            <p className="mt-2 text-sm text-gray-600">
              Sign in with your driver email
            </p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            {loginError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {loginError}
              </div>
            )}
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            <h2 className="text-lg font-semibold mb-2">Access Error</h2>
            <p>{error}</p>
            <p className="mt-4 text-sm">
              Please contact your administrator if you believe this is a
              mistake.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-6 w-full rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/driver/portal"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Manage Availability
                </h1>
                {employee && (
                  <p className="text-sm text-gray-600 mt-1">{employee.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {employee?.is_admin && (
                <a
                  href="/today-by-provider"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Admin Dashboard
                </a>
              )}
              <button
                onClick={handleLogout}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("one-time")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === "one-time" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            One-Time Blocks
          </button>
          <button
            onClick={() => setActiveTab("recurring")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 inline-flex items-center gap-2 ${activeTab === "recurring" ? "border-red-600 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            <Repeat size={15} />
            Recurring Series
          </button>
        </div>

        {activeTab === "one-time" ? (
          <>
            {/* Add Blocked Time Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <CalendarX2 size={20} className="text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Block Time Off
                    </h2>
                    <p className="text-sm text-gray-500">
                      Request time off for vacation, appointments, or personal
                      days
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (showAddForm) {
                      setShowAddForm(false);
                      setEditingBlock(null);
                      setForm({
                        start_date: "",
                        start_time_val: "09:00",
                        end_date: "",
                        end_time_val: "17:00",
                        all_day: true,
                        reason: "",
                      });
                    } else {
                      setShowAddForm(true);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  {showAddForm ? (
                    editingBlock ? (
                      "Cancel Edit"
                    ) : (
                      "Cancel"
                    )
                  ) : (
                    <>
                      <Plus size={16} />
                      Block Time
                    </>
                  )}
                </button>
              </div>

              {showAddForm && (
                <div
                  className={`border rounded-xl p-4 space-y-3 ${form.type === "available" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}
                >
                  {editingBlock && (
                    <div className="flex items-center gap-2 mb-1 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                      <Pencil size={14} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        Editing existing entry
                      </span>
                    </div>
                  )}
                  {/* Type toggle */}
                  <div className="flex gap-4 pb-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="driver-avail-type"
                        value="blocked"
                        checked={form.type === "blocked"}
                        onChange={(e) =>
                          setForm({ ...form, type: e.target.value })
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
                        name="driver-avail-type"
                        value="available"
                        checked={form.type === "available"}
                        onChange={(e) =>
                          setForm({ ...form, type: e.target.value })
                        }
                        className="w-3.5 h-3.5 text-green-600"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        Available Hours
                      </span>
                    </label>
                  </div>
                  <p className="text-[11px] text-gray-500 -mt-1">
                    {form.type === "blocked"
                      ? "Driver cannot work these hours"
                      : "Driver can ONLY work these hours"}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="allDay"
                      checked={form.all_day}
                      onChange={(e) =>
                        setForm({ ...form, all_day: e.target.checked })
                      }
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <label
                      htmlFor="allDay"
                      className="text-sm font-medium text-gray-700 cursor-pointer"
                    >
                      All Day
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
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
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                        value={form.end_date}
                        min={form.start_date}
                        onChange={(e) =>
                          setForm({ ...form, end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  {!form.all_day && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
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
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
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
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                      Reason (optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
                      placeholder="e.g. Vacation, Doctor appointment, Personal day..."
                      value={form.reason}
                      onChange={(e) =>
                        setForm({ ...form, reason: e.target.value })
                      }
                    />
                  </div>
                  <button
                    disabled={
                      !form.start_date ||
                      addMutation.isPending ||
                      updateMutation.isPending
                    }
                    onClick={() =>
                      editingBlock
                        ? updateMutation.mutate()
                        : addMutation.mutate()
                    }
                    className="w-full py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {editingBlock
                      ? updateMutation.isPending
                        ? "Saving..."
                        : "Save Changes"
                      : addMutation.isPending
                        ? "Adding..."
                        : "Block This Time"}
                  </button>
                </div>
              )}
            </div>

            {/* Upcoming Blocked Times */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={18} className="text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Upcoming & Active ({upcoming.length})
                </h3>
              </div>
              {upcoming.length === 0 ? (
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
                  {upcoming.map((bt) => {
                    const startDate = new Date(bt.start_time);
                    const endDate = new Date(bt.end_time);
                    const sameDay =
                      startDate.toDateString() === endDate.toDateString();
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
                    const now = new Date();
                    const isActive = startDate <= now && endDate >= now;
                    return (
                      <div
                        key={bt.id}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 border ${
                          bt.type === "available"
                            ? "bg-green-50 border-green-100"
                            : isActive
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {bt.type === "available" && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white uppercase tracking-wider">
                                Available
                              </span>
                            )}
                            <p
                              className={`text-sm font-medium ${
                                isActive ? "text-red-900" : "text-gray-900"
                              }`}
                            >
                              {dateLabel}
                            </p>
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                isActive
                                  ? "bg-red-200 text-red-700"
                                  : "bg-gray-200 text-gray-700"
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
                          {bt.reason && (
                            <p className="text-xs text-gray-600 mt-1">
                              {bt.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <button
                            onClick={() => openEditForm(bt)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Remove this entry?"))
                                deleteMutation.mutate(bt.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Blocked Times */}
            {past.length > 0 && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
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
          /* Recurring Tab */
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => generateMutation.mutate(null)}
                disabled={generateMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <PlayCircle size={16} />
                {generateMutation.isPending
                  ? "Generating..."
                  : "Generate All (30 days)"}
              </button>
              <button
                onClick={openNewRecurring}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <Plus size={16} />
                New Recurring Series
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Repeat size={18} className="text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Recurring Series ({recurringBlocks?.length || 0})
                </h3>
              </div>

              {!recurringBlocks || recurringBlocks.length === 0 ? (
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
                    Click "New Recurring Series" above to set one up
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recurringBlocks.map((series) => {
                    const freqDisplay =
                      series.frequency === "weekly" ||
                      series.frequency === "bi-weekly"
                        ? `${FREQ_LABELS[series.frequency]} (${DAY_NAMES[series.day_of_week] ?? "?"})`
                        : FREQ_LABELS[series.frequency] || series.frequency;
                    return (
                      <div
                        key={series.id}
                        className="flex items-center justify-between rounded-lg px-4 py-3 bg-purple-50 border border-purple-100"
                      >
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
                            <p className="text-xs text-gray-500 mt-1">
                              {series.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3 shrink-0">
                          <button
                            onClick={() => generateMutation.mutate(series.id)}
                            disabled={generateMutation.isPending}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Generate"
                          >
                            <PlayCircle size={15} />
                          </button>
                          <button
                            onClick={() => openEditRecurring(series)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this recurring series?"))
                                deleteRecurringMutation.mutate(series.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {series.type === "available" && (
                          <span className="text-xs text-green-600">
                            Available
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Recurring Series Modal */}
      {showRecurringModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Repeat size={20} className="text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingRecurring ? "Edit" : "New"} Recurring Series
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowRecurringModal(false);
                  setEditingRecurring(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Time range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    value={recurringForm.start_time}
                    onChange={(e) =>
                      setRecurringForm({
                        ...recurringForm,
                        start_time: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    value={recurringForm.end_time}
                    onChange={(e) =>
                      setRecurringForm({
                        ...recurringForm,
                        end_time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              {/* Frequency */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                  Frequency *
                </label>
                <div className="flex flex-wrap gap-2">
                  {["daily", "weekly", "bi-weekly", "monthly"].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() =>
                        setRecurringForm({ ...recurringForm, frequency: freq })
                      }
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${recurringForm.frequency === freq ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {FREQ_LABELS[freq]}
                    </button>
                  ))}
                </div>
              </div>
              {/* Day of week */}
              {(recurringForm.frequency === "weekly" ||
                recurringForm.frequency === "bi-weekly") && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Day of Week *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAY_NAMES.map((day, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setRecurringForm({
                            ...recurringForm,
                            day_of_week: idx,
                          })
                        }
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${recurringForm.day_of_week === idx ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Occurrences */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Number of Occurrences (0 = unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  value={recurringForm.num_occurrences}
                  onChange={(e) =>
                    setRecurringForm({
                      ...recurringForm,
                      num_occurrences: e.target.value,
                    })
                  }
                />
              </div>
              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Weekly day off, Regular appointment..."
                  value={recurringForm.reason}
                  onChange={(e) =>
                    setRecurringForm({
                      ...recurringForm,
                      reason: e.target.value,
                    })
                  }
                />
              </div>
              <button
                onClick={() => saveRecurringMutation.mutate()}
                disabled={saveRecurringMutation.isPending}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saveRecurringMutation.isPending
                  ? "Saving..."
                  : editingRecurring
                    ? "Update Series"
                    : "Create Series"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
