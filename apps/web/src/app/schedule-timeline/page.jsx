"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Clock,
  X,
  MapPin,
  User,
  CreditCard,
  FileText,
  ExternalLink,
  Phone,
  Bell,
  CheckSquare,
  Square,
  Loader2,
  CheckCheck,
  AlertCircle,
  Send,
  AlertTriangle,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  getTodayInCDT,
  getDatePartsInCDT,
  createDateInCDT,
  formatTimeCDT,
  formatDateCDT,
} from "@/utils/timezone";

/**
 * Schedule Timeline — Enhanced Drag & Drop
 * - Full free drag: both driver AND time can be changed
 * - Conflict approval: mark overlapping trips as tentative
 * - Vertical stacking: overlapping trips split into lanes
 * Previous chunks: sticky header/column, now-line, drag-drop, snap, spring-back, CDT fixes.
 */

const TOTAL_MINUTES = 24 * 60;

// ─── Time helpers ──────────────────────────────────────────────────────────────

// Returns minutes-since-midnight in America/Chicago time.
// Returns null (NOT 0) if the input is missing or unparseable — callers must
// skip blocks that come back null so we never silently place them at midnight.
function toMinutesSinceMidnight(isoString) {
  if (!isoString) return null;
  try {
    const parts = getDatePartsInCDT(isoString);
    if (!parts || parts.hour == null || parts.minute == null) return null;
    const h = Number(parts.hour);
    const m = Number(parts.minute);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  } catch (err) {
    console.error("[timeline] Could not parse start_time:", isoString, err);
    return null;
  }
}

function formatTimeFromMinutes(minutes) {
  const safeMin = ((minutes % TOTAL_MINUTES) + TOTAL_MINUTES) % TOTAL_MINUTES;
  const h = Math.floor(safeMin / 60);
  const m = Math.round(safeMin % 60);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m.toString().padStart(2, "0");
  return `${displayH}:${displayM} ${ampm}`;
}

// Use the same CDT formatter as the rest of the app (schedule builder, trips table, etc.)
// so displayed times always match what other pages show for the same trip.
function formatTimeISO(isoString) {
  return formatTimeCDT(isoString);
}

// Build new ISO timestamp from a YYYY-MM-DD date string + minute offset (CDT-aware)
function buildStartISO(dateStr, minutes) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes) % 60;
  return createDateInCDT(year, month, day, h, m).toISOString();
}

// ─── Segment builder (handles midnight crossings) ──────────────────────────────

function buildTripSegments(trip, color) {
  const startMin = toMinutesSinceMidnight(trip.start_time);
  // If start time cannot be parsed, do NOT default to midnight — skip entirely
  if (startMin === null) {
    console.error(
      "[timeline] Skipping block with unparseable start_time:",
      trip.id,
      trip.start_time,
    );
    return [];
  }
  // Neon returns SUM(duration_minutes) as a STRING — cast to Number to avoid string concat
  // Fall back to 75 min default so blocks always render even if duration is missing
  const duration = Number(trip.duration_minutes) || 75;
  const endMin = startMin + duration;
  const label = [
    trip.client_name,
    trip.booking_number ? `#${trip.booking_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (endMin <= TOTAL_MINUTES) {
    return [
      {
        leftPct: (startMin / TOTAL_MINUTES) * 100,
        widthPct: (duration / TOTAL_MINUTES) * 100,
        label,
        color,
        trip,
        isMidnightCross: false,
      },
    ];
  }
  // Trip crosses midnight — only show the portion up to midnight on this day.
  // The after-midnight carryover is shown on the NEXT day via buildCarryoverSegment.
  const firstDur = TOTAL_MINUTES - startMin;
  return [
    {
      leftPct: (startMin / TOTAL_MINUTES) * 100,
      widthPct: (firstDur / TOTAL_MINUTES) * 100,
      label: label + " →",
      color,
      trip,
      isMidnightCross: true,
    },
  ];
}

// Build the carryover segment for a trip that started the previous day and
// extends past midnight into the current day (shown at the left of today's timeline).
function buildCarryoverSegment(trip, color) {
  const startMin = toMinutesSinceMidnight(trip.start_time);
  if (startMin === null) return null;
  const duration = Number(trip.duration_minutes) || 75;
  const endMin = startMin + duration;

  // Only produce a carryover segment if the trip actually crosses midnight
  if (endMin <= TOTAL_MINUTES) return null;

  const secondDur = endMin - TOTAL_MINUTES;
  const label = [
    trip.client_name,
    trip.booking_number ? `#${trip.booking_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    leftPct: 0,
    widthPct: (secondDur / TOTAL_MINUTES) * 100,
    label: "→ " + label,
    color,
    trip,
    isMidnightCross: true,
    isCarryover: true,
    lane: 0,
  };
}

// ─── Blocked segment builder ───────────────────────────────────────────────────
// Returns the portion of a blocked time that falls within a given CDT date.
// Returns null if the blocked time does not overlap with that date.
function buildBlockedSegmentForDate(bt, dateStr) {
  if (!bt.start_time || !bt.end_time || !dateStr) return null;
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayStart = createDateInCDT(y, m, d, 0, 0); // 12:00 AM CDT
    const dayEnd = createDateInCDT(y, m, d, 23, 59); // 11:59 PM CDT

    const btStart = new Date(bt.start_time);
    const btEnd = new Date(bt.end_time);

    // No overlap
    if (btEnd <= dayStart || btStart > dayEnd) return null;

    // Clamp to the day
    const clampedStart = btStart < dayStart ? dayStart : btStart;
    const clampedEnd = btEnd > dayEnd ? dayEnd : btEnd;

    const startParts = getDatePartsInCDT(clampedStart.toISOString());
    const endParts = getDatePartsInCDT(clampedEnd.toISOString());

    const startMin = Number(startParts.hour) * 60 + Number(startParts.minute);
    const rawEndMin = Number(endParts.hour) * 60 + Number(endParts.minute);
    // Treat 23:59 as full end-of-day
    const endMin = rawEndMin >= 23 * 60 + 59 ? TOTAL_MINUTES : rawEndMin;

    const duration = endMin - startMin;
    if (duration <= 0) return null;

    // Labels in CDT
    const tz = "America/Chicago";
    const fmtOpts = { timeZone: tz, hour: "numeric", minute: "2-digit" };
    const startLabel = new Date(bt.start_time).toLocaleTimeString(
      "en-US",
      fmtOpts,
    );
    const endLabel = new Date(bt.end_time).toLocaleTimeString("en-US", fmtOpts);
    const isAllDay = startMin === 0 && endMin >= 23 * 60 + 59;

    // Check if this is an "available" time block or a "blocked" time block
    const isAvailable = bt.type === "available";
    const prefix = isAvailable ? "Available" : "Not Available";

    return {
      leftPct: (startMin / TOTAL_MINUTES) * 100,
      widthPct: (duration / TOTAL_MINUTES) * 100,
      label: isAllDay
        ? `${prefix} — All Day`
        : `${prefix} from ${startLabel} to ${endLabel}`,
      isAllDay,
      bt,
      isAvailable,
    };
  } catch (err) {
    console.error("[timeline] Could not build blocked segment:", bt.id, err);
    return null;
  }
}

// ─── Address and vehicle formatting helpers ────────────────────────────────────

// Extract city from address, or return "BNA" if it's the airport
function formatLocation(trip, field) {
  // Check if this is BNA airport
  const destination = (trip.destination || "").toLowerCase();
  const pickupAddr = (trip.pickup_address || "").toLowerCase();
  const dropoffAddr = (trip.dropoff_address || "").toLowerCase();

  const isBNA =
    destination.includes("bna") ||
    destination.includes("nashville international") ||
    destination.includes("airport") ||
    pickupAddr.includes("bna") ||
    dropoffAddr.includes("bna");

  if (field === "pickup" && isBNA && pickupAddr.includes("bna")) {
    return "BNA";
  }
  if (field === "dropoff" && isBNA) {
    return "BNA";
  }

  // Otherwise extract city name
  if (field === "pickup") {
    return (
      trip.pickup_city || extractCityFromAddress(trip.pickup_address) || "—"
    );
  } else {
    // For dropoff, prefer destination field, then dropoff_city, then parse dropoff_address
    if (trip.destination && !isBNA) {
      return extractCityFromAddress(trip.destination) || trip.destination;
    }
    return (
      trip.dropoff_city || extractCityFromAddress(trip.dropoff_address) || "—"
    );
  }
}

// Extract city from a full address string (simple heuristic: city is usually before state/zip)
function extractCityFromAddress(address) {
  if (!address) return null;
  // Try to find pattern like "City, ST" or "City TN"
  const parts = address.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    // Return the second-to-last part (usually city)
    return parts[parts.length - 2];
  }
  // Fallback: return first part if no commas
  return parts[0] || null;
}

// Strip color prefix from vehicle category (e.g. "Black Suburban" → "Suburban")
function formatVehicleCategory(category) {
  if (!category) return null;
  const colors = [
    "black",
    "white",
    "silver",
    "gray",
    "grey",
    "blue",
    "red",
    "green",
  ];
  const lower = category.toLowerCase();
  for (const color of colors) {
    if (lower.startsWith(color + " ")) {
      return category.substring(color.length + 1).trim();
    }
  }
  return category;
}

// ─── Lane assignment for overlapping trips ──────────────────────────────────

