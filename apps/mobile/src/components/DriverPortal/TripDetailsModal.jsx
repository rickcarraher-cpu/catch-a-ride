import React, { useCallback } from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Calendar from "expo-calendar";
import {
  X,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  DollarSign,
  FileText,
  Car,
  Luggage,
  Users,
  Plane,
  AlertCircle,
  CalendarPlus,
  Hash,
  Navigation,
  Flag,
  CreditCard,
  Star,
  Clipboard,
  Info,
  UserCheck,
  Tag,
  Globe,
  ShieldCheck,
  Repeat,
  Baby,
  Briefcase,
  CheckCircle,
  Circle,
} from "lucide-react-native";

// ─── Status configs ───────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#D97706", bg: "#FEF3C7" },
  confirmed: { label: "Confirmed", color: "#059669", bg: "#D1FAE5" },
  "in-progress": { label: "Active", color: "#2563EB", bg: "#DBEAFE" },
  completed: { label: "Completed", color: "#16A34A", bg: "#DCFCE7" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

const DRIVER_STATUS = {
  pending: { label: "Awaiting Response", color: "#D97706" },
  accepted: { label: "Accepted", color: "#059669" },
  declined: { label: "Declined", color: "#DC2626" },
};

const PASSENGER_STATUS = {
  pending: { label: "Awaiting Confirmation", color: "#D97706" },
  confirmed: { label: "Confirmed", color: "#059669" },
  cancelled: { label: "Cancelled", color: "#DC2626" },
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────
const InfoRow = ({ icon: Icon, label, value, mono, onPress, color }) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "N/A" ||
    value === "—"
  )
    return null;
  const textColor = color || "#1E293B";
  const content = (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 10,
          color: "#94A3B8",
          fontWeight: "700",
          letterSpacing: 0.8,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        {Icon && <Icon size={15} color="#64748B" style={{ marginTop: 2 }} />}
        <Text
          style={{
            fontSize: 14,
            color: textColor,
            flex: 1,
            lineHeight: 21,
            fontWeight: "400",
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
  if (onPress)
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  return content;
};

// ─── BadgeRow ─────────────────────────────────────────────────────────────────
const BadgeRow = ({ label, text, color, bg }) => {
  if (!text) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 10,
          color: "#94A3B8",
          fontWeight: "700",
          letterSpacing: 0.8,
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <View
        style={{
          alignSelf: "flex-start",
          backgroundColor: bg,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
        }}
      >
        <Text style={{ fontSize: 13, color: color, fontWeight: "700" }}>
          {text}
        </Text>
      </View>
    </View>
  );
};

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title }) => (
  <View
    style={{
      marginTop: 24,
      marginBottom: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    }}
  >
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: "#EFF6FF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {Icon && <Icon size={14} color="#2563EB" />}
    </View>
    <Text
      style={{
        fontSize: 12,
        fontWeight: "800",
        color: "#0F172A",
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      {title}
    </Text>
    <View
      style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0", marginLeft: 4 }}
    />
  </View>
);

// ─── CounterPill ──────────────────────────────────────────────────────────────
const CounterPill = ({ icon: Icon, label, value }) => {
  if (!value || value === 0 || value === "0") return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: "#F8FAFC",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
      }}
    >
      {Icon && <Icon size={13} color="#475569" />}
      <Text style={{ fontSize: 13, color: "#334155", fontWeight: "600" }}>
        {value} {label}
      </Text>
    </View>
  );
};

// ─── ServiceRow ───────────────────────────────────────────────────────────────
const ServiceRow = ({ name, price, qty }) => (
  <View
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: "#F1F5F9",
    }}
  >
    <Text style={{ fontSize: 13, color: "#334155", flex: 1 }}>
      {name}
      {qty > 1 ? ` ×${qty}` : ""}
    </Text>
    <Text style={{ fontSize: 13, color: "#0F172A", fontWeight: "600" }}>
      ${Number(price || 0).toFixed(2)}
    </Text>
  </View>
);

