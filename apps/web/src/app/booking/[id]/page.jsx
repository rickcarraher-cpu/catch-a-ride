"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  User,
  Car,
  Phone,
  MapPin,
  Hash,
  Luggage,
  PlaneTakeoff,
  PlaneLanding,
  CalendarClock,
  AlertTriangle,
  CheckCircle2,
  Bell,
  CreditCard,
  ExternalLink,
  ArrowLeft,
  X,
  Baby,
} from "lucide-react";
import { formatDateCDT, formatTimeCDT } from "@/utils/timezone";

function formatLongDate(dt) {
  return formatDateCDT(dt, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dt) {
  return formatTimeCDT(dt, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateOnlyLocal(dateStr) {
  if (!dateStr) return "N/A";
  try {
    const str =
      typeof dateStr === "string" ? dateStr : new Date(dateStr).toISOString();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "N/A";
    const [, year, month, day] = match;
    const d = new Date(`${year}-${month}-${day}T12:00:00Z`);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "N/A";
  }
}

function DetailRow({ icon: Icon, label, value, accent, alwaysShow }) {
  if (!value && !alwaysShow) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`mt-0.5 shrink-0 ${accent || "text-gray-400"}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900 break-words">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export default function BookingDetailsPage({ params }) {
  const { id } = params;
  const queryClient = useQueryClient();

  // Detect Square redirect query params
  const [showPaymentSuccess, setShowPaymentSuccess] = React.useState(false);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get("payment") === "success" &&
      urlParams.get("transactionId")
    ) {
      setShowPaymentSuccess(true);
      // Clean up URL
      window.history.replaceState({}, "", `/booking/${id}`);
    }
  }, [id]);

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${id}`);
      if (!res.ok) throw new Error("Booking not found");
      return res.json();
    },
  });

  // Fetch payment status
  const { data: paymentInfo } = useQuery({
    queryKey: ["payment-status", id],
    queryFn: async () => {
      const res = await fetch(`/api/payments/trip/${id}/status`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: false, // Disabled — was polling every 15s
    enabled: !!booking,
  });

  // Mutation to generate payment link
  const generatePaymentLink = useMutation({
    mutationFn: async () => {
      // Use the booking's payment method to pick the correct provider
      const methodMap = {
        Venmo: "venmo",
        Zelle: "zelle",
        Square: "square",
      };
      const provider = methodMap[booking?.payment_method] || "square";

      const res = await fetch(`/api/payments/trip/${id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: id,
          provider: provider,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate payment link");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["payment-status", id]);
    },
  });

  const businessName = settings?.business_name || "Catch A Ride";
  const logoUrl = settings?.logo_url;

  const grandTotal =
    booking?.services?.reduce(
      (sum, s) => sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    ) ?? 0;

  const statusColors = {
    confirmed: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-orange-50 text-orange-700 border-orange-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
    "no-show": "bg-red-50 text-red-700 border-red-200",
  };

  const statusIcons = {
    confirmed: <CheckCircle2 size={14} />,
    pending: <Clock size={14} />,
    completed: <CheckCircle2 size={14} />,
    cancelled: <AlertTriangle size={14} />,
    "no-show": <AlertTriangle size={14} />,
  };

  const bagParts = [];
  if (booking?.num_bags_checked)
    bagParts.push(`${booking.num_bags_checked} Checked`);
  if (booking?.num_bags_carry_on)
    bagParts.push(`${booking.num_bags_carry_on} Carry-on`);

  const baggageDisplay = bagParts.length > 0 ? bagParts.join(" + ") : "None";

  // Determine flight info label based on trip direction
  // If pickup is at airport → passenger ARRIVING (incoming flight)
  // If dropoff is at airport → passenger DEPARTING (outgoing/departing flight)
  const airportKeywords = ["airport", "terminal", "concourse"];
  const pickupAddrLower = (
    booking?.pickup_street ||
    booking?.pickup_address ||
    ""
  ).toLowerCase();
  const dropoffAddrLower = (
    booking?.dropoff_street ||
    booking?.dropoff_address ||
    ""
  ).toLowerCase();
  const isPickupAtAirport = airportKeywords.some((kw) =>
    pickupAddrLower.includes(kw),
  );
  const isDropoffAtAirport = airportKeywords.some((kw) =>
    dropoffAddrLower.includes(kw),
  );
  // If dropoff at airport → departing; if pickup at airport → arriving; otherwise default to "Outgoing Flight"
  const flightLabel =
    isPickupAtAirport && !isDropoffAtAirport
      ? "Incoming Flight"
      : "Outgoing Flight";
  const FlightIcon =
    isPickupAtAirport && !isDropoffAtAirport ? PlaneLanding : PlaneTakeoff;

  // Determine payment display state
  const activePayment = paymentInfo?.activePayment;
  // Use balance_due from the booking API for accurate paid status
  const bookingBalanceDue = Number(booking?.balance_due ?? -1);
  const isPaid =
    (bookingBalanceDue >= 0 && bookingBalanceDue <= 0) ||
    paymentInfo?.trip?.payment_status === "paid" ||
    activePayment?.status === "paid";
  const hasPaymentLink =
    activePayment?.payment_url &&
    (activePayment?.status === "link_created" ||
      activePayment?.status === "pending");
  // Show payment section for any unpaid booking that isn't cancelled/deleted and isn't cash
  const isCashPayment =
    booking?.payment_method && booking.payment_method.toLowerCase() === "cash";
  const isInactiveStatus =
    booking?.status === "cancelled" || booking?.status === "deleted";
  const showPaySection =
    booking && !isInactiveStatus && !isPaid && !isCashPayment;

  // Calculate the total to display - use original_amount from database if available
  const displayTotal =
    Number(booking?.original_amount || 0) > 0
      ? Number(booking.original_amount)
      : grandTotal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={businessName}
            className="h-8 object-contain"
          />
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car size={16} className="text-white" />
          </div>
        )}
        <span className="font-bold text-gray-900">{businessName}</span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Payment Success Banner */}
          {showPaymentSuccess && (
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-6 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 size={24} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-900 mb-1">
                    Payment Complete!
                  </h3>
                  <p className="text-sm text-green-700">
                    Thank you! Your payment has been processed successfully.
                    You'll receive a confirmation email shortly.
                  </p>
                </div>
                <button
                  onClick={() => setShowPaymentSuccess(false)}
                  className="text-green-600 hover:text-green-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">
              Loading booking details…
            </div>
          ) : error || !booking ? (
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-10 text-center">
              <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
              <p className="font-semibold text-gray-800">Booking not found</p>
              <p className="text-sm text-gray-400 mt-1">
                This link may have expired or the booking was cancelled.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Hero card */}
              <div
                className={`rounded-2xl p-6 text-white shadow-lg ${booking.status === "pending" ? "bg-amber-500 shadow-amber-200" : "bg-blue-600 shadow-blue-200"}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-widest mb-1 ${booking.status === "pending" ? "text-amber-100" : "text-blue-200"}`}
                >
                  Booking Reference
                </p>
                <p className="text-4xl font-bold tracking-tight">
                  {booking.booking_number || "Pending"}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {booking.is_tentative ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-bold border border-amber-300/30">
                      <AlertTriangle size={12} /> Tentative
                    </span>
                  ) : booking.status === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold border border-white/30">
                      <Clock size={12} /> TRIP PENDING
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusColors[booking.status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
                    >
                      {statusIcons[booking.status]}
                      {booking.status?.charAt(0).toUpperCase() +
                        booking.status?.slice(1)}
                    </span>
                  )}
                  {booking.notes &&
                  booking.notes.toLowerCase().includes("return trip") ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-400/20 text-purple-200 text-xs font-bold border border-purple-300/30">
                      ↩ Return Trip
                    </span>
                  ) : booking.destination ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-400/20 text-indigo-200 text-xs font-bold border border-indigo-300/30">
                      ✈ Destination Trip
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Driver Profile Card */}
              {booking.employee_name && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    Your Driver
                  </p>
                  <div className="flex items-center justify-center">
                    {booking.employee_profile_image ? (
                      <img
                        src={booking.employee_profile_image}
                        alt={booking.employee_name}
                        className="w-72 h-72 rounded-xl object-cover border-2 border-green-100"
                      />
                    ) : (
                      <div className="w-72 h-72 rounded-xl bg-green-100 flex items-center justify-center border-2 border-green-200">
                        <User size={100} className="text-green-600" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Payment Section ─────────────────────────────────── */}
              {showPaySection && (
                <div
                  className={`rounded-2xl shadow-sm border p-6 ${isPaid ? "bg-green-50 border-green-200" : "bg-white border-gray-100"}`}
                >
                  {isPaid ? (
                    <div className="text-center space-y-2">
                      <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={28} className="text-green-600" />
                      </div>
                      <p className="text-lg font-bold text-green-800">
                        Payment Complete
                      </p>
                      <p className="text-sm text-green-600">
                        Thank you! Your payment of $
                        {Number(
                          activePayment?.amount ||
                            paymentInfo?.trip?.payment_amount ||
                            0,
                        ).toFixed(2)}{" "}
                        has been received.
                      </p>
                    </div>
                  ) : hasPaymentLink ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-blue-600" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Payment
                        </p>
                      </div>
                      <div className="text-center space-y-3">
                        <p className="text-sm text-gray-600">
                          Your Balance due is:{" "}
                          <span className="font-bold text-gray-900">
                            $
                            {Number(
                              booking?.balance_due ??
                                activePayment?.amount ??
                                0,
                            ).toFixed(2)}
                          </span>
                        </p>
                        <a
                          href={activePayment.payment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 text-base"
                        >
                          <CreditCard size={20} />
                          Pay Now
                          <ExternalLink size={16} />
                        </a>
                        <p className="text-xs text-gray-400">
                          Secure payment via{" "}
                          {activePayment.provider === "venmo"
                            ? "Venmo"
                            : activePayment.provider === "zelle"
                              ? "Zelle"
                              : "Square"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <CreditCard size={18} className="text-blue-600" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Payment
                        </p>
                      </div>
                      <div className="text-center space-y-3">
                        <p className="text-sm text-gray-600">
                          Your Balance due is:{" "}
                          <span className="font-bold text-gray-900">
                            ${Number(booking?.balance_due ?? 0).toFixed(2)}
                          </span>
                        </p>
                        <button
                          onClick={() => generatePaymentLink.mutate()}
                          disabled={generatePaymentLink.isPending}
                          className="inline-flex items-center justify-center gap-2 w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CreditCard size={20} />
                          {generatePaymentLink.isPending
                            ? "Generating..."
                            : "Generate Payment Link"}
                        </button>
                        {generatePaymentLink.isError && (
                          <p className="text-xs text-red-600">
                            {generatePaymentLink.error.message}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Click to create a secure payment link
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Trip details card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Trip Details
                </p>

                <DetailRow
                  icon={Calendar}
                  label="Date"
                  value={
                    booking.display_long_date ||
                    formatLongDate(booking.start_time)
                  }
                  accent="text-blue-500"
                />
                <DetailRow
                  icon={Clock}
                  label="Pickup Time"
                  value={booking.display_time || formatTime(booking.start_time)}
                  accent="text-blue-500"
                />
                {booking.return_date && (
                  <DetailRow
                    icon={CalendarClock}
                    label="Return Date"
                    value={
                      booking.display_return_date ||
                      formatDateOnlyLocal(booking.return_date)
                    }
                    accent="text-purple-500"
                  />
                )}

                <DetailRow
                  icon={User}
                  label="Passenger"
                  value={booking.client_name}
                />
                <DetailRow
                  icon={Phone}
                  label="Phone"
                  value={booking.client_phone}
                />

                {/* Pickup and Dropoff Locations - clearly labeled with color coding */}
                {booking.pickup_address && (
                  <DetailRow
                    icon={MapPin}
                    label="Pickup Location"
                    value={booking.pickup_address}
                    accent="text-green-500"
                  />
                )}
                {booking.dropoff_address && (
                  <DetailRow
                    icon={MapPin}
                    label="Dropoff Location"
                    value={booking.dropoff_address}
                    accent="text-red-500"
                  />
                )}
                {/* Fallback to destination if pickup/dropoff not used */}
                {!booking.pickup_address &&
                  !booking.dropoff_address &&
                  booking.destination && (
                    <DetailRow
                      icon={MapPin}
                      label="Destination"
                      value={booking.destination}
                      accent="text-red-400"
                    />
                  )}

                {booking.vehicle_name && (
                  <DetailRow
                    icon={Car}
                    label="Vehicle"
                    value={booking.vehicle_name}
                  />
                )}
                {booking.requested_driver_name && (
                  <DetailRow
                    icon={User}
                    label="Requested Driver"
                    value={booking.requested_driver_name}
                    accent="text-purple-500"
                  />
                )}

                {/* Key trip info - always show for driver assignment */}
                <DetailRow
                  icon={User}
                  label="# of Passengers"
                  value={String(booking.num_people || 0)}
                  accent="text-blue-600"
                  alwaysShow
                />
                <DetailRow
                  icon={Luggage}
                  label="Baggage"
                  value={baggageDisplay}
                  accent="text-orange-500"
                  alwaysShow
                />
                {(booking.num_car_seats || 0) > 0 && (
                  <DetailRow
                    icon={Baby}
                    label="Car Seats"
                    value={String(booking.num_car_seats)}
                    accent="text-pink-500"
                  />
                )}

                {booking.outgoing_flight_info && (
                  <DetailRow
                    icon={FlightIcon}
                    label={flightLabel}
                    value={booking.outgoing_flight_info}
                    accent="text-sky-500"
                  />
                )}
                {booking.returning_flight_info && (
                  <DetailRow
                    icon={PlaneLanding}
                    label="Return Flight Info"
                    value={booking.returning_flight_info}
                    accent="text-indigo-500"
                  />
                )}

                {/* Passenger notes */}
                {booking.notes && (
                  <DetailRow
                    icon={Hash}
                    label="Passenger Notes"
                    value={booking.notes}
                    accent="text-gray-600"
                  />
                )}
              </div>

              {/* Pricing card - REMOVED */}

              {/* Notes card - appears after pricing */}
              {(booking.notes ||
                (booking.is_tentative && booking.tentative_reason)) && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Notes
                  </p>
                  {booking.notes && (
                    <DetailRow
                      icon={Hash}
                      label="Notes"
                      value={booking.notes}
                    />
                  )}
                  {booking.is_tentative && booking.tentative_reason && (
                    <DetailRow
                      icon={AlertTriangle}
                      label="Tentative Reason"
                      value={booking.tentative_reason}
                      accent="text-amber-500"
                    />
                  )}
                </div>
              )}

              {/* Contact footer */}
              {settings?.business_phone && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
                  <p className="text-sm text-gray-500 mb-2">
                    Questions? Give us a call.
                  </p>
                  <a
                    href={`tel:${settings.business_phone}`}
                    className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 transition-colors"
                  >
                    {settings.business_phone}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {businessName}
      </footer>
    </div>
  );
}
