"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Phone,
  User,
  Calendar,
  ArrowLeft,
  Trash2,
  CheckCheck,
  Clock,
  Filter,
  Plus,
  X,
  RefreshCw,
  Users,
  Heart,
  Mail,
  Search,
  AlertCircle,
  CheckCircle2,
  EyeOff,
} from "lucide-react";
import { toast } from "@/utils/notify";

// Format a UTC timestamp in Central time (CDT/CST) with timezone label
function formatCDT(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tzLabel = d
    .toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "short",
    })
    .split(" ")
    .pop();
  return `${datePart} ${timePart} ${tzLabel}`;
}

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  // Initialize from URL param: ?unread=true activates the unread-only filter
  const [showUnreadOnly, setShowUnreadOnly] = useState(() => {
    if (typeof window !== "undefined") {
      return (
        new URLSearchParams(window.location.search).get("unread") === "true"
      );
    }
    return false;
  });
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [newMessageRecipients, setNewMessageRecipients] = useState([]); // Changed to array
  const [currentPhoneInput, setCurrentPhoneInput] = useState(""); // For typing new phone
  const [newMessageText, setNewMessageText] = useState("");
  const [showDeleteThreadConfirm, setShowDeleteThreadConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Track previous unread count for notification
  const prevUnreadCountRef = useRef(null);

  // Lookup states
  const [passengerSearch, setPassengerSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [showPassengerDropdown, setShowPassengerDropdown] = useState(false);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);

  // Fetch conversations (grouped by phone number)
  const {
    data: conversationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["sms-conversations", showUnreadOnly],
    queryFn: async () => {
      const url = showUnreadOnly
        ? "/api/sms/conversations?unread_only=true"
        : "/api/sms/conversations";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    refetchInterval: false, // Disabled — was auto-refreshing every 15 seconds
  });

  const conversations = conversationsData?.conversations || [];

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();

    // Search in client name
    if (conversation.client_name?.toLowerCase().includes(query)) return true;

    // Search in phone number
    if (conversation.phone?.includes(query)) return true;

    // Search in booking number
    if (conversation.booking_number?.toLowerCase().includes(query)) return true;

    // Search in last message
    if (conversation.last_message?.toLowerCase().includes(query)) return true;

    // Search in participant names (for group conversations)
    if (
      conversation.participants?.some((p) =>
        p.name?.toLowerCase().includes(query),
      )
    )
      return true;

    return false;
  });

  // Calculate total unread
  const totalUnread = conversations.reduce(
    (sum, c) => sum + Number(c.unread_count),
    0,
  );

  // Calculate total unread urgent messages
  const urgentUnreadCount = conversations.reduce((sum, conversation) => {
    // Check if this conversation has any unread urgent messages
    if (conversation.has_urgent_unread) {
      return sum + 1; // Count conversations with urgent unread, not individual messages
    }
    return sum;
  }, 0);

  // ✨ UPDATED: Show notification on mount if there are unread messages
  useEffect(() => {
    // Skip on initial mount (prevUnreadCountRef is null)
    if (prevUnreadCountRef.current === null) {
      prevUnreadCountRef.current = totalUnread;
      return;
    }

    // Check if unread count increased
    const previousCount = prevUnreadCountRef.current;
    if (totalUnread > previousCount) {
      const newMessages = totalUnread - previousCount;

      // Show toast notification with "You've got mail" style
      toast.success(
        `📬 ${newMessages} new message${newMessages > 1 ? "s" : ""}!`,
        {
          duration: 5000,
          description: "You have new messages that need review",
          icon: <Mail size={20} className="text-blue-600" />,
        },
      );

      // Optional: Play a sound (you can add an audio element if desired)
      // const audio = new Audio('/notification-sound.mp3');
      // audio.play().catch(err => console.log('Audio play failed:', err));

      // Optional: Browser notification (requires permission)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("New Message", {
          body: `You have ${newMessages} new message${newMessages > 1 ? "s" : ""} that need${newMessages > 1 ? "" : "s"} review`,
          icon: "/favicon.ico",
          tag: "new-messages",
        });
      }
    }

    // Update the ref for next comparison
    prevUnreadCountRef.current = totalUnread;
  }, [totalUnread]);

  // ✨ NEW: Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission:", permission);
      });
    }
  }, []);

  // Fetch thread details when selected
  const { data: threadData } = useQuery({
    queryKey: [
      "sms-thread",
      selectedThread?.conversation_id || selectedThread?.phone,
    ],
    queryFn: async () => {
      // Prefer conversation_id for group conversations, fallback to phone
      const params = selectedThread.conversation_id
        ? `conversation_id=${encodeURIComponent(selectedThread.conversation_id)}`
        : `phone=${encodeURIComponent(selectedThread.phone)}`;

      const res = await fetch(`/api/sms/messages/thread?${params}`);
      if (!res.ok) throw new Error("Failed to load thread");
      return res.json();
    },
    enabled: !!selectedThread,
  });

  const threadMessages = threadData?.messages || [];

  // Fetch clients for passenger lookup
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to load clients");
      return res.json();
    },
    enabled: showNewMessageModal,
  });

  // Fetch employees for driver lookup
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to load employees");
      return res.json();
    },
    enabled: showNewMessageModal,
  });

  // Filter passengers based on search
  const filteredPassengers =
    clients
      ?.filter((c) => {
        if (!passengerSearch) return true;
        const q = passengerSearch.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10) || [];

  // Filter drivers based on search
  const filteredDrivers =
    employees
      ?.filter((e) => {
        if (!driverSearch) return true;
        const q = driverSearch.toLowerCase();
        return (
          e.name?.toLowerCase().includes(q) ||
          e.phone?.includes(q) ||
          e.email?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10) || [];

  // Send reply mutation
  const replyMutation = useMutation({
    mutationFn: async ({ phone, message, messageId }) => {
      const res = await fetch("/api/sms/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message, messageId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send reply");
      }
      return res.json();
    },
    onSuccess: async () => {
      setReplyMessage("");

      // Wait a moment for database write to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Invalidate and refetch both conversations and thread
      await queryClient.invalidateQueries(["sms-conversations"]);
      await queryClient.invalidateQueries(["sms-conversations-unread"]); // sync with MainLayout
      await queryClient.invalidateQueries(["sms-thread"]);
      await queryClient.refetchQueries(["sms-conversations"]);
      await queryClient.refetchQueries(["sms-thread"]);

      toast.success("Reply sent!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send reply");
    },
  });

  // Mark as read mutation - now supports marking individual messages
  const markReadMutation = useMutation({
    mutationFn: async (messageId) => {
      const res = await fetch(`/api/sms/messages/${messageId}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sms-conversations"]);
      queryClient.invalidateQueries(["sms-conversations-unread"]); // sync with MainLayout
      queryClient.invalidateQueries(["sms-thread"]);
      toast.success("Marked as read");
    },
  });

  // Mark thread as unread — clears read_at on the last inbound message
  const markUnreadMutation = useMutation({
    mutationFn: async (messageId) => {
      const res = await fetch(`/api/sms/messages/${messageId}`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Failed to mark as unread");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sms-conversations"]);
      queryClient.invalidateQueries(["sms-conversations-unread"]); // sync with MainLayout
      queryClient.invalidateQueries(["sms-thread"]);
      toast.success("Marked as unread — will appear in dashboard alerts");
    },
    onError: () => {
      toast.error("Failed to mark as unread");
    },
  });

  // Delete message mutation
  const deleteMutation = useMutation({
    mutationFn: async (messageId) => {
      const res = await fetch(`/api/sms/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["sms-conversations"]);
      queryClient.invalidateQueries(["sms-conversations-unread"]); // sync with MainLayout
      queryClient.invalidateQueries(["sms-thread"]);
      toast.success("Message deleted");
    },
    onError: () => {
      toast.error("Failed to delete message");
    },
  });

  // Delete entire thread mutation
  const deleteThreadMutation = useMutation({
    mutationFn: async (phone) => {
      const res = await fetch(`/api/sms/messages/thread`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error("Failed to delete thread");
      return res.json();
    },
    onSuccess: () => {
      setSelectedThread(null);
      setShowDeleteThreadConfirm(false);
      queryClient.invalidateQueries(["sms-conversations"]);
      queryClient.invalidateQueries(["sms-conversations-unread"]); // sync with MainLayout
      queryClient.invalidateQueries(["sms-thread"]);
      toast.success("Thread deleted");
    },
    onError: () => {
      toast.error("Failed to delete thread");
    },
  });

  // Send follow-up mutation
  const followupMutation = useMutation({
    mutationFn: async (appointmentId) => {
      const res = await fetch("/api/followup/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointmentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send follow-up");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        data.smsSent && data.emailSent
          ? "Thank-you message sent via SMS and email!"
          : data.smsSent
            ? "Thank-you message sent via SMS!"
            : "Thank-you message sent via email!",
      );
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send follow-up");
    },
  });

  // Send new message mutation - updated to handle multiple recipients
  const newMessageMutation = useMutation({
    mutationFn: async ({ recipients, message }) => {
      // Send to all recipients in parallel
      const promises = recipients.map((phone) =>
        fetch("/api/sms/send-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message }),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to send to ${phone}`);
          return res.json();
        }),
      );

      const results = await Promise.allSettled(promises);
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length > 0) {
        throw new Error(`Failed to send to ${failed.length} recipient(s)`);
      }

      return { success: true, count: recipients.length };
    },
    onSuccess: async (data) => {
      setShowNewMessageModal(false);
      setNewMessageRecipients([]);
      setCurrentPhoneInput("");
      setNewMessageText("");

      await new Promise((resolve) => setTimeout(resolve, 500));
      await queryClient.invalidateQueries(["sms-conversations"]);
      await queryClient.refetchQueries(["sms-conversations"]);

      toast.success(`Message sent to ${data.count} recipient(s)!`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log("[Messages] Manual refresh triggered");
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSendReply = () => {
    if (!replyMessage.trim() || !selectedThread) return;

    // Find the last inbound message to mark as read
    const lastInbound = threadMessages
      .filter((m) => m.direction === "inbound")
      .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];

    replyMutation.mutate({
      phone: selectedThread.phone,
      message: replyMessage.trim(),
      messageId: lastInbound?.id,
    });
  };

  const handleMarkAllRead = () => {
    const unreadInThread = threadMessages.filter(
      (m) => m.direction === "inbound" && !m.read_at,
    );
    unreadInThread.forEach((msg) => markReadMutation.mutate(msg.id));
  };

  const handleAddPassenger = (passenger) => {
    if (!passenger.phone) {
      toast.error(`${passenger.name} has no phone number on file`);
      return;
    }

    if (newMessageRecipients.some((r) => r.phone === passenger.phone)) {
      toast.error("This passenger is already added");
      return;
    }

    setNewMessageRecipients([
      ...newMessageRecipients,
      { phone: passenger.phone, name: passenger.name, type: "passenger" },
    ]);
    setPassengerSearch("");
    setShowPassengerDropdown(false);
    toast.success(`Added ${passenger.name}`);
  };

  const handleAddDriver = (driver) => {
    if (!driver.phone) {
      toast.error(`${driver.name} has no phone number on file`);
      return;
    }

    if (newMessageRecipients.some((r) => r.phone === driver.phone)) {
      toast.error("This driver is already added");
      return;
    }

    setNewMessageRecipients([
      ...newMessageRecipients,
      { phone: driver.phone, name: driver.name, type: "driver" },
    ]);
    setDriverSearch("");
    setShowDriverDropdown(false);
    toast.success(`Added ${driver.name}`);
  };

  const handleAddRecipient = () => {
    const trimmed = currentPhoneInput.trim();
    if (!trimmed) return;

    // Check for duplicates
    if (newMessageRecipients.some((r) => r.phone === trimmed)) {
      toast.error("This number is already added");
      return;
    }

    setNewMessageRecipients([
      ...newMessageRecipients,
      { phone: trimmed, name: trimmed, type: "manual" },
    ]);
    setCurrentPhoneInput("");
  };

  const handleRemoveRecipient = (phone) => {
    setNewMessageRecipients(
      newMessageRecipients.filter((r) => r.phone !== phone),
    );
  };

  const handleSendNewMessage = () => {
    if (newMessageRecipients.length === 0 || !newMessageText.trim()) return;
    newMessageMutation.mutate({
      recipients: newMessageRecipients.map((r) => r.phone),
      message: newMessageText.trim(),
    });
  };

  const handleDeleteThread = () => {
    if (!selectedThread) return;
    deleteThreadMutation.mutate(selectedThread.phone);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Flashing red animation for urgent messages */}
      <style>{`
        @keyframes urgent-flash {
          0%, 100% {
            background-color: rgb(254 242 242);
            border-color: rgb(239 68 68);
          }
          50% {
            background-color: rgb(239 68 68);
            border-color: rgb(185 28 28);
          }
        }

        .urgent-message {
          animation: urgent-flash 1s ease-in-out infinite;
        }

        .urgent-message * {
          color: white !important;
        }

        .urgent-message .urgent-badge {
          background-color: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {/* Header - reduced bottom margin */}
      <div className="mb-3">
        {/* Back to Dashboard Link */}
        <div className="mb-3">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </a>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              Messages
            </h1>
            <p className="text-gray-500 mt-1">
              View and reply to SMS conversations with passengers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh conversations"
            >
              <RefreshCw
                size={16}
                className={isRefreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <Plus size={16} />
              New Message
            </button>
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showUnreadOnly
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter size={16} />
              {showUnreadOnly ? "Show All" : "Unread Only"}
            </button>
            {urgentUnreadCount > 0 && (
              <div className="px-3 py-1.5 bg-red-100 border border-red-300 rounded-full text-sm font-semibold text-red-700 inline-flex items-center gap-1.5">
                <AlertCircle size={16} />
                {urgentUnreadCount} urgent
              </div>
            )}
            {totalUnread > 0 && (
              <div className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-full text-sm font-semibold text-red-700">
                {totalUnread} unread
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex">
        {/* Conversations List - narrower when thread selected */}
        <div
          className={`${selectedThread ? "hidden md:flex" : "flex"} flex-col w-full ${selectedThread ? "md:w-56" : "md:w-64"} border-r border-gray-200`}
        >
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
              Conversations
            </h2>
            {/* Search Input */}
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search messages..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <X size={14} className="text-gray-400" />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-gray-500 mt-2">
                {filteredConversations.length} result
                {filteredConversations.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                {searchQuery ? (
                  <>
                    <p>No matches found</p>
                    <p className="text-xs mt-2">Try a different search term</p>
                  </>
                ) : (
                  <>
                    <p>No conversations yet</p>
                    <p className="text-xs mt-2">
                      {showUnreadOnly
                        ? "No unread messages"
                        : "Messages will appear here when passengers text you"}
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const isGroupConversation =
                  conversation.participants &&
                  conversation.participants.length > 1;
                const participantCount = conversation.participants?.length || 0;

                return (
                  <button
                    key={conversation.conversation_id || conversation.phone}
                    onClick={() => setSelectedThread(conversation)}
                    className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left ${
                      selectedThread?.phone === conversation.phone
                        ? "bg-blue-50"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-10 rounded-full ${isGroupConversation ? "bg-purple-100" : "bg-blue-100"} flex items-center justify-center`}
                        >
                          {isGroupConversation ? (
                            <Users size={20} className="text-purple-600" />
                          ) : (
                            <User size={20} className="text-blue-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {conversation.client_name}
                            </p>
                            {conversation.booking_number && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                #{conversation.booking_number}
                              </span>
                            )}
                          </div>
                          {isGroupConversation && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                {participantCount} people
                              </span>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            {conversation.phone}
                          </p>
                        </div>
                      </div>
                      {conversation.unread_count > 0 && (
                        <div className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                          {conversation.unread_count}
                        </div>
                      )}
                    </div>
                    {isGroupConversation && conversation.participants && (
                      <div className="text-xs text-gray-500 mb-1 flex flex-wrap gap-1">
                        {conversation.participants.map((p, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5"
                          >
                            <span
                              className={
                                p.type === "driver"
                                  ? "font-medium text-blue-600"
                                  : ""
                              }
                            >
                              {p.name}
                            </span>
                            {idx < conversation.participants.length - 1 && (
                              <span>,</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-600 line-clamp-2 mt-2">
                      {conversation.last_direction === "outbound" && "You: "}
                      {conversation.last_message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatCDT(conversation.last_sent_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread View */}
        {selectedThread ? (
          <div className="flex-1 flex flex-col">
            {/* Thread Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedThread(null)}
                  className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft size={20} />
                </button>
                <div
                  className={`w-10 h-10 rounded-full ${selectedThread.participants?.length > 1 ? "bg-purple-100" : "bg-blue-100"} flex items-center justify-center`}
                >
                  {selectedThread.participants?.length > 1 ? (
                    <Users size={20} className="text-purple-600" />
                  ) : (
                    <User size={20} className="text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedThread.client_name}
                  </p>
                  {selectedThread.participants?.length > 1 ? (
                    <div className="text-xs text-gray-500">
                      Group:{" "}
                      {selectedThread.participants
                        .map((p) => p.name)
                        .join(", ")}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Phone size={12} />
                      {selectedThread.phone}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {threadMessages.some(
                  (m) => m.direction === "inbound" && !m.read_at,
                ) && (
                  <button
                    onClick={handleMarkAllRead}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {/* Mark as Unread — re-flags the last inbound message so dashboard shows alert */}
                {threadMessages.some(
                  (m) => m.direction === "inbound" && m.read_at,
                ) && (
                  <button
                    onClick={() => {
                      const lastRead = threadMessages
                        .filter((m) => m.direction === "inbound" && m.read_at)
                        .sort(
                          (a, b) => new Date(b.sent_at) - new Date(a.sent_at),
                        )[0];
                      if (lastRead) markUnreadMutation.mutate(lastRead.id);
                    }}
                    disabled={markUnreadMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                    title="Mark as unread — triggers dashboard alert"
                  >
                    <EyeOff size={13} />
                    Mark Unread
                  </button>
                )}
                <button
                  onClick={() => {
                    const appointmentId =
                      selectedThread.appointment_id ||
                      threadMessages.find((msg) => msg.appointment_id)
                        ?.appointment_id;
                    if (appointmentId) {
                      followupMutation.mutate(appointmentId);
                    } else {
                      toast.error("No trip found for this conversation");
                    }
                  }}
                  disabled={
                    followupMutation.isPending ||
                    (!selectedThread.appointment_id &&
                      !threadMessages.some((msg) => msg.appointment_id))
                  }
                  className="px-3 py-1.5 text-xs font-medium text-pink-600 hover:bg-pink-50 rounded-lg transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send thank-you message with Google review link"
                >
                  <Heart size={14} />
                  {followupMutation.isPending ? "Sending..." : "Send Thank You"}
                </button>
                <button
                  onClick={() => setShowDeleteThreadConfirm(true)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-1"
                  title="Delete entire conversation"
                >
                  <Trash2 size={14} />
                  Delete Thread
                </button>
              </div>
            </div>

            {/* Messages - more vertical space */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {threadMessages.map((msg) => {
                // Parse metadata to show sender info for group conversations
                const metadata =
                  msg.metadata && typeof msg.metadata === "string"
                    ? JSON.parse(msg.metadata)
                    : msg.metadata || {};
                const senderType = metadata.sender_type;
                const isFromDriver = senderType === "driver";
                const isFromPassenger = senderType === "passenger";
                const isUrgent = msg.is_urgent;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-md ${msg.direction === "outbound" ? "bg-blue-600 text-white" : isUrgent ? "urgent-message bg-red-50 border-2 border-red-500 text-gray-900" : "bg-white border border-gray-200 text-gray-900"} rounded-2xl px-4 py-3 shadow-sm`}
                    >
                      {/* Show urgent badge for urgent messages */}
                      {isUrgent && msg.direction === "inbound" && (
                        <div className="urgent-badge flex items-center gap-2 mb-2 pb-2 border-b-2 border-red-300">
                          <AlertCircle size={16} className="text-red-600" />
                          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                            URGENT MESSAGE
                          </span>
                        </div>
                      )}

                      {/* Show sender name for inbound messages in group conversations */}
                      {msg.direction === "inbound" &&
                        selectedThread.participants?.length > 1 && (
                          <div className="flex items-center gap-1 mb-1">
                            <span
                              className={`text-xs font-semibold ${isFromDriver ? "text-blue-600" : "text-purple-600"}`}
                            >
                              {msg.sender_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({isFromDriver ? "Driver" : "Passenger"})
                            </span>
                          </div>
                        )}
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      <div
                        className={`flex items-center gap-2 mt-2 text-xs ${msg.direction === "outbound" ? "text-blue-100" : "text-gray-500"}`}
                      >
                        <Clock size={12} />
                        {formatCDT(msg.sent_at)}
                        {msg.direction === "inbound" && (
                          <>
                            {msg.read_at ? (
                              <>
                                <CheckCheck
                                  size={12}
                                  className="text-green-600"
                                />
                                <span className="text-green-600 font-medium">
                                  Read
                                </span>
                              </>
                            ) : (
                              <span className="text-orange-600 font-medium">
                                Unread
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {msg.booking_number && (
                        <div
                          className={`flex items-center gap-1 mt-2 text-xs ${msg.direction === "outbound" ? "text-blue-100" : "text-gray-500"}`}
                        >
                          <Calendar size={12} />#{msg.booking_number}
                        </div>
                      )}
                      {msg.direction === "inbound" && (
                        <div className="flex items-center gap-2 mt-2">
                          {!msg.read_at && (
                            <button
                              onClick={() => markReadMutation.mutate(msg.id)}
                              disabled={markReadMutation.isPending}
                              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 font-medium disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} />
                              Mark as Read
                            </button>
                          )}
                          <button
                            onClick={() => deleteMutation.mutate(msg.id)}
                            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {selectedThread.participants?.length > 1 && (
                <div className="mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                  <Users size={14} className="inline mr-1" />
                  Your reply will be sent to all{" "}
                  {selectedThread.participants.length} participants
                </div>
              )}
              <div className="flex gap-3">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={replyMutation.isPending || !replyMessage.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Send size={16} />
                  {replyMutation.isPending ? "Sending..." : "Send"}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Press Enter to send
                {selectedThread.participants?.length > 1
                  ? " to all participants"
                  : ""}{" "}
                • No footer added to replies
              </p>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation to view and reply</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Thread Confirmation Modal */}
      {showDeleteThreadConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Trash2 size={20} className="text-red-600" />
                Delete Thread?
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                This will permanently delete all messages in this conversation
                with <strong>{selectedThread?.client_name}</strong> (
                {selectedThread?.phone}).
              </p>
              <p className="text-sm text-red-600 font-medium mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteThreadConfirm(false)}
                disabled={deleteThreadMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                disabled={deleteThreadMutation.isPending}
                className="px-6 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteThreadMutation.isPending ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Thread
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Message Modal - Updated UI */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MessageSquare size={18} className="text-green-600" />
                  New Message
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Send to one or multiple recipients
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setNewMessageRecipients([]);
                  setCurrentPhoneInput("");
                  setNewMessageText("");
                  setPassengerSearch("");
                  setDriverSearch("");
                  setShowPassengerDropdown(false);
                  setShowDriverDropdown(false);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Quick Add Section */}
              <div className="grid grid-cols-2 gap-3">
                {/* Passenger Lookup */}
                <div className="relative">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Add Passenger
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search passengers..."
                      className="w-full px-3 py-2 pl-9 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      value={passengerSearch}
                      onChange={(e) => {
                        setPassengerSearch(e.target.value);
                        setShowPassengerDropdown(true);
                      }}
                      onFocus={() => setShowPassengerDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowPassengerDropdown(false), 200)
                      }
                    />
                    <User
                      size={16}
                      className="absolute left-2.5 top-2.5 text-gray-400"
                    />
                  </div>

                  {/* Passenger Dropdown */}
                  {showPassengerDropdown &&
                    passengerSearch &&
                    filteredPassengers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredPassengers.map((passenger) => (
                          <button
                            key={passenger.id}
                            type="button"
                            onClick={() => handleAddPassenger(passenger)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <p className="text-sm font-semibold text-gray-900">
                              {passenger.name}
                            </p>
                            {passenger.phone && (
                              <p className="text-xs text-gray-500">
                                {passenger.phone}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                </div>

                {/* Driver Lookup */}
                <div className="relative">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Add Driver
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search drivers..."
                      className="w-full px-3 py-2 pl-9 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      value={driverSearch}
                      onChange={(e) => {
                        setDriverSearch(e.target.value);
                        setShowDriverDropdown(true);
                      }}
                      onFocus={() => setShowDriverDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowDriverDropdown(false), 200)
                      }
                    />
                    <User
                      size={16}
                      className="absolute left-2.5 top-2.5 text-gray-400"
                    />
                  </div>

                  {/* Driver Dropdown */}
                  {showDriverDropdown &&
                    driverSearch &&
                    filteredDrivers.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredDrivers.map((driver) => (
                          <button
                            key={driver.id}
                            type="button"
                            onClick={() => handleAddDriver(driver)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <p className="text-sm font-semibold text-gray-900">
                              {driver.name}
                            </p>
                            {driver.phone && (
                              <p className="text-xs text-gray-500">
                                {driver.phone}
                              </p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Recipients Section */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Recipients{" "}
                  {newMessageRecipients.length > 0 &&
                    `(${newMessageRecipients.length})`}
                </label>

                {/* Recipient chips */}
                {newMessageRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {newMessageRecipients.map((recipient, idx) => (
                      <div
                        key={idx}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          recipient.type === "driver"
                            ? "bg-blue-100 text-blue-700"
                            : recipient.type === "passenger"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {recipient.type === "driver" ? (
                          <User size={12} />
                        ) : recipient.type === "passenger" ? (
                          <User size={12} />
                        ) : (
                          <Phone size={12} />
                        )}
                        <span className="font-semibold">{recipient.name}</span>
                        {recipient.type !== "manual" && (
                          <span className="text-xs opacity-75">
                            ({recipient.type})
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveRecipient(recipient.phone)}
                          className="hover:bg-white/50 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual phone input */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Or Add Phone Manually
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-600 focus:outline-none"
                      placeholder="+1 (555) 123-4567"
                      value={currentPhoneInput}
                      onChange={(e) => setCurrentPhoneInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                    />
                    <button
                      onClick={handleAddRecipient}
                      disabled={!currentPhoneInput.trim()}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Press Enter or click Add to add recipient
                  </p>
                </div>
              </div>

              {/* Message Section */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Message
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-600 focus:outline-none resize-none"
                  placeholder="Type your message here..."
                  rows={4}
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  maxLength={1600}
                />
                <p className="text-xs text-gray-400 mt-1">
                  {newMessageText.length}/1600 characters
                </p>
              </div>

              {newMessageRecipients.length > 1 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5 text-xs text-purple-700 flex items-center gap-1">
                  <Users size={14} />
                  <strong>Group message:</strong> Will be sent to{" "}
                  {newMessageRecipients.length} recipients
                </div>
              )}

              {/* Removed opt-out footer notice - these are conversational messages */}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 sticky bottom-0">
              <button
                onClick={() => {
                  setShowNewMessageModal(false);
                  setNewMessageRecipients([]);
                  setCurrentPhoneInput("");
                  setNewMessageText("");
                  setPassengerSearch("");
                  setDriverSearch("");
                  setShowPassengerDropdown(false);
                  setShowDriverDropdown(false);
                }}
                disabled={newMessageMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNewMessage}
                disabled={
                  newMessageMutation.isPending ||
                  newMessageRecipients.length === 0 ||
                  !newMessageText.trim()
                }
                className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {newMessageMutation.isPending ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send size={14} />
                    Send to {newMessageRecipients.length || 0}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
