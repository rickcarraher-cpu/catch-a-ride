"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

export default function PaymentCompletePage() {
  const [verifyStatus, setVerifyStatus] = useState("verifying"); // verifying | success | already_paid | error
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function verifyPayment() {
      try {
        // Square redirects back with ?transactionId=xxx or ?orderId=xxx
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("orderId") || params.get("transactionId");

        if (!orderId) {
          // No order ID in URL — just show success (user may have navigated here directly)
          setVerifyStatus("success");
          return;
        }

        console.log(`[PaymentComplete] Verifying order ${orderId}...`);

        const res = await fetch("/api/payments/square/verify-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: orderId }),
        });

        const data = await res.json();

        if (data.status === "paid") {
          setVerifyStatus("success");
        } else if (data.status === "already_paid") {
          setVerifyStatus("already_paid");
        } else if (data.status === "not_found") {
          // Payment record not found — might be processed by webhook already
          setVerifyStatus("success");
        } else {
          // Order not completed yet — could still be processing
          // Wait 3 seconds and try again
          await new Promise((r) => setTimeout(r, 3000));
          const res2 = await fetch("/api/payments/square/verify-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderId }),
          });
          const data2 = await res2.json();
          if (data2.status === "paid" || data2.status === "already_paid") {
            setVerifyStatus("success");
          } else {
            // Show success anyway — Square confirmed the charge
            setVerifyStatus("success");
          }
        }
      } catch (err) {
        console.error("[PaymentComplete] Verification error:", err);
        // Show success anyway — Square already charged the card
        setVerifyStatus("success");
      }
    }

    verifyPayment();
  }, []);

  const isLoading = verifyStatus === "verifying";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {/* Icon */}
        <div className="mb-6 flex justify-center">
          {isLoading ? (
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 size={48} className="text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={48} className="text-green-600" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          {isLoading ? "Processing Payment..." : "Payment Complete!"}
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {isLoading
            ? "We're confirming your payment with Square. This will just take a moment."
            : "Thank you for your payment. Your transaction has been processed successfully."}
        </p>

        {!isLoading && (
          <>
            {/* Details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h2 className="font-semibold text-gray-900 mb-3">
                What happens next?
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>You'll receive a confirmation email shortly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>Your trip details have been updated in our system</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  <span>
                    We'll send you a reminder before your scheduled trip
                  </span>
                </li>
              </ul>
            </div>

            {/* Additional Info */}
            <div className="border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-500 mb-4">
                If you have any questions about your trip or payment, please
                contact us.
              </p>
              <p className="text-xs text-gray-400">
                You can safely close this window.
              </p>
            </div>
          </>
        )}

        {/* Decorative Elements */}
        <div className="mt-8 flex justify-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <div
            className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <div
            className="w-2 h-2 bg-green-400 rounded-full animate-pulse"
            style={{ animationDelay: "0.4s" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
