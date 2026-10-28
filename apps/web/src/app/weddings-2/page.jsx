"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Heart,
  Calendar,
  Clock,
  MapPin,
  Car,
  Users,
  User,
  Mail,
  MessageSquare,
  Bell,
  BellOff,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  FileText,
  HelpCircle,
  Copy,
  ArrowLeft,
} from "lucide-react";

const STEPS = [
  "Wedding Details",
  "Contact & Trip Type",
  "Review & Quote",
  "Confirmation",
];
const DRAFT_KEY = "weddings2_draft";

const initialForm = {
  wedding_date: "",
  ceremony_time: "",
  ceremony_address: "",
  ceremony_venue_name: "",
  reception_same_as_ceremony: true,
  reception_time: "",
  reception_address: "",
  reception_venue_name: "",
  vehicles_needed: "",
  vehicles_not_sure: false,
  estimated_passengers: "",
  primary_contact_name: "",
  primary_contact_phone: "",
  contact_preference: "email_sms",
  contact_email: "",
  agreed_to_terms: false,
};

function ProgressDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step
                  ? "bg-pink-600 text-white"
                  : i === step
                    ? "bg-pink-100 text-pink-700 border-2 border-pink-600"
                    : "bg-gray-100 text-gray-400 border-2 border-gray-200"
              }`}
            >
              {i < step ? <CheckCircle size={18} /> : i + 1}
            </div>
            <span
              className={`text-[10px] mt-1.5 font-semibold uppercase tracking-wide hidden sm:block ${
                i <= step ? "text-pink-700" : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-6 sm:w-12 h-0.5 mb-5 ${i < step ? "bg-pink-600" : "bg-gray-200"}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Weddings2Page() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [loadedDraft, setLoadedDraft] = useState(false);

  // ── Load saved progress on mount ──────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((f) => ({ ...f, ...parsed.form }));
        setStep(parsed.step || 0);
      }
    } catch (e) {}
    setLoadedDraft(true);
  }, []);

  // ── Save progress whenever it changes ─────────────────────────────────
  useEffect(() => {
    if (!loadedDraft || confirmation) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    } catch (e) {}
  }, [form, step, loadedDraft, confirmation]);

  const set = (updates) => setForm((f) => ({ ...f, ...updates }));

  const estimate = useMemo(() => {
    if (form.vehicles_not_sure || !form.vehicles_needed) return null;
    return Number(form.vehicles_needed) * 150;
  }, [form.vehicles_needed, form.vehicles_not_sure]);

  // ── Validation per step ───────────────────────────────────────────────
  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.wedding_date) {
        e.wedding_date = "Wedding date is required";
      } else {
        const d = new Date(form.wedding_date + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(d.getTime()) || d < today) {
          e.wedding_date = "Please choose a future date";
        }
      }
      if (!form.ceremony_address.trim())
        e.ceremony_address = "Ceremony location is required";
      if (!form.reception_same_as_ceremony && !form.reception_address.trim()) {
        e.reception_address =
          "Reception location is required (or mark it as the same)";
      }
      if (!form.primary_contact_name.trim())
        e.primary_contact_name = "Contact name is required";
      if (!form.primary_contact_phone.trim())
        e.primary_contact_phone = "Contact phone is required";
    }
    if (s === 1) {
      if (form.contact_preference !== "none" && !form.contact_email.trim()) {
        e.contact_email =
          "Email is required for your selected contact preference";
      }
    }
    if (s === 2) {
      if (!form.agreed_to_terms)
        e.agreed_to_terms = "You must agree to the Terms to submit";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 3));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const goToStep = (target) => {
    // Allow jumping back to any previous step to edit; forward requires validation
    if (target < step) {
      setStep(target);
      return;
    }
    // Validate all steps up to target-1
    for (let s = step; s < target; s++) {
      if (!validateStep(s)) return;
    }
    setStep(target);
  };

  const handleSubmit = async () => {
    if (!validateStep(2)) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/weddings-2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wedding_date: form.wedding_date,
          ceremony_time: form.ceremony_time,
          ceremony_address: form.ceremony_address,
          ceremony_venue_name: form.ceremony_venue_name,
          reception_same_as_ceremony: form.reception_same_as_ceremony,
          reception_time: form.reception_time,
          reception_address: form.reception_address,
          reception_venue_name: form.reception_venue_name,
          vehicles_needed: form.vehicles_needed
            ? Number(form.vehicles_needed)
            : null,
          vehicles_not_sure: form.vehicles_not_sure,
          estimated_passengers: form.estimated_passengers
            ? Number(form.estimated_passengers)
            : null,
          primary_contact_name: form.primary_contact_name,
          primary_contact_phone: form.primary_contact_phone,
          contact_preference: form.contact_preference,
          contact_email: form.contact_email,
          agreed_to_terms_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit booking");
      setConfirmation(data.booking);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    setForm(initialForm);
    setConfirmation(null);
    setErrors({});
    setStep(0);
  };

  const inputCls = (field) =>
    `w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-sm ${
      errors[field]
        ? "border-red-300 bg-red-50"
        : "border-pink-200 focus:border-pink-400 bg-white"
    }`;

  const errText = (field) =>
    errors[field] ? (
      <p className="text-xs text-red-600 mt-1.5 font-medium">{errors[field]}</p>
    ) : null;

  const prefOptions = [
    {
      value: "email_sms",
      icon: Bell,
      title: "Email & SMS",
      desc: "Get confirmations via both email and text message",
    },
    {
      value: "email_only",
      icon: Mail,
      title: "Email Only",
      desc: "Receive confirmations only via email",
    },
    {
      value: "sms_only",
      icon: MessageSquare,
      title: "SMS Only",
      desc: "Receive confirmations only via text message",
    },
    {
      value: "none",
      icon: BellOff,
      title: "None",
      desc: "No confirmations (not recommended)",
    },
  ];

  const summaryRows = [
    ["Wedding Date", form.wedding_date],
    [
      "Ceremony",
      `${form.ceremony_time || "TBD"} — ${form.ceremony_venue_name || form.ceremony_address || "TBD"}`,
    ],
    [
      "Reception",
      form.reception_same_as_ceremony
        ? "Same as ceremony"
        : `${form.reception_time || "TBD"} — ${form.reception_venue_name || form.reception_address || "TBD"}`,
    ],
    [
      "Vehicles Needed",
      form.vehicles_not_sure
        ? "Not sure — help me decide"
        : form.vehicles_needed || "TBD",
    ],
    ["Estimated Passengers", form.estimated_passengers || "TBD"],
    [
      "Primary Contact",
      `${form.primary_contact_name} — ${form.primary_contact_phone}`,
    ],
    [
      "Contact Preference",
      prefOptions.find((p) => p.value === form.contact_preference)?.title || "",
    ],
    ["Email", form.contact_email || "—"],
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-8 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-pink-100 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <Heart size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Weddings 2.0</h1>
              <p className="text-pink-100 mt-1 text-sm">
                Guided wedding transportation booking — your details, your way
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <ProgressDots step={step} />

        {/* ══════════ STEP 1: WEDDING DETAILS ══════════ */}
        {step === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Heart size={20} className="text-pink-600" />
              Wedding Details
            </h2>

            {/* Wedding Date */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Wedding Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.wedding_date}
                onChange={(e) => set({ wedding_date: e.target.value })}
                className={inputCls("wedding_date")}
              />
              {errText("wedding_date")}
            </div>

            {/* Ceremony */}
            <div className="bg-pink-50/60 border border-pink-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-pink-800">
                <MapPin size={16} />
                Ceremony
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Ceremony Time
                  </label>
                  <input
                    type="time"
                    value={form.ceremony_time}
                    onChange={(e) => set({ ceremony_time: e.target.value })}
                    className={inputCls("ceremony_time")}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Venue Name (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., The Grand Chapel"
                    value={form.ceremony_venue_name}
                    onChange={(e) =>
                      set({ ceremony_venue_name: e.target.value })
                    }
                    className={inputCls("ceremony_venue_name")}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Ceremony Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="123 Main St, City, State"
                  value={form.ceremony_address}
                  onChange={(e) => set({ ceremony_address: e.target.value })}
                  className={inputCls("ceremony_address")}
                />
                {errText("ceremony_address")}
              </div>
            </div>

            {/* Reception */}
            <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-4 space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.reception_same_as_ceremony}
                  onChange={(e) =>
                    set({ reception_same_as_ceremony: e.target.checked })
                  }
                  className="w-4 h-4 accent-pink-600"
                />
                <span className="text-sm font-bold text-rose-800 flex items-center gap-2">
                  <MapPin size={16} />
                  Reception is at the same location as the ceremony
                </span>
              </label>
              {!form.reception_same_as_ceremony && (
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Reception Time
                      </label>
                      <input
                        type="time"
                        value={form.reception_time}
                        onChange={(e) =>
                          set({ reception_time: e.target.value })
                        }
                        className={inputCls("reception_time")}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        Venue Name (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Lakeside Ballroom"
                        value={form.reception_venue_name}
                        onChange={(e) =>
                          set({ reception_venue_name: e.target.value })
                        }
                        className={inputCls("reception_venue_name")}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Reception Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="456 Oak Ave, City, State"
                      value={form.reception_address}
                      onChange={(e) =>
                        set({ reception_address: e.target.value })
                      }
                      className={inputCls("reception_address")}
                    />
                    {errText("reception_address")}
                  </div>
                </div>
              )}
            </div>

            {/* Vehicles & Passengers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  <Car size={14} className="inline mr-1 text-pink-600" />
                  Number of Vehicles Needed
                </label>
                {form.vehicles_not_sure ? (
                  <div className="w-full px-4 py-3 border-2 border-dashed border-pink-300 bg-pink-50 rounded-xl text-sm text-pink-700 font-medium flex items-center gap-2">
                    <HelpCircle size={16} />
                    We&apos;ll help you decide
                  </div>
                ) : (
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g., 2"
                    value={form.vehicles_needed}
                    onChange={(e) => set({ vehicles_needed: e.target.value })}
                    className={inputCls("vehicles_needed")}
                  />
                )}
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.vehicles_not_sure}
                    onChange={(e) =>
                      set({ vehicles_not_sure: e.target.checked })
                    }
                    className="w-4 h-4 accent-pink-600"
                  />
                  <span className="text-xs text-gray-600">
                    Not sure — help me decide
                  </span>
                </label>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                  <Users size={14} className="inline mr-1 text-pink-600" />
                  Estimated Total Passengers
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g., 12"
                  value={form.estimated_passengers}
                  onChange={(e) =>
                    set({ estimated_passengers: e.target.value })
                  }
                  className={inputCls("estimated_passengers")}
                />
              </div>
            </div>

            {/* Primary Contact */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <User size={16} className="text-pink-600" />
                Primary Contact{" "}
                <span className="font-normal text-gray-500 text-xs">
                  (the person coordinating)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Jane Smith"
                    value={form.primary_contact_name}
                    onChange={(e) =>
                      set({ primary_contact_name: e.target.value })
                    }
                    className={inputCls("primary_contact_name")}
                  />
                  {errText("primary_contact_name")}
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={form.primary_contact_phone}
                    onChange={(e) =>
                      set({ primary_contact_phone: e.target.value })
                    }
                    className={inputCls("primary_contact_phone")}
                  />
                  {errText("primary_contact_phone")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 2: CONTACT PREFERENCES & TRIP TYPE ══════════ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-6 md:p-8 space-y-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                <Bell size={20} className="text-pink-600" />
                How should we contact YOU?
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Choose how you&apos;d like to receive confirmations and updates.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {prefOptions.map((opt) => {
                  const OptIcon = opt.icon;
                  const selected = form.contact_preference === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set({ contact_preference: opt.value })}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selected
                          ? "border-pink-500 bg-pink-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-pink-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 mb-1">
                        <OptIcon
                          size={18}
                          className={
                            selected ? "text-pink-600" : "text-gray-400"
                          }
                        />
                        <span
                          className={`font-bold text-sm ${selected ? "text-pink-700" : "text-gray-800"}`}
                        >
                          {opt.title}
                        </span>
                        {opt.value === "none" && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase">
                            Not recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              {form.contact_preference !== "none" && (
                <div className="mt-4">
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                    <Mail size={14} className="inline mr-1 text-pink-600" />
                    Email Address{" "}
                    {form.contact_preference === "email_only" && (
                      <span className="text-red-500">*</span>
                    )}
                    {form.contact_preference === "email_sms" && (
                      <span className="text-red-500">*</span>
                    )}
                    {form.contact_preference === "sms_only" && (
                      <span className="text-gray-400 text-xs font-normal">
                        (optional for SMS-only)
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.contact_email}
                    onChange={(e) => set({ contact_email: e.target.value })}
                    className={inputCls("contact_email")}
                  />
                  {errText("contact_email")}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
                <FileText size={20} className="text-pink-600" />
                Trip Type
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                This booking is for wedding transportation.
              </p>
              <div className="p-4 rounded-xl border-2 border-pink-500 bg-pink-50 flex items-center gap-3">
                <Heart size={20} className="text-pink-600" />
                <div>
                  <div className="font-bold text-sm text-pink-700">WEDDING</div>
                  <div className="text-xs text-gray-500">
                    Multi-vehicle wedding day transportation with ceremony &amp;
                    reception coverage
                  </div>
                </div>
                <CheckCircle size={20} className="text-pink-600 ml-auto" />
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 4: REVIEW & QUOTE ══════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-6 md:p-8 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle size={20} className="text-pink-600" />
              Review &amp; Quote
            </h2>

            {/* Summary */}
            <div className="border border-pink-100 rounded-xl overflow-hidden">
              {summaryRows.map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 text-sm ${
                    i % 2 === 0 ? "bg-pink-50/40" : "bg-white"
                  }`}
                >
                  <span className="font-semibold text-gray-600 sm:w-44 shrink-0">
                    {label}
                  </span>
                  <span className="text-gray-900">{value || "—"}</span>
                </div>
              ))}
            </div>

            {/* Edit shortcuts */}
            <div className="flex flex-wrap gap-2">
              {["Wedding Details", "Contact & Trip Type"].map((label, i) => (
                <button
                  key={label}
                  onClick={() => goToStep(i)}
                  className="text-xs font-semibold text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  ✎ Edit {label}
                </button>
              ))}
            </div>

            {/* Pricing */}
            <div
              className={`rounded-xl border-2 p-5 ${
                estimate
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              {estimate ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                      Estimated Quote
                    </div>
                    <div className="text-xs text-emerald-600 mt-0.5">
                      {form.vehicles_needed} vehicle(s) × $150 flat wedding rate
                    </div>
                  </div>
                  <div className="text-3xl font-extrabold text-emerald-700">
                    ${estimate.toFixed(0)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <HelpCircle size={22} className="text-amber-600 shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-amber-800">
                      Custom Quote — We&apos;ll contact you within 2 business
                      hours
                    </div>
                    <div className="text-xs text-amber-600 mt-0.5">
                      Because you asked for help choosing vehicles, we&apos;ll
                      build a custom quote for you.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreed_to_terms}
                  onChange={(e) => set({ agreed_to_terms: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-pink-600 shrink-0"
                />
                <span className="text-sm text-gray-700">
                  I agree to the Catch A Ride Wedding Transportation{" "}
                  <span className="font-semibold text-pink-600 underline">
                    Terms &amp; Conditions
                  </span>{" "}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {errText("agreed_to_terms")}
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                {errors.submit}
              </div>
            )}
          </div>
        )}

        {/* ══════════ STEP 5: CONFIRMATION ══════════ */}
        {step === 3 && confirmation && (
          <div className="bg-white rounded-2xl shadow-xl border border-pink-100 p-6 md:p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <PartyPopper size={40} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                Booking Received!
              </h2>
              <p className="text-sm text-gray-500 mt-2">
                Thank you, {confirmation.primary_contact_name}! We&apos;ve
                received your wedding transportation request.
              </p>
            </div>

            <div className="bg-pink-50 border-2 border-pink-200 rounded-xl p-5 inline-flex flex-col items-center gap-2 min-w-[240px]">
              <span className="text-xs font-bold text-pink-600 uppercase tracking-wider">
                Booking Reference
              </span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-extrabold text-gray-900">
                  {confirmation.reference_code}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(confirmation.reference_code);
                  }}
                  className="p-1.5 text-pink-400 hover:text-pink-600 hover:bg-pink-100 rounded-lg transition-colors"
                  title="Copy reference"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="text-left bg-gray-50 border border-gray-100 rounded-xl p-5 space-y-2">
              <div className="text-sm font-bold text-gray-800 mb-1">
                What happens next:
              </div>
              {[
                "We'll review your details and send your quote" +
                  (estimate ? "" : " (custom pricing)") +
                  " — usually within 2 business hours.",
                "Once you approve, we'll send a deposit request to lock in your date.",
                "After the deposit, your booking is confirmed and we'll assign your driver.",
                "You'll get driver details, a day-before reminder, and a thank-you after the event" +
                  (form.contact_preference === "none"
                    ? " — but you opted out of notifications, so keep your reference handy."
                    : ` via ${prefOptions.find((p) => p.value === form.contact_preference)?.title}.`),
              ].map((text, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-gray-600"
                >
                  <span className="w-5 h-5 bg-pink-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {text}
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button
                onClick={startNew}
                className="px-6 py-3 bg-pink-600 text-white text-sm font-bold rounded-xl hover:bg-pink-700 transition-colors"
              >
                Book Another Wedding
              </button>
              <a
                href="/dashboard"
                className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors no-underline flex items-center justify-center"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        )}

        {/* ── Navigation (hidden on confirmation) ── */}
        {step < 3 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={back}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-5 py-3 text-sm font-semibold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
              Back
            </button>
            {step < 2 ? (
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-6 py-3 bg-pink-600 text-white text-sm font-bold rounded-xl hover:bg-pink-700 transition-colors shadow-md"
              >
                Continue
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-md"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-r-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Submit Booking
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
