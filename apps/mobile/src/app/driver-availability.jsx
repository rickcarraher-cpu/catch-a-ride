import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import useAuth from "@/utils/auth/useAuth";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CalendarX2,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  CalendarDays,
  XCircle,
  Repeat,
  PlayCircle,
  Pencil,
} from "lucide-react-native";

export default function DriverAvailabilityScreen() {
  const [driverInfo, setDriverInfo] = useState(null);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [recurringBlocks, setRecurringBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("one-time"); // "one-time" or "recurring"
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null); // Add editingBlock state
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, signOut: authSignOut } = useAuth();

  // Form state for one-time blocks
  const [form, setForm] = useState({
    start_date: "",
    start_time: "09:00",
    end_date: "",
    end_time: "17:00",
    all_day: true,
    reason: "",
    type: "blocked",
  });

  // Form state for recurring blocks
  const [recurringForm, setRecurringForm] = useState({
    start_time: "09:00",
    end_time: "17:00",
    frequency: "weekly",
    day_of_week: 1, // Monday
    reason: "",
    num_occurrences: 0,
    type: "blocked",
  });

  useEffect(() => {
    loadDriverInfo();
  }, []);

  const loadDriverInfo = async () => {
    try {
      if (!auth?.user) {
        router.replace("/login");
        return;
      }
      const driver = auth.user;
      setDriverInfo(driver);
      await fetchBlockedTimes(driver.id);
      await fetchRecurringBlocks(driver.id);
    } catch (error) {
      console.error("Error loading driver info:", error);
      router.replace("/login");
    }
  };

  const fetchBlockedTimes = async (driverId) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/blocked-times?employee_id=${driverId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch blocked times");
      const data = await response.json();
      setBlockedTimes(data || []);
    } catch (error) {
      console.error("Error fetching blocked times:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to load blocked times"
          : String(error);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecurringBlocks = async (driverId) => {
    try {
      const response = await fetch("/api/blocked-times/recurring");
      if (!response.ok) throw new Error("Failed to fetch recurring blocks");
      const data = await response.json();
      // Filter to only this driver's recurring blocks
      const filtered = data.filter((s) => s.employee_id === driverId);
      setRecurringBlocks(filtered || []);
    } catch (error) {
      console.error("Error fetching recurring blocks:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to load recurring series"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  const onRefresh = async () => {
    if (driverInfo) {
      setRefreshing(true);
      await fetchBlockedTimes(driverInfo.id);
      await fetchRecurringBlocks(driverInfo.id);
      setRefreshing(false);
    }
  };

  const handleAddBlockedTime = async () => {
    if (!form.start_date) {
      Alert.alert("Required", "Please select a start date");
      return;
    }

    try {
      const startISO = form.all_day
        ? `${form.start_date}T00:00:00`
        : `${form.start_date}T${form.start_time}:00`;
      const endDate = form.end_date || form.start_date;
      const endISO = form.all_day
        ? `${endDate}T23:59:59`
        : `${endDate}T${form.end_time}:00`;

      // Use PATCH for editing, POST for creating
      const url = editingBlock
        ? `/api/blocked-times/${editingBlock.id}`
        : "/api/blocked-times";
      const method = editingBlock ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: driverInfo.id,
          start_time: startISO,
          end_time: endISO,
          reason: form.reason || null,
          type: form.type,
        }),
      });

      if (!response.ok)
        throw new Error(
          `Failed to ${editingBlock ? "update" : "add"} blocked time`,
        );

      Alert.alert(
        "Success",
        `${form.type === "available" ? "Available hours" : "Blocked time"} ${editingBlock ? "updated" : "added"}`,
      );
      setShowAddModal(false);
      setEditingBlock(null);
      setForm({
        start_date: "",
        start_time: "09:00",
        end_date: "",
        end_time: "17:00",
        all_day: true,
        reason: "",
        type: "blocked",
      });
      await fetchBlockedTimes(driverInfo.id);
    } catch (error) {
      console.error("Error saving blocked time:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to save blocked time"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  const handleAddRecurringBlock = async () => {
    try {
      const payload = {
        employee_id: driverInfo.id,
        start_time: recurringForm.start_time,
        end_time: recurringForm.end_time,
        frequency: recurringForm.frequency,
        day_of_week:
          recurringForm.frequency === "weekly" ||
          recurringForm.frequency === "bi-weekly"
            ? Number(recurringForm.day_of_week)
            : null,
        reason: recurringForm.reason || null,
        num_occurrences: Number(recurringForm.num_occurrences) || 0,
        type: recurringForm.type,
      };

      const url = editingRecurring
        ? `/api/blocked-times/recurring/${editingRecurring.id}`
        : "/api/blocked-times/recurring";
      const method = editingRecurring ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok)
        throw new Error(
          `Failed to ${editingRecurring ? "update" : "create"} recurring series`,
        );

      Alert.alert(
        "Success",
        `Recurring series ${editingRecurring ? "updated" : "created"}`,
      );
      setShowRecurringModal(false);
      setEditingRecurring(null);
      setRecurringForm({
        start_time: "09:00",
        end_time: "17:00",
        frequency: "weekly",
        day_of_week: 1,
        reason: "",
        num_occurrences: 0,
        type: "blocked",
      });
      await fetchRecurringBlocks(driverInfo.id);
    } catch (error) {
      console.error("Error saving recurring block:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to save recurring series"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  const handleDeleteBlockedTime = async (id) => {
    try {
      const response = await fetch(`/api/blocked-times/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete blocked time");
      Alert.alert("Success", "Blocked time removed");
      await fetchBlockedTimes(driverInfo.id);
    } catch (error) {
      console.error("Error deleting blocked time:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to delete blocked time"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  const handleDeleteRecurring = async (id) => {
    try {
      const response = await fetch(`/api/blocked-times/recurring/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete recurring series");
      Alert.alert("Success", "Recurring series removed");
      await fetchRecurringBlocks(driverInfo.id);
    } catch (error) {
      console.error("Error deleting recurring:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to delete recurring series"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  const handleGenerateRecurring = async (seriesId = null) => {
    try {
      const response = await fetch("/api/blocked-times/recurring/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days_ahead: 30,
          recurring_id: seriesId,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate blocked times");
      const data = await response.json();

      Alert.alert(
        "Success",
        `Generated ${data.generated || 0} blocked time${data.generated !== 1 ? "s" : ""}`,
      );
      await fetchBlockedTimes(driverInfo.id);
    } catch (error) {
      console.error("Error generating:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to generate blocked times"
          : String(error);
      Alert.alert("Error", msg);
    }
  };

  // Add helper to open edit modal with pre-filled data
  const openEditModal = (bt) => {
    const startDate = new Date(bt.start_time);
    const endDate = new Date(bt.end_time);

    const pad = (n) => String(n).padStart(2, "0");

    // Format dates as YYYY-MM-DD
    const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

    const startHour = startDate.getHours();
    const startMin = startDate.getMinutes();
    const endHour = endDate.getHours();
    const endMin = endDate.getMinutes();

    const isAllDay =
      startHour === 0 && startMin === 0 && endHour === 23 && endMin === 59;

    setEditingBlock(bt);
    setForm({
      start_date: startDateStr,
      start_time: isAllDay ? "09:00" : `${pad(startHour)}:${pad(startMin)}`,
      end_date: endDateStr,
      end_time: isAllDay ? "17:00" : `${pad(endHour)}:${pad(endMin)}`,
      all_day: isAllDay,
      reason: bt.reason || "",
      type: bt.type || "blocked",
    });
    setShowAddModal(true);
  };

  const confirmDelete = (bt, dateLabel) => {
    Alert.alert("Remove Blocked Time", `Remove ${dateLabel}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => handleDeleteBlockedTime(bt.id),
      },
    ]);
  };

  const confirmDeleteRecurring = (series) => {
    const freq =
      {
        daily: "Daily",
        weekly: "Weekly",
        "bi-weekly": "Bi-Weekly",
        monthly: "Monthly",
      }[series.frequency] || series.frequency;
    Alert.alert("Delete Recurring Series", `Delete ${freq} series?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => handleDeleteRecurring(series.id),
      },
    ]);
  };

  // Separate blocked times into upcoming and past
  const { upcoming, past } = useMemo(() => {
    if (!blockedTimes) return { upcoming: [], past: [] };
    const now = new Date();
    const u = [];
    const p = [];
    blockedTimes.forEach((bt) => {
      const endDate = new Date(bt.end_time);
      if (endDate >= now) {
        u.push(bt);
      } else {
        p.push(bt);
      }
    });
    return { upcoming: u, past: p };
  }, [blockedTimes]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0F172A",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={{ color: "#94A3B8", marginTop: 16 }}>
          Loading availability...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 20,
          paddingBottom: 16,
          backgroundColor: "#1E293B",
          borderBottomWidth: 1,
          borderBottomColor: "#334155",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <ChevronLeft size={24} color="#94A3B8" />
            </TouchableOpacity>
            <View>
              <Text
                style={{ fontSize: 24, fontWeight: "bold", color: "#FFFFFF" }}
              >
                Manage Availability
              </Text>
              <Text style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>
                {driverInfo?.name || "Driver"}
              </Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", marginTop: 16, gap: 8 }}>
          <TouchableOpacity
            onPress={() => setActiveTab("one-time")}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor: activeTab === "one-time" ? "#EF4444" : "#334155",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#FFFFFF",
              }}
            >
              One-Time
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("recurring")}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              backgroundColor:
                activeTab === "recurring" ? "#EF4444" : "#334155",
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Repeat size={14} color="#FFFFFF" />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#FFFFFF",
              }}
            >
              Recurring
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#EF4444"
          />
        }
      >
        {activeTab === "one-time" ? (
          <>
            {/* Add Button */}
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              style={{
                backgroundColor: "#EF4444",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#FFFFFF",
                  marginLeft: 8,
                }}
              >
                Block Time Off
              </Text>
            </TouchableOpacity>

            {/* Upcoming Section */}
            <View
              style={{
                backgroundColor: "#1E293B",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <CalendarDays size={18} color="#94A3B8" />
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}
                >
                  Upcoming & Active ({upcoming.length})
                </Text>
              </View>

              {upcoming.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <CalendarX2 size={48} color="#334155" />
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      marginTop: 12,
                      textAlign: "center",
                    }}
                  >
                    No upcoming blocked times
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Tap "Block Time Off" above to add time off
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {upcoming.map((bt) => {
                    const startDate = new Date(bt.start_time);
                    const endDate = new Date(bt.end_time);
                    const sameDay =
                      startDate.toDateString() === endDate.toDateString();
                    const isAllDay =
                      startDate.getHours() === 0 &&
                      startDate.getMinutes() === 0 &&
                      endDate.getHours() === 23 &&
                      endDate.getMinutes() === 59;

                    const dateLabel = sameDay
                      ? startDate.toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : `${startDate.toLocaleDateString([], { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;

                    const timeLabel = isAllDay
                      ? "All day"
                      : `${startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

                    const now = new Date();
                    const isActive = startDate <= now && endDate >= now;

                    return (
                      <View
                        key={bt.id}
                        style={{
                          backgroundColor: isActive ? "#7F1D1D" : "#0F172A",
                          borderRadius: 10,
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: "#FFFFFF",
                              }}
                            >
                              {dateLabel}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "600",
                                color: isActive ? "#FCA5A5" : "#94A3B8",
                                backgroundColor: isActive
                                  ? "#991B1B"
                                  : "#1E293B",
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                              }}
                            >
                              {timeLabel}
                            </Text>
                            {isActive && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "700",
                                  color: "#FFFFFF",
                                  backgroundColor: "#EF4444",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                ACTIVE
                              </Text>
                            )}
                          </View>
                          {bt.reason && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#94A3B8",
                                marginTop: 4,
                              }}
                            >
                              {bt.reason}
                            </Text>
                          )}
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 4,
                            marginLeft: 12,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => openEditModal(bt)}
                            style={{
                              padding: 8,
                              backgroundColor: "#1E3A8A",
                              borderRadius: 8,
                            }}
                          >
                            <Pencil size={16} color="#60A5FA" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmDelete(bt, dateLabel)}
                            style={{
                              padding: 8,
                              backgroundColor: "#334155",
                              borderRadius: 8,
                            }}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Past Section */}
            {past.length > 0 && (
              <View
                style={{
                  backgroundColor: "#1E293B",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <Clock size={18} color="#64748B" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#64748B",
                    }}
                  >
                    Past ({past.length})
                  </Text>
                </View>
                <View style={{ gap: 8 }}>
                  {past.slice(0, 5).map((bt) => {
                    const startDate = new Date(bt.start_time);
                    const endDate = new Date(bt.end_time);
                    const sameDay =
                      startDate.toDateString() === endDate.toDateString();

                    const dateLabel = sameDay
                      ? startDate.toLocaleDateString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : `${startDate.toLocaleDateString([], { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString([], { month: "short", day: "numeric" })}`;

                    return (
                      <View
                        key={bt.id}
                        style={{
                          backgroundColor: "#0F172A",
                          borderRadius: 8,
                          padding: 10,
                          opacity: 0.6,
                        }}
                      >
                        <Text style={{ fontSize: 13, color: "#94A3B8" }}>
                          {dateLabel}
                        </Text>
                        {bt.reason && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#64748B",
                              marginTop: 2,
                            }}
                          >
                            {bt.reason}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
                {past.length > 5 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#64748B",
                      textAlign: "center",
                      marginTop: 12,
                    }}
                  >
                    Showing 5 of {past.length} past blocked times
                  </Text>
                )}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Recurring Tab Content */}
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                onPress={() => handleGenerateRecurring(null)}
                style={{
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlayCircle size={20} color="#FFFFFF" />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                    marginLeft: 8,
                  }}
                >
                  Generate All Series
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setEditingRecurring(null);
                  setRecurringForm({
                    start_time: "09:00",
                    end_time: "17:00",
                    frequency: "weekly",
                    day_of_week: 1,
                    reason: "",
                    num_occurrences: 0,
                  });
                  setShowRecurringModal(true);
                }}
                style={{
                  backgroundColor: "#EF4444",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={20} color="#FFFFFF" />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                    marginLeft: 8,
                  }}
                >
                  New Recurring Series
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recurring Series List */}
            <View
              style={{
                backgroundColor: "#1E293B",
                borderRadius: 12,
                padding: 20,
                marginTop: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#FFFFFF",
                  marginBottom: 16,
                }}
              >
                Recurring Series ({recurringBlocks.length})
              </Text>

              {recurringBlocks.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <Repeat size={48} color="#334155" />
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#64748B",
                      marginTop: 12,
                      textAlign: "center",
                    }}
                  >
                    No recurring series
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    Tap "New Recurring Series" to create one
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {recurringBlocks.map((series) => {
                    const freqLabels = {
                      daily: "Daily",
                      weekly: "Weekly",
                      "bi-weekly": "Bi-Weekly",
                      monthly: "Monthly",
                    };
                    const dayNames = [
                      "Sun",
                      "Mon",
                      "Tue",
                      "Wed",
                      "Thu",
                      "Fri",
                      "Sat",
                    ];
                    const freqDisplay =
                      series.frequency === "weekly" ||
                      series.frequency === "bi-weekly"
                        ? `${freqLabels[series.frequency]} (${dayNames[series.day_of_week] || "?"})`
                        : freqLabels[series.frequency] || series.frequency;

                    return (
                      <View
                        key={series.id}
                        style={{
                          backgroundColor: "#0F172A",
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                                marginBottom: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: "#94A3B8",
                                  backgroundColor: "#1E293B",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                {series.start_time} – {series.end_time}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: "600",
                                  color: "#A78BFA",
                                  backgroundColor: "#4C1D95",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                {freqDisplay}
                              </Text>
                            </View>
                            {series.reason && (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#94A3B8",
                                  marginTop: 2,
                                }}
                              >
                                {series.reason}
                              </Text>
                            )}
                            <Text
                              style={{
                                fontSize: 11,
                                color: "#64748B",
                                marginTop: 2,
                              }}
                            >
                              {series.num_occurrences > 0
                                ? `${series.num_occurrences} times`
                                : "Unlimited"}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 4 }}>
                            <TouchableOpacity
                              onPress={() => handleGenerateRecurring(series.id)}
                              style={{
                                padding: 8,
                                backgroundColor: "#1E3A8A",
                                borderRadius: 8,
                              }}
                            >
                              <PlayCircle size={16} color="#60A5FA" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingRecurring(series);
                                setRecurringForm({
                                  start_time: series.start_time,
                                  end_time: series.end_time,
                                  frequency: series.frequency,
                                  day_of_week: series.day_of_week ?? 1,
                                  reason: series.reason || "",
                                  num_occurrences: series.num_occurrences || 0,
                                  type: series.type || "blocked",
                                });
                                setShowRecurringModal(true);
                              }}
                              style={{
                                padding: 8,
                                backgroundColor: "#1E3A8A",
                                borderRadius: 8,
                              }}
                            >
                              <Pencil size={16} color="#60A5FA" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => confirmDeleteRecurring(series)}
                              style={{
                                padding: 8,
                                backgroundColor: "#334155",
                                borderRadius: 8,
                              }}
                            >
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Add One-Time Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#1E293B",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <Text
                style={{ fontSize: 20, fontWeight: "bold", color: "#FFFFFF" }}
              >
                {editingBlock ? "Edit" : "Block"} Time Off
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingBlock(null);
                  setForm({
                    start_date: "",
                    start_time: "09:00",
                    end_date: "",
                    end_time: "17:00",
                    all_day: true,
                    reason: "",
                  });
                }}
              >
                <XCircle size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {/* Type Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                  }}
                >
                  TYPE *
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, type: "blocked" })}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor:
                        form.type === "blocked" ? "#EF4444" : "#334155",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      🚫 Blocked
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: form.type === "blocked" ? "#FCA5A5" : "#64748B",
                        marginTop: 2,
                      }}
                    >
                      Cannot work
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setForm({ ...form, type: "available" })}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor:
                        form.type === "available" ? "#16A34A" : "#334155",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      ✅ Available
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color:
                          form.type === "available" ? "#86EFAC" : "#64748B",
                        marginTop: 2,
                      }}
                    >
                      Only these hours
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* All Day Toggle */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <TouchableOpacity
                  onPress={() => setForm({ ...form, all_day: !form.all_day })}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: form.all_day ? "#EF4444" : "#475569",
                    backgroundColor: form.all_day ? "#EF4444" : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 8,
                  }}
                >
                  {form.all_day && (
                    <Text style={{ color: "#FFFFFF", fontSize: 12 }}>✓</Text>
                  )}
                </TouchableOpacity>
                <Text style={{ fontSize: 14, color: "#CBD5E1" }}>All Day</Text>
              </View>

              {/* Start Date */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  START DATE *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  value={form.start_date}
                  onChangeText={(text) =>
                    setForm({
                      ...form,
                      start_date: text,
                      end_date: form.end_date || text,
                    })
                  }
                />
              </View>

              {/* End Date */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  END DATE (optional)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                  value={form.end_date}
                  onChangeText={(text) => setForm({ ...form, end_date: text })}
                />
              </View>

              {/* Time fields (if not all day) */}
              {!form.all_day && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#94A3B8",
                        marginBottom: 6,
                      }}
                    >
                      START TIME
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#0F172A",
                        borderWidth: 1,
                        borderColor: "#334155",
                        borderRadius: 8,
                        padding: 12,
                        color: "#FFFFFF",
                      }}
                      placeholder="HH:MM"
                      placeholderTextColor="#64748B"
                      value={form.start_time}
                      onChangeText={(text) =>
                        setForm({ ...form, start_time: text })
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#94A3B8",
                        marginBottom: 6,
                      }}
                    >
                      END TIME
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#0F172A",
                        borderWidth: 1,
                        borderColor: "#334155",
                        borderRadius: 8,
                        padding: 12,
                        color: "#FFFFFF",
                      }}
                      placeholder="HH:MM"
                      placeholderTextColor="#64748B"
                      value={form.end_time}
                      onChangeText={(text) =>
                        setForm({ ...form, end_time: text })
                      }
                    />
                  </View>
                </View>
              )}

              {/* Reason */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  REASON (optional)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="e.g. Vacation, Doctor appointment..."
                  placeholderTextColor="#64748B"
                  value={form.reason}
                  onChangeText={(text) => setForm({ ...form, reason: text })}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleAddBlockedTime}
                disabled={!form.start_date}
                style={{
                  backgroundColor: form.start_date ? "#EF4444" : "#64748B",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  {editingBlock ? "Update Time" : "Block This Time"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Recurring Modal */}
      <Modal visible={showRecurringModal} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#1E293B",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
              paddingHorizontal: 24,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 24,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Repeat size={24} color="#A78BFA" />
                <Text
                  style={{ fontSize: 20, fontWeight: "bold", color: "#FFFFFF" }}
                >
                  {editingRecurring ? "Edit" : "New"} Recurring Series
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowRecurringModal(false);
                  setEditingRecurring(null);
                }}
              >
                <XCircle size={28} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              {/* Type Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 8,
                  }}
                >
                  TYPE *
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() =>
                      setRecurringForm({ ...recurringForm, type: "blocked" })
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor:
                        recurringForm.type === "blocked"
                          ? "#EF4444"
                          : "#334155",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      🚫 Blocked
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color:
                          recurringForm.type === "blocked"
                            ? "#FCA5A5"
                            : "#64748B",
                        marginTop: 2,
                      }}
                    >
                      Cannot work
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setRecurringForm({ ...recurringForm, type: "available" })
                    }
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor:
                        recurringForm.type === "available"
                          ? "#16A34A"
                          : "#334155",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      ✅ Available
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color:
                          recurringForm.type === "available"
                            ? "#86EFAC"
                            : "#64748B",
                        marginTop: 2,
                      }}
                    >
                      Only these hours
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start Time */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  START TIME *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="HH:MM"
                  placeholderTextColor="#64748B"
                  value={recurringForm.start_time}
                  onChangeText={(text) =>
                    setRecurringForm({ ...recurringForm, start_time: text })
                  }
                />
              </View>

              {/* End Time */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  END TIME *
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="HH:MM"
                  placeholderTextColor="#64748B"
                  value={recurringForm.end_time}
                  onChangeText={(text) =>
                    setRecurringForm({ ...recurringForm, end_time: text })
                  }
                />
              </View>

              {/* Frequency */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  FREQUENCY *
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {["daily", "weekly", "bi-weekly", "monthly"].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      onPress={() =>
                        setRecurringForm({ ...recurringForm, frequency: freq })
                      }
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        backgroundColor:
                          recurringForm.frequency === freq
                            ? "#7C3AED"
                            : "#334155",
                        borderRadius: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: "#FFFFFF",
                        }}
                      >
                        {freq === "bi-weekly"
                          ? "Bi-Weekly"
                          : freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Day of Week (if weekly or bi-weekly) */}
              {(recurringForm.frequency === "weekly" ||
                recurringForm.frequency === "bi-weekly") && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: "#94A3B8",
                      marginBottom: 6,
                    }}
                  >
                    DAY OF WEEK *
                  </Text>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day, idx) => (
                        <TouchableOpacity
                          key={idx}
                          onPress={() =>
                            setRecurringForm({
                              ...recurringForm,
                              day_of_week: idx,
                            })
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor:
                              recurringForm.day_of_week === idx
                                ? "#7C3AED"
                                : "#334155",
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: "#FFFFFF",
                            }}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                </View>
              )}

              {/* Number of Occurrences */}
              <View style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  NUMBER OF OCCURRENCES (0 = unlimited)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  value={String(recurringForm.num_occurrences)}
                  onChangeText={(text) =>
                    setRecurringForm({
                      ...recurringForm,
                      num_occurrences: text,
                    })
                  }
                />
              </View>

              {/* Reason */}
              <View style={{ marginBottom: 24 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#94A3B8",
                    marginBottom: 6,
                  }}
                >
                  REASON (optional)
                </Text>
                <TextInput
                  style={{
                    backgroundColor: "#0F172A",
                    borderWidth: 1,
                    borderColor: "#334155",
                    borderRadius: 8,
                    padding: 12,
                    color: "#FFFFFF",
                  }}
                  placeholder="e.g. Weekly day off..."
                  placeholderTextColor="#64748B"
                  value={recurringForm.reason}
                  onChangeText={(text) =>
                    setRecurringForm({ ...recurringForm, reason: text })
                  }
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleAddRecurringBlock}
                style={{
                  backgroundColor: "#7C3AED",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#FFFFFF",
                  }}
                >
                  {editingRecurring ? "Update Series" : "Create Series"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
