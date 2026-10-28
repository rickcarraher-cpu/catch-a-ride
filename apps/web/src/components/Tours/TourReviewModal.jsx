"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/utils/notify";
import { format } from "date-fns";
import {
  Bus,
  X,
  Calendar,
  Clock,
  User,
  Users,
  MapPin,
  DollarSign,
  Send,
  FileText,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  Receipt,
  Car,
} from "lucide-react";
import { TransactionsSection } from "@/components/Trips/TripModal/TransactionsSection";

// ─── helpers ───────────────────────────────────────────────────────────────────
const toDatetimeLocal = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};

// Convert a bare "YYYY-MM-DDTHH:MM" string (from a datetime-local input, which
// is always in LOCAL time) to an ISO string with the correct America/Chicago
// UTC offset (-05:00 CDT or -06:00 CST).  Without this PostgreSQL stores the
// value as UTC, so a 10:00 AM entry ends up saved as 10:00 UTC → displays as
// 5:00 AM the next time the modal opens.
const toChicagoISO = (datetimeLocal) => {
  if (!datetimeLocal) return null;
  const [datePart, timePart] = datetimeLocal.split("T");
  if (!datePart || !timePart) return datetimeLocal;
  try {
    const probe = new Date(`${datePart}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(probe);
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (
      tzName.startsWith("GMT") &&
      (tzName.includes("+") || tzName.includes("-"))
    ) {
      const offset = tzName.slice(3); // "-05:00" or "-06:00"
      return `${datePart}T${timePart}:00${offset}`;
    }
  } catch (_) {}
  // Fallback: CDT (−05:00) roughly March–November, CST (−06:00) otherwise
  const month = parseInt(datePart.slice(5, 7), 10);
  const offset = month >= 3 && month <= 11 ? "-05:00" : "-06:00";
  return `${datePart}T${timePart}:00${offset}`;
};

// Format a bare "HH:MM" or ISO string to "h:mm AM/PM" for display
function formatEndTime(hhmm) {
  if (!hhmm) return "";
  if (hhmm.includes("T")) {
    const d = new Date(hhmm);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m} ${ampm}`;
  }
  const [hh, mm] = hhmm.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mm} ${ampm}`;
}

const STATUS_OPTIONS = [
  "pending",
  "approved",
  "cancelled",
  "completed",
  "no_show",
];
const PAYMENT_METHODS = ["Cash", "Check", "Square", "Venmo", "Zelle", "Other"];

// ─── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, icon, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
            {title}
          </h3>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        {children}
      </div>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────
export default function TourReviewModal({
  tour: initialTour,
  onClose,
  onUpdated,
}) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    status: "pending",
    payment_method: "",
    start_time: "",
    tour_end_time: "",
    tour_flat_fee: "",
    tour_payment_split: "single",
    tour_participant_type: "passengers",
    notes: "",
    driver_notes: "",
    tour_notes: "",
    vehicle_category: "",
  });

  const [vehicleCategories, setVehicleCategories] = useState([]);

  // Fetch vehicle categories on mount
  useEffect(() => {
    fetch("/api/vehicles/categories")
      .then((r) => r.json())
      .then((d) => setVehicleCategories(d.categories || []))
      .catch(() => {});
  }, []);

  const [participants, setParticipants] = useState([]);
  const [originalParticipants, setOriginalParticipants] = useState([]);
  const [itinerary, setItinerary] = useState([]);

  const [editingParticipantIdx, setEditingParticipantIdx] = useState(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    phone: "",
    email: "",
    pickup_location: "",
    dropoff_location: "",
  });

  const [editingStopIdx, setEditingStopIdx] = useState(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [newStop, setNewStop] = useState({ location: "", description: "" });

  const [isSaving, setIsSaving] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Seed form when tour changes
  useEffect(() => {
    if (!initialTour) return;

    let endTimeValue = initialTour.tour_end_time || "";
    if (endTimeValue && endTimeValue.includes("T")) {
      const d = new Date(endTimeValue);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      endTimeValue = `${hours}:${minutes}`;
    }

    setFormData({
      status: initialTour.status || "pending",
      payment_method: initialTour.payment_method || "",
      start_time: toDatetimeLocal(initialTour.start_time),
      tour_end_time: endTimeValue,
      tour_flat_fee: initialTour.tour_flat_fee || "",
      tour_payment_split: initialTour.tour_payment_split || "single",
      tour_participant_type: initialTour.tour_participant_type || "passengers",
      notes: initialTour.notes || "",
      driver_notes: initialTour.driver_notes || "",
      tour_notes: initialTour.tour_notes || "",
      vehicle_category: initialTour.vehicle_category || "",
    });
    const ps = initialTour.tour_participants || [];
    setParticipants(ps);
    setOriginalParticipants(ps);
    setItinerary(initialTour.tour_itinerary || []);
    setEditingParticipantIdx(null);
    setEditingStopIdx(null);
    setShowAddParticipant(false);
    setShowAddStop(false);
  }, [initialTour?.id]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async (sendConfirmations = false) => {
    setIsSaving(true);
    try {
      // Build start_time with the correct Chicago timezone offset.
      // formData.start_time comes from a datetime-local input (no timezone),
      // so we must add the offset before sending to avoid PostgreSQL treating
      // it as UTC and shifting the stored time by 5-6 hours.
      const chicagoStartTime = toChicagoISO(formData.start_time);

      // Convert HH:MM tour_end_time to a full ISO datetime with Chicago offset
      // using the trip's DATE portion (from start_time) so it lands on the same day.
      let tourEndTimeISO = null;
      if (formData.tour_end_time && formData.start_time) {
        try {
          const datePart = formData.start_time.split("T")[0];
          tourEndTimeISO = toChicagoISO(
            `${datePart}T${formData.tour_end_time}`,
          );
        } catch {
          tourEndTimeISO = null;
        }
      }

      // 1. Patch core appointment
      const apptRes = await fetch(`/api/appointments/${initialTour.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: formData.status,
          payment_method: formData.payment_method,
          start_time: chicagoStartTime,
          tour_end_time: tourEndTimeISO,
          tour_flat_fee: Number(formData.tour_flat_fee) || 0,
          tour_payment_split: formData.tour_payment_split,
          tour_participant_type: formData.tour_participant_type,
          notes: formData.notes,
          driver_notes: formData.driver_notes,
          vehicle_category: formData.vehicle_category || null,
          original_amount: Number(formData.tour_flat_fee) || 0,
          send_notification: false,
        }),
      });
      if (!apptRes.ok) {
        let errMsg = "Failed to update tour";
        try {
          const errBody = await apptRes.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {}
        throw new Error(errMsg);
      }

      // 2. Batch-replace itinerary
      const itnRes = await fetch("/api/tours/itinerary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: initialTour.id,
          items: itinerary.map((s, i) => ({
            location: s.location,
            description: s.description || "",
            sequence_order: i + 1,
          })),
        }),
      });
      if (!itnRes.ok) throw new Error("Failed to update itinerary");

      // 3. Replace participants: delete all originals, re-insert current list
      for (const op of originalParticipants) {
        if (op.id) {
          await fetch(`/api/tours/participants?id=${op.id}`, {
            method: "DELETE",
          });
        }
      }
      for (const p of participants) {
        await fetch("/api/tours/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: initialTour.id,
            participant_type: p.participant_type || "guest",
            client_id: p.client_id || null,
            name: p.name,
            phone: p.phone || "",
            email: p.email || "",
            pickup_location: p.pickup_location || "",
            dropoff_location: p.dropoff_location || "",
          }),
        });
      }

      queryClient.invalidateQueries(["tours"]);
      queryClient.invalidateQueries(["appointments"]);

      // 4. Optionally send confirmations
      if (sendConfirmations) {
        try {
          const confRes = await fetch(
            `/api/appointments/${initialTour.id}/resend-confirmation`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "all", channel: "all" }),
            },
          );
          if (confRes.ok) {
            toast.success("Tour updated & confirmations sent ✓");
          } else {
            toast.success(
              "Tour saved! (Confirmations may not have sent — check logs)",
            );
          }
        } catch {
          toast.success("Tour saved! (Confirmation send failed)");
        }
      } else {
        toast.success("Tour saved ✓");
      }

      onUpdated?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save tour");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Resend (without saving) ───────────────────────────────────────────────
  const handleResend = async (channel = "all") => {
    setIsResending(true);
    try {
      const res = await fetch(
        `/api/appointments/${initialTour.id}/resend-confirmation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "all", channel }),
        },
      );
      if (!res.ok) throw new Error("Failed to send confirmations");
      const label =
        channel === "email"
          ? "Email"
          : channel === "sms"
            ? "SMS"
            : "Email & SMS";
      toast.success(`${label} confirmations sent ✓`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to send confirmations");
    } finally {
      setIsResending(false);
    }
  };

  // ── Participant helpers ───────────────────────────────────────────────────
  const addParticipant = () => {
    if (!newParticipant.name.trim()) {
      toast.error("Participant name is required");
      return;
    }
    setParticipants((prev) => [...prev, { ...newParticipant }]);
    setNewParticipant({
      name: "",
      phone: "",
      email: "",
      pickup_location: "",
      dropoff_location: "",
    });
    setShowAddParticipant(false);
  };

  const removeParticipant = (idx) =>
    setParticipants((prev) => prev.filter((_, i) => i !== idx));

  const updateParticipant = (idx, field, value) =>
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
    );

  // ── Itinerary helpers ─────────────────────────────────────────────────────
  const addStop = () => {
    if (!newStop.location.trim()) {
      toast.error("Stop location is required");
      return;
    }
    setItinerary((prev) => [...prev, { ...newStop }]);
    setNewStop({ location: "", description: "" });
    setShowAddStop(false);
  };

  const removeStop = (idx) =>
    setItinerary((prev) => prev.filter((_, i) => i !== idx));

  const updateStop = (idx, field, value) =>
    setItinerary((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );

  const moveStop = (idx, dir) => {
    const arr = [...itinerary];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setItinerary(arr);
  };

  if (!initialTour) return null;

  const perPerson =
    formData.tour_payment_split === "divided"
      ? Math.ceil(
          Number(formData.tour_flat_fee || 0) /
            Math.max((initialTour?.num_people || 0) + 1, 1),
        )
      : null;

  const statusColor =
    formData.status === "approved"
      ? "bg-green-100 text-green-800"
      : formData.status === "pending"
        ? "bg-yellow-100 text-yellow-800"
        : formData.status === "cancelled"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-700";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-purple-700 to-purple-500 px-6 py-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Bus size={24} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">Tour Review</h2>
                {initialTour.booking_number && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs text-white font-mono">
                    #{initialTour.booking_number}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColor}`}
                >
                  {formData.status}
                </span>
              </div>

              <div className="text-purple-200 text-sm mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5">
                  <User size={13} />
                  {initialTour.client_name || "Unknown Passenger"}
                </span>
                {initialTour.start_time && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {format(new Date(initialTour.start_time), "MMM d, yyyy")}
                  </span>
                )}
                {/* Clock / time range — HEADER display only */}
                {initialTour.start_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} />
                    {format(new Date(initialTour.start_time), "h:mm a")}
                    {formData.tour_end_time
                      ? ` – ${formatEndTime(formData.tour_end_time)}`
                      : ""}
                  </span>
                )}
                {initialTour.employee_name && (
                  <span className="flex items-center gap-1.5">
                    <Car size={13} />
                    {initialTour.employee_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Participants",
                value: (initialTour?.num_people || 0) + 1, // guests + 1 driver
                icon: <Users size={15} className="text-purple-600" />,
              },
              {
                label: "Stops",
                value: itinerary.length,
                icon: <MapPin size={15} className="text-purple-600" />,
              },
              {
                label: "Flat Fee",
                value: `$${Number(formData.tour_flat_fee || 0).toFixed(2)}`,
                icon: <DollarSign size={15} className="text-emerald-600" />,
              },
              {
                label: "Payment",
                value: initialTour.payment_status || "unpaid",
                icon: <Receipt size={15} className="text-blue-600" />,
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="bg-white border border-purple-100 rounded-xl p-3 flex items-center gap-2.5"
              >
                {icon}
                <div>
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-sm font-bold text-gray-900 capitalize">
                    {value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trip Details */}
          <Section
            title="Trip Details"
            icon={<Calendar size={15} className="text-purple-600" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Status
                </label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Payment Method
                </label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      payment_method: e.target.value,
                    }))
                  }
                >
                  <option value="">Select…</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, start_time: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Tour End Time
                </label>
                <input
                  type="time"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.tour_end_time}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      tour_end_time: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Vehicle Preference
                </label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.vehicle_category || ""}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      vehicle_category: e.target.value || null,
                    }))
                  }
                >
                  <option value="">No Preference</option>
                  {vehicleCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Driver / Vehicle read-only badges */}
            {(initialTour.employee_name || initialTour.vehicle_name) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {initialTour.employee_name && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                    <div className="text-xs text-gray-500">Driver</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {initialTour.employee_name}
                    </div>
                  </div>
                )}
                {initialTour.vehicle_name && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                    <div className="text-xs text-gray-500">Vehicle</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {initialTour.vehicle_name}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* Pricing */}
          <Section
            title="Pricing"
            icon={<DollarSign size={15} className="text-emerald-600" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Flat Fee ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.tour_flat_fee}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      tour_flat_fee: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Payment Split
                </label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.tour_payment_split}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      tour_payment_split: e.target.value,
                    }))
                  }
                >
                  <option value="single">Single passenger pays all</option>
                  <option value="divided">Divided equally</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">
                  Participant Type
                </label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 bg-white"
                  value={formData.tour_participant_type}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      tour_participant_type: e.target.value,
                    }))
                  }
                >
                  <option value="passengers">Passengers</option>
                  <option value="guests">Guests</option>
                </select>
              </div>

              {perPerson !== null && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <DollarSign size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs text-emerald-600 font-medium">
                      Per Person ({(initialTour?.num_people || 0) + 1} total)
                    </div>
                    <div className="text-xl font-bold text-emerald-700">
                      ${perPerson.toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Participants */}
          <Section
            title={`Guests (${participants.length})`}
            icon={<Users size={15} className="text-purple-600" />}
            action={
              <button
                onClick={() => setShowAddParticipant(true)}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200"
              >
                <Plus size={13} /> Add Guest
              </button>
            }
          >
            {/* Primary Passenger Info */}
            <div className="mb-4 pb-4 border-b-2 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <User size={14} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                  Primary Passenger
                </span>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">
                    {initialTour.client_name || "Unknown"}
                  </div>
                  <div className="text-gray-500 text-xs mt-0.5 space-y-0.5">
                    {initialTour.client_phone && (
                      <div>📱 {initialTour.client_phone}</div>
                    )}
                    {initialTour.client_email && (
                      <div>✉️ {initialTour.client_email}</div>
                    )}
                  </div>
                  <div className="text-xs text-purple-600 mt-2 font-medium">
                    ✓ Receives all confirmations and updates
                  </div>
                </div>
              </div>
            </div>

            {participants.length === 0 && !showAddParticipant && (
              <p className="text-sm text-gray-400 italic">
                No additional guests added. Primary passenger is already set
                above.
              </p>
            )}

            <div className="space-y-2">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="bg-purple-50 border border-purple-200 rounded-xl p-3"
                >
                  {editingParticipantIdx === idx ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white"
                          placeholder="Name *"
                          value={p.name}
                          onChange={(e) =>
                            updateParticipant(idx, "name", e.target.value)
                          }
                        />
                        <input
                          className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white"
                          placeholder="Phone"
                          value={p.phone || ""}
                          onChange={(e) =>
                            updateParticipant(idx, "phone", e.target.value)
                          }
                        />
                        <input
                          className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white col-span-2"
                          placeholder="Email"
                          value={p.email || ""}
                          onChange={(e) =>
                            updateParticipant(idx, "email", e.target.value)
                          }
                        />
                        <input
                          className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white"
                          placeholder="Pickup location"
                          value={p.pickup_location || ""}
                          onChange={(e) =>
                            updateParticipant(
                              idx,
                              "pickup_location",
                              e.target.value,
                            )
                          }
                        />
                        <input
                          className="px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white"
                          placeholder="Dropoff location"
                          value={p.dropoff_location || ""}
                          onChange={(e) =>
                            updateParticipant(
                              idx,
                              "dropoff_location",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <button
                        onClick={() => setEditingParticipantIdx(null)}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                      >
                        ✓ Done
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm">
                        <div className="font-semibold text-gray-900">
                          {idx + 1}. {p.name}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5 space-y-0.5">
                          {p.phone && <div>📱 {p.phone}</div>}
                          {p.email && <div>✉️ {p.email}</div>}
                          {p.pickup_location && (
                            <div>🟢 Pick up: {p.pickup_location}</div>
                          )}
                          {p.dropoff_location && (
                            <div>🔴 Drop off: {p.dropoff_location}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditingParticipantIdx(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-100"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => removeParticipant(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showAddParticipant && (
              <div className="mt-3 bg-purple-50 border-2 border-purple-300 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-purple-700 mb-1">
                  New Participant
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    placeholder="Name *"
                    value={newParticipant.name}
                    onChange={(e) =>
                      setNewParticipant((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                  <input
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    placeholder="Phone"
                    value={newParticipant.phone}
                    onChange={(e) =>
                      setNewParticipant((p) => ({
                        ...p,
                        phone: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white col-span-2"
                    placeholder="Email"
                    value={newParticipant.email}
                    onChange={(e) =>
                      setNewParticipant((p) => ({
                        ...p,
                        email: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    placeholder="Pickup location"
                    value={newParticipant.pickup_location}
                    onChange={(e) =>
                      setNewParticipant((p) => ({
                        ...p,
                        pickup_location: e.target.value,
                      }))
                    }
                  />
                  <input
                    className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    placeholder="Dropoff location"
                    value={newParticipant.dropoff_location}
                    onChange={(e) =>
                      setNewParticipant((p) => ({
                        ...p,
                        dropoff_location: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={addParticipant}
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
                  >
                    Add Participant
                  </button>
                  <button
                    onClick={() => setShowAddParticipant(false)}
                    className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Itinerary */}
          <Section
            title={`Itinerary Stops (${itinerary.length})`}
            icon={<MapPin size={15} className="text-purple-600" />}
            action={
              <button
                onClick={() => setShowAddStop(true)}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200"
              >
                <Plus size={13} /> Add Stop
              </button>
            }
          >
            {itinerary.length === 0 && !showAddStop && (
              <p className="text-sm text-gray-400 italic">No stops added</p>
            )}

            <div className="space-y-2">
              {itinerary.map((stop, idx) => (
                <div
                  key={idx}
                  className="bg-purple-50 border border-purple-200 rounded-xl p-3"
                >
                  {editingStopIdx === idx ? (
                    <div className="space-y-2">
                      <input
                        className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm bg-white"
                        placeholder="Location *"
                        value={stop.location}
                        onChange={(e) =>
                          updateStop(idx, "location", e.target.value)
                        }
                      />
                      <textarea
                        className="w-full px-2.5 py-1.5 border border-purple-300 rounded-lg text-sm resize-none bg-white"
                        placeholder="Description (optional)"
                        rows={2}
                        value={stop.description || ""}
                        onChange={(e) =>
                          updateStop(idx, "description", e.target.value)
                        }
                      />
                      <button
                        onClick={() => setEditingStopIdx(null)}
                        className="text-xs font-semibold text-purple-600 hover:text-purple-700"
                      >
                        ✓ Done
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          {stop.location}
                        </div>
                        {stop.description && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {stop.description}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => moveStop(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-100 disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          onClick={() => moveStop(idx, 1)}
                          disabled={idx === itinerary.length - 1}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-100 disabled:opacity-25 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <button
                          onClick={() => setEditingStopIdx(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-100"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => removeStop(idx)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {showAddStop && (
              <div className="mt-3 bg-purple-50 border-2 border-purple-300 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-purple-700 mb-1">
                  New Stop
                </div>
                <input
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                  placeholder="Location *"
                  value={newStop.location}
                  onChange={(e) =>
                    setNewStop((s) => ({ ...s, location: e.target.value }))
                  }
                />
                <textarea
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm resize-none bg-white"
                  placeholder="Description (optional)"
                  rows={2}
                  value={newStop.description}
                  onChange={(e) =>
                    setNewStop((s) => ({ ...s, description: e.target.value }))
                  }
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={addStop}
                    className="px-4 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700"
                  >
                    Add Stop
                  </button>
                  <button
                    onClick={() => setShowAddStop(false)}
                    className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>

          {/* Notes */}
          <Section
            title="Notes"
            icon={<FileText size={15} className="text-gray-500" />}
          >
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Tour / Itinerary Notes
                </label>
                <textarea
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 resize-none bg-white"
                  rows={3}
                  placeholder="Itinerary notes, special instructions…"
                  value={formData.tour_notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, tour_notes: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  General Notes
                </label>
                <textarea
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 resize-none bg-white"
                  rows={3}
                  placeholder="General trip notes…"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">
                  Driver Notes
                </label>
                <textarea
                  className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 resize-none bg-white"
                  rows={2}
                  placeholder="Private notes for the driver…"
                  value={formData.driver_notes}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, driver_notes: e.target.value }))
                  }
                />
              </div>
            </div>
          </Section>

          {/* Transactions / Payment */}
          {initialTour.id && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <TransactionsSection
                tripId={initialTour.id}
                tripPrice={Number(formData.tour_flat_fee || 0)}
                trip={{
                  ...initialTour,
                  payment_status: initialTour.payment_status,
                }}
              />
            </div>
          )}
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white flex flex-col gap-3 shrink-0">
          {/* Confirmation row */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-200">
            <span className="text-xs font-semibold text-gray-500 mr-1">
              Send Confirmations:
            </span>

            <button
              onClick={() => handleResend("all")}
              disabled={isResending}
              className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send size={13} />
              {isResending ? "Sending…" : "All (Email & SMS)"}
            </button>

            <button
              onClick={() => handleResend("email")}
              disabled={isResending}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send size={13} />
              {isResending ? "Sending…" : "Email Only"}
            </button>

            <button
              onClick={() => handleResend("sms")}
              disabled={isResending}
              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send size={13} />
              {isResending ? "Sending…" : "SMS Only"}
            </button>

            <a
              href={`/receipt/${initialTour.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Receipt size={13} />
              Receipt
            </a>
          </div>

          {/* Save row */}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="px-5 py-2.5 bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save Without Sending"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              <CheckCircle size={15} />
              {isSaving ? "Saving…" : "Update & Send Confirmations"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
