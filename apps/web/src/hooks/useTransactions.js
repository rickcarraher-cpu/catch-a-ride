import { useQuery } from "@tanstack/react-query";

export function useTransactions(tripId) {
  return useQuery({
    queryKey: ["trip-transactions", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?appointment_id=${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!tripId,
  });
}

export function computeTransactionTotals(transactions) {
  const totalIncome = (transactions || []).reduce((sum, t) => {
    if (t.category === "payment" || t.category === "tip") {
      return sum + Number(t.amount) + Number(t.tip_amount || 0);
    }
    return sum;
  }, 0);

  const totalExpenses = (transactions || []).reduce((sum, t) => {
    if (t.category === "expense") {
      return sum + Number(t.amount);
    }
    return sum;
  }, 0);

  const totalRefunds = (transactions || []).reduce((sum, t) => {
    if (t.category === "refund") {
      return sum + Number(t.amount);
    }
    return sum;
  }, 0);

  return { totalIncome, totalExpenses, totalRefunds };
}
