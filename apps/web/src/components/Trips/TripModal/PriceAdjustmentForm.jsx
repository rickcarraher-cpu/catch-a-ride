import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, X } from "lucide-react";
import { toast } from "@/utils/notify";

export function PriceAdjustmentForm({ tripId, trip, onClose, onSuccess }) {
  const queryClient = useQueryClient();

  const originalAmount = Number(trip?.original_amount || 0);
  const servicesTotal = Number(trip?.services_total || 0);
  const currentTotal = originalAmount + servicesTotal;

  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [reason, setReason] = useState("");

  const adjustment = parseFloat(adjustmentAmount) || 0;
  const newOriginalAmount = originalAmount + adjustment;
  const newTotal = newOriginalAmount + servicesTotal;
  const isNegative = adjustment < 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (adjustment === 0) {
        throw new Error("Please enter an adjustment amount");
      }

      const res = await fetch(`/api/appointments/${tripId}/adjust-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustment_amount: adjustment,
          reason: reason || "Price adjustment",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to adjust price");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success(
        isNegative
          ? `Discount of $${Math.abs(adjustment).toFixed(2)} applied`
          : `Surcharge of $${adjustment.toFixed(2)} added`,
      );
      queryClient.invalidateQueries({
        queryKey: ["trip-transactions", tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-purple-600" />
          <h3 className="text-sm font-bold text-purple-900">
            Price Adjustment
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-purple-400 hover:text-purple-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Current Breakdown */}
      <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-purple-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Initial Quote</span>
          <span className="font-semibold text-gray-900">
            ${originalAmount.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Add-ons / Services</span>
          <span className="font-semibold text-gray-900">
            {servicesTotal > 0 ? `+$${servicesTotal.toFixed(2)}` : "$0.00"}
          </span>
        </div>
        <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Current Total</span>
          <span className="text-base font-bold text-purple-700">
            ${currentTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Adjustment Input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700">
          Adjustment Amount ($)
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2.5 bg-white border-2 border-purple-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:border-purple-500 pr-10"
            value={adjustmentAmount}
            onChange={(e) => setAdjustmentAmount(e.target.value)}
            placeholder="Enter amount (+ or -)"
          />
          {adjustment !== 0 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isNegative ? (
                <TrendingDown size={18} className="text-red-500" />
              ) : (
                <TrendingUp size={18} className="text-green-500" />
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-500">
          Enter positive number to add charges, negative to apply discount
        </p>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700">
          Reason (optional)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-white border border-purple-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Extra stop, waiting time, discount..."
        />
      </div>

      {/* New Total Preview */}
      {adjustment !== 0 && (
        <div
          className={`rounded-lg p-3 border-2 ${
            isNegative
              ? "bg-red-50 border-red-200"
              : "bg-green-50 border-green-200"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">
              Adjustment
            </span>
            <span
              className={`text-sm font-bold ${
                isNegative ? "text-red-700" : "text-green-700"
              }`}
            >
              {isNegative ? "-" : "+"}${Math.abs(adjustment).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-300">
            <span className="text-xs font-bold text-gray-900">New Total</span>
            <span className="text-lg font-bold text-purple-900">
              ${newTotal.toFixed(2)}
            </span>
          </div>
          <p className="text-[10px] text-gray-600 mt-2">
            New initial quote: ${newOriginalAmount.toFixed(2)} + Services: $
            {servicesTotal.toFixed(2)}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || adjustment === 0}
        className="w-full px-4 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {mutation.isPending ? (
          "Applying..."
        ) : (
          <>
            <DollarSign size={16} />
            Apply Adjustment
          </>
        )}
      </button>
    </div>
  );
}