function assignLanes(tripsForDriver) {
  // Sort trips by start time
  const sorted = [...tripsForDriver].sort((a, b) => {
    const aStart = toMinutesSinceMidnight(a.start_time);
    const bStart = toMinutesSinceMidnight(b.start_time);
    if (aStart === null) return 1;
    if (bStart === null) return -1;
    return aStart - bStart;
  });

  const lanes = [];

  for (const trip of sorted) {
    const startMin = toMinutesSinceMidnight(trip.start_time);
    if (startMin === null) continue;

    const duration = Number(trip.duration_minutes) || 75;

    // Find first available lane
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      // Check if this trip fits in this lane (no overlap with last trip in lane)
      const lastTrip = lane[lane.length - 1];
      const lastEnd =
        toMinutesSinceMidnight(lastTrip.start_time) +
        (Number(lastTrip.duration_minutes) || 75);

      if (startMin >= lastEnd) {
        assignedLane = i;
        break;
      }
    }

    // If no lane found, create new lane
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push([]);
    }

    lanes[assignedLane].push(trip);
    trip._lane = assignedLane;
  }

  return { trips: sorted, laneCount: lanes.length };
}

// ─── Overlap check for driver-reassignment drops ──────────────────────────────
// Returns true when dropping draggingTrip onto targetDriverId would overlap
// any trip that driver already owns, using the proposed start time.
// Always allows drops to the "unassigned" row (no conflict possible there).
function wouldOverlapOnDriver(
  targetDriverId,
  trips,
  draggingTrip,
  newStartMin,
) {
  if (targetDriverId === "unassigned") return false;
  if (newStartMin === null || newStartMin === undefined) {
    const storedStart = toMinutesSinceMidnight(draggingTrip.start_time);
    if (storedStart === null) return true;
    newStartMin = storedStart;
  }
  const duration = Number(draggingTrip.duration_minutes) || 0;
  const newEnd = newStartMin + duration;

  return trips.some((t) => {
    if (t.id === draggingTrip.id) return false;
    if (String(t.employee_id) !== String(targetDriverId)) return false;
    const tStart = toMinutesSinceMidnight(t.start_time);
    if (tStart === null) return false;
    const tEnd = tStart + (Number(t.duration_minutes) || 0);
    return newStartMin < tEnd && tStart < newEnd;
  });
}

// ─── Gap / snap logic ──────────────────────────────────────────────────────────

function getOccupied(driverId, trips, excludeTripId) {
  return trips
    .filter((t) => {
      const inRow =
        driverId === "unassigned"
          ? !t.employee_id
          : String(t.employee_id) === String(driverId);
      return (
        inRow && t.id !== excludeTripId && (Number(t.duration_minutes) || 0) > 0
      );
    })
    .map((t) => ({
      start: toMinutesSinceMidnight(t.start_time),
      end: toMinutesSinceMidnight(t.start_time) + Number(t.duration_minutes),
    }))
    .sort((a, b) => a.start - b.start);
}

function getGaps(driverId, trips, excludeTripId) {
  const occupied = getOccupied(driverId, trips, excludeTripId);
  const gaps = [];
  let prev = 0;
  for (const { start, end } of occupied) {
    if (start > prev) gaps.push({ start: prev, end: start });
    prev = Math.max(prev, end);
  }
  if (prev < TOTAL_MINUTES) gaps.push({ start: prev, end: TOTAL_MINUTES });
  return gaps;
}

// How close (minutes) the cursor must be to a gap edge to trigger snapping.
// When farther away the trip lands where the cursor actually is (free drop).
const SNAP_THRESHOLD_MIN = 30;

function findSnapEdge(driverId, trips, trip, rawStartMin) {
  const duration = Number(trip.duration_minutes) || 0;
  if (!duration) return null;

  // Unassigned row — overlapping is always allowed, no conflict checking needed
  if (String(driverId) === "unassigned") {
    return Math.max(0, Math.min(rawStartMin, TOTAL_MINUTES - duration));
  }

  const gaps = getGaps(driverId, trips, trip.id);

  let nearestEdge = null;
  let nearestEdgeDist = Infinity;
  let freePos = null; // cursor position clamped inside any valid gap

  for (const gap of gaps) {
    if (gap.end - gap.start < duration) continue; // too small

    // Free position — exact cursor if it fits; otherwise clamp to gap bounds
    if (rawStartMin >= gap.start && rawStartMin + duration <= gap.end) {
      if (freePos === null) freePos = rawStartMin; // perfect fit — prefer this gap
    } else if (freePos === null) {
      freePos = Math.max(gap.start, Math.min(rawStartMin, gap.end - duration));
    }

    // Left-edge snap candidate
    const dL = Math.abs(rawStartMin - gap.start);
    if (dL < nearestEdgeDist) {
      nearestEdgeDist = dL;
      nearestEdge = gap.start;
    }

    // Right-edge snap candidate (trip tail aligned to gap end)
    const rightEdge = gap.end - duration;
    if (rightEdge > gap.start) {
      const dR = Math.abs(rawStartMin - rightEdge);
      if (dR < nearestEdgeDist) {
        nearestEdgeDist = dR;
        nearestEdge = rightEdge;
      }
    }
  }

  if (freePos === null && nearestEdge === null) return null; // no valid gap at all

  // Snap to edge only when cursor is within the threshold; otherwise free drop
  if (nearestEdge !== null && nearestEdgeDist <= SNAP_THRESHOLD_MIN)
    return nearestEdge;
  return freePos;
}

// ─── Click threshold ───────────────────────────────────────────────────────────
const CLICK_THRESHOLD_PX = 5; // px of cursor movement allowed for a "click"
const CLICK_MAX_MS = 400; // ms max between mousedown and mouseup for a "click"

// ─── Trip Detail Panel ────────────────────────────────────────────────────────

