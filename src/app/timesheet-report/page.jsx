"use client";

import { useState, useMemo, lazy, Suspense, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Users,
  AlertCircle,
  Pencil,
  User,
  ChevronLeft,
  ChevronRight,
  Building2,
  Save,
  X,
  CheckCircle,
} from "lucide-react";
import { ADPSubmissionModal } from "@/components/ADPSubmissionModal";
import { TimesheetApprovalButtons } from "@/components/TimesheetApprovalButtons";
import { useTimesheetApproval } from "@/hooks/useTimesheetApproval";

// Lazy-load heavy modal component for code splitting (copied from earnings)
const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);

const CURRENT_YEAR = new Date().getFullYear();

function fmt(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function pct(n) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

// Copied from earnings page
function getYearBounds(year, monthIndex) {
  // monthIndex: null = full year, 0–11 = specific month
  if (monthIndex === null || monthIndex === undefined) {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: String(year),
    };
  }
  const ms = new Date(year, monthIndex, 1);
  const me = new Date(year, monthIndex + 1, 0);
  return {
    start: ms.toISOString().slice(0, 10),
    end: me.toISOString().slice(0, 10),
    label: ms.toLocaleDateString([], { month: "long", year: "numeric" }),
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Get last complete pay period (previous Sunday to that Saturday)
function getLastPayPeriod() {
  const nowCDT = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const now = new Date(nowCDT + "T12:00:00");
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const lastSat = new Date(now);
  lastSat.setDate(now.getDate() - dayOfWeek - 1);
  const lastSun = new Date(lastSat);
  lastSun.setDate(lastSat.getDate() - 6);
  return {
    start: lastSun.toISOString().split("T")[0],
    end: lastSat.toISOString().split("T")[0],
  };
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Copied and adapted from earnings page
function DriverSection({
  driver,
  onEditTrip,
  onRefreshData,
  onApprove,
  onReject,
  isApproving,
  driverPortalMode,
  customStart,
  customEnd,
}) {
  const driverInfo = driver.driver || {};
  const driverSummary = driver.summary || {};
  const trips = driver.trips || [];
  const hasTrips = trips.length > 0;
  const [open, setOpen] = useState(hasTrips);

  // Check if editing is allowed based on admin approval status
  const approval = driver.approval;
  const adminStatus = approval?.admin_status || "pending";
  const canEditRates = !driverPortalMode && adminStatus === "pending";

  // Use the API's pre-computed paid flag as the source of truth
  // The timesheets API already handles all edge cases (zero-charge trips, etc.)
  const paidTrips = trips.filter((t) => t.paid);
  const unpaidTrips = trips.filter((t) => !t.paid);

  // Inline commission rate editing state
  const [editingRates, setEditingRates] = useState({});
  const [editingDriverRate, setEditingDriverRate] = useState(false);
  const [tempDriverRate, setTempDriverRate] = useState("");
  const [localOverrides, setLocalOverrides] = useState({});
  const [savingRateTripId, setSavingRateTripId] = useState(null);
  const [savingDriverRate, setSavingDriverRate] = useState(false);

  const handleRateEdit = (tripId, currentRate) => {
    if (!canEditRates) {
      alert(
        "Cannot edit commission rates after payroll has been approved or rejected",
      );
      return;
    }
    setEditingRates((prev) => ({
      ...prev,
      [tripId]: String(Math.round((currentRate || 0) * 10000) / 100),
    }));
  };

  const handleRateSave = async (tripId, tripAmount) => {
    const rateStr = editingRates[tripId];
    const newRatePercent = parseFloat(rateStr);
    if (isNaN(newRatePercent) || newRatePercent < 0 || newRatePercent > 100) {
      alert("Please enter a valid percentage between 0 and 100");
      return;
    }
    const newRate = newRatePercent / 100;
    setSavingRateTripId(tripId);
    try {
      const response = await fetch("/api/timesheets/update-commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          employeeId: driverInfo.id,
          startDate: customStart,
          endDate: customEnd,
          newRate,
          type: "trip",
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update rate");
      }
      const data = await response.json();
      setLocalOverrides((prev) => ({
        ...prev,
        [tripId]: {
          commission_rate: newRate,
          commission: tripAmount * newRate,
        },
      }));
      setEditingRates((prev) => {
        const next = { ...prev };
        delete next[tripId];
        return next;
      });
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error("Failed to update commission rate:", err);
      alert(err.message);
    } finally {
      setSavingRateTripId(null);
    }
  };

  const handleDriverRateEdit = () => {
    if (!canEditRates) {
      alert(
        "Cannot edit commission rates after payroll has been approved or rejected",
      );
      return;
    }
    setEditingDriverRate(true);
    setTempDriverRate(String(Math.round((driverInfo.salary_rate || 0) * 100)));
  };

  const handleDriverRateSave = async () => {
    const ratePercent = parseFloat(tempDriverRate);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      alert("Please enter a valid percentage between 0 and 100");
      return;
    }
    setSavingDriverRate(true);
    try {
      const response = await fetch("/api/timesheets/update-commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: driverInfo.id,
          startDate: customStart,
          endDate: customEnd,
          newRate: ratePercent / 100,
          type: "driver",
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update");
      }
      setEditingDriverRate(false);
      setTempDriverRate("");
      if (onRefreshData) onRefreshData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingDriverRate(false);
    }
  };

  const handleRateCancel = (tripId) => {
    setEditingRates((prev) => {
      const next = { ...prev };
      delete next[tripId];
      return next;
    });
  };

  // Helper to get display rate/commission considering local overrides
  const getDisplayRate = (trip) => {
    const override = localOverrides[trip.id];
    return override ? override.commission_rate : trip.commission_rate;
  };
  const getDisplayCommission = (trip) => {
    const override = localOverrides[trip.id];
    return override ? override.commission : trip.commission;
  };

  // Helper to render rate cell with inline editing
  // Helper to render rate cell — hide edit pencil for drivers
  const renderRateCell = (trip) => {
    const isEditing = !driverPortalMode && editingRates.hasOwnProperty(trip.id);
    const displayRate = getDisplayRate(trip);
    const override = localOverrides[trip.id];
    const hasCustomRate =
      (trip.trip_commission_rate !== null &&
        trip.trip_commission_rate !== undefined) ||
      override;

    if (!driverPortalMode && isEditing) {
      const editVal = parseFloat(editingRates[trip.id]);
      const editValid = !isNaN(editVal) && editVal >= 0 && editVal <= 100;
      // Preview = commission_base × new_rate (gas excluded from commission)
      const previewComm = editValid
        ? (trip.commission_base || 0) * (editVal / 100)
        : null;
      return (
        <td className="px-6 py-3 text-right">
          <div className="flex items-center justify-end gap-1 no-print">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={editingRates[trip.id]}
              onChange={(e) =>
                setEditingRates((prev) => ({
                  ...prev,
                  [trip.id]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  handleRateSave(trip.id, trip.commission_base || 0);
                if (e.key === "Escape") handleRateCancel(trip.id);
              }}
              className="w-16 px-2 py-1 text-xs border border-blue-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-xs text-gray-500">%</span>
            <button
              onClick={() => handleRateSave(trip.id, trip.commission_base || 0)}
              disabled={savingRateTripId === trip.id}
              className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              title="Save"
            >
              <Save size={12} />
            </button>
            <button
              onClick={() => handleRateCancel(trip.id)}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
        </td>
      );
    }

    return (
      <td className="px-6 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <span
            className={
              "font-mono text-sm font-semibold " +
              (hasCustomRate ? "text-blue-700" : "text-gray-600")
            }
          >
            {pct(displayRate)}
          </span>
          {!driverPortalMode && (
            <button
              onClick={() => handleRateEdit(trip.id, displayRate)}
              className="no-print p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit commission rate"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
      </td>
    );
  };

  // Helper to render commission cell (shows preview when editing)
  const renderCommissionCell = (trip) => {
    const isEditing = editingRates.hasOwnProperty(trip.id);
    if (isEditing) {
      const editVal = parseFloat(editingRates[trip.id]);
      const editValid = !isNaN(editVal) && editVal >= 0 && editVal <= 100;
      // Preview commission = commission_base × new_rate (gas excluded)
      const previewComm = editValid
        ? (trip.commission_base || 0) * (editVal / 100)
        : null;
      if (previewComm !== null) {
        return (
          <td className="px-6 py-3 text-right font-mono text-blue-700 font-semibold">
            {fmt(previewComm)}
          </td>
        );
      }
    }
    return (
      <td className="px-6 py-3 text-right font-mono text-gray-900">
        {fmt(getDisplayCommission(trip))}
      </td>
    );
  };

  // Helper to get row highlight style
  const getRowStyle = (trip, isPaidSection) => {
    if (trip.is_late_payment) {
      return { backgroundColor: "#f3e8ff", borderLeft: "6px solid #9333ea" };
    }
    if (isPaidSection) {
      return { backgroundColor: "#dcfce7", borderLeft: "6px solid #16a34a" };
    }
    if (trip.is_past_due) {
      return { backgroundColor: "#fee2e2", borderLeft: "6px solid #dc2626" };
    }
    return { backgroundColor: "#ffedd5", borderLeft: "6px solid #ea580c" };
  };

  // Don't render drivers with 0 trips at all
  if (!hasTrips) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      {/* Driver Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: driverInfo.color || "#6b7280" }}
          />
          <h3 className="text-lg font-bold text-gray-900">
            {driverInfo.name || "Unknown"}
          </h3>
          <span className="text-sm text-gray-500">
            {driverSummary.total_trips || 0} trip
            {(driverSummary.total_trips || 0) !== 1 ? "s" : ""}
            {" · "}
            {driverSummary.paid_trips || 0} paid
          </span>
          {driverSummary.unpaid_trips > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
              {driverSummary.unpaid_trips} unpaid
            </span>
          )}

          {/* Driver default commission rate with inline edit */}
          {!driverPortalMode && (
            <div className="flex items-center gap-2 ml-2">
              {editingDriverRate ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Default:</span>
                  <input
                    type="number"
                    value={tempDriverRate}
                    onChange={(e) => setTempDriverRate(e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-blue-300 rounded text-right"
                    placeholder="75"
                    min="0"
                    max="100"
                    step="1"
                    disabled={savingDriverRate}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-600">%</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDriverRateSave();
                    }}
                    disabled={savingDriverRate}
                    className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                    title="Save"
                  >
                    <Save size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDriverRate(false);
                      setTempDriverRate("");
                    }}
                    disabled={savingDriverRate}
                    className="p-1 text-gray-600 hover:bg-gray-50 rounded disabled:opacity-50"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">
                    Default: {pct(driverInfo.salary_rate)}
                  </span>
                  {canEditRates && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDriverRateEdit();
                      }}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit default commission rate"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wide">
              Net Payroll
            </div>
            <div
              className={`text-lg font-bold ${driverSummary.net_payroll < 0 ? "text-red-600" : "text-gray-900"}`}
            >
              {fmt(driverSummary.net_payroll)}
            </div>
          </div>
          {open ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Lock warning if payroll approved/rejected */}
          {!canEditRates && !driverPortalMode && (
            <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 flex items-center gap-2">
              <AlertCircle
                size={14}
                className="text-orange-600 flex-shrink-0"
              />
              <p className="text-xs text-orange-800 font-medium">
                ⚠ Commission rates are locked (payroll {adminStatus}). Rates can
                only be edited when admin status is "pending".
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-6 gap-px bg-gray-100 p-px">
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Revenue</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {fmt(driverSummary.total_revenue)}
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Commission</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {fmt(driverSummary.driver_commission)}
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Tips</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {fmt(driverSummary.tips_total)}
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Total Comp</div>
              <div className="text-lg font-bold text-gray-900 mt-1">
                {fmt(driverSummary.total_compensation)}
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Cash Collected</div>
              <div className="text-lg font-bold text-red-600 mt-1">
                {fmt(driverSummary.cash_collected)}
              </div>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="text-xs text-gray-400">Net Payroll</div>
              <div
                className={`text-lg font-bold mt-1 ${driverSummary.net_payroll < 0 ? "text-red-600" : "text-gray-900"}`}
              >
                {fmt(driverSummary.net_payroll)}
              </div>
            </div>
          </div>

          {/* Trips Table - PAID */}
          {paidTrips.length > 0 && (
            <div>
              <div className="bg-green-50 px-6 py-2 border-b border-green-100">
                <h4 className="text-xs font-semibold text-green-900 uppercase tracking-wide">
                  Paid Trips ({paidTrips.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Trip date & time
                        </div>
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Client name
                        </div>
                        Passenger
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Dropoff location
                        </div>
                        Destination
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Base service price
                        </div>
                        Fare
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare + all addons incl. gas
                        </div>
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Driver's commission %
                        </div>
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare × Rate (gas excluded)
                        </div>
                        Commission
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Gas reimbursement at 100%
                        </div>
                        Gas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Customer gratuity
                        </div>
                        Tips
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Collected — deducted from payroll
                        </div>
                        Cash
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Commission + Gas + Tips − Cash
                        </div>
                        Net Pay
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Payment status
                        </div>
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50 no-print">
                        Edit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paidTrips.map((trip) => (
                      <tr key={trip.id} style={getRowStyle(trip, true)}>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="text-gray-900 font-medium">
                            {formatDate(trip.start_time)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatTime(trip.start_time)}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-gray-900">
                            {trip.client_name || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-gray-900 max-w-xs truncate">
                            {trip.destination || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {fmt(trip.fare)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {fmt(trip.revenue)}
                        </td>
                        {renderRateCell(trip)}
                        {renderCommissionCell(trip)}
                        <td className="px-6 py-3 text-right font-mono text-green-700">
                          {(trip.gas_addon || 0) > 0
                            ? fmt(trip.gas_addon)
                            : "—"}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-gray-900">
                          {fmt(trip.tips)}
                        </td>
                        <td className="px-6 py-3 text-right font-mono text-red-600">
                          {trip.cash_amount > 0 ? fmt(trip.cash_amount) : "—"}
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-semibold text-gray-900">
                          {fmt(
                            trip.total_compensation - (trip.cash_amount || 0),
                          )}
                        </td>
                        <td className="px-6 py-3 text-center">
                          {trip.payroll_processed ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-full border-2 border-green-400">
                                <CheckCircle size={12} /> PAID
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-300">
                                ✓ In Payroll
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-full border-2 border-green-400">
                                <CheckCircle size={12} /> PAID
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                                ⏳ Pending Payroll
                              </span>
                            </div>
                          )}
                        </td>
                        {/* Actions — Edit button hidden for drivers */}
                        <td className="px-6 py-3 text-center">
                          {!driverPortalMode && (
                            <button
                              onClick={() => onEditTrip(trip.id)}
                              className="no-print inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trips Table - UNPAID */}
          {unpaidTrips.length > 0 && (
            <div>
              <div className="bg-orange-50 px-6 py-2 border-b border-orange-100">
                <h4 className="text-xs font-semibold text-orange-900 uppercase tracking-wide">
                  Unpaid Trips ({unpaidTrips.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Trip date & time
                        </div>
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Client name
                        </div>
                        Passenger
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Dropoff location
                        </div>
                        Destination
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Base service price
                        </div>
                        Fare
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare + all addons incl. gas
                        </div>
                        Revenue
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Driver's commission %
                        </div>
                        Rate
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare × Rate (gas excluded)
                        </div>
                        Commission
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Gas reimbursement at 100%
                        </div>
                        Gas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Customer gratuity
                        </div>
                        Tips
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Collected — deducted from payroll
                        </div>
                        Cash
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Commission + Gas + Tips − Cash
                        </div>
                        Net Pay
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Payment status
                        </div>
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase bg-gray-50 no-print">
                        Edit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {unpaidTrips.map((trip) => {
                      const isPastDue = trip.is_past_due;
                      const statusBadge = isPastDue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-full border-2 border-red-400">
                          ⚠ OVERDUE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full border-2 border-orange-400">
                          UNPAID
                        </span>
                      );
                      return (
                        <tr key={trip.id} style={getRowStyle(trip, false)}>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <div className="text-gray-900 font-medium">
                              {formatDate(trip.start_time)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {formatTime(trip.start_time)}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="text-gray-900">
                              {trip.client_name || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="text-gray-900 max-w-xs truncate">
                              {trip.destination || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-gray-900">
                            {fmt(trip.fare)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-gray-900">
                            {fmt(trip.revenue)}
                          </td>
                          {renderRateCell(trip)}
                          {renderCommissionCell(trip)}
                          <td className="px-6 py-3 text-right font-mono text-green-700">
                            {(trip.gas_addon || 0) > 0
                              ? fmt(trip.gas_addon)
                              : "—"}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-gray-900">
                            {fmt(trip.tips)}
                          </td>
                          <td className="px-6 py-3 text-right font-mono text-red-600">
                            {trip.cash_amount > 0 ? fmt(trip.cash_amount) : "—"}
                          </td>
                          <td className="px-6 py-3 text-right font-mono font-semibold text-gray-900">
                            {fmt(
                              trip.total_compensation - (trip.cash_amount || 0),
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {statusBadge}
                              {trip.balance_due != null &&
                                Number(trip.balance_due) > 0 && (
                                  <span className="text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 whitespace-nowrap">
                                    Bal: {fmt(trip.balance_due)}
                                  </span>
                                )}
                              {trip.payment_method && (
                                <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 whitespace-nowrap">
                                  {trip.payment_method}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Actions — Edit button hidden for drivers */}
                          <td className="px-6 py-3 text-center">
                            {!driverPortalMode && (
                              <button
                                onClick={() => onEditTrip(trip.id)}
                                className="no-print inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Pencil size={12} /> Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Note: unpaid trips excluded from payroll */}
              <div className="bg-orange-50 border-t border-orange-200 px-6 py-3 flex items-center gap-2">
                <AlertCircle
                  size={14}
                  className="text-orange-600 flex-shrink-0"
                />
                <p className="text-xs text-orange-800 font-medium">
                  Unpaid trips are not included in this payroll. Once paid, they
                  will appear in the next payroll run.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timesheet Approval */}
      <div className="no-print mt-4 pt-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3 px-6 pb-4">
        <div className="text-sm font-semibold text-gray-700">
          Timesheet Approval
        </div>
        <TimesheetApprovalButtons
          driver={driver}
          onApprove={onApprove}
          onReject={onReject}
          isApproving={isApproving}
          isDriverMode={driverPortalMode}
        />
      </div>
    </div>
  );
}

export default function TimesheetReportPage() {
  const queryClient = useQueryClient();
  const [showADPModal, setShowADPModal] = useState(false);

  // ── Detect driver portal mode (driver_id in URL) ──
  const [driverPortalMode, setDriverPortalMode] = useState(false);

  // ── Last pay period (previous Sun–Sat) as default ──
  const lastPayPeriod = useMemo(() => getLastPayPeriod(), []);

  // ── Date Range State ──
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [customStart, setCustomStart] = useState(lastPayPeriod.start);
  const [customEnd, setCustomEnd] = useState(lastPayPeriod.end);

  // ── Single Driver State (copied from earnings) ──
  const [singleDriverId, setSingleDriverId] = useState(null);

  // Read driver_id from URL on mount and auto-lock to that driver
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const driverIdParam = params.get("driver_id");
      if (driverIdParam) {
        setSingleDriverId(Number(driverIdParam));
        setDriverPortalMode(true);
      }
    }
  }, []);

  // ── Trip Edit State (copied from earnings) ──
  const [editingTrip, setEditingTrip] = useState(null);

  // FIX: Fetch the full trip from the API by ID (not use the summary object)
  const handleEditTrip = async (tripId) => {
    try {
      const res = await fetch(`/api/appointments/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      const fullTrip = await res.json();
      setEditingTrip(fullTrip);
    } catch (err) {
      console.error("Failed to load trip for editing:", err);
      alert("Could not load trip details");
    }
  };

  const handleModalClose = () => {
    setEditingTrip(null);
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  };

  const handleModalSuccess = () => {
    setEditingTrip(null);
    queryClient.invalidateQueries({ queryKey: ["timesheets"] });
  };

  // ── Compute date range — locked to last pay period in driver portal mode ──
  const { start, end, periodLabel } = useMemo(() => {
    if (driverPortalMode) {
      const sLabel = new Date(
        lastPayPeriod.start + "T12:00:00",
      ).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const eLabel = new Date(
        lastPayPeriod.end + "T12:00:00",
      ).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return {
        start: lastPayPeriod.start,
        end: lastPayPeriod.end,
        label: `${sLabel} – ${eLabel}`,
      };
    }
    if (customStart && customEnd) {
      const sLabel = new Date(customStart + "T12:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );
      const eLabel = new Date(customEnd + "T12:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      );
      return {
        start: customStart,
        end: customEnd,
        label: `${sLabel} – ${eLabel}`,
      };
    }
    return getYearBounds(selectedYear, selectedMonth);
  }, [
    driverPortalMode,
    lastPayPeriod,
    selectedYear,
    selectedMonth,
    customStart,
    customEnd,
  ]);

  // ── Fetch data with optional employee_id ──
  const { data: report, isLoading } = useQuery({
    queryKey: ["timesheets", start, end, singleDriverId],
    queryFn: async () => {
      const params = new URLSearchParams({ start, end });
      if (singleDriverId) params.set("employee_id", singleDriverId);
      const res = await fetch(`/api/timesheets?${params}`);
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  // ── Fetch drivers list for single-driver dropdown ──
  const { data: allDrivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      const data = await res.json();
      return data.filter((d) => d.is_active);
    },
  });

  // ── Fetch clients & services for trip modal ──
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  // ── Year/Month navigation (copied from earnings) ──
  const handlePrevPeriod = () => {
    if (selectedMonth === null) {
      setSelectedYear((y) => y - 1);
    } else if (selectedMonth === 0) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextPeriod = () => {
    if (selectedMonth === null) {
      setSelectedYear((y) => y + 1);
    } else if (selectedMonth === 11) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const { handleApprove, handleReject, isApproving } = useTimesheetApproval({
    report,
    customStart: start,
    customEnd: end,
  });

  const driversWithTrips = useMemo(() => {
    if (!report?.drivers) return [];
    return report.drivers.filter((d) => (d.trips || []).length > 0);
  }, [report]);

  // Compute grand totals from drivers array (using correct field names from API)
  const grandTotals = useMemo(() => {
    if (!report?.drivers) return {};
    return report.drivers.reduce(
      (acc, d) => ({
        total_revenue:
          (acc.total_revenue || 0) + (d.summary?.total_revenue || 0),
        total_commission:
          (acc.total_commission || 0) + (d.summary?.driver_commission || 0),
        tips_total: (acc.tips_total || 0) + (d.summary?.tips_total || 0),
        total_compensation:
          (acc.total_compensation || 0) + (d.summary?.total_compensation || 0),
        cash_collected:
          (acc.cash_collected || 0) + (d.summary?.cash_collected || 0),
        net_payroll: (acc.net_payroll || 0) + (d.summary?.net_payroll || 0),
      }),
      {},
    );
  }, [report]);

  // Normalize report.summary field names (single-driver vs all-drivers API uses different keys)
  // Always prefer report.summary as source of truth; fall back to grandTotals for legacy safety
  const summaryData = useMemo(() => {
    if (!report?.summary && !grandTotals) return {};
    const s = report?.summary || {};
    return {
      total_revenue: s.total_revenue || grandTotals.total_revenue || 0,
      total_commission:
        s.total_commission ||
        s.driver_commission ||
        grandTotals.total_commission ||
        0,
      tips_total: s.tips_total || s.paid_tips || grandTotals.tips_total || 0,
      total_compensation:
        s.total_compensation || grandTotals.total_compensation || 0,
      cash_collected:
        s.total_cash_collected ||
        s.cash_collected ||
        grandTotals.cash_collected ||
        0,
      net_payroll: s.net_payroll || grandTotals.net_payroll || 0,
    };
  }, [report?.summary, grandTotals]);

  const isAllDrivers = !singleDriverId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {driverPortalMode ? (
              <a
                href="/driver/portal"
                className="no-print inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-colors"
              >
                <ArrowLeft size={16} />
                Driver Portal
              </a>
            ) : (
              <a
                href="/dashboard"
                className="no-print inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg border border-gray-200 transition-colors"
              >
                <ArrowLeft size={16} />
                Dashboard
              </a>
            )}
            <h1 className="text-3xl font-bold text-gray-900">
              {driverPortalMode ? "My Timesheet" : "Timesheet Report"}
            </h1>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
        </div>

        {/* Controls — full selectors for admin, simple label for driver */}
        {driverPortalMode ? (
          <div className="no-print bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 mb-6 flex items-center gap-3">
            <DollarSign size={18} className="text-blue-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">
                Current Pay Period
              </div>
              <div className="text-base font-bold text-blue-900">
                {periodLabel}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-print bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
            {/* Date Range Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPeriod}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Previous period"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  {Array.from(
                    { length: 10 },
                    (_, i) => CURRENT_YEAR - 5 + i,
                  ).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedMonth === null ? "" : selectedMonth}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedMonth(val === "" ? null : Number(val));
                    setCustomStart("");
                    setCustomEnd("");
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  <option value="">Full Year</option>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleNextPeriod}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Next period"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-600">or</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Start"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="End"
                />
              </div>
              <div className="text-sm text-gray-600 ml-4">
                Period: <span className="font-semibold">{periodLabel}</span>
              </div>
            </div>
            {/* Single Driver Toggle */}
            <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSingleDriverId(null)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!singleDriverId ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  <Users size={16} />
                  All Drivers
                </button>
                <button
                  onClick={() => {
                    if (allDrivers && allDrivers.length > 0)
                      setSingleDriverId(allDrivers[0].id);
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${singleDriverId ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  <User size={16} />
                  Single Driver
                </button>
              </div>
              {singleDriverId && allDrivers && (
                <select
                  value={singleDriverId}
                  onChange={(e) => setSingleDriverId(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium"
                >
                  {allDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {report?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <DollarSign size={16} className="text-blue-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">
                  Total Revenue
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(summaryData.total_revenue)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-green-50 rounded-lg">
                  <DollarSign size={16} className="text-green-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">
                  Total Commission
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(summaryData.total_commission)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-yellow-50 rounded-lg">
                  <DollarSign size={16} className="text-yellow-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">Tips</div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(summaryData.tips_total)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-indigo-50 rounded-lg">
                  <DollarSign size={16} className="text-indigo-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">
                  Total Comp
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">
                {fmt(summaryData.total_compensation)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-50 rounded-lg">
                  <DollarSign size={16} className="text-red-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">
                  Cash Collected
                </div>
              </div>
              <div className="text-xl font-bold text-red-600">
                {fmt(summaryData.cash_collected)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-50 rounded-lg">
                  <DollarSign size={16} className="text-purple-600" />
                </div>
                <div className="text-xs font-medium text-gray-500">
                  Net Payroll
                </div>
              </div>
              <div
                className={`text-xl font-bold ${summaryData.net_payroll < 0 ? "text-red-600" : "text-gray-900"}`}
              >
                {fmt(summaryData.net_payroll)}
              </div>
            </div>
          </div>
        )}

        {/* ADP Submit Button — hidden in driver portal mode */}
        {isAllDrivers && report && !driverPortalMode && (
          <div className="no-print mb-6 flex justify-end">
            <button
              onClick={() => setShowADPModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Building2 size={16} />
              Submit to ADP
            </button>
          </div>
        )}

        {/* Driver Sections */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div
              className="inline-block h-10 w-10 border-4 border-blue-600 border-r-transparent rounded-full"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <p className="mt-4 text-gray-500">Loading timesheet report...</p>
          </div>
        ) : driversWithTrips.length > 0 ? (
          driversWithTrips.map((driver, idx) => (
            <DriverSection
              key={driver.driver?.id || idx}
              driver={driver}
              onEditTrip={handleEditTrip}
              onRefreshData={() =>
                queryClient.invalidateQueries({ queryKey: ["timesheets"] })
              }
              onApprove={handleApprove}
              onReject={handleReject}
              isApproving={isApproving}
              driverPortalMode={driverPortalMode}
              customStart={customStart}
              customEnd={customEnd}
            />
          ))
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No trips found for this period.</p>
          </div>
        )}
      </div>

      {/* Trip Edit Modal */}
      {editingTrip && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <TripModal
            trip={editingTrip}
            clients={clients || []}
            drivers={allDrivers || []}
            services={services || []}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        </Suspense>
      )}

      {/* ADP Submission Modal */}
      {showADPModal && report && isAllDrivers && (
        <ADPSubmissionModal
          report={{
            drivers: driversWithTrips.map((d) => ({
              driver: {
                id: d.driver?.id || d.id,
                name: d.driver?.name || d.name,
                adp_worker_id: d.driver?.adp_worker_id,
              },
              summary: {
                total_trips: d.summary?.total_trips || 0,
                total_commission: d.summary?.driver_commission || 0,
                total_tips: d.summary?.tips_total || 0,
                total_cash_collected: d.summary?.cash_collected || 0,
                net_payroll: d.summary?.net_payroll || 0,
              },
            })),
            summary: report.summary,
          }}
          periodLabel={periodLabel}
          startDate={start}
          endDate={end}
          onClose={() => setShowADPModal(false)}
        />
      )}

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
