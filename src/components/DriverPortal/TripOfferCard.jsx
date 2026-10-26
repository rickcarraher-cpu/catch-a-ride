"use client";

import {
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  Plane,
  Users,
  Phone,
  Mail,
  Car,
  Briefcase,
  StickyNote,
  DollarSign,
  Loader2,
} from "lucide-react";

function getInitials(name) {
  if (!name) return "CR";
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function DetailRow({ icon: Icon, iconBg, iconColor, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={16} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <div className="text-sm font-medium text-gray-900 break-words">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * TripOfferCard — the card a driver sees for a trip assignment.
 * Matches the mockups: driver header up top, clean trip detail rows,
 * and Accept / Decline actions at the bottom.
 */
export function TripOfferCard({
  trip,
  onAccept,
  onDecline,
  isSubmitting = false,
  accepting = false,
  error = null,
  hideActions = false,
}) {
  if (!trip) return null;

  const driverName = trip.driver_name || "CatchARide";
  const initials = getInitials(trip.driver_name);
  const driverPhoto = trip.driver_photo_url;
  const passengerName = trip.passenger_name || trip.client_name;
  const passengerPhone = trip.passenger_phone || trip.client_phone;
  const passengerEmail = trip.passenger_email || trip.client_email;
  const dropoffDisplay = trip.dropoff_address || trip.destination;
  const hasBagInfo =
    trip.num_bags_checked > 0 ||
    trip.num_bags_carry_on > 0 ||
    trip.num_car_seats > 0 ||
    trip.num_golf_bags > 0;

  const bagChips = [
    trip.num_people
      ? `👥 ${trip.num_people} ${trip.num_people === 1 ? "person" : "people"}`
      : null,
    trip.num_bags_checked > 0 ? `🧳 ${trip.num_bags_checked} checked` : null,
    trip.num_bags_carry_on > 0 ? `👜 ${trip.num_bags_carry_on} carry-on` : null,
    trip.num_car_seats > 0
      ? `🪑 ${trip.num_car_seats} car seat${trip.num_car_seats > 1 ? "s" : ""}`
      : null,
    trip.num_golf_bags > 0
      ? `⛳ ${trip.num_golf_bags} golf bag${trip.num_golf_bags > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  const dateLine =
    trip.display_full_datetime ||
    [trip.display_long_date, trip.display_time].filter(Boolean).join(" at ") ||
    trip.display_long_date ||
    "";

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
      {/* ── Driver header ── */}
      <div className="px-6 pt-6 pb-5 flex items-center gap-4 border-b border-gray-100">
        {driverPhoto ? (
          <img
            src={driverPhoto}
            alt={driverName}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-100 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Your Driver
          </p>
          <h2 className="text-xl font-bold text-gray-900 truncate">
            {driverName}
          </h2>
        </div>
      </div>

      {/* ── Trip details ── */}
      <div className="px-6 py-5 space-y-4">
        {dateLine && (
          <DetailRow
            icon={Calendar}
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Date & Time"
          >
            {dateLine}
          </DetailRow>
        )}

        {trip.pickup_address && (
          <DetailRow
            icon={MapPin}
            iconBg="#ECFDF5"
            iconColor="#059669"
            label="Pickup"
          >
            {trip.pickup_address}
          </DetailRow>
        )}

        {dropoffDisplay && (
          <DetailRow
            icon={MapPin}
            iconBg="#FEF2F2"
            iconColor="#DC2626"
            label="Dropoff"
          >
            {dropoffDisplay}
          </DetailRow>
        )}

        {(trip.outgoing_flight_info || trip.returning_flight_info) && (
          <DetailRow
            icon={Plane}
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            label="Flight Info"
          >
            <div className="space-y-0.5">
              {trip.outgoing_flight_info && (
                <p>✈️ Out: {trip.outgoing_flight_info}</p>
              )}
              {trip.returning_flight_info && (
                <p>✈️ Return: {trip.returning_flight_info}</p>
              )}
            </div>
          </DetailRow>
        )}

        {passengerName && (
          <DetailRow
            icon={Users}
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            label="Passenger"
          >
            <div className="space-y-0.5">
              <p>{passengerName}</p>
              {passengerPhone && (
                <a
                  href={`tel:${passengerPhone}`}
                  className="inline-flex items-center gap-1 text-blue-600 font-medium"
                >
                  <Phone size={13} />
                  {passengerPhone}
                </a>
              )}
              {passengerEmail && (
                <a
                  href={`mailto:${passengerEmail}`}
                  className="flex items-center gap-1 text-blue-600 font-medium break-all"
                >
                  <Mail size={13} />
                  {passengerEmail}
                </a>
              )}
            </div>
          </DetailRow>
        )}

        {trip.vehicle_name && (
          <DetailRow
            icon={Car}
            iconBg="#F8FAFC"
            iconColor="#475569"
            label="Vehicle"
          >
            {trip.vehicle_name}
          </DetailRow>
        )}

        {hasBagInfo && (
          <DetailRow
            icon={Briefcase}
            iconBg="#FFF7ED"
            iconColor="#EA580C"
            label="Passengers & Bags"
          >
            <div className="flex flex-wrap gap-2 mt-1">
              {bagChips.map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-sm bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                >
                  {chip}
                </span>
              ))}
            </div>
          </DetailRow>
        )}

        {/* Services & total */}
        {trip.services && trip.services.length > 0 && (
          <DetailRow
            icon={DollarSign}
            iconBg="#ECFDF5"
            iconColor="#059669"
            label="Trip Total"
          >
            <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-1">
              {trip.services.map((s, i) => {
                const lineTotal =
                  Number(s.service_price || 0) * Number(s.quantity || 1);
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {s.service_name || "Service"}
                      {s.quantity > 1 ? ` ×${s.quantity}` : ""}
                    </span>
                    <span className="font-medium text-gray-900">
                      ${lineTotal.toFixed(2)}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1 mt-1">
                <span>Total</span>
                <span>
                  $
                  {Number(
                    trip.original_amount != null
                      ? trip.original_amount
                      : trip.services.reduce(
                          (sum, s) =>
                            sum +
                            Number(s.service_price || 0) *
                              Number(s.quantity || 1),
                          0,
                        ),
                  ).toFixed(2)}
                </span>
              </div>
            </div>
          </DetailRow>
        )}

        {trip.notes && (
          <DetailRow
            icon={StickyNote}
            iconBg="#F8FAFC"
            iconColor="#64748B"
            label="Passenger Notes"
          >
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mt-1">
              {trip.notes}
            </p>
          </DetailRow>
        )}

        {trip.driver_notes && (
          <DetailRow
            icon={StickyNote}
            iconBg="#FEFCE8"
            iconColor="#CA8A04"
            label="Driver Notes"
          >
            <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-1">
              {trip.driver_notes}
            </p>
          </DetailRow>
        )}
      </div>

      {/* ── Actions ── */}
      {!hideActions && (onAccept || onDecline) && (
        <div className="px-6 pb-6 pt-1 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {onAccept && (
              <button
                onClick={onAccept}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-4 px-4 rounded-2xl hover:bg-green-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accepting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Accepting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>Accept</span>
                  </>
                )}
              </button>
            )}
            {onDecline && (
              <button
                onClick={onDecline}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-4 px-4 rounded-2xl hover:bg-red-700 transition-colors shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle size={20} />
                <span>Decline</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
