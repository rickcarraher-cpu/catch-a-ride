"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Sparkles,
  MessageSquare,
  Send,
  X,
  Search,
  CreditCard,
  Inbox,
  UserPlus,
  FileText,
  Car,
  ChevronDown,
  Users,
  AlertTriangle,
  LogOut,
  Clock,
  Bus,
  CalendarClock,
  ClipboardList,
  List,
} from "lucide-react";
import { toast } from "sonner";
import BackupOnCloseModal from "./BackupOnCloseModal";
import ChangeLogModal from "./ChangeLogModal";
import useUser from "@/utils/useUser";
import { getRoutesByCategory, ROUTES } from "@/utils/routes";

export default function QuickAccessBar() {
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [showCloseUpModal, setShowCloseUpModal] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);

  const { data: currentUser } = useUser();

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

  // Compute tour access from settings-managed authorized email list
  const tourAuthorizedEmails = (settings?.tour_authorized_emails || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Tour access — visible to all admin users when tours are enabled
  const isTourAllowed = settings?.enable_tour_booking === "yes";

  const { data: conversationsData } = useQuery({
    queryKey: ["sms-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/sms/conversations");
      if (!res.ok) return { conversations: [] };
      return res.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const totalUnread = (conversationsData?.conversations || []).reduce(
    (sum, c) => sum + Number(c.unread_count || 0),
    0,
  );
  const hasUnread = totalUnread > 0;

  const { data: needsReviewData } = useQuery({
    queryKey: ["trips-needs-review"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/search?status=needs_review");
      if (!res.ok) return { results: [] };
      return res.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const needsReviewCount = (needsReviewData?.results || []).length;
  const hasNeedsReview = needsReviewCount > 0;

  const companyName = settings?.business_name || "";

  const handleCloseUp = () => {
    setShowCloseUpModal(true);
    setBackupStatus(null);
  };

  const handleBackup = async () => {
    setBackupStatus("backing-up");
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

  useEffect(() => {
    if (showCloseUpModal && backupStatus === null) {
      handleBackup();
    }
  }, [showCloseUpModal]);

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

  // Get routes from centralized configuration
  const routesByCategory = getRoutesByCategory();

  // Helper to handle button clicks
  const handleNavigate = (route) => {
    if (route.path === "#" && route.isAction) {
      if (route.label === "Close Up") {
        handleCloseUp();
      }
    } else if (route.openInNewTab) {
      window.open(route.path, "_blank");
    } else {
      window.location.href = route.path;
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slow-red-flash {
          0%, 100% { background-color: #4a5568; color: #ffffff; }
          50% { background-color: #dc2626; color: #ffffff; }
        }
        .btn-unread-flash {
          animation: slow-red-flash 2s ease-in-out infinite;
        }
      `}</style>
      <div className="bg-gray-100 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-4">
          {companyName && (
            <div className="mb-4 text-center">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {companyName}
              </h1>
            </div>
          )}

          {/* Daily Routine Section */}
          <div className="mb-4">
            <h2 className="text-gray-800 font-bold text-sm mb-2 flex items-center gap-1.5">
              <Clock size={14} />
              Daily Routine
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <button
                onClick={() => handleNavigate(ROUTES.TODAY_SCHEDULE)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#4a5568] text-white font-semibold rounded-lg hover:bg-[#3d4654] transition-all shadow-sm text-xs"
              >
                <Calendar size={16} />
                <span>{ROUTES.TODAY_SCHEDULE.label}</span>
              </button>

              <button
                onClick={() => handleNavigate(ROUTES.PROCESS_PAYMENTS)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#4a5568] text-white font-semibold rounded-lg hover:bg-[#3d4654] transition-all shadow-sm text-xs"
              >
                <CreditCard size={16} />
                <span>{ROUTES.PROCESS_PAYMENTS.label}</span>
              </button>

              <button
                onClick={() => handleNavigate(ROUTES.OVERNIGHT_ORDERS)}
                className={`flex items-center gap-2 px-3 py-2.5 font-semibold rounded-lg transition-all shadow-sm text-xs text-white ${hasNeedsReview ? "btn-unread-flash" : "bg-[#4a5568] hover:bg-[#3d4654]"}`}
              >
                <Inbox size={16} />
                <span>{ROUTES.OVERNIGHT_ORDERS.label}</span>
                {hasNeedsReview && (
                  <span className="ml-1 bg-white text-red-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {needsReviewCount > 9 ? "9+" : needsReviewCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNavigate(ROUTES.ASSIGN_DRIVERS)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#4a5568] text-white font-semibold rounded-lg hover:bg-[#3d4654] transition-all shadow-sm text-xs"
              >
                <UserPlus size={16} />
                <span>{ROUTES.ASSIGN_DRIVERS.label}</span>
              </button>

              {/* NEW: Schedule Drives 2.0 */}
              <a
                href="/schedule-timeline"
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                <CalendarClock className="text-blue-600" size={20} />
                <span className="text-sm font-medium text-gray-700">
                  Assign Drivers
                </span>
              </a>

              <button
                onClick={() => handleNavigate(ROUTES.CHECK_MESSAGES)}
                className={`flex items-center gap-2 px-3 py-2.5 font-semibold rounded-lg transition-all shadow-sm text-xs text-white ${hasUnread ? "btn-unread-flash" : "bg-[#4a5568] hover:bg-[#3d4654]"}`}
              >
                <MessageSquare size={16} />
                <span>{ROUTES.CHECK_MESSAGES.label}</span>
                {hasUnread && (
                  <span className="ml-1 bg-white text-red-600 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </button>

              <button
                onClick={() => handleNavigate(ROUTES.FIVE_PM_REPORT)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#4a5568] text-white font-semibold rounded-lg hover:bg-[#3d4654] transition-all shadow-sm text-xs"
              >
                <Clock size={16} />
                <span>{ROUTES.FIVE_PM_REPORT.label}</span>
              </button>

              {/* NEW: All Trips button */}
              <button
                onClick={() => handleNavigate(ROUTES.ALL_TRIPS)}
                className="flex items-center gap-2 px-3 py-2.5 bg-[#4a5568] text-white font-semibold rounded-lg hover:bg-[#3d4654] transition-all shadow-sm text-xs"
              >
                <List size={16} />
                <span>{ROUTES.ALL_TRIPS.label}</span>
              </button>

              {/* Change Log button */}
              <button
                onClick={() => setShowChangeLog(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ClipboardList size={15} />
                Change Log
              </button>

              <button
                onClick={handleCloseUp}
                className="flex items-center gap-2 px-3 py-2.5 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all shadow-sm text-xs"
              >
                <LogOut size={16} />
                <span>{ROUTES.CLOSE_UP.label}</span>
              </button>
            </div>
          </div>

          {/* Quick Access Section */}
          <div>
            <h2 className="text-gray-800 font-bold text-sm mb-2 flex items-center gap-1.5">
              <Sparkles size={14} />
              Quick Access
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Bookings & Schedule */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={12} className="text-blue-600" />
                  Bookings & Schedule
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {routesByCategory.bookings.map((route) => (
                    <button
                      key={route.path}
                      onClick={() => handleNavigate(route)}
                      className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                    >
                      {route.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Drivers */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Car size={12} className="text-green-600" />
                  Drivers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {routesByCategory.drivers.map((route) => (
                    <button
                      key={route.path}
                      onClick={() => handleNavigate(route)}
                      className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                    >
                      {route.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passengers */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users size={12} className="text-indigo-600" />
                  Passengers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {routesByCategory.passengers.map((route) => {
                    if (route.path === "/messages") {
                      return (
                        <button
                          key={route.path}
                          onClick={() => handleNavigate(route)}
                          className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-all text-white ${hasUnread ? "btn-unread-flash" : "bg-[#4a5568] hover:bg-[#3d4654]"}`}
                        >
                          {route.label}
                          {hasUnread ? ` (${totalUnread})` : ""}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={route.path}
                        onClick={() => handleNavigate(route)}
                        className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                      >
                        {route.label}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowPassengerModal(true)}
                    className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                  >
                    Message Passenger
                  </button>
                </div>
              </div>
            </div>

            {/* Financial and Payroll - full width row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Financial */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CreditCard size={12} className="text-purple-600" />
                  Financial
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {routesByCategory.financial.map((route) => (
                    <button
                      key={route.path}
                      onClick={() => handleNavigate(route)}
                      className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                    >
                      {route.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payroll */}
              <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText size={12} className="text-emerald-600" />
                  Payroll
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {routesByCategory.payroll.map((route) => (
                    <button
                      key={route.path}
                      onClick={() => handleNavigate(route)}
                      className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                    >
                      {route.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Other - full width */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm mb-3">
              <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare size={12} className="text-orange-600" />
                Other
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {routesByCategory.other.map((route) => (
                  <button
                    key={route.path}
                    onClick={() => handleNavigate(route)}
                    className="px-2 py-1.5 bg-[#4a5568] text-white text-[11px] font-medium rounded-md hover:bg-[#3d4654] transition-all"
                  >
                    {route.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tours — separate section, only visible to authorized users */}
            {isTourAllowed && (
              <div className="bg-white rounded-lg border border-purple-200 p-3 shadow-sm">
                <h3 className="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Bus size={12} className="text-purple-600" />
                  Tours
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      (window.location.href = "/trips?new=true&tour=true")
                    }
                    className="px-2 py-1.5 bg-purple-600 text-white text-[11px] font-medium rounded-md hover:bg-purple-700 transition-all"
                  >
                    🚌 Book A Tour
                  </button>
                  <button
                    onClick={() => (window.location.href = "/tours")}
                    className="px-2 py-1.5 bg-purple-600 text-white text-[11px] font-medium rounded-md hover:bg-purple-700 transition-all"
                  >
                    📋 Review Tours
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPassengerModal && (
        <PassengerMessageModal onClose={() => setShowPassengerModal(false)} />
      )}

      {showCloseUpModal && (
        <BackupOnCloseModal
          onClose={() => setShowCloseUpModal(false)}
          onBackup={handleBackup}
          backupStatus={backupStatus}
        />
      )}

      {showChangeLog && (
        <ChangeLogModal onClose={() => setShowChangeLog(false)} />
      )}
    </>
  );
}

function PassengerMessageModal({ onClose }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPassenger, setSelectedPassenger] = useState(null);
  const [messageText, setMessageText] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load passengers");
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ clientId, phone, email, name, message }) => {
      const res = await fetch("/api/sms/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          phone,
          email,
          name,
          message: message,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const channels = [];
      if (data.results?.sms) channels.push("SMS");
      if (data.results?.email) channels.push("Email");
      const channelText =
        channels.length > 0 ? ` via ${channels.join(" & ")}` : "";
      toast.success(`Message sent successfully${channelText}!`);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const filteredClients = (clients || []).filter((client) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      client.name?.toLowerCase().includes(q) ||
      client.phone?.includes(q) ||
      client.email?.toLowerCase().includes(q)
    );
  });

  const handleSend = () => {
    if (!selectedPassenger) {
      toast.error("Please select a passenger");
      return;
    }
    if (!messageText.trim()) {
      toast.error("Please enter a message");
      return;
    }

    sendMutation.mutate({
      clientId: selectedPassenger.id,
      phone: selectedPassenger.phone,
      email: selectedPassenger.email,
      name: selectedPassenger.name,
      message: messageText.trim(),
    });
  };

  const notifPref = selectedPassenger?.notification_preference || "both";
  const willSendSms =
    (notifPref === "sms" || notifPref === "both") && selectedPassenger?.phone;
  const willSendEmail =
    (notifPref === "email" || notifPref === "both") && selectedPassenger?.email;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              Send Message to Passenger
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select a passenger and compose your message
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
              Search Passenger
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {selectedPassenger && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {selectedPassenger.name}
                    </p>
                    {selectedPassenger.phone && (
                      <p className="text-xs text-blue-600">
                        Phone: {selectedPassenger.phone}
                      </p>
                    )}
                    {selectedPassenger.email && (
                      <p className="text-xs text-blue-600">
                        Email: {selectedPassenger.email}
                      </p>
                    )}
                    <p className="text-xs text-blue-600 mt-1">
                      Preference:{" "}
                      {notifPref === "both"
                        ? "Email & SMS"
                        : notifPref === "email"
                          ? "Email only"
                          : "SMS only"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPassenger(null)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                  {willSendSms && willSendEmail && (
                    <>📧 📱 Will send via Email & SMS</>
                  )}
                  {willSendSms && !willSendEmail && (
                    <>📱 Will send via SMS only</>
                  )}
                  {!willSendSms && willSendEmail && (
                    <>📧 Will send via Email only</>
                  )}
                  {!willSendSms && !willSendEmail && (
                    <>⚠️ No contact method available</>
                  )}
                </p>
              </div>
            </>
          )}

          {!selectedPassenger && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Select Passenger
              </label>
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">
                  Loading passengers...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {searchTerm
                    ? "No passengers found"
                    : "No passengers available"}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => setSelectedPassenger(client)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {client.name}
                        </p>
                        {client.phone && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {client.phone}
                          </p>
                        )}
                        {client.email && (
                          <p className="text-xs text-gray-500">
                            {client.email}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedPassenger && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                Message
              </label>
              <textarea
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                placeholder="Type your message here..."
                rows={6}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                maxLength={1600}
              />
              <p className="text-xs text-gray-400 mt-1">
                {messageText.length}/1600 characters
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sendMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={
              sendMutation.isPending ||
              !selectedPassenger ||
              !messageText.trim()
            }
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {sendMutation.isPending ? (
              <>Sending...</>
            ) : (
              <>
                <Send size={16} />
                Send Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
