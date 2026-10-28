import { useState, useEffect, useCallback } from "react";
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
  LogOut,
  CheckCircle,
  XCircle,
  DollarSign,
  MapPin,
  Calendar,
  RotateCcw,
  Printer,
  Clock,
  Users,
  User,
} from "lucide-react-native";
import {
  getLastCompleteWeek,
  formatPeriodLabel,
} from "@/utils/weekCalculation";

export default function DriverReportScreen() {
  const [driverInfo, setDriverInfo] = useState(null);
  const [timesheetData, setTimesheetData] = useState(null); // full timesheet response
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approved, setApproved] = useState(null);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showResubmit, setShowResubmit] = useState(false);
  const [showPrintPrompt, setShowPrintPrompt] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [lastApprovalResult, setLastApprovalResult] = useState(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, signOut: authSignOut } = useAuth();

  const { startDate, endDate } = getLastCompleteWeek();

  useEffect(() => {
    loadDriverInfo();
  }, []);

  const loadDriverInfo = async () => {
    try {
      if (!auth?.user || !auth?.passwordVerified) {
        router.replace("/login");
        return;
      }
      const driver = auth.user;
      setDriverInfo(driver);
      await fetchTimesheet(driver.id);
    } catch (error) {
      console.error("Error loading driver info:", error);
      router.replace("/login");
    }
  };

  const fetchTimesheet = async (driverId) => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/timesheets?startDate=${startDate}&endDate=${endDate}&driverId=${driverId}`,
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          typeof errData.error === "string"
            ? errData.error
            : "Failed to fetch timesheet",
        );
      }
      const data = await response.json();
      setTimesheetData(data);
    } catch (error) {
      console.error("Error fetching timesheet:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to load timesheet data"
          : String(error);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    if (driverInfo) {
      setRefreshing(true);
      await fetchTimesheet(driverInfo.id);
      setRefreshing(false);
    }
  }, [driverInfo]);

  const handleLogout = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await authSignOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    if (approved === null) {
      Alert.alert(
        "Approval Required",
        "Please select Approve or Not Approved.",
      );
      return;
    }
    if (approved === false && !comments.trim()) {
      Alert.alert(
        "Reason Required",
        "Please provide a reason explaining why you are not approving the timesheet.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const driverData = timesheetData?.drivers?.[0];
      const tripIds = driverData ? driverData.trips.map((t) => t.id) : [];
      const response = await fetch("/api/timesheets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: driverInfo.id,
          startDate,
          endDate,
          approved,
          reason: comments.trim() || null,
          role: "driver",
          tripIds,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Failed to submit approval",
        );

      setLastApprovalResult(approved);
      await fetchTimesheet(driverInfo.id);
      setShowResubmit(false);
      setApproved(null);
      setComments("");
      setShowPrintPrompt(true);
    } catch (error) {
      console.error("Error submitting approval:", error);
      const msg =
        typeof error === "object"
          ? error.message || "Failed to submit approval"
          : String(error);
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintAndContinue = (wantsPrint) => {
    setShowPrintPrompt(false);
    if (wantsPrint) {
      try {
        if (typeof window !== "undefined" && window.print) {
          window.print();
        }
      } catch (e) {
        // Silently ignore
      }
    }
    setShowThankYou(true);
  };

  const handleSignOut = async () => {
    setShowThankYou(false);
    await authSignOut();
    router.replace("/login");
  };

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
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#94A3B8", marginTop: 16 }}>
          Loading your timesheet...
        </Text>
      </View>
    );
  }

  const driverData = timesheetData?.drivers?.[0];
  const trips = driverData?.trips || [];
  const approval = driverData?.approval;
  const driverApprovalStatus = approval?.driver_status || "pending";
  const adminApprovalStatus = approval?.admin_status || "pending";
  const hasDriverSubmitted =
    driverApprovalStatus !== "pending" && !showResubmit;

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
          <View>
            <Text
              style={{ fontSize: 24, fontWeight: "bold", color: "#FFFFFF" }}
            >
              Timesheet
            </Text>
            <Text style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>
              {driverInfo?.name || "Driver"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            style={{ backgroundColor: "#334155", borderRadius: 8, padding: 10 }}
          >
            <LogOut size={20} color="#FFFFFF" />
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
            tintColor="#3B82F6"
          />
        }
      >
        {/* Summary Card */}
        <View
          style={{
            backgroundColor: "#1E293B",
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#94A3B8",
              marginBottom: 12,
            }}
          >
            Period Summary
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#0F172A",
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <Calendar size={14} color="#64748B" />
            <Text style={{ fontSize: 13, color: "#64748B", marginLeft: 8 }}>
              {formatPeriodLabel(startDate, endDate)}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: "#CBD5E1" }}>Total Trips</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
              {trips.length}
            </Text>
          </View>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ fontSize: 14, color: "#CBD5E1" }}>
              Total Earnings (paid trips only)
            </Text>
            <Text
              style={{ fontSize: 18, fontWeight: "bold", color: "#10B981" }}
            >
              ${(driverData?.totalCompensation || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Trips List */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "bold",
            color: "#FFFFFF",
            marginBottom: 12,
          }}
        >
          Trips
        </Text>

        {trips.length === 0 ? (
          <View
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 12,
              padding: 40,
              alignItems: "center",
            }}
          >
            <Calendar size={48} color="#64748B" />
            <Text
              style={{
                fontSize: 16,
                color: "#94A3B8",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              No trips found for this period
            </Text>
          </View>
        ) : (
          trips.map((trip, index) => {
            const isPaid = trip.paymentStatus === "paid" || trip.driverPaid;
            const tripDate = new Date(trip.date);
            return (
              <View
                key={trip.id || index}
                style={{
                  backgroundColor: "#1E293B",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: isPaid ? "#10B981" : "#F59E0B",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#FFFFFF",
                      }}
                    >
                      {trip.clientName || "Unknown Passenger"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: isPaid ? "#10B981" : "#F59E0B",
                        fontWeight: "bold",
                        marginTop: 2,
                      }}
                    >
                      {isPaid ? "PAID" : "UNPAID"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: isPaid ? "#10B981" : "#64748B",
                      }}
                    >
                      {isPaid ? `$${trip.compensation.toFixed(2)}` : "Pending"}
                    </Text>
                    {trip.tips > 0 && (
                      <Text style={{ fontSize: 12, color: "#10B981" }}>
                        +${trip.tips.toFixed(2)} tip
                      </Text>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <Calendar size={14} color="#64748B" />
                  <Text
                    style={{ fontSize: 14, color: "#94A3B8", marginLeft: 8 }}
                  >
                    {tripDate.toLocaleDateString()} at{" "}
                    {tripDate.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                {(trip.pickup || trip.dropoff) && (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MapPin size={14} color="#64748B" />
                    <Text
                      style={{ fontSize: 13, color: "#94A3B8", marginLeft: 8 }}
                      numberOfLines={1}
                    >
                      {trip.pickup || "—"} → {trip.dropoff || "—"}
                    </Text>

                    {/* Payment Method Badge - Show full method string (e.g., "Square, Cash") */}
                    {trip.paymentMethod && trip.paymentMethod !== "—" && (
                      <View style={{ marginBottom: 8 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: "#059669",
                            backgroundColor: "#D1FAE5",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 6,
                            alignSelf: "flex-start",
                          }}
                        >
                          {trip.paymentMethod}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}

        {/* Approval Status Cards */}
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
              fontSize: 18,
              fontWeight: "bold",
              color: "#FFFFFF",
              marginBottom: 4,
            }}
          >
            Timesheet Approval
          </Text>
          <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
            Period: {formatPeriodLabel(startDate, endDate)}
          </Text>

          {/* Status cards for both driver and admin */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {/* Driver status */}
            <View
              style={{
                flex: 1,
                backgroundColor:
                  driverApprovalStatus === "approved"
                    ? "#064E3B"
                    : driverApprovalStatus === "rejected"
                      ? "#7F1D1D"
                      : "#0F172A",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <User
                size={16}
                color={
                  driverApprovalStatus === "approved"
                    ? "#10B981"
                    : driverApprovalStatus === "rejected"
                      ? "#EF4444"
                      : "#64748B"
                }
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#FFFFFF",
                  marginTop: 4,
                }}
              >
                Driver
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color:
                    driverApprovalStatus === "approved"
                      ? "#10B981"
                      : driverApprovalStatus === "rejected"
                        ? "#EF4444"
                        : "#64748B",
                  marginTop: 2,
                }}
              >
                {driverApprovalStatus === "approved"
                  ? "Approved"
                  : driverApprovalStatus === "rejected"
                    ? "Not Approved"
                    : "Pending"}
              </Text>
            </View>
            {/* Admin status */}
            <View
              style={{
                flex: 1,
                backgroundColor:
                  adminApprovalStatus === "approved"
                    ? "#064E3B"
                    : adminApprovalStatus === "rejected"
                      ? "#7F1D1D"
                      : "#0F172A",
                borderRadius: 8,
                padding: 12,
                alignItems: "center",
              }}
            >
              <Users
                size={16}
                color={
                  adminApprovalStatus === "approved"
                    ? "#10B981"
                    : adminApprovalStatus === "rejected"
                      ? "#EF4444"
                      : "#64748B"
                }
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#FFFFFF",
                  marginTop: 4,
                }}
              >
                Admin
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color:
                    adminApprovalStatus === "approved"
                      ? "#10B981"
                      : adminApprovalStatus === "rejected"
                        ? "#EF4444"
                        : "#64748B",
                  marginTop: 2,
                }}
              >
                {adminApprovalStatus === "approved"
                  ? "Approved"
                  : adminApprovalStatus === "rejected"
                    ? "Not Approved"
                    : "Pending"}
              </Text>
            </View>
          </View>

          {/* Driver's approval form */}
          {hasDriverSubmitted ? (
            <View>
              <View
                style={{
                  backgroundColor:
                    driverApprovalStatus === "approved" ? "#064E3B" : "#7F1D1D",
                  borderRadius: 10,
                  padding: 16,
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                {driverApprovalStatus === "approved" ? (
                  <CheckCircle size={36} color="#10B981" />
                ) : (
                  <XCircle size={36} color="#EF4444" />
                )}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#FFFFFF",
                    marginTop: 10,
                  }}
                >
                  {driverApprovalStatus === "approved"
                    ? "Timesheet Approved"
                    : "Timesheet Not Approved"}
                </Text>
                {approval?.driver_responded_at && (
                  <Text
                    style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}
                  >
                    Submitted{" "}
                    {new Date(
                      approval.driver_responded_at,
                    ).toLocaleDateString()}
                  </Text>
                )}
              </View>

              {approval?.driver_reason ? (
                <View
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <Text
                    style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}
                  >
                    Your reason:
                  </Text>
                  <Text style={{ fontSize: 14, color: "#CBD5E1" }}>
                    {approval.driver_reason}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={() => {
                  setShowResubmit(true);
                  setApproved(null);
                  setComments("");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: "#334155",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <RotateCcw size={16} color="#94A3B8" />
                <Text style={{ fontSize: 14, color: "#94A3B8", marginLeft: 8 }}>
                  Change my answer
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <Text
                style={{ fontSize: 15, color: "#CBD5E1", marginBottom: 16 }}
              >
                Do you approve this timesheet?
              </Text>

              {showResubmit && (
                <View
                  style={{
                    backgroundColor: "#0F172A",
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <RotateCcw size={14} color="#F59E0B" />
                  <Text
                    style={{ fontSize: 12, color: "#F59E0B", marginLeft: 8 }}
                  >
                    You are changing a previously submitted answer.
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: approved === true ? "#10B981" : "#334155",
                    borderRadius: 8,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => setApproved(true)}
                >
                  <CheckCircle size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginLeft: 8,
                    }}
                  >
                    Approve
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: approved === false ? "#EF4444" : "#334155",
                    borderRadius: 8,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => setApproved(false)}
                >
                  <XCircle size={20} color="#FFFFFF" />
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                      marginLeft: 8,
                    }}
                  >
                    Not Approved
                  </Text>
                </TouchableOpacity>
              </View>

              {approved === false && (
                <View style={{ marginBottom: 16 }}>
                  <Text
                    style={{ fontSize: 14, color: "#CBD5E1", marginBottom: 8 }}
                  >
                    Reason (required):
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: "#0F172A",
                      borderWidth: 1,
                      borderColor: "#334155",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 14,
                      color: "#FFFFFF",
                      minHeight: 100,
                      textAlignVertical: "top",
                    }}
                    placeholder="Please explain why you are not approving..."
                    placeholderTextColor="#64748B"
                    value={comments}
                    onChangeText={setComments}
                    multiline
                  />
                </View>
              )}

              <TouchableOpacity
                style={{
                  backgroundColor: submitting ? "#64748B" : "#3B82F6",
                  borderRadius: 8,
                  padding: 16,
                  alignItems: "center",
                }}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#FFFFFF",
                    }}
                  >
                    Submit Approval
                  </Text>
                )}
              </TouchableOpacity>

              {showResubmit && (
                <TouchableOpacity
                  onPress={() => setShowResubmit(false)}
                  style={{ alignItems: "center", padding: 12, marginTop: 8 }}
                >
                  <Text style={{ fontSize: 14, color: "#64748B" }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Print Prompt Modal */}
      <Modal visible={showPrintPrompt} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 24,
              padding: 32,
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#3B82F6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Printer size={36} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Timesheet {lastApprovalResult ? "Approved" : "Not Approved"}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: "#94A3B8",
                textAlign: "center",
                lineHeight: 24,
                marginBottom: 28,
              }}
            >
              Would you like to print this timesheet?
            </Text>
            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
              <TouchableOpacity
                onPress={() => handlePrintAndContinue(false)}
                style={{
                  flex: 1,
                  backgroundColor: "#334155",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}
                >
                  No Thanks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handlePrintAndContinue(true)}
                style={{
                  flex: 1,
                  backgroundColor: "#3B82F6",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#FFFFFF" }}
                >
                  Yes, Print
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Thank You Modal */}
      <Modal visible={showThankYou} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#1E293B",
              borderRadius: 24,
              padding: 40,
              alignItems: "center",
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "#10B981",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 28,
              }}
            >
              <CheckCircle size={52} color="#FFFFFF" />
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "bold",
                color: "#FFFFFF",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Thank You!
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: "#94A3B8",
                textAlign: "center",
                lineHeight: 24,
                marginBottom: 32,
              }}
            >
              Your response has been recorded and the company has been notified.
              {"\n\n"}You may sign out now.
            </Text>
            <TouchableOpacity
              onPress={handleSignOut}
              style={{
                backgroundColor: "#EF4444",
                borderRadius: 12,
                paddingVertical: 16,
                paddingHorizontal: 48,
                alignItems: "center",
                width: "100%",
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <LogOut size={20} color="#FFFFFF" />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#FFFFFF",
                  marginLeft: 10,
                }}
              >
                Sign Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
