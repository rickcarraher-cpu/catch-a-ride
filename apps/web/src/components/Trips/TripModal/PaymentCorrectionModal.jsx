import { useState } from "react";
import {
  X,
  DollarSign,
  Copy,
  Check,
  AlertCircle,
  Plus,
  Minus,
  Send,
} from "lucide-react";

export default function PaymentCorrectionModal({ trip, onClose }) {
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [paymentLink, setPaymentLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [manuallyPaid, setManuallyPaid] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [sending, setSending] = useState(false);
  const [sentToPassenger, setSentToPassenger] = useState(false);
  const [sendError, setSendError] = useState(null);

  const currentAmount = Number(
    trip.original_amount || trip.services_total || 0,
  );
  const adjustmentValue = Number(correctionAmount || 0);
  const previewNewAmount = currentAmount + adjustmentValue;
  const isValidAdjustment =
    correctionAmount !== "" && adjustmentValue !== 0 && previewNewAmount >= 0;

  const handleGenerateLink = async () => {
    if (!isValidAdjustment) {
      setError("Please enter a non-zero adjustment amount");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          correction_amount: adjustmentValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate payment link");
      }

      const data = await response.json();
      setResultData(data);
      if (data.payment_url) {
        setPaymentLink(data.payment_url);
      } else {
        // Balance was zero or negative after adjustment — no link needed
        setManuallyPaid(true);
      }
    } catch (err) {
      console.error("Error generating payment link:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCorrection = async () => {
    if (!isValidAdjustment) {
      setError("Please enter a non-zero adjustment amount");
      return;
    }

    const sign = adjustmentValue >= 0 ? "+" : "";
    if (
      !confirm(
        `Adjust trip amount by ${sign}$${adjustmentValue.toFixed(2)}?\n\nCurrent: $${currentAmount.toFixed(2)}\nNew Amount: $${previewNewAmount.toFixed(2)}\n\nThis will update the trip amount and recalculate the balance.`,
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: trip.id,
          correction_amount: adjustmentValue,
          manual_confirm: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to apply correction");
      }

      const data = await response.json();
      setResultData(data);
      setManuallyPaid(true);

      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 1500);
    } catch (err) {
      console.error("Error applying correction:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!paymentLink) return;

    try {
      await navigator.clipboard.writeText(paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleSendToPassenger = async () => {
    setSending(true);
    setSendError(null);
    try {
      const response = await fetch(
        `/api/appointments/${trip.id}/resend-confirmation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "passenger",
            channel: "all",
            include_office: true,
          }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send confirmation");
      }
      setSentToPassenger(true);
    } catch (err) {
      console.error("Error sending to passenger:", err);
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">
            Payment Correction
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Trip Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-gray-700 mb-3">Trip Details</h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Booking Number:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {trip.booking_number || `#${trip.id}`}
                </span>
              </div>

              <div>
                <span className="text-gray-600">Passenger:</span>
                <span className="ml-2 font-medium text-gray-800">
                  {trip.client_name || "N/A"}
                </span>
              </div>

              <div>
                <span className="text-gray-600">Current Trip Amount:</span>
                <span className="ml-2 font-bold text-gray-800">
                  ${currentAmount.toFixed(2)}
                </span>
              </div>

              <div>
                <span className="text-gray-600">Balance Due:</span>
                <span className="ml-2 font-medium text-gray-800">
                  ${Number(trip.balance_due || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Adjustment Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adjustment Amount (+/−)
            </label>
            <div className="relative">
              <DollarSign
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="number"
                step="0.01"
                value={correctionAmount}
                onChange={(e) => {
                  setCorrectionAmount(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 27.50 or -10.00"
                disabled={loading || !!paymentLink || manuallyPaid}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use a positive number to increase the trip amount, or a negative
              number to decrease it.
            </p>
          </div>

          {/* Preview of Adjustment */}
          {correctionAmount !== "" && adjustmentValue !== 0 && (
            <div
              className={`rounded-lg p-4 border ${previewNewAmount < 0 ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Current Amount:</span>
                <span className="font-medium">${currentAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Adjustment:</span>
                <span
                  className={`font-medium ${adjustmentValue >= 0 ? "text-green-700" : "text-red-700"}`}
                >
                  {adjustmentValue >= 0 ? "+" : ""}${adjustmentValue.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-gray-300">
                <span className="font-semibold text-gray-800">
                  New Trip Amount:
                </span>
                <span
                  className={`font-bold text-lg ${previewNewAmount < 0 ? "text-red-600" : "text-gray-900"}`}
                >
                  ${previewNewAmount.toFixed(2)}
                </span>
              </div>
              {previewNewAmount < 0 && (
                <p className="text-xs text-red-600 mt-2">
                  Trip amount cannot be negative.
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle
                className="text-red-500 flex-shrink-0 mt-0.5"
                size={18}
              />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Correction Applied Success */}
          {manuallyPaid && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <Check size={20} />
                <span>Correction Applied</span>
              </div>
              <p className="text-sm text-gray-600">
                Trip amount adjusted from $
                {resultData?.previous_amount?.toFixed(2) ||
                  currentAmount.toFixed(2)}{" "}
                to $
                {resultData?.new_amount?.toFixed(2) ||
                  previewNewAmount.toFixed(2)}
                . The balance has been recalculated. This page will refresh
                automatically.
              </p>
            </div>
          )}

          {/* Payment Link Display */}
          {paymentLink && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-medium">
                <Check size={20} />
                <span>Correction Applied & Payment Link Generated</span>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                Trip amount adjusted from $
                {resultData?.previous_amount?.toFixed(2) ||
                  currentAmount.toFixed(2)}{" "}
                to $
                {resultData?.new_amount?.toFixed(2) ||
                  previewNewAmount.toFixed(2)}
                . Remaining balance: $
                {resultData?.balance_due?.toFixed(2) || "—"}
              </p>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Payment Link:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={paymentLink}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                      copied
                        ? "bg-green-600 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Send to Passenger */}
              <div className="pt-3 border-t border-green-200">
                {sentToPassenger ? (
                  <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                    <Check size={18} />
                    Sent to passenger &amp; office — driver not notified.
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleSendToPassenger}
                      disabled={sending}
                      className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        "Sending…"
                      ) : (
                        <>
                          <Send size={18} />
                          Send to Passenger (+ Office, not Driver)
                        </>
                      )}
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      Sends the updated confirmation with the new payment link.
                      Office is CC'd. Driver is not notified.
                    </p>
                  </>
                )}
                {sendError && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <AlertCircle
                      className="text-red-500 flex-shrink-0 mt-0.5"
                      size={16}
                    />
                    <p className="text-sm text-red-700">{sendError}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            {!paymentLink && !manuallyPaid ? (
              <>
                <button
                  onClick={handleApplyCorrection}
                  disabled={loading || !isValidAdjustment}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    "Applying..."
                  ) : (
                    <>
                      <Check size={18} />
                      Apply Correction
                    </>
                  )}
                </button>
                <button
                  onClick={handleGenerateLink}
                  disabled={loading || !isValidAdjustment}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? "Generating..." : "Apply & Send Payment Link"}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>

          {/* Help Text */}
          {!paymentLink && !manuallyPaid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>💡 Tip:</strong> "Apply Correction" adjusts the trip
                amount and recalculates the balance. "Apply & Send Payment Link"
                does the same but also generates a Square invoice for the
                remaining balance to send to the customer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
