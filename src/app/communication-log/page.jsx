"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Mail,
  MessageSquare,
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";

function formatDateTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function StatusBadge({ status }) {
  if (status === "sent" || status === "success") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle size={11} /> Sent
      </span>
    );
  }
  if (status === "failure" || status === "failed" || status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <XCircle size={11} /> Failed
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
        <Clock size={11} /> Skipped (Duplicate)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
      <Clock size={11} /> {status || "Unknown"}
    </span>
  );
}

// Helper: turn URLs in plain text into clickable <a> tags
function linkifyText(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// Helper: wrap bare URLs in HTML with <a> tags (skips ones already in href/src)
function linkifyHtml(html) {
  if (!html) return "(No body)";
  // Replace bare URLs not already inside an attribute value
  return html.replace(
    /(?<![='"\/])(https?:\/\/[^\s<>"'\)]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;word-break:break-all;">$1</a>',
  );
}

// NEW: badge for email type
function EmailTypeBadge({ emailType }) {
  if (!emailType) return null;
  const typeMap = {
    invoice: {
      label: "Invoice",
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    passenger_booking_created: {
      label: "Booking Created",
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    passenger_booking_changed: {
      label: "Booking Updated",
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    passenger_driver_assigned: {
      label: "Driver Assigned",
      color: "text-green-700 bg-green-50 border-green-200",
    },
    driver_booking_created: {
      label: "Driver: New Trip",
      color: "text-green-700 bg-green-50 border-green-200",
    },
    driver_booking_changed: {
      label: "Driver: Updated",
      color: "text-green-700 bg-green-50 border-green-200",
    },
    driver_driver_assigned: {
      label: "Driver: Assigned",
      color: "text-green-700 bg-green-50 border-green-200",
    },
    office_booking_created: {
      label: "Office: New",
      color: "text-gray-700 bg-gray-50 border-gray-200",
    },
    office_booking_changed: {
      label: "Office: Updated",
      color: "text-gray-700 bg-gray-50 border-gray-200",
    },
    office_driver_assigned: {
      label: "Office: Assigned",
      color: "text-gray-700 bg-gray-50 border-gray-200",
    },
    location_booking_created: {
      label: "Location: New",
      color: "text-purple-700 bg-purple-50 border-purple-200",
    },
    location_booking_changed: {
      label: "Location: Updated",
      color: "text-purple-700 bg-purple-50 border-purple-200",
    },
    weddings2_booking_received: {
      label: "Wedding Inquiry",
      color: "text-pink-700 bg-pink-50 border-pink-200",
    },
  };
  const info = typeMap[emailType] || {
    label: emailType,
    color: "text-gray-600 bg-gray-100 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center text-xs font-semibold border px-2 py-0.5 rounded-full ${info.color}`}
    >
      {info.label}
    </span>
  );
}

function EmailRow({ email }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Mail size={15} className="text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {email.appointment_id ? (
              <a
                href={`/trips?id=${email.appointment_id}&returnTo=/communication-log`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-blue-700 hover:underline truncate"
              >
                {email.subject || "(No Subject)"}
              </a>
            ) : (
              <span className="text-sm font-semibold text-gray-900 truncate">
                {email.subject || "(No Subject)"}
              </span>
            )}
            <StatusBadge status={email.status} />
            <EmailTypeBadge emailType={email.email_type} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span>
              To:{" "}
              {email.recipient_name
                ? `${email.recipient_name} <${email.recipient_email}>`
                : email.recipient_email}
            </span>
            {email.appointment_id && (
              <a
                href={`/trips?id=${email.appointment_id}&returnTo=/communication-log`}
                onClick={(e) => e.stopPropagation()}
                className="text-blue-600 hover:underline"
              >
                Trip #{email.appointment_id}
              </a>
            )}
            <span>{formatDateTime(email.sent_at)}</span>
          </div>
          {email.error_message && (
            <p className="text-xs text-red-600 mt-1">{email.error_message}</p>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={15} className="text-gray-400 shrink-0 mt-1" />
        ) : (
          <ChevronDown size={15} className="text-gray-400 shrink-0 mt-1" />
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-4 ml-6">
          <div
            className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 max-h-80 overflow-y-auto prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: linkifyHtml(email.body) }}
          />
        </div>
      )}
    </div>
  );
}

