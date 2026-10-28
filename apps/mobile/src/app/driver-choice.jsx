import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, FileText, Clock, Shield } from "lucide-react-native";
import useAuth from "@/utils/auth/useAuth";

export default function DriverChoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, isReady, initiate } = useAuth();
  const [retryCount, setRetryCount] = useState(0);

  // Retry loading auth if not ready
  useEffect(() => {
    if (!isReady && retryCount < 3) {
      const timer = setTimeout(() => {
        initiate();
        setRetryCount((prev) => prev + 1);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isReady, retryCount, initiate]);

  // Show loading state while auth is initializing
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0F172A",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#94A3B8", marginTop: 16, fontSize: 14 }}>
          Loading portal...
        </Text>
      </View>
    );
  }

  // Show error if no user data
  if (!auth?.user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0F172A",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Text
          style={{
            color: "#EF4444",
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          No driver information found
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={{
            backgroundColor: "#3B82F6",
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
            Back to Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0F172A" }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
          justifyContent: "center",
        }}
      >
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 48 }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "bold",
              color: "#FFFFFF",
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Welcome, {auth?.user?.name || "Driver"}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: "#94A3B8",
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            Choose what you'd like to do
          </Text>
        </View>

        {/* Choice Cards */}
        <View style={{ gap: 16 }}>
          {/* Admin Portal - Only show if user is admin */}
          {auth?.user?.isAdmin && (
            <TouchableOpacity
              onPress={() => router.replace("/(tabs)/today")}
              style={{
                backgroundColor: "#1E293B",
                borderRadius: 16,
                padding: 24,
                borderWidth: 2,
                borderColor: "#8B5CF6",
                shadowColor: "#8B5CF6",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#8B5CF6",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Shield size={32} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: "bold",
                  color: "#FFFFFF",
                  marginBottom: 8,
                }}
              >
                Admin Portal
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: "#94A3B8",
                  lineHeight: 20,
                }}
              >
                Manage all trips, drivers, passengers, and system settings
              </Text>
            </TouchableOpacity>
          )}

          {/* Review My Schedule for Tomorrow */}
          <TouchableOpacity
            onPress={() => router.push("/tomorrow-schedule")}
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 16,
              padding: 24,
              borderWidth: 2,
              borderColor: "#F59E0B",
              shadowColor: "#F59E0B",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#F59E0B",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Clock size={32} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 8,
              }}
            >
              Review My Schedule for Tomorrow
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#94A3B8",
                lineHeight: 20,
              }}
            >
              See tomorrow's trips in order with all trip essentials
            </Text>
          </TouchableOpacity>

          {/* View Upcoming Trips */}
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/schedule")}
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 16,
              padding: 24,
              borderWidth: 2,
              borderColor: "#3B82F6",
              shadowColor: "#3B82F6",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#3B82F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Calendar size={32} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 8,
              }}
            >
              View Upcoming Trips
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#94A3B8",
                lineHeight: 20,
              }}
            >
              See your scheduled trips, start trips, and mark them as complete
            </Text>
          </TouchableOpacity>

          {/* Review Timesheet */}
          <TouchableOpacity
            onPress={() => router.replace("/driver-report")}
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 16,
              padding: 24,
              borderWidth: 2,
              borderColor: "#10B981",
              shadowColor: "#10B981",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <FileText size={32} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 8,
              }}
            >
              Review Timesheet
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#94A3B8",
                lineHeight: 20,
              }}
            >
              Review and approve your weekly timesheet for the last complete
              week
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
