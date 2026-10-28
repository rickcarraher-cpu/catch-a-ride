"use client";

import React, {
  useEffect,
  useState,
  useMemo,
  lazy,
  Suspense,
  useRef,
} from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TripsTable } from "@/components/Trips/TripsTable";
import { DeleteTripModal } from "@/components/Trips/DeleteTripModal";
import { useTrips } from "@/hooks/useTrips";
import { getTodayInCDT } from "@/utils/timezone";
import { toast } from "@/utils/notify";
import useUser from "@/utils/useUser";
import { BUILD_INFO } from "@/build-info";
import BackupOnCloseModal from "@/components/BackupOnCloseModal";
import { useDataExport, useDataImport } from "@/hooks/useDataImportExport";
import {
  Calendar,
  CreditCard,
  Moon,
  UserPlus,
  MessageSquare,
  LogOut,
  ClipboardCheck,
  AlertTriangle,
  Receipt,
  BarChart2,
  Users,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CalendarClock,
  List,
} from "lucide-react";

const TourAgentDashboardBox = lazy(
  () => import("@/components/TourAgentDashboardBox"),
);

const TripModal = lazy(() =>
  import("@/components/Trips/TripModal/TripModal").then((m) => ({
    default: m.TripModal,
  })),
);
const InvoiceModal = lazy(() =>
  import("@/components/Trips/InvoiceModal").then((m) => ({
    default: m.InvoiceModal,
  })),
);
const UnifiedPaymentModal = lazy(() =>
  import("@/components/UnifiedPaymentModal").then((m) => ({
    default: m.UnifiedPaymentModal,
  })),
);

