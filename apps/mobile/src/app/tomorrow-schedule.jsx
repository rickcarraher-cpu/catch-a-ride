import React, { useState } from "react";
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
import { Calendar, MapPin, Users, Clock, ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import useAuth from "@/utils/auth/useAuth";
import { StatusBar } from "expo-status-bar";

export default function TomorrowScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { auth } = useAuth();
  const driverId = auth?.user?.id || null;

  // Calculate tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const {
    data: trips,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["tomorrow-trips", driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const res = await fetch(`/api/appointments?employee_id=${driverId}`);
      if (!res.ok) throw new Error("Failed");
      const all = await res.json();

      // Filter for tomorrow's trips only, excluding tentative
      return all
        .filter((t) => {
          const tripDate = new Date(t.start_time);
          return (
            tripDate >= tomorrow && tripDate <= tomorrowEnd && !t.is_tentative
          );
        })
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    },
  });

  const formatTime = (dt) => {
    if (!dt) return "--:--";
    const date = new Date(dt);
    if (isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (dt) => {
    if (!dt) return "";
    const date = new Date(dt);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0F1E" }}>
      <StatusBar style="light" />

      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: "#0A0F1E",
          borderBottomWidth: 1,
          borderBottomColor: "#1E293B",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <ArrowLeft size={20} color="#60A5FA" />
          <Text style={{ color: "#60A5FA", fontSize: 14, fontWeight: "600" }}>
            Back
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: "#60A5FA",
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Tomorrow's Schedule
        </Text>
        <Text
          style={{
            color: "#F1F5F9",
            fontSize: 18,
            fontWeight: "800",
            marginTop: 1,
          }}
        >
          {formatDate(tomorrow)}
        </Text>
        {trips && (
          <Text style={{ color: "#94A3B8", fontSize: 13, marginTop: 4 }}>
            {trips.length} trip{trips.length !== 1 ? "s" : ""} scheduled
          </Text>
        )}
      </View>

      {/* Trip List */}
      {isLoading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color="#60A5FA" size="large" />
          <Text style={{ color: "#94A3B8", marginTop: 16 }}>
            Loading tomorrow's schedule...
          </Text>
        </View>
      ) : !trips || trips.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Calendar size={48} color="#1E293B" />
          <Text
            style={{
              color: "#334155",
              fontSize: 16,
              fontWeight: "600",
              marginTop: 16,
              textAlign: "center",
            }}
          >
            No trips scheduled for tomorrow
          </Text>
          <Text
            style={{
              color: "#475569",
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            You have a free day tomorrow!
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 90,
            gap: 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor="#60A5FA"
            />
          }
        >
          {trips.map((trip, index) => (
            <View
              key={trip.id}
              style={{
                backgroundColor: "#0F172A",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#1E293B",
                padding: 16,
              }}
            >
              {/* Trip number and time */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      backgroundColor: "#1E3A8A",
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: "#93C5FD",
                        fontSize: 12,
                        fontWeight: "800",
                      }}
                    >
                      #{index + 1}
                    </Text>
                  </View>
                  <Clock size={16} color="#60A5FA" />
                  <Text
                    style={{
                      color: "#60A5FA",
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    {formatTime(trip.start_time)}
                  </Text>
                </View>
                {trip.booking_number && (
                  <Text
                    style={{
                      color: "#475569",
                      fontSize: 12,
                      fontFamily: "monospace",
                    }}
                  >
                    {trip.booking_number}
                  </Text>
                )}
              </View>

              {/* Passenger name */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Users size={16} color="#94A3B8" />
                <Text
                  style={{
                    color: "#F1F5F9",
                    fontSize: 15,
                    fontWeight: "600",
                    flex: 1,
                  }}
                >
                  {trip.client_name || "Passenger"}
                </Text>
                {trip.num_people && (
                  <Text
                    style={{
                      color: "#64748B",
                      fontSize: 13,
                    }}
                  >
                    {trip.num_people}{" "}
                    {trip.num_people === 1 ? "person" : "people"}
                  </Text>
                )}
              </View>

              {/* Destination */}
              {trip.destination && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <MapPin size={16} color="#94A3B8" style={{ marginTop: 2 }} />
                  <Text
                    style={{
                      color: "#CBD5E1",
                      fontSize: 14,
                      flex: 1,
                      lineHeight: 20,
                    }}
                  >
                    {trip.destination}
                  </Text>
                </View>
              )}

              {/* Pickup location */}
              {trip.pickup_address && (
                <View
                  style={{
                    backgroundColor: "#1E293B",
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#64748B",
                      fontSize: 11,
                      fontWeight: "600",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Pickup
                  </Text>
                  <Text
                    style={{
                      color: "#94A3B8",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {trip.pickup_address}
                  </Text>
                </View>
              )}

              {/* Dropoff location */}
              {trip.dropoff_address && (
                <View
                  style={{
                    backgroundColor: "#1E293B",
                    borderRadius: 8,
                    padding: 10,
                    marginTop: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "#64748B",
                      fontSize: 11,
                      fontWeight: "600",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Dropoff
                  </Text>
                  <Text
                    style={{
                      color: "#94A3B8",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {trip.dropoff_address}
                  </Text>
                </View>
              )}

              {/* Notes */}
              {trip.notes && (
                <View
                  style={{
                    backgroundColor: "#0F172A",
                    borderLeftWidth: 3,
                    borderLeftColor: "#3B82F6",
                    padding: 10,
                    marginTop: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#64748B",
                      fontSize: 11,
                      fontWeight: "600",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    Notes
                  </Text>
                  <Text
                    style={{
                      color: "#94A3B8",
                      fontSize: 13,
                      lineHeight: 18,
                    }}
                  >
                    {trip.notes}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
