import { Receipt } from "lucide-react";
import { TransactionRow } from "./TransactionRow";

export function TransactionsList({
  transactions,
  isLoading,
  onDeleteTransaction,
}) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 text-center text-gray-400 text-xs">
          Loading transactions...
        </div>
      </div>
    );
  }

  // Filter out commission expenses - they're system-generated and shouldn't be shown
  const displayTransactions = (transactions || []).filter((t) => {
    // Hide expense transactions that are commission-related
    if (t.category === "expense" && t.description) {
      const desc = t.description.toLowerCase();
      return !desc.includes("commission");
    }
    return true;
  });

  if (displayTransactions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 text-center">
          <Receipt size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No transactions yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add the initial payment or a tip
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
              Date
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
              Type
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
              Method
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
              Notes
            </th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider">
              Date & Time Paid
            </th>
            <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
              Amount
            </th>
            {/* Removed Running Total column */}
            <th className="px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {displayTransactions.map((t) => (
            <TransactionRow
              key={t.id}
              transaction={t}
              onDelete={onDeleteTransaction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
