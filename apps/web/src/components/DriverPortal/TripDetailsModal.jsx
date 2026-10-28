"use client";

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
  // Add new icons for additional fields
  Building,
  Hash,
  Edit3,
} from "lucide-react";

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
const InfoRow = ({ icon: Icon, label, value, mono, onClick, color }) => {
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
    <div className="mb-3.5">
      <div className="text-[10px] text-slate-400 font-bold tracking-wider mb-1 uppercase">
        {label}
      </div>
      <div className="flex items-start gap-2">
        {Icon && <Icon size={15} className="text-slate-500 mt-0.5" />}
        <div
          className={`text-sm flex-1 leading-relaxed ${mono ? "font-mono" : ""}`}
          style={{ color: textColor }}
        >
          {value}
        </div>
      </div>
    </div>
  );
  if (onClick)
    return (
      <button onClick={onClick} className="text-left w-full hover:opacity-80">
        {content}
      </button>
    );
  return content;
};

// ─── BadgeRow ─────────────────────────────────────────────────────────────────
const BadgeRow = ({ label, text, color, bg }) => {
  if (!text) return null;
  return (
    <div className="mb-3.5">
      <div className="text-[10px] text-slate-400 font-bold tracking-wider mb-1 uppercase">
        {label}
      </div>
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ color, backgroundColor: bg }}
      >
        {text}
      </div>
    </div>
  );
};

