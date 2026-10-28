"use client";

import { useState, useEffect } from "react";
import { Check, Copy, AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "@/utils/notify";

export default function ZellePaymentPage({ params }) {
  const { trip_id } = params;
  const [payment, setPayment] = useState(null);
  const [tripInfo, setTripInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState({
    email: false,
    phone: false,
    amount: false,
  });

  useEffect(() => {
    loadPaymentInfo();
  }, []);

  const loadPaymentInfo = async () => {
    try {
      const res = await fetch(`/api/payments/trip/${trip_id}/status`);
      if (!res.ok) throw new Error("Failed to load payment information");
      const data = await res.json();
      setPayment(data.activePayment);
      setTripInfo(data.trip);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [field]: true });
    toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} copied`);
    setTimeout(() => setCopied({ ...copied, [field]: false }), 2000);
  };

  const markAsSent = async () => {
    try {
      const res = await fetch(`/api/payments/${payment.id}/customer-sent`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to update status");
      toast.success("Thank you! We will confirm your payment shortly.");
      setTimeout(() => loadPaymentInfo(), 1000);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">
            Loading payment information...
          </p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Payment Not Found
          </h2>
          <p className="text-sm text-gray-600">
            This payment link may have expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  const zelleEmail =
    payment.metadata?.zelle_email ||
    payment.metadata?.zelle_contact ||
    process.env.NEXT_PUBLIC_ZELLE_EMAIL;
  const zellePhone =
    payment.metadata?.zelle_phone || process.env.NEXT_PUBLIC_ZELLE_PHONE;
  const zelleName =
    payment.metadata?.zelle_name ||
    process.env.NEXT_PUBLIC_ZELLE_NAME ||
    "Business";
  const amount = Number(payment.amount).toFixed(2);

  // Use booking number for display, never show internal ID
  const displayRef = tripInfo?.booking_number || "Booking";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="mb-4 flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pay with Zelle
          </h1>
          <p className="text-sm text-gray-600">Booking #{displayRef}</p>
        </div>

        <div className="space-y-6">
          {/* Amount */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <p className="text-sm text-gray-600 mb-1">Amount Due</p>
            <div className="flex items-center justify-between">
              <p className="text-4xl font-bold text-gray-900">${amount}</p>
              <button
                onClick={() => copyToClipboard(amount, "amount")}
                className="p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied.amount ? (
                  <Check size={20} className="text-green-600" />
                ) : (
                  <Copy size={20} className="text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">
              Payment Instructions:
            </h3>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                1. Open your Zelle app
              </p>
              <p className="text-xs text-gray-600">
                Available in most banking apps
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">
                2. Send money to:
              </p>

              {zelleEmail && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">Email:</p>
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-gray-900">
                      {zelleEmail}
                    </span>
                    <button
                      onClick={() => copyToClipboard(zelleEmail, "email")}
                      className="ml-2"
                    >
                      {copied.email ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {zellePhone && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Phone:</p>
                  <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-gray-900">
                      {zellePhone}
                    </span>
                    <button
                      onClick={() => copyToClipboard(zellePhone, "phone")}
                      className="ml-2"
                    >
                      {copied.phone ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-600 mt-3">
                Recipient: {zelleName}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                3. Include this in the memo:
              </p>
              <p className="text-sm font-mono bg-white rounded px-3 py-2">
                Booking #{displayRef}
              </p>
            </div>
          </div>

          {/* Status */}
          {payment.status === "manual_pending" ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium">
                ⏳ Waiting for confirmation
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                We'll confirm your payment shortly
              </p>
            </div>
          ) : payment.status === "paid" ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">
                ✅ Payment Confirmed
              </p>
              <p className="text-xs text-green-700 mt-1">
                Thank you for your payment!
              </p>
            </div>
          ) : (
            <button
              onClick={markAsSent}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              I've Sent the Payment
            </button>
          )}

          <p className="text-xs text-center text-gray-500">
            Need help? Contact us for assistance
          </p>
        </div>
      </div>
    </div>
  );
}
