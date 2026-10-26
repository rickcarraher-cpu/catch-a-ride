import {
  DollarSign,
  Plus,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  Search,
  Undo2,
  TrendingUp,
} from "lucide-react";

export function TransactionActions({
  isPaid,
  onReconcile,
  onVerifySquare,
  onMarkPaid,
  onRefund,
  onReversePayment,
  onSplitPayment,
  onAddTransaction,
  onAdjustPrice,
  isReconciling,
  isVerifying,
  isMarkingPaid,
  isReversingPayment,
  hasBookingNumber,
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={onReconcile}
        disabled={isReconciling || !hasBookingNumber}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        title="Search Square API multiple ways to find a completed payment for this trip"
      >
        <Search size={14} className={isReconciling ? "animate-pulse" : ""} />
        {isReconciling ? "Searching..." : "Reconcile Square"}
      </button>
      <button
        onClick={onVerifySquare}
        disabled={isVerifying}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        title="Check Square API to verify if a payment link was completed"
      >
        <RefreshCw size={14} className={isVerifying ? "animate-spin" : ""} />
        {isVerifying ? "Checking..." : "Verify Square"}
      </button>
      <button
        onClick={onMarkPaid}
        disabled={isMarkingPaid}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
        title="Emergency: manually mark as paid if payment was verified outside system"
      >
        <AlertCircle size={14} />
        {isMarkingPaid ? "Marking..." : "Mark as Paid"}
      </button>
      <button
        onClick={onReversePayment}
        disabled={isReversingPayment}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
        title="Remove the payment entirely — trip goes back to unpaid"
      >
        <Undo2 size={14} />
        {isReversingPayment ? "Reversing..." : "Reverse Payment"}
      </button>
      <button
        onClick={onRefund}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
      >
        <RotateCcw size={14} />
        Refund
      </button>
      <button
        onClick={onSplitPayment}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
      >
        <DollarSign size={14} />
        Split Payment
      </button>
      <button
        onClick={onAdjustPrice}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 transition-colors"
        title="Adjust the initial quote amount (add surcharge or apply discount)"
      >
        <TrendingUp size={14} />
        Adjust Price
      </button>
      <button
        onClick={onAddTransaction}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus size={14} />
        Add Transaction
      </button>
    </div>
  );
}
