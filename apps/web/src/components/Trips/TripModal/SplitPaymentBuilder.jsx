import { useState, useMemo } from "react";
import { Plus, Trash2, Check, AlertCircle, DollarSign } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getTodayInCDT } from "@/utils/timezone";

const PAYMENT_METHODS = ["Cash", "Square Invoice", "Check", "Zelle", "Venmo"];

export function SplitPaymentBuilder({ tripId, trip, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const tripTotal = Number(trip?.original_amount) || 0;
  const alreadyPaid = Number(trip?.payments_total) || 0;
  const balanceDue = Number(trip?.balance_due) || tripTotal;

  // Initialize with one empty split
  const [splits, setSplits] = useState([
    { method: "Cash", amount: "", isTip: false, id: Date.now() },
  ]);

  // Calculate totals
  const { totalAmount, tipAmount, nonTipTotal, remainingAmount } =
    useMemo(() => {
      const total = splits.reduce(
        (sum, s) => sum + (parseFloat(s.amount) || 0),
        0,
      );
      const tip = splits
        .filter((s) => s.isTip)
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const nonTip = splits
        .filter((s) => !s.isTip)
        .reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      const remaining = balanceDue - nonTip;
      return {
        totalAmount: total,
        tipAmount: tip,
        nonTipTotal: nonTip,
        remainingAmount: remaining,
      };
    }, [splits, balanceDue]);

  const isFullyCovered = Math.abs(remainingAmount) < 0.01 && nonTipTotal > 0;
  const isOverpaid = remainingAmount < -0.01;

  // Add new split
  const addSplit = () => {
    setSplits([
      ...splits,
      { method: "Cash", amount: "", isTip: false, id: Date.now() },
    ]);
  };

  // Remove split
  const removeSplit = (id) => {
    if (splits.length > 1) {
      setSplits(splits.filter((s) => s.id !== id));
    }
  };

  // Update split
  const updateSplit = (id, field, value) => {
    setSplits(splits.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  // Auto-fill remaining amount
  const autoFillRemaining = () => {
    if (splits.length > 0 && remainingAmount > 0) {
      const lastSplit = splits[splits.length - 1];
      updateSplit(lastSplit.id, "amount", remainingAmount.toFixed(2));
    }
  };

  // Save all splits as individual transactions
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate splits
      const validSplits = splits.filter((s) => parseFloat(s.amount) > 0);
      if (validSplits.length === 0) {
        throw new Error("Please add at least one payment with an amount");
      }

      // Create all transactions
      const promises = validSplits.map((split) => {
        const amount = parseFloat(split.amount);
        return fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: tripId,
            category: split.isTip ? "tip" : "payment",
            method: split.method,
            amount: split.isTip ? 0 : amount,
            tip_amount: split.isTip ? amount : 0,
            description: `Split payment via ${split.method}${split.isTip ? " (tip)" : ""}`,
            transaction_date: getTodayInCDT(), // Use CDT timezone
          }),
        }).then((res) => {
          if (!res.ok)
            throw new Error(`Failed to create ${split.method} transaction`);
          return res.json();
        });
      });

      await Promise.all(promises);

      // Update appointment payment status if fully paid
      if (isFullyCovered) {
        const nonTipTotal = validSplits
          .filter((s) => !s.isTip)
          .reduce((sum, s) => sum + parseFloat(s.amount), 0);

        await fetch(`/api/appointments/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_status: "paid",
            payment_date: new Date().toISOString(),
            payment_amount: nonTipTotal,
            payment_method:
              validSplits.length > 1 ? "Multiple" : validSplits[0].method,
          }),
        });
      }
    },
    onSuccess: () => {
      toast.success(
        `${splits.filter((s) => parseFloat(s.amount) > 0).length} payment(s) recorded`,
      );
      queryClient.invalidateQueries({
        queryKey: ["trip-transactions", tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save split payments");
    },
  });

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-green-600" />
          <h4 className="text-sm font-bold text-green-900">Split Payment</h4>
        </div>
        <button
          onClick={onClose}
          className="text-green-600 hover:text-green-800 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>

      {/* Trip Summary */}
      <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Trip Total:</span>
          <span className="font-bold text-gray-900">
            ${tripTotal.toFixed(2)}
          </span>
        </div>
        {alreadyPaid > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Already Paid:</span>
            <span className="font-semibold text-green-700">
              -${alreadyPaid.toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Balance Due:</span>
          <span className="text-lg font-black text-blue-700">
            ${balanceDue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment Splits */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            Payment Splits
          </h5>
          {remainingAmount > 0.01 && (
            <button
              onClick={autoFillRemaining}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              Fill Remaining
            </button>
          )}
        </div>

        {splits.map((split, index) => (
          <div
            key={split.id}
            className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-600 uppercase">
                    Method
                  </label>
                  <select
                    value={split.method}
                    onChange={(e) =>
                      updateSplit(split.id, "method", e.target.value)
                    }
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-600 uppercase">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={split.amount}
                      onChange={(e) =>
                        updateSplit(split.id, "amount", e.target.value)
                      }
                      placeholder="0.00"
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {splits.length > 1 && (
                <button
                  onClick={() => removeSplit(split.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors mt-5"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Tip checkbox */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={split.isTip}
                onChange={(e) =>
                  updateSplit(split.id, "isTip", e.target.checked)
                }
                className="w-3.5 h-3.5 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
              />
              <span className="text-xs text-gray-600 group-hover:text-gray-800 font-medium">
                This is a tip
              </span>
            </label>
          </div>
        ))}

        <button
          onClick={addSplit}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 rounded-lg text-xs font-semibold text-gray-600 hover:text-green-700 transition-colors"
        >
          <Plus size={14} />
          Add Another Payment
        </button>
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Total Payments:</span>
          <span className="font-bold text-gray-900">
            ${totalAmount.toFixed(2)}
          </span>
        </div>
        {tipAmount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Tips:</span>
            <span className="font-semibold text-green-700">
              ${tipAmount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700">Remaining:</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-base font-black ${
                isFullyCovered
                  ? "text-green-600"
                  : isOverpaid
                    ? "text-red-600"
                    : "text-amber-600"
              }`}
            >
              ${Math.abs(remainingAmount).toFixed(2)}
            </span>
            {isFullyCovered && <Check size={16} className="text-green-600" />}
            {isOverpaid && <AlertCircle size={16} className="text-red-600" />}
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {isFullyCovered && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-100 border border-green-300 rounded-lg">
          <Check size={14} className="text-green-700" />
          <p className="text-xs font-bold text-green-700">
            ✓ Fully covered! Ready to save.
          </p>
        </div>
      )}

      {isOverpaid && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-lg">
          <AlertCircle size={14} className="text-red-700" />
          <p className="text-xs font-bold text-red-700">
            Payments exceed balance by ${Math.abs(remainingAmount).toFixed(2)}
          </p>
        </div>
      )}

      {!isFullyCovered && !isOverpaid && totalAmount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 border border-amber-300 rounded-lg">
          <AlertCircle size={14} className="text-amber-700" />
          <p className="text-xs font-bold text-amber-700">
            ${remainingAmount.toFixed(2)} still needed for full payment
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || totalAmount === 0}
          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending
            ? "Saving..."
            : `Save ${splits.filter((s) => parseFloat(s.amount) > 0).length} Payment(s)`}
        </button>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> Each payment will be recorded as a separate
          transaction. You can save partial payments now and add more later.
        </p>
      </div>
    </div>
  );
}
