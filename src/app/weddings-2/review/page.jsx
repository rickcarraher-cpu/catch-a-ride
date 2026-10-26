"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import {
  Heart,
  Search,
  X,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Car,
  Users,
  User,
  Mail,
  Phone,
  Bell,
  BellOff,
  CheckCircle,
  DollarSign,
  Send,
  Loader2,
  ChevronDown,
  FileText,
} from "lucide-react";

const STATUSES = [
  "inquiry",
  "quoted",
  "deposit_paid",
  "confirmed",
  "completed",
  "cancelled",
];

const STATUS_STYLES = {
  inquiry: "bg-gray-100 text-gray-700 border-gray-200",
  quoted: "bg-blue-50 text-blue-700 border-blue-200",
  deposit_paid: "bg-purple-50 text-purple-700 border-purple-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS = {
  inquiry: "Inquiry",
  quoted: "Quoted",
  deposit_paid: "Deposit Paid",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

const PREF_LABELS = {
  email_sms: "Email & SMS",
  email_only: "Email Only",
  sms_only: "SMS Only",
  none: "None",
};

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Weddings2ReviewPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["weddings2-list", statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/weddings-2?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch wedding bookings");
      return res.json();
    },
  });

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const s of STATUSES) counts[s] = 0;
    for (const b of bookings) {
      if (counts[b.status] !== undefined) counts[b.status]++;
    }
    return counts;
  }, [bookings]);

  const selected = bookings.find((b) => b.id === selectedId) || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-100 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <Heart size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Weddings 2.0</h1>
                <p className="text-rose-100 mt-1 text-sm">
                  {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
                  {search && ` matching "${search}"`}
                </p>
              </div>
            </div>
            <a
              href="/weddings-2"
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-rose-700 text-sm font-semibold rounded-xl hover:bg-rose-50 transition-all shadow-md no-underline"
            >
              <Heart size={18} />
              New Wedding Booking
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
        {/* Status pipeline */}
        <div className="bg-white rounded-2xl shadow-sm border border-rose-100 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${
                statusFilter === "all"
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-rose-300"
              }`}
            >
              All ({bookings.length})
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${
                  statusFilter === s
                    ? "bg-rose-600 text-white border-rose-600"
                    : STATUS_STYLES[s] + " hover:opacity-80"
                }`}
              >
                {STATUS_LABELS[s]} ({statusCounts[s] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search by reference, contact, email, or venue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-12 py-3.5 border-2 border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Bookings list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={36} className="animate-spin text-rose-500" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-rose-200">
            <Heart size={56} className="mx-auto text-rose-300 mb-4" />
            <p className="text-gray-600 font-semibold text-lg">
              No wedding bookings found
            </p>
            <p className="text-gray-400 text-sm mt-2">
              New bookings from the Weddings 2.0 wizard will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookings.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setSelectedId(b.id);
                  setShowDetail(true);
                }}
                className="text-left bg-white rounded-2xl border-2 border-rose-100 hover:border-rose-300 hover:shadow-xl transition-all overflow-hidden group"
              >
                <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-5 py-3.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white font-mono font-bold text-sm">
                      {b.reference_code}
                    </div>
                    <div className="text-rose-100 text-xs mt-0.5 truncate">
                      {b.primary_contact_name || "No contact"}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                      STATUS_STYLES[b.status] || STATUS_STYLES.inquiry
                    }`}
                  >
                    {STATUS_LABELS[b.status] || b.status}
                  </span>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar size={14} className="text-rose-500 shrink-0" />
                    <span className="font-semibold">
                      {formatDate(b.wedding_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <MapPin size={13} className="text-rose-400 shrink-0" />
                    <span className="truncate">
                      {b.ceremony_venue_name || b.ceremony_address || "TBD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 pt-2 border-t border-rose-50 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Car size={13} className="text-rose-500" />
                      {b.vehicles_not_sure
                        ? "Not sure"
                        : b.vehicles_needed || "—"}{" "}
                      veh
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} className="text-rose-500" />
                      {b.estimated_passengers || "—"} pax
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign size={13} className="text-emerald-600" />
                      {b.estimated_price > 0
                        ? `$${Number(b.estimated_price).toFixed(0)}`
                        : "Custom"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selected && (
        <BookingDetailModal
          booking={selected}
          onClose={() => {
            setShowDetail(false);
            setSelectedId(null);
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ["weddings2-list"] });
          }}
        />
      )}
    </div>
  );
}

function BookingDetailModal({ booking: initial, onClose, onUpdated }) {
  const [form, setForm] = useState({
    status: initial.status,
    estimated_price: initial.estimated_price || "",
    pricing_type: initial.pricing_type || "custom",
    driver_name: initial.driver_name || "",
    driver_photo_url: initial.driver_photo_url || "",
    vehicle_details: initial.vehicle_details || "",
  });
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(null);

  const set = (u) => setForm((f) => ({ ...f, ...u }));

  const save = async (extra = {}) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/weddings-2/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          estimated_price:
            form.estimated_price === "" ? 0 : Number(form.estimated_price),
          pricing_type: form.pricing_type,
          driver_name: form.driver_name,
          driver_photo_url: form.driver_photo_url,
          vehicle_details: form.vehicle_details,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update booking");
      toast.success("Booking updated ✓");
      onUpdated();
      if (!extra.send_notification) onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendNotification = async (type) => {
    setSending(type);
    try {
      const res = await fetch(`/api/weddings-2/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: form.status,
          estimated_price:
            form.estimated_price === "" ? 0 : Number(form.estimated_price),
          pricing_type: form.pricing_type,
          driver_name: form.driver_name,
          driver_photo_url: form.driver_photo_url,
          vehicle_details: form.vehicle_details,
          send_notification: type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send notification");
      const n = data.notified || {};
      if (n.skipped) {
        toast.info("Contact preference is 'None' — notification skipped");
      } else {
        const via = [n.email && "email", n.sms && "SMS"]
          .filter(Boolean)
          .join(" & ");
        toast.success(via ? `Sent via ${via}` : "Notification sent");
      }
      onUpdated();
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  const rows = [
    ["Wedding Date", formatDate(initial.wedding_date)],
    [
      "Ceremony",
      `${initial.ceremony_time || "TBD"} — ${initial.ceremony_venue_name || ""} ${initial.ceremony_address || ""}`.trim(),
    ],
    [
      "Reception",
      initial.reception_same_as_ceremony
        ? "Same as ceremony"
        : `${initial.reception_time || "TBD"} — ${initial.reception_venue_name || ""} ${initial.reception_address || ""}`.trim(),
    ],
    [
      "Vehicles",
      initial.vehicles_not_sure
        ? "Not sure — help me decide"
        : initial.vehicles_needed || "—",
    ],
    ["Est. Passengers", initial.estimated_passengers || "—"],
    [
      "Contact",
      `${initial.primary_contact_name || "—"} · ${initial.primary_contact_phone || ""}`,
    ],
    ["Email", initial.contact_email || "—"],
    [
      "Contact Preference",
      PREF_LABELS[initial.contact_preference] || initial.contact_preference,
    ],
    [
      "Submitted",
      new Date(initial.submitted_at || initial.created_at).toLocaleString(),
    ],
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-pink-600 px-6 py-4 flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Heart size={20} className="text-white" />
              <h2 className="text-lg font-bold text-white font-mono">
                {initial.reference_code}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  STATUS_STYLES[initial.status] || ""
                }`}
              >
                {STATUS_LABELS[initial.status] || initial.status}
              </span>
            </div>
            <p className="text-rose-100 text-xs mt-1">
              {initial.primary_contact_name} ·{" "}
              {PREF_LABELS[initial.contact_preference]}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50">
          {/* Summary */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            {rows.map(([label, value], i) => (
              <div
                key={label}
                className={`flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 px-4 py-2.5 text-sm ${
                  i % 2 === 0 ? "bg-rose-50/40" : "bg-white"
                }`}
              >
                <span className="font-semibold text-gray-500 text-xs sm:w-36 shrink-0">
                  {label}
                </span>
                <span className="text-gray-900">{value || "—"}</span>
              </div>
            ))}
          </div>

          {/* Status + Pricing */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">
                  Status
                </label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => set({ status: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white appearance-none pr-9 text-sm font-medium focus:ring-2 focus:ring-rose-400"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1.5">
                  Quote Amount ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_price}
                  onChange={(e) => set({ estimated_price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>

            {/* Driver assignment */}
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
                Driver Assignment
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form.driver_name}
                  onChange={(e) => set({ driver_name: e.target.value })}
                  placeholder="Driver name"
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400"
                />
                <input
                  type="text"
                  value={form.vehicle_details}
                  onChange={(e) => set({ vehicle_details: e.target.value })}
                  placeholder="Vehicle (e.g., White Lincoln Navigator)"
                  className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400"
                />
                <input
                  type="url"
                  value={form.driver_photo_url}
                  onChange={(e) => set({ driver_photo_url: e.target.value })}
                  placeholder="Driver photo URL (optional)"
                  className="sm:col-span-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-400"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Send size={13} />
              Send Notifications
              <span className="font-normal normal-case text-gray-400">
                (respects contact preference:{" "}
                {PREF_LABELS[initial.contact_preference]})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                ["quote_ready", "💰 Quote Ready / Deposit Request"],
                ["deposit_confirmed", "✅ Deposit Received — Confirmed"],
                ["driver_assigned", "🚗 Driver Assigned"],
                ["day_before_reminder", "⏰ Day-Before Reminder"],
                ["thank_you", "💐 Thank You + Review"],
              ].map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => sendNotification(type)}
                  disabled={sending !== null}
                  className="px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg hover:bg-rose-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  {sending === type ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  {label}
                </button>
              ))}
            </div>
            {initial.contact_preference === "none" && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <BellOff size={14} className="shrink-0" />
                This customer opted out of all notifications.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle size={15} />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
