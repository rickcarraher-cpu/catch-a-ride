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
      const filtered = all.filter(
        (t) =>
          new Date(t.start_time) >= today &&
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
    if (isNaN(date.getTime())) return "--:--";

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Filter by selected day
  const filtered = selectedDay
    ? (trips || []).filter(
        (t) => toDateStr(new Date(t.start_time)) === toDateStr(selectedDay),
      )
    : trips || [];

  // Group by CDT date (not UTC date) so 11 PM CDT trips show under the right day
  const grouped = {};
  filtered.forEach((t) => {
    const day = toDateStr(new Date(t.start_time));
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(t);
  });

  const formatDateHeader = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  // Count trips per day for day picker badge (also use CDT date)
  const tripsPerDay = {};
  (trips || []).forEach((t) => {
    const day = toDateStr(new Date(t.start_time));
    tripsPerDay[day] = (tripsPerDay[day] || 0) + 1;
  });

  // Helper to get pickup/dropoff display (city or "BNA" if airport)
  const airportKw = ["airport", "terminal", "concourse", "bna"];
  function getLocationDisplay(trip, type) {
    const addrField =
      type === "pickup"
        ? trip.pickup_street || trip.pickup_address || ""
        : trip.dropoff_street || trip.dropoff_address || "";
    const city = type === "pickup" ? trip.pickup_city : trip.dropoff_city;
    const zip = type === "pickup" ? trip.pickup_zip : trip.dropoff_zip;
    const addrLower = addrField.toLowerCase();
    const isAirport =
      zip === "37214" || airportKw.some((kw) => addrLower.includes(kw));
    return isAirport ? "BNA" : city || null;
  }

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
        <Text
          style={{
            color: "#60A5FA",
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Upcoming Schedule
        </Text>
        <Text
          style={{
            color: "#F1F5F9",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 1,
          }}
        >
          {(trips || []).length} trips ahead
        </Text>
      </View>

      {/* ── Day picker (horizontal tabs) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 6,
        }}
        style={{
          backgroundColor: "#0F172A",
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
          flexGrow: 0,
        }}
      >
        {/* ALL tab */}
        <TouchableOpacity
          onPress={() => setSelectedDay(null)}
          activeOpacity={0.8}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 12,
            backgroundColor: selectedDay === null ? "#2563EB" : "#1E293B",
            borderWidth: 1,
            borderColor: selectedDay === null ? "#3B82F6" : "#334155",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: selectedDay === null ? "#fff" : "#64748B",
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            All
          </Text>
        </TouchableOpacity>

        {dayOptions.map((d, i) => {
          const dStr = toDateStr(d);
          const count = tripsPerDay[dStr] || 0;
          const isSelected = selectedDay && toDateStr(selectedDay) === dStr;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diff = Math.round((d - today) / 86400000);
          const dayLabel =
            diff === 0
              ? "Today"
              : diff === 1
                ? "Tomorrow"
                : d.toLocaleDateString("en-US", { weekday: "short" });
          const dateLabel = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <TouchableOpacity
              key={dStr}
              onPress={() => setSelectedDay(isSelected ? null : d)}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: isSelected
                  ? "#1D4ED8"
                  : count > 0
                    ? "#1E293B"
                    : "#0F172A",
                borderWidth: 1,
                borderColor: isSelected
                  ? "#3B82F6"
                  : count > 0
                    ? "#334155"
                    : "#1E293B",
                alignItems: "center",
                minWidth: 60,
              }}
            >
              <Text
                style={{
                  color: isSelected
                    ? "#fff"
                    : count > 0
                      ? "#94A3B8"
                      : "#334155",
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "uppercase",
                }}
              >
                {dayLabel}
              </Text>
              <Text
                style={{
                  color: isSelected
                    ? "#93C5FD"
                    : count > 0
                      ? "#F1F5F9"
                      : "#1E293B",
                  fontSize: 13,
                  fontWeight: "800",
                  marginTop: 1,
                }}
              >
                {d.getDate()}
              </Text>
              {count > 0 && (
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: isSelected ? "#60A5FA" : "#2563EB",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Trip list ── */}
      {isLoading ? (
        <ActivityIndicator color="#60A5FA" style={{ marginTop: 60 }} />
      ) : Object.keys(grouped).length === 0 ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <CalendarDays size={40} color="#1E293B" />
          <Text
            style={{
              color: "#334155",
              fontSize: 15,
              fontWeight: "600",
              marginTop: 14,
            }}
          >
            {selectedDay ? "No trips that day" : "No upcoming trips"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 90, gap: 18 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor="#60A5FA"
            />
          }
        >
          {Object.keys(grouped)
            .sort()
            .map((dateStr) => (
              <View key={dateStr}>
                {/* Day section header */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 3,
                      height: 16,
                      borderRadius: 2,
                      backgroundColor: "#2563EB",
                    }}
                  />
                  <Text
                    style={{
                      color: "#60A5FA",
                      fontSize: 12,
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      flex: 1,
                    }}
                  >
                    {formatDateHeader(dateStr)}
                  </Text>
                  <Text style={{ color: "#334155", fontSize: 11 }}>
                    {grouped[dateStr].length} trip
                    {grouped[dateStr].length !== 1 ? "s" : ""}
                  </Text>
                </View>

                {/* Horizontal card row */}
                <View style={{ gap: 6 }}>
                  {grouped[dateStr].map((trip) => {
                    const sc =
                      STATUS_CONFIG[trip.status] || STATUS_CONFIG.pending;
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        onPress={() => setSelectedTrip(trip)}
                        activeOpacity={0.8}
                        style={{
                          backgroundColor: "#0F172A",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: "#1E293B",
                          flexDirection: "row",
                          alignItems: "center",
                          overflow: "hidden",
                        }}
                      >
                        {/* Left color bar */}
                        <View
                          style={{
                            width: 3,
                            alignSelf: "stretch",
                            backgroundColor: sc.color,
                          }}
                        />

                        {/* Time column */}
                        <View
                          style={{
                            alignItems: "center",
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            minWidth: 64,
                          }}
                        >
                          <Text
                            style={{
                              color: "#60A5FA",
                              fontSize: 14,
                              fontWeight: "800",
                            }}
                          >
                            {formatTime(trip.start_time).split(" ")[0]}
                          </Text>
                          <Text
                            style={{
                              color: "#334155",
                              fontSize: 10,
                              fontWeight: "600",
                            }}
                          >
                            {formatTime(trip.start_time).split(" ")[1]}
                          </Text>
                        </View>

                        {/* Divider */}
                        <View
                          style={{
                            width: 1,
                            height: 36,
                            backgroundColor: "#1E293B",
                          }}
                        />

                        {/* Info */}
                        <View
                          style={{
                            flex: 1,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Text
                              style={{
                                color: "#F1F5F9",
                                fontSize: 14,
                                fontWeight: "600",
                              }}
                              numberOfLines={1}
                            >
                              {trip.client_name || "Passenger"}
                            </Text>
                            {(trip.booked_by === "Recurring" ||
                              trip.notes?.includes("recurring series")) && (
                              <Repeat size={11} color="#A5B4FC" />
                            )}
                          </View>
                          {trip.destination ? (
                            <Text
                              style={{
                                color: "#475569",
                                fontSize: 11,
                                marginTop: 2,
                              }}
                              numberOfLines={1}
                            >
                              → {trip.destination}
                            </Text>
                          ) : trip.notes ? (
                            <Text
                              style={{
                                color: "#475569",
                                fontSize: 11,
                                marginTop: 2,
                              }}
                              numberOfLines={1}
                            >
                              {trip.notes}
                            </Text>
                          ) : null}

                          {/* Pickup / Dropoff cities */}
                          {(() => {
                            const pickup = getLocationDisplay(trip, "pickup");
                            const dropoff = getLocationDisplay(trip, "dropoff");
                            if (!pickup && !dropoff) return null;
                            return (
                              <View style={{ marginTop: 4, gap: 2 }}>
                                {pickup ? (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <MapPin size={9} color="#22C55E" />
                                    <Text
                                      style={{
                                        color: "#64748B",
                                        fontSize: 10,
                                        fontWeight: "600",
                                      }}
                                      numberOfLines={1}
                                    >
                                      <Text style={{ color: "#475569" }}>
                                        Pickup:{" "}
                                      </Text>
                                      {pickup}
                                    </Text>
                                  </View>
                                ) : null}
                                {dropoff ? (
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                  >
                                    <MapPin size={9} color="#F87171" />
                                    <Text
                                      style={{
                                        color: "#64748B",
                                        fontSize: 10,
                                        fontWeight: "600",
                                      }}
                                      numberOfLines={1}
                                    >
                                      <Text style={{ color: "#475569" }}>
                                        Dropoff:{" "}
                                      </Text>
                                      {dropoff}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            );
                          })()}

                          {/* Confirmation Badges */}
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {trip.passenger_confirmed === "confirmed" && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#16A34A15",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <CheckCircle size={9} color="#4ADE80" />
                                <Text
                                  style={{
                                    color: "#4ADE80",
                                    fontSize: 9,
                                    fontWeight: "700",
                                  }}
                                >
                                  PASSENGER
                                </Text>
                              </View>
                            )}
                            {trip.passenger_confirmed === "cancelled" && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#DC262615",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <AlertCircle size={9} color="#F87171" />
                                <Text
                                  style={{
                                    color: "#F87171",
                                    fontSize: 9,
                                    fontWeight: "700",
                                  }}
                                >
                                  P.CANCEL
                                </Text>
                              </View>
                            )}
                            {trip.driver_accepted === "accepted" && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#7C3AED15",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <UserCheck size={9} color="#A78BFA" />
                                <Text
                                  style={{
                                    color: "#A78BFA",
                                    fontSize: 9,
                                    fontWeight: "700",
                                  }}
                                >
                                  DRIVER
                                </Text>
                              </View>
                            )}
                            {trip.driver_accepted === "declined" && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                  backgroundColor: "#DC262615",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                }}
                              >
                                <AlertCircle size={9} color="#F87171" />
                                <Text
                                  style={{
                                    color: "#F87171",
                                    fontSize: 9,
                                    fontWeight: "700",
                                  }}
                                >
                                  D.DECLINE
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Status + people */}
                        <View
                          style={{
                            paddingRight: 12,
                            alignItems: "flex-end",
                            gap: 3,
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
                            <Text style={{ color: "#334155", fontSize: 10 }}>
                              👥 {trip.num_people}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
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
