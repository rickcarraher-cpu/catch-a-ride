"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Users,
  User,
  Loader2,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";
import { toast } from "@/utils/notify";
import useUser from "@/utils/useUser";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLastSundayToSaturday() {
  const nowCDT = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago",
  });
  const now = new Date(nowCDT + "T12:00:00");
  const dayOfWeek = now.getDay();
  const lastSat = new Date(now);
  lastSat.setDate(now.getDate() - dayOfWeek - 1);
  const lastSun = new Date(lastSat);
  lastSun.setDate(lastSat.getDate() - 6);
  return {
    start: lastSun.toISOString().split("T")[0],
    end: lastSat.toISOString().split("T")[0],
  };
}

function formatWeekLabel(start, end) {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function shiftWeek(startDate, direction) {
  const d = new Date(startDate + "T12:00:00");
  d.setDate(d.getDate() + direction * 7);
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return {
    start: sun.toISOString().split("T")[0],
    end: sat.toISOString().split("T")[0],
  };
}

function fmtDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DriverEarningsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [employee, setEmployee] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(true);

  const defaults = getLastSundayToSaturday();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Approval state
  const [approvalDecision, setApprovalDecision] = useState(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [lastApprovalResult, setLastApprovalResult] = useState(null);
  const [isAdminImpersonation, setIsAdminImpersonation] = useState(false);

  // Check for admin impersonation
  useEffect(() => {
    if (typeof document !== "undefined") {
      setIsAdminImpersonation(
        document.cookie.includes("admin_impersonate_driver_id="),
      );
    }
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/driver/portal";
    }
  }, [user, userLoading]);

  // Load employee record
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await fetch("/api/driver/employee");
        if (!res.ok) throw new Error("Failed to fetch driver info");
        const data = await res.json();
        setEmployee(data.employee);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setEmployeeLoading(false);
      }
    };
    load();
  }, [user]);

  const fetchReport = async (driverId, start, end) => {
    if (!driverId || !start || !end) return;
    setLoading(true);
    setError(null);
    setReportData(null);
    setApprovalDecision(null);
    setApprovalReason("");
    setShowPrintPrompt(false);
    setShowThankYou(false);
    try {
      // Use /api/earnings which supports driver auth (cookie-based)
      const earningsRes = await fetch(
        `/api/earnings?employee_id=${driverId}&start=${start}&end=${end}`,
      );
      if (!earningsRes.ok)
        throw new Error(`Earnings fetch failed: ${earningsRes.status}`);
      const earningsData = await earningsRes.json();

      console.log("[Driver Earnings] Raw earnings API response:", earningsData);

      // Also fetch approval status from timesheets API (best-effort)
      let approval = null;
      try {
        const tsRes = await fetch(
          `/api/timesheets/approve?employeeId=${driverId}&startDate=${start}&endDate=${end}`,
        );
        if (tsRes.ok) {
          const tsData = await tsRes.json();
          approval = tsData.approval || null;
        }
      } catch (_) {
        // approval stays null — not critical
      }

      // Normalize earnings response into the shape the UI expects
      // earnings returns either a single driver report or wraps in drivers[]
      const driverReport = earningsData.drivers
        ? earningsData.drivers[0]
        : earningsData;

      console.log("[Driver Earnings] Driver report:", driverReport);
      console.log(
        "[Driver Earnings] Raw trips count:",
        driverReport?.trips?.length || 0,
      );

      const normalized = {
        summary: earningsData.summary || driverReport?.summary || {},
        drivers: [
          {
            // Map earnings fields → UI fields
            id: driverReport?.driver?.id ?? driverId,
            name: driverReport?.driver?.name ?? employee?.name ?? "",
            salaryRate:
              driverReport?.driver?.salary_rate ??
              employee?.salary_rate ??
              0.75,
            totalTrips: driverReport?.summary?.total_trips ?? 0,
            totalMiles: driverReport?.summary?.total_miles ?? 0,
            totalRevenue: driverReport?.summary?.total_revenue ?? 0,
            totalTips: driverReport?.summary?.total_tips ?? 0,
            totalCompensation: driverReport?.summary?.total_compensation ?? 0,
            totalCashCollected:
              driverReport?.summary?.total_cash_collected ?? 0,
            netPayroll: driverReport?.summary?.net_payroll ?? 0,
            trips: (driverReport?.trips ?? []).map((t) => {
              const mapped = {
                ...t,
                // Map earnings trip fields to what the UI expects
                date: t.date ?? t.start_time,
                clientName: t.clientName ?? t.client_name ?? "N/A",
                pickup: t.pickup ?? t.pickup_address ?? "N/A",
                dropoff: t.dropoff ?? t.dropoff_address ?? "N/A",
                miles: parseFloat(t.miles ?? t.distance_miles ?? 0),
                revenue: parseFloat(
                  t.revenue ?? t.services_total ?? t.trip_amount ?? 0,
                ),
                commission: parseFloat(
                  t.commission ?? t.driver_commission ?? 0,
                ),
                isCash:
                  t.isCash ??
                  (t.paymentMethod ?? t.payment_method ?? "")
                    .toLowerCase()
                    .includes("cash"),
                isPaid:
                  t.isPaid ??
                  t.paid ??
                  t.paymentStatus === "paid" ??
                  t.payment_status === "paid",
                driverPaid: t.driverPaid ?? t.driver_paid ?? false,
                cashCollected: parseFloat(
                  t.cashCollected ?? t.cash_amount ?? 0,
                ),
                tipsStored: parseFloat(
                  t.tipsStored ?? t.tips_total ?? t.tips ?? t.tip_amount ?? 0,
                ),
                paymentStatus: t.paymentStatus ?? t.payment_status ?? "",
                paymentMethod: t.paymentMethod ?? t.payment_method ?? "",
                bookingNumber: t.bookingNumber ?? t.booking_number ?? "",
              };
              return mapped;
            }),
            standalone_tips: driverReport?.standalone_tips ?? [],
            approval,
          },
        ],
      };

      console.log(
        "[Driver Earnings] Normalized trips count:",
        normalized.drivers[0].trips.length,
      );
      console.log(
        "[Driver Earnings] First 3 trips:",
        normalized.drivers[0].trips.slice(0, 3),
      );

      setReportData(normalized);

      // Pre-populate existing driver approval if available
      if (approval?.driver_status === "approved") {
        setApprovalDecision(true);
        setApprovalReason(approval.driver_reason || "");
      } else if (approval?.driver_status === "rejected") {
        setApprovalDecision(false);
        setApprovalReason(approval.driver_reason || "");
      }
    } catch (err) {
      console.error("[Driver Earnings] Fetch error:", err);
      setError("Failed to load timesheet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when employee is ready
  useEffect(() => {
    if (employee?.id) {
      fetchReport(employee.id, startDate, endDate);
    }
  }, [employee]);

  const handleWeekShift = (dir) => {
    const w = shiftWeek(startDate, dir);
    setStartDate(w.start);
    setEndDate(w.end);
    if (employee?.id) fetchReport(employee.id, w.start, w.end);
  };

  const handleThisWeek = () => {
    const w = getLastSundayToSaturday();
    setStartDate(w.start);
    setEndDate(w.end);
    if (employee?.id) fetchReport(employee.id, w.start, w.end);
  };

  const handleGenerate = () => {
    if (employee?.id) fetchReport(employee.id, startDate, endDate);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  const handleExitImpersonation = () => {
    if (typeof document !== "undefined") {
      document.cookie =
        "admin_impersonate_driver_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    window.location.href = "/admin/driver-portal";
  };

  const handleSubmitApproval = async () => {
    const driverObj = reportData?.drivers?.[0];
    if (!driverObj) return;

    if (approvalDecision === null) {
      toast.error("Please select Approve or Not Approved");
      return;
    }
    if (approvalDecision === false && !approvalReason.trim()) {
      toast.error("A reason is required when not approving");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          startDate,
          endDate,
          approved: approvalDecision,
          reason: approvalReason.trim() || null,
          role: "driver",
          tripIds: driverObj.trips.map((t) => t.id),
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Failed to submit");
      }
      setLastApprovalResult(approvalDecision);
      setShowPrintPrompt(true);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintAndContinue = (wantsPrint) => {
    setShowPrintPrompt(false);
    if (wantsPrint) handlePrint();
    setShowThankYou(true);
  };

  // ── Trip badge ──────────────────────────────────────────────────────────────

  const getTripBadge = (trip) => {
    if (trip.paymentStatus === "refunded")
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
          REFUNDED
        </span>
      );
    if (trip.paymentStatus === "partial_refund")
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
          PARTIAL REFUND
        </span>
      );
    if (trip.driverPaid)
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-300">
          <BadgeCheck size={10} />
          Driver Paid
        </span>
      );
    if (trip.isCash)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">
            💵 Cash
          </span>
          {trip.hasCashTip && (
            <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 w-fit">
              Tip by Cash
            </span>
          )}
        </div>
      );
    // Use isPaid from API (multi-signal: payment_status, balance_due, or txn)
    if (trip.isPaid || trip.paymentStatus === "paid") {
      // Strip internal-only labels from the displayed payment method
      const cleanMethod = (trip.paymentMethod || "")
        .split(",")
        .map((m) => m.trim())
        .filter(
          (m) =>
            m.toLowerCase() !== "commission" && m.toLowerCase() !== "cash tip",
        )
        .join(", ");

      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-300">
            <CheckCircle size={10} />
            PAID
          </span>
          {cleanMethod && (
            <span className="text-[9px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 w-fit">
              Paid by {cleanMethod}
            </span>
          )}
          {trip.hasCashTip && (
            <span className="text-[9px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 w-fit">
              Tip by Cash
            </span>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-300">
        ⚠ Past Due
      </span>
    );
  };

  const getTripRowBg = (trip) => {
    if (trip.paymentStatus === "refunded") return "bg-red-50";
    if (trip.paymentStatus === "partial_refund") return "bg-orange-50";
    if (trip.driverPaid) return "bg-green-50";
    // Use isPaid from API (multi-signal) instead of only checking paymentStatus
    if (!trip.isPaid && trip.paymentStatus !== "paid") return "bg-yellow-50";
    return "";
  };

  // ── Trip table ──────────────────────────────────────────────────────────────

  const renderTripTable = (driverObj) => {
    const tripsWithPay = driverObj.trips.map((trip) => {
      const effectiveRate = driverObj.salaryRate;
      // Use isPaid from API (multi-signal: payment_status, balance_due, or txn)
      const isPaidOrApproved =
        trip.isPaid ||
        trip.paymentStatus === "paid" ||
        trip.isApproved ||
        trip.driverPaid;
      // Use CACHED commission from the trip record (via API) instead of recalculating
      const driverShare = isPaidOrApproved
        ? parseFloat(
            (trip.commission || trip.revenue * effectiveRate).toFixed(2),
          )
        : 0;
      const companyRev = isPaidOrApproved
        ? parseFloat((trip.revenue - driverShare).toFixed(2))
        : 0;
      const tripTips = parseFloat(trip.tipsStored ?? trip.tips ?? 0);
      const cashCollected = trip.cashCollected || 0;
      const driverPay = isPaidOrApproved
        ? parseFloat((driverShare + tripTips - cashCollected).toFixed(2))
        : 0;
      return {
        ...trip,
        effectiveRate,
        driverShare,
        companyRev,
        cashCollected,
        driverPay,
        tripTips,
        isPaidOrApproved,
      };
    });

    const subtotalRevenue = tripsWithPay.reduce(
      (s, t) => s + (t.isPaidOrApproved ? t.revenue : 0),
      0,
    );
    const subtotalTips = tripsWithPay.reduce(
      (s, t) => s + (t.isPaidOrApproved ? t.tripTips : 0),
      0,
    );
    const subtotalDriverShare = tripsWithPay.reduce(
      (s, t) => s + t.driverShare,
      0,
    );
    const subtotalCompanyRev = tripsWithPay.reduce(
      (s, t) => s + t.companyRev,
      0,
    );
    const subtotalCash = tripsWithPay.reduce((s, t) => s + t.cashCollected, 0);
    const subtotalDriverPay = tripsWithPay.reduce((s, t) => s + t.driverPay, 0);

    // NEW: count unpaid and late-payment trips
    const unpaidTripsList = tripsWithPay.filter(
      (t) => t.isTrulyUnpaid && !t.is_late_payment,
    );
    const unpaidRevenue = unpaidTripsList.reduce((s, t) => s + t.revenue, 0);
    const latePaymentCount = tripsWithPay.filter(
      (t) => t.is_late_payment,
    ).length;

    return (
      <div className="overflow-x-auto mb-4">
        {/* NEW: late payment notice */}
        {latePaymentCount > 0 && (
          <div className="mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center gap-2 text-xs text-purple-800 no-print">
            <span className="font-bold text-purple-700">
              💜 Late Payments Included:
            </span>
            <span>
              {latePaymentCount} trip{latePaymentCount !== 1 ? "s" : ""} from a
              prior period that were paid during this period are included in
              this payroll.
            </span>
          </div>
        )}
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 px-2 py-2 text-left">
                Trip #
              </th>
              <th className="border border-gray-300 px-2 py-2 text-left">
                Date
              </th>
              <th className="border border-gray-300 px-2 py-2 text-left">
                Passenger
              </th>
              <th className="border border-gray-300 px-2 py-2 text-left">
                Pickup
              </th>
              <th className="border border-gray-300 px-2 py-2 text-left">
                Dropoff
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">
                Miles
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">
                Revenue
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">
                Tips
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">
                Comm %
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right bg-blue-50">
                Driver Share
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right bg-green-50">
                Company Rev
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right">
                Cash Paid
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right bg-yellow-50">
                Driver Pay
              </th>
            </tr>
          </thead>
          <tbody>
            {tripsWithPay.map((trip) => {
              const rowBg = getTripRowBg(trip);
              const badge = getTripBadge(trip);
              const isPastDue = trip.isPastDue;
              const isTrulyUnpaid = trip.isTrulyUnpaid;
              const isLatePayment = trip.is_late_payment;

              let paymentStatusBadge;
              if (isLatePayment) {
                paymentStatusBadge = (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                    💜 Late Pmt
                  </span>
                );
              } else if (
                trip.paymentStatus === "paid" ||
                (!isTrulyUnpaid && trip.compensation > 0)
              ) {
                paymentStatusBadge = (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">
                    ✓ Paid
                  </span>
                );
              } else if (isPastDue) {
                paymentStatusBadge = (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                    ⚠ Past Due
                  </span>
                );
              } else if (isTrulyUnpaid) {
                paymentStatusBadge = (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                    Unpaid
                  </span>
                );
              }
              const finalRowBg =
                isTrulyUnpaid && !isLatePayment ? "bg-orange-50/60" : rowBg;
              return (
                <tr key={trip.id} className={`hover:bg-gray-50 ${finalRowBg}`}>
                  <td className="border border-gray-300 px-2 py-1.5 font-mono text-gray-600">
                    {trip.bookingNumber || `#${trip.id}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap">
                    {fmtDate(trip.date)}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      {trip.clientName || "N/A"} {badge} {paymentStatusBadge}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    {trip.pickup || "N/A"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5">
                    {trip.dropoff || "N/A"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-mono text-gray-700">
                    {trip.isPaidOrApproved && trip.miles > 0
                      ? trip.miles.toFixed(1)
                      : "—"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">
                    {trip.isPaidOrApproved ? (
                      <span className="text-gray-800">
                        ${trip.revenue.toFixed(2)}
                      </span>
                    ) : (
                      <span
                        className="text-orange-600"
                        title="Not counted until passenger pays"
                      >
                        ${trip.revenue.toFixed(2)} ⚠
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-green-700">
                    {trip.tripTips > 0 ? `$${trip.tripTips.toFixed(2)}` : "—"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right text-gray-700">
                    {(trip.effectiveRate * 100).toFixed(0)}%
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-blue-700 bg-blue-50">
                    {trip.isPaidOrApproved ? (
                      `$${trip.driverShare.toFixed(2)}`
                    ) : (
                      <span className="text-orange-400 text-[10px]">
                        $0 (unpaid)
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold text-green-800 bg-green-50">
                    {trip.isPaidOrApproved
                      ? `$${trip.companyRev.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right font-semibold">
                    {trip.cashCollected > 0 ? (
                      <span className="text-orange-700">
                        ${trip.cashCollected.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-1.5 text-right font-bold bg-yellow-50 ${trip.driverPay < 0 ? "text-red-600" : "text-gray-900"}`}
                  >
                    {trip.isPaidOrApproved
                      ? `$${trip.driverPay.toFixed(2)}`
                      : "$0.00"}
                  </td>
                </tr>
              );
            })}

            {/* Subtotal */}
            <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
              <td
                colSpan="6"
                className="border border-gray-300 px-2 py-2 text-right"
              >
                Subtotal:
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right">
                ${subtotalRevenue.toFixed(2)}
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right text-green-700">
                {subtotalTips > 0 ? `$${subtotalTips.toFixed(2)}` : "—"}
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right text-gray-400">
                —
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right text-blue-700 bg-blue-100">
                ${subtotalDriverShare.toFixed(2)}
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right text-green-800 bg-green-100">
                ${subtotalCompanyRev.toFixed(2)}
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right text-orange-700">
                {subtotalCash > 0 ? `$${subtotalCash.toFixed(2)}` : "—"}
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right bg-yellow-100">
                ${subtotalDriverPay.toFixed(2)}
              </td>
            </tr>

            {/* NEW: Unpaid trips notice */}
            {unpaidTripsList.length > 0 && (
              <tr className="bg-orange-50 border border-orange-200">
                <td colSpan="13" className="px-3 py-2 text-xs">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="font-bold text-orange-700">
                      ⚠ {unpaidTripsList.length} Unpaid Trip
                      {unpaidTripsList.length !== 1 ? "s" : ""} — $
                      {unpaidRevenue.toFixed(2)} not yet received.
                    </span>
                    <span className="text-orange-600">
                      These show as $0.00 driver pay. Once the passenger pays,
                      they will appear in the next payroll as "Late Payments"
                      with your commission included.
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {/* Net Payroll */}
            <tr className="bg-green-100 font-bold border-t-2 border-green-600">
              <td
                colSpan="12"
                className="border border-gray-300 px-2 py-2 text-right"
              >
                Net Payroll
                <span className="font-normal text-gray-500 text-[10px] ml-2">
                  Driver Share + Tips − Cash Paid
                </span>
              </td>
              <td className="border border-gray-300 px-2 py-2 text-right bg-green-200 text-green-900 text-sm font-bold">
                ${subtotalDriverPay.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Standalone tips */}
        {driverObj.standalone_tips && driverObj.standalone_tips.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">
              Standalone Tips (not linked to a specific trip)
            </h4>
            {driverObj.standalone_tips.map((tip, idx) => (
              <div
                key={idx}
                className="flex justify-between text-sm text-blue-700 py-1 border-b border-blue-100 last:border-0"
              >
                <span>{tip.description || "Tip"}</span>
                <span className="font-semibold">
                  ${parseFloat(tip.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Approval section ────────────────────────────────────────────────────────

  const renderApprovalSection = (driverObj) => {
    const approval = driverObj.approval;
    const driverStatus = approval?.driver_status;
    const adminStatus = approval?.admin_status;
    const hasDriverSubmitted =
      driverStatus &&
      driverStatus !== "pending" &&
      !showPrintPrompt &&
      !showThankYou;

    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-5 mt-4 mb-4 no-print">
        <h4 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <CheckCircle size={20} className="text-blue-600" />
          Timesheet Approval
        </h4>
        <p className="text-sm text-gray-500 mb-4">
          Period: {formatWeekLabel(startDate, endDate)} · {driverObj.totalTrips}{" "}
          trips · Compensation: ${driverObj.totalCompensation.toFixed(2)}
        </p>

        {/* Status cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Driver status */}
          <div
            className={`rounded-lg p-3 border ${driverStatus === "approved" ? "bg-green-50 border-green-200" : driverStatus === "rejected" ? "bg-red-50 border-red-200" : "bg-gray-100 border-gray-200"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <User size={14} />
              <span className="text-sm font-semibold text-gray-700">
                Driver (You)
              </span>
              {driverStatus === "approved" && (
                <CheckCircle size={14} className="text-green-600" />
              )}
              {driverStatus === "rejected" && (
                <XCircle size={14} className="text-red-600" />
              )}
              {(!approval || driverStatus === "pending") && (
                <Clock size={14} className="text-gray-400" />
              )}
            </div>
            {driverStatus === "approved" && (
              <p className="text-sm text-green-700">
                Approved{" "}
                {approval.driver_responded_at
                  ? `on ${new Date(approval.driver_responded_at).toLocaleDateString()}`
                  : ""}
              </p>
            )}
            {driverStatus === "rejected" && (
              <>
                <p className="text-sm text-red-700">Not Approved</p>
                {approval.driver_reason && (
                  <p className="text-xs text-red-600 mt-1 italic">
                    "{approval.driver_reason}"
                  </p>
                )}
              </>
            )}
            {(!approval || driverStatus === "pending") && (
              <p className="text-sm text-gray-500">Pending</p>
            )}
          </div>

          {/* Admin status */}
          <div
            className={`rounded-lg p-3 border ${adminStatus === "approved" ? "bg-green-50 border-green-200" : adminStatus === "rejected" ? "bg-red-50 border-red-200" : "bg-gray-100 border-gray-200"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} />
              <span className="text-sm font-semibold text-gray-700">Admin</span>
              {adminStatus === "approved" && (
                <CheckCircle size={14} className="text-green-600" />
              )}
              {adminStatus === "rejected" && (
                <XCircle size={14} className="text-red-600" />
              )}
              {(!approval || adminStatus === "pending") && (
                <Clock size={14} className="text-gray-400" />
              )}
            </div>
            {adminStatus === "approved" && (
              <p className="text-sm text-green-700">
                Approved{" "}
                {approval.admin_responded_by
                  ? `by ${approval.admin_responded_by} `
                  : ""}
                {approval.admin_responded_at
                  ? `on ${new Date(approval.admin_responded_at).toLocaleDateString()}`
                  : ""}
              </p>
            )}
            {adminStatus === "rejected" && (
              <>
                <p className="text-sm text-red-700">
                  Not Approved{" "}
                  {approval.admin_responded_by
                    ? `by ${approval.admin_responded_by}`
                    : ""}
                </p>
                {approval.admin_reason && (
                  <p className="text-xs text-red-600 mt-1 italic">
                    "{approval.admin_reason}"
                  </p>
                )}
              </>
            )}
            {(!approval || adminStatus === "pending") && (
              <p className="text-sm text-gray-500">Pending</p>
            )}
          </div>
        </div>

        {/* Driver approval form */}
        <div className="border-t border-gray-200 pt-4">
          {hasDriverSubmitted ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                {driverStatus === "approved" ? (
                  <CheckCircle size={18} className="text-green-600" />
                ) : (
                  <XCircle size={18} className="text-red-600" />
                )}
                <span className="text-sm font-medium text-gray-700">
                  You{" "}
                  {driverStatus === "approved" ? "approved" : "did not approve"}{" "}
                  this timesheet
                  {approval?.driver_responded_at &&
                    ` on ${new Date(approval.driver_responded_at).toLocaleDateString()}`}
                </span>
              </div>
              <button
                onClick={() => {
                  setApprovalDecision(null);
                  setApprovalReason("");
                  setReportData((prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      drivers: prev.drivers.map((d) =>
                        d.id === driverObj.id
                          ? {
                              ...d,
                              approval: {
                                ...d.approval,
                                driver_status: "pending",
                              },
                            }
                          : d,
                      ),
                    };
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Change my answer
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Do you approve this timesheet?
              </p>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => setApprovalDecision(true)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${approvalDecision === true ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  <CheckCircle size={18} /> Approve
                </button>
                <button
                  onClick={() => setApprovalDecision(false)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${approvalDecision === false ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  <XCircle size={18} /> Not Approved
                </button>
              </div>
              {approvalDecision === false && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason (required):
                  </label>
                  <textarea
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    placeholder="Please explain why you are not approving this timesheet..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
                  />
                </div>
              )}
              <button
                onClick={handleSubmitApproval}
                disabled={submitting || approvalDecision === null}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {submitting ? "Submitting…" : "Submit Approval"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (userLoading || employeeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !reportData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p>{error}</p>
          </div>
          <a
            href="/driver/portal"
            className="mt-6 block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-white hover:bg-blue-700"
          >
            Back to Portal
          </a>
        </div>
      </div>
    );
  }

  const driverObj = reportData?.drivers?.[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm no-print">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <a
                  href="/driver/portal"
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Portal
                </a>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    My Timesheet
                  </h1>
                  {employee && (
                    <p className="text-sm text-gray-600">{employee.name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {reportData && (
                  <button
                    onClick={handlePrint}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    Print
                  </button>
                )}
                {isAdminImpersonation ? (
                  <button
                    onClick={handleExitImpersonation}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Exit Admin View
                  </button>
                ) : (
                  <button
                    onClick={() => (window.location.href = "/account/logout")}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Date controls */}
          <div className="bg-white rounded-lg shadow p-6 mb-6 no-print">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex items-end gap-2">
                <button
                  onClick={() => handleWeekShift(-1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="Previous week"
                >
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2"
                  />
                </div>
                <button
                  onClick={() => handleWeekShift(1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  title="Next week"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <button
                onClick={handleThisWeek}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 bg-blue-50 rounded-lg"
              >
                Last Complete Week
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? "Loading…" : "Generate Timesheet"}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Loading spinner */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={36} className="animate-spin text-blue-600" />
            </div>
          )}

          {/* Report */}
          {!loading && reportData && driverObj && (
            <div className="print-content">
              {/* Print header */}
              <div className="mb-6 print-header">
                <h1 className="text-2xl font-bold mb-1">
                  Driver Timesheet & Compensation
                </h1>
                <p className="text-gray-600">
                  {formatWeekLabel(startDate, endDate)}
                </p>
                <p className="text-gray-500 text-sm">{driverObj.name}</p>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 print-summary">
                <h2 className="text-xl font-bold mb-4">Period Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Trips</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {driverObj.totalTrips}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Miles</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {driverObj.totalMiles?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${driverObj.totalRevenue?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tips</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${driverObj.totalTips?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Your Compensation</p>
                    <p className="text-2xl font-bold text-blue-700">
                      ${driverObj.totalCompensation?.toFixed(2) ?? "0.00"}
                    </p>
                  </div>
                </div>
                {driverObj.totalCashCollected > 0 && (
                  <>
                    <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between">
                      <span className="text-sm font-semibold text-orange-800">
                        💵 Cash Collected (deducted from payroll)
                      </span>
                      <span className="text-lg font-bold text-orange-700">
                        -${driverObj.totalCashCollected?.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-base font-bold text-gray-900">
                        Net Payroll Due
                      </span>
                      <span className="text-xl font-bold text-green-700">
                        ${driverObj.netPayroll?.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Driver header */}
              <div className="bg-gray-100 border-l-4 border-gray-600 p-4 mb-4 page-break-avoid">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-bold">{driverObj.name}</h3>
                    {driverObj.salaryRate > 0 && (
                      <p className="text-sm text-gray-600">
                        Commission Rate:{" "}
                        <span className="font-bold text-blue-600">
                          {(driverObj.salaryRate * 100).toFixed(0)}%
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-4 md:gap-6 text-sm flex-wrap">
                    <div>
                      <span className="text-gray-600">Trips: </span>
                      <span className="font-bold">{driverObj.totalTrips}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Miles: </span>
                      <span className="font-bold">
                        {driverObj.totalMiles?.toFixed(1) ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Revenue: </span>
                      <span className="font-bold text-green-600">
                        ${driverObj.totalRevenue?.toFixed(2)}
                      </span>
                    </div>
                    {driverObj.totalTips > 0 && (
                      <div>
                        <span className="text-gray-600">Tips: </span>
                        <span className="font-bold text-green-600">
                          +${driverObj.totalTips?.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Compensation: </span>
                      <span className="font-bold text-blue-600">
                        ${driverObj.totalCompensation?.toFixed(2)}
                      </span>
                    </div>
                    {driverObj.totalCashCollected > 0 && (
                      <>
                        <div>
                          <span className="text-gray-600">
                            Cash Collected:{" "}
                          </span>
                          <span className="font-bold text-orange-600">
                            -${driverObj.totalCashCollected?.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Net Payroll: </span>
                          <span className="font-bold text-green-700">
                            ${driverObj.netPayroll?.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Trip table */}
              {driverObj.trips?.length > 0 ? (
                (() => {
                  try {
                    return renderTripTable(driverObj);
                  } catch (renderErr) {
                    console.error("Trip table render error:", renderErr);
                    return (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4 text-yellow-800 text-sm">
                        ⚠ Could not display trip details. Your timesheet data
                        loaded but may be in an unexpected format. Please try
                        refreshing.
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="text-center py-12 bg-white border border-gray-200 rounded-lg mb-4">
                  <p className="text-gray-500">
                    No trips found for this period.
                  </p>
                </div>
              )}

              {/* Approval section */}
              {renderApprovalSection(driverObj)}

              {/* Grand total bar */}
              <div className="bg-gray-800 text-white p-4 rounded-lg mt-4 mb-6">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h3 className="text-xl font-bold">Summary</h3>
                  <div className="flex gap-4 md:gap-6 flex-wrap text-sm">
                    <div>
                      <span>Trips: </span>
                      <span className="font-bold text-xl">
                        {reportData.summary?.totalTrips ?? driverObj.totalTrips}
                      </span>
                    </div>
                    <div>
                      <span>Miles: </span>
                      <span className="font-bold text-xl">
                        {(
                          reportData.summary?.totalMileage ??
                          driverObj.totalMiles
                        )?.toFixed(1) ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span>Revenue: </span>
                      <span className="font-bold text-xl">
                        $
                        {(
                          reportData.summary?.totalRevenue ??
                          driverObj.totalRevenue
                        )?.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span>Compensation: </span>
                      <span className="font-bold text-xl">
                        $
                        {(
                          reportData.summary?.totalCompensation ??
                          driverObj.totalCompensation
                        )?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-sm text-gray-500 mt-4 print-footer">
                <p>
                  Generated on{" "}
                  {new Date().toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* No data fallback — reportData loaded but no driver record found */}
          {!loading && reportData && !driverObj && (
            <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-500 text-lg">
                No timesheet data found for this period.
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Try selecting a different date range and clicking "Generate
                Timesheet".
              </p>
            </div>
          )}

          {!loading && !reportData && (
            <div className="text-center text-gray-500 py-12 no-print">
              <p className="text-lg">
                Select a date range and click "Generate Timesheet".
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Print Prompt Modal */}
      {showPrintPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Timesheet {lastApprovalResult ? "Approved" : "Not Approved"}
            </h2>
            <p className="text-gray-600 mb-8">
              Would you like to print this timesheet?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handlePrintAndContinue(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
              >
                No Thanks
              </button>
              <button
                onClick={() => handlePrintAndContinue(true)}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
              >
                Yes, Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thank You Modal */}
      {showThankYou && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-2xl p-10 max-w-md w-full mx-4 shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={52} className="text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Thank You!
            </h2>
            <p className="text-gray-600 mb-2 text-lg">
              Your response has been recorded and the company has been notified.
            </p>
            <p className="text-gray-500 mb-8">You may sign out now.</p>
            <button
              onClick={() => {
                if (isAdminImpersonation) {
                  handleExitImpersonation();
                } else {
                  window.location.href = "/account/logout";
                }
              }}
              className="w-full px-6 py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-colors"
            >
              {isAdminImpersonation ? "Exit Admin View" : "Sign Out"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .print-content { max-width: 100%; }
          .print-header { margin-bottom: 20px; }
          .print-summary {
            background: #e3f2fd !important;
            border: 2px solid #1976d2 !important;
            margin-bottom: 30px;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          .print-footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc; }
        }
      `}</style>
    </>
  );
}
