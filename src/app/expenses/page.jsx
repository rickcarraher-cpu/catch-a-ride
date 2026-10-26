"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  DollarSign,
  Search,
  Filter,
  Calendar,
  Receipt,
  Trash2,
  XCircle,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { PageWithBackButton } from "@/components/PageWithBackButton";
import { getTodayInCDT, formatDateOnly } from "@/utils/timezone";

// ── Period helpers ──────────────────────────────────────────────────────────────

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPeriodBounds(period, offset) {
  const now = new Date();
  let start, end, label;

  if (period === "day") {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    start = day;
    end = dayEnd;
    label =
      offset === 0
        ? "Today"
        : offset === -1
          ? "Yesterday"
          : day.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "America/Chicago",
            });
  } else if (period === "week") {
    const dayOfWeek = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offset * 7);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    start = mon;
    end = sun;
    label =
      offset === 0
        ? "This Week"
        : offset === -1
          ? "Last Week"
          : mon.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "America/Chicago",
            }) +
            " – " +
            sun.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              timeZone: "America/Chicago",
            });
  } else if (period === "month") {
    const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    start = new Date(base.getFullYear(), base.getMonth(), 1);
    end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    label =
      offset === 0
        ? "This Month"
        : base.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "America/Chicago",
          });
  } else {
    const yr = now.getFullYear() + offset;
    start = new Date(yr, 0, 1);
    end = new Date(yr, 11, 31, 23, 59, 59, 999);
    label = offset === 0 ? "This Year" : String(yr);
  }

  return { start, end, label };
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState("month");
  const [offset, setOffset] = useState(0);

  const {
    start,
    end,
    label: periodLabel,
  } = useMemo(() => getPeriodBounds(period, offset), [period, offset]);
  const startStr = toLocalDateStr(start);
  const endStr = toLocalDateStr(end);

  const handlePeriodChange = (p) => {
    setPeriod(p);
    setOffset(0);
  };

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", startStr, endStr],
    queryFn: async () => {
      const res = await fetch(
        `/api/transactions?category=expense&start=${startStr}&end=${endStr}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries(["expenses"]);
      toast.success("Expense removed");
    },
  });

  const totalExpenses =
    expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

  return (
    <>
      <PageWithBackButton>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Expenses
              </h1>
              <p className="text-gray-500 mt-1">
                Track business costs, fuel, and maintenance.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Record Expense
            </button>
          </div>

          {/* Period Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                {["day", "week", "month", "year"].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      period === p
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset((o) => o - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
                  {periodLabel}
                </span>
                <button
                  onClick={() => setOffset((o) => Math.min(o + 1, 0))}
                  disabled={offset === 0}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-gray-500 uppercase">
                Total Expenses
              </p>
              <p className="text-xl font-bold text-gray-900">
                ${totalExpenses.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Category / Description
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses?.length === 0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No expenses recorded.
                    </td>
                  </tr>
                ) : (
                  expenses?.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-900">
                          <Calendar size={14} className="text-gray-400" />
                          {formatDateOnly(e.transaction_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 border border-gray-200">
                            <Tag size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {e.method || "General"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {e.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">
                          ${Number(e.amount).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            if (confirm("Remove this expense record?"))
                              deleteMutation.mutate(e.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageWithBackButton>

      {isModalOpen && (
        <ExpenseModal
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries(["expenses"]);
          }}
        />
      )}
    </>
  );
}

function ExpenseModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    method: "Fuel", // Using method as category for expenses
    amount: "",
    description: "",
    transaction_date: getTodayInCDT(),
  });

  // Fetch expense categories from settings
  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const res = await fetch("/api/settings/expense-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, category: "expense" }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      onSuccess();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Record Expense
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Category
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.method}
                onChange={(e) =>
                  setFormData({ ...formData, method: e.target.value })
                }
              >
                {categories.length > 0 ? (
                  categories.map((category, index) => (
                    <option key={index} value={category.name}>
                      {category.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Fuel">Fuel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Salary">Salary / Payout</option>
                    <option value="Office">Office Supplies</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Other">Other</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Date
              </label>
              <input
                type="date"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.transaction_date}
                onChange={(e) =>
                  setFormData({ ...formData, transaction_date: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 min-h-[80px]"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="e.g. Fuel for airport run..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isLoading || !formData.amount}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isLoading ? "Recording..." : "Record Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
