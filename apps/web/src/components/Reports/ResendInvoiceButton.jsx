import React, { useState } from "react";
import { Send, X, Loader2, Mail, MessageSquare } from "lucide-react";
import { toast } from "@/utils/notify";

export function ResendInvoiceButton({ trip, onSuccess }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Determine notification preference for display
  const pref = trip.client_notification_preference || "both";
  const willSendEmail =
    (pref === "email" || pref === "both") && trip.client_email;
  const willSendSms = (pref === "sms" || pref === "both") && trip.client_phone;
  const channelLabel =
    willSendEmail && willSendSms
      ? "email + SMS"
      : willSendSms
        ? "SMS"
        : "email";

  const handleSend = async () => {
    if (!selectedMethod) {
      toast.error("Please select a payment method");
      return;
    }

    // Map button labels to invoice endpoint payment_method values
    const methodMap = {
      Square: "Square Invoice",
      Venmo: "Venmo",
      Zelle: "Zelle",
    };

    setIsSending(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: trip.id,
          payment_method: methodMap[selectedMethod] || selectedMethod,
          send_via: "email",
          notification_preference: pref,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send invoice");
      }

      const data = await res.json();

      // Check if email was actually sent vs skipped
      if (
        data.skippedEmails &&
        data.skippedEmails.length > 0 &&
        (!data.sentEmails || data.sentEmails.length === 0) &&
        !data.smsSent
      ) {
        toast.warning(
          data.emailSkippedReason ||
            "Invoice was skipped — a duplicate was already sent recently. Wait a few minutes and try again.",
        );
      } else if (data.emailSent === false && !data.smsSent) {
        toast.error(
          "Invoice created but notifications failed to send. Check communication log for details.",
        );
      } else {
        const sentVia = [];
        if (data.emailSent || (data.sentEmails && data.sentEmails.length > 0))
          sentVia.push("email");
        if (data.smsSent) sentVia.push("SMS");
        const sentLabel =
          sentVia.length > 0 ? sentVia.join(" + ") : channelLabel;
        toast.success(`Invoice sent via ${sentLabel} (${selectedMethod})`);
      }

      setIsOpen(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error sending invoice:", error);
      toast.error(error.message || "Failed to send invoice");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        title="Send payment link"
      >
        <Send className="w-4 h-4" />
        Send Invoice
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Send Payment Link
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Trip: <span className="font-medium">{trip.booking_number}</span>
              </p>
              <p className="text-sm text-gray-600 mb-2">
                Passenger:{" "}
                <span className="font-medium">{trip.client_name}</span>
              </p>
              <p className="text-sm text-gray-600 mb-3">
                Amount Due:{" "}
                <span className="font-medium text-red-600">
                  ${Number(trip.balance_due || 0).toFixed(2)}
                </span>
              </p>

              {/* Notification preference display */}
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
                  Send via:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {willSendEmail && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      <Mail className="w-3 h-3" />
                      Email
                    </span>
                  )}
                  {willSendSms && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                      <MessageSquare className="w-3 h-3" />
                      SMS
                    </span>
                  )}
                  {!willSendEmail && !willSendSms && (
                    <span className="text-xs text-amber-600">
                      No contact info on file
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="space-y-2">
                {["Square", "Venmo", "Zelle"].map((method) => (
                  <label
                    key={method}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      value={method}
                      checked={selectedMethod === method}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {method}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !selectedMethod}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send via {channelLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
