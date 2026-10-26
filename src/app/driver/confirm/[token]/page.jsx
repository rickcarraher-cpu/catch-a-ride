"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { TripOfferCard } from "@/components/DriverPortal/TripOfferCard";

export default function DriverConfirmPage({ params }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);

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

  async function handleSubmit() {
    if (decision === "declined" && !reason.trim()) {
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
            decision,
            reason: decision === "declined" ? reason : null,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading trip details...</span>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
                  Thank you for confirming. The trip has been marked as accepted
                  and the admin has been notified.
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
                  We've recorded your response. The admin has been notified and
                  will reassign this trip.
                </p>
              </>
            )}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
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
          </div>
        </div>
      </div>
    );
  }

  // Reason screen (if declined)
  if (decision === "declined") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
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
                "Submit Response"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main View: trip card with Accept / Decline ---
  const alreadyResponded = !!trip.driver_response_at;
  const alreadyAccepted = trip.driver_accepted === "accepted";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            {alreadyResponded ? "Trip Details" : "Trip Confirmation Needed"}
          </h1>
          <p className="text-gray-500 mt-1">
            {alreadyResponded
              ? `You responded on ${new Date(
                  trip.driver_response_at,
                ).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/Chicago",
                })}`
              : "Please confirm if you can take this trip"}
          </p>
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
            <p
              className={`font-semibold text-sm ${alreadyAccepted ? "text-green-700" : "text-orange-700"}`}
            >
              {alreadyAccepted
                ? "You Accepted This Trip"
                : "You Declined This Trip"}
            </p>
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
                  handleSubmit();
                }
          }
          onDecline={alreadyResponded ? null : () => setDecision("declined")}
          isSubmitting={submitting}
          accepting={submitting && decision === "accepted"}
          error={error}
        />

        {alreadyResponded && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
            <p className="font-medium">ℹ️ Your response has been recorded</p>
            <p className="mt-1">
              You can view this link anytime to see the trip details, but you
              cannot change your response.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
