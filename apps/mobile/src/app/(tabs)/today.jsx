import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  User,
  CheckCircle,
  PlayCircle,
  AlertCircle,
  LogOut,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Pencil,
  Eye,
  CreditCard,
  FileText,
  Trash2,
  Receipt,
  DollarSign,
  Car,
  List,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import useAuth from "@/utils/auth/useAuth";

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || "";

const FILTER_TABS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACTIVE", label: "Active" },
  { key: "DONE", label: "Done" },
];

function getStatusStyle(status) {
  switch (status) {
    case "confirmed":
      return { bg: "#1D4ED820", text: "#60A5FA", border: "#1D4ED860" };
    case "in-progress":
      return { bg: "#78350F20", text: "#FBBF24", border: "#78350F60" };
    case "completed":
      return { bg: "#16653420", text: "#4ADE80", border: "#16653460" };
    case "cancelled":
      return { bg: "#7F1D1D20", text: "#F87171", border: "#7F1D1D60" };
    default:
      return { bg: "#1E293B", text: "#94A3B8", border: "#334155" };
  }
}

function TripCard({ trip, onStatusChange, statusMutation, formatTime }) {
  // Trust DB payment_status as source of truth
  const isPaid = trip.payment_status === "paid";
  const sc = getStatusStyle(trip.status);
  const nextLabel =
    trip.status === "pending" || trip.status === "confirmed"
      ? "Start"
      : trip.status === "in-progress"
        ? "Complete"
        : null;

  const isReturnTrip = (trip.notes || "").toLowerCase().includes("return trip");
  const destLower = (trip.destination || "").toLowerCase();
  const isAirportDest = ["bna", "terminal", "airport", "concourse"].some((kw) =>
    destLower.includes(kw),
  );
  const toDisplay =
    isReturnTrip && isAirportDest
      ? trip.dropoff_street || trip.dropoff_address
      : trip.destination || trip.dropoff_address;

  const openUrl = (path) => {
    const url = `${BASE_URL}${path}`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open link"),
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Trip",
      `Delete trip for ${trip.client_name || "this passenger"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`/api/appointments/${trip.id}`, {
                method: "DELETE",
              });
              if (!res.ok) throw new Error("Failed to delete");
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch {
              Alert.alert("Error", "Could not delete trip");
            }
          },
        },
      ],
    );
  };

  const queryClient = useQueryClient();
  const [isResponding, setIsResponding] = React.useState(false);

  const handleDriverResponse = async (decision) => {
    try {
      setIsResponding(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const res = await fetch(`/api/driver/trips/${trip.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to respond");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Success",
        decision === "accepted"
          ? "Trip accepted! Thank you for confirming."
          : "Trip declined. The office will be notified.",
      );

      // Refresh the trips list
      queryClient.invalidateQueries({ queryKey: ["driver-trips"] });
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Could not respond to trip");
    } finally {
      setIsResponding(false);
    }
  };

  const isPendingDriverConfirmation = trip.driver_accepted === "pending";

  return (
    <View
      style={{
        backgroundColor: "#0F172A",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#1E293B",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      {/* ── Row 1: Time + Booking # + Status Badge ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Text
          style={{
            color: "#60A5FA",
            fontSize: 15,
            fontWeight: "800",
            minWidth: 72,
          }}
        >
          {formatTime(trip.start_time)}
        </Text>
        {trip.booking_number && (
          <View
            style={{
              backgroundColor: "#1E3A8A30",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#1D4ED860",
            }}
          >
            <Text style={{ color: "#93C5FD", fontSize: 11, fontWeight: "700" }}>
              {trip.booking_number}
            </Text>
          </View>
        )}
        {trip.booked_by === "Online" || trip.booked_by === "Passenger" ? (
          <View
            style={{
              backgroundColor: "#4C1D9520",
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#4C1D9550",
            }}
          >
            <Text style={{ color: "#A78BFA", fontSize: 10, fontWeight: "700" }}>
              Online
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {/* Trip Status */}
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: sc.bg,
            borderWidth: 1,
            borderColor: sc.border,
          }}
        >
          <Text
            style={{
              color: sc.text,
              fontSize: 10,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {trip.status === "in-progress"
              ? "Active"
              : trip.status || "pending"}
          </Text>
        </View>
        {trip.is_tentative && (
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: "#78350F20",
              borderWidth: 1,
              borderColor: "#78350F50",
            }}
          >
            <Text style={{ color: "#FBBF24", fontSize: 10, fontWeight: "800" }}>
              ⚠️ TENT
            </Text>
          </View>
        )}
      </View>

      {/* ── Row 2: Passenger | Driver ── */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
        }}
      >
        {/* Passenger */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: "#475569",
              fontSize: 9,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 4,
            }}
          >
            Passenger
          </Text>
          <Text
            style={{ color: "#F1F5F9", fontSize: 13, fontWeight: "600" }}
            numberOfLines={1}
          >
            {trip.client_name || "—"}
          </Text>
          {trip.client_phone ? (
            <Text style={{ color: "#64748B", fontSize: 11, marginTop: 1 }}>
              {trip.client_phone}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4,
              marginTop: 4,
            }}
          >
            {trip.client_is_new_passenger && (
              <View
                style={{
                  backgroundColor: "#16653415",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: "#16653440",
                }}
              >
                <Text
                  style={{ color: "#4ADE80", fontSize: 9, fontWeight: "700" }}
                >
                  ✨ NEW
                </Text>
              </View>
            )}
            {isReturnTrip && (
              <View
                style={{
                  backgroundColor: "#7C3AED15",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: "#7C3AED40",
                }}
              >
                <Text
                  style={{ color: "#A78BFA", fontSize: 9, fontWeight: "700" }}
                >
                  RETURN
                </Text>
              </View>
            )}
            {trip.gift_certificate && (
              <View
                style={{
                  backgroundColor: "#78350F15",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: "#78350F40",
                }}
              >
                <Text
                  style={{ color: "#FBBF24", fontSize: 9, fontWeight: "700" }}
                >
                  🎁 GIFT
                </Text>
              </View>
            )}
            {trip.referral_source ? (
              <View
                style={{
                  backgroundColor: "#78350F15",
                  borderRadius: 4,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  borderWidth: 1,
                  borderColor: "#78350F40",
                }}
              >
                <Text
                  style={{ color: "#FBBF24", fontSize: 9, fontWeight: "700" }}
                  numberOfLines={1}
                >
                  📍 {trip.referral_source}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Divider */}
        <View
          style={{ width: 1, backgroundColor: "#1E293B", marginVertical: 2 }}
        />

        {/* Driver */}
        <View style={{ flex: 1, paddingLeft: 6 }}>
          <Text
            style={{
              color: "#475569",
              fontSize: 9,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 4,
            }}
          >
            Driver
          </Text>
          {trip.employee_id ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: trip.employee_color || "#2563EB",
                  }}
                />
                <Text
                  style={{
                    color: "#F1F5F9",
                    fontSize: 13,
                    fontWeight: "600",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {trip.employee_name}
                </Text>
              </View>
              {trip.vehicle_name ? (
                <Text style={{ color: "#64748B", fontSize: 11, marginTop: 1 }}>
                  🚗 {trip.vehicle_name}
                </Text>
              ) : null}
            </>
          ) : trip.requested_driver_name ? (
            <>
              <Text
                style={{
                  color: "#FBBF24",
                  fontSize: 13,
                  fontWeight: "600",
                }}
                numberOfLines={1}
              >
                {trip.requested_driver_name}
              </Text>
              <Text style={{ color: "#64748B", fontSize: 10 }}>
                (Requested)
              </Text>
            </>
          ) : (
            <Text
              style={{
                color: "#F97316",
                fontSize: 12,
                fontStyle: "italic",
              }}
            >
              Unassigned
            </Text>
          )}
          {/* Destination */}
          {toDisplay ? (
            <View style={{ marginTop: 5 }}>
              <Text
                style={{
                  color: "#475569",
                  fontSize: 9,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                To
              </Text>
              <Text
                style={{
                  color: "#818CF8",
                  fontSize: 11,
                  fontWeight: "600",
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                → {toDisplay}
              </Text>
            </View>
          ) : null}
          {trip.distance_miles ? (
            <Text style={{ color: "#475569", fontSize: 10, marginTop: 3 }}>
              {trip.distance_miles} mi
            </Text>
          ) : null}
        </View>
      </View>

      {/* ── Row 3: Payment Status + Balance ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {isPaid ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: "#16653415",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#16653450",
            }}
          >
            <CheckCircle size={10} color="#4ADE80" />
            <Text style={{ color: "#4ADE80", fontSize: 11, fontWeight: "800" }}>
              PAID
            </Text>
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: "#78350F15",
              borderWidth: 1,
              borderColor: "#78350F50",
            }}
          >
            <Text style={{ color: "#FB923C", fontSize: 11, fontWeight: "800" }}>
              UNPAID
            </Text>
          </View>
        )}
        {trip.payment_method ? (
          <Text style={{ color: "#475569", fontSize: 11 }}>
            via {trip.payment_method}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        <Text
          style={{
            color: isPaid ? "#4ADE80" : "#FB923C",
            fontSize: 14,
            fontWeight: "800",
          }}
        >
          ${Number(trip.balance_due || 0).toFixed(2)}
        </Text>
        {Number(trip.tips_total || 0) > 0 ? (
          <View
            style={{
              backgroundColor: "#16653415",
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: "#16653440",
            }}
          >
            <Text style={{ color: "#4ADE80", fontSize: 10, fontWeight: "700" }}>
              +${Number(trip.tips_total).toFixed(2)} tip
            </Text>
          </View>
        ) : null}
      </View>

      {/* ── Row 4: Notes (if any) ── */}
      {trip.driver_notes || trip.notes ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderBottomWidth: 1,
            borderBottomColor: "#1E293B",
            gap: 3,
          }}
        >
          {trip.driver_notes ? (
            <Text style={{ color: "#4ADE80", fontSize: 11 }} numberOfLines={2}>
              🗒 <Text style={{ fontWeight: "700" }}>Driver Notes:</Text>{" "}
              {trip.driver_notes}
            </Text>
          ) : null}
          {trip.notes ? (
            <Text style={{ color: "#64748B", fontSize: 11 }} numberOfLines={2}>
              {trip.notes}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── NEW: Driver Confirmation Banner ── */}
      {isPendingDriverConfirmation && (
        <View
          style={{
            backgroundColor: "#78350F20",
            borderBottomWidth: 1,
            borderBottomColor: "#78350F60",
            padding: 12,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <AlertCircle size={18} color="#FBBF24" />
            <Text
              style={{
                color: "#FBBF24",
                fontSize: 13,
                fontWeight: "800",
                flex: 1,
              }}
            >
              ⏳ Awaiting Your Confirmation
            </Text>
          </View>
          <Text style={{ color: "#FDE047", fontSize: 11, lineHeight: 16 }}>
            Please confirm if you can take this trip or decline if unavailable.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            {/* Accept Button */}
            <TouchableOpacity
              onPress={() => handleDriverResponse("accepted")}
              disabled={isResponding}
              style={{
                flex: 1,
                backgroundColor: "#16653420",
                borderWidth: 2,
                borderColor: "#16653460",
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                opacity: isResponding ? 0.5 : 1,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CheckCircle size={16} color="#4ADE80" />
                <Text
                  style={{
                    color: "#4ADE80",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  {isResponding ? "..." : "ACCEPT"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Reject Button */}
            <TouchableOpacity
              onPress={() => handleDriverResponse("declined")}
              disabled={isResponding}
              style={{
                flex: 1,
                backgroundColor: "#7F1D1D20",
                borderWidth: 2,
                borderColor: "#7F1D1D60",
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
                justifyContent: "center",
                opacity: isResponding ? 0.5 : 1,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertCircle size={16} color="#F87171" />
                <Text
                  style={{
                    color: "#F87171",
                    fontSize: 14,
                    fontWeight: "800",
                  }}
                >
                  {isResponding ? "..." : "DECLINE"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Row 5: Action Buttons ── */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          padding: 10,
          gap: 6,
        }}
      >
        {/* Edit */}
        <TouchableOpacity
          onPress={() => openUrl(`/trips`)}
          style={styles.actionBtn("#1D4ED820", "#1D4ED860")}
          activeOpacity={0.75}
        >
          <Pencil size={11} color="#60A5FA" />
          <Text style={styles.actionText("#60A5FA")}>Edit</Text>
        </TouchableOpacity>

        {/* View */}
        {trip.booking_number ? (
          <TouchableOpacity
            onPress={() => openUrl(`/booking/${trip.id}`)}
            style={styles.actionBtn("#1E293B", "#334155")}
            activeOpacity={0.75}
          >
            <Eye size={11} color="#94A3B8" />
            <Text style={styles.actionText("#94A3B8")}>View</Text>
          </TouchableOpacity>
        ) : null}

        {/* Start / Complete */}
        {nextLabel ? (
          <TouchableOpacity
            onPress={() => onStatusChange(trip)}
            disabled={statusMutation.isPending}
            style={styles.actionBtn(
              trip.status === "in-progress" ? "#16653420" : "#1D4ED820",
              trip.status === "in-progress" ? "#16653460" : "#1D4ED860",
            )}
            activeOpacity={0.75}
          >
            {trip.status === "in-progress" ? (
              <CheckCircle size={11} color="#4ADE80" />
            ) : (
              <PlayCircle size={11} color="#60A5FA" />
            )}
            <Text
              style={styles.actionText(
                trip.status === "in-progress" ? "#4ADE80" : "#60A5FA",
              )}
            >
              {nextLabel}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Pay */}
        {!isPaid ? (
          <TouchableOpacity
            onPress={() => openUrl(`/trips`)}
            style={styles.actionBtn("#16653420", "#16653460")}
            activeOpacity={0.75}
          >
            <CreditCard size={11} color="#4ADE80" />
            <Text style={styles.actionText("#4ADE80")}>Pay</Text>
          </TouchableOpacity>
        ) : null}

        {/* Receipt */}
        <TouchableOpacity
          onPress={() => openUrl(`/receipt/${trip.id}`)}
          style={styles.actionBtn("#1E293B", "#334155")}
          activeOpacity={0.75}
        >
          <Receipt size={11} color="#94A3B8" />
          <Text style={styles.actionText("#94A3B8")}>Receipt</Text>
        </TouchableOpacity>

        {/* Invoice */}
        <TouchableOpacity
          onPress={() => openUrl(`/trips`)}
          style={styles.actionBtn("#4C1D9515", "#4C1D9545")}
          activeOpacity={0.75}
        >
          <FileText size={11} color="#A78BFA" />
          <Text style={styles.actionText("#A78BFA")}>Invoice</Text>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.actionBtn("#7F1D1D15", "#7F1D1D45")}
          activeOpacity={0.75}
        >
          <Trash2 size={11} color="#F87171" />
          <Text style={styles.actionText("#F87171")}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Inline style helpers
const styles = {
  actionBtn: (bg, border) => ({
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: border,
  }),
  actionText: (color) => ({
    color,
    fontSize: 11,
    fontWeight: "700",
  }),
};

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { auth, setAuth } = useAuth();
  const [filter, setFilter] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("day");

  const driverInfo = {
    id: auth?.user?.id || null,
    name: auth?.user?.name || "",
    color: auth?.user?.color || "#2563EB",
  };

  // Use CDT (America/Chicago) date so late-night trips (e.g. 11:15 PM CDT)
  // appear on the correct calendar day, not rolled over to the next UTC day.
  const CDT_TZ = "America/Chicago";
  const getCDTDateStr = (date) =>
    date.toLocaleDateString("en-CA", { timeZone: CDT_TZ });

  const getCDTOffset = (dateStr) => {
    const sample = new Date(dateStr + "T12:00:00");
    const tzLabel = sample
      .toLocaleTimeString("en-US", { timeZone: CDT_TZ, timeZoneName: "short" })
      .split(" ")
      .pop();
    return tzLabel === "CDT" ? "-05:00" : "-06:00";
  };

  const dateStr = getCDTDateStr(selectedDate);
  const tzOffset = getCDTOffset(dateStr);
  const isToday = dateStr === getCDTDateStr(new Date());

  const {
    data: trips,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["driver-trips", driverInfo.id, dateStr, viewMode],
    enabled: !!driverInfo.id,
    queryFn: async () => {
      // CDT-aware day boundaries so trips like 11:15 PM CDT are in the right day
      const startOfDay = `${dateStr}T00:00:00${tzOffset}`;
      const endOfDay = `${dateStr}T23:59:59${tzOffset}`;
      const employeeParam =
        viewMode === "driver" ? `&employee_id=${driverInfo.id}` : "";
      const res = await fetch(
        `/api/appointments?start=${startOfDay}&end=${endOfDay}${employeeParam}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to load trips");
      }
      return res.json();
    },
    retry: 2,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({
        queryKey: ["driver-trips", driverInfo.id],
      });
    },
    onError: () => Alert.alert("Error", "Could not update trip status"),
  });

  const handleStatusChange = useCallback(
    (trip) => {
      const next =
        trip.status === "pending" || trip.status === "confirmed"
          ? "in-progress"
          : trip.status === "in-progress"
            ? "completed"
            : null;
      if (!next) return;
      const label =
        next === "in-progress" ? "Start this trip?" : "Mark as completed?";
      Alert.alert(
        label,
        `${trip.client_name} — ${formatTime(trip.start_time)}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: next === "in-progress" ? "Start Trip" : "Complete Trip",
            onPress: () => statusMutation.mutate({ id: trip.id, status: next }),
          },
        ],
      );
    },
    [statusMutation],
  );

  const formatTime = (dt) =>
    new Date(dt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const handleSignOut = () => {
    Alert.alert("Switch Driver", "Go back to driver selection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Switch",
        style: "destructive",
        onPress: async () => {
          await setAuth(null);
          router.replace("/");
        },
      },
    ]);
  };

  const goToPreviousDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const sorted =
    trips
      ?.slice()
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time)) || [];

  const activeCount = sorted.filter((t) => t.status === "in-progress").length;
  const doneCount = sorted.filter((t) => t.status === "completed").length;
  const pendingCount = sorted.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "confirmed" ||
      t.driver_accepted === "pending",
  ).length;

  const all = sorted.filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING")
      return (
        t.status === "pending" ||
        t.status === "confirmed" ||
        t.driver_accepted === "pending"
      );
    if (filter === "ACTIVE") return t.status === "in-progress";
    if (filter === "DONE") return t.status === "completed";
    return true;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const filtered = all.filter(
    (t) =>
      new Date(t.start_time) >= cutoffDate &&
      !t.is_tentative &&
      t.status !== "cancelled",
  );

  console.log("[Schedule] After date filter count:", filtered.length);

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0F1E" }}>
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 10,
          backgroundColor: "#0A0F1E",
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
        }}
      >
        {/* Driver name + sign out */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <View>
            <Text
              style={{
                color: "#60A5FA",
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {driverInfo.name || "Command Center"}
            </Text>
            <Text
              style={{
                color: "#F1F5F9",
                fontSize: 18,
                fontWeight: "800",
                marginTop: 1,
              }}
            >
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={{ padding: 8 }}>
            <LogOut size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {/* Date navigation */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#0F172A",
            borderRadius: 12,
            padding: 8,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: "#1E293B",
          }}
        >
          <TouchableOpacity
            onPress={goToPreviousDay}
            style={{ padding: 8, backgroundColor: "#1E293B", borderRadius: 8 }}
          >
            <ChevronLeft size={18} color="#60A5FA" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToToday}
            disabled={isToday}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              backgroundColor: isToday ? "#2563EB22" : "transparent",
              borderRadius: 8,
            }}
          >
            <Calendar size={14} color={isToday ? "#60A5FA" : "#475569"} />
            <Text
              style={{
                color: isToday ? "#60A5FA" : "#94A3B8",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {isToday ? "Today" : "Go to Today"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToNextDay}
            style={{ padding: 8, backgroundColor: "#1E293B", borderRadius: 8 }}
          >
            <ChevronRight size={18} color="#60A5FA" />
          </TouchableOpacity>
        </View>

        {/* Stat chips */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <StatChip value={sorted.length} label="Trips" color="#60A5FA" />
          <StatChip value={activeCount} label="Active" color="#FBBF24" />
          <StatChip value={doneCount} label="Done" color="#4ADE80" />
          <StatChip value={pendingCount} label="Pending" color="#94A3B8" />
        </View>

        {/* View mode toggle */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#0F172A",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#1E293B",
            padding: 3,
            marginBottom: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              if (viewMode !== "driver") {
                setViewMode("driver");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor:
                viewMode === "driver" ? "#2563EB" : "transparent",
            }}
          >
            <User
              size={14}
              color={viewMode === "driver" ? "#fff" : "#64748B"}
            />
            <Text
              style={{
                color: viewMode === "driver" ? "#fff" : "#64748B",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              My Trips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (viewMode !== "day") {
                setViewMode("day");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            activeOpacity={0.8}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: viewMode === "day" ? "#2563EB" : "transparent",
            }}
          >
            <CalendarDays
              size={14}
              color={viewMode === "day" ? "#fff" : "#64748B"}
            />
            <Text
              style={{
                color: viewMode === "day" ? "#fff" : "#64748B",
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              All Trips
            </Text>
          </TouchableOpacity>
        </View>

        {/* All Trips button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/trips");
          }}
          style={{
            backgroundColor: "#1E293B",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#334155",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <List size={16} color="#60A5FA" />
          <Text style={{ color: "#60A5FA", fontSize: 14, fontWeight: "700" }}>
            All Trips
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ── */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#0F172A",
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
        }}
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: active ? "#2563EB" : "#1E293B",
                borderWidth: 1,
                borderColor: active ? "#3B82F6" : "#334155",
              }}
            >
              <Text
                style={{
                  color: active ? "#fff" : "#64748B",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Trip list ── */}
      {isLoading ? (
        <ActivityIndicator color="#60A5FA" style={{ marginTop: 60 }} />
      ) : error ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <AlertCircle size={40} color="#EF4444" />
          <Text
            style={{
              color: "#EF4444",
              fontSize: 15,
              fontWeight: "600",
              marginTop: 14,
              textAlign: "center",
            }}
          >
            Failed to load trips
          </Text>
          <Text
            style={{
              color: "#64748B",
              fontSize: 13,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            {error.message}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              backgroundColor: "#3B82F6",
              borderRadius: 8,
              paddingHorizontal: 20,
              paddingVertical: 10,
              marginTop: 16,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <CheckCircle size={40} color="#1E293B" />
          <Text
            style={{
              color: "#334155",
              fontSize: 15,
              fontWeight: "600",
              marginTop: 14,
            }}
          >
            {filter === "ALL"
              ? "No trips today"
              : `No ${filter.toLowerCase()} trips`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 12,
            paddingBottom: insets.bottom + 90,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor="#60A5FA"
            />
          }
        >
          {filtered.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onStatusChange={handleStatusChange}
              statusMutation={statusMutation}
              formatTime={formatTime}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StatChip({ value, label, color }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0F172A",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: "#1E293B",
        alignItems: "center",
      }}
    >
      <Text style={{ color, fontSize: 18, fontWeight: "800" }}>{value}</Text>
      <Text
        style={{
          color: "#475569",
          fontSize: 10,
          fontWeight: "600",
          marginTop: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
