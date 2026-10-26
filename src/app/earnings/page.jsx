"use client";

import { useState, useMemo, useRef, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Printer,
  User,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  ArrowLeft,
  Pencil,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  XCircle,
  Building2,
  Save,
  X,
} from "lucide-react";
import { ADPSubmissionModal } from "@/components/ADPSubmissionModal";

const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);

const CURRENT_YEAR = new Date().getFullYear();

function fmt(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function getYearBounds(year, monthIndex) {
  if (monthIndex === null || monthIndex === undefined) {
    return {
      start: year + "-01-01",
      end: year + "-12-31",
      label: String(year),
    };
  }
  var ms = new Date(year, monthIndex, 1);
  var me = new Date(year, monthIndex + 1, 0);
  return {
    start: ms.toISOString().slice(0, 10),
    end: me.toISOString().slice(0, 10),
    label: ms.toLocaleDateString([], { month: "long", year: "numeric" }),
  };
}

function getLastSundayToSaturday() {
  var today = new Date();
  var dayOfWeek = today.getDay();
  var lastSaturday = new Date(today);
  if (dayOfWeek === 0) {
    lastSaturday.setDate(today.getDate() - 1);
  } else {
    lastSaturday.setDate(today.getDate() - dayOfWeek - 1);
  }
  var lastSunday = new Date(lastSaturday);
  lastSunday.setDate(lastSaturday.getDate() - 6);
  return {
    start: lastSunday.toISOString().slice(0, 10),
    end: lastSaturday.toISOString().slice(0, 10),
  };
}

var MONTHS = [
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

function StatCard({ label, value, sub }) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">
        {fmt(value)}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

/* ─── Trip Row ─────────────────────────────────────────────────────────────── */
function TripRow({
  trip,
  editingRates,
  setEditingRates,
  savingRateTripId,
  onSaveRate,
  localOverrides,
}) {
  // Use the API's pre-computed paid flag as the source of truth
  var isPaid = trip.paid;
  var isPastDue = trip.is_past_due;
  var isTrulyUnpaid = !isPaid;
  var isLatePayment = trip.is_late_payment;
  var isEditing = editingRates.hasOwnProperty(trip.id);

  var override = localOverrides[trip.id];
  var displayRate = override ? override.commission_rate : trip.commission_rate;
  var displayCommission = override ? override.commission : trip.commission;

  var editVal = isEditing ? parseFloat(editingRates[trip.id]) : null;
  var editValid =
    editVal !== null && !isNaN(editVal) && editVal >= 0 && editVal <= 100;
  // Preview commission includes gas addon at 100% (rate only applies to services_total)
  var previewComm = editValid
    ? trip.trip_amount * (editVal / 100) + (trip.gas_addon_amount || 0)
    : null;

  // Bold inline highlight
  var rowStyle = {};
  if (isLatePayment) {
    rowStyle = { backgroundColor: "#f3e8ff", borderLeft: "6px solid #9333ea" };
  } else if (isPaid) {
    rowStyle = { backgroundColor: "#dcfce7", borderLeft: "6px solid #16a34a" };
  } else if (isPastDue) {
    rowStyle = { backgroundColor: "#fee2e2", borderLeft: "6px solid #dc2626" };
  } else if (isTrulyUnpaid) {
    rowStyle = { backgroundColor: "#ffedd5", borderLeft: "6px solid #ea580c" };
  }

  // Status badge
  var badge = null;
  if (isLatePayment) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-full border-2 border-purple-400">
        💜 LATE
      </span>
    );
  } else if (isPaid) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-full border-2 border-green-400">
        <CheckCircle size={12} /> PAID
      </span>
    );
  } else if (isPastDue) {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-full border-2 border-red-400">
        ⚠ OVERDUE
      </span>
    );
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full border-2 border-orange-400">
        UNPAID
      </span>
    );
  }

  var cashAmt = trip.cash_amount || 0;
  var displayCommForTotal =
    previewComm !== null ? previewComm : displayCommission || 0;
  // If payment method is Cash but no cash transaction was explicitly recorded,
  // treat the full compensation as already collected in cash → Net Pay = $0
  if (cashAmt === 0 && trip.is_cash) {
    cashAmt = Number((displayCommForTotal + (trip.tip_amount || 0)).toFixed(2));
  }
  // Total = Commission + Tips - Cash (per formula)
  var totalComp = Number(
    (displayCommForTotal + (trip.tip_amount || 0) - cashAmt).toFixed(2),
  );

  var hasCustomRate =
    (trip.trip_commission_rate !== null &&
      trip.trip_commission_rate !== undefined) ||
    override;

  return (
    <tr style={rowStyle}>
      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
        {new Date(trip.start_time).toLocaleDateString([], {
          month: "short",
          day: "numeric",
        })}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {trip.client_name || "—"}
      </td>
      {/* Fare */}
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
        {fmt(trip.fare_amount)}
      </td>
      {/* Revenue = Fare + Addons */}
      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
        {fmt(trip.revenue || trip.trip_amount)}
      </td>
      {/* Rate (with inline edit) */}
      <td className="px-4 py-3 text-right">
        {isEditing ? (
          <div className="flex items-center justify-end gap-1 no-print">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={editingRates[trip.id]}
              onChange={function (e) {
                setEditingRates(function (prev) {
                  var next = Object.assign({}, prev);
                  next[trip.id] = e.target.value;
                  return next;
                });
              }}
              onKeyDown={function (e) {
                if (e.key === "Enter") onSaveRate(trip.id, trip.trip_amount);
                if (e.key === "Escape") {
                  setEditingRates(function (prev) {
                    var next = Object.assign({}, prev);
                    delete next[trip.id];
                    return next;
                  });
                }
              }}
              className="w-16 px-2 py-1 text-xs border border-blue-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-xs text-gray-500">%</span>
            <button
              onClick={function () {
                onSaveRate(trip.id, trip.trip_amount);
              }}
              disabled={savingRateTripId === trip.id}
              className="p-1 text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
              title="Save"
            >
              <Save size={12} />
            </button>
            <button
              onClick={function () {
                setEditingRates(function (prev) {
                  var next = Object.assign({}, prev);
                  delete next[trip.id];
                  return next;
                });
              }}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span
              className={
                "text-sm font-semibold " +
                (hasCustomRate ? "text-blue-700" : "text-gray-600")
              }
            >
              {Math.round((displayRate || 0) * 100)}%
            </span>
            <button
              onClick={function () {
                setEditingRates(function (prev) {
                  var next = Object.assign({}, prev);
                  next[trip.id] = String(
                    Math.round((displayRate || 0) * 10000) / 100,
                  );
                  return next;
                });
              }}
              className="no-print p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit commission rate"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
      </td>
      {/* Commission */}
      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
        {previewComm !== null ? (
          <span className="text-blue-700">{fmt(previewComm)}</span>
        ) : (
          fmt(displayCommission)
        )}
      </td>
      {/* Tips */}
      <td className="px-4 py-3 text-right text-sm text-green-700 font-semibold">
        {(trip.tip_amount || 0) > 0 ? fmt(trip.tip_amount) : "—"}
      </td>
      {/* Cash (collected — deducted from payroll) */}
      <td className="px-4 py-3 text-right text-sm text-red-600 font-semibold">
        {cashAmt > 0 ? fmt(cashAmt) : "—"}
      </td>
      {/* Total = Commission + Tips - Cash */}
      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
        {fmt(totalComp)}
      </td>
      {/* Status */}
      <td className="px-4 py-3 text-center">{badge}</td>
    </tr>
  );
}

/* ─── All Drivers Report ──────────────────────────────────────────────────── */
function AllDriversReport({ report, periodLabel, onOpenADPModal, onRefresh }) {
  var summary = report.summary;
  var drivers = report.drivers;
  var editState = useState({});
  var editingRates = editState[0];
  var setEditingRates = editState[1];
  var overrideState = useState({});
  var localOverrides = overrideState[0];
  var setLocalOverrides = overrideState[1];
  var savingState = useState(null);
  var savingRateTripId = savingState[0];
  var setSavingRateTripId = savingState[1];

  var handleRateSave = async function (tripId, tripAmount) {
    var rateStr = editingRates[tripId];
    var newRatePercent = parseFloat(rateStr);
    if (isNaN(newRatePercent) || newRatePercent < 0 || newRatePercent > 100)
      return;
    var newRate = newRatePercent / 100;
    setSavingRateTripId(tripId);
    try {
      var response = await fetch(
        "/api/appointments/" + tripId + "/commission-rate",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rate: newRate }),
        },
      );
      if (!response.ok) throw new Error("Failed to update rate");
      var data = await response.json();
      setLocalOverrides(function (prev) {
        var next = Object.assign({}, prev);
        next[tripId] = {
          commission_rate: newRate,
          commission:
            data.driver_commission != null
              ? data.driver_commission
              : tripAmount * newRate,
        };
        return next;
      });
      setEditingRates(function (prev) {
        var next = Object.assign({}, prev);
        delete next[tripId];
        return next;
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to update commission rate:", err);
      alert("Failed to update commission rate: " + err.message);
    } finally {
      setSavingRateTripId(null);
    }
  };

  return (
    <div id="print-area" className="space-y-12">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">All Drivers</h2>
            <div className="flex items-baseline gap-6 text-sm mt-2">
              <span className="text-gray-600">{periodLabel}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">
                {drivers.length} active drivers
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">
                {summary.paid_trips} paid trips
              </span>
            </div>
          </div>
          <button
            onClick={onOpenADPModal}
            className="no-print inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Building2 size={16} /> Submit to ADP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-8 gap-y-10">
        <StatCard
          label="Total Revenue"
          value={summary.total_revenue}
          sub="From all paid trips"
        />
        <StatCard
          label="Total Commission"
          value={summary.total_commission}
          sub="Driver earnings"
        />
        <StatCard
          label="Tips"
          value={summary.total_tips}
          sub="Customer gratuities"
        />
        <StatCard
          label="Total Compensation"
          value={summary.total_compensation}
          sub="Commission + Tips"
        />
        <StatCard
          label="Net Payroll"
          value={summary.net_payroll}
          sub="After cash deductions"
        />
      </div>

      <div className="space-y-6">
        {drivers.map(function (driver) {
          var trips = driver.trips || [];
          if (trips.length === 0) return null;
          return (
            <div
              key={driver.driver.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <div
                className="px-6 py-4 border-b border-gray-200 flex items-center gap-3"
                style={{
                  backgroundColor: driver.driver.color + "15",
                  borderLeft: "4px solid " + driver.driver.color,
                }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: driver.driver.color }}
                />
                <div>
                  <h3 className="font-bold text-gray-900">
                    {driver.driver.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {driver.summary.paid_trips} paid /{" "}
                    {driver.summary.unpaid_trips} unpaid ·{" "}
                    {Math.round(driver.driver.salary_rate * 100)}% default ·
                    Net: {fmt(driver.summary.net_payroll)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Trip date
                        </div>
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Client name
                        </div>
                        Passenger
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Base service price
                        </div>
                        Fare
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare + Addons
                        </div>
                        Revenue
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Driver's commission %
                        </div>
                        Rate
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Fare × Rate + Addons
                        </div>
                        Commission
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Customer gratuity
                        </div>
                        Tips
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Collected — deducted from payroll
                        </div>
                        Cash
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Commission + Tips − Cash
                        </div>
                        Total
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 uppercase">
                        <div className="text-[9px] font-normal text-gray-400 normal-case mb-0.5">
                          Payment status
                        </div>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map(function (trip) {
                      return (
                        <TripRow
                          key={trip.id}
                          trip={trip}
                          editingRates={editingRates}
                          setEditingRates={setEditingRates}
                          savingRateTripId={savingRateTripId}
                          onSaveRate={handleRateSave}
                          localOverrides={localOverrides}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Timesheet Approval Panel ────────────────────────────────────────────── */
function TimesheetApprovalPanel({ start, end }) {
  var expandedState = useState(new Set());
  var expandedDrivers = expandedState[0];
  var setExpandedDrivers = expandedState[1];
  var submittingState = useState({});
  var submitting = submittingState[0];
  var setSubmitting = submittingState[1];

  var queryResult = useQuery({
    queryKey: ["timesheets", start, end],
    queryFn: async function () {
      var res = await fetch(
        "/api/timesheets?startDate=" + start + "&endDate=" + end,
      );
      if (!res.ok) throw new Error("Failed to load timesheets");
      return res.json();
    },
  });

  var timesheets = queryResult.data;
  var isLoading = queryResult.isLoading;

  if (
    isLoading ||
    !timesheets ||
    !timesheets.drivers ||
    timesheets.drivers.length === 0
  )
    return null;

  var toggleDriver = function (driverId) {
    setExpandedDrivers(function (prev) {
      var next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  var handleApproval = async function (driverId, approved, reason) {
    var driver = timesheets.drivers.find(function (d) {
      return d.driver.id === driverId;
    });
    if (!driver) return;
    setSubmitting(function (prev) {
      return Object.assign({}, prev, { [driverId]: true });
    });
    try {
      var res = await fetch("/api/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: driverId,
          startDate: start,
          endDate: end,
          approved: approved,
          reason: reason || null,
          role: "admin",
          tripIds: driver.trips.map(function (t) {
            return t.id;
          }),
        }),
      });
      if (!res.ok) throw new Error("Failed to submit approval");
      if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      alert("Failed to submit approval: " + err.message);
    } finally {
      setSubmitting(function (prev) {
        return Object.assign({}, prev, { [driverId]: false });
      });
    }
  };

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-4 no-print">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={20} className="text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">Timesheet Approvals</h3>
      </div>
      <div className="space-y-3">
        {timesheets.drivers.map(function (driver) {
          var isExpanded = expandedDrivers.has(driver.driver.id);
          var approval = driver.approval;
          var driverStatus = (approval && approval.driver_status) || "pending";
          var adminStatus = (approval && approval.admin_status) || "pending";

          var driverStatusColor =
            driverStatus === "approved"
              ? "bg-green-100 text-green-700"
              : driverStatus === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600";
          var adminStatusColor =
            adminStatus === "approved"
              ? "bg-green-100 text-green-700"
              : adminStatus === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600";

          return (
            <div
              key={driver.driver.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={function () {
                  toggleDriver(driver.driver.id);
                }}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: driver.driver.color }}
                  />
                  <span className="font-semibold text-gray-900">
                    {driver.driver.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {driver.summary.total_trips} trips ·{" "}
                    {fmt(driver.summary.total_compensation)}
                  </span>
                  {driverStatus === "approved" && (
                    <CheckCircle size={14} className="text-green-600" />
                  )}
                  {adminStatus === "approved" && (
                    <CheckCircle size={14} className="text-blue-600" />
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp size={18} className="text-gray-400" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400" />
                )}
              </button>
              {isExpanded && (
                <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Driver Status
                      </div>
                      <div
                        className={
                          "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold " +
                          driverStatusColor
                        }
                      >
                        {driverStatus === "approved" && (
                          <CheckCircle size={12} />
                        )}
                        {driverStatus === "rejected" && <XCircle size={12} />}
                        {driverStatus}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Admin Status
                      </div>
                      <div
                        className={
                          "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold " +
                          adminStatusColor
                        }
                      >
                        {adminStatus === "approved" && (
                          <CheckCircle size={12} />
                        )}
                        {adminStatus === "rejected" && <XCircle size={12} />}
                        {adminStatus}
                      </div>
                    </div>
                  </div>
                  {adminStatus === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={function () {
                          handleApproval(driver.driver.id, true, "");
                        }}
                        disabled={submitting[driver.driver.id]}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={function () {
                          var reason = prompt(
                            "Reason for not approving (required):",
                          );
                          if (reason)
                            handleApproval(driver.driver.id, false, reason);
                        }}
                        disabled={submitting[driver.driver.id]}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XCircle size={16} /> Not Approved
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
function EarningsPage() {
  var queryClient = useQueryClient();
  var lastWeek = useMemo(function () {
    return getLastSundayToSaturday();
  }, []);

  var driverIdState = useState("all");
  var selectedDriverId = driverIdState[0];
  var setSelectedDriverId = driverIdState[1];

  var dateModeState = useState("custom");
  var dateMode = dateModeState[0];
  var setDateMode = dateModeState[1];

  var yearState = useState(CURRENT_YEAR);
  var year = yearState[0];
  var setYear = yearState[1];

  var monthState = useState(null);
  var monthIndex = monthState[0];
  var setMonthIndex = monthState[1];

  var startState = useState(lastWeek.start);
  var customStartDate = startState[0];
  var setCustomStartDate = startState[1];

  var endState = useState(lastWeek.end);
  var customEndDate = endState[0];
  var setCustomEndDate = endState[1];

  var tripState = useState(null);
  var editingTrip = tripState[0];
  var setEditingTrip = tripState[1];

  var modalState = useState(false);
  var isModalOpen = modalState[0];
  var setIsModalOpen = modalState[1];

  var adpState = useState(false);
  var showADPModal = adpState[0];
  var setShowADPModal = adpState[1];

  var handleModalClose = function () {
    setIsModalOpen(false);
    setEditingTrip(null);
  };
  var handleModalSuccess = function () {
    setIsModalOpen(false);
    setEditingTrip(null);
    queryClient.invalidateQueries({ queryKey: ["earnings"] });
  };

  var computed = useMemo(
    function () {
      if (dateMode === "custom" && customStartDate && customEndDate) {
        var sLabel = new Date(customStartDate + "T12:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" },
        );
        var eLabel = new Date(customEndDate + "T12:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric", year: "numeric" },
        );
        return {
          start: customStartDate,
          end: customEndDate,
          label: sLabel + " – " + eLabel,
        };
      }
      return getYearBounds(year, monthIndex);
    },
    [dateMode, year, monthIndex, customStartDate, customEndDate],
  );

  var start = computed.start;
  var end = computed.end;
  var periodLabel = computed.label;

  var driversQuery = useQuery({
    queryKey: ["drivers-list"],
    queryFn: function () {
      return fetch("/api/employees").then(function (r) {
        return r.json();
      });
    },
  });
  var drivers = driversQuery.data || [];

  var clientsQuery = useQuery({
    queryKey: ["clients-list"],
    queryFn: function () {
      return fetch("/api/clients").then(function (r) {
        return r.json();
      });
    },
  });
  var clients = clientsQuery.data || [];

  var servicesQuery = useQuery({
    queryKey: ["services-list"],
    queryFn: function () {
      return fetch("/api/services").then(function (r) {
        return r.json();
      });
    },
  });
  var services = servicesQuery.data || [];

  var earningsQuery = useQuery({
    queryKey: ["earnings", selectedDriverId, start, end],
    enabled: !!selectedDriverId && !!start && !!end,
    queryFn: async function () {
      var res = await fetch(
        "/api/earnings?employee_id=" +
          selectedDriverId +
          "&start=" +
          start +
          "&end=" +
          end,
      );
      if (!res.ok) throw new Error("Failed to load earnings");
      return res.json();
    },
  });

  var report = earningsQuery.data;
  var isLoading = earningsQuery.isLoading;
  var error = earningsQuery.error;

  var handleRefresh = function () {
    queryClient.invalidateQueries({ queryKey: ["earnings"] });
  };

  var handlePrint = function () {
    if (typeof window !== "undefined") window.print();
  };

  var isAllDrivers = selectedDriverId === "all";

  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-12">
        {/* Header */}
        <div className="no-print space-y-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </a>
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                Driver Earnings
              </h1>
              <p className="text-gray-500">1099-style compensation summary</p>
            </div>
            {report && (
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Printer size={16} /> Print
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="no-print space-y-8">
          <div className="space-y-3">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Driver
            </label>
            <select
              value={selectedDriverId}
              onChange={function (e) {
                setSelectedDriverId(e.target.value);
              }}
              className="w-full md:w-96 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            >
              <option value="">Select driver...</option>
              <option value="all">All Drivers</option>
              {drivers.map(function (d) {
                return (
                  <option key={d.id} value={d.id}>
                    {d.name} · {Math.round(d.salary_rate * 100)}%
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={function () {
                  setDateMode("yearMonth");
                }}
                className={
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                  (dateMode === "yearMonth"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900")
                }
              >
                Year / Month
              </button>
              <button
                onClick={function () {
                  setDateMode("custom");
                }}
                className={
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                  (dateMode === "custom"
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900")
                }
              >
                Custom Range
              </button>
            </div>

            {dateMode === "yearMonth" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={function () {
                      setYear(function (y) {
                        return y - 1;
                      });
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-lg font-bold text-gray-900 w-16 text-center">
                    {year}
                  </span>
                  <button
                    onClick={function () {
                      setYear(function (y) {
                        return Math.min(y + 1, CURRENT_YEAR);
                      });
                    }}
                    disabled={year >= CURRENT_YEAR}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={function () {
                      setMonthIndex(null);
                    }}
                    className={
                      "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                      (monthIndex === null
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100")
                    }
                  >
                    Full Year
                  </button>
                  {MONTHS.map(function (m, i) {
                    return (
                      <button
                        key={m}
                        onClick={function () {
                          setMonthIndex(i === monthIndex ? null : i);
                        }}
                        className={
                          "px-4 py-2 text-sm font-medium rounded-lg transition-colors " +
                          (monthIndex === i
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100")
                        }
                      >
                        {m.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {dateMode === "custom" && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Start
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={function (e) {
                      setCustomStartDate(e.target.value);
                    }}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    End
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={function (e) {
                      setCustomEndDate(e.target.value);
                    }}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Approval panel */}
        {start && end && <TimesheetApprovalPanel start={start} end={end} />}

        {/* Empty */}
        {!selectedDriverId && (
          <div className="py-32 flex flex-col items-center gap-4 text-gray-300">
            <User size={48} strokeWidth={1.5} />
            <p className="text-sm">Select a driver to view earnings</p>
          </div>
        )}

        {/* Loading */}
        {selectedDriverId && isLoading && (
          <div className="py-32 flex items-center justify-center text-gray-400">
            Loading...
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 py-4 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            Failed to load report
          </div>
        )}

        {/* Report */}
        {report && !isLoading && isAllDrivers && (
          <AllDriversReport
            report={report}
            periodLabel={periodLabel}
            onOpenADPModal={function () {
              setShowADPModal(true);
            }}
            onRefresh={handleRefresh}
          />
        )}
        {report && !isLoading && !isAllDrivers && (
          <AllDriversReport
            report={{ summary: report.summary, drivers: [report] }}
            periodLabel={periodLabel}
            onOpenADPModal={function () {
              setShowADPModal(true);
            }}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* Trip Edit Modal */}
      {isModalOpen && editingTrip && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="inline-block h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <TripModal
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={handleModalClose}
            onSuccess={handleModalSuccess}
          />
        </Suspense>
      )}

      {/* ADP Modal */}
      {showADPModal && report && isAllDrivers && (
        <ADPSubmissionModal
          report={report}
          periodLabel={periodLabel}
          startDate={start}
          endDate={end}
          onClose={function () {
            setShowADPModal(false);
          }}
        />
      )}

      <style>
        {
          "\n@media print {\n  body * { visibility: hidden; }\n  #print-area, #print-area * { visibility: visible; }\n  #print-area { position: fixed; top: 0; left: 0; width: 100%; }\n  .no-print { display: none !important; }\n}\n"
        }
      </style>
    </>
  );
}

export default EarningsPage;
