import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function RefundForm({ tripId, trip, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const paymentAmount = Number(trip?.payment_amount) || 0;

  const [formData, setFormData] = useState({
    amount: paymentAmount > 0 ? paymentAmount.toFixed(2) : "",
    reason: "",
    refund_method: trip?.payment_method || "Cash",
    refunded_by: "",
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`/api/appointments/${tripId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to process refund");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || "Refund processed successfully");
      onSuccess();
    },
    onError: (err) => toast.error(err.message || "Failed to process refund"),
  });

  const refundAmount = parseFloat(formData.amount) || 0;
  const isFullRefund = refundAmount >= paymentAmount;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-red-600" />
          <h4 className="text-sm font-bold text-red-900">Process Refund</h4>
        </div>
        <button
          onClick={onClose}
          className="text-red-400 hover:text-red-600 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-white border border-red-100 rounded-lg">
        <span className="text-xs font-semibold text-gray-500">
          Original Payment
        </span>
        <span className="text-sm font-bold text-gray-900">
          ${paymentAmount.toFixed(2)} via {trip?.payment_method || "N/A"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Refund Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={paymentAmount}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            placeholder="0.00"
          />
          {refundAmount > 0 && refundAmount < paymentAmount && (
            <p className="text-[10px] text-orange-600 font-medium">
              Partial refund — ${(paymentAmount - refundAmount).toFixed(2)}{" "}
              remaining
            </p>
          )}
          {isFullRefund && refundAmount > 0 && (
            <p className="text-[10px] text-red-600 font-medium">Full refund</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Refund Method
          </label>
          <select
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500"
            value={formData.refund_method}
            onChange={(e) =>
              setFormData({ ...formData, refund_method: e.target.value })
            }
          >
            <option value="Cash">Cash</option>
            <option value="Farm">Farm</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Check">Check</option>
            <option value="Zelle">Zelle</option>
            <option value="Venmo">Venmo</option>
            <option value="Square">Square</option>
            <option value="Comp">🎁 Comp</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Issued By (optional)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500"
            value={formData.refunded_by}
            onChange={(e) =>
              setFormData({ ...formData, refunded_by: e.target.value })
            }
            placeholder="Admin name"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Reason (optional)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-500"
            value={formData.reason}
            onChange={(e) =>
              setFormData({ ...formData, reason: e.target.value })
            }
            placeholder="e.g. Cancelled trip"
          />
        </div>
      </div>

      <div className="bg-white border border-red-100 rounded-lg px-3 py-2 space-y-1">
        <p className="text-xs text-red-700 font-semibold">What this will do:</p>
        <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
          <li>
            Record a refund transaction of $
            {refundAmount > 0 ? refundAmount.toFixed(2) : "0.00"}
          </li>
          {trip?.employee_id && (
            <li>Automatically reverse driver commission proportionally</li>
          )}
          <li>
            Update trip payment status to "
            {isFullRefund ? "Refunded" : "Partial Refund"}"
          </li>
        </ul>
      </div>

      <button
        onClick={() => mutation.mutate(formData)}
        disabled={
          mutation.isPending ||
          !formData.amount ||
          refundAmount <= 0 ||
          refundAmount > paymentAmount
        }
        className="w-full px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
      >
        {mutation.isPending
          ? "Processing..."
          : `Process ${isFullRefund ? "Full" : "Partial"} Refund of $${refundAmount > 0 ? refundAmount.toFixed(2) : "0.00"}`}
      </button>
    </div>
  );
}
