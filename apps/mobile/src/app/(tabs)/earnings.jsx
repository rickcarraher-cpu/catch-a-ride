import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  CheckCircle,
  Calendar,
  Clock,
  UserCheck,
  AlertCircle,
  X,
  Check,
  MapPin,
} from "lucide-react-native";
import useAuth from "@/utils/auth/useAuth";
import { getMonday, getSunday } from "@/utils/weekCalculation";
import { useRouter } from "expo-router";

// Safe date-only formatter: avoids UTC-to-local timezone shift for date-only strings
function formatDateOnly(dateStr, options = { month: "short", day: "numeric" }) {
  if (!dateStr) return "";
  const s = String(dateStr).slice(0, 10); // "YYYY-MM-DD"
  if (s.length < 10) return s;
  const [yr, mo, dy] = s.split("-").map(Number);
  return new Date(yr, mo - 1, dy).toLocaleDateString("en-US", options);
}

const PERIOD_TABS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All Time" },
];

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const { auth, isReady } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState("week");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approved, setApproved] = useState(null);
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Derive driver info from auth store - with null checks
  const driverInfo = {
    id: auth?.user?.id || null,
    name: auth?.user?.name || "",
    rate:
      auth?.user?.salary_rate != null
        ? parseFloat(auth.user.salary_rate)
        : 0.75,
  };

  // Weekly date range for approval (Mon-Sun of current week)
  const [dateRange] = useState({
    start: getMonday(new Date()),
    end: getSunday(new Date()),
  });

  const {
    data: trips,
    isLoading: tripsLoading,
    refetch: tripsRefetch,
    isFetching,
  } = useQuery({
    queryKey: ["earnings-trips", driverInfo.id],
    enabled: !!driverInfo.id && isReady,
    queryFn: async () => {
      const res = await fetch(`/api/appointments?employee_id=${driverInfo.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string" ? err.error : "Failed to load trips",
        );
      }
      return res.json();
    },
  });

  const {
    data: transactions,
    isLoading: txLoading,
    refetch: txRefetch,
  } = useQuery({
    queryKey: ["earnings-transactions", driverInfo.id],
    enabled: !!driverInfo.id && isReady,
    queryFn: async () => {
      const res = await fetch(`/api/transactions?employee_id=${driverInfo.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "Failed to load transactions",
        );
      }
      return res.json();
    },
  });

  // Fetch existing approval status for current week
  const {
    data: existingApproval,
    isLoading: approvalLoading,
    refetch: approvalRefetch,
  } = useQuery({
    queryKey: [
      "driver-approval",
      driverInfo.id,
      dateRange.start,
      dateRange.end,
    ],
    enabled: !!driverInfo.id && isReady,
    queryFn: async () => {
      const res = await fetch(
        `/api/driver/mileage-approval?startDate=${dateRange.start}&endDate=${dateRange.end}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "Failed to load approval status",
        );
      }
      return res.json();
    },
  });

  // Pre-populate form with existing approval
  useEffect(() => {
    if (existingApproval) {
      setApproved(existingApproval.approval_status === "approved");
      setExplanation(existingApproval.driver_comments || "");
    } else {
      setApproved(null);
      setExplanation("");
    }
  }, [existingApproval]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isReady && (!auth || !auth.user)) {
      router.replace("/login");
    }
  }, [isReady, auth, router]);

  // Show loading state while auth is initializing
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0F172A",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
        }}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={{ color: "#94A3B8", marginTop: 16, fontSize: 14 }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Show error state if no driver info after auth is ready
  if (!driverInfo.id) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0F172A",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingHorizontal: 24,
        }}
      >
        <AlertCircle size={48} color="#EF4444" />
        <Text
          style={{
            color: "#F1F5F9",
            marginTop: 16,
            fontSize: 18,
            fontWeight: "600",
            textAlign: "center",
          }}
        >
          Authentication Error
        </Text>
        <Text
          style={{
            color: "#94A3B8",
            marginTop: 8,
            fontSize: 14,
            textAlign: "center",
          }}
        >
          Unable to load driver information. Please sign in again.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          style={{
            marginTop: 24,
            backgroundColor: "#3B82F6",
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
            Go to Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Drivers are compensated only for PAID trips.
  // Unpaid trips will be compensated when the trip is paid.
  // Use cached fields from trip records (driver_commission, tips_total)
  // instead of recalculating from services × rate.
  const allTrips = (trips || []).filter(
    (t) =>
      t.status !== "cancelled" &&
      t.status !== "canceled" &&
      t.status !== "deleted",
  );
  const paidTrips = allTrips.filter(
    (t) =>
      t.payment_status === "paid" ||
      t.driver_paid === true ||
      (t.balance_due != null &&
        parseFloat(t.balance_due) <= 0 &&
        t.payments_total != null &&
        parseFloat(t.payments_total) > 0),
  );

  const myTripIds = new Set(allTrips.map((t) => t.id));
  const myTransactions = (transactions || []).filter(
    (tx) => tx.appointment_id && myTripIds.has(tx.appointment_id),
  );

  // Sum earnings using CACHED fields from paid trips only.
  // The stored driver_commission on each trip is the authoritative value.
  // If it is 0, the trip has 0 commission — do NOT recalculate from the current rate.
  const sumEarningsByPeriod = (filterFn) => {
    return paidTrips.filter(filterFn).reduce((s, t) => {
      const commission = Number(t.driver_commission || 0);
      return s + commission;
    }, 0);
  };

  const sumTipsByPeriod = (filterFn) => {
    return paidTrips
      .filter(filterFn)
      .reduce((s, t) => s + Number(t.tips_total || 0), 0);
  };

  const sumRevenueByPeriod = (filterFn) => {
    return paidTrips
      .filter(filterFn)
      .reduce((s, t) => s + Number(t.services_total || 0), 0);
  };

  const totalRevenue = sumRevenueByPeriod(() => true);
  const monthRevenue = sumRevenueByPeriod(
    (t) => new Date(t.start_time) >= startOfMonth,
  );
  const weekRevenue = sumRevenueByPeriod(
    (t) => new Date(t.start_time) >= startOfWeek,
  );

  const totalEarningsCalc =
    sumEarningsByPeriod(() => true) + sumTipsByPeriod(() => true);
  const monthEarningsCalc =
    sumEarningsByPeriod((t) => new Date(t.start_time) >= startOfMonth) +
    sumTipsByPeriod((t) => new Date(t.start_time) >= startOfMonth);
  const weekEarningsCalc =
    sumEarningsByPeriod((t) => new Date(t.start_time) >= startOfWeek) +
    sumTipsByPeriod((t) => new Date(t.start_time) >= startOfWeek);

  const periodRevenue =
    period === "week"
      ? weekRevenue
      : period === "month"
        ? monthRevenue
        : totalRevenue;
  const periodEarnings =
    period === "week"
      ? weekEarningsCalc
      : period === "month"
        ? monthEarningsCalc
        : totalEarningsCalc;

  const completedTrips = allTrips.filter(
    (t) => t.status === "completed",
  ).length;
  const pendingPaymentTrips = allTrips.filter(
    (t) => t.payment_status !== "paid",
  ).length;

  // Calculate total miles from trips by period (all trips, not just paid — miles are not financial)
  const calculateMilesByPeriod = (filterFn) => {
    return allTrips
      .filter(filterFn)
      .reduce((sum, t) => sum + (Number(t.distance_miles) || 0), 0);
  };

  const totalMiles = calculateMilesByPeriod(() => true);
  const monthMiles = calculateMilesByPeriod(
    (t) => new Date(t.start_time) >= startOfMonth,
  );
  const weekMiles = calculateMilesByPeriod(
    (t) => new Date(t.start_time) >= startOfWeek,
  );

  const periodMiles =
    period === "week"
      ? weekMiles
      : period === "month"
        ? monthMiles
        : totalMiles;

  const fmt = (n) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

  const loading = tripsLoading || txLoading;

  const handleSubmitApproval = async () => {
    if (approved === null) {
      Alert.alert(
        "Selection Required",
        "Please select whether you approve this timesheet",
      );
      return;
    }

    if (approved === false && !explanation.trim()) {
      Alert.alert(
        "Explanation Required",
        "Please provide an explanation for disagreement",
      );
      return;
    }

    setSubmitting(true);

    try {
      const weekTrips = (trips || []).filter((t) => {
        const tripDate = new Date(t.start_time).toISOString().split("T")[0];
        return tripDate >= dateRange.start && tripDate <= dateRange.end;
      });
      const tripIds = weekTrips.map((t) => t.id);

      const response = await fetch("/api/driver/submit-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: driverInfo.id,
          startDate: dateRange.start,
          endDate: dateRange.end,
          approved,
          comments: explanation.trim() || null,
          approvedTripIds: tripIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit approval");
      }

      setShowApprovalModal(false);
      setShowThankYou(true);
      approvalRefetch();
    } catch (err) {
      console.error(err);
      Alert.alert(
        "Error",
        err.message || "Failed to submit approval. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          My Earnings
        </Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 1,
          }}
        >
          <Text style={{ color: "#F1F5F9", fontSize: 18, fontWeight: "800" }}>
            {driverInfo.name || "Driver"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#1E3A5F",
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <TrendingUp size={13} color="#60A5FA" />
            <Text style={{ color: "#60A5FA", fontSize: 13, fontWeight: "800" }}>
              {Math.round(driverInfo.rate * 100)}% rate
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color="#60A5FA" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => {
                tripsRefetch();
                txRefetch();
              }}
              tintColor="#60A5FA"
            />
          }
        >
          {/* ── Period tabs ── */}
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#0F172A",
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 6,
              borderBottomWidth: 1,
              borderBottomColor: "#1E293B",
            }}
          >
            {PERIOD_TABS.map((tab) => {
              const active = period === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setPeriod(tab.key)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: active ? "#1D4ED8" : "#1E293B",
                    borderWidth: 1,
                    borderColor: active ? "#3B82F6" : "#334155",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: active ? "#fff" : "#475569",
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

          {/* ── Big earnings number ── */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 20,
              paddingBottom: 16,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: "#475569",
                fontSize: 12,
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              {period === "week"
                ? "This Week"
                : period === "month"
                  ? "This Month"
                  : "All Time"}{" "}
              Earnings
            </Text>
            <Text
              style={{
                color: "#F1F5F9",
                fontSize: 42,
                fontWeight: "900",
                marginTop: 6,
              }}
            >
              {fmt(periodEarnings)}
            </Text>
            <Text style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>
              from {fmt(periodRevenue)} revenue
            </Text>
          </View>

          {/* ── Stat row (4 chips) ── */}
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 12,
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <MiniStat
              icon={<CheckCircle size={16} color="#4ADE80" />}
              label="Completed"
              value={completedTrips}
              color="#4ADE80"
            />
            <MiniStat
              icon={<Clock size={16} color="#FBBF24" />}
              label="Pending Pay"
              value={pendingPaymentTrips}
              color="#FBBF24"
            />
            <MiniStat
              icon={<DollarSign size={16} color="#A78BFA" />}
              label="Total Trips"
              value={(trips || []).length}
              color="#A78BFA"
            />
            <MiniStat
              icon={<MapPin size={16} color="#60A5FA" />}
              label="Total Miles"
              value={periodMiles.toFixed(1)}
              color="#60A5FA"
            />
          </View>

          {/* ── Weekly Approval Section ── */}
          <View style={{ paddingHorizontal: 12, marginBottom: 16 }}>
            <View
              style={{
                backgroundColor: "#0F172A",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#1E293B",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  backgroundColor: "#1E3A5F",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#1E293B",
                }}
              >
                <Text
                  style={{
                    color: "#60A5FA",
                    fontSize: 11,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Weekly Timesheet Approval
                </Text>
                <Text style={{ color: "#94A3B8", fontSize: 11, marginTop: 2 }}>
                  {new Date(dateRange.start + "T12:00:00").toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                    },
                  )}
                  {" — "}
                  {new Date(dateRange.end + "T12:00:00").toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </Text>
              </View>

              {approvalLoading ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator color="#60A5FA" size="small" />
                </View>
              ) : existingApproval ? (
                <View style={{ padding: 14 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    {existingApproval.approval_status === "approved" ? (
                      <CheckCircle size={20} color="#4ADE80" />
                    ) : (
                      <X size={20} color="#F87171" />
                    )}
                    <Text
                      style={{
                        color: "#F1F5F9",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      {existingApproval.approval_status === "approved"
                        ? "Approved"
                        : "Not Approved"}
                    </Text>
                  </View>
                  <Text
                    style={{ color: "#475569", fontSize: 11, marginBottom: 4 }}
                  >
                    Submitted{" "}
                    {new Date(existingApproval.submitted_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </Text>
                  {existingApproval.driver_comments && (
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
                          color: "#94A3B8",
                          fontSize: 10,
                          fontWeight: "600",
                          marginBottom: 4,
                        }}
                      >
                        Your comment:
                      </Text>
                      <Text style={{ color: "#CBD5E1", fontSize: 12 }}>
                        {existingApproval.driver_comments}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowApprovalModal(true)}
                    style={{
                      marginTop: 12,
                      backgroundColor: "#1D4ED8",
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      Update Response
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ padding: 14 }}>
                  <Text
                    style={{
                      color: "#94A3B8",
                      fontSize: 12,
                      marginBottom: 12,
                      textAlign: "center",
                    }}
                  >
                    Review and approve your weekly timesheet
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowApprovalModal(true)}
                    style={{
                      backgroundColor: "#2563EB",
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: "700",
                      }}
                    >
                      Review & Approve
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── All-period comparison row ── */}
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 16,
              backgroundColor: "#0F172A",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#1E293B",
              overflow: "hidden",
            }}
          >
            <CompareRow
              label="This Week"
              revenue={weekRevenue}
              earnings={weekEarningsCalc}
              active={period === "week"}
              fmt={fmt}
            />
            <CompareRow
              label="This Month"
              revenue={monthRevenue}
              earnings={monthEarningsCalc}
              active={period === "month"}
              fmt={fmt}
              separator
            />
            <CompareRow
              label="All Time"
              revenue={totalRevenue}
              earnings={totalEarningsCalc}
              active={period === "all"}
              fmt={fmt}
              separator
            />
          </View>

          {/* ── Recent transactions ── */}
          <View style={{ paddingHorizontal: 12 }}>
            <Text
              style={{
                color: "#334155",
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              Recent Payments
            </Text>

            {myTransactions.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <DollarSign size={36} color="#1E293B" />
                <Text
                  style={{
                    color: "#334155",
                    fontSize: 14,
                    fontWeight: "600",
                    marginTop: 10,
                  }}
                >
                  No payments recorded yet
                </Text>
              </View>
            ) : (
              <View style={{ gap: 6 }}>
                {myTransactions.slice(0, 12).map((tx) => {
                  // Find the trip to get confirmation statuses and cached values
                  const trip = allTrips.find((t) => t.id === tx.appointment_id);
                  // Use cached driver_commission from trip record — it is the source of truth
                  const tripCommission = trip
                    ? Number(trip.driver_commission || 0)
                    : 0;
                  const tripTip = trip ? Number(trip.tips_total || 0) : 0;
                  const tripServicesTotal = trip
                    ? Number(trip.services_total || 0)
                    : 0;
                  // Do NOT recalculate commission if 0 — use stored value as-is
                  const tripTotal = tripCommission + tripTip;

                  return (
                    <View
                      key={tx.id}
                      style={{
                        backgroundColor: "#0F172A",
                        borderRadius: 12,
                        padding: 12,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "#1E293B",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: "#F1F5F9",
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                          numberOfLines={1}
                        >
                          {tx.description || tx.category || "Payment"}
                        </Text>
                        <Text
                          style={{
                            color: "#334155",
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          {formatDateOnly(tx.transaction_date)}
                          {tx.method ? ` · ${tx.method}` : ""}
                        </Text>
                        {/* Payment method + tip badges replace the old PASS/DRV badges */}
                        {trip && (
                          <View
                            style={{
                              flexDirection: "row",
                              gap: 4,
                              marginTop: 4,
                              flexWrap: "wrap",
                            }}
                          >
                            {/* Paid by [method] */}
                            {trip.payment_method && (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 2,
                                  backgroundColor: "#16A34A15",
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 4,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#4ADE80",
                                    fontSize: 9,
                                    fontWeight: "700",
                                  }}
                                >
                                  Paid by {trip.payment_method}
                                </Text>
                              </View>
                            )}
                            {/* Tip by Cash — only when there's a cash tip */}
                            {(() => {
                              const hasCashTip = myTransactions.some(
                                (t) =>
                                  t.appointment_id === trip.id &&
                                  (t.category === "tip" ||
                                    Number(t.tip_amount || 0) > 0) &&
                                  t.method === "Cash",
                              );
                              return hasCashTip ? (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 2,
                                    backgroundColor: "#D9770615",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 4,
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: "#FB923C",
                                      fontSize: 9,
                                      fontWeight: "700",
                                    }}
                                  >
                                    Tip by Cash
                                  </Text>
                                </View>
                              ) : null;
                            })()}
                          </View>
                        )}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            color: "#4ADE80",
                            fontSize: 14,
                            fontWeight: "700",
                          }}
                        >
                          {fmt(tripTotal)}
                        </Text>
                        <Text style={{ color: "#334155", fontSize: 10 }}>
                          {fmt(tripServicesTotal)} services
                        </Text>
                        {tripTip > 0 && (
                          <Text style={{ color: "#A78BFA", fontSize: 9 }}>
                            +{fmt(tripTip)} tip
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Approval Modal */}
      <Modal
        visible={showApprovalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowApprovalModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.7)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#0F172A",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: insets.bottom + 20,
              maxHeight: "90%",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingHorizontal: 20,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: "#F1F5F9",
                  fontSize: 20,
                  fontWeight: "800",
                }}
              >
                Approve Timesheet
              </Text>
              <TouchableOpacity onPress={() => setShowApprovalModal(false)}>
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }}>
              <View
                style={{
                  backgroundColor: "#1E3A5F",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: "#60A5FA",
                    fontSize: 11,
                    fontWeight: "700",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Period
                </Text>
                <Text style={{ color: "#F1F5F9", fontSize: 14 }}>
                  {new Date(dateRange.start + "T12:00:00").toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                    },
                  )}
                  {" — "}
                  {new Date(dateRange.end + "T12:00:00").toLocaleDateString(
                    "en-US",
                    {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </Text>
              </View>

              <Text
                style={{
                  color: "#CBD5E1",
                  fontSize: 13,
                  marginBottom: 16,
                }}
              >
                Do you approve this week's timesheet?
              </Text>

              {/* Yes option */}
              <TouchableOpacity
                onPress={() => {
                  setApproved(true);
                  setExplanation("");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: approved === true ? "#1D4ED8" : "#1E293B",
                  borderWidth: 2,
                  borderColor: approved === true ? "#3B82F6" : "#334155",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: approved === true ? "#fff" : "#475569",
                    backgroundColor:
                      approved === true ? "#2563EB" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {approved === true && <Check size={16} color="#fff" />}
                </View>
                <Text
                  style={{
                    color: approved === true ? "#fff" : "#94A3B8",
                    fontSize: 15,
                    fontWeight: "600",
                    flex: 1,
                  }}
                >
                  Yes, I approve this timesheet
                </Text>
              </TouchableOpacity>

              {/* No option */}
              <TouchableOpacity
                onPress={() => setApproved(false)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: approved === false ? "#1D4ED8" : "#1E293B",
                  borderWidth: 2,
                  borderColor: approved === false ? "#3B82F6" : "#334155",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: approved === false ? "#fff" : "#475569",
                    backgroundColor:
                      approved === false ? "#2563EB" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {approved === false && <X size={16} color="#fff" />}
                </View>
                <Text
                  style={{
                    color: approved === false ? "#fff" : "#94A3B8",
                    fontSize: 15,
                    fontWeight: "600",
                    flex: 1,
                  }}
                >
                  No, I do not approve
                </Text>
              </TouchableOpacity>

              {/* Explanation field (only shown when No is selected) */}
              {approved === false && (
                <View style={{ marginBottom: 20 }}>
                  <Text
                    style={{
                      color: "#CBD5E1",
                      fontSize: 13,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}
                  >
                    Why not? (Required)
                  </Text>
                  <TextInput
                    value={explanation}
                    onChangeText={setExplanation}
                    placeholder="Explain what's incorrect..."
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={4}
                    style={{
                      backgroundColor: "#1E293B",
                      borderWidth: 1,
                      borderColor: "#334155",
                      borderRadius: 10,
                      padding: 12,
                      color: "#F1F5F9",
                      fontSize: 14,
                      minHeight: 100,
                      textAlignVertical: "top",
                    }}
                  />
                </View>
              )}

              {/* Submit button */}
              <TouchableOpacity
                onPress={handleSubmitApproval}
                disabled={submitting || approved === null}
                style={{
                  backgroundColor:
                    submitting || approved === null ? "#334155" : "#2563EB",
                  borderRadius: 12,
                  paddingVertical: 16,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: "700",
                  }}
                >
                  {submitting
                    ? "Submitting..."
                    : existingApproval
                      ? "Update Response"
                      : "Submit Response"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Thank You Modal */}
      <Modal
        visible={showThankYou}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThankYou(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.8)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#0F172A",
              borderRadius: 24,
              padding: 30,
              alignItems: "center",
              maxWidth: 400,
              width: "100%",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#16A34A20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <CheckCircle size={36} color="#4ADE80" />
            </View>
            <Text
              style={{
                color: "#F1F5F9",
                fontSize: 24,
                fontWeight: "900",
                marginBottom: 8,
                textAlign: "center",
              }}
            >
              Thank You!
            </Text>
            <Text
              style={{
                color: "#94A3B8",
                fontSize: 15,
                textAlign: "center",
                marginBottom: 30,
              }}
            >
              Your response has been recorded and the company has been notified.
            </Text>
            <TouchableOpacity
              onPress={() => setShowThankYou(false)}
              style={{
                backgroundColor: "#2563EB",
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 40,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MiniStat({ icon, label, value, color }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0F172A",
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: "#1E293B",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon}
      <Text style={{ color, fontSize: 20, fontWeight: "800" }}>{value}</Text>
      <Text
        style={{
          color: "#334155",
          fontSize: 10,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function CompareRow({ label, revenue, earnings, active, fmt, separator }) {
  return (
    <View>
      {separator && <View style={{ height: 1, backgroundColor: "#1E293B" }} />}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: active ? "#0D1F3C" : "transparent",
        }}
      >
        {active && (
          <View
            style={{
              width: 3,
              height: 24,
              borderRadius: 2,
              backgroundColor: "#2563EB",
              marginRight: 10,
            }}
          />
        )}
        <Text
          style={{
            flex: 1,
            color: active ? "#F1F5F9" : "#475569",
            fontSize: 13,
            fontWeight: active ? "700" : "500",
          }}
        >
          {label}
        </Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              color: active ? "#4ADE80" : "#334155",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {fmt(earnings)}
          </Text>
          <Text style={{ color: active ? "#475569" : "#1E293B", fontSize: 10 }}>
            {fmt(revenue)} revenue
          </Text>
        </View>
      </View>
    </View>
  );
}
