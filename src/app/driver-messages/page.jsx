"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Phone,
  Users,
  Clock,
  CheckCheck,
  RefreshCw,
  ChevronDown,
  Radio,
  Plus,
  X,
  User,
  Settings,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/utils/notify";

// Format a UTC timestamp in Central time (CDT/CST) with the timezone label
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
  // Extract the short tz label (CDT or CST)
  const tzLabel = d
    .toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      timeZoneName: "short",
    })
    .split(" ")
    .pop();
  return `${datePart} ${timePart} ${tzLabel}`;
}

export default function DriverMessagesPage() {
  const queryClient = useQueryClient();
  const [selectedDriver, setSelectedDriver] = useState(null); // null = none selected, can be group or individual
  const [messageText, setMessageText] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [selectedDriversForGroup, setSelectedDriversForGroup] = useState([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const messagesEndRef = useRef(null);
  const dropdownRef = useRef(null);

  // Group management states
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDeleteGroupConfirm, setShowDeleteGroupConfirm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editGroupDrivers, setEditGroupDrivers] = useState([]);
  const [editGroupSearchTerm, setEditGroupSearchTerm] = useState("");

  // Cleanup state
  const [cleanupStatus, setCleanupStatus] = useState(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedDriver]);

  // Fetch driver conversations (now includes group conversations)
  const {
    data: convoData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["driver-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/sms/driver-messages");
      if (!res.ok) throw new Error("Failed to load driver conversations");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const conversations = convoData?.conversations || [];
  const employees = convoData?.employees || [];
  const groupConversations = convoData?.group_conversations || [];

  // Fetch thread for selected driver or group
  const { data: threadData, refetch: refetchThread } = useQuery({
    queryKey: [
      "sms-thread",
      selectedDriver?.conversation_id || selectedDriver?.phone,
    ],
    queryFn: async () => {
      // For group conversations, use conversation_id
      if (selectedDriver?.conversation_id) {
        const res = await fetch(
          `/api/sms/messages/thread?conversation_id=${encodeURIComponent(selectedDriver.conversation_id)}`,
        );
        if (!res.ok) throw new Error("Failed to load thread");
        return res.json();
      }
      // For individual drivers, use phone
      const res = await fetch(
        `/api/sms/messages/thread?phone=${encodeURIComponent(selectedDriver.phone)}`,
      );
      if (!res.ok) throw new Error("Failed to load thread");
      return res.json();
    },
    enabled: !!(selectedDriver?.phone || selectedDriver?.conversation_id),
    refetchInterval: false, // Disabled — was polling every 15s
  });

  const threadMessages = threadData?.messages || [];

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messagesEndRef.current && threadMessages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadMessages.length]);

  // Create group conversation mutation
  const createGroupMutation = useMutation({
    mutationFn: async ({ employee_ids }) => {
      const res = await fetch("/api/sms/driver-messages/create-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create group");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      setShowNewGroupModal(false);
      setSelectedDriversForGroup([]);
      setGroupSearchTerm("");
      await queryClient.invalidateQueries(["driver-conversations"]);
      await queryClient.refetchQueries(["driver-conversations"]);

      // Select the newly created group
      setSelectedDriver({
        conversation_id: data.conversation_id,
        name: data.name,
        participants: data.participants,
        is_group: true,
      });

      toast.success("Group conversation created!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create group");
    },
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({
      conversation_id,
      add_employee_ids,
      remove_employee_ids,
    }) => {
      const res = await fetch(
        `/api/sms/driver-messages/groups/${conversation_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ add_employee_ids, remove_employee_ids }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update group");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      setShowEditGroupModal(false);
      setEditingGroup(null);
      setEditGroupDrivers([]);
      setEditGroupSearchTerm("");
      await queryClient.invalidateQueries(["driver-conversations"]);
      await queryClient.refetchQueries(["driver-conversations"]);

      // Update selected driver if it's the group we just edited
      if (selectedDriver?.conversation_id === data.conversation_id) {
        setSelectedDriver({
          conversation_id: data.conversation_id,
          name: data.name,
          participants: data.participants,
          is_group: true,
        });
      }

      toast.success("Group updated!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update group");
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (conversation_id) => {
      const res = await fetch(
        `/api/sms/driver-messages/groups/${conversation_id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete group");
      }
      return res.json();
    },
    onSuccess: async () => {
      setShowDeleteGroupConfirm(false);
      setSelectedDriver(null);
      await queryClient.invalidateQueries(["driver-conversations"]);
      await queryClient.refetchQueries(["driver-conversations"]);
      toast.success("Group deleted!");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete group");
    },
  });

  // Send message mutation (updated for groups)
  const sendMutation = useMutation({
    mutationFn: async ({ employee_id, message, conversation_id }) => {
      const res = await fetch("/api/sms/driver-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id, message, conversation_id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: async (data, variables) => {
      setMessageText("");
      await new Promise((r) => setTimeout(r, 400));
      await queryClient.invalidateQueries(["driver-conversations"]);
      await queryClient.invalidateQueries(["sms-thread"]);
      await queryClient.refetchQueries(["driver-conversations"]);
      if (selectedDriver?.phone || selectedDriver?.conversation_id) {
        await queryClient.refetchQueries([
          "sms-thread",
          selectedDriver.conversation_id || selectedDriver.phone,
        ]);
      }

      const failed = data.results?.filter((r) => !r.success) || [];
      if (failed.length > 0) {
        toast.warning(
          `Sent but failed for: ${failed.map((f) => f.employee).join(", ")}`,
        );
      } else {
        if (variables.conversation_id) {
          toast.success(`Message sent to group!`);
        } else {
          toast.success(
            variables.employee_id === "all"
              ? `Message sent to all ${data.results?.length} drivers!`
              : "Message sent!",
          );
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message", {
        duration: 10000,
      });
    },
  });

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (messageId) => {
      const res = await fetch(`/api/sms/messages/${messageId}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["driver-conversations"]);
      queryClient.invalidateQueries(["sms-thread"]);
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    if (selectedDriver?.phone || selectedDriver?.conversation_id)
      await refetchThread();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCleanupOrphaned = async () => {
    if (
      !confirm(
        "This will remove any conversation participants linked to deleted drivers. Continue?",
      )
    ) {
      return;
    }

    setCleanupStatus("cleaning...");
    try {
      const response = await fetch("/api/sms/cleanup-orphaned-participants", {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        setCleanupStatus(`✓ ${data.message}`);
        // Refresh the conversations list
        await refetch();
        setTimeout(() => setCleanupStatus(null), 5000);
      } else {
        setCleanupStatus(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
      setCleanupStatus(`Error: ${error.message}`);
    }
  };

  const handleSend = () => {
    if (!messageText.trim()) return;
    if (!selectedDriver) {
      toast.error("Please select a driver or group first");
      return;
    }

    if (selectedDriver.is_group) {
      sendMutation.mutate({
        conversation_id: selectedDriver.conversation_id,
        message: messageText.trim(),
      });
    } else {
      sendMutation.mutate({
        employee_id: selectedDriver.id,
        message: messageText.trim(),
      });
    }
  };

  const handleMarkAllRead = () => {
    const unread = threadMessages.filter(
      (m) => m.direction === "inbound" && !m.read_at,
    );
    unread.forEach((msg) => markReadMutation.mutate(msg.id));
  };

  const handleCreateGroup = () => {
    if (selectedDriversForGroup.length < 2) {
      toast.error("Select at least 2 drivers for a group");
      return;
    }
    createGroupMutation.mutate({
      employee_ids: selectedDriversForGroup.map((d) => d.id),
    });
  };

  const handleToggleDriverForGroup = (driver) => {
    const isSelected = selectedDriversForGroup.some((d) => d.id === driver.id);
    if (isSelected) {
      setSelectedDriversForGroup(
        selectedDriversForGroup.filter((d) => d.id !== driver.id),
      );
    } else {
      setSelectedDriversForGroup([...selectedDriversForGroup, driver]);
    }
  };

  const handleOpenEditGroup = () => {
    if (!selectedDriver?.is_group) return;
    setEditingGroup(selectedDriver);
    setEditGroupDrivers(selectedDriver.participants || []);
    setShowEditGroupModal(true);
  };

  const handleToggleDriverForEdit = (driver) => {
    const isSelected = editGroupDrivers.some((d) => d.id === driver.id);
    if (isSelected) {
      setEditGroupDrivers(editGroupDrivers.filter((d) => d.id !== driver.id));
    } else {
      setEditGroupDrivers([...editGroupDrivers, driver]);
    }
  };

  const handleSaveGroupChanges = () => {
    if (!editingGroup) return;

    const originalIds = (editingGroup.participants || []).map((p) => p.id);
    const newIds = editGroupDrivers.map((d) => d.id);

    const add_employee_ids = newIds.filter((id) => !originalIds.includes(id));
    const remove_employee_ids = originalIds.filter(
      (id) => !newIds.includes(id),
    );

    if (add_employee_ids.length === 0 && remove_employee_ids.length === 0) {
      toast.info("No changes to save");
      setShowEditGroupModal(false);
      return;
    }

    if (editGroupDrivers.length < 2) {
      toast.error("A group must have at least 2 drivers");
      return;
    }

    updateGroupMutation.mutate({
      conversation_id: editingGroup.conversation_id,
      add_employee_ids,
      remove_employee_ids,
    });
  };

  const handleDeleteGroup = () => {
    if (!selectedDriver?.conversation_id) return;
    deleteGroupMutation.mutate(selectedDriver.conversation_id);
  };

  const filteredEmployeesForGroup = employees.filter((e) => {
    if (!groupSearchTerm) return true;
    const q = groupSearchTerm.toLowerCase();
    return e.name?.toLowerCase().includes(q) || e.phone?.includes(q);
  });

  const filteredEmployeesForEdit = employees.filter((e) => {
    if (!editGroupSearchTerm) return true;
    const q = editGroupSearchTerm.toLowerCase();
    return e.name?.toLowerCase().includes(q) || e.phone?.includes(q);
  });

  const totalUnread =
    conversations.reduce((sum, c) => sum + Number(c.unread_count), 0) +
    groupConversations.reduce((sum, c) => sum + Number(c.unread_count), 0);

  // Find selected driver's conversation info
  const selectedConvo =
    conversations.find((c) => c.employee_id === selectedDriver?.id) ||
    groupConversations.find(
      (c) => c.conversation_id === selectedDriver?.conversation_id,
    );

  const dropdownLabel = selectedDriver
    ? selectedDriver.id === "all"
      ? "📢 All Drivers"
      : selectedDriver.is_group
        ? `👥 ${selectedDriver.name}`
        : selectedDriver.name
    : "Select a driver...";

  const allDriversOption = { id: "all", name: "All Drivers", phone: null };
  const dropdownOptions = [
    allDriversOption,
    ...groupConversations.map((g) => ({
      ...g,
      is_group: true,
      name: g.name || g.participants?.map((p) => p.name).join(", "),
    })),
    ...employees,
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Loading driver conversations...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Back to Dashboard */}
      <div className="mb-2">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </a>
      </div>

      {/* Compact Header */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Driver Messages
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {cleanupStatus && (
            <span
              style={{
                fontSize: "14px",
                color: cleanupStatus.startsWith("✓") ? "#059669" : "#dc2626",
                fontWeight: "500",
              }}
            >
              {cleanupStatus}
            </span>
          )}
          <button
            onClick={handleCleanupOrphaned}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            🧹 Cleanup Orphaned
          </button>
          <button
            onClick={() => setShowNewGroupModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <Users size={16} />
            New Group
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>
          {totalUnread > 0 && (
            <div className="px-3 py-1.5 bg-red-50 border border-red-100 rounded-full text-sm font-semibold text-red-700">
              {totalUnread} unread
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-0">
        {/* Driver/Group selector bar */}
        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">To:</span>
          </div>

          {/* Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors min-w-[200px] justify-between"
            >
              <span className="flex items-center gap-2">
                {selectedDriver?.id === "all" ? (
                  <Radio size={14} className="text-purple-600" />
                ) : selectedDriver?.is_group ? (
                  <Users size={14} className="text-purple-600" />
                ) : selectedDriver ? (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: selectedDriver.color || "#2563EB",
                    }}
                  />
                ) : (
                  <Users size={14} className="text-gray-400" />
                )}
                {dropdownLabel}
              </span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                {dropdownOptions.map((opt) => {
                  const isGroup = opt.is_group;
                  const participantCount = opt.participants?.length || 0;

                  return (
                    <button
                      key={opt.conversation_id || opt.id}
                      onClick={() => {
                        if (opt.id === "all") {
                          setSelectedDriver({
                            id: "all",
                            name: "All Drivers",
                            phone: null,
                          });
                        } else if (isGroup) {
                          setSelectedDriver(opt);
                        } else {
                          const e164 = opt.phone
                            ? (() => {
                                const digits = opt.phone.replace(/\D/g, "");
                                if (digits.length === 10) return `+1${digits}`;
                                if (
                                  digits.length === 11 &&
                                  digits.startsWith("1")
                                )
                                  return `+${digits}`;
                                return `+${digits}`;
                              })()
                            : null;
                          setSelectedDriver({ ...opt, phone: e164 });
                        }
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0 ${
                        (
                          selectedDriver?.conversation_id &&
                            selectedDriver.conversation_id ===
                              opt.conversation_id
                        ) || (selectedDriver?.id === opt.id)
                          ? "bg-blue-50"
                          : ""
                      }`}
                    >
                      {opt.id === "all" ? (
                        <Radio size={16} className="text-purple-600 shrink-0" />
                      ) : isGroup ? (
                        <Users size={16} className="text-purple-600 shrink-0" />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: opt.color || "#2563EB" }}
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {opt.id === "all"
                            ? "📢 All Drivers"
                            : isGroup
                              ? `👥 ${opt.name}`
                              : opt.name}
                        </p>
                        {isGroup && (
                          <p className="text-xs text-gray-500">
                            {participantCount} drivers:{" "}
                            {opt.participants?.map((p) => p.name).join(", ")}
                          </p>
                        )}
                        {!isGroup && opt.id !== "all" && opt.phone && (
                          <p className="text-xs text-gray-400">{opt.phone}</p>
                        )}
                        {!isGroup && opt.id !== "all" && !opt.phone && (
                          <p className="text-xs text-red-400">
                            No phone number
                          </p>
                        )}
                      </div>
                      {/* Unread badge */}
                      {opt.unread_count > 0 && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                          {opt.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedDriver?.is_group && (
            <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
              <Users size={12} />
              {selectedDriver.participants?.length || 0} drivers in group
            </div>
          )}

          {selectedDriver?.is_group && (
            <button
              onClick={handleOpenEditGroup}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Manage group"
            >
              <Settings size={16} />
            </button>
          )}

          {selectedDriver &&
            selectedDriver.id !== "all" &&
            !selectedDriver.is_group &&
            selectedDriver.phone && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Phone size={12} />
                {selectedDriver.phone}
              </div>
            )}

          {selectedDriver?.id !== "all" && selectedConvo?.unread_count > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="ml-auto px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Thread or empty state */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 min-h-0">
          {!selectedDriver ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
              <MessageSquare size={64} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">
                Select a driver or group to start messaging
              </p>
              <p className="text-sm mt-1">
                Use the dropdown above or create a new group
              </p>
            </div>
          ) : selectedDriver.id === "all" ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
              <Radio size={64} className="mb-4 text-purple-400 opacity-50" />
              <p className="text-lg font-medium text-gray-600">
                Broadcast to All Drivers
              </p>
              <p className="text-sm mt-1 text-center max-w-sm">
                Your message will be sent to all {employees.length} active
                drivers with phone numbers. Type your message below and hit
                Send.
              </p>
            </div>
          ) : selectedDriver.is_group && threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
              <Users size={48} className="mb-4 opacity-20 text-purple-600" />
              <p className="text-lg font-medium">New group conversation</p>
              <p className="text-sm mt-1 text-center">
                Send your first message to this group of{" "}
                {selectedDriver.participants?.length} drivers
              </p>
            </div>
          ) : !selectedDriver.phone && !selectedDriver.is_group ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
              <Phone size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No phone number on file</p>
              <p className="text-sm mt-1">
                Add a phone number to this driver in the Drivers section.
              </p>
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-6">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm mt-1">
                Send your first message to {selectedDriver.name} below.
              </p>
            </div>
          ) : (
            <>
              {threadMessages.map((msg) => {
                // Parse metadata to show sender info for group conversations
                const metadata =
                  msg.metadata && typeof msg.metadata === "string"
                    ? JSON.parse(msg.metadata)
                    : msg.metadata || {};
                const isFromDriver = metadata.type === "driver";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-3xl ${
                        msg.direction === "outbound"
                          ? "bg-green-600 text-white"
                          : "bg-white border border-gray-200 text-gray-900"
                      } rounded-2xl px-5 py-4 shadow-sm`}
                    >
                      {/* Show sender name for inbound messages in group conversations */}
                      {msg.direction === "inbound" &&
                        selectedDriver?.is_group && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-xs font-semibold text-blue-600">
                              {msg.sender_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              (Driver)
                            </span>
                          </div>
                        )}
                      <p className="text-base leading-relaxed whitespace-pre-wrap">
                        {msg.message}
                      </p>
                      <div
                        className={`flex items-center gap-2 mt-3 text-xs ${
                          msg.direction === "outbound"
                            ? "text-green-100"
                            : "text-gray-500"
                        }`}
                      >
                        <Clock size={12} />
                        {formatCDT(msg.sent_at)}
                        {msg.direction === "inbound" && msg.read_at && (
                          <>
                            <CheckCheck size={12} className="text-green-400" />
                            <span>Read</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message input */}
        <div className="p-4 border-t border-gray-200 bg-white shrink-0">
          {selectedDriver?.id === "all" && (
            <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 flex items-center gap-2">
              <Radio size={14} />
              <span>
                This message will be sent to{" "}
                <strong>all {employees.length} active drivers</strong> with
                phone numbers.
              </span>
            </div>
          )}
          {selectedDriver?.is_group && (
            <div className="mb-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700 flex items-center gap-2">
              <Users size={14} />
              <span>
                Your reply will be sent to all{" "}
                <strong>{selectedDriver.participants?.length} drivers</strong>{" "}
                in this group
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-600 focus:outline-none resize-none"
              placeholder={
                !selectedDriver
                  ? "Select a driver or group above to start typing..."
                  : selectedDriver.id === "all"
                    ? "Type a broadcast message to all drivers..."
                    : selectedDriver.is_group
                      ? `Message group: ${selectedDriver.name}...`
                      : `Message ${selectedDriver.name}...`
              }
              rows={3}
              value={messageText}
              disabled={!selectedDriver}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              maxLength={1600}
            />
            <button
              onClick={handleSend}
              disabled={
                sendMutation.isPending || !messageText.trim() || !selectedDriver
              }
              className="px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2 self-end"
            >
              <Send size={16} />
              {sendMutation.isPending
                ? "Sending..."
                : selectedDriver?.id === "all"
                  ? "Send All"
                  : selectedDriver?.is_group
                    ? "Send Group"
                    : "Send"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Enter to send · Shift+Enter for new line ·{" "}
            {messageText.length}/1600 characters
          </p>
        </div>
      </div>

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Users size={18} className="text-purple-600" />
                  Create Group Conversation
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select drivers to include in this group
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setSelectedDriversForGroup([]);
                  setGroupSearchTerm("");
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Search Drivers
                </label>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  value={groupSearchTerm}
                  onChange={(e) => setGroupSearchTerm(e.target.value)}
                />
              </div>

              {/* Selected drivers chips */}
              {selectedDriversForGroup.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Selected ({selectedDriversForGroup.length})
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    {selectedDriversForGroup.map((driver) => (
                      <div
                        key={driver.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                      >
                        <User size={12} />
                        <span className="font-semibold">{driver.name}</span>
                        <button
                          onClick={() => handleToggleDriverForGroup(driver)}
                          className="hover:bg-purple-200 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Driver list */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Available Drivers
                </label>
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {filteredEmployeesForGroup.map((driver) => {
                    const isSelected = selectedDriversForGroup.some(
                      (d) => d.id === driver.id,
                    );
                    return (
                      <button
                        key={driver.id}
                        onClick={() => handleToggleDriverForGroup(driver)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0 ${
                          isSelected ? "bg-purple-50" : ""
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: driver.color || "#2563EB" }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {driver.name}
                          </p>
                          {driver.phone && (
                            <p className="text-xs text-gray-500">
                              {driver.phone}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <CheckCheck size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2 sticky bottom-0">
              <button
                onClick={() => {
                  setShowNewGroupModal(false);
                  setSelectedDriversForGroup([]);
                  setGroupSearchTerm("");
                }}
                disabled={createGroupMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={
                  createGroupMutation.isPending ||
                  selectedDriversForGroup.length < 2
                }
                className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {createGroupMutation.isPending ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Users size={14} />
                    Create Group ({selectedDriversForGroup.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditGroupModal && editingGroup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Settings size={18} className="text-purple-600" />
                  Manage Group
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add or remove drivers from this group
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEditGroupModal(false);
                  setEditingGroup(null);
                  setEditGroupDrivers([]);
                  setEditGroupSearchTerm("");
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Search Drivers
                </label>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  value={editGroupSearchTerm}
                  onChange={(e) => setEditGroupSearchTerm(e.target.value)}
                />
              </div>

              {/* Current drivers chips */}
              {editGroupDrivers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Current Drivers ({editGroupDrivers.length})
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    {editGroupDrivers.map((driver) => (
                      <div
                        key={driver.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                      >
                        <User size={12} />
                        <span className="font-semibold">{driver.name}</span>
                        <button
                          onClick={() => handleToggleDriverForEdit(driver)}
                          className="hover:bg-purple-200 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Driver list */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                  Available Drivers
                </label>
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {filteredEmployeesForEdit.map((driver) => {
                    const isSelected = editGroupDrivers.some(
                      (d) => d.id === driver.id,
                    );
                    return (
                      <button
                        key={driver.id}
                        onClick={() => handleToggleDriverForEdit(driver)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-100 last:border-0 ${
                          isSelected ? "bg-purple-50" : ""
                        }`}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: driver.color || "#2563EB" }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {driver.name}
                          </p>
                          {driver.phone && (
                            <p className="text-xs text-gray-500">
                              {driver.phone}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <CheckCheck size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between sticky bottom-0">
              <button
                onClick={() => setShowDeleteGroupConfirm(true)}
                disabled={
                  updateGroupMutation.isPending || deleteGroupMutation.isPending
                }
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
              >
                <Trash2 size={14} />
                Delete Group
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowEditGroupModal(false);
                    setEditingGroup(null);
                    setEditGroupDrivers([]);
                    setEditGroupSearchTerm("");
                  }}
                  disabled={updateGroupMutation.isPending}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroupChanges}
                  disabled={
                    updateGroupMutation.isPending || editGroupDrivers.length < 2
                  }
                  className="px-4 py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {updateGroupMutation.isPending ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <CheckCheck size={14} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirmation Modal */}
      {showDeleteGroupConfirm && selectedDriver?.is_group && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Trash2 size={20} className="text-red-600" />
                Delete Group?
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                This will permanently delete the group conversation{" "}
                <strong>{selectedDriver.name}</strong> and all its messages.
              </p>
              <p className="text-sm text-red-600 font-medium mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteGroupConfirm(false)}
                disabled={deleteGroupMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={deleteGroupMutation.isPending}
                className="px-6 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteGroupMutation.isPending ? (
                  <>Deleting...</>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Group
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