// ─── MoneyRow ─────────────────────────────────────────────────────────────────
const MoneyRow = ({ label, amount, bold, color }) => {
  const num = Number(amount);
  if (!amount || num === 0) return null;
  const textColor = color || (bold ? "#0F172A" : "#334155");
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          color: textColor,
          fontWeight: bold ? "700" : "400",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: textColor,
          fontWeight: bold ? "700" : "600",
        }}
      >
        ${num.toFixed(2)}
      </Text>
    </View>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function TripDetailsModal({ visible, trip, onClose }) {
  const insets = useSafeAreaInsets();

  const handleAddToCalendar = useCallback(async () => {
    if (!trip) return;
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Needed",
          "Calendar access is required to add this trip.",
        );
        return;
      }
      const calendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      const defaultCalendar =
        Platform.OS === "ios"
          ? calendars.find(
              (c) => c.allowsModifications && c.source?.name === "iCloud",
            ) ||
            calendars.find((c) => c.allowsModifications) ||
            calendars[0]
          : calendars.find(
              (c) => c.accessLevel === "owner" && c.allowsModifications,
            ) ||
            calendars.find((c) => c.allowsModifications) ||
            calendars[0];

      if (!defaultCalendar) {
        Alert.alert(
          "No Calendar",
          "No writable calendar found on this device.",
        );
        return;
      }

      const startDate = new Date(trip.start_time);
      const services = trip.appointment_services || [];
      const durationMs =
        (services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) ||
          75) *
        60 *
        1000;
      const endDate = new Date(startDate.getTime() + durationMs);

      const pickupAddr =
        trip.display_pickup_address ||
        trip.pickup_address ||
        trip.destination ||
        "";
      const notes = [
        trip.notes ? `Notes: ${trip.notes}` : "",
        trip.driver_notes ? `Driver Notes: ${trip.driver_notes}` : "",
        trip.outgoing_flight_info ? `Flight: ${trip.outgoing_flight_info}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await Calendar.createEventAsync(defaultCalendar.id, {
        title: `Trip: ${trip.client_name || "Passenger"} — ${trip.booking_number || ""}`,
        startDate,
        endDate,
        location: pickupAddr,
        notes,
        alarms: [{ relativeOffset: -30 }],
      });
      Alert.alert("✅ Added", "Trip has been added to your calendar.");
    } catch (e) {
      console.error("Calendar error:", e);
      Alert.alert("Error", "Could not add to calendar.");
    }
  }, [trip]);

  if (!trip) return null;

  // ─── Derived values ───────────────────────────────────────────────────────
  const statusCfg = STATUS_CONFIG[trip.status] || {
    label: trip.status || "Unknown",
    color: "#64748B",
    bg: "#F1F5F9",
  };
  const driverCfg = DRIVER_STATUS[trip.driver_accepted] || null;
  const passCfg = PASSENGER_STATUS[trip.passenger_confirmed] || null;

  const pickupAddr =
    trip.display_pickup_address ||
    [trip.pickup_street, trip.pickup_city, trip.pickup_state, trip.pickup_zip]
      .filter(Boolean)
      .join(", ") ||
    trip.pickup_address ||
    null;

  const dropoffAddr =
    trip.display_dropoff_address ||
    [
      trip.dropoff_street,
      trip.dropoff_city,
      trip.dropoff_state,
      trip.dropoff_zip,
    ]
      .filter(Boolean)
      .join(", ") ||
    trip.dropoff_address ||
    null;

  const formattedDate =
    trip.display_full_datetime ||
    (trip.start_time
      ? new Date(trip.start_time).toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "—");

  const returnDate =
    trip.display_return_date ||
    (trip.return_date
      ? new Date(trip.return_date).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : null);

  const tourEndTime =
    trip.display_tour_end_time ||
    (trip.tour_end_time
      ? new Date(trip.tour_end_time).toLocaleString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : null);

  const paymentDisplay =
    trip.display_payment_method || trip.payment_method || null;

  const appointmentServices = trip.appointment_services || [];
  const hasServices = appointmentServices.length > 0;
  const hasPayment =
    Number(trip.original_amount) > 0 || Number(trip.services_total) > 0;
  const hasCounters =
    trip.num_people ||
    trip.num_bags_checked ||
    trip.num_bags_carry_on ||
    trip.num_car_seats ||
    trip.num_golf_bags ||
    trip.special_items;

  const passengerName =
    trip.client_name ||
    trip.client?.name ||
    trip.passenger_name ||
    "Unknown Passenger";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
        {/* ── Header bar ──────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingTop: insets.top + 12,
            paddingBottom: 16,
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: "#E2E8F0",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: "#94A3B8",
                  fontWeight: "700",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 2,
                }}
              >
                Trip Details
              </Text>
              {trip.booking_number ? (
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: "#0F172A",
                    letterSpacing: -0.5,
                  }}
                >
                  #{trip.booking_number}
                </Text>
              ) : null}
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: statusCfg.bg,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: statusCfg.color,
                  }}
                >
                  {statusCfg.label}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Date card ─────────────────────────────────────────────── */}
          <View
            style={{
              backgroundColor: "#1E3A5F",
              borderRadius: 16,
              padding: 18,
              marginBottom: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <CalendarIcon size={15} color="#93C5FD" />
              <Text
                style={{
                  fontSize: 11,
                  color: "#93C5FD",
                  fontWeight: "700",
                  letterSpacing: 0.8,
                  textTransform: "uppercase",
                }}
              >
                Date & Time
              </Text>
            </View>
            <Text
              style={{
                fontSize: 17,
                color: "#FFFFFF",
                fontWeight: "700",
                lineHeight: 24,
              }}
            >
              {formattedDate}
            </Text>
            {returnDate ? (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#93C5FD",
                    fontWeight: "700",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Return Date
                </Text>
                <Text
                  style={{ fontSize: 14, color: "#E0EEFF", fontWeight: "500" }}
                >
                  {returnDate}
                </Text>
              </View>
            ) : null}
            {tourEndTime ? (
              <View
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "#93C5FD",
                    fontWeight: "700",
                    marginBottom: 3,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  Tour End Time
                </Text>
                <Text
                  style={{ fontSize: 14, color: "#E0EEFF", fontWeight: "500" }}
                >
                  {tourEndTime}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── Special flags ─────────────────────────────────────────── */}
          {trip.is_tentative || trip.is_tour || trip.is_international_flight ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              {trip.is_tentative && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "#FEF3C7",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <AlertCircle size={12} color="#D97706" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#D97706",
                      fontWeight: "700",
                    }}
                  >
                    Tentative
                  </Text>
                </View>
              )}
              {trip.is_tour && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "#EDE9FE",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Star size={12} color="#7C3AED" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#7C3AED",
                      fontWeight: "700",
                    }}
                  >
                    Tour
                  </Text>
                </View>
              )}
              {trip.is_international_flight && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    backgroundColor: "#DBEAFE",
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 20,
                  }}
                >
                  <Globe size={12} color="#2563EB" />
                  <Text
                    style={{
                      fontSize: 12,
                      color: "#2563EB",
                      fontWeight: "700",
                    }}
                  >
                    International Flight
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* ── Passenger ─────────────────────────────────────────────── */}
          <SectionHeader icon={User} title="Passenger" />
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <InfoRow icon={User} label="Name" value={passengerName} />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={trip.client_phone}
              onPress={
                trip.client_phone
                  ? () => Linking.openURL(`tel:${trip.client_phone}`)
                  : undefined
              }
              color={trip.client_phone ? "#2563EB" : undefined}
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={trip.client_email}
              onPress={
                trip.client_email
                  ? () => Linking.openURL(`mailto:${trip.client_email}`)
                  : undefined
              }
              color={trip.client_email ? "#2563EB" : undefined}
            />
            {passCfg && (
              <BadgeRow
                label="Passenger Confirmation"
                text={passCfg.label}
                color={passCfg.color}
                bg={passCfg.color + "22"}
              />
            )}
          </View>

          {/* ── Party & Baggage ───────────────────────────────────────── */}
          {hasCounters ? (
            <>
              <SectionHeader icon={Users} title="Party & Baggage" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  <CounterPill
                    icon={Users}
                    label={trip.num_people === 1 ? "Passenger" : "Passengers"}
                    value={trip.num_people}
                  />
                  <CounterPill
                    icon={Luggage}
                    label="Checked Bags"
                    value={trip.num_bags_checked}
                  />
                  <CounterPill
                    icon={Briefcase}
                    label="Carry-On"
                    value={trip.num_bags_carry_on}
                  />
                  <CounterPill
                    icon={Baby}
                    label="Car Seats"
                    value={trip.num_car_seats}
                  />
                  <CounterPill
                    icon={Flag}
                    label="Golf Bags"
                    value={trip.num_golf_bags}
                  />
                </View>
                {trip.special_items ? (
                  <View
                    style={{
                      marginTop: 10,
                      backgroundColor: "#FFFBEB",
                      borderRadius: 10,
                      padding: 12,
                      borderLeftWidth: 3,
                      borderLeftColor: "#D97706",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#94A3B8",
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      Special Items
                    </Text>
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#78350F",
                        lineHeight: 21,
                      }}
                    >
                      {trip.special_items}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ── Pickup & Drop-off ─────────────────────────────────────── */}
          <SectionHeader icon={MapPin} title="Pickup & Drop-off" />
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <InfoRow
              icon={Navigation}
              label="Pickup Address"
              value={pickupAddr}
              onPress={
                pickupAddr
                  ? () =>
                      Linking.openURL(
                        `maps://?q=${encodeURIComponent(pickupAddr)}`,
                      )
                  : undefined
              }
              color={pickupAddr ? "#2563EB" : undefined}
            />
            <InfoRow
              icon={MapPin}
              label="Drop-off Address"
              value={dropoffAddr}
              onPress={
                dropoffAddr
                  ? () =>
                      Linking.openURL(
                        `maps://?q=${encodeURIComponent(dropoffAddr)}`,
                      )
                  : undefined
              }
              color={dropoffAddr ? "#2563EB" : undefined}
            />
            <InfoRow
              icon={Flag}
              label="Destination / Area"
              value={trip.destination}
            />
            <InfoRow
              icon={Tag}
              label="Vehicle Category"
              value={trip.vehicle_category}
            />
            <InfoRow
              icon={Navigation}
              label="Distance"
              value={
                trip.distance_miles ? `${trip.distance_miles} miles` : null
              }
            />
          </View>

          {/* ── Flight Info ───────────────────────────────────────────── */}
          {trip.outgoing_flight_info ||
          trip.returning_flight_info ||
          trip.customs_clearance_location ? (
            <>
              <SectionHeader icon={Plane} title="Flight Information" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <InfoRow
                  icon={Plane}
                  label="Outgoing Flight"
                  value={trip.outgoing_flight_info}
                />
                <InfoRow
                  icon={Plane}
                  label="Returning Flight"
                  value={trip.returning_flight_info}
                />
                <InfoRow
                  icon={ShieldCheck}
                  label="Customs Clearance"
                  value={trip.customs_clearance_location}
                />
              </View>
            </>
          ) : null}

          {/* ── Vehicle & Driver ──────────────────────────────────────── */}
          <SectionHeader icon={Car} title="Vehicle & Driver" />
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <InfoRow
              icon={User}
              label="Assigned Driver"
              value={trip.employee_name}
            />
            <InfoRow
              icon={User}
              label="Requested Driver"
              value={trip.requested_driver_name}
            />
            <InfoRow icon={Car} label="Vehicle" value={trip.vehicle_name} />
            <InfoRow
              icon={Tag}
              label="Vehicle Category"
              value={trip.vehicle_actual_category || trip.vehicle_category}
            />
            {driverCfg && (
              <BadgeRow
                label="Driver Acceptance"
                text={driverCfg.label}
                color={driverCfg.color}
                bg={driverCfg.color + "22"}
              />
            )}
          </View>

          {/* ── Services ──────────────────────────────────────────────── */}
          {hasServices ? (
            <>
              <SectionHeader icon={Star} title="Services" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  paddingBottom: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                {appointmentServices.map((s, i) => (
                  <ServiceRow
                    key={i}
                    name={s.service_name || s.name || "Service"}
                    price={s.service_price}
                    qty={s.quantity || 1}
                  />
                ))}
              </View>
            </>
          ) : null}

          {/* ── Payment ───────────────────────────────────────────────── */}
          {hasPayment ? (
            <>
              <SectionHeader icon={DollarSign} title="Payment" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <InfoRow
                  icon={CreditCard}
                  label="Payment Method"
                  value={paymentDisplay}
                />
                {trip.gift_certificate ? (
                  <InfoRow
                    icon={Tag}
                    label="Gift Certificate"
                    value={trip.gift_certificate}
                  />
                ) : null}
                <View
                  style={{
                    height: 1,
                    backgroundColor: "#F1F5F9",
                    marginBottom: 10,
                  }}
                />
                <MoneyRow label="Services Total" amount={trip.services_total} />
                <MoneyRow label="CC Fee" amount={trip.cc_fee_amount} />
                <MoneyRow
                  label="Trip Total"
                  amount={trip.original_amount}
                  bold
                />
                <MoneyRow
                  label="Amount Paid"
                  amount={trip.payments_total}
                  color="#059669"
                />
                <MoneyRow
                  label="Tips"
                  amount={trip.tips_total}
                  color="#7C3AED"
                />
                {Number(trip.balance_due) !== 0 && (
                  <MoneyRow
                    label="Balance Due"
                    amount={trip.balance_due}
                    bold
                    color={Number(trip.balance_due) > 0 ? "#DC2626" : "#059669"}
                  />
                )}
                {trip.payment_status ? (
                  <View style={{ marginTop: 10 }}>
                    <BadgeRow
                      label="Payment Status"
                      text={
                        trip.payment_status.charAt(0).toUpperCase() +
                        trip.payment_status.slice(1)
                      }
                      color={
                        trip.payment_status === "paid"
                          ? "#059669"
                          : trip.payment_status === "partial"
                            ? "#D97706"
                            : "#DC2626"
                      }
                      bg={
                        trip.payment_status === "paid"
                          ? "#D1FAE5"
                          : trip.payment_status === "partial"
                            ? "#FEF3C7"
                            : "#FEE2E2"
                      }
                    />
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ── Tour Details ──────────────────────────────────────────── */}
          {trip.is_tour ? (
            <>
              <SectionHeader icon={Star} title="Tour Details" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                }}
              >
                <InfoRow
                  icon={Users}
                  label="Participant Type"
                  value={trip.tour_participant_type}
                />
                <InfoRow
                  icon={DollarSign}
                  label="Tour Flat Fee"
                  value={
                    trip.tour_flat_fee
                      ? `$${Number(trip.tour_flat_fee).toFixed(2)}`
                      : null
                  }
                />
                <InfoRow
                  icon={Tag}
                  label="Payment Split"
                  value={trip.tour_payment_split}
                />
              </View>
            </>
          ) : null}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          {trip.notes || trip.driver_notes || trip.tentative_reason ? (
            <>
              <SectionHeader icon={FileText} title="Notes" />
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 14,
                  padding: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 1,
                  gap: 12,
                }}
              >
                {trip.notes ? (
                  <View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#94A3B8",
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Trip Notes
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#F8FAFC",
                        borderRadius: 10,
                        padding: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: "#2563EB",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#334155",
                          lineHeight: 21,
                        }}
                      >
                        {trip.notes}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {trip.driver_notes ? (
                  <View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#94A3B8",
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Driver Notes
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#FFFBEB",
                        borderRadius: 10,
                        padding: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: "#D97706",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#78350F",
                          lineHeight: 21,
                        }}
                      >
                        {trip.driver_notes}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {trip.tentative_reason ? (
                  <View>
                    <Text
                      style={{
                        fontSize: 10,
                        color: "#94A3B8",
                        fontWeight: "700",
                        letterSpacing: 0.8,
                        marginBottom: 6,
                        textTransform: "uppercase",
                      }}
                    >
                      Tentative Reason
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#FEF3C7",
                        borderRadius: 10,
                        padding: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: "#D97706",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#92400E",
                          lineHeight: 21,
                        }}
                      >
                        {trip.tentative_reason}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          {/* ── Booking Info ──────────────────────────────────────────── */}
          <SectionHeader icon={Clipboard} title="Booking Info" />
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <InfoRow
              icon={Hash}
              label="Booking Number"
              value={trip.booking_number}
            />
            <InfoRow icon={User} label="Booked By" value={trip.booked_by} />
            <InfoRow
              icon={UserCheck}
              label="Booker Name"
              value={trip.booker_name}
            />
            <InfoRow
              icon={Repeat}
              label="Partner Company"
              value={trip.partner_company_name}
            />
            {trip.created_at ? (
              <InfoRow
                icon={CalendarIcon}
                label="Created"
                value={new Date(trip.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              />
            ) : null}
          </View>

          {/* ── Add to Calendar ───────────────────────────────────────── */}
          <TouchableOpacity
            onPress={handleAddToCalendar}
            style={{
              marginTop: 28,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 15,
              backgroundColor: "#1E3A5F",
              borderRadius: 14,
              shadowColor: "#1E3A5F",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <CalendarPlus size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
              Add to Calendar
            </Text>
          </TouchableOpacity>

          {/* ── Read-only notice ──────────────────────────────────────── */}
          <View
            style={{
              marginTop: 14,
              padding: 12,
              backgroundColor: "#F1F5F9",
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Info size={13} color="#64748B" style={{ marginTop: 1 }} />
            <Text
              style={{
                fontSize: 12,
                color: "#64748B",
                fontStyle: "italic",
                flex: 1,
                lineHeight: 18,
              }}
            >
              Read-only view. Contact the office to make any changes to this
              trip.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
