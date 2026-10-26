"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatTimeCDT, formatDateCDT } from "@/utils/timezone";

export default function TourPrintPage({ params }) {
  const tourId = params.id;

  const { data: tour, isLoading: tourLoading } = useQuery({
    queryKey: ["tour-print", tourId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${tourId}`);
      if (!res.ok) throw new Error("Failed to fetch tour");
      return res.json();
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["tour-print-participants", tourId],
    queryFn: async () => {
      const res = await fetch(
        `/api/tours/participants?appointment_id=${tourId}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.participants || [];
    },
    enabled: !!tourId,
  });

  const { data: itinerary = [] } = useQuery({
    queryKey: ["tour-print-itinerary", tourId],
    queryFn: async () => {
      const res = await fetch(`/api/tours/itinerary?appointment_id=${tourId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.itinerary || [];
    },
    enabled: !!tourId,
  });

  const handlePrint = () => window.print();

  if (tourLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Loading tour details…</p>
        </div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center text-gray-600">
          <p className="text-lg font-semibold">Tour not found</p>
          <a
            href="/tours"
            className="text-purple-600 hover:underline text-sm mt-2 block"
          >
            Back to Tours
          </a>
        </div>
      </div>
    );
  }

  const startDate = tour.start_time ? new Date(tour.start_time) : null;
  const totalPeople = (parseInt(tour.num_people) || 0) + 1; // guests + 1 driver

  let endTimeDisplay = tour.tour_end_time || "";
  if (endTimeDisplay && endTimeDisplay.includes("T")) {
    const d = new Date(endTimeDisplay);
    endTimeDisplay = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } else if (endTimeDisplay && endTimeDisplay.includes(":")) {
    const [h, m] = endTimeDisplay.split(":");
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    endTimeDisplay = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  const perPerson =
    tour.tour_payment_split === "divided" && totalPeople > 0
      ? (Number(tour.tour_flat_fee || 0) / totalPeople).toFixed(2)
      : null;

  return (
    <>
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-break { page-break-after: always; }
        }
      `}</style>

      {/* Action bar - hidden on print */}
      <div className="no-print bg-gray-100 border-b border-gray-300 px-6 py-3 flex items-center gap-4 print:hidden">
        <a
          href="/tours"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
        >
          ← Back to Tours
        </a>
        <button
          onClick={handlePrint}
          className="ml-auto px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          🖨️ Print Tour Sheet
        </button>
      </div>

      {/* Printable content */}
      <div className="max-w-3xl mx-auto px-8 py-8 bg-white min-h-screen">
        {/* Header */}
        <div className="border-b-4 border-purple-600 pb-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🚖</span>
                <span className="text-lg font-bold text-gray-800">
                  Catch A Ride
                </span>
              </div>
              <h1 className="text-3xl font-extrabold text-purple-700 mt-1">
                Tour Details
              </h1>
            </div>
            <div className="text-right text-sm text-gray-500">
              {tour.booking_number && (
                <div className="text-lg font-mono font-bold text-gray-800">
                  #{tour.booking_number}
                </div>
              )}
              <div className="mt-1">
                Printed: {format(new Date(), "MMM d, yyyy h:mm a")}
              </div>
            </div>
          </div>
        </div>

        {/* Trip Overview */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-3">
            Trip Overview
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Primary Passenger
              </div>
              <div className="font-bold text-gray-900 text-base">
                {tour.client_name || "—"}
              </div>
              {tour.client_phone && (
                <div className="text-sm text-gray-600 mt-0.5">
                  📱 {tour.client_phone}
                </div>
              )}
              {tour.client_email && (
                <div className="text-sm text-gray-600">
                  ✉️ {tour.client_email}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Date & Time
              </div>
              <div className="font-bold text-gray-900 text-base">
                {startDate ? format(startDate, "EEEE, MMMM d, yyyy") : "—"}
              </div>
              <div className="text-sm text-gray-700 mt-0.5">
                {startDate ? format(startDate, "h:mm a") : ""}
                {endTimeDisplay ? ` – ${endTimeDisplay}` : ""}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Driver
              </div>
              <div className="font-bold text-gray-900">
                {tour.employee_name || "—"}
              </div>
              {tour.vehicle_name && (
                <div className="text-sm text-gray-600">{tour.vehicle_name}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Status
              </div>
              <div className="font-bold text-gray-900 capitalize">
                {tour.status || "pending"}
              </div>
              <div className="text-sm text-gray-600 capitalize mt-0.5">
                Payment: {tour.payment_status || "unpaid"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Total Participants
              </div>
              <div className="font-bold text-gray-900">
                {totalPeople} people
              </div>
              <div className="text-sm text-gray-600 capitalize">
                {tour.tour_participant_type || "passengers"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase font-semibold mb-0.5">
                Vehicle
              </div>
              <div className="font-bold text-gray-900">
                {tour.vehicle_category || tour.vehicle_name || "Luxury Van"}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">
            Pricing
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-extrabold text-emerald-700">
                ${Number(tour.tour_flat_fee || 0).toFixed(2)}
              </div>
              <div className="text-sm text-emerald-600 mt-0.5">
                {tour.tour_payment_split === "divided"
                  ? "Divided equally among all participants"
                  : "Single total payment"}
              </div>
              {perPerson && (
                <div className="text-sm font-semibold text-emerald-700 mt-1">
                  ${perPerson} per person ({totalPeople} people)
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase font-semibold">
                Payment Method
              </div>
              <div className="font-bold text-gray-900">
                {tour.payment_method || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Itinerary */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>📍</span> Tour Itinerary ({itinerary.length} stops)
          </h2>
          {itinerary.length === 0 ? (
            <div className="text-sm text-gray-400 italic border border-dashed border-gray-300 rounded-lg p-4 text-center">
              No stops recorded
            </div>
          ) : (
            <div className="space-y-2">
              {itinerary.map((stop, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {stop.location}
                    </div>
                    {stop.description && (
                      <div className="text-sm text-gray-600 mt-0.5">
                        {stop.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Participants */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>👥</span> Participants
          </h2>

          {/* Primary Passenger */}
          <div className="p-3 border-2 border-purple-300 rounded-lg mb-2 bg-purple-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase">
                Primary
              </span>
              <span className="font-semibold text-gray-900">
                {tour.client_name || "—"}
              </span>
            </div>
            <div className="text-sm text-gray-600 mt-1 flex gap-4">
              {tour.client_phone && <span>📱 {tour.client_phone}</span>}
              {tour.client_email && <span>✉️ {tour.client_email}</span>}
            </div>
          </div>

          {participants.length === 0 ? (
            <div className="text-sm text-gray-400 italic">
              No additional guests
            </div>
          ) : (
            participants.map((p, idx) => (
              <div
                key={idx}
                className="p-3 border border-gray-200 rounded-lg mb-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 w-5">
                    {idx + 1}.
                  </span>
                  <span className="font-semibold text-gray-900">{p.name}</span>
                  {p.participant_type && (
                    <span className="text-xs text-gray-500 capitalize">
                      ({p.participant_type})
                    </span>
                  )}
                </div>
                <div className="ml-7 text-sm text-gray-600 mt-1 space-y-0.5">
                  {p.phone && <div>📱 {p.phone}</div>}
                  {p.email && <div>✉️ {p.email}</div>}
                  {p.pickup_location && (
                    <div>🟢 Pickup: {p.pickup_location}</div>
                  )}
                  {p.dropoff_location && (
                    <div>🔴 Dropoff: {p.dropoff_location}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Notes */}
        {(tour.notes || tour.tour_notes || tour.driver_notes) && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>📝</span> Notes
            </h2>
            <div className="space-y-3">
              {tour.tour_notes && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                    Tour / Itinerary Notes
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {tour.tour_notes}
                  </div>
                </div>
              )}
              {tour.notes && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">
                    General Notes
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {tour.notes}
                  </div>
                </div>
              )}
              {tour.driver_notes && (
                <div className="border border-gray-200 rounded-lg p-3 bg-amber-50 border-amber-200">
                  <div className="text-xs font-bold text-amber-700 uppercase mb-1">
                    Driver Notes
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {tour.driver_notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-300 pt-4 mt-6">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Catch A Ride — Tour Details Sheet</span>
            <span>
              {tour.booking_number
                ? `Booking #${tour.booking_number}`
                : `Tour ID: ${tourId}`}
            </span>
          </div>
          {/* Signature lines */}
          <div className="grid grid-cols-2 gap-8 mt-6">
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">
                Driver Signature / Date
              </div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-1 text-xs text-gray-500">
                Authorized By / Date
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
