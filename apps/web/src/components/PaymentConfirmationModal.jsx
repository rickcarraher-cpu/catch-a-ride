import React, { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, Gift, X, CheckCircle2, Loader2 } from "lucide-react";

export default function PaymentConfirmationModal({
  payment,
  tripAmount,
  bookingNumber,
  onClose,
  onSuccess,
}) {
  const [amountReceived, setAmountReceived] = useState(
    tripAmount > 0 ? tripAmount.toFixed(2) : "",
  );
  const [note, setNote] = useState("");

  const received = parseFloat(amountReceived) || 0;
  const tip = received > tripAmount ? received - tripAmount : 0;

  const provider = payment.provider; // 'venmo' or 'zelle'

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        provider === "venmo"
          ? `/api/payments/${payment.id}/confirm-venmo`
          : `/api/payments/${payment.id}/confirm-zelle`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed_by: "Admin",
          confirmedBy: "Admin", // Zelle uses this format
          note: note || null,
          amount_received: received.toFixed(2),
          tip_amount: tip.toFixed(2),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to confirm payment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        `${provider === "venmo" ? "Venmo" : "Zelle"} payment confirmed!`,
      );
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleConfirm = () => {
    if (received <= 0) {
      toast.error("Amount received must be greater than 0");
      return;
    }
    confirmMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-green-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Confirm {provider === "venmo" ? "Venmo" : "Zelle"} Payment
              {bookingNumber && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  Trip #{bookingNumber}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Trip Amount Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Trip Amount
              </span>
              <span className="text-2xl font-bold text-blue-700">
                ${tripAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Amount Received Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Amount Received ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-lg font-semibold focus:ring-2 focus:ring-green-500 focus:border-green-500"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Tip Display (Auto-calculated) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Gift size={12} />
              Tip (Auto-calculated)
            </label>
            <div
              className={`w-full px-4 py-3 border rounded-xl text-lg font-bold transition-all ${
                tip > 0
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "bg-gray-50 border-gray-200 text-gray-400"
              }`}
            >
              {tip > 0 ? `+$${tip.toFixed(2)}` : "$0.00"}
            </div>
            <p className="text-xs text-gray-400">
              {tip > 0
                ? `Customer tipped $${tip.toFixed(2)}`
                : "No tip (amount received = trip amount)"}
            </p>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Note (Optional)
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Confirmed via app notification"
            />
          </div>

          {/* Summary */}
          {received > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base Payment:</span>
                <span className="font-semibold text-gray-900">
                  ${tripAmount.toFixed(2)}
                </span>
              </div>
              {tip > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tip:</span>
                  <span className="font-semibold text-green-600">
                    +${tip.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between">
                <span className="font-bold text-gray-900">Total Received:</span>
                <span className="text-lg font-bold text-green-600">
                  ${received.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={confirmMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <div className="flex-1" />
          <button
            onClick={handleConfirm}
            disabled={
              confirmMutation.isPending || !amountReceived || received <= 0
            }
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Confirm Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
