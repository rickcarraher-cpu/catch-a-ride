import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

// Safe date-only formatter: avoids UTC-to-local timezone shift for date-only strings
function formatDateOnly(dateStr) {
  if (!dateStr) return "—";
  const s = String(dateStr).slice(0, 10); // grab "YYYY-MM-DD"
  if (s.length < 10) return s;
  const [yr, mo, dy] = s.split("-").map(Number);
  // Use the multi-arg Date constructor (local time, no UTC offset issue)
  return new Date(yr, mo - 1, dy).toLocaleDateString();
}

// Strip Square reference IDs (long alphanumeric strings like "sxeWQT7yzBCoZ8cFE4DTXKisPwIZY")
// that appear after " - " or at the end of the description
function cleanDescription(desc) {
  if (!desc) return null;
  return (
    desc
      .replace(/\s*[-–]\s*[A-Za-z0-9]{20,}/g, "")
      .replace(/[A-Za-z0-9]{20,}/g, "")
      .trim() || null
  );
}

export function TransactionRow({ transaction, onDelete }) {
  const queryClient = useQueryClient();
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(
    cleanDescription(transaction.description) || "",
  );

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      toast.success("Transaction removed");
      onDelete();
    },
    onError: () => toast.error("Failed to delete transaction"),
  });

  const noteMutation = useMutation({
    mutationFn: async (description) => {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Note saved");
      queryClient.invalidateQueries({ queryKey: ["trip-transactions"] });
    },
    onError: () => toast.error("Failed to save note"),
  });

  const handleNoteBlur = () => {
    setEditingNote(false);
    if (noteValue !== (cleanDescription(transaction.description) || "")) {
      noteMutation.mutate(noteValue);
    }
  };

  const handleNoteKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
    if (e.key === "Escape") {
      setNoteValue(cleanDescription(transaction.description) || "");
      setEditingNote(false);
    }
  };

  const isTipOnly =
    transaction.category === "payment" &&
    Number(transaction.tip_amount || 0) > 0 &&
    Number(transaction.amount || 0) === 0;
  const displayCategory = isTipOnly ? "tip" : transaction.category;

  const isCash = transaction.method === "Cash";

  const categoryLabels = {
    payment: "Payment",
    tip: "Tip",
    expense: "Expense",
    refund: "Refund",
    commission_reversal: "Commission Adj.",
    cc_fee: "CC Fee",
    adjustment: "Adjustment",
  };

  const categoryColors = {
    payment: "bg-blue-100 text-blue-700 border-blue-200",
    tip: "bg-green-100 text-green-700 border-green-200",
    expense: "bg-red-100 text-red-700 border-red-200",
    refund: "bg-orange-100 text-orange-700 border-orange-200",
    commission_reversal: "bg-purple-100 text-purple-700 border-purple-200",
    cc_fee: "bg-amber-100 text-amber-700 border-amber-200",
    adjustment: "bg-indigo-100 text-indigo-700 border-indigo-200",
  };

  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-3 py-2 text-gray-600">
        {formatDateOnly(transaction.transaction_date)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${categoryColors[displayCategory] || "bg-gray-100 text-gray-700 border-gray-200"}`}
          >
            {categoryLabels[displayCategory] || displayCategory}
          </span>
          {isCash && (
            <span
              className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold"
              title="Cash - will be deducted from payroll"
            >
              💵
            </span>
          )}
          {transaction.method === "Comp" && (
            <span
              className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold"
              title="Comp payment"
            >
              🎁
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600">{transaction.method}</td>
      <td className="px-3 py-2 text-gray-600 text-xs">
        {editingNote ? (
          <input
            autoFocus
            type="text"
            className="w-full px-2 py-1 border border-blue-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onBlur={handleNoteBlur}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note..."
          />
        ) : (
          <span
            className="cursor-pointer hover:text-blue-600 hover:underline decoration-dotted"
            title="Click to edit note"
            onClick={() => setEditingNote(true)}
          >
            {noteValue || (
              <span className="text-gray-300 italic">add note</span>
            )}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600 text-xs">
        {transaction.created_at
          ? new Date(transaction.created_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            })
          : "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <span className="font-semibold text-gray-800">
          $
          {(
            Number(transaction.amount) + Number(transaction.tip_amount || 0)
          ).toFixed(2)}
        </span>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => {
            if (confirm("Delete this transaction?")) deleteMutation.mutate();
          }}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