export default function Dashboard() {
  const { data: user, loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  // Close Up modal state
  const [showCloseUpModal, setShowCloseUpModal] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);

  const [employee, setEmployee] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("dashboard_employee");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < 15 * 60 * 1000) {
            return parsed.employee;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem("dashboard_employee");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.ts < 15 * 60 * 1000) {
            return false;
          }
        }
      } catch (e) {}
    }
    return false;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [deletingTrip, setDeletingTrip] = useState(null);
  const [invoiceTripId, setInvoiceTripId] = useState(null);
  const [paymentTripId, setPaymentTripId] = useState(null);
  const [sendingThankYou, setSendingThankYou] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false); // NEW: receipt modal

  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    staleTime: 0,
  });

  const todayStr = getTodayInCDT();
  const { data: todayBlockedTimes } = useQuery({
    queryKey: ["blockedTimes", todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/blocked-times?date=${todayStr}`);
      if (!res.ok) throw new Error("Failed to fetch blocked times");
      return res.json();
    },
    staleTime: 0,
  });

  // Receipt report — trips needing a receipt today
  const { data: receiptData } = useQuery({
    queryKey: ["needs-receipt-today", todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/reports/needs-receipt?date=${todayStr}`);
      if (!res.ok) throw new Error("Failed to fetch receipt report");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const receiptTrips = receiptData?.trips || [];

  const redirectDone = React.useRef(false);

  useEffect(() => {
    if (redirectDone.current) return;

    if (employee && employee.is_admin === false) {
      redirectDone.current = true;
      window.location.href = "/driver/earnings";
      return;
    }

    const fetchEmployee = async () => {
      try {
        const res = await fetch("/api/driver/employee");
        if (!res.ok) {
          if (res.status === 401) {
            redirectDone.current = true;
            sessionStorage.removeItem("dashboard_employee");
            window.location.href = "/driver/portal";
            return;
          }
          setLoading(false);
          return;
        }
        const data = await res.json();
        const emp = data.employee;

        try {
          sessionStorage.setItem(
            "dashboard_employee",
            JSON.stringify({ employee: emp, ts: Date.now() }),
          );
        } catch (e) {}

        if (emp && !emp.is_admin) {
          redirectDone.current = true;
          window.location.href = "/driver/earnings";
          return;
        }

        setEmployee(emp);
        setLoading(false);
      } catch (err) {
        console.error("Authentication check failed:", err);
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employee]);

  const {
    trips: allTrips,
    isLoading: tripsLoading,
    tripsError,
    clients,
    drivers: tripsDrivers,
    services,
    transactions,
    deleteMutation,
    fetchTrip,
  } = useTrips({
    fetchTrips: true,
    fetchClients: true,
    fetchDrivers: true,
    fetchServices: true,
    fetchTransactions: true,
  });

  const { data: overnightCount = 0 } = useQuery({
    queryKey: ["trips-needs-review"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/search?status=needs_review");
      if (!res.ok) return 0;
      const data = await res.json();
      return (data.results || []).length;
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  // Tour access — visible to all admin users when tours are enabled
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const isTourAllowed = settings?.enable_tours !== "no"; // default ON when key absent
  const isWeddingsEnabled = settings?.enable_weddings !== "no"; // default ON
  const isThirdPartyEnabled = settings?.enable_third_party_trips === "yes"; // default OFF

  const todayTrips = useMemo(() => {
    if (!allTrips) return [];
    const today = getTodayInCDT();
    const todayStart = new Date(today + "T00:00:00");
    const todayEnd = new Date(today + "T23:59:59");

    return allTrips.filter((trip) => {
      const tripDate = new Date(trip.start_time);
      return tripDate >= todayStart && tripDate <= todayEnd;
    });
  }, [allTrips]);

  const paidTripIds = new Set(
    (transactions ?? [])
      .filter((t) => t.category === "payment" && t.appointment_id)
      .map((t) => t.appointment_id),
  );

  const handleFetchTrip = async (id) => {
    try {
      const data = await fetchTrip(id);
      setEditingTrip(data);
      setIsModalOpen(true);
    } catch (error) {
      // Error already handled
    }
  };

  const handleSuccess = async () => {
    // If we were editing an existing trip, stay on it with refreshed data
    if (editingTrip && editingTrip.id) {
      const tripId = editingTrip.id;
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      try {
        const refreshedData = await fetchTrip(tripId);
        // Add timestamp so the TripModal key changes and forces a full remount
        refreshedData._refreshTs = Date.now();
        setEditingTrip(refreshedData);
      } catch (error) {
        console.error("Failed to refresh trip:", error);
        setIsModalOpen(false);
        setEditingTrip(null);
      }
    } else {
      // New trip — close the modal
      setIsModalOpen(false);
      setEditingTrip(null);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setEditingTrip(null);
  };

  const handleDeleteTrip = () => {
    if (deletingTrip) {
      deleteMutation.mutate(deletingTrip.id);
      setDeletingTrip(null);
    }
  };

  const handleSendThankYou = async (appointmentId) => {
    setSendingThankYou(appointmentId);
    try {
      const res = await fetch("/api/followup/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send thank you message");
      }

      const result = await res.json();

      const channels = [];
      if (result.smsSent) channels.push("SMS");
      if (result.emailSent) channels.push("Email");

      if (channels.length > 0) {
        toast.success(`Thank you message sent via ${channels.join(" and")}!`);
      } else {
        toast.success("Thank you message sent!");
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    } catch (err) {
      console.error("Failed to send thank you:", err);
      toast.error(err.message || "Failed to send thank you message");
    } finally {
      setSendingThankYou(null);
    }
  };

  const handleCloseUp = async () => {
    setBackupStatus("backing-up");
    setShowCloseUpModal(true);
    try {
      const res = await fetch("/api/data/backup", { method: "POST" });
      if (!res.ok) throw new Error("Backup failed");
      setBackupStatus("complete");
      toast.success("Backup completed successfully!");
    } catch (err) {
      console.error("[Backup]", err);
      toast.error("Backup failed. Please try again.");
      setBackupStatus("error");
    }
  };

  const handleExitApp = () => {
    localStorage.removeItem("dispatcher_login_time");
    window.close();
    setTimeout(() => {
      toast.info("Please close this browser tab manually.");
    }, 500);
  };

  const handleStayInApp = () => {
    setShowCloseUpModal(false);
    setBackupStatus(null);
  };

  // Export / Import
  const { exporting, handleExport } = useDataExport();
  const {
    importing,
    importResults,
    setImportResults,
    fileInputRef,
    handleImportFile,
  } = useDataImport();
  const [showImportModal, setShowImportModal] = useState(false);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(to right, #fef9f0, #e8f4fd)" }}
      >
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const dailyRoutineButtons = [
    {
      label: "Today's Schedule",
      icon: Calendar,
      href: "/schedule",
      color: "from-teal-500 to-teal-600",
      hoverColor: "hover:from-teal-600 hover:to-teal-700",
    },
    {
      label: "All Trips",
      icon: List,
      href: "/trips",
      color: "from-purple-500 to-purple-600",
      hoverColor: "hover:from-purple-500 hover:to-purple-700",
    },
    {
      label: "Process Payments",
      icon: CreditCard,
      href: "/payments",
      color: "from-green-500 to-green-600",
      hoverColor: "hover:from-green-600 hover:to-green-700",
    },
    {
      label: "Review Orders",
      icon: Moon,
      href: "/trips?status=needs_review",
      color: "from-purple-500 to-purple-600",
      hoverColor: "hover:from-purple-500 hover:to-purple-700",
      badge: overnightCount > 0 ? overnightCount : null,
    },
    {
      label: "Assign Drivers",
      icon: CalendarClock,
      href: "/schedule-timeline",
      color: "from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
    },
    {
      label: "Check Messages",
      icon: MessageSquare,
      href: "/messages?unread=true",
      color: "from-slate-600 to-slate-700",
      hoverColor: "hover:from-slate-700 hover:to-slate-800",
    },
    {
      label: "5 PM Report",
      icon: ClipboardCheck,
      href: "/five-pm-reminder",
      color: "from-orange-500 to-orange-600",
      hoverColor: "hover:from-orange-600 hover:to-orange-700",
    },
    {
      label: "Print Schedule",
      icon: ClipboardCheck,
      href: "/print-schedule",
      color: "from-blue-500 to-blue-600",
      hoverColor: "hover:from-blue-600 hover:to-blue-700",
    },
    {
      label: "Close Up",
      icon: LogOut,
      isAction: true,
      color: "from-red-400 to-red-500",
      hoverColor: "hover:from-red-500 hover:to-red-600",
    },
  ];

  const bookingsLinks = [
    { label: "All Trips", href: "/trips" },
    {
      label: "Dispatch \u2013 Book a Trip",
      href: "/trips?new=true&dispatch=true",
    },
    { label: "Calendar", href: "/calendar" },
    { label: "Calendar at a Glance", href: "/calendar-glance" },
    { label: "Assign Drivers", href: "/schedule-builder" },
    { label: "Online Booking Link", href: "/book/catch-a-ride", newTab: true },
    { label: "Recurring Trips", href: "/recurring" },
    { label: "Blocked Times", href: "/blocked-times" },
  ];

  const driversLinks = [
    { label: "Manage Drivers", href: "/drivers" },
    { label: "Manage Vehicles", href: "/vehicles" },
    { label: "Driver Messages", href: "/driver-messages" },
    {
      label: "Manage Availability",
      href: "/dashboard/admin/manage-availability",
    },
  ];

  const passengersLinks = [
    { label: "Passengers", href: "/passengers" },
    { label: "Messages", href: "/messages" },
  ];

  const financialLinks = [
    { label: "Payments", href: "/payments" },
    { label: "Unpaid Trips", href: "/reports/unpaid-trips" },
    { label: "Expenses", href: "/expenses" },
    { label: "Weekly Payments Report", href: "/reports/weekly-payments" },
    {
      label: "Receipts Needed Today",
      href: "#",
      isReceiptModal: true,
      icon: Receipt,
      color: "text-amber-600",
      badge: receiptTrips.length > 0 ? receiptTrips.length : null,
    },
  ];

  const payrollLinks = [
    { label: "Timesheet Report", href: "/timesheet-report" },
  ];

  const reportsLinks = [
    { label: "All Trips Report", href: "/reports/all-trips" },
    { label: "Trips By Driver", href: "/reports/by-driver" },
    { label: "Weekly Payments Report", href: "/reports/weekly-payments" },
    { label: "Payments by Method", href: "/reports/payments-by-method" },
    { label: "Communication Log", href: "/communication-log" },
  ];

  const otherLinks = [
    { label: "Services", href: "/services" },
    { label: "Settings", href: "/settings-2" },
  ];

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes overnight-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .overnight-blink {
          animation: overnight-blink 1.4s ease-in-out infinite;
        }
      `,
        }}
      />
      <div
        className="min-h-screen"
        style={{ background: "linear-gradient(to right, #fef9f0, #e8f4fd)" }}
      >
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">
          {/* ===== HEADER ===== */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span className="text-5xl leading-none">🚖</span>
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">
                  Catch A Ride
                </h1>
                <div className="text-yellow-400 text-xl mt-0.5">⭐⭐⭐⭐⭐</div>
              </div>
            </div>
          </div>

          {/* ===== DAILY ROUTINE ===== */}
          <div className="rounded-xl overflow-hidden shadow">
            <div className="bg-gray-800 text-white px-5 py-3 flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <h2 className="text-base font-bold tracking-wide uppercase">
                Daily Routine
              </h2>
            </div>
            <div className="bg-white px-4 py-4">
              <div className="grid grid-cols-7 gap-3">
                {dailyRoutineButtons.map((btn) => {
                  const Icon = btn.icon;

                  // If it's an action button (Close Up), render as button
                  if (btn.isAction) {
                    return (
                      <button
                        key={btn.label}
                        onClick={handleCloseUp}
                        className={`relative flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-lg text-white bg-gradient-to-b ${btn.color} ${btn.hoverColor} shadow transition-all duration-200 hover:scale-105 hover:shadow-md`}
                      >
                        <Icon className="w-8 h-8" />
                        <span className="text-sm font-semibold text-center leading-tight">
                          {btn.label}
                        </span>
                      </button>
                    );
                  }

                  // Otherwise render as link
                  const isOvernightBlinking =
                    btn.label === "Review Orders" && overnightCount > 0;
                  return (
                    <a
                      key={btn.label}
                      href={btn.href}
                      className={`relative flex flex-col items-center justify-center gap-2 py-5 px-2 rounded-lg text-white bg-gradient-to-b ${btn.color} ${btn.hoverColor} shadow transition-all duration-200 hover:scale-105 hover:shadow-md no-underline${isOvernightBlinking ? " overnight-blink" : ""}`}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-sm font-semibold text-center leading-tight">
                        {btn.label}
                      </span>
                      {btn.badge && (
                        <span className="absolute top-2 right-2 bg-white text-purple-700 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
                          {btn.badge}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===== QUICK ACCESS ===== */}
          <div className="rounded-xl overflow-hidden shadow">
            <div className="bg-gray-800 text-white px-5 py-3 flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h2 className="text-base font-bold tracking-wide uppercase">
                Quick Access
              </h2>
            </div>
            <div className="bg-white px-4 py-4">
              <div className="grid grid-cols-6 gap-x-4 gap-y-4">
                {/* BOOKINGS & SCHEDULE — col-span-4 */}
                <div className="col-span-4 border-l-4 border-blue-500 pl-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Bookings &amp; Schedule
                  </h3>
                  <div className="grid grid-cols-4 gap-x-3 gap-y-1">
                    {bookingsLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        target={link.newTab ? "_blank" : undefined}
                        rel={link.newTab ? "noopener noreferrer" : undefined}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* DRIVERS AND VEHICLES — col-span-2 */}
                <div className="col-span-2 border-l-4 border-purple-500 pl-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Drivers and Vehicles
                  </h3>
                  <div className="flex flex-col gap-1">
                    {driversLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* PASSENGERS — col-span-6 */}
                <div className="col-span-6 border-l-4 border-orange-400 pl-3 border-t border-gray-100 pt-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Passengers
                  </h3>
                  <div className="flex gap-8">
                    {passengersLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* ── Financial Section links ────────────────────────────────────── */}
                <div className="col-span-3 border-l-4 border-green-500 pl-3 border-t border-gray-100 pt-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Financial
                  </h3>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                    {financialLinks.map((link) => {
                      const LinkIcon = link.icon;
                      if (link.isReceiptModal) {
                        return (
                          <button
                            key={link.label}
                            onClick={() => setShowReceiptModal(true)}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline text-left flex items-center gap-1"
                          >
                            {link.label}
                            {link.badge ? (
                              <span className="inline-flex items-center justify-center w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                                {link.badge}
                              </span>
                            ) : null}
                          </button>
                        );
                      }
                      return (
                        <a
                          key={link.label}
                          href={link.href}
                          className={`text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 ${link.color || ""}`}
                        >
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </div>

                {/* PAYROLL — col-span-3 */}
                <div className="col-span-3 border-l-4 border-indigo-500 pl-3 border-t border-gray-100 pt-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Payroll
                  </h3>
                  <div className="flex gap-8">
                    {payrollLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Reports and Logs — col-span-6 */}
                <div className="col-span-6 border-l-4 border-blue-400 pl-3 border-t border-gray-100 pt-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Reports &amp; Logs
                  </h3>
                  <div className="flex gap-8 flex-wrap">
                    {reportsLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* OTHER — col-span-6 */}
                <div className="col-span-6 border-l-4 border-red-400 pl-3 border-t border-gray-100 pt-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100">
                    Other
                  </h3>
                  <div className="flex gap-8 flex-wrap">
                    {otherLinks.map((link) => {
                      if (link.isExport) {
                        return (
                          <button
                            key={link.label}
                            onClick={handleExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {exporting ? "Exporting…" : link.label}
                          </button>
                        );
                      }
                      if (link.isImport) {
                        return (
                          <button
                            key={link.label}
                            onClick={() => {
                              setImportResults(null);
                              setShowImportModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {link.label}
                          </button>
                        );
                      }
                      return (
                        <a
                          key={link.label}
                          href={link.href}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {link.label}
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== TOUR AGENT PORTAL ===== */}
          {isTourAllowed && (
            <div className="rounded-xl overflow-hidden shadow">
              <div className="bg-purple-700 text-white px-5 py-3 flex items-center gap-2">
                <span className="text-lg">🚌</span>
                <h2 className="text-base font-bold tracking-wide uppercase">
                  Tours
                </h2>
              </div>
              <div className="bg-white px-4 py-4 flex gap-3">
                <a
                  href="/trips?new=true&tour=true"
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-all no-underline"
                >
                  🚌 Book A Tour
                </a>
                <a
                  href="/tours"
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-all no-underline"
                >
                  📋 Review Tours
                </a>
              </div>
            </div>
          )}

          {/* ===== WEDDING PACKAGES ===== */}
          {isWeddingsEnabled && (
            <div className="rounded-xl overflow-hidden shadow">
              <div className="bg-pink-600 text-white px-5 py-3 flex items-center gap-2">
                <span className="text-lg">💒</span>
                <h2 className="text-base font-bold tracking-wide uppercase">
                  Weddings
                </h2>
              </div>
              <div className="bg-white px-4 py-4 flex gap-3">
                <a
                  href="/weddings"
                  className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition-all no-underline"
                >
                  💒 New Wedding
                </a>
                <a
                  href="/weddings"
                  className="px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg hover:bg-pink-700 transition-all no-underline"
                >
                  💍 Review Weddings
                </a>
                <button
                  onClick={() => (window.location.href = "/weddings/add-trip")}
                  className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                >
                  ➕ Add Trips to Wedding
                </button>
              </div>
            </div>
          )}

          {/* ===== WEDDINGS 2.0 ===== */}
          {isWeddingsEnabled && (
            <div className="rounded-xl overflow-hidden shadow ring-2 ring-rose-200">
              <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white px-5 py-3 flex items-center gap-2">
                <span className="text-lg">💍</span>
                <h2 className="text-base font-bold tracking-wide uppercase">
                  Weddings 2.0
                </h2>
                <span className="ml-2 text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  New
                </span>
              </div>
              <div className="bg-white px-4 py-4 flex gap-3">
                <a
                  href="/weddings-2"
                  className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-all no-underline"
                >
                  💍 New Wedding Booking
                </a>
                <a
                  href="/weddings-2/review"
                  className="px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-all no-underline"
                >
                  📋 Review Wedding Bookings
                </a>
              </div>
            </div>
          )}

          {/* ===== THIRD-PARTY DRIVES ===== */}
          {isThirdPartyEnabled && (
            <div className="rounded-xl overflow-hidden shadow">
              <div className="bg-teal-600 text-white px-5 py-3 flex items-center gap-2">
                <span className="text-lg">🤝</span>
                <h2 className="text-base font-bold tracking-wide uppercase">
                  Third-Party Drives
                </h2>
              </div>
              <div className="bg-white px-4 py-4 flex gap-3">
                <a
                  href="/third-party-trips?new=true"
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-all no-underline"
                >
                  🤝 Create 3rd Party Drive
                </a>
                <a
                  href="/third-party-trips"
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-all no-underline"
                >
                  📋 Review 3rd Party Drives
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Up Modal */}
      {showCloseUpModal && backupStatus === "complete" && (
        <BackupOnCloseModal onExit={handleExitApp} onStay={handleStayInApp} />
      )}

      {/* Backup in progress indicator */}
      {showCloseUpModal && backupStatus === "backing-up" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
            <p className="text-lg font-semibold text-gray-900">
              Backing up data...
            </p>
            <p className="text-sm text-gray-600 mt-2">Please wait</p>
          </div>
        </div>
      )}

      <DeleteTripModal
        trip={deletingTrip}
        onCancel={() => setDeletingTrip(null)}
        onConfirm={handleDeleteTrip}
        isDeleting={deleteMutation.isPending}
      />

      {isModalOpen && editingTrip && (
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
            key={`trip-${editingTrip.id}-${editingTrip._refreshTs || ""}`}
            trip={editingTrip}
            clients={clients}
            drivers={drivers}
            services={services}
            onClose={handleClose}
            onSuccess={handleSuccess}
            onBookReturn={() => {}}
          />
        </Suspense>
      )}

      {paymentTripId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <UnifiedPaymentModal
            trips={allTrips}
            preselectedTripId={paymentTripId}
            paidTripIds={paidTripIds}
            onClose={() => setPaymentTripId(null)}
            onSuccess={() => {
              setPaymentTripId(null);
              queryClient.invalidateQueries(["appointments"]);
              queryClient.invalidateQueries(["transactions"]);
            }}
          />
        </Suspense>
      )}

      {invoiceTripId && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl p-8">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
              </div>
            </div>
          }
        >
          <InvoiceModal
            tripId={invoiceTripId}
            onClose={() => setInvoiceTripId(null)}
          />
        </Suspense>
      )}

      {/* Receipt Needed Today Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-amber-600" />
                <h2 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                  Receipts Needed Today
                </h2>
                {receiptTrips.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                    {receiptTrips.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {receiptData?.date && (
                  <span className="text-xs text-amber-600 font-medium">
                    {receiptData.date}
                  </span>
                )}
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {receiptTrips.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Receipt size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No receipts needed today</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {receiptTrips.map((trip) => {
                    const tripTime = new Date(
                      trip.start_time,
                    ).toLocaleTimeString("en-US", {
                      timeZone: "America/Chicago",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });
                    return (
                      <div
                        key={trip.id}
                        className="px-5 py-3 flex items-start gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {trip.booking_number && (
                              <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                #{trip.booking_number}
                              </span>
                            )}
                            <div className="text-xs text-gray-500">
                              {trip.display_short_date ||
                                (trip.start_time
                                  ? new Date(
                                      trip.start_time,
                                    ).toLocaleDateString()
                                  : "No date")}
                              {" • "}
                              {trip.display_time ||
                                (trip.start_time
                                  ? new Date(
                                      trip.start_time,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "")}
                            </div>
                            {trip.employee_name && (
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
                                style={{
                                  backgroundColor:
                                    trip.employee_color || "#6b7280",
                                }}
                              >
                                {trip.employee_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                            {trip.client_name || "Unknown Passenger"}
                          </p>
                          {trip.destination && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              → {trip.destination}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          {trip.original_amount > 0 && (
                            <p className="text-sm font-bold text-gray-900">
                              ${Number(trip.original_amount).toFixed(2)}
                            </p>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              trip.payment_status === "paid"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-orange-50 text-orange-700 border border-orange-200"
                            }`}
                          >
                            {trip.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                          <a
                            href={`/receipt/${trip.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline font-medium"
                          >
                            View Receipt →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0 flex justify-end">
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Import JSON Data
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResults(null);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Warning */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="text-red-600 mt-0.5 shrink-0"
                />
                <p className="text-xs text-red-700 font-medium">
                  <strong>REPLACES all data.</strong> All existing drivers,
                  passengers, services, trips, and transactions are permanently
                  deleted before loading. Export a backup first.
                </p>
              </div>

              {/* File picker */}
              <label
                htmlFor="dashboard-import-file"
                className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${importing ? "border-blue-300 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"}`}
              >
                {importing ? (
                  <>
                    <Loader2 size={28} className="text-blue-500 animate-spin" />
                    <span className="text-sm font-medium text-blue-600">
                      Importing…
                    </span>
                  </>
                ) : (
                  <>
                    <FileJson size={28} className="text-gray-400" />
                    <div className="text-center">
                      <span className="text-sm font-medium text-gray-700">
                        Click to select a JSON export file
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        Only .json files from this app are supported
                      </p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  id="dashboard-import-file"
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  disabled={importing}
                  onChange={handleImportFile}
                />
              </label>

              {/* Results */}
              {importResults && (
                <div className="space-y-3">
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium ${importResults.total_errors === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}
                  >
                    {importResults.total_errors === 0 ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <AlertCircle size={16} className="text-amber-600" />
                    )}
                    {importResults.message}
                  </div>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold text-gray-600">
                            Section
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">
                            Inserted
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">
                            Skipped
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-gray-600">
                            Errors
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(importResults.results || {}).map(
                          ([section, r]) => (
                            <tr
                              key={section}
                              className={
                                r.errors?.length > 0 ? "bg-red-50" : ""
                              }
                            >
                              <td className="px-4 py-2 font-medium text-gray-700 capitalize">
                                {section.replace(/_/g, " ")}
                              </td>
                              <td className="px-4 py-2 text-right text-green-700">
                                {r.inserted ?? r.updated ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-500">
                                {r.skipped ?? "—"}
                              </td>
                              <td className="px-4 py-2 text-right text-red-600">
                                {r.errors?.length || 0}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() => setImportResults(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Clear results
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 shrink-0 flex justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResults(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