function TripDetailPanel({ trip, onClose, onNotify }) {
  if (!trip) return null;

  const paymentColor =
    trip.payment_status === "paid"
      ? "text-green-700 bg-green-50 border-green-200"
      : trip.payment_status === "partial"
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-red-700 bg-red-50 border-red-200";

  const paymentLabel =
    trip.payment_status === "paid"
      ? "Paid"
      : trip.payment_status === "partial"
        ? "Partial"
        : "Unpaid";

  const pickup =
    trip.display_pickup_address ||
    trip.pickup_address ||
    [trip.pickup_street, trip.pickup_city, trip.pickup_state]
      .filter(Boolean)
      .join(", ") ||
    null;

  const dropoff =
    trip.display_dropoff_address ||
    trip.dropoff_address ||
    [trip.dropoff_street, trip.dropoff_city, trip.dropoff_state]
      .filter(Boolean)
      .join(", ") ||
    trip.destination ||
    null;

  const amount =
    trip.original_amount != null ? Number(trip.original_amount) : null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl border-l border-gray-200 flex flex-col"
      style={{ animation: "slideInRight 180ms ease-out" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">
            Trip Detail
          </p>
          <h2 className="text-base font-bold text-gray-900 leading-tight truncate">
            {trip.client_name || "Unknown Passenger"}
          </h2>
          {trip.booking_number && (
            <p className="text-xs text-gray-500 mt-0.5">
              #{trip.booking_number}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Time + Duration */}
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-gray-900">
              {formatTimeCDT(trip.start_time)}
            </p>
            {Number(trip.duration_minutes) > 0 && (
              <p className="text-xs text-gray-500">
                {Number(trip.duration_minutes)} min estimated
              </p>
            )}
          </div>
        </div>

        {/* Driver */}
        <div className="flex items-center gap-2">
          <User size={14} className="text-purple-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
              Driver
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {trip.employee_name || (
                <span className="text-amber-600 italic">Unassigned</span>
              )}
            </p>
          </div>
        </div>

        {/* Passenger contact */}
        {(trip.client_phone || trip.client_email) && (
          <div className="flex items-start gap-2">
            <Phone size={14} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                Passenger
              </p>
              {trip.client_phone && (
                <a
                  href={`tel:${trip.client_phone}`}
                  className="text-sm font-semibold text-blue-600 hover:underline block"
                >
                  {trip.client_phone}
                </a>
              )}
              {trip.client_email && (
                <p className="text-xs text-gray-500">{trip.client_email}</p>
              )}
            </div>
          </div>
        )}

        {/* Pickup / Dropoff */}
        {(pickup || dropoff) && (
          <div className="flex items-start gap-2">
            <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">
                Route
              </p>
              {pickup && (
                <div className="mb-1">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">
                    From
                  </p>
                  <p className="text-xs text-gray-700 leading-snug">{pickup}</p>
                </div>
              )}
              {dropoff && (
                <div>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">
                    To
                  </p>
                  <p className="text-xs text-gray-700 leading-snug">
                    {dropoff}
                  </p>
                </div>
              )}
              {(trip.vehicle_id
                ? trip.vehicle_name
                : formatVehicleCategory(trip.vehicle_category)) && (
                <div className="mt-1">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">
                    Vehicle
                  </p>
                  <p className="text-xs text-gray-700 leading-snug">
                    🚗{" "}
                    {trip.vehicle_id
                      ? trip.vehicle_name
                      : formatVehicleCategory(trip.vehicle_category)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Payment */}
        <div className="flex items-start gap-2">
          <CreditCard size={14} className="text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">
              Payment
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border ${paymentColor}`}
              >
                {paymentLabel}
              </span>
              {amount != null && (
                <span className="text-sm font-bold text-gray-900">
                  ${amount.toFixed(2)}
                </span>
              )}
              {trip.payment_method && (
                <span className="text-xs text-gray-500">
                  {trip.payment_method}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pax / Bags */}
        {(trip.num_people > 0 ||
          trip.num_bags_checked > 0 ||
          trip.num_bags_carry_on > 0) && (
          <div className="flex items-center gap-3 text-sm flex-wrap">
            {trip.num_people > 0 && (
              <span className="text-gray-700">👤 {trip.num_people} pax</span>
            )}
            {(trip.num_bags_checked || 0) + (trip.num_bags_carry_on || 0) >
              0 && (
              <span className="text-gray-700">
                🧳{" "}
                {(trip.num_bags_checked || 0) + (trip.num_bags_carry_on || 0)}{" "}
                bags
              </span>
            )}
            {trip.num_car_seats > 0 && (
              <span className="text-gray-700">
                🚼 {trip.num_car_seats} seat
                {trip.num_car_seats !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {trip.notes && (
          <div className="flex items-start gap-2">
            <FileText size={14} className="text-gray-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">
                Notes
              </p>
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {trip.notes}
              </p>
            </div>
          </div>
        )}

        {/* Driver notes */}
        {trip.driver_notes && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
            <p className="text-xs text-purple-700 font-semibold mb-1">
              Driver Notes
            </p>
            <p className="text-xs text-purple-800 leading-relaxed">
              {trip.driver_notes}
            </p>
          </div>
        )}

        {/* Flight info */}
        {trip.outgoing_flight_info && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
            <p className="text-xs text-blue-700 font-semibold mb-0.5">
              Flight Info
            </p>
            <p className="text-xs text-blue-800">{trip.outgoing_flight_info}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 space-y-2">
        {onNotify && (
          <button
            onClick={() => onNotify(trip)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Bell size={14} />
            Notify this trip
          </button>
        )}
        <a
          href={`/booking/${trip.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Open Booking
          <ExternalLink size={14} />
        </a>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Notification Preview Modal ───────────────────────────────────────────────
// Shown before any notifications are sent so the dispatcher can see exactly
// who will be contacted and approve or cancel.
function NotifyPreviewModal({ preview, onConfirm, onCancel, isLoading }) {
  if (!preview && !isLoading) return null;

  const sendable = (preview || []).filter((p) => p.will_send_anything);
  const skipped = (preview || []).filter((p) => !p.will_send_anything);

  const channelLabel = (notify) => {
    const parts = [];
    if (notify.passenger_email || notify.passenger_sms) {
      const ch = [
        notify.passenger_email && "email",
        notify.passenger_sms && "SMS",
      ]
        .filter(Boolean)
        .join("+");
      parts.push(`Passenger (${ch})`);
    }
    if (notify.driver_email || notify.driver_sms) {
      const ch = [notify.driver_email && "email", notify.driver_sms && "SMS"]
        .filter(Boolean)
        .join("+");
      parts.push(`Driver (${ch})`);
    }
    if (notify.office_email) parts.push("Office (email)");
    return parts.length ? parts.join(" · ") : "—";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Bell size={16} className="text-indigo-600" />
              Confirm notifications
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Review who will be notified before sending.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading preview…</span>
            </div>
          ) : (
            <>
              {sendable.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Will notify — {sendable.length} trip
                    {sendable.length !== 1 ? "s" : ""}
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {sendable.map((p) => (
                      <div key={p.trip_id} className="px-3 py-2.5 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {p.client_name}
                              {p.booking_number && (
                                <span className="ml-1.5 text-xs text-gray-400 font-normal">
                                  #{p.booking_number}
                                </span>
                              )}
                            </p>
                            {p.employee_name && (
                              <p className="text-xs text-gray-500">
                                Driver: {p.employee_name}
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] text-indigo-700 font-medium text-right shrink-0">
                            {channelLabel(p.notify)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {skipped.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Will skip — {skipped.length} trip
                    {skipped.length !== 1 ? "s" : ""}
                  </p>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                    {skipped.map((p) => (
                      <div key={p.trip_id} className="px-3 py-2.5 bg-gray-50">
                        <p className="text-sm font-semibold text-gray-500 truncate">
                          {p.client_name}
                          {p.booking_number && (
                            <span className="ml-1.5 text-xs text-gray-400 font-normal">
                              #{p.booking_number}
                            </span>
                          )}
                        </p>
                        {p.skip_reasons.map((r, i) => (
                          <p key={i} className="text-xs text-orange-600 mt-0.5">
                            ⚠ {r}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(preview || []).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  No trips to preview.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel — send nothing
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || sendable.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Send size={14} />
            Send{" "}
            {sendable.length > 0
              ? `${sendable.length} notification${sendable.length !== 1 ? "s" : ""}`
              : "notifications"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Progress Modal ──────────────────────────────────────────────
// Shows real-time progress while notifications are sending.
// Each item updates from "pending" → "sending" → "sent" | "failed".
// A 10-second countdown is shown between items.
function NotifyProgressModal({
  progress,
  previewMap,
  onClose,
  isDone,
  countdown,
}) {
  const sent = progress.filter((p) => p.status === "sent").length;
  const failed = progress.filter((p) => p.status === "failed").length;
  const pending = progress.filter((p) => p.status === "pending").length;

  const statusIcon = (status) => {
    if (status === "sent")
      return <CheckCheck size={14} className="text-green-600 shrink-0" />;
    if (status === "failed")
      return <AlertCircle size={14} className="text-red-500 shrink-0" />;
    if (status === "sending")
      return (
        <Loader2 size={14} className="animate-spin text-indigo-500 shrink-0" />
      );
    return <div className="w-3.5 h-3.5 rounded-full bg-gray-200 shrink-0" />;
  };

  const statusText = (status) => {
    if (status === "sent") return "text-green-700";
    if (status === "failed") return "text-red-600";
    if (status === "sending") return "text-indigo-600 font-semibold";
    return "text-gray-400";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            {isDone ? (
              <CheckCheck size={16} className="text-green-600" />
            ) : (
              <Loader2 size={16} className="animate-spin text-indigo-600" />
            )}
            {isDone ? "Notifications sent" : "Sending notifications…"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {sent} sent · {failed} failed · {pending} remaining
            {!isDone && countdown > 0 && (
              <span className="ml-1.5 text-indigo-600 font-medium">
                · next in {countdown}s
              </span>
            )}
          </p>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {progress.map((p) => {
            const info = previewMap[p.trip_id] || {};
            return (
              <div key={p.trip_id} className="flex items-start gap-2.5">
                {statusIcon(p.status)}
                <div
                  className={`flex-1 min-w-0 text-sm ${statusText(p.status)}`}
                >
                  <span className="font-semibold truncate">
                    {info.client_name || `Trip #${p.trip_id}`}
                  </span>
                  {info.booking_number && (
                    <span className="text-gray-400 text-xs ml-1.5">
                      #{info.booking_number}
                    </span>
                  )}
                  {p.status === "failed" && p.error && (
                    <p className="text-xs text-red-500 mt-0.5">{p.error}</p>
                  )}
                </div>
                <span className={`text-xs shrink-0 ${statusText(p.status)}`}>
                  {p.status === "sent"
                    ? "✓ sent"
                    : p.status === "failed"
                      ? "✗ failed"
                      : p.status === "sending"
                        ? "sending…"
                        : "waiting"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {isDone && (
          <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ScheduleTimelinePage() {
  // Use CDT "today" — not browser-UTC date (would show wrong day for US timezones)
  const [selectedDate, setSelectedDate] = useState(getTodayInCDT);

  // ── Now indicator ─────────────────────────────────────────────────────────
  const [nowMinutes, setNowMinutes] = useState(() => {
    const parts = getDatePartsInCDT(new Date());
    return Number(parts.hour) * 60 + Number(parts.minute);
  });
  useEffect(() => {
    const tick = () => {
      const parts = getDatePartsInCDT(new Date());
      setNowMinutes(Number(parts.hour) * 60 + Number(parts.minute));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  const showNowLine = selectedDate === getTodayInCDT();
  const nowPct = (nowMinutes / TOTAL_MINUTES) * 100;

  // Trip detail panel
  const [selectedTrip, setSelectedTrip] = useState(null);

  const [tooltip, setTooltip] = useState(null);

  // Drag state
  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [springBackIds, setSpringBackIds] = useState(new Set());

  // Conflict approval modal state
  const [conflictModal, setConflictModal] = useState(null);

  // Click-vs-drag detection ref (does not cause re-renders)
  const clickCandidateRef = useRef(null);

  const laneRef = useRef(null);
  const rowRefsMap = useRef({});

  // ── Chunk 7: Notification layer state ────────────────────────────────────────
  // selectionMode: when true, clicking a block toggles it in selectedTripIds
  // instead of opening the detail panel.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  // notifyPhase: 'idle' | 'previewing' | 'sending' | 'done'
  const [notifyPhase, setNotifyPhase] = useState("idle");
  const [notifyPreview, setNotifyPreview] = useState(null);
  const [notifyPreviewLoading, setNotifyPreviewLoading] = useState(false);
  // progress: array of { trip_id, status: 'pending'|'sending'|'sent'|'failed', error? }
  const [notifyProgress, setNotifyProgress] = useState([]);
  const [notifyCountdown, setNotifyCountdown] = useState(0);

  // Build trip_id → preview-info map so the progress modal can show names
  const previewMap = (notifyPreview || []).reduce((acc, p) => {
    acc[p.trip_id] = p;
    return acc;
  }, {});

  // ── Fetch preview from API ────────────────────────────────────────────────────
  const openNotifyPreview = useCallback(async (tripIds) => {
    if (!tripIds || tripIds.length === 0) return;
    setNotifyPhase("previewing");
    setNotifyPreviewLoading(true);
    setNotifyPreview(null);
    try {
      const res = await fetch("/api/schedule-timeline/notify-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_ids: tripIds }),
      });
      if (!res.ok) throw new Error(`Preview request failed: ${res.status}`);
      const data = await res.json();
      setNotifyPreview(data.preview || []);
    } catch (err) {
      console.error("[timeline] notify preview error:", err);
      setNotifyPreview([]);
    } finally {
      setNotifyPreviewLoading(false);
    }
  }, []);

  // ── Client-side send loop — 10 s between each trip ───────────────────────────
  const NOTIFY_DELAY_MS = 10_000;

  const runNotifySend = useCallback(async (tripIds) => {
    setNotifyPhase("sending");
    const initial = tripIds.map((id) => ({ trip_id: id, status: "pending" }));
    setNotifyProgress(initial);

    for (let i = 0; i < tripIds.length; i++) {
      const tripId = tripIds[i];

      // Mark current item as "sending"
      setNotifyProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "sending" } : p)),
      );

      try {
        const res = await fetch("/api/schedule-timeline/notify-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trip_id: tripId }),
        });
        const data = await res.json();
        setNotifyProgress((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: data.success ? "sent" : "failed",
                  error: data.error || null,
                }
              : p,
          ),
        );
      } catch (err) {
        setNotifyProgress((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, status: "failed", error: err.message } : p,
          ),
        );
      }

      // 10-second delay before next trip; show a live countdown
      if (i < tripIds.length - 1) {
        let remaining = NOTIFY_DELAY_MS / 1000;
        setNotifyCountdown(remaining);
        await new Promise((resolve) => {
          const tick = setInterval(() => {
            remaining -= 1;
            setNotifyCountdown(Math.max(0, remaining));
            if (remaining <= 0) {
              clearInterval(tick);
              resolve();
            }
          }, 1_000);
        });
        setNotifyCountdown(0);
      }
    }

    setNotifyPhase("done");
  }, []);

  // ── Entry points from UI ──────────────────────────────────────────────────────
  // Called from header "Notify All" / "Notify Selected", or TripDetailPanel
  const handleNotifyTrips = useCallback(
    (tripIds) => {
      openNotifyPreview(tripIds);
    },
    [openNotifyPreview],
  );

  const handleNotifySingleTrip = useCallback(
    (trip) => {
      setSelectedTrip(null);
      openNotifyPreview([trip.id]);
    },
    [openNotifyPreview],
  );

  const handlePreviewConfirm = useCallback(() => {
    const sendable = (notifyPreview || [])
      .filter((p) => p.will_send_anything)
      .map((p) => p.trip_id);
    if (sendable.length === 0) return;
    runNotifySend(sendable);
  }, [notifyPreview, runNotifySend]);

  const handlePreviewCancel = useCallback(() => {
    setNotifyPhase("idle");
    setNotifyPreview(null);
  }, []);

  const handleProgressClose = useCallback(() => {
    setNotifyPhase("idle");
    setNotifyProgress([]);
    setNotifyPreview(null);
    // Exit selection mode and clear selection after a successful bulk send
    setSelectionMode(false);
    setSelectedTripIds(new Set());
  }, []);

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["schedule-timeline", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/schedule-timeline?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch timeline data");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // ── Fetch blocked times for the selected date ────────────────────────────────
  const { data: blockedTimesAll } = useQuery({
    queryKey: ["blocked-times-timeline", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/blocked-times?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
    staleTime: 60_000,
  });

  const drivers = data?.drivers || [];
  const trips = data?.trips || [];

  // Previous-day trips that carry over past midnight into the selected day.
  // Filter to only those that genuinely cross midnight (endMin > 1440).
  const carryoverTrips = (data?.carryoverTrips || []).filter((t) => {
    const parts = getDatePartsInCDT(t.start_time);
    if (!parts) return false;
    const startMin = Number(parts.hour) * 60 + Number(parts.minute);
    const endMin = startMin + (Number(t.duration_minutes) || 75);
    return endMin > TOTAL_MINUTES;
  });

  // Build a set of active driver IDs so trips assigned to inactive drivers
  // (e.g. someone who was deactivated after being assigned) fall into the
  // "Unassigned" row instead of becoming invisible.
  const activeDriverIdSet = new Set(drivers.map((d) => String(d.id)));

  const unassignedTrips = trips.filter(
    (t) => !t.employee_id || !activeDriverIdSet.has(String(t.employee_id)),
  );

  // Filter out any real employee named "Unassigned" — that's a placeholder record,
  // not a real driver. We show our own virtual "Unassigned" row instead.
  const realDrivers = drivers.filter(
    (d) => d.name?.toLowerCase() !== "unassigned",
  );

  // Put the virtual "Unassigned" row FIRST so it's always visible at the top
  // (even when all trips are assigned, so you can drag a trip back to unassign it)
  const allDrivers = [
    {
      id: "unassigned",
      name: "Unassigned",
      color: "#d97706",
      is_virtual: true,
    },
    ...realDrivers,
  ];

  const driverColorMap = {};
  allDrivers.forEach((d) => {
    driverColorMap[d.id] = d.color || "#4a5568";
  });

  // Hourly time ticks
  const timeSlots = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label:
      hour === 0
        ? "12a"
        : hour < 12
          ? `${hour}a`
          : hour === 12
            ? "12p"
            : `${hour - 12}p`,
    leftPct: (hour / 24) * 100,
  }));

  // ─── Drag helpers ────────────────────────────────────────────────────────────

  const getCursorMinute = useCallback((clientX) => {
    if (!laneRef.current) return 0;
    const rect = laneRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * TOTAL_MINUTES;
  }, []);

  const getDriverIdAtY = useCallback((clientY) => {
    for (const [driverId, el] of Object.entries(rowRefsMap.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return driverId;
    }
    return null;
  }, []);

  const handleBlockMouseDown = useCallback(
    (e, trip, driverId) => {
      e.preventDefault();
      e.stopPropagation();

      // ── Chunk 7: selection mode — clicks toggle, never drag ──────────────
      if (selectionMode) {
        setSelectedTripIds((prev) => {
          const next = new Set(prev);
          if (next.has(trip.id)) {
            next.delete(trip.id);
          } else {
            next.add(trip.id);
          }
          return next;
        });
        return;
      }
      // ─────────────────────────────────────────────────────────────────────

      // Record click candidate for click-vs-drag discrimination
      clickCandidateRef.current = {
        trip,
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };

      const cursorMin = getCursorMinute(e.clientX);
      const tripStartMin = toMinutesSinceMidnight(trip.start_time);
      const duration = Number(trip.duration_minutes) || 0;

      // Guard: if the stored start_time can't be parsed, keep offset at 0
      const cursorOffsetMin =
        tripStartMin !== null
          ? Math.max(
              0,
              Math.min(cursorMin - tripStartMin, Math.max(duration - 1, 0)),
            )
          : 0;

      setDragging({
        trip,
        originalDriverId: driverId,
        originalStartMin: tripStartMin,
        cursorOffsetMin,
        ghostWidthPct: (duration / TOTAL_MINUTES) * 100,
        startClientX: e.clientX, // track horizontal start to detect intentional time changes
      });
      // snapStartMin may be null here — the ghost rendering already guards for null
      setDropTarget({
        driverId,
        snapStartMin: tripStartMin,
        isValid: true,
        hasConflict: false,
      });
      setTooltip(null);
    },
    [getCursorMinute, selectionMode],
  );

  const triggerSpringBack = useCallback((tripId) => {
    setSpringBackIds((prev) => new Set([...prev, tripId]));
    setTimeout(() => {
      setSpringBackIds((prev) => {
        const n = new Set(prev);
        n.delete(tripId);
        return n;
      });
    }, 420);
  }, []);

  // Global mouse handlers while dragging
  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e) => {
      const targetDriverId = getDriverIdAtY(e.clientY);

      if (!targetDriverId) {
        setDropTarget(null);
        return;
      }

      const driverChanging =
        String(targetDriverId) !== String(dragging.originalDriverId);

      // HARD LOCK: cross-driver drops must NEVER change the time.
      // Lock the ghost to the original start time when moving to a different driver or unassigned.
      // Only allow horizontal time adjustment when the user stays on the same driver row.
      let snapStartMin;
      if (driverChanging || targetDriverId === "unassigned") {
        snapStartMin = dragging.originalStartMin;
      } else {
        const cursorMin = getCursorMinute(e.clientX);
        snapStartMin = Math.max(
          0,
          Math.min(cursorMin - dragging.cursorOffsetMin, TOTAL_MINUTES - 1),
        );
      }

      // Check for conflicts at the (locked or adjusted) time
      const hasConflict = wouldOverlapOnDriver(
        targetDriverId,
        trips,
        dragging.trip,
        snapStartMin,
      );

      setDropTarget({
        driverId: targetDriverId,
        snapStartMin,
        isValid: true, // Always valid — conflicts just trigger approval modal
        hasConflict,
      });
    };

    const onMouseUp = async (e) => {
      const { trip, originalDriverId, originalStartMin, startClientX } =
        dragging;
      const curr = dropTarget;

      // ── Click detection ─────────────────────────────────────────────────
      const candidate = clickCandidateRef.current;
      clickCandidateRef.current = null;

      if (candidate && candidate.trip.id === trip.id) {
        const dx = e.clientX - candidate.x;
        const dy = e.clientY - candidate.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const elapsed = Date.now() - candidate.time;
        if (dist < CLICK_THRESHOLD_PX && elapsed < CLICK_MAX_MS) {
          // Treat as click — open detail panel
          setDragging(null);
          setDropTarget(null);
          setSelectedTrip(candidate.trip);
          return;
        }
      }
      // ────────────────────────────────────────────────────────────────────

      setDragging(null);

      // Invalid or no target — spring back
      if (!curr || curr.snapStartMin === null) {
        triggerSpringBack(trip.id);
        setDropTarget(null);
        return;
      }

      const { driverId: targetDriverId, snapStartMin, hasConflict } = curr;

      // Check if anything actually changed
      const driverChanged = String(targetDriverId) !== String(originalDriverId);

      // HARD RULE: time NEVER changes when dropping on a different driver.
      // Only same-driver horizontal drags are allowed to shift the start time.
      const HORIZONTAL_DRAG_THRESHOLD_PX = 30;
      const horizontalDrift = Math.abs(e.clientX - (startClientX || e.clientX));
      const timeChanged =
        !driverChanged && // cross-driver drop → always keep original time
        originalStartMin !== null &&
        Math.abs(snapStartMin - originalStartMin) > 1 &&
        horizontalDrift >= HORIZONTAL_DRAG_THRESHOLD_PX;

      // No meaningful change — dropped back on the same driver at same time
      if (!driverChanged && !timeChanged) {
        setDropTarget(null);
        return;
      }

      setDropTarget(null);

      // Always use original time when the driver changes or drop goes to unassigned
      const finalStartMin =
        driverChanged || targetDriverId === "unassigned" || !timeChanged
          ? originalStartMin
          : snapStartMin;

      // If conflict detected, show approval modal
      if (hasConflict) {
        setConflictModal({
          trip,
          targetDriverId,
          newStartMin: finalStartMin,
          originalDriverId,
          originalStartMin,
          timeChanged,
          driverChanged,
        });
        return;
      }

      // No conflict — apply immediately
      // Never treat time as changed when cross-driver or dropping to unassigned
      const effectiveTimeChanged =
        timeChanged &&
        !driverChanged &&
        String(targetDriverId) !== "unassigned";
      await applyDrop(
        trip.id,
        targetDriverId,
        finalStartMin,
        false,
        effectiveTimeChanged,
      );
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [
    dragging,
    dropTarget,
    trips,
    getCursorMinute,
    getDriverIdAtY,
    queryClient,
    selectedDate,
    triggerSpringBack,
  ]);

  // ── Apply drop with optional tentative marking ────────────────────────────────
  const applyDrop = async (
    tripId,
    targetDriverId,
    newStartMin,
    markTentative,
    timeChanged,
  ) => {
    try {
      const newEmployeeId =
        targetDriverId === "unassigned" ? null : Number(targetDriverId);

      const patchBody = {
        employee_id: newEmployeeId,
        // Only send start_time when the user intentionally changed the time.
        // When dropping to "unassigned" or same time, omit it entirely so the
        // server never overwrites the original value.
        ...(timeChanged
          ? { start_time: buildStartISO(selectedDate, newStartMin) }
          : {}),
        // Explicitly set is_tentative: when markTentative is true the
        // appointment is flagged for later review; otherwise clear the flag
        // so a previously-tentative trip becomes confirmed on a clean drop.
        is_tentative: markTentative === true,
        tentative_reason:
          markTentative === true
            ? "Overlapping trip - approved as tentative, pending review"
            : null,
        send_notification: false,
      };

      const res = await fetch(`/api/appointments/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);

      queryClient.invalidateQueries({
        queryKey: ["schedule-timeline", selectedDate],
      });
    } catch (err) {
      console.error("Drop failed:", err);
      triggerSpringBack(tripId);
      queryClient.invalidateQueries({
        queryKey: ["schedule-timeline", selectedDate],
      });
    }
  };

  // ── Conflict approval handlers ────────────────────────────────────────────────
  const handleConflictApprove = async () => {
    if (!conflictModal) return;
    const {
      trip,
      targetDriverId,
      newStartMin,
      originalStartMin,
      driverChanged,
    } = conflictModal;
    setConflictModal(null);
    const conflictTimeChanged =
      originalStartMin !== null &&
      Math.abs(newStartMin - originalStartMin) > 1 &&
      String(targetDriverId) !== "unassigned";
    // Cross-driver reassignment: never mark tentative — just change the driver.
    // Same-driver time-change conflict: mark tentative for later review.
    const markTentative = !driverChanged;
    await applyDrop(
      trip.id,
      targetDriverId,
      newStartMin,
      markTentative,
      conflictTimeChanged,
    );
  };

  const handleConflictCancel = () => {
    if (conflictModal) {
      triggerSpringBack(conflictModal.trip.id);
    }
    setConflictModal(null);
  };

  // ─── Loading / error ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-500 text-sm">Loading timeline…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Failed to load timeline</p>
          <p className="text-gray-500 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isDraggingActive = !!dragging;

  return (
    <div
      className={`h-screen flex flex-col bg-gray-50 overflow-hidden ${isDraggingActive ? "select-none cursor-grabbing" : ""}`}
      onClick={() => {
        if (selectedTrip) setSelectedTrip(null);
      }}
    >
      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3 bg-gray-50 border-b border-gray-200 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm mb-3"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>

        {/* Controls row — date nav LEFT, title/count RIGHT */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Date navigation — LEFT side */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const [y, m, d] = selectedDate.split("-").map(Number);
                const prev = new Date(Date.UTC(y, m - 1, d - 1));
                setSelectedDate(prev.toISOString().split("T")[0]);
                setSelectedTrip(null);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              title="Previous day"
            >
              ←
            </button>
            <button
              onClick={() => {
                setSelectedDate(getTodayInCDT());
                setSelectedTrip(null);
              }}
              className={`px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
                selectedDate === getTodayInCDT()
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                const [y, m, d] = selectedDate.split("-").map(Number);
                const next = new Date(Date.UTC(y, m - 1, d + 1));
                setSelectedDate(next.toISOString().split("T")[0]);
                setSelectedTrip(null);
              }}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              title="Next day"
            >
              →
            </button>
            <div className="flex items-center gap-1.5 ml-1">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTrip(null);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notify buttons */}
            <div className="ml-2 flex items-center gap-1.5 border-l border-gray-200 pl-2.5">
              {trips.filter((t) => t.employee_id).length > 0 &&
                !selectionMode && (
                  <button
                    onClick={() =>
                      handleNotifyTrips(
                        trips.filter((t) => t.employee_id).map((t) => t.id),
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Bell size={13} />
                    Notify all
                  </button>
                )}
              {!selectionMode ? (
                <button
                  onClick={() => {
                    setSelectionMode(true);
                    setSelectedTripIds(new Set());
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  <CheckSquare size={13} />
                  Select
                </button>
              ) : (
                <>
                  <button
                    onClick={() =>
                      setSelectedTripIds(
                        new Set(
                          trips.filter((t) => t.employee_id).map((t) => t.id),
                        ),
                      )
                    }
                    className="px-2.5 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold rounded-lg transition-colors"
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleNotifyTrips([...selectedTripIds])}
                    disabled={selectedTripIds.size === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Bell size={13} />
                    Notify{" "}
                    {selectedTripIds.size > 0
                      ? `(${selectedTripIds.size})`
                      : "selected"}
                  </button>
                  <button
                    onClick={() => {
                      setSelectionMode(false);
                      setSelectedTripIds(new Set());
                    }}
                    className="px-2.5 py-1.5 border border-gray-300 text-gray-500 hover:bg-gray-50 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Title / trip count — after controls */}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assign Drivers</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {allDrivers.length} driver{allDrivers.length !== 1 ? "s" : ""} ·{" "}
              {trips.length} trip{trips.length !== 1 ? "s" : ""}
              {unassignedTrips.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full text-[11px]">
                  ⚠ {unassignedTrips.length} unassigned
                </span>
              )}
              {showNowLine && (
                <span className="ml-1 inline-flex items-center bg-red-100 text-red-600 font-semibold px-2 py-0.5 rounded-full text-[11px]">
                  ● Now: {formatTimeFromMinutes(nowMinutes)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Scrollable timeline area ────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ minWidth: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pb-4 w-full">
          <div className="bg-white rounded-lg shadow border border-gray-200 mt-4">
            {/* No overflow-x-auto here — single scroll container lets sticky work */}
            <div>
              <div className="w-full">
                {/* ── Sticky group: time axis header + Unassigned row always visible ── */}
                <div className="sticky top-0 z-20">
                  {/* Time axis header */}
                  <div className="bg-gray-50 border-b border-gray-200">
                    <div className="flex">
                      <div className="sticky left-0 z-30 w-36 shrink-0 px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-r border-gray-200 bg-gray-50">
                        Driver
                      </div>
                      <div ref={laneRef} className="flex-1 relative h-8">
                        {timeSlots.map((slot) => (
                          <div
                            key={slot.hour}
                            className="absolute top-0 h-full flex items-center"
                            style={{ left: `${slot.leftPct}%` }}
                          >
                            <div className="absolute top-0 bottom-0 left-0 w-px bg-gray-200" />
                            <span className="text-[10px] font-medium text-gray-400 pl-1">
                              {slot.label}
                            </span>
                          </div>
                        ))}
                        {showNowLine && (
                          <div
                            className="absolute top-0 bottom-0 flex items-center pointer-events-none z-10"
                            style={{ left: `${nowPct}%` }}
                          >
                            <div className="w-0.5 h-full bg-red-400 opacity-80" />
                            <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Unassigned row — pinned directly below the time header */}
                  {(() => {
                    const uColor = "#d97706";
                    const uDropTarget =
                      isDraggingActive &&
                      dropTarget &&
                      String(dropTarget.driverId) === "unassigned";
                    const uValid = uDropTarget && dropTarget.isValid;
                    const uInvalid = uDropTarget && !dropTarget.isValid;
                    const uDimmed =
                      isDraggingActive &&
                      dropTarget &&
                      String(dropTarget.driverId) !== "unassigned";
                    const uSegments = [
                      ...unassignedTrips.flatMap((t) =>
                        buildTripSegments(t, uColor),
                      ),
                      ...carryoverTrips
                        .filter(
                          (t) =>
                            !t.employee_id ||
                            !activeDriverIdSet.has(String(t.employee_id)),
                        )
                        .map((t) => buildCarryoverSegment(t, uColor))
                        .filter(Boolean),
                    ];
                    const uBg = uValid
                      ? "bg-green-50"
                      : uInvalid
                        ? "bg-red-50"
                        : "bg-amber-50";
                    return (
                      <div
                        ref={(el) => {
                          rowRefsMap.current["unassigned"] = el;
                        }}
                        className={[
                          "flex border-b border-amber-200 shadow-[0_2px_6px_rgba(0,0,0,0.08)]",
                          uBg,
                          uDimmed ? "opacity-40" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {/* Label cell */}
                        <div
                          className={[
                            "sticky left-0 z-10 w-36 shrink-0 px-3 flex items-center gap-1.5 border-r border-amber-200",
                            uBg,
                          ].join(" ")}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: "#d97706" }}
                          />
                          <span className="text-xs font-semibold truncate text-amber-700">
                            Unassigned
                          </span>
                        </div>
                        {/* Timeline lane */}
                        <div className="flex-1 relative" style={{ height: 96 }}>
                          {timeSlots.map((slot) => (
                            <div
                              key={slot.hour}
                              className="absolute top-0 bottom-0 w-px bg-amber-100"
                              style={{ left: `${slot.leftPct}%` }}
                            />
                          ))}
                          {showNowLine && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-60 pointer-events-none z-10"
                              style={{ left: `${nowPct}%` }}
                            />
                          )}
                          {uDropTarget &&
                            dropTarget.snapStartMin !== null &&
                            dragging && (
                              <div
                                className={`absolute top-1.5 bottom-1.5 rounded border-2 pointer-events-none ${uValid ? "border-green-500 bg-green-100" : "border-red-400 bg-red-100"}`}
                                style={{
                                  left: `${(dropTarget.snapStartMin / TOTAL_MINUTES) * 100}%`,
                                  width: `${Math.max(dragging.ghostWidthPct, 1)}%`,
                                  opacity: 0.75,
                                }}
                              >
                                <span className="px-1 text-[9px] font-bold text-green-800 whitespace-nowrap truncate leading-none flex items-center h-full">
                                  {formatTimeFromMinutes(
                                    dropTarget.snapStartMin,
                                  )}
                                </span>
                              </div>
                            )}
                          {uSegments.map((seg, idx) => {
                            const isDraggingThis =
                              isDraggingActive &&
                              dragging &&
                              dragging.trip.id === seg.trip.id;
                            const isSpringBack = springBackIds.has(seg.trip.id);
                            const isSelected =
                              selectedTrip && selectedTrip.id === seg.trip.id;
                            const isCheckedForNotify =
                              selectionMode && selectedTripIds.has(seg.trip.id);
                            const showDetail = seg.widthPct >= 5;
                            const timeLabel = formatTimeCDT(
                              seg.trip.start_time,
                            );
                            const pickupCity = formatLocation(
                              seg.trip,
                              "pickup",
                            );
                            const dropoffCity = formatLocation(
                              seg.trip,
                              "dropoff",
                            );
                            return (
                              <div
                                key={`u-${seg.trip.id}-${idx}`}
                                className={[
                                  "absolute top-1.5 bottom-1.5 rounded overflow-hidden flex flex-col justify-start pt-1 px-1",
                                  isDraggingThis
                                    ? "opacity-25 pointer-events-none"
                                    : "cursor-pointer hover:brightness-110",
                                  isSpringBack
                                    ? "transition-all duration-[420ms]"
                                    : "",
                                  isSelected
                                    ? "ring-2 ring-white ring-offset-1"
                                    : "",
                                  isCheckedForNotify
                                    ? "ring-2 ring-indigo-400 ring-offset-1 brightness-110"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={{
                                  left: `${seg.leftPct}%`,
                                  width: `${Math.max(seg.widthPct, 1.2)}%`,
                                  backgroundColor: "#fef3c7",
                                  border: "1px solid #fbbf24",
                                  minWidth: 4,
                                }}
                                onMouseDown={(e) =>
                                  !isDraggingActive &&
                                  handleBlockMouseDown(
                                    e,
                                    seg.trip,
                                    "unassigned",
                                  )
                                }
                                onMouseEnter={(e) => {
                                  if (!isDraggingActive)
                                    setTooltip({
                                      x: e.clientX,
                                      y: e.clientY,
                                      trip: seg.trip,
                                    });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                                onMouseMove={(e) => {
                                  if (!isDraggingActive)
                                    setTooltip((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            x: e.clientX,
                                            y: e.clientY,
                                          }
                                        : null,
                                    );
                                }}
                              >
                                {showDetail ? (
                                  <>
                                    <div className="text-[8px] font-bold whitespace-nowrap truncate leading-tight text-amber-900">
                                      {seg.trip.client_name || ""}
                                    </div>
                                    <div className="text-[7px] whitespace-nowrap truncate leading-tight text-amber-800">
                                      {timeLabel}
                                    </div>
                                    {(pickupCity || dropoffCity) && (
                                      <div className="text-[7px] font-medium whitespace-nowrap truncate leading-tight mt-0.5 text-amber-800">
                                        {pickupCity && (
                                          <div>PU: {pickupCity}</div>
                                        )}
                                        {dropoffCity && (
                                          <div>DO: {dropoffCity}</div>
                                        )}
                                        {seg.trip.vehicle_id ? (
                                          (seg.trip.vehicle_actual_category ||
                                            seg.trip.vehicle_name) && (
                                            <div>
                                              🚗{" "}
                                              {formatVehicleCategory(
                                                seg.trip
                                                  .vehicle_actual_category,
                                              ) || seg.trip.vehicle_name}
                                            </div>
                                          )
                                        ) : seg.trip.vehicle_category ? (
                                          <div>
                                            🚗 Pref:{" "}
                                            {formatVehicleCategory(
                                              seg.trip.vehicle_category,
                                            )}
                                          </div>
                                        ) : null}
                                        {seg.trip.is_new_passenger && (
                                          <div className="font-bold text-amber-900">
                                            NEW PASS
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-[10px] font-semibold whitespace-nowrap leading-none text-amber-800">
                                    {seg.label}
                                  </span>
                                )}
                                {seg.isMidnightCross && (
                                  <span className="absolute right-0.5 top-0.5 text-[8px] opacity-70 text-amber-800">
                                    ↵
                                  </span>
                                )}
                                {selectionMode && (
                                  <span className="absolute top-0.5 right-0.5 pointer-events-none">
                                    {isCheckedForNotify ? (
                                      <CheckSquare
                                        size={10}
                                        className="text-amber-900 drop-shadow"
                                      />
                                    ) : (
                                      <Square
                                        size={10}
                                        className="text-amber-800/60 drop-shadow"
                                      />
                                    )}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {uSegments.length === 0 && !uDropTarget && (
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[10px] text-amber-300">
                                no trips
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Driver rows — real drivers only (Unassigned is in the sticky header above) */}
                <div className="divide-y divide-gray-100">
                  {realDrivers.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                      <p className="font-medium">No active drivers found</p>
                      <p className="text-sm mt-1">
                        Add drivers to see them here
                      </p>
                    </div>
                  ) : (
                    realDrivers.map((driver) => {
                      const driverId = driver.id;
                      const isDropTargetRow =
                        isDraggingActive &&
                        dropTarget &&
                        String(dropTarget.driverId) === String(driverId);
                      const isValid = isDropTargetRow && dropTarget.isValid;
                      const hasConflict =
                        isDropTargetRow && dropTarget.hasConflict;
                      const isDimmed =
                        isDraggingActive &&
                        dropTarget &&
                        String(dropTarget.driverId) !== String(driverId);

                      const color = driverColorMap[driverId] || "#4a5568";
                      const driverTrips = trips.filter(
                        (t) => String(t.employee_id) === String(driverId),
                      );

                      // Assign lanes for overlapping trips
                      const { trips: lanedTrips, laneCount } =
                        assignLanes(driverTrips);
                      const rowHeight = Math.max(96, laneCount * 48);

                      // Build carryover segments for previous-day trips assigned to this driver
                      const driverCarryoverSegments = carryoverTrips
                        .filter(
                          (t) => String(t.employee_id) === String(driverId),
                        )
                        .map((t) => buildCarryoverSegment(t, color))
                        .filter(Boolean);

                      // NOTE: today's midnight-crossing trips do NOT get a carryover segment here.
                      // Their after-midnight portion (e.g. 12:15 AM) correctly appears on
                      // TOMORROW's timeline — fetched as carryoverTrips when viewing that date.

                      const segments = [
                        ...lanedTrips.flatMap((t) => {
                          const segs = buildTripSegments(t, color);
                          return segs.map((seg) => ({
                            ...seg,
                            lane: t._lane || 0,
                          }));
                        }),
                        ...driverCarryoverSegments,
                      ];

                      const driverBlockedSegments = (blockedTimesAll || [])
                        .filter(
                          (bt) => String(bt.employee_id) === String(driverId),
                        )
                        .map((bt) =>
                          buildBlockedSegmentForDate(bt, selectedDate),
                        )
                        .filter(Boolean);

                      const nameCellBg = isValid
                        ? hasConflict
                          ? "bg-yellow-50"
                          : "bg-green-50"
                        : "bg-white";

                      return (
                        <div
                          key={driverId}
                          ref={(el) => {
                            rowRefsMap.current[driverId] = el;
                          }}
                          className={[
                            "flex transition-colors duration-150",
                            isValid && !hasConflict ? "bg-green-50" : "",
                            hasConflict ? "bg-yellow-50" : "",
                            isDimmed ? "opacity-40" : "",
                            !isDraggingActive ? "hover:bg-gray-50" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {/* Driver name cell */}
                          <div
                            className={[
                              "sticky left-0 z-10 w-36 shrink-0 px-3 flex items-center gap-1.5 border-r border-gray-200",
                              nameCellBg,
                            ].join(" ")}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: driver.color || "#6B7280",
                              }}
                            />
                            <span className="text-xs font-semibold truncate text-gray-800">
                              {driver.name}
                            </span>
                          </div>

                          {/* Timeline lane */}
                          <div
                            className="flex-1 relative"
                            style={{ height: rowHeight }}
                          >
                            {timeSlots.map((slot) => (
                              <div
                                key={slot.hour}
                                className="absolute top-0 bottom-0 w-px bg-gray-100"
                                style={{ left: `${slot.leftPct}%` }}
                              />
                            ))}
                            {showNowLine && (
                              <div
                                className="absolute top-0 bottom-0 w-0.5 bg-red-400 opacity-60 pointer-events-none z-10"
                                style={{ left: `${nowPct}%` }}
                              />
                            )}
                            {isDropTargetRow &&
                              dropTarget.snapStartMin !== null &&
                              dragging && (
                                <div
                                  className={`absolute top-1.5 bottom-1.5 rounded border-2 pointer-events-none ${
                                    hasConflict
                                      ? "border-yellow-500 bg-yellow-100"
                                      : "border-green-500 bg-green-100"
                                  }`}
                                  style={{
                                    left: `${(dropTarget.snapStartMin / TOTAL_MINUTES) * 100}%`,
                                    width: `${Math.max(dragging.ghostWidthPct, 1)}%`,
                                    opacity: 0.75,
                                  }}
                                >
                                  <span
                                    className={`px-1 text-[9px] font-bold whitespace-nowrap truncate leading-none flex items-center h-full ${
                                      hasConflict
                                        ? "text-yellow-800"
                                        : "text-green-800"
                                    }`}
                                  >
                                    {formatTimeFromMinutes(
                                      dropTarget.snapStartMin,
                                    )}
                                    {hasConflict && (
                                      <AlertTriangle
                                        size={10}
                                        className="ml-1"
                                      />
                                    )}
                                  </span>
                                </div>
                              )}
                            {driverBlockedSegments.map((seg) => (
                              <div
                                key={`blocked-${seg.bt.id}`}
                                title={seg.label}
                                className="absolute top-0 bottom-0 z-[1] flex items-center overflow-visible"
                                style={{
                                  left: `${seg.leftPct}%`,
                                  width: `${Math.max(seg.widthPct, 0.5)}%`,
                                  background: seg.isAvailable
                                    ? "repeating-linear-gradient(135deg, rgba(34,197,94,0.22) 0px, rgba(34,197,94,0.22) 8px, rgba(34,197,94,0.06) 8px, rgba(34,197,94,0.06) 16px)"
                                    : "repeating-linear-gradient(135deg, rgba(239,68,68,0.22) 0px, rgba(239,68,68,0.22) 8px, rgba(239,68,68,0.06) 8px, rgba(239,68,68,0.06) 16px)",
                                  borderLeft: seg.isAvailable
                                    ? "4px solid rgba(22,163,74,0.85)"
                                    : "4px solid rgba(220,38,38,0.85)",
                                  borderRight: seg.isAvailable
                                    ? "1px solid rgba(22,163,74,0.3)"
                                    : "1px solid rgba(220,38,38,0.3)",
                                  borderTop: seg.isAvailable
                                    ? "1px solid rgba(22,163,74,0.2)"
                                    : "1px solid rgba(220,38,38,0.2)",
                                  borderBottom: seg.isAvailable
                                    ? "1px solid rgba(22,163,74,0.2)"
                                    : "1px solid rgba(220,38,38,0.2)",
                                }}
                              >
                                {seg.widthPct >= 0 && (
                                  <span
                                    className={`px-2 text-[10px] font-bold whitespace-normal break-words leading-tight select-none rounded ${seg.isAvailable ? "text-green-900" : "text-red-900"}`}
                                    title={seg.label}
                                    style={{
                                      background: "rgba(255,255,255,0.88)",
                                      marginLeft: 5,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      boxShadow: seg.isAvailable
                                        ? "0 0 0 1px rgba(22,163,74,0.15)"
                                        : "0 0 0 1px rgba(220,38,38,0.15)",
                                    }}
                                  >
                                    {seg.label}
                                  </span>
                                )}
                              </div>
                            ))}
                            {segments.map((seg, idx) => {
                              const isDraggingThis =
                                isDraggingActive &&
                                dragging &&
                                dragging.trip.id === seg.trip.id;
                              const isSpringBack = springBackIds.has(
                                seg.trip.id,
                              );
                              const isSelected =
                                selectedTrip && selectedTrip.id === seg.trip.id;
                              const isCheckedForNotify =
                                selectionMode &&
                                selectedTripIds.has(seg.trip.id);
                              const showDetail = seg.widthPct >= 5;
                              const timeLabel = formatTimeCDT(
                                seg.trip.start_time,
                              );
                              const pickupCity = formatLocation(
                                seg.trip,
                                "pickup",
                              );
                              const dropoffCity = formatLocation(
                                seg.trip,
                                "dropoff",
                              );

                              // Calculate vertical position based on lane
                              const laneHeight =
                                rowHeight / Math.max(laneCount, 1);
                              const topOffset = (seg.lane || 0) * laneHeight;

                              return (
                                <div
                                  key={`${seg.trip.id}-${idx}`}
                                  className={[
                                    "absolute rounded overflow-hidden flex flex-col justify-start pt-1 px-1",
                                    isDraggingThis
                                      ? "opacity-25 pointer-events-none"
                                      : "cursor-pointer hover:brightness-110",
                                    isSpringBack
                                      ? "transition-all duration-[420ms]"
                                      : "",
                                    isSelected
                                      ? "ring-2 ring-white ring-offset-1"
                                      : "",
                                    isCheckedForNotify
                                      ? "ring-2 ring-indigo-400 ring-offset-1 brightness-110"
                                      : "",
                                    seg.trip.is_tentative
                                      ? "ring-2 ring-yellow-400"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  style={{
                                    left: `${seg.leftPct}%`,
                                    width: `${Math.max(seg.widthPct, 1.2)}%`,
                                    top: `${topOffset + 6}px`,
                                    height: `${laneHeight - 12}px`,
                                    backgroundColor: seg.color,
                                    minWidth: 4,
                                  }}
                                  onMouseDown={(e) =>
                                    !isDraggingActive &&
                                    handleBlockMouseDown(e, seg.trip, driverId)
                                  }
                                  onMouseEnter={(e) => {
                                    if (!isDraggingActive)
                                      setTooltip({
                                        x: e.clientX,
                                        y: e.clientY,
                                        trip: seg.trip,
                                      });
                                  }}
                                  onMouseLeave={() => setTooltip(null)}
                                  onMouseMove={(e) => {
                                    if (!isDraggingActive)
                                      setTooltip((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              x: e.clientX,
                                              y: e.clientY,
                                            }
                                          : null,
                                      );
                                  }}
                                >
                                  {showDetail ? (
                                    <>
                                      <div className="text-[8px] font-bold whitespace-nowrap truncate leading-tight text-white">
                                        {seg.trip.client_name || ""}
                                      </div>
                                      <div className="text-[7px] whitespace-nowrap truncate leading-tight text-white/90">
                                        {timeLabel}
                                      </div>
                                      {(pickupCity || dropoffCity) && (
                                        <div className="text-[7px] font-medium whitespace-nowrap truncate leading-tight mt-0.5 text-white/80">
                                          {pickupCity && (
                                            <div>PU: {pickupCity}</div>
                                          )}
                                          {dropoffCity && (
                                            <div>DO: {dropoffCity}</div>
                                          )}
                                          {seg.trip.vehicle_id ? (
                                            (seg.trip.vehicle_actual_category ||
                                              seg.trip.vehicle_name) && (
                                              <div>
                                                🚗{" "}
                                                {formatVehicleCategory(
                                                  seg.trip
                                                    .vehicle_actual_category,
                                                ) || seg.trip.vehicle_name}
                                              </div>
                                            )
                                          ) : seg.trip.vehicle_category ? (
                                            <div>
                                              🚗 Pref:{" "}
                                              {formatVehicleCategory(
                                                seg.trip.vehicle_category,
                                              )}
                                            </div>
                                          ) : null}
                                          {seg.trip.is_new_passenger && (
                                            <div className="font-bold text-emerald-300">
                                              NEW PASS
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[10px] font-semibold whitespace-nowrap leading-none text-white">
                                      {seg.label}
                                    </span>
                                  )}
                                  {seg.isMidnightCross && (
                                    <span className="absolute right-0.5 top-0.5 text-[8px] opacity-70 text-white">
                                      ↵
                                    </span>
                                  )}
                                  {seg.trip.is_tentative && (
                                    <span className="absolute left-0.5 top-0.5 text-[8px] text-yellow-300">
                                      ⚠
                                    </span>
                                  )}
                                  {selectionMode && (
                                    <span className="absolute top-0.5 right-0.5 pointer-events-none">
                                      {isCheckedForNotify ? (
                                        <CheckSquare
                                          size={10}
                                          className="text-white drop-shadow"
                                        />
                                      ) : (
                                        <Square
                                          size={10}
                                          className="text-white/60 drop-shadow"
                                        />
                                      )}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {segments.length === 0 && !isDropTargetRow && (
                              <div className="absolute inset-0 flex items-center px-2">
                                <span className="text-[10px] text-gray-300">
                                  no trips
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center flex-wrap gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-blue-500 opacity-90" />
              <span>Assigned trip</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-amber-200 border border-amber-400" />
              <span>Unassigned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded ring-2 ring-yellow-400 bg-blue-500" />
              <span className="font-semibold">
                ⚠ Tentative (approved conflict)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-3"
                style={{
                  backgroundColor: "rgba(239,68,68,0.12)",
                  borderLeft: "2px solid rgba(239,68,68,0.5)",
                }}
              />
              <span>Blocked time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-red-400" />
              <span>Current time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>↵</span>
              <span>Crosses midnight</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded border-2 border-green-500 bg-green-100" />
              <span>Valid drop (no conflict)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded border-2 border-yellow-500 bg-yellow-100" />
              <span>Conflict — will prompt for approval</span>
            </div>
            <span className="text-gray-400">
              · Click block for details · Drag to change driver & time
            </span>
          </div>
        </div>
      </div>

      {/* Trip detail side panel */}
      {selectedTrip && (
        <div onClick={(e) => e.stopPropagation()}>
          <TripDetailPanel
            trip={selectedTrip}
            onClose={() => setSelectedTrip(null)}
            onNotify={handleNotifySingleTrip}
          />
        </div>
      )}

      {/* Conflict Approval Modal */}
      {conflictModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Schedule Conflict Detected
                </h3>
                <p className="text-sm text-gray-500">
                  This trip overlaps with another trip
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-2">
                <strong>{conflictModal.trip.client_name || "Trip"}</strong> will
                overlap with existing trips at the new time.
              </p>
              <p className="text-xs text-gray-600">
                New time:{" "}
                <strong>
                  {formatTimeFromMinutes(conflictModal.newStartMin)}
                </strong>
              </p>
            </div>

            {conflictModal.driverChanged ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  Reassigning to a different driver:
                </p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Trip will be moved to the new driver</li>
                  <li>
                    Time stays the same — the new driver will have overlapping
                    trips
                  </li>
                  <li>
                    Trip will <strong>not</strong> be marked as tentative
                  </li>
                </ul>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  If you approve this conflict:
                </p>
                <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                  <li>
                    Trip will be marked as <strong>tentative</strong>
                  </li>
                  <li>A yellow ⚠ indicator will appear on the timeline</li>
                  <li>Reason: &quot;Overlapping trip - pending review&quot;</li>
                </ul>
              </div>
            )}

            <p className="text-sm text-gray-600 mb-6">
              {conflictModal.driverChanged
                ? "Proceed with the reassignment anyway, or cancel to keep the original driver."
                : "You can approve this conflict and mark the trip as tentative for later review, or cancel to keep the original schedule."}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleConflictCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConflictApprove}
                className={`flex-1 px-4 py-2 ${conflictModal.driverChanged ? "bg-blue-600 hover:bg-blue-700" : "bg-yellow-500 hover:bg-yellow-600"} text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2`}
              >
                <AlertTriangle size={16} />
                {conflictModal.driverChanged
                  ? "Reassign Anyway"
                  : "Approve as Tentative"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {selectedTrip && (
        <div
          className="fixed inset-0 bg-black/20 z-40 pointer-events-auto"
          onClick={() => setSelectedTrip(null)}
        />
      )}

      {/* Selection mode banner */}
      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl flex items-center gap-3">
          <CheckSquare size={15} />
          {selectedTripIds.size === 0
            ? "Click trips to select them"
            : `${selectedTripIds.size} trip${selectedTripIds.size !== 1 ? "s" : ""} selected`}
          {selectedTripIds.size > 0 && (
            <button
              onClick={() => handleNotifyTrips([...selectedTripIds])}
              className="bg-white text-indigo-700 px-3 py-0.5 rounded-full text-xs font-bold hover:bg-indigo-50 transition-colors"
            >
              Notify
            </button>
          )}
          <button
            onClick={() => {
              setSelectionMode(false);
              setSelectedTripIds(new Set());
            }}
            className="opacity-70 hover:opacity-100 ml-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Notify Preview Modal */}
      {notifyPhase === "previewing" && (
        <NotifyPreviewModal
          preview={notifyPreview}
          isLoading={notifyPreviewLoading}
          onConfirm={handlePreviewConfirm}
          onCancel={handlePreviewCancel}
        />
      )}

      {/* Notify Progress Modal */}
      {(notifyPhase === "sending" || notifyPhase === "done") && (
        <NotifyProgressModal
          progress={notifyProgress}
          previewMap={previewMap}
          isDone={notifyPhase === "done"}
          countdown={notifyCountdown}
          onClose={handleProgressClose}
        />
      )}

      {/* Hover tooltip */}
      {tooltip && !isDraggingActive && !selectedTrip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-2xl px-3 py-2 pointer-events-none border border-gray-700"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -120%)",
            maxWidth: 280,
          }}
        >
          <p className="font-bold text-sm flex items-center gap-2">
            {tooltip.trip.client_name || "Unknown"}
            {tooltip.trip.is_new_passenger && (
              <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded">
                NEW PASS
              </span>
            )}
          </p>
          {tooltip.trip.booking_number && (
            <p className="text-gray-300">#{tooltip.trip.booking_number}</p>
          )}
          <div className="mt-1 border-t border-gray-700 pt-1 space-y-0.5">
            <p className="flex items-center gap-1">
              <Clock size={10} className="shrink-0" />
              {formatTimeCDT(tooltip.trip.start_time)}
            </p>
            {Number(tooltip.trip.duration_minutes) > 0 && (
              <p className="text-gray-300">
                {Number(tooltip.trip.duration_minutes)} min
              </p>
            )}
            {tooltip.trip.employee_name && (
              <p className="text-gray-300">
                Driver: {tooltip.trip.employee_name}
              </p>
            )}
            {formatVehicleCategory(tooltip.trip.vehicle_category) && (
              <p className="text-gray-300">
                Vehicle: {formatVehicleCategory(tooltip.trip.vehicle_category)}
              </p>
            )}
            {(tooltip.trip.num_people > 0 ||
              tooltip.trip.num_bags_checked > 0) && (
              <p className="text-gray-300">
                {tooltip.trip.num_people > 0 &&
                  `${tooltip.trip.num_people} passenger${tooltip.trip.num_people !== 1 ? "s" : ""}`}
                {tooltip.trip.num_people > 0 &&
                  tooltip.trip.num_bags_checked > 0 &&
                  " · "}
                {tooltip.trip.num_bags_checked > 0 &&
                  `${tooltip.trip.num_bags_checked} bag${tooltip.trip.num_bags_checked !== 1 ? "s" : ""}`}
              </p>
            )}
            {(formatLocation(tooltip.trip, "pickup") !== "—" ||
              formatLocation(tooltip.trip, "dropoff") !== "—") && (
              <div className="text-gray-300 text-[10px] mt-1 pt-1 border-t border-gray-700">
                <p>PU: {formatLocation(tooltip.trip, "pickup")}</p>
                <p>DO: {formatLocation(tooltip.trip, "dropoff")}</p>
                {tooltip.trip.vehicle_id ? (
                  (tooltip.trip.vehicle_actual_category ||
                    tooltip.trip.vehicle_name) && (
                    <p className="text-blue-300 mt-0.5">
                      🚗{" "}
                      {formatVehicleCategory(
                        tooltip.trip.vehicle_actual_category,
                      ) || tooltip.trip.vehicle_name}
                    </p>
                  )
                ) : tooltip.trip.vehicle_category ? (
                  <p className="text-amber-300 mt-0.5">
                    🚗 Pref:{" "}
                    {formatVehicleCategory(tooltip.trip.vehicle_category)}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-gray-400 italic">
            Click to open detail panel
          </p>
        </div>
      )}
    </div>
  );
}
