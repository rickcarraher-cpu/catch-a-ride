"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { TripOfferCard } from "@/components/DriverPortal/TripOfferCard";

export default function DriverTripPage({ params }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    loadTrip();
  }, []);

  async function loadTrip() {
    try {
      const response = await fetch(`/api/confirmations/driver/${params.token}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load trip");
      }
      const data = await response.json();
      setTrip(data.trip);
    } catch (err) {
      console.error("Failed to load trip:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(decisionValue = decision) {
    if (decisionValue === "declined" && !reason.trim()) {
      setError("Please provide a reason for declining");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/confirmations/driver/${params.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decisionValue,
            reason: decisionValue === "declined" ? reason : null,
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
        `/api/appointments/${trip.id}/ics?recipient=driver`,
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
      window.location.href = `/api/appointments/${trip.id}/ics?recipient=driver`;
    }
  }

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

    // Show passenger name in event title so driver knows who they're picking up
    const passengerName =
      trip.passenger_name || trip.client_name || "Passenger";
    const serviceNames = (trip.services || [])
      .map((s) => s.service_name || "Service")
      .join(", ");
    const title = encodeURIComponent(
      `${passengerName} — ${serviceNames || "Trip"}`,
    );

    // Build comprehensive details for the calendar description
    const detailLines = [];
    detailLines.push(`Booking #${trip.booking_number || trip.id}`);
    if (trip.pickup_address) detailLines.push(`Pickup: ${trip.pickup_address}`);
    if (trip.dropoff_address || trip.destination)
      detailLines.push(`Dropoff: ${trip.dropoff_address || trip.destination}`);
    detailLines.push("");
    detailLines.push(`Passenger: ${passengerName}`);
    if (trip.passenger_phone || trip.client_phone)
      detailLines.push(`Phone: ${trip.passenger_phone || trip.client_phone}`);
    if (trip.num_people)
      detailLines.push(`# of Passengers: ${trip.num_people}`);
    const bagParts = [];
    if (trip.num_bags_checked)
      bagParts.push(`${trip.num_bags_checked} checked`);
    if (trip.num_bags_carry_on)
      bagParts.push(`${trip.num_bags_carry_on} carry-on`);
    if (bagParts.length > 0) detailLines.push(`Bags: ${bagParts.join(" / ")}`);
    if (trip.num_car_seats)
      detailLines.push(`Car Seats: ${trip.num_car_seats}`);
    if (trip.num_golf_bags)
      detailLines.push(`Golf Bags: ${trip.num_golf_bags}`);
    if (trip.outgoing_flight_info)
      detailLines.push(`Flight Info: ${trip.outgoing_flight_info}`);
    if (trip.returning_flight_info)
      detailLines.push(`Return Flight: ${trip.returning_flight_info}`);
    if (trip.driver_notes)
      detailLines.push(`Driver Notes: ${trip.driver_notes}`);
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
        `Payment Status: ${
          trip.payment_status.charAt(0).toUpperCase() +
          trip.payment_status.slice(1)
        }`,
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

    // Set pickup address as location so drivers can tap to open in Maps
    const location = encodeURIComponent(trip.pickup_address || "");

    // ctz tells Google Calendar the timezone for these local-time strings
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}&ctz=America%2FChicago`;
  }

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-lg">Loading trip details...</span>
        </div>
      </div>
    );
  }

  // --- Error State (no trip loaded) ---
  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
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

  // --- Success State (after submitting decision) ---
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            {decision === "accepted" ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Accepted!
                </h1>
                <p className="text-gray-600 mb-6">
                  Thank you for confirming. The admin has been notified.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Declined
                </h1>
                <p className="text-gray-600 mb-6">
                  We've recorded your response. The admin will reassign this
                  trip.
                </p>
              </>
            )}

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-6">
              <strong>Booking #:</strong> {trip.booking_number}
              <br />
              <strong>Date:</strong> {trip.display_long_date}
            </div>

            {decision === "accepted" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 font-medium">
                  Add to your calendar
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDownloadIcs}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Calendar size={16} />
                    Apple / Outlook
                  </button>
                  <a
                    href={buildGoogleCalendarUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors text-sm"
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

  // --- Decline Reason Screen ---
  if (decision === "declined") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Please Tell Us Why
          </h1>
          <p className="text-gray-500 mb-6">
            This helps us better manage schedules and assignments.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for declining
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Family emergency, already booked, vehicle issue..."
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
                "Submit"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Remove the "Confirm Acceptance" screen - it's no longer needed
  // When user clicks Accept, we submit immediately and show success

  // --- Main Combined View ---
  const alreadyResponded = !!trip.driver_response_at;
  const alreadyAccepted = trip.driver_accepted === "accepted";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            #{trip.booking_number}
          </h1>
          <p className="text-gray-500 mt-1">{trip.display_long_date}</p>
        </div>

        {/* Already Responded Banner */}
        {alreadyResponded && (
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              alreadyAccepted
                ? "bg-green-50 border border-green-200"
                : "bg-orange-50 border border-orange-200"
            }`}
          >
            {alreadyAccepted ? (
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
            ) : (
              <XCircle size={20} className="text-orange-600 flex-shrink-0" />
            )}
            <div>
              <p
                className={`font-semibold text-sm ${alreadyAccepted ? "text-green-700" : "text-orange-700"}`}
              >
                {alreadyAccepted ? "You Accepted" : "You Declined"}
              </p>
              <p className="text-xs text-gray-500">
                Responded{" "}
                {new Date(trip.driver_response_at).toLocaleString("en-US", {
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

        {/* === Trip Card (driver header + details + Accept/Decline) === */}
        <TripOfferCard
          trip={trip}
          hideActions={alreadyResponded}
          onAccept={
            alreadyResponded
              ? null
              : () => {
                  setDecision("accepted");
                  handleSubmit("accepted");
                }
          }
          onDecline={alreadyResponded ? null : () => setDecision("declined")}
          isSubmitting={submitting}
          accepting={submitting && decision === "accepted"}
          error={error}
        />

        {/* === Add to Calendar === */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <button
            onClick={() => setCalendarOpen(!calendarOpen)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar size={20} className="text-blue-600" />
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
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm"
              >
                <Calendar size={16} />
                Apple / Outlook
              </button>
              <a
                href={buildGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-blue-600 text-blue-600 font-medium rounded-xl hover:bg-blue-50 transition-colors text-sm"
              >
                <Calendar size={16} />
                Google Calendar
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        {alreadyResponded && (
          <p className="text-center text-xs text-gray-400 pb-4">
            You can revisit this page anytime to view trip details.
          </p>
        )}
      </div>
    </div>
  );
}
