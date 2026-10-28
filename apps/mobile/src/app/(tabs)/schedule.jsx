import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  User,
  Repeat,
  ChevronRight,
  CheckCircle,
  UserCheck,
  AlertCircle,
  MapPin,
} from "lucide-react-native";
import useAuth from "@/utils/auth/useAuth";
import TripDetailsModal from "@/components/DriverPortal/TripDetailsModal";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#EAB308" },
  confirmed: { label: "Confirmed", color: "#22C55E" },
  "in-progress": { label: "Active", color: "#60A5FA" },
  completed: { label: "Done", color: "#4ADE80" },
  cancelled: { label: "Cancelled", color: "#F87171" },
};

// Build next 14 days for day-picker
function buildDayOptions() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

const dayOptions = buildDayOptions();

function toDateStr(d) {
  // Use CDT (America/Chicago) date so late-night trips (11 PM CDT, etc.)
  // group under the correct calendar day instead of rolling to the next UTC day.
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const driverId = auth?.user?.id || null;
  const [selectedDay, setSelectedDay] = useState(null); // null = ALL
  const [selectedTrip, setSelectedTrip] = useState(null);

  const {
    data: trips,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["schedule-trips", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const res = await fetch(`/api/appointments?employee_id=${driverId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string" ? err.error : "Failed to load schedule",
        );
      }
      const all = await res.json();
      console.log("[Schedule] Raw API response count:", all.length);
      console.log(
        "[Schedule] First 5 trips:",
        all.slice(0, 5).map((t) => ({
          id: t.id,
          booking_number: t.booking_number,
          status: t.status,
          driver_accepted: t.driver_accepted,
          start_time: t.start_time,
        })),
      );

      // Check if booking 26-2258 is in the response
      const pendingTrip = all.find((t) => t.booking_number === "26-2258");
      if (pendingTrip) {
        console.log("[Schedule] Found pending trip 26-2258:", pendingTrip);
      } else {
        console.log("[Schedule] Pending trip 26-2258 NOT in API response");
      }

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
      console.log(
        "[Schedule] Filtered trips:",
        filtered.map((t) => ({
          booking_number: t.booking_number,
          status: t.status,
          driver_accepted: t.driver_accepted,
        })),
      );

      return filtered.sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time),
      );
    },
  });

  const formatTime = (dt) => {
    // Validate date input
    if (!dt) return "--:--";

    const date = new Date(dt);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn("Invalid date:", dt);
      return "--:--";
    }

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dt) => {
    if (!dt) return "—";
    const date = new Date(dt);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Group by date
  const grouped = (trips || []).reduce((acc, t) => {
    const dt = new Date(t.start_time);
    const dateKey = toDateStr(dt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(t);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  // Filter by selected day
  let filteredDates = sortedDates;
  if (selectedDay !== null) {
    const selDateStr = toDateStr(selectedDay);
    filteredDates = sortedDates.filter((d) => d === selDateStr);
  }

  const [expandedDays, setExpandedDays] = useState(() => {
    // Default: expand today if present
    const todayStr = toDateStr(new Date());
    return sortedDates.includes(todayStr) ? [todayStr] : [];
  });

  const toggleDay = (dateKey) => {
    setExpandedDays((prev) =>
      prev.includes(dateKey)
        ? prev.filter((d) => d !== dateKey)
        : [...prev, dateKey],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#E2E8F0",
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#0F172A" }}>
          My Schedule
        </Text>
        <Text style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
          Past 30 days & upcoming
        </Text>
      </View>

      {/* Day filter carousel */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#E2E8F0",
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          <TouchableOpacity
            onPress={() => setSelectedDay(null)}
            style={{
              marginRight: 8,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor: selectedDay === null ? "#2563EB" : "#F1F5F9",
              borderWidth: 1,
              borderColor: selectedDay === null ? "#2563EB" : "#CBD5E1",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: selectedDay === null ? "#FFFFFF" : "#475569",
              }}
            >
              ALL
            </Text>
          </TouchableOpacity>
          {dayOptions.map((d, idx) => {
            const isSelected =
              selectedDay && toDateStr(selectedDay) === toDateStr(d);
            const isToday = toDateStr(d) === toDateStr(new Date());
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedDay(d)}
                style={{
                  marginRight: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: isSelected ? "#2563EB" : "#F1F5F9",
                  borderWidth: 1,
                  borderColor: isSelected ? "#2563EB" : "#CBD5E1",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: isSelected ? "#FFFFFF" : "#475569",
                  }}
                >
                  {isToday
                    ? "TODAY"
                    : d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 12, color: "#64748B" }}>
            Loading schedule...
          </Text>
        </View>
      ) : !trips || trips.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <CalendarDays size={48} color="#CBD5E1" />
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: "600",
              color: "#64748B",
            }}
          >
            No trips found
          </Text>
        </View>
      ) : filteredDates.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <CalendarDays size={48} color="#CBD5E1" />
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: "600",
              color: "#64748B",
            }}
          >
            No trips on this day
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 20,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor="#2563EB"
            />
          }
        >
          {filteredDates.map((dateKey) => {
            const dayTrips = grouped[dateKey];
            const isExpanded = expandedDays.includes(dateKey);
            const date = new Date(dateKey);
            const isToday = toDateStr(date) === toDateStr(new Date());

            return (
              <View key={dateKey} style={{ marginBottom: 20 }}>
                {/* Day header */}
                <TouchableOpacity
                  onPress={() => toggleDay(dateKey)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                    paddingBottom: 8,
                    borderBottomWidth: 2,
                    borderBottomColor: isToday ? "#2563EB" : "#E2E8F0",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#0F172A",
                      }}
                    >
                      {isToday ? "Today" : formatDate(date)}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748B" }}>
                      {dayTrips.length}{" "}
                      {dayTrips.length === 1 ? "trip" : "trips"}
                    </Text>
                  </View>
                  <View
                    style={{
                      transform: [{ rotate: isExpanded ? "180deg" : "0deg" }],
                    }}
                  >
                    <ChevronRight size={20} color="#64748B" />
                  </View>
                </TouchableOpacity>

                {/* Trips list */}
                <View>
                  {isExpanded &&
                    dayTrips.map((trip) => {
                      const sc = STATUS_CONFIG[trip.status] || {
                        label: trip.status,
                        color: "#6B7280",
                      };

                      // Determine if driver has responded
                      const isDriverPending =
                        trip.driver_accepted === "pending" ||
                        !trip.driver_accepted;
                      const isDriverAccepted =
                        trip.driver_accepted === "accepted";
                      const isDriverDeclined =
                        trip.driver_accepted === "declined";

                      return (
                        <TouchableOpacity
                          key={trip.id}
                          onPress={() => setSelectedTrip(trip)}
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 10,
                            borderWidth: 1,
                            borderColor: "#E2E8F0",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1,
                          }}
                        >
                          {/* Trip header */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: "#2563EB",
                                textDecorationLine: "underline",
                              }}
                            >
                              {trip.booking_number}
                            </Text>
                            <Text
                              style={{
                                fontSize: 16,
                                fontWeight: "700",
                                color: "#0F172A",
                              }}
                            >
                              {formatTime(trip.start_time)}
                            </Text>
                          </View>

                          {/* Passenger */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <User size={14} color="#64748B" />
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "600",
                                color: "#0F172A",
                                marginLeft: 6,
                              }}
                            >
                              {trip.client_name || "No passenger"}
                            </Text>
                          </View>

                          {/* Location */}
                          {(trip.pickup_address ||
                            trip.dropoff_address ||
                            trip.destination) && (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                marginBottom: 8,
                              }}
                            >
                              <MapPin
                                size={14}
                                color="#64748B"
                                style={{ marginTop: 2 }}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: "#64748B",
                                  marginLeft: 6,
                                  flex: 1,
                                }}
                                numberOfLines={2}
                              >
                                {[
                                  trip.pickup_address ||
                                    trip.departure_location,
                                  trip.dropoff_address || trip.destination,
                                ]
                                  .filter(Boolean)
                                  .join(" → ")}
                              </Text>
                            </View>
                          )}

                          {/* Driver confirmation status + metadata */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              {isDriverPending && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <AlertCircle size={14} color="#EAB308" />
                                  <Text
                                    style={{
                                      color: "#EAB308",
                                      fontSize: 10,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Needs Response
                                  </Text>
                                </View>
                              )}
                              {isDriverAccepted && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <CheckCircle size={14} color="#22C55E" />
                                  <Text
                                    style={{
                                      color: "#22C55E",
                                      fontSize: 10,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Accepted
                                  </Text>
                                </View>
                              )}
                              {isDriverDeclined && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <AlertCircle size={14} color="#F87171" />
                                  <Text
                                    style={{
                                      color: "#F87171",
                                      fontSize: 10,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Declined
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 5,
                                }}
                              >
                                <View
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 4,
                                    backgroundColor: sc.color,
                                  }}
                                />
                                <Text
                                  style={{
                                    color: sc.color,
                                    fontSize: 10,
                                    fontWeight: "700",
                                  }}
                                >
                                  {sc.label}
                                </Text>
                              </View>
                              {trip.num_people ? (
                                <Text
                                  style={{ color: "#334155", fontSize: 10 }}
                                >
                                  👥 {trip.num_people}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <TripDetailsModal
        visible={!!selectedTrip}
        trip={selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
    </View>
  );
}
