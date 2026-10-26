import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  CreditCard,
  Banknote,
  AlertCircle,
  Gift,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { getTodayInCDT } from "@/utils/timezone";

export function AddTransactionForm({ tripId, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    // Trip payment
    paymentAmount: "",
    paymentMethod: "Cash",
    // Tip
    tipAmount: "",
    tipMethod: "Cash",
    // Second Tip (NEW)
    secondTipAmount: "",
    secondTipMethod: "Cash",
    // Shared
    transaction_date: getTodayInCDT(), // Use CDT timezone for default date
    description: "",
    // Comp options
    compType: "full", // "full" or "partial"
  });

  // Fetch trip data to calculate full comp amount
  const { data: trip } = useQuery({
    queryKey: ["trip-details-for-comp", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
    enabled: formData.paymentMethod === "Comp",
  });

  const tripPrice =
    trip?.appointment_services?.reduce(
      (sum, s) => sum + Number(s.service_price) * (Number(s.quantity) || 1),
      0,
    ) ?? 0;

  const balanceDue = trip?.balance_due ?? 0;

  const isCompPayment = formData.paymentMethod === "Comp";

  // Handle comp type changes
  const handleCompTypeChange = (type) => {
    setFormData({ ...formData, compType: type });
    if (type === "full") {
      // Auto-fill with balance due (or trip price if no balance due)
      const compAmount = balanceDue > 0 ? balanceDue : tripPrice;
      setFormData({
        ...formData,
        compType: type,
        paymentAmount: compAmount > 0 ? compAmount.toFixed(2) : "",
      });
    } else {
      // Clear for partial entry
      setFormData({ ...formData, compType: type, paymentAmount: "" });
    }
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const hasPayment =
        data.paymentAmount && parseFloat(data.paymentAmount) > 0;
      const hasTip = data.tipAmount && parseFloat(data.tipAmount) > 0;
      const hasSecondTip =
        data.secondTipAmount && parseFloat(data.secondTipAmount) > 0;

      if (!hasPayment && !hasTip && !hasSecondTip) {
        throw new Error("Please enter at least a payment amount or tip amount");
      }

      // Create payment transaction if amount specified
      if (hasPayment) {
        const isComp = data.paymentMethod === "Comp";
        const compPrefix = isComp
          ? data.compType === "full"
            ? "Full Comp"
            : "Partial Comp"
          : "";

        const paymentRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: tripId,
            category: "payment",
            method: data.paymentMethod,
            amount: parseFloat(data.paymentAmount),
            tip_amount: 0,
            description: data.description || compPrefix || "Trip payment",
            transaction_date: data.transaction_date,
          }),
        });
        if (!paymentRes.ok)
          throw new Error("Failed to create payment transaction");

        // Update appointment payment status
        const updateRes = await fetch(`/api/appointments/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_status: "paid",
            payment_date: new Date().toISOString(),
            payment_amount: parseFloat(data.paymentAmount),
            payment_method: data.paymentMethod,
          }),
        });
        if (!updateRes.ok) throw new Error("Failed to update payment status");
      }

      // Create tip transaction if amount specified
      if (hasTip) {
        const tipRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: tripId,
            category: "payment",
            method: data.tipMethod,
            amount: 0,
            tip_amount: parseFloat(data.tipAmount),
            description: data.description ? `${data.description} - Tip` : "Tip",
            transaction_date: data.transaction_date,
          }),
        });
        if (!tipRes.ok) throw new Error("Failed to create tip transaction");
      }

      // Create second tip transaction if amount specified (NEW)
      if (hasSecondTip) {
        const secondTipRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: tripId,
            category: "payment",
            method: data.secondTipMethod,
            amount: 0,
            tip_amount: parseFloat(data.secondTipAmount),
            description: data.description
              ? `${data.description} - Tip #2`
              : "Tip #2",
            transaction_date: data.transaction_date,
          }),
        });
        if (!secondTipRes.ok)
          throw new Error("Failed to create second tip transaction");
      }

      return { success: true };
    },
    onSuccess: () => {
      const hasPayment =
        formData.paymentAmount && parseFloat(formData.paymentAmount) > 0;
      const hasTip = formData.tipAmount && parseFloat(formData.tipAmount) > 0;
      const hasSecondTip =
        formData.secondTipAmount && parseFloat(formData.secondTipAmount) > 0;

      if (hasPayment && hasTip && hasSecondTip) {
        toast.success("Payment and 2 tips added");
      } else if (hasPayment && (hasTip || hasSecondTip)) {
        toast.success("Payment and tip added");
      } else if (hasTip && hasSecondTip) {
        toast.success("2 tips added");
      } else if (hasPayment) {
        toast.success("Payment added");
      } else {
        toast.success("Tip added");
      }

      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      onSuccess();
    },
    onError: (error) =>
      toast.error(error.message || "Failed to add transaction"),
  });

  const totalAmount =
    (parseFloat(formData.paymentAmount) || 0) +
    (parseFloat(formData.tipAmount) || 0) +
    (parseFloat(formData.secondTipAmount) || 0);

  // Check if user is recording cash tips
  const hasCashTip =
    formData.tipAmount &&
    parseFloat(formData.tipAmount) > 0 &&
    formData.tipMethod === "Cash";

  const hasSecondCashTip =
    formData.secondTipAmount &&
    parseFloat(formData.secondTipAmount) > 0 &&
    formData.secondTipMethod === "Cash";

  // Show second tip section only if first tip has an amount
  const showSecondTip =
    formData.tipAmount && parseFloat(formData.tipAmount) > 0;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-900">Add Payment & Tip</h4>
        <button
          onClick={onClose}
          className="text-blue-400 hover:text-blue-600 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>

      {/* Trip Payment Section */}
      <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-blue-600" />
          <h5 className="text-xs font-bold text-gray-900">Trip Payment</h5>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
              value={formData.paymentAmount}
              onChange={(e) =>
                setFormData({ ...formData, paymentAmount: e.target.value })
              }
              placeholder="0.00"
              disabled={isCompPayment && formData.compType === "full"}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Payment Method
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={formData.paymentMethod}
              onChange={(e) =>
                setFormData({ ...formData, paymentMethod: e.target.value })
              }
            >
              <option value="Cash">Cash</option>
              <option value="Farm">Farm</option>
              <option value="Zelle">Zelle</option>
              <option value="Venmo">Venmo</option>
              <option value="Square">Square</option>
              <option value="Comp">🎁 Comp</option>
            </select>
          </div>
        </div>

        {/* Comp Type Selector (only shown when Comp is selected) */}
        {isCompPayment && (
          <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 space-y-2">
            <label className="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
              <Gift size={14} />
              Comp Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCompTypeChange("full")}
                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                  formData.compType === "full"
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-100"
                }`}
              >
                Full Comp
              </button>
              <button
                type="button"
                onClick={() => handleCompTypeChange("partial")}
                className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition-all ${
                  formData.compType === "partial"
                    ? "bg-purple-600 text-white shadow-md"
                    : "bg-white text-purple-700 border border-purple-200 hover:bg-purple-100"
                }`}
              >
                Partial Comp
              </button>
            </div>
            <p className="text-xs text-purple-700 mt-2">
              {formData.compType === "full"
                ? `✓ Full comp pays the entire ${balanceDue > 0 ? "balance due" : "trip price"}: $${balanceDue > 0 ? balanceDue.toFixed(2) : tripPrice.toFixed(2)}`
                : "✓ Partial comp — enter the dollar amount to comp above"}
            </p>
          </div>
        )}
      </div>

      {/* Tip Section */}
      <div className="bg-white border border-green-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote size={16} className="text-green-600" />
          <h5 className="text-xs font-bold text-gray-900">Tip (Optional)</h5>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              value={formData.tipAmount}
              onChange={(e) =>
                setFormData({ ...formData, tipAmount: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">
              Payment Method
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              value={formData.tipMethod}
              onChange={(e) =>
                setFormData({ ...formData, tipMethod: e.target.value })
              }
            >
              <option value="Cash">Cash</option>
              <option value="Farm">Farm</option>
              <option value="Zelle">Zelle</option>
              <option value="Venmo">Venmo</option>
              <option value="Square">Square</option>
            </select>
          </div>
        </div>
      </div>

      {/* Second Tip Section (NEW) - Only shown if first tip has amount */}
      {showSecondTip && (
        <div className="bg-white border border-green-300 rounded-lg p-3 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-green-700" />
            <h5 className="text-xs font-bold text-gray-900">
              Second Tip (Optional)
            </h5>
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
              💡 For additional cash/card tips
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">
                Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                value={formData.secondTipAmount}
                onChange={(e) =>
                  setFormData({ ...formData, secondTipAmount: e.target.value })
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">
                Payment Method
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                value={formData.secondTipMethod}
                onChange={(e) =>
                  setFormData({ ...formData, secondTipMethod: e.target.value })
                }
              >
                <option value="Cash">Cash</option>
                <option value="Farm">Farm</option>
                <option value="Zelle">Zelle</option>
                <option value="Venmo">Venmo</option>
                <option value="Square">Square</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Cash Tip Warning - Updated to show for both tips */}
      {(hasCashTip || hasSecondCashTip) && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle
            size={18}
            className="text-amber-600 mt-0.5 flex-shrink-0"
          />
          <div className="text-xs text-amber-900">
            <p className="font-bold mb-1">
              💵 Cash Tip{hasCashTip && hasSecondCashTip ? "s" : ""} — Payroll
              Deduction
            </p>
            {hasCashTip && (
              <p>
                Tip #1:{" "}
                <strong>
                  ${parseFloat(formData.tipAmount).toFixed(2)} cash tip
                </strong>{" "}
                will be <strong>deducted from the driver's payroll</strong>{" "}
                since they already received it in cash.
              </p>
            )}
            {hasSecondCashTip && (
              <p className="mt-1">
                Tip #2:{" "}
                <strong>
                  ${parseFloat(formData.secondTipAmount).toFixed(2)} cash tip
                </strong>{" "}
                will be <strong>deducted from the driver's payroll</strong>{" "}
                since they already received it in cash.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shared fields */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Transaction Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            value={formData.transaction_date}
            onChange={(e) =>
              setFormData({ ...formData, transaction_date: e.target.value })
            }
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">
            Notes (optional)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="e.g., Airport pickup"
          />
        </div>
      </div>

      {/* Total summary */}
      {totalAmount > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          <span className="text-xs font-semibold text-gray-700">
            Total Amount:
          </span>
          <span className="text-sm font-bold text-gray-900">
            ${totalAmount.toFixed(2)}
          </span>
        </div>
      )}

      <button
        onClick={() => mutation.mutate(formData)}
        disabled={mutation.isPending || totalAmount === 0}
        className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? "Adding..." : "Add Transaction"}
      </button>
    </div>
  );
}
