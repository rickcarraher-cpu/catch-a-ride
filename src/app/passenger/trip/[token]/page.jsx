"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
  Users,
  Briefcase,
  Car,
  Plane,
  StickyNote,
  DollarSign,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Phone,
  ExternalLink,
  Edit2, // ADD: Icon for edit button
  Mail, // ADD: Icon for email field
  User, // ADD: Icon for name field
  Save, // ADD: Icon for save button
  X, // ADD: Icon for cancel button
} from "lucide-react";

export default function PassengerTripPage({ params }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [companyPhone, setCompanyPhone] = useState(null);
  const [paymentUrl, setPaymentUrl] = useState(null);

  // ADD: State for editing contact information
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState(null);

  useEffect(() => {
    loadTrip();
    loadSettings();
  }, []);

  async function loadTrip() {
    try {
      const response = await fetch(
        `/api/confirmations/passenger/${params.token}`,
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load trip");
      }
      const data = await response.json();
      setTrip(data.trip);
      if (data.trip?.payment_url) {
        setPaymentUrl(data.trip.payment_url);
      }
    } catch (err) {
      console.error("Failed to load trip:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        setCompanyPhone(settings.business_phone || null);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  // ADD: Function to handle contact information updates
  async function handleSaveContact() {
    if (!trip?.client_id) {
      setContactError("Unable to update contact information");
      return;
    }

    // Validation
    if (!contactFormData.name?.trim()) {
      setContactError("Name is required");
      return;
    }

    if (!contactFormData.phone?.trim() && !contactFormData.email?.trim()) {
      setContactError("Please provide at least a phone number or email");
      return;
    }

    setSavingContact(true);
    setContactError(null);

    try {
      const res = await fetch(`/api/clients/${trip.client_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactFormData.name.trim(),
          phone: contactFormData.phone?.trim() || null,
          email: contactFormData.email?.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update contact information");
      }

      const updatedClient = await res.json();

      // Update local trip state with new contact info
      setTrip((prev) => ({
        ...prev,
        passenger_name: updatedClient.name,
        passenger_phone: updatedClient.phone,
        passenger_email: updatedClient.email,
      }));

      setIsEditingContact(false);
      setContactError(null);
    } catch (err) {
      console.error("Failed to update contact:", err);
      setContactError(err.message);
    } finally {
      setSavingContact(false);
    }
  }

  // ADD: Function to cancel editing
  function handleCancelEdit() {
    setContactFormData({
      name: trip?.passenger_name || "",
      phone: trip?.passenger_phone || "",
      email: trip?.passenger_email || "",
    });
    setIsEditingContact(false);
    setContactError(null);
  }

  // ADD: Initialize contact form when trip loads
  useEffect(() => {
    if (trip) {
      setContactFormData({
        name: trip.passenger_name || "",
        phone: trip.passenger_phone || "",
        email: trip.passenger_email || "",
      });
    }
  }, [trip]);

  async function handleSubmit() {
    if (decision === "cancelled" && !reason.trim()) {
      setError("Please provide a reason for cancelling");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/confirmations/passenger/${params.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: decision === "cancelled" ? reason : null,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit response");
      }

      setSuccess(true);
    } catch (err) {
      console.error("Failed to submit:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadIcs() {
    if (!trip) return;

    try {
      // Fetch the ICS content
      const response = await fetch(
        `/api/appointments/${trip.id}/ics?recipient=passenger`,
      );
      if (!response.ok) throw new Error("Failed to generate calendar file");

      const icsContent = await response.text();

      // Create a Blob from the ICS content
      const blob = new Blob([icsContent], {
        type: "text/calendar;charset=utf-8",
      });

      // Create a download link
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `trip-${trip.booking_number}.ics`;

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Failed to download calendar:", err);
      // Fallback: try direct navigation
      window.location.href = `/api/appointments/${trip.id}/ics?recipient=passenger`;
    }
  }

  // Date/time helpers — use pre-computed trip display fields (the trip is king)
  const tripDate = trip?.display_long_date || trip?.display_short_date || "";
  const tripTime = trip?.display_time || "";
  const tripReturnDate = trip?.display_return_date || "";
  const tripFullDatetime =
    trip?.display_full_datetime || `${tripDate} ${tripTime}`.trim();
  const tripGCalDate = trip?.display_gcal_date || "";

  function buildGoogleCalendarUrl() {
    if (!trip) return "#";

    // Format a date as Chicago local time for Google Calendar (YYYYMMDDTHHmmss, no Z)
    const fmtCDT = (d) => {
      const date = typeof d === "string" ? new Date(d) : d;
      if (!date || isNaN(date.getTime())) return "";
      const f = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const parts = f.formatToParts(date);
      const v = (t) => parts.find((p) => p.type === t)?.value || "00";
      // hour12:false can return "24" for midnight — normalize to "00"
      const hr = v("hour") === "24" ? "00" : v("hour");
      return `${v("year")}${v("month")}${v("day")}T${hr}${v("minute")}${v("second")}`;
    };

    const totalDuration =
      (trip.services || []).reduce(
        (sum, s) => sum + (s.duration_minutes || 75) * (s.quantity || 1),
        0,
      ) || 75;

    const startMs = new Date(trip.start_time).getTime();
    const endMs = startMs + totalDuration * 60000;

    const startDate = fmtCDT(trip.start_time);
    const endDate = fmtCDT(new Date(endMs));

    // Show business name + service in title for passengers
    const businessName = trip.business_name || "Catch A Ride";
    const serviceNames = (trip.services || [])
      .map((s) => s.service_name || "Service")
      .join(", ");
    const title = encodeURIComponent(
      `${businessName} — ${serviceNames || "Trip"}`,
    );

    // Build comprehensive details for the calendar description
    const detailLines = [];
    detailLines.push(`Booking #${trip.booking_number || trip.id}`);
    if (trip.pickup_address) detailLines.push(`Pickup: ${trip.pickup_address}`);
    if (trip.dropoff_address || trip.destination)
      detailLines.push(`Dropoff: ${trip.dropoff_address || trip.destination}`);
    if (trip.driver_name) detailLines.push(`Driver: ${trip.driver_name}`);
    if (trip.vehicle_name) detailLines.push(`Vehicle: ${trip.vehicle_name}`);
    if (trip.num_people) detailLines.push(`Passengers: ${trip.num_people}`);
    const bagParts = [];
    if (trip.num_bags_checked)
      bagParts.push(`${trip.num_bags_checked} checked`);
    if (trip.num_bags_carry_on)
      bagParts.push(`${trip.num_bags_carry_on} carry-on`);
    if (bagParts.length > 0) detailLines.push(`Bags: ${bagParts.join(" / ")}`);
    if (trip.outgoing_flight_info)
      detailLines.push(`Flight Info: ${trip.outgoing_flight_info}`);
    if (trip.returning_flight_info)
      detailLines.push(`Return Flight: ${trip.returning_flight_info}`);
    if (trip.notes) detailLines.push(`Notes: ${trip.notes}`);

    // Payment information - match ICS file format exactly
    detailLines.push("");
    if (trip.services_total != null) {
      detailLines.push(
        `Total Amount: $${Number(trip.services_total).toFixed(2)}`,
      );
    }
    if (trip.display_payment_method || trip.payment_method) {
      detailLines.push(
        `Payment Method: ${trip.display_payment_method || trip.payment_method}`,
      );
    } else {
      detailLines.push(`Payment Method: Not specified`);
    }
    if (trip.payment_status) {
      detailLines.push(
        `Payment Status: ${trip.payment_status.charAt(0).toUpperCase() + trip.payment_status.slice(1)}`,
      );
    } else {
      detailLines.push(`Payment Status: Unpaid`);
    }
    if (trip.payments_total && Number(trip.payments_total) > 0) {
      detailLines.push(
        `Amount Paid: $${Number(trip.payments_total).toFixed(2)}`,
      );
    }
    if (trip.balance_due != null && Number(trip.balance_due) > 0) {
      detailLines.push(`Balance Due: $${Number(trip.balance_due).toFixed(2)}`);
    } else if (trip.balance_due != null && Number(trip.balance_due) === 0) {
      detailLines.push(`Balance Due: $0.00 (Paid in Full)`);
    }

    const details = encodeURIComponent(detailLines.join("\n"));

    // Set pickup address as location so passengers can tap to open in Maps
    const location = encodeURIComponent(trip.pickup_address || "");

    // ctz tells Google Calendar the timezone for these local-time strings
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&ctz=America%2FChicago`;
  }

  // Remove these old calculations — replaced by tripDate/tripTime above:
  // - new Date(trip.start_time).toLocaleDateString(...) → tripDate
  // - new Date(trip.start_time).toLocaleTimeString(...) → tripTime
  // - new Date(trip.return_date).toLocaleDateString(...) → tripReturnDate

  // Compute payment info
  const isPaid = trip?.payment_status === "paid";
  const balanceDue =
    trip?.original_amount != null
      ? Math.max(
          0,
          Number(trip.original_amount) - Number(trip.payments_total || 0),
        )
      : trip?.payment_amount != null
        ? Number(trip.payment_amount)
        : 0;
  const showPayButton = !isPaid && balanceDue > 0;

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-lg">Loading trip details...</span>
        </div>
      </div>
    );
  }

  // --- Error State ---
  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-red-200">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle size={32} />
            <h1 className="text-2xl font-bold">Unable to Load Trip</h1>
          </div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // --- Success State ---
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            {decision === "confirmed" ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Confirmed!
                </h1>
                <p className="text-gray-600 mb-6">
                  Thank you for confirming. We're looking forward to serving
                  you!
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Cancelled
                </h1>
                <p className="text-gray-600 mb-4">
                  We've cancelled your trip. We hope to serve you another time!
                </p>
                {companyPhone && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      Need to talk to us?
                    </p>
                    <a
                      href={`tel:${companyPhone}`}
                      className="text-lg font-bold text-blue-600 hover:text-blue-700 underline"
                    >
                      {companyPhone}
                    </a>
                  </div>
                )}
              </>
            )}

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-6">
              <strong>Booking #:</strong> {trip.booking_number}
              <br />
              <strong>Date:</strong>{" "}
              {new Date(trip.start_time).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Chicago",
              })}
            </div>

            {decision === "confirmed" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-medium">
                  Add to your calendar
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDownloadIcs}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    <Calendar size={16} />
                    Apple / Outlook
                  </button>
                  <a
                    href={buildGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-purple-600 text-purple-600 font-medium rounded-lg hover:bg-purple-50 transition-colors text-sm"
                  >
                    <Calendar size={16} />
                    Google
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Cancel Reason Screen ---
  if (decision === "cancelled") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Please Tell Us Why
          </h1>
          <p className="text-gray-500 mb-6">
            This helps us improve our service and better understand your needs.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for cancelling
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Plans changed, flight cancelled, found alternative..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setDecision(null);
                setError(null);
              }}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !reason.trim()}
              className="flex-1 px-4 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Cancellation"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Confirm Trip Screen ---
  if (decision === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Confirm Your Trip
            </h1>
            <p className="text-gray-600">You're confirming this trip:</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm space-y-2">
            <div>
              <strong>Booking:</strong> {trip.booking_number}
            </div>
            <div>
              <strong>Date:</strong>{" "}
              {new Date(trip.start_time).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Chicago",
              })}
            </div>
            {trip.driver_name && (
              <div>
                <strong>Driver:</strong> {trip.driver_name}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setDecision(null);
                setError(null);
              }}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              disabled={submitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm Trip"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Combined View ---
  const alreadyResponded = !!trip.passenger_response_at;
  const alreadyConfirmed = trip.passenger_confirmed === "confirmed";
  // Detect reinstated trip: passenger previously cancelled but admin has re-approved it
  const isReinstated =
    trip.passenger_confirmed === "cancelled" &&
    trip.status !== "cancelled" &&
    trip.status != null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Trip #{trip.booking_number}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date(trip.start_time).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "America/Chicago",
            })}
          </p>
        </div>

        {/* === REINSTATED BANNER: Prominent alert when trip was uncancelled === */}
        {isReinstated && (
          <div className="bg-blue-600 text-white rounded-2xl shadow-lg p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle size={22} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">
                  Your trip has been reinstated!
                </p>
                <p className="text-blue-100 text-sm mt-1">
                  We've re-activated your trip. Please confirm your attendance
                  below.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDecision("confirmed")}
              className="w-full flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-4 px-4 rounded-xl hover:bg-blue-50 transition-colors shadow-md active:scale-[0.98] text-base"
            >
              <CheckCircle size={20} />
              Confirm My Trip
            </button>
          </div>
        )}

        {/* Already Responded Banner — only show if NOT reinstated */}
        {alreadyResponded && !isReinstated && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              alreadyConfirmed
                ? "bg-green-50 border border-green-200"
                : "bg-orange-50 border border-orange-200"
            }`}
          >
            {alreadyConfirmed ? (
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            ) : (
              <XCircle size={20} className="text-orange-600 flex-shrink-0" />
            )}
            <div>
              <p
                className={`font-semibold text-sm ${alreadyConfirmed ? "text-green-700" : "text-orange-700"}`}
              >
                {alreadyConfirmed ? "You Confirmed" : "You Cancelled"}
              </p>
              <p className="text-xs text-gray-500">
                Responded{" "}
                {new Date(trip.passenger_response_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Chicago",
                })}
              </p>
            </div>
          </div>
        )}

        {/* === SECTION 1: Trip Details === */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Time & Date Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <Clock size={20} className="flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">
                  {new Date(trip.start_time).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Chicago",
                  })}
                </p>
                <p className="text-purple-100 text-sm">
                  {new Date(trip.start_time).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Chicago",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Driver Portrait */}
            {(trip.driver_portrait || trip.driver_profile_image) && (
              <div className="flex items-center gap-4">
                <img
                  src={trip.driver_portrait || trip.driver_profile_image}
                  alt={trip.driver_name || "Driver"}
                  className="w-16 h-16 rounded-full object-cover border-2 border-purple-100 shadow"
                />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Your Driver
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {trip.driver_first_name || trip.driver_name}
                  </p>
                  {trip.driver_bio && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {trip.driver_bio}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Driver name (no portrait) */}
            {!trip.driver_portrait &&
              !trip.driver_profile_image &&
              trip.driver_name && (
                <div className="flex items-start gap-3">
                  <Car
                    size={18}
                    className="text-purple-500 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                      Your Driver
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      {trip.driver_name}
                    </p>
                  </div>
                </div>
              )}

            {/* Vehicle */}
            {trip.vehicle_name && (
              <div className="flex items-start gap-3">
                <Car size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Vehicle
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.vehicle_name}
                  </p>
                </div>
              </div>
            )}

            {/* Pickup */}
            {trip.pickup_address && (
              <div className="flex items-start gap-3">
                <MapPin
                  size={18}
                  className="text-green-500 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Pickup
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.pickup_address}
                  </p>
                </div>
              </div>
            )}

            {/* Dropoff */}
            {(trip.dropoff_address || trip.destination) && (
              <div className="flex items-start gap-3">
                <MapPin
                  size={18}
                  className="text-red-500 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Destination
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.dropoff_address || trip.destination}
                  </p>
                </div>
              </div>
            )}

            {/* Passengers & Bags */}
            {(trip.num_people ||
              trip.num_bags_checked > 0 ||
              trip.num_bags_carry_on > 0 ||
              trip.num_car_seats > 0 ||
              trip.num_golf_bags > 0) && (
              <div className="flex items-start gap-3">
                <Briefcase
                  size={18}
                  className="text-gray-400 mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Passengers & Bags
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {trip.num_people && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        👥 {trip.num_people}{" "}
                        {trip.num_people === 1 ? "person" : "people"}
                      </span>
                    )}
                    {trip.num_bags_checked > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        🧳 {trip.num_bags_checked} checked
                      </span>
                    )}
                    {trip.num_bags_carry_on > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        👜 {trip.num_bags_carry_on} carry-on
                      </span>
                    )}
                    {trip.num_car_seats > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        🪑 {trip.num_car_seats} car seat
                        {trip.num_car_seats > 1 ? "s" : ""}
                      </span>
                    )}
                    {trip.num_golf_bags > 0 && (
                      <span className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                        ⛳ {trip.num_golf_bags} golf bag
                        {trip.num_golf_bags > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Flight Info */}
            {(trip.outgoing_flight_info || trip.returning_flight_info) && (
              <div className="flex items-start gap-3">
                <Plane
                  size={18}
                  className="text-blue-500 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Flight Info
                  </p>
                  {(() => {
                    const pickupLower = (
                      trip.pickup_address ||
                      trip.departure_location ||
                      ""
                    ).toLowerCase();
                    const dropoffLower = (
                      trip.dropoff_address ||
                      trip.destination ||
                      ""
                    ).toLowerCase();
                    const airportKws = ["airport", "terminal", "concourse"];
                    const isPickupAtAirport =
                      trip.pickup_is_airport === true ||
                      airportKws.some((kw) => pickupLower.includes(kw));
                    const isDropoffAtAirport =
                      trip.dropoff_is_airport === true ||
                      airportKws.some((kw) => dropoffLower.includes(kw));
                    const fromAirport =
                      isPickupAtAirport && !isDropoffAtAirport;
                    const leg1Label = fromAirport ? "Incoming" : "Outgoing";
                    const leg2Label = fromAirport ? "Outgoing" : "Return";
                    return (
                      <>
                        {trip.outgoing_flight_info && (
                          <p className="text-sm text-gray-900">
                            ✈️ {leg1Label}: {trip.outgoing_flight_info}
                          </p>
                        )}
                        {trip.returning_flight_info && (
                          <p className="text-sm text-gray-900">
                            ✈️ {leg2Label}: {trip.returning_flight_info}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Return Date */}
            {trip.return_date && (
              <div className="flex items-start gap-3">
                <Calendar
                  size={18}
                  className="text-gray-400 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Return Date
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {(() => {
                      // Extract YYYY-MM-DD directly to avoid CDT timezone shifting midnight UTC dates back one day
                      const str =
                        typeof trip.return_date === "string"
                          ? trip.return_date
                          : new Date(trip.return_date).toISOString();
                      const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                      if (!match) return "N/A";
                      const [, year, month, day] = match;
                      const d = new Date(`${year}-${month}-${day}T12:00:00Z`);
                      return d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      });
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {trip.notes && (
              <div className="flex items-start gap-3">
                <StickyNote
                  size={18}
                  className="text-gray-400 mt-0.5 flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Special Requests
                  </p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1">
                    {trip.notes}
                  </p>
                </div>
              </div>
            )}

            {/* Gift Certificate */}
            {trip.gift_certificate && (
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5 flex-shrink-0">🎁</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Gift Certificate
                  </p>
                  <p className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-lg p-3 mt-1 whitespace-pre-wrap">
                    {trip.gift_certificate}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === Services Breakdown === */}
        {trip.services && trip.services.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">
              Services
            </h3>
            <div className="space-y-2">
              {trip.services.map((service, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">
                      {service.service_name}
                      {service.quantity > 1 && (
                        <span className="text-gray-500 ml-1">
                          × {service.quantity}
                        </span>
                      )}
                    </p>
                    {service.stop_description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {service.stop_description}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900 text-sm ml-4">
                    $
                    {(service.service_price * (service.quantity || 1)).toFixed(
                      2,
                    )}
                  </p>
                </div>
              ))}
              {/* CC Fee line item */}
              {(() => {
                const methodLower = (trip.payment_method || "").toLowerCase();
                const isCreditCard =
                  methodLower.includes("card") ||
                  methodLower.includes("credit") ||
                  methodLower.includes("square");
                if (!isCreditCard) return null;
                const feePercent = trip.credit_card_fee_percent || 4;
                const subtotal = trip.services.reduce(
                  (sum, s) =>
                    sum +
                    Number(s.service_price || 0) * Number(s.quantity || 1),
                  0,
                );
                const fee = Math.round(
                  (Math.ceil(subtotal) * feePercent) / 100,
                );
                if (fee <= 0) return null;
                return (
                  <div className="flex justify-between items-center py-2 border-t border-gray-200">
                    <p className="font-medium text-gray-600 text-sm">
                      Credit Card Fee ({feePercent}%)
                    </p>
                    <p className="font-semibold text-gray-900 text-sm ml-4">
                      +${fee.toFixed(2)}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* === SECTION 2: Payment === */}
        {trip.payment_amount != null && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <h3 className="font-bold text-gray-900">Payment</h3>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Amount</span>
                <span className="font-bold text-gray-900 text-lg">
                  ${Number(trip.payment_amount).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <span
                  className={`font-semibold px-3 py-1 rounded-full text-xs ${
                    isPaid
                      ? "bg-green-100 text-green-800"
                      : trip.payment_status === "unpaid"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {isPaid
                    ? "✓ Paid"
                    : trip.payment_status === "unpaid"
                      ? "Unpaid"
                      : "Pending"}
                </span>
              </div>

              {trip.payment_method && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Method</span>
                  <span className="text-gray-900 capitalize">
                    {trip.payment_method === "square"
                      ? "Credit Card"
                      : trip.payment_method}
                  </span>
                </div>
              )}
            </div>

            {/* Pay Now Button */}
            {showPayButton && paymentUrl && (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
              >
                <CreditCard size={18} />
                Pay Now — ${balanceDue.toFixed(2)}
                <ExternalLink size={14} />
              </a>
            )}

            {isPaid && (
              <div className="mt-4 text-center text-sm text-green-600 font-semibold">
                ✓ This trip is paid
              </div>
            )}
          </div>
        )}

        {/* === SECTION 3: Confirm / Cancel === */}
        {!alreadyResponded && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Confirm your trip
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("confirmed")}
                className="flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-4 px-4 rounded-xl hover:bg-green-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                <CheckCircle size={20} />
                <span>Confirm</span>
              </button>
              <button
                onClick={() => setDecision("cancelled")}
                className="flex items-center justify-center gap-2 bg-orange-600 text-white font-semibold py-4 px-4 rounded-xl hover:bg-orange-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98]"
              >
                <XCircle size={20} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* Already responded - option to update */}
        {alreadyResponded && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <p className="text-sm text-gray-500 mb-3">
              Want to update your response?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("confirmed")}
                className="flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-green-700 transition-colors text-sm"
              >
                <CheckCircle size={16} />
                <span>Confirm</span>
              </button>
              <button
                onClick={() => setDecision("cancelled")}
                className="flex items-center justify-center gap-2 bg-orange-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-orange-700 transition-colors text-sm"
              >
                <XCircle size={16} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* === SECTION 4: Add to Calendar === */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <button
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-purple-600" />
              </div>
              <span className="font-semibold text-gray-900">
                Add to Calendar
              </span>
            </div>
            {calendarOpen ? (
              <ChevronUp size={20} className="text-gray-400" />
            ) : (
              <ChevronDown size={20} className="text-gray-400" />
            )}
          </button>

          {calendarOpen && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={handleDownloadIcs}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition-colors text-sm"
              >
                <Calendar size={16} />
                Apple / Outlook
              </button>
              <a
                href={buildGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-purple-600 text-purple-600 font-medium rounded-xl hover:bg-purple-50 transition-colors text-sm"
              >
                <Calendar size={16} />
                Google Calendar
              </a>
            </div>
          )}
        </div>

        {/* Contact */}
        {companyPhone && (
          <div className="text-center pb-4">
            <a
              href={`tel:${companyPhone}`}
              className="inline-flex items-center gap-2 text-sm text-purple-600 font-medium hover:text-purple-700"
            >
              <Phone size={14} />
              Questions? Call {companyPhone}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
