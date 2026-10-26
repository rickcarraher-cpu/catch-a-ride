"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  CreditCard,
  ExternalLink,
  Edit2,
  Mail,
  User,
  Phone,
  Save,
  X,
} from "lucide-react";

export default function PassengerConfirmPage({ params }) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [success, setSuccess] = useState(false);
  const [companyPhone, setCompanyPhone] = useState(null);

  // State for editing contact information
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactFormData, setContactFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState(null);

  useEffect(() => {
    if (trip) {
      setContactFormData({
        name: trip.passenger_name || "",
        phone: trip.passenger_phone || "",
        email: trip.passenger_email || "",
      });
    }
  }, [trip]);

  useEffect(() => {
    loadTrip();
    loadSettings();
  }, []);

  async function loadTrip() {
    try {
      const response = await fetch(
        `/api/confirmations/passenger/${params.token}`,
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load trip");
      }
      const data = await response.json();
      setTrip(data.trip);
    } catch (err) {
      console.error("Failed to load trip:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const settings = await res.json();
        setCompanyPhone(settings.business_phone || null);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  async function handleSubmit() {
    if (decision === "cancelled" && !reason.trim()) {
      setError("Please provide a reason for cancelling");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/confirmations/passenger/${params.token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: decision === "cancelled" ? reason : null,
          }),
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit response");
      }

      setSuccess(true);
    } catch (err) {
      console.error("Failed to submit:", err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Function to handle contact information updates
  async function handleSaveContact() {
    if (!trip?.client_id) {
      setContactError("Unable to update contact information");
      return;
    }

    // Validation
    if (!contactFormData.name?.trim()) {
      setContactError("Name is required");
      return;
    }

    if (!contactFormData.phone?.trim() && !contactFormData.email?.trim()) {
      setContactError("Please provide at least a phone number or email");
      return;
    }

    setSavingContact(true);
    setContactError(null);

    try {
      const res = await fetch(`/api/clients/${trip.client_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactFormData.name.trim(),
          phone: contactFormData.phone?.trim() || null,
          email: contactFormData.email?.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update contact information");
      }

      // Reload trip data from server to ensure all fields are updated
      await loadTrip();

      setIsEditingContact(false);
      setContactError(null);
    } catch (err) {
      console.error("Failed to update contact:", err);
      setContactError(err.message);
    } finally {
      setSavingContact(false);
    }
  }

  // Function to cancel editing
  function handleCancelEdit() {
    setContactFormData({
      name: trip?.passenger_name || "",
      phone: trip?.passenger_phone || "",
      email: trip?.passenger_email || "",
    });
    setIsEditingContact(false);
    setContactError(null);
  }

  const downloadCalendar = () => {
    window.location.href = `/api/appointments/${trip.id}/ics?recipient=passenger`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin" size={24} />
          <span>Loading trip details...</span>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-red-200">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle size={32} />
            <h1 className="text-2xl font-bold">Unable to Load Trip</h1>
          </div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            {decision === "confirmed" ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Confirmed!
                </h1>
                <p className="text-gray-600 mb-6">
                  Thank you for confirming. We're looking forward to serving
                  you!
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle size={32} className="text-orange-600" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Trip Cancelled
                </h1>
                <p className="text-gray-600 mb-4">
                  We've cancelled your trip. We hope to serve you another time!
                </p>
                {companyPhone && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      Need to talk to us?
                    </p>
                    <a
                      href={`tel:${companyPhone}`}
                      className="text-lg font-bold text-blue-600 hover:text-blue-700 underline"
                    >
                      {companyPhone}
                    </a>
                  </div>
                )}
              </>
            )}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
              <strong>Booking #:</strong> {trip.booking_number}
              <br />
              <strong>Date:</strong>{" "}
              {new Date(trip.start_time).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Chicago",
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!decision) {
    // Detect reinstated trip: previously cancelled but trip is now active again
    const isReinstated =
      trip.passenger_confirmed === "cancelled" &&
      trip.status !== "cancelled" &&
      trip.status != null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full border border-purple-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Trip Confirmation
          </h1>
          <p className="text-gray-500 mb-6">
            Please confirm your upcoming trip
          </p>

          {/* Reinstated alert — prominent when trip was re-activated */}
          {isReinstated && (
            <div className="mb-6 p-5 bg-blue-600 text-white rounded-2xl shadow-md">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle size={22} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">
                    Your trip has been reinstated!
                  </p>
                  <p className="text-blue-100 text-sm mt-1">
                    We've re-activated your trip. Please confirm your attendance
                    using the button below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Previously responded notice — only show if NOT reinstated */}
          {trip.passenger_response_at && !isReinstated && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-xl text-sm text-yellow-800">
              <strong>Note:</strong> You previously{" "}
              {trip.passenger_confirmed === "confirmed"
                ? "confirmed"
                : "cancelled"}{" "}
              this trip on{" "}
              {new Date(trip.passenger_response_at).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Chicago",
                timeZoneName: "short",
              })}
              . You can update your response below.
            </div>
          )}

          {/* Contact Information Section */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User size={20} className="text-blue-600" />
                Your Contact Information
              </h3>
              {!isEditingContact && (
                <button
                  onClick={() => setIsEditingContact(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                >
                  <Edit2 size={14} />
                  Edit
                </button>
              )}
            </div>

            {isEditingContact ? (
              <div className="space-y-4">
                {contactError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{contactError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <User size={14} className="text-gray-400" />
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactFormData.name}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Phone size={14} className="text-gray-400" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={contactFormData.phone}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="(555) 000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Mail size={14} className="text-gray-400" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={contactFormData.email}
                    onChange={(e) =>
                      setContactFormData({
                        ...contactFormData,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="john@example.com"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveContact}
                    disabled={savingContact}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingContact ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={savingContact}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <User size={16} className="text-gray-400" />
                  <span className="font-semibold">
                    {trip?.passenger_name || "Not provided"}
                  </span>
                </div>
                {trip?.passenger_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-sm">{trip.passenger_phone}</span>
                  </div>
                )}
                {trip?.passenger_email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-sm">{trip.passenger_email}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trip Details Card */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6 border border-purple-200">
            {/* Driver Portrait Image (vehicle-specific) - centered at top if available */}
            {(trip.driver_portrait || trip.driver_profile_image) && (
              <div className="flex flex-col items-center mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Your Driver
                </div>
                <img
                  src={trip.driver_portrait || trip.driver_profile_image}
                  alt={trip.driver_name || "Driver"}
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg mb-2"
                />
                {trip.driver_first_name && (
                  <p className="text-lg font-semibold text-gray-900">
                    {trip.driver_first_name}
                  </p>
                )}
                {trip.driver_phone && (
                  <a
                    href={`tel:${trip.driver_phone}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 underline mt-1"
                  >
                    {trip.driver_phone}
                  </a>
                )}
                {trip.driver_bio && (
                  <p className="text-sm text-gray-600 text-center mt-1 max-w-md">
                    {trip.driver_bio}
                  </p>
                )}
                {trip.vehicle_name && (
                  <div className="mt-3 px-4 py-2 bg-white/80 rounded-lg border border-purple-200">
                    <p className="text-xs text-gray-500 mb-0.5">Vehicle</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {trip.vehicle_name}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Booking Number
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {trip.booking_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Date & Time
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(trip.start_time).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    timeZone: "America/Chicago",
                  })}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(trip.start_time).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Chicago",
                  })}
                </p>
              </div>
              {trip.driver_name && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Your Driver
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {trip.driver_name}
                  </p>
                </div>
              )}
              {trip.vehicle_name && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Vehicle
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.vehicle_name}
                  </p>
                </div>
              )}
              {trip.pickup_address && (
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    📍 Pickup Location
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.pickup_address}
                  </p>
                </div>
              )}
              {/* Destination - always show if available */}
              {(trip.dropoff_address || trip.destination) && (
                <div className="md:col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    🎯 Destination
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.dropoff_address || trip.destination}
                  </p>
                </div>
              )}
              {trip.num_people && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Passengers
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {trip.num_people}{" "}
                    {trip.num_people === 1 ? "person" : "people"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Services & Payment Breakdown */}
          {trip.services &&
            trip.services.length > 0 &&
            (() => {
              const mainServices = trip.services.filter((s) => !s.is_addon);
              const addonServices = trip.services.filter((s) => s.is_addon);

              const mainTotal = mainServices.reduce(
                (sum, s) =>
                  sum + Number(s.service_price || 0) * Number(s.quantity || 1),
                0,
              );
              const addonTotal = addonServices.reduce(
                (sum, s) =>
                  sum + Number(s.service_price || 0) * Number(s.quantity || 1),
                0,
              );
              const subtotal = mainTotal + addonTotal;

              // Determine if CC fee applies based on payment method
              const isCardPayment =
                trip.payment_method === "Credit Card" ||
                trip.payment_method === "Square" ||
                trip.payment_method === "square" ||
                trip.payment_method === "Square Invoice";
              const feePercent = Number(trip.credit_card_fee_percent || 4);

              // Calculate credit card fee directly when card payment is selected
              let ccFee = 0;
              if (isCardPayment && subtotal > 0) {
                ccFee = Math.round((subtotal * feePercent) / 100);
              }

              // Use original_amount if available, otherwise calculate with fee
              const totalAmount =
                Number(trip.original_amount || 0) > 0
                  ? Number(trip.original_amount)
                  : Math.ceil(subtotal) + ccFee;

              const paymentsMade = Number(trip.payments_total || 0);
              const balanceDue = totalAmount - paymentsMade;

              return (
                <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Trip Services & Payment
                  </h3>

                  {/* Main Services */}
                  <div className="space-y-3">
                    {mainServices.map((service, idx) => {
                      const lineTotal =
                        Number(service.service_price || 0) *
                        Number(service.quantity || 1);
                      return (
                        <div
                          key={`main-${idx}`}
                          className="flex justify-between items-center pb-2 border-b border-gray-100"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {service.service_name}
                              {service.quantity > 1 && (
                                <span className="text-sm text-gray-500 ml-2">
                                  × {service.quantity}
                                </span>
                              )}
                            </p>
                            {service.stop_description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {service.stop_description}
                              </p>
                            )}
                          </div>
                          <p className="font-semibold text-gray-900 ml-4">
                            ${lineTotal.toFixed(2)}
                          </p>
                        </div>
                      );
                    })}

                    {/* Addon Services */}
                    {addonServices.length > 0 && (
                      <>
                        <div className="pt-1">
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            Add-ons
                          </p>
                        </div>
                        {addonServices.map((service, idx) => {
                          const lineTotal =
                            Number(service.service_price || 0) *
                            Number(service.quantity || 1);
                          return (
                            <div
                              key={`addon-${idx}`}
                              className="flex justify-between items-center pb-2 border-b border-gray-100"
                            >
                              <div className="flex-1">
                                <p className="font-medium text-gray-700">
                                  {service.service_name}
                                  {service.quantity > 1 && (
                                    <span className="text-sm text-gray-500 ml-2">
                                      × {service.quantity}
                                    </span>
                                  )}
                                </p>
                                {service.stop_description && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    {service.stop_description}
                                  </p>
                                )}
                              </div>
                              <p className="font-semibold text-gray-700 ml-4">
                                ${lineTotal.toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Credit Card Fee */}
                    {isCardPayment && ccFee > 0 && (
                      <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <p className="text-sm text-gray-600">
                          Credit Card Fee ({feePercent}%)
                        </p>
                        <p className="font-semibold text-gray-700 ml-4">
                          ${ccFee.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-4 mt-3 border-t-2 border-gray-300">
                    <span className="font-bold text-gray-900 text-lg">
                      {paymentsMade > 0 ? "Total" : "Payment Total"}
                    </span>
                    <span className="font-bold text-gray-900 text-lg">
                      ${totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* If payments have been made, show paid + balance */}
                  {paymentsMade > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-green-700">Paid to Date</span>
                        <span className="font-semibold text-green-700">
                          -${paymentsMade.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span
                          className={`font-bold text-lg ${balanceDue <= 0 ? "text-green-700" : "text-red-600"}`}
                        >
                          {balanceDue <= 0 ? "✓ Paid in Full" : "Balance Due"}
                        </span>
                        {balanceDue > 0 && (
                          <span className="font-bold text-red-600 text-lg">
                            ${balanceDue.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Status & Method */}
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Payment Status
                      </span>
                      <span
                        className={`text-sm font-semibold px-3 py-1 rounded-full ${
                          trip.payment_status === "paid"
                            ? "bg-green-100 text-green-800"
                            : trip.payment_status === "unpaid"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {trip.payment_status === "paid"
                          ? "Paid"
                          : trip.payment_status === "unpaid"
                            ? "Unpaid"
                            : "Pending"}
                      </span>
                    </div>
                    {trip.payment_method && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Payment Method</span>
                        <span className="text-gray-900 capitalize">
                          {trip.payment_method === "square" ||
                          trip.payment_method === "Square"
                            ? "Credit Card"
                            : trip.payment_method}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Fallback: Payment info when no services (amount-only trips) */}
          {(!trip.services || trip.services.length === 0) &&
            trip.payment_amount !== null &&
            trip.payment_amount !== undefined &&
            Number(trip.payment_amount) > 0 && (
              <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Payment Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-gray-900">
                      Total Amount
                    </span>
                    <span className="font-bold text-gray-900 text-lg">
                      ${Number(trip.payment_amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-600">
                      Payment Status
                    </span>
                    <span
                      className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        trip.payment_status === "paid"
                          ? "bg-green-100 text-green-800"
                          : trip.payment_status === "unpaid"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {trip.payment_status === "paid"
                        ? "Paid"
                        : trip.payment_status === "unpaid"
                          ? "Unpaid"
                          : "Pending"}
                    </span>
                  </div>
                  {trip.payment_method && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Payment Method</span>
                      <span className="text-gray-900 capitalize">
                        {trip.payment_method === "square" ||
                        trip.payment_method === "Square"
                          ? "Credit Card"
                          : trip.payment_method}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Additional Trip Details */}
          {(trip.num_bags_checked > 0 ||
            trip.num_bags_carry_on > 0 ||
            trip.num_car_seats > 0 ||
            trip.num_golf_bags > 0 ||
            trip.outgoing_flight_info ||
            trip.returning_flight_info ||
            trip.return_date ||
            trip.notes ||
            trip.gift_certificate) && (
            <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Additional Details
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                {/* Luggage */}
                {trip.num_bags_checked > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Checked Bags
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.num_bags_checked}{" "}
                      {trip.num_bags_checked === 1 ? "bag" : "bags"}
                    </p>
                  </div>
                )}
                {trip.num_bags_carry_on > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Carry-On Bags
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.num_bags_carry_on}{" "}
                      {trip.num_bags_carry_on === 1 ? "bag" : "bags"}
                    </p>
                  </div>
                )}
                {trip.num_car_seats > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Car Seats
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.num_car_seats}{" "}
                      {trip.num_car_seats === 1 ? "seat" : "seats"}
                    </p>
                  </div>
                )}
                {trip.num_golf_bags > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Golf Bags
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.num_golf_bags}{" "}
                      {trip.num_golf_bags === 1 ? "bag" : "bags"}
                    </p>
                  </div>
                )}

                {/* Flight Info */}
                {trip.outgoing_flight_info && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Outgoing Flight
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.outgoing_flight_info}
                    </p>
                  </div>
                )}
                {trip.returning_flight_info && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Return Flight
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {trip.returning_flight_info}
                    </p>
                  </div>
                )}

                {/* Return Date */}
                {trip.return_date && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Return Date
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {(() => {
                        // Extract YYYY-MM-DD directly to avoid timezone shifting midnight UTC dates back one day
                        const str =
                          typeof trip.return_date === "string"
                            ? trip.return_date
                            : new Date(trip.return_date).toISOString();
                        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (!match) return "N/A";
                        const [, year, month, day] = match;
                        const d = new Date(`${year}-${month}-${day}T12:00:00Z`);
                        return d.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        });
                      })()}
                    </p>
                  </div>
                )}

                {/* Notes */}
                {trip.notes && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      Special Requests / Notes
                    </p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap">
                      {trip.notes}
                    </p>
                  </div>
                )}

                {/* Gift Certificate */}
                {trip.gift_certificate && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                      🎁 Gift Certificate
                    </p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap bg-purple-50 border border-purple-100 rounded-lg p-3">
                      {trip.gift_certificate}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons - Payment Link and Calendar */}
          <div className="mb-6 flex gap-3">
            {/* Payment Link Button - show for unpaid trips with a real payment URL */}
            {trip.payment_status !== "paid" && trip.payment_url && (
              <a
                href={trip.payment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <CreditCard size={20} />
                <span>Pay Now</span>
                <ExternalLink size={16} />
              </a>
            )}

            {/* Calendar Download Button */}
            <button
              onClick={downloadCalendar}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <Calendar size={20} />
              <span>Add to Calendar</span>
            </button>
          </div>

          {/* Decision Buttons */}
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setDecision("confirmed")}
              className="flex items-center justify-center gap-3 bg-green-600 text-white font-semibold py-4 px-6 rounded-xl hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <CheckCircle size={24} />
              <span>Confirm This Trip</span>
            </button>
            <button
              onClick={() => setDecision("cancelled")}
              className="flex items-center justify-center gap-3 bg-orange-600 text-white font-semibold py-4 px-6 rounded-xl hover:bg-orange-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <XCircle size={24} />
              <span>Cancel This Trip</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reason screen (if cancelled)
  if (decision === "cancelled") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Please Tell Us Why
          </h1>
          <p className="text-gray-500 mb-6">
            This helps us improve our service and better understand your needs.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for cancelling
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Plans changed, flight cancelled, found alternative..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !reason.trim()}
            className="w-full px-4 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Cancellation"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Confirm confirmation
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirm Your Trip
          </h1>
          <p className="text-gray-600">You're confirming this trip:</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm space-y-2">
          <div>
            <strong>Booking:</strong> {trip.booking_number}
          </div>
          <div>
            <strong>Date:</strong>{" "}
            {new Date(trip.start_time).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "America/Chicago",
            })}
          </div>
          {trip.driver_name && (
            <div>
              <strong>Driver:</strong> {trip.driver_name}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setDecision(null);
              setError(null);
            }}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            disabled={submitting}
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Trip"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
