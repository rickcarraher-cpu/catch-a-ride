"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Printer,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  MapPin,
  Car,
  Luggage,
  PlaneTakeoff,
  PlaneLanding,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  MessageSquare,
} from "lucide-react";

export default function ReceiptPage({ params }) {
  const { id } = params;
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMethod, setSendMethod] = useState("email");

  // Format today's date in CDT for the "Issued" date on the receipt
  const issuedDate = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Format dates directly from the trip record in Central Time — no cached display fields
  const fmtDateCDT = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const fmtTimeCDT = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleTimeString("en-US", {
      timeZone: "America/Chicago",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trip-receipt", id],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${id}`);
      if (!res.ok) throw new Error("Trip not found");
      return res.json();
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["receipt-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
  });

  // Fetch transactions to get tip amount
  const { data: transactions } = useQuery({
    queryKey: ["trip-transactions", id],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?appointment_id=${id}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!id,
  });

  const handlePrint = () => {
    // Mark needs_receipt as false so it no longer appears in the receipt report
    fetch(`/api/appointments/${id}/mark-receipt-printed`, {
      method: "POST",
    }).catch((err) => console.error("Failed to mark receipt printed:", err));
    window.print();
  };

  const handleBack = () => {
    window.location.href = "/dashboard";
  };

  const handleSendToClient = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/appointments/${id}/send-receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: sendMethod }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send receipt");
      }

      alert(`Receipt sent via ${sendMethod === "email" ? "email" : "SMS"}!`);
      setShowSendModal(false);
    } catch (error) {
      console.error("Error sending receipt:", error);
      alert(`Failed to send receipt: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Receipt Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            This trip receipt could not be loaded. Please check the trip ID and
            try again.
          </p>
          <button
            onClick={handleBack}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const businessName = settings?.business_name || "Limo Service";
  const businessPhone = settings?.business_phone || "";
  const businessEmail = settings?.business_email || "";
  const businessAddress = settings?.business_address || "";
  const logoUrl = settings?.logo_url;

  // Check if trip is paid before showing receipt
  const isPaid = trip.payment_status === "paid";

  // Calculate amounts - use original_amount if available (includes credit card fees)
  const servicesSubtotal =
    trip.services?.reduce(
      (sum, s) =>
        // Exclude gas fee services — they are treated like tips, not part of the commission base
        s.service_name && s.service_name.toLowerCase().includes("gas")
          ? sum
          : sum + Number(s.service_price) * Number(s.quantity || 1),
      0,
    ) || 0;

  // Calculate credit card fee
  const payMethodLower = (trip.payment_method || "").toLowerCase();
  const isCardPayment =
    payMethodLower.includes("card") ||
    payMethodLower.includes("credit") ||
    payMethodLower.includes("square");
  const feePercent = Number(settings?.credit_card_fee_percent || 4);
  const creditCardFeeAmount =
    isCardPayment && servicesSubtotal > 0
      ? Math.round((Math.ceil(servicesSubtotal) * feePercent) / 100)
      : 0;

  const originalAmount = trip.original_amount
    ? Number(trip.original_amount)
    : Math.ceil(servicesSubtotal) + creditCardFeeAmount;

  // Calculate tip amount — use pre-computed tips_total from the trip first.
  // Fall back to summing from transactions for older trips where tips_total
  // was never cached (Square tips added before the cache was introduced).
  const tipFromTransactions = (transactions || []).reduce((sum, t) => {
    if (t.category === "tip" || t.category === "payment") {
      return sum + Number(t.tip_amount || 0);
    }
    return sum;
  }, 0);
  const tipAmount = Number(trip.tips_total || 0) || tipFromTransactions;

  // Calculate amount paid — include payment + cc_fee + tip so the TOTAL
  // matches the line-item breakdown (Subtotal + CC Fee + Tip = TOTAL).
  const amountPaid = (transactions || [])
    .filter(
      (t) =>
        t.category === "payment" ||
        t.category === "tip" ||
        t.category === "cc_fee",
    )
    .reduce(
      (sum, t) => sum + Number(t.amount || 0) + Number(t.tip_amount || 0),
      0,
    );

  // Check if payment was recorded outside the system (no transaction records but marked as paid)
  const hasTransactions = transactions && transactions.length > 0;
  const displayTotal = hasTransactions
    ? amountPaid
    : originalAmount + tipAmount;

  const bagParts = [];
  if (trip.num_bags_checked) bagParts.push(`${trip.num_bags_checked} Checked`);
  if (trip.num_bags_carry_on)
    bagParts.push(`${trip.num_bags_carry_on} Carry-on`);
  const baggageDisplay = bagParts.length > 0 ? bagParts.join(" + ") : "None";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* No-print toolbar */}
      <div className="no-print bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
            >
              <Send size={18} />
              Send to Client
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              <Printer size={18} />
              Print Receipt
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Container */}
      <div className="max-w-4xl mx-auto p-6" id="receipt-wrap">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden print:shadow-none print:rounded-none print:border-0">
          {/* Header Section */}
          <div
            className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 print:bg-none print:bg-blue-600"
            id="receipt-header"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={businessName}
                    className="h-16 w-auto object-contain bg-white rounded-lg p-2"
                  />
                ) : (
                  <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                    <Car size={32} className="text-blue-600" />
                  </div>
                )}
                <div className="text-white">
                  <h1 className="text-2xl font-bold mb-1">{businessName}</h1>
                  {businessPhone && (
                    <p className="text-blue-100 text-sm">{businessPhone}</p>
                  )}
                  {businessEmail && (
                    <p className="text-blue-100 text-sm">{businessEmail}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-lg border border-white/30 mb-2">
                  <FileText size={18} className="text-white" />
                  <span className="text-white font-bold">RECEIPT</span>
                </div>
                <p className="text-blue-100 text-sm">Issued: {issuedDate}</p>
              </div>
            </div>

            {/* Trip Number Banner */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-6 py-4">
              <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-1">
                Trip Reference
              </p>
              <p className="text-white text-3xl font-bold tracking-tight">
                #{trip.booking_number || "N/A"}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-8 py-8 space-y-8" id="receipt-body">
            {/* Trip Details Section */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                Trip Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <ReceiptRow
                    icon={Calendar}
                    label="Date"
                    value={fmtDateCDT(trip.start_time)}
                  />
                  <ReceiptRow
                    icon={Clock}
                    label="Pickup Time"
                    value={fmtTimeCDT(trip.start_time)}
                  />
                  {trip.return_date && (
                    <ReceiptRow
                      icon={Clock}
                      label="Return Date"
                      value={fmtDateCDT(trip.return_date)}
                    />
                  )}
                  <ReceiptRow
                    icon={User}
                    label="Passenger Name"
                    value={trip.client_name || "N/A"}
                  />
                  {trip.client_phone && (
                    <ReceiptRow
                      icon={Phone}
                      label="Phone"
                      value={trip.client_phone}
                    />
                  )}
                  {trip.client_email && (
                    <ReceiptRow
                      icon={Mail}
                      label="Email"
                      value={trip.client_email}
                    />
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {trip.employee_name && (
                    <ReceiptRow
                      icon={Car}
                      label="Driver"
                      value={trip.employee_name}
                    />
                  )}
                  {trip.vehicle_name && (
                    <ReceiptRow
                      icon={Car}
                      label="Vehicle"
                      value={trip.vehicle_name}
                    />
                  )}
                  {trip.num_people && (
                    <ReceiptRow
                      icon={User}
                      label="Number of Passengers"
                      value={String(trip.num_people)}
                    />
                  )}
                  <ReceiptRow
                    icon={Luggage}
                    label="Baggage"
                    value={baggageDisplay}
                  />
                  {trip.num_car_seats > 0 && (
                    <ReceiptRow
                      icon={User}
                      label="Car Seats"
                      value={String(trip.num_car_seats)}
                    />
                  )}
                  {trip.num_golf_bags > 0 && (
                    <ReceiptRow
                      icon={Luggage}
                      label="Golf Bags"
                      value={String(trip.num_golf_bags)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Location Details */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                Location Details
              </h2>
              <div className="space-y-4">
                {trip.pickup_address && (
                  <ReceiptRow
                    icon={MapPin}
                    label="Pickup Location"
                    value={trip.pickup_address}
                    iconColor="text-green-600"
                  />
                )}
                {trip.dropoff_address && (
                  <ReceiptRow
                    icon={MapPin}
                    label="Dropoff Location"
                    value={trip.dropoff_address}
                    iconColor="text-red-600"
                  />
                )}
                {!trip.pickup_address &&
                  !trip.dropoff_address &&
                  trip.destination && (
                    <ReceiptRow
                      icon={MapPin}
                      label="Destination"
                      value={trip.destination}
                      iconColor="text-red-600"
                    />
                  )}
                {trip.distance_miles && (
                  <ReceiptRow
                    icon={MapPin}
                    label="Distance"
                    value={`${Number(trip.distance_miles).toFixed(1)} miles`}
                  />
                )}
              </div>
            </div>

            {/* Flight Information */}
            {(trip.outgoing_flight_info || trip.returning_flight_info) && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                  Flight Information
                </h2>
                <div className="space-y-4">
                  {trip.outgoing_flight_info && (
                    <ReceiptRow
                      icon={PlaneTakeoff}
                      label="Outgoing Flight"
                      value={trip.outgoing_flight_info}
                      iconColor="text-sky-600"
                    />
                  )}
                  {trip.returning_flight_info && (
                    <ReceiptRow
                      icon={PlaneLanding}
                      label="Return Flight"
                      value={trip.returning_flight_info}
                      iconColor="text-indigo-600"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Services & Charges */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                Services & Charges
              </h2>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                {trip.services?.length > 0 ? (
                  <div className="space-y-3">
                    {(() => {
                      const isGasFee = (name) =>
                        typeof name === "string" &&
                        name.toLowerCase().includes("gas");

                      // Separate services into regular and gas fees
                      const regularServices = (trip.services || []).filter(
                        (s) => !isGasFee(s.service_name),
                      );
                      const gasFeeServices = (trip.services || []).filter((s) =>
                        isGasFee(s.service_name),
                      );

                      // Calculate totals
                      const regularSubtotal = regularServices.reduce(
                        (sum, s) =>
                          sum +
                          Number(s.service_price) * Number(s.quantity || 1),
                        0,
                      );

                      const gasFeeTotal = gasFeeServices.reduce(
                        (sum, s) =>
                          sum +
                          Number(s.service_price) * Number(s.quantity || 1),
                        0,
                      );

                      // TOTAL calculation: original_amount already includes everything
                      // (base services + gas fees + CC fee), so we just need to add tips
                      const grandTotal = originalAmount + tipAmount;

                      return (
                        <>
                          {/* Regular services */}
                          {regularServices.map((service, idx) => {
                            const lineTotal =
                              Number(service.service_price) *
                              Number(service.quantity || 1);
                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-center"
                              >
                                <div className="flex-1">
                                  <span className="text-gray-900 font-medium">
                                    {service.service_name}
                                  </span>
                                  {service.quantity > 1 && (
                                    <span className="text-gray-500 ml-2 text-sm">
                                      × {service.quantity}
                                    </span>
                                  )}
                                  {service.stop_description && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      {service.stop_description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-gray-900 font-semibold text-lg ml-4">
                                  ${lineTotal.toFixed(2)}
                                </span>
                              </div>
                            );
                          })}

                          <div className="border-t border-gray-300 pt-3 mt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-700 font-semibold">
                                Subtotal
                              </span>
                              <span className="text-gray-900 font-semibold text-lg">
                                ${Math.ceil(regularSubtotal).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Gas fee services — shown for informational purposes only, NOT added to total */}
                          {gasFeeServices.map((service, idx) => {
                            const lineTotal =
                              Number(service.service_price) *
                              Number(service.quantity || 1);
                            return (
                              <div key={`gas-${idx}`} className="pt-2">
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-700 font-semibold">
                                      {service.service_name}
                                    </span>
                                    <span className="text-xs text-gray-500 italic">
                                      (included above)
                                    </span>
                                  </div>
                                  <span className="text-gray-500 font-semibold text-lg">
                                    ${lineTotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {creditCardFeeAmount > 0 && (
                            <div className="pt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-700 font-semibold">
                                  Credit Card Fee ({feePercent}%)
                                </span>
                                <span className="text-gray-700 font-semibold text-lg">
                                  +${creditCardFeeAmount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {tipAmount > 0 && (
                            <div className="pt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-700 font-semibold">
                                  Tip
                                </span>
                                <span className="text-green-600 font-semibold text-lg">
                                  ${tipAmount.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          {!hasTransactions && (
                            <div className="pt-2 pb-2">
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-xs text-yellow-800">
                                  <strong>Note:</strong> Payment was recorded
                                  outside the system. Tip information may not be
                                  included in this total.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="border-t-2 border-gray-300 pt-4 mt-4">
                            <div className="flex justify-between items-center">
                              <span className="text-xl font-bold text-gray-900">
                                TOTAL
                              </span>
                              <span className="text-2xl font-bold text-blue-600">
                                ${grandTotal.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Amount Paid + Balance Due — only shown when there are transaction records */}
                          {hasTransactions && amountPaid > 0 && (
                            <div className="pt-2 space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 font-semibold">
                                  Amount Paid
                                </span>
                                <span className="text-green-700 font-semibold">
                                  -${amountPaid.toFixed(2)}
                                </span>
                              </div>
                              {originalAmount - amountPaid > 0.005 && (
                                <div className="flex justify-between items-center text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                                  <span className="text-red-700 font-bold">
                                    Balance Due
                                  </span>
                                  <span className="text-red-700 font-bold">
                                    ${(originalAmount - amountPaid).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {originalAmount - amountPaid <= 0.005 && (
                                <div className="flex justify-between items-center text-sm bg-green-50 rounded-lg px-3 py-2 border border-green-200">
                                  <span className="text-green-700 font-bold">
                                    Balance Due
                                  </span>
                                  <span className="text-green-700 font-bold">
                                    $0.00 ✓ Paid
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {trip.payment_method && (
                            <div className="pt-3 border-t border-gray-200 mt-3">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">
                                  Payment Method
                                </span>
                                <span className="text-gray-900 font-semibold">
                                  {trip.payment_method}
                                </span>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    No services listed
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="bg-gray-50 border-t-2 border-gray-200 px-8 py-6"
            id="receipt-footer"
          >
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Thank you for choosing {businessName}
              </p>
              {businessAddress && (
                <p className="text-xs text-gray-500">{businessAddress}</p>
              )}
              {businessPhone && (
                <p className="text-xs text-gray-500">
                  Questions? Call us at {businessPhone}
                </p>
              )}
              <p className="text-xs text-gray-400 pt-2">Issued: {issuedDate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Send Modal */}
      {showSendModal && (
        <div className="no-print fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Send Receipt to Client</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send Method
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${sendMethod === "email" ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}
                >
                  <input
                    type="radio"
                    checked={sendMethod === "email"}
                    onChange={() => setSendMethod("email")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Mail
                    size={20}
                    className={
                      sendMethod === "email" ? "text-blue-600" : "text-gray-400"
                    }
                  />
                  <div className="flex-1">
                    <div className="font-semibold">Email</div>
                    <div className="text-sm text-gray-500">
                      Send receipt as email to{" "}
                      {trip?.client_email || "client email"}
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${sendMethod === "sms" ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}
                >
                  <input
                    type="radio"
                    checked={sendMethod === "sms"}
                    onChange={() => setSendMethod("sms")}
                    className="w-4 h-4 text-blue-600"
                  />
                  <MessageSquare
                    size={20}
                    className={
                      sendMethod === "sms" ? "text-blue-600" : "text-gray-400"
                    }
                  />
                  <div className="flex-1">
                    <div className="font-semibold">SMS</div>
                    <div className="text-sm text-gray-500">
                      Send link to receipt page to{" "}
                      {trip?.client_phone || "client phone"}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendToClient}
                disabled={sending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? "Sending..." : "Send Receipt"}
              </button>
              <button
                onClick={() => setShowSendModal(false)}
                disabled={sending}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
            font-size: 8pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .min-h-screen {
            min-height: unset !important;
            background: white !important;
          }
          #receipt-wrap {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          /* Header */
          #receipt-header {
            padding: 4px 12px !important;
          }
          #receipt-header img {
            height: 26px !important;
            width: auto !important;
          }
          #receipt-header h1 {
            font-size: 10pt !important;
            margin-bottom: 0 !important;
            line-height: 1.1 !important;
          }
          #receipt-header p {
            font-size: 6.5pt !important;
            line-height: 1.1 !important;
          }
          #receipt-header .flex.items-center.gap-4 {
            gap: 5px !important;
          }
          #receipt-header .mb-6 {
            margin-bottom: 3px !important;
          }
          #receipt-header .rounded-xl {
            padding: 2px 8px !important;
          }
          #receipt-header .text-3xl {
            font-size: 12pt !important;
            line-height: 1.1 !important;
          }
          #receipt-header .text-xs {
            font-size: 6pt !important;
          }
          #receipt-header .w-16 {
            width: 26px !important;
            height: 26px !important;
          }
          #receipt-header svg {
            width: 16px !important;
            height: 16px !important;
          }
          /* Body */
          #receipt-body {
            padding: 3px 12px !important;
          }
          #receipt-body > * + * {
            margin-top: 3px !important;
          }
          #receipt-body h2 {
            font-size: 7.5pt !important;
            margin-bottom: 1px !important;
            padding-bottom: 1px !important;
          }
          #receipt-body .grid {
            gap: 3px !important;
          }
          /* ReceiptRow label and value */
          #receipt-body .space-y-4 > * + * {
            margin-top: 2px !important;
          }
          #receipt-body .flex.items-start.gap-3 {
            gap: 4px !important;
          }
          #receipt-body .text-xs.font-semibold {
            font-size: 5.5pt !important;
            margin-bottom: 0 !important;
          }
          #receipt-body .text-gray-900.font-medium {
            font-size: 7.5pt !important;
          }
          #receipt-body svg {
            width: 11px !important;
            height: 11px !important;
          }
          /* Services card */
          #receipt-body .bg-gray-50.rounded-xl {
            padding: 4px 8px !important;
          }
          #receipt-body .space-y-3 > * + * {
            margin-top: 2px !important;
          }
          #receipt-body .text-lg {
            font-size: 7.5pt !important;
          }
          #receipt-body .text-xl {
            font-size: 8.5pt !important;
          }
          #receipt-body .text-2xl {
            font-size: 10pt !important;
          }
          #receipt-body .pt-4.mt-4,
          #receipt-body .pt-3.mt-3 {
            padding-top: 2px !important;
            margin-top: 2px !important;
          }
          #receipt-body .pt-2,
          #receipt-body .pt-3.border-t {
            padding-top: 1px !important;
          }
          #receipt-body .bg-yellow-50 {
            padding: 2px 5px !important;
          }
          #receipt-body .bg-yellow-50 p {
            font-size: 6pt !important;
          }
          /* Footer */
          #receipt-footer {
            padding: 2px 12px !important;
          }
          #receipt-footer p {
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }
          #receipt-footer .space-y-2 > * + * {
            margin-top: 0 !important;
          }
          #receipt-footer .pt-2 {
            padding-top: 1px !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
          .print\\:bg-none {
            background-image: none !important;
          }
          @page {
            margin: 0.2in;
            size: letter portrait;
          }
        }
      `}</style>
    </div>
  );
}

function ReceiptRow({ icon: Icon, label, value, iconColor = "text-blue-600" }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`${iconColor} mt-0.5 shrink-0`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-gray-900 font-medium break-words">{value}</p>
      </div>
    </div>
  );
}