// ─── SectionHeader ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
    {Icon && <Icon size={18} className="text-indigo-600" />}
    <h3 className="text-base font-bold text-slate-800">{title}</h3>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TripDetailsModal({ trip, onClose }) {
  if (!trip) return null;

  console.log("[TripDetailsModal] Trip object passenger fields:", {
    client_name: trip.client_name,
    passenger_name: trip.passenger_name,
    booker_name: trip.booker_name,
    client_id: trip.client_id,
    booking_number: trip.booking_number,
  });

  const statusConfig = STATUS_CONFIG[trip.status] || STATUS_CONFIG.pending;
  const driverStatusConfig =
    DRIVER_STATUS[trip.driver_accepted] || DRIVER_STATUS.pending;
  const passengerStatusConfig =
    PASSENGER_STATUS[trip.passenger_confirmed] || PASSENGER_STATUS.pending;

  // ─── Format helpers ─────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return null;
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  const formatPhone = (phone) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // ─── Computed values ────────────────────────────────────────────────────────
  const pickupAddress =
    trip.pickup_address ||
    [trip.pickup_street, trip.pickup_city, trip.pickup_state, trip.pickup_zip]
      .filter(Boolean)
      .join(", ") ||
    null;

  const dropoffAddress =
    trip.dropoff_address ||
    [
      trip.dropoff_street,
      trip.dropoff_city,
      trip.dropoff_state,
      trip.dropoff_zip,
    ]
      .filter(Boolean)
      .join(", ") ||
    null;

  const passengerName =
    trip.client_name ||
    trip.passenger_name ||
    trip.booker_name ||
    "Unknown Passenger";
  const passengerPhone = trip.client_phone || trip.passenger_phone || null;
  const passengerEmail = trip.client_email || trip.passenger_email || null;

  const driverName =
    trip.employee?.name || trip.requested_driver_name || "Unassigned";
  const vehicleName = trip.vehicle?.name || trip.vehicle_category || null;

  const servicesText =
    trip.services
      ?.map((s) => s.service?.name || s.name)
      .filter(Boolean)
      .join(", ") || null;

  const isTour = trip.is_tour;
  const isWedding = !!trip.wedding_id;
  const isThirdParty = trip.is_third_party;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
              <Car size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Trip Details</h2>
              {trip.booking_number && (
                <p className="text-xs text-slate-500 font-mono">
                  #{trip.booking_number}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm"
          >
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        {/* ── Scrollable Content ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── Status Badges ─────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                color: statusConfig.color,
                backgroundColor: statusConfig.bg,
              }}
            >
              <Circle size={8} fill={statusConfig.color} />
              {statusConfig.label}
            </div>
            {trip.driver_accepted && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  color: driverStatusConfig.color,
                  backgroundColor: `${driverStatusConfig.color}15`,
                }}
              >
                {trip.driver_accepted === "accepted" ? (
                  <CheckCircle size={12} />
                ) : (
                  <Circle size={8} />
                )}
                Driver: {driverStatusConfig.label}
              </div>
            )}
            {trip.passenger_confirmed && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  color: passengerStatusConfig.color,
                  backgroundColor: `${passengerStatusConfig.color}15`,
                }}
              >
                {trip.passenger_confirmed === "confirmed" ? (
                  <CheckCircle size={12} />
                ) : (
                  <Circle size={8} />
                )}
                Passenger: {passengerStatusConfig.label}
              </div>
            )}
            {isTour && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                <Star size={12} />
                Tour
              </div>
            )}
            {isWedding && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">
                <Star size={12} />
                Wedding
              </div>
            )}
            {isThirdParty && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                <Globe size={12} />
                Third Party
              </div>
            )}
            {trip.is_tentative && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                <AlertCircle size={12} />
                Tentative
              </div>
            )}
          </div>

          {/* ── Date & Time ────────────────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={Clock} title="Date & Time" />
            <InfoRow
              icon={CalendarIcon}
              label="Date"
              value={trip.display_long_date || formatDate(trip.start_time)}
            />
            <InfoRow
              icon={Clock}
              label="Pickup Time"
              value={trip.display_time || formatTime(trip.start_time)}
            />
            {trip.return_date && (
              <InfoRow
                icon={Repeat}
                label="Return Date"
                value={trip.display_return_date || formatDate(trip.return_date)}
              />
            )}
            {trip.tour_end_time && (
              <InfoRow
                icon={Clock}
                label="Tour End Time"
                value={
                  trip.display_tour_end_time || formatTime(trip.tour_end_time)
                }
              />
            )}
          </div>

          {/* ── Passenger Information ──────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={User} title="Passenger Information" />
            <InfoRow icon={User} label="Name" value={passengerName} />
            {passengerPhone && (
              <InfoRow
                icon={Phone}
                label="Phone"
                value={formatPhone(passengerPhone)}
                onClick={() => window.open(`tel:${passengerPhone}`)}
              />
            )}
            {passengerEmail && (
              <InfoRow
                icon={Mail}
                label="Email"
                value={passengerEmail}
                onClick={() => window.open(`mailto:${passengerEmail}`)}
              />
            )}
            {trip.num_people && (
              <InfoRow
                icon={Users}
                label="Passengers"
                value={`${trip.num_people} ${trip.num_people === 1 ? "person" : "people"}`}
              />
            )}
          </div>

          {/* ── Locations ───────────────────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={MapPin} title="Locations" />
            {pickupAddress && (
              <InfoRow
                icon={Navigation}
                label="Pickup Location"
                value={trip.display_pickup_address || pickupAddress}
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`,
                  )
                }
              />
            )}
            {dropoffAddress && (
              <InfoRow
                icon={Flag}
                label="Dropoff Location"
                value={trip.display_dropoff_address || dropoffAddress}
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoffAddress)}`,
                  )
                }
              />
            )}
            {trip.destination && (
              <InfoRow
                icon={MapPin}
                label="Destination"
                value={trip.destination}
              />
            )}
            {trip.distance_miles && (
              <InfoRow
                icon={Navigation}
                label="Distance"
                value={`${trip.distance_miles} miles`}
              />
            )}
            {trip.customs_clearance_location && (
              <InfoRow
                icon={ShieldCheck}
                label="Customs Clearance"
                value={trip.customs_clearance_location}
              />
            )}
          </div>

          {/* ── Driver & Vehicle ────────────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={Car} title="Driver & Vehicle" />
            <InfoRow icon={UserCheck} label="Driver" value={driverName} />
            {vehicleName && (
              <InfoRow icon={Car} label="Vehicle" value={vehicleName} />
            )}
            {trip.driver_commission && (
              <InfoRow
                icon={DollarSign}
                label="Driver Commission"
                value={formatCurrency(trip.driver_commission)}
              />
            )}
            {trip.driver_paid !== null && trip.driver_paid !== undefined && (
              <BadgeRow
                label="Driver Payment Status"
                text={trip.driver_paid ? "Paid" : "Unpaid"}
                color={trip.driver_paid ? "#059669" : "#D97706"}
                bg={trip.driver_paid ? "#D1FAE5" : "#FEF3C7"}
              />
            )}
            {trip.driver_paid && trip.driver_paid_at && (
              <InfoRow
                icon={CalendarIcon}
                label="Driver Paid On"
                value={formatDateTime(trip.driver_paid_at)}
              />
            )}
            {trip.driver_paid && trip.driver_paid_by && (
              <InfoRow
                icon={User}
                label="Driver Paid By"
                value={trip.driver_paid_by}
              />
            )}
          </div>

          {/* ── Services ────────────────────────────────────────────────────── */}
          {servicesText && (
            <div className="mb-6">
              <SectionHeader icon={Tag} title="Services" />
              <InfoRow icon={Tag} label="Services" value={servicesText} />
            </div>
          )}

          {/* ── Baggage & Special Items ────────────────────────────────────── */}
          {(trip.num_bags_checked ||
            trip.num_bags_carry_on ||
            trip.num_car_seats ||
            trip.num_golf_bags ||
            trip.special_items) && (
            <div className="mb-6">
              <SectionHeader icon={Luggage} title="Baggage & Special Items" />
              {trip.num_bags_checked > 0 && (
                <InfoRow
                  icon={Luggage}
                  label="Checked Bags"
                  value={trip.num_bags_checked}
                />
              )}
              {trip.num_bags_carry_on > 0 && (
                <InfoRow
                  icon={Briefcase}
                  label="Carry-On Bags"
                  value={trip.num_bags_carry_on}
                />
              )}
              {trip.num_car_seats > 0 && (
                <InfoRow
                  icon={Baby}
                  label="Car Seats"
                  value={trip.num_car_seats}
                />
              )}
              {trip.num_golf_bags > 0 && (
                <InfoRow
                  icon={Flag}
                  label="Golf Bags"
                  value={trip.num_golf_bags}
                />
              )}
              {trip.special_items && (
                <InfoRow
                  icon={Luggage}
                  label="Special Items"
                  value={trip.special_items}
                />
              )}
            </div>
          )}

          {/* ── Flight Information ──────────────────────────────────────────── */}
          {(trip.outgoing_flight_info || trip.returning_flight_info) && (
            <div className="mb-6">
              <SectionHeader icon={Plane} title="Flight Information" />
              {trip.outgoing_flight_info && (
                <InfoRow
                  icon={Plane}
                  label="Outgoing Flight"
                  value={trip.outgoing_flight_info}
                />
              )}
              {trip.returning_flight_info && (
                <InfoRow
                  icon={Plane}
                  label="Return Flight"
                  value={trip.returning_flight_info}
                />
              )}
              {trip.is_international_flight && (
                <InfoRow
                  icon={Globe}
                  label="International Flight"
                  value="Yes"
                />
              )}
            </div>
          )}

          {/* ── Payment Information ─────────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={DollarSign} title="Payment Information" />
            {trip.services_total && (
              <InfoRow
                icon={DollarSign}
                label="Services Total"
                value={formatCurrency(trip.services_total)}
              />
            )}
            {trip.cc_fee_amount > 0 && (
              <InfoRow
                icon={CreditCard}
                label="CC Fee"
                value={formatCurrency(trip.cc_fee_amount)}
              />
            )}
            {trip.original_amount && (
              <InfoRow
                icon={DollarSign}
                label="Total Amount"
                value={formatCurrency(trip.original_amount)}
              />
            )}
            {trip.payments_total > 0 && (
              <InfoRow
                icon={CheckCircle}
                label="Paid"
                value={formatCurrency(trip.payments_total)}
                color="#059669"
              />
            )}
            {trip.tips_total > 0 && (
              <InfoRow
                icon={Star}
                label="Tips"
                value={formatCurrency(trip.tips_total)}
                color="#7C3AED"
              />
            )}
            {trip.balance_due !== null && trip.balance_due !== undefined && (
              <InfoRow
                icon={AlertCircle}
                label="Balance Due"
                value={formatCurrency(trip.balance_due)}
                color={trip.balance_due > 0 ? "#DC2626" : "#059669"}
              />
            )}
            {trip.payment_method && (
              <InfoRow
                icon={CreditCard}
                label="Payment Method"
                value={trip.display_payment_method || trip.payment_method}
              />
            )}
            {trip.payment_status && (
              <BadgeRow
                label="Payment Status"
                text={trip.payment_status}
                color={trip.payment_status === "paid" ? "#059669" : "#D97706"}
                bg={trip.payment_status === "paid" ? "#D1FAE5" : "#FEF3C7"}
              />
            )}
            {trip.gift_certificate && (
              <InfoRow
                icon={Tag}
                label="Gift Certificate"
                value={trip.gift_certificate}
              />
            )}
          </div>

          {/* ── Notes ───────────────────────────────────────────────────────── */}
          {(trip.notes || trip.driver_notes || trip.tentative_reason) && (
            <div className="mb-6">
              <SectionHeader icon={FileText} title="Notes" />
              {trip.notes && (
                <InfoRow
                  icon={Clipboard}
                  label="Trip Notes"
                  value={trip.notes}
                />
              )}
              {trip.driver_notes && (
                <InfoRow
                  icon={AlertCircle}
                  label="Driver Notes"
                  value={trip.driver_notes}
                />
              )}
              {trip.tentative_reason && (
                <InfoRow
                  icon={AlertCircle}
                  label="Tentative Reason"
                  value={trip.tentative_reason}
                />
              )}
            </div>
          )}

          {/* ── Third Party Information ─────────────────────────────────────── */}
          {isThirdParty && (
            <div className="mb-6">
              <SectionHeader icon={Globe} title="Third Party Information" />
              {trip.partner_company_name && (
                <InfoRow
                  icon={Briefcase}
                  label="Partner Company"
                  value={trip.partner_company_name}
                />
              )}
              {trip.passenger_payer_name && (
                <InfoRow
                  icon={User}
                  label="Payer Name"
                  value={trip.passenger_payer_name}
                />
              )}
              {trip.passenger_payer_email && (
                <InfoRow
                  icon={Mail}
                  label="Payer Email"
                  value={trip.passenger_payer_email}
                />
              )}
              {trip.passenger_payer_phone && (
                <InfoRow
                  icon={Phone}
                  label="Payer Phone"
                  value={formatPhone(trip.passenger_payer_phone)}
                />
              )}
              {trip.internal_operator && (
                <InfoRow
                  icon={Building}
                  label="Internal Operator"
                  value={trip.internal_operator}
                />
              )}
            </div>
          )}

          {/* ── Tour Information ────────────────────────────────────────────── */}
          {isTour && (
            <div className="mb-6">
              <SectionHeader icon={Star} title="Tour Information" />
              {trip.tour_participant_type && (
                <InfoRow
                  icon={Users}
                  label="Participant Type"
                  value={trip.tour_participant_type}
                />
              )}
              {trip.tour_flat_fee && (
                <InfoRow
                  icon={DollarSign}
                  label="Tour Flat Fee"
                  value={formatCurrency(trip.tour_flat_fee)}
                />
              )}
              {trip.tour_payment_split && (
                <InfoRow
                  icon={CreditCard}
                  label="Payment Split"
                  value={trip.tour_payment_split}
                />
              )}
            </div>
          )}

          {/* ── Booking Information ─────────────────────────────────────────── */}
          <div className="mb-6">
            <SectionHeader icon={Clipboard} title="Booking Information" />
            {trip.booking_number && (
              <InfoRow
                icon={Hash}
                label="Booking Number"
                value={trip.booking_number}
                mono
              />
            )}
            {trip.booked_by && (
              <InfoRow icon={User} label="Booked By" value={trip.booked_by} />
            )}
            {trip.booked_by_dispatcher && (
              <InfoRow
                icon={UserCheck}
                label="Dispatcher"
                value={trip.booked_by_dispatcher}
              />
            )}
            {trip.booker_name && (
              <InfoRow
                icon={User}
                label="Booker Name"
                value={trip.booker_name}
              />
            )}
            {trip.created_at && (
              <InfoRow
                icon={CalendarIcon}
                label="Created"
                value={formatDateTime(trip.created_at)}
              />
            )}
            {trip.last_modified_by && (
              <InfoRow
                icon={Edit3}
                label="Last Modified By"
                value={trip.last_modified_by}
              />
            )}
          </div>

          {/* ── Add to Calendar Button ──────────────────────────────────────── */}
          <a
            href={`/api/appointments/${trip.id}/ics?recipient=driver`}
            download={`booking-${trip.booking_number || trip.id}.ics`}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors mb-4"
          >
            <CalendarPlus size={18} />
            Add to Calendar
          </a>

          {/* ── Read-only Notice ────────────────────────────────────────────── */}
          <div className="p-3 bg-slate-100 rounded-lg flex items-start gap-2">
            <Info size={13} className="text-slate-500 mt-0.5" />
            <p className="text-xs text-slate-500 italic flex-1 leading-relaxed">
              Read-only view. Contact the office to make any changes to this
              trip.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