function SmsRow({ sms }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <MessageSquare
        size={15}
        className={`mt-0.5 shrink-0 ${sms.direction === "inbound" ? "text-green-500" : "text-purple-500"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              sms.direction === "inbound"
                ? "bg-green-100 text-green-700"
                : "bg-purple-100 text-purple-700"
            }`}
          >
            {sms.direction === "inbound" ? "← INBOUND" : "→ OUTBOUND"}
          </span>
          <span className="text-xs text-gray-500 font-mono">{sms.phone}</span>
          {sms.client_name && (
            <span className="text-xs text-gray-700 font-semibold">
              {sms.client_name}
            </span>
          )}
          {sms.sender_name && sms.sender_name !== sms.client_name && (
            <span className="text-xs text-gray-600 font-medium">
              {sms.sender_name}
            </span>
          )}
          {sms.appointment_id && (
            <a
              href={`/trips?id=${sms.appointment_id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Trip #{sms.appointment_id}
            </a>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            {formatDateTime(sms.sent_at)}
          </span>
        </div>
        <p className="text-sm text-gray-800 break-words">
          {linkifyText(sms.message)}
        </p>
      </div>
    </div>
  );
}

export default function CommunicationLog() {
  const [activeTab, setActiveTab] = useState("email");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [emailTypeFilter, setEmailTypeFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");

  const { data: emailData, isLoading: emailLoading } = useQuery({
    queryKey: ["email-logs"],
    queryFn: async () => {
      const res = await fetch("/api/email/logs?limit=2000");
      if (!res.ok) throw new Error("Failed to load email logs");
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: smsData, isLoading: smsLoading } = useQuery({
    queryKey: ["sms-log"],
    queryFn: async () => {
      const res = await fetch("/api/sms/messages?limit=5000");
      if (!res.ok) throw new Error("Failed to load SMS log");
      const data = await res.json();
      console.log("[SMS API Debug] Response data:", data);
      console.log(
        "[SMS API Debug] First 3 messages:",
        data.messages?.slice(0, 3),
      );
      return data;
    },
    staleTime: 30000,
  });

  const emails = useMemo(() => {
    const all = emailData?.emails || [];
    return all.filter((e) => {
      const matchSearch =
        !search ||
        (e.subject || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.recipient_email || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (e.recipient_name || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const matchType =
        emailTypeFilter === "all" || e.email_type === emailTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [emailData, search, statusFilter, emailTypeFilter]);

  const smsMessages = useMemo(() => {
    const all = smsData?.messages || smsData?.sms_messages || [];

    // Debug: log first message to see what fields are available
    if (all.length > 0 && search) {
      console.log("[SMS Filter Debug] First message:", all[0]);
      console.log("[SMS Filter Debug] Search term:", search);
    }

    return all.filter((s) => {
      const matchSearch =
        !search ||
        (s.message || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.phone || "").includes(search) ||
        (s.sender_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.booking_number || "").toLowerCase().includes(search.toLowerCase());
      const matchDir =
        directionFilter === "all" || s.direction === directionFilter;

      // Debug: log match results for messages that should match
      if (
        search &&
        s.client_name &&
        s.client_name.toLowerCase().includes(search.toLowerCase())
      ) {
        console.log("[SMS Filter Debug] Match found:", {
          client_name: s.client_name,
          search,
          matchSearch,
          matchDir,
        });
      }

      return matchSearch && matchDir;
    });
  }, [smsData, search, directionFilter]);

  const emailCount = emailData?.emails?.length ?? 0;
  const smsCount = (smsData?.messages || smsData?.sms_messages || []).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={16} />
            Dashboard
          </a>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Communication Log
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Last 30 days of emails and SMS messages
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("email")}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "email"
                  ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Mail size={15} />
              Emails
              <span className="ml-1 bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {emailCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("sms")}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === "sms"
                  ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <MessageSquare size={15} />
              SMS
              <span className="ml-1 bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {smsCount}
              </span>
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={
                  activeTab === "email"
                    ? "Search subject, recipient..."
                    : "Search name, message, phone, booking #..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {activeTab === "email" && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="sent">Sent</option>
                <option value="skipped">Skipped (Duplicate)</option>
                <option value="failed">Failed</option>
                <option value="error">Error</option>
              </select>
            )}

            {/* NEW: Email type filter */}
            {activeTab === "email" && (
              <select
                value={emailTypeFilter}
                onChange={(e) => setEmailTypeFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="invoice">Invoice</option>
                <option value="passenger_booking_created">
                  Passenger: New Trip
                </option>
                <option value="passenger_booking_changed">
                  Passenger: Updated
                </option>
                <option value="passenger_driver_assigned">
                  Passenger: Driver Assigned
                </option>
                <option value="driver_booking_created">Driver: New Trip</option>
                <option value="driver_booking_changed">Driver: Updated</option>
                <option value="driver_driver_assigned">Driver: Assigned</option>
                <option value="office_booking_created">Office: New</option>
                <option value="office_booking_changed">Office: Updated</option>
                <option value="location_booking_created">Location: New</option>
                <option value="location_booking_changed">
                  Location: Updated
                </option>
              </select>
            )}

            {activeTab === "sms" && (
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Directions</option>
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            )}

            {search && (
              <button
                onClick={() => {
                  setSearch("");
                  setEmailTypeFilter("all");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-200 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Content */}
          {activeTab === "email" && (
            <div>
              {emailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
                </div>
              ) : emails.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Mail size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No emails found</p>
                  {search && (
                    <p className="text-sm mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-semibold">
                    {emails.length} email{emails.length !== 1 ? "s" : ""}{" "}
                    {search ? `matching "${search}"` : ""}
                  </div>
                  {emails.map((email) => (
                    <EmailRow key={email.id} email={email} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "sms" && (
            <div>
              {smsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full" />
                </div>
              ) : smsMessages.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <MessageSquare
                    size={36}
                    className="mx-auto mb-3 opacity-30"
                  />
                  <p className="font-medium">No SMS messages found</p>
                  {search && (
                    <p className="text-sm mt-1">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-semibold border-b border-gray-100">
                    {smsMessages.length} message
                    {smsMessages.length !== 1 ? "s" : ""}{" "}
                    {search ? `matching "${search}"` : ""}
                  </div>
                  {smsMessages.map((sms) => (
                    <SmsRow key={sms.id} sms={sms} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
