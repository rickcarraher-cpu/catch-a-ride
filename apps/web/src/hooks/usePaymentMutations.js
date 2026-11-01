import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useMarkPaidMutation(tripId, trip) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Record a real payment transaction for the outstanding balance.
      // This keeps the books consistent: payment_status, payment_date,
      // payments_total and balance_due are all derived from transactions,
      // so writing them directly (the old approach) caused the
      // "Data Inconsistency Detected" warning (Date Paid with $0 payments).
      const balanceDue =
        Number(trip?.balance_due ?? trip?.original_amount) || 0;
      const txRes = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: tripId,
          category: "payment",
          method: "Manual Override",
          amount: balanceDue,
          tip_amount: 0,
          description: `Manual payment entry — Trip ${trip?.booking_number || tripId}`,
          transaction_date: new Date().toISOString().split("T")[0],
        }),
      });
      if (!txRes.ok) {
        const err = await txRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record manual payment");
      }
      return txRes.json();
    },
    onSuccess: () => {
      toast.success("Trip marked as paid");
      queryClient.invalidateQueries({
        queryKey: ["trip-transactions", tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to mark as paid");
    },
  });
}

export function useVerifySquareMutation(tripId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // First try the status endpoint — it checks Square's API directly and auto-applies
      const statusRes = await fetch(`/api/payments/square/status/${tripId}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.auto_applied || statusData.payment_status === "paid") {
          return {
            status: "paid",
            amount: statusData.amount || statusData.base_payment,
            message:
              statusData.message || "Payment verified and applied from Square",
          };
        }
      }

      // Fall back to verify-order endpoint for broader matching
      const res = await fetch("/api/payments/square/verify-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trip_id: tripId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.status === "paid") {
        toast.success(
          `Payment verified! $${data.amount?.toFixed(2) || ""} processed from Square`,
        );
      } else if (data.status === "already_paid") {
        toast.info("This payment was already processed");
      } else if (data.status === "not_found") {
        toast.warning(
          data.message ||
            'No matching Square payment found. Use "Mark as Paid" if you verified payment elsewhere.',
        );
      } else if (data.status === "error") {
        toast.error(data.message || "Could not check Square");
      } else {
        toast.warning(
          `Square order status: ${data.order_state || data.status}. Customer hasn't completed payment yet on the Square link.`,
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["trip-transactions", tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      toast.error(err.message || "Could not verify Square payment");
    },
  });
}

export function useReconcileMutation(tripId, trip) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun, selectedMatch }) => {
      if (!dryRun && selectedMatch) {
        // Record the payment as a transaction — payment_status, payment_date
        // and balance_due are all derived from transactions, so this is the
        // only safe way to apply a reconciled payment.
        const txRes = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointment_id: tripId,
            category: "payment",
            method: "Square",
            amount: selectedMatch.amount - (selectedMatch.tip || 0),
            tip_amount: selectedMatch.tip || 0,
            description: `Square payment ${selectedMatch.payment_id} (reconciled)`,
            transaction_date: new Date(selectedMatch.created_at)
              .toISOString()
              .split("T")[0],
          }),
        });

        if (!txRes.ok) {
          const err = await txRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to apply payment");
        }

        return { applied: true, selectedMatch };
      } else {
        const res = await fetch("/api/payments/square/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_number: trip?.booking_number,
            dry_run: true,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Reconciliation failed");
        }
        return res.json();
      }
    },
    onSuccess: (data, { dryRun }) => {
      if (!dryRun) {
        toast.success(
          `Payment of $${data.selectedMatch?.amount?.toFixed(2)} applied successfully!`,
        );
        queryClient.invalidateQueries({
          queryKey: ["trip-transactions", tripId],
        });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      }
    },
    onError: (err) => {
      toast.error(err.message || "Could not reconcile Square payment");
    },
  });
}

export function useReversePaymentMutation(tripId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/appointments/${tripId}/reverse-payment`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reverse payment");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Payment reversed — trip is now unpaid");
      queryClient.invalidateQueries({
        queryKey: ["trip-transactions", tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reverse payment");
    },
  });
}
