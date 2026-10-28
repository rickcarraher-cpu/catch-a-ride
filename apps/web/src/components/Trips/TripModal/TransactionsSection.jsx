import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTransactions } from "@/hooks/useTransactions";
import {
  useMarkPaidMutation,
  useVerifySquareMutation,
  useReconcileMutation,
  useReversePaymentMutation,
} from "@/hooks/usePaymentMutations";
import { PaymentSummaryCard } from "./PaymentSummaryCard";
import { TransactionActions } from "./TransactionActions";
import { RefundForm } from "./RefundForm";
import { AddTransactionForm } from "./AddTransactionForm";
import { ReconcileModal } from "./ReconcileModal";
import { SplitPaymentBuilder } from "./SplitPaymentBuilder";
import { TransactionsList } from "./TransactionsList";
import { PriceAdjustmentForm } from "./PriceAdjustmentForm";

export function TransactionsSection({ tripId, tripPrice, trip }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileResults, setReconcileResults] = useState(null);
  const [autoCheckDone, setAutoCheckDone] = useState(false);

  const { data: transactionsRaw } = useTransactions(tripId);

  // Filter out commission expenses from the display (they're for internal accounting only)
  const transactions = transactionsRaw?.filter((t) => {
    if (
      t.category === "expense" &&
      t.description?.toLowerCase().includes("commission")
    ) {
      return false;
    }
    return true;
  });

  const isPaid =
    trip &&
    (trip.payment_status === "paid" ||
      trip.payment_status === "partial_refund");

  // Auto-check Square payment status when trip has a pending Square payment
  // This catches payments that webhooks missed
  useEffect(() => {
    if (!tripId || !trip || autoCheckDone) return;
    // Only check if payment is pending/unpaid and trip has Square payment info
    const shouldCheck =
      trip.payment_status !== "paid" &&
      (trip.square_checkout_id || trip.payment_status === "pending");
    if (!shouldCheck) return;

    const checkSquareStatus = async () => {
      try {
        const res = await fetch(`/api/payments/square/status/${tripId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.auto_applied || data.payment_status === "paid") {
            // Payment was found and applied! Refresh the data
            queryClient.invalidateQueries({
              queryKey: ["trip-transactions", tripId],
            });
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
          }
        }
      } catch (e) {
        console.error("[TransactionsSection] Auto-check error:", e);
      } finally {
        setAutoCheckDone(true);
      }
    };

    // Small delay to let the modal finish rendering
    const timer = setTimeout(checkSquareStatus, 500);
    return () => clearTimeout(timer);
  }, [
    tripId,
    trip?.payment_status,
    trip?.square_checkout_id,
    autoCheckDone,
    queryClient,
  ]);

  const markPaidMutation = useMarkPaidMutation(tripId, trip);
  const verifySquareMutation = useVerifySquareMutation(tripId);
  const reconcileMutation = useReconcileMutation(tripId, trip);
  const reversePaymentMutation = useReversePaymentMutation(tripId);

  const handleManualMarkPaid = () => {
    if (
      !confirm(
        `Mark this trip as paid?\n\nThis will set payment_status to 'paid' without creating a transaction record.\n\nOnly use this if you've verified payment was received outside the system (e.g., Square webhook failed but payment was confirmed).`,
      )
    ) {
      return;
    }
    markPaidMutation.mutate();
  };

  const handleReconcileClick = () => {
    reconcileMutation.mutate(
      { dryRun: true },
      {
        onSuccess: (data) => {
          setReconcileResults(data);
          setShowReconcileModal(true);
        },
        onError: () => {
          setShowReconcileModal(false);
          setReconcileResults(null);
        },
      },
    );
  };

  const handleApplyReconcile = (selectedMatch) => {
    if (!selectedMatch) {
      return;
    }
    reconcileMutation.mutate(
      { dryRun: false, selectedMatch },
      {
        onSuccess: () => {
          setShowReconcileModal(false);
          setReconcileResults(null);
        },
        onError: () => {
          setShowReconcileModal(false);
          setReconcileResults(null);
        },
      },
    );
  };

  const handleReversePayment = () => {
    reversePaymentMutation.mutate();
  };

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3">
      {showReconcileModal && reconcileResults && (
        <ReconcileModal
          results={reconcileResults}
          onApply={handleApplyReconcile}
          onCancel={() => {
            setShowReconcileModal(false);
            setReconcileResults(null);
          }}
          isApplying={reconcileMutation.isPending}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Transactions</h3>
          <p className="text-xs text-gray-500">Payment history and tips</p>
        </div>
        <TransactionActions
          isPaid={isPaid}
          onReconcile={handleReconcileClick}
          onVerifySquare={() => verifySquareMutation.mutate()}
          onMarkPaid={handleManualMarkPaid}
          onRefund={() => {
            setShowRefundForm(!showRefundForm);
            setShowAddForm(false);
            setShowSplitPayment(false);
          }}
          onReversePayment={handleReversePayment}
          onSplitPayment={() => {
            setShowSplitPayment(!showSplitPayment);
            setShowAddForm(false);
            setShowRefundForm(false);
          }}
          onAddTransaction={() => {
            setShowAddForm(!showAddForm);
            setShowRefundForm(false);
            setShowSplitPayment(false);
          }}
          isReconciling={reconcileMutation.isPending}
          isVerifying={verifySquareMutation.isPending}
          isMarkingPaid={markPaidMutation.isPending}
          isReversingPayment={reversePaymentMutation.isPending}
          hasBookingNumber={!!trip?.booking_number}
        />
      </div>

      <PaymentSummaryCard trip={trip} transactions={transactions} />

      <TransactionsList
        transactions={transactions}
        onDeleteTransaction={() => {
          queryClient.invalidateQueries({
            queryKey: ["trip-transactions", tripId],
          });
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }}
      />

      {showSplitPayment && (
        <SplitPaymentBuilder
          tripId={tripId}
          trip={trip}
          onClose={() => setShowSplitPayment(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["trip-transactions", tripId],
            });
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            setShowSplitPayment(false);
          }}
        />
      )}

      {showRefundForm && (
        <RefundForm
          tripId={tripId}
          trip={trip}
          onClose={() => setShowRefundForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["trip-transactions", tripId],
            });
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            setShowRefundForm(false);
          }}
        />
      )}

      {showAddForm && (
        <AddTransactionForm
          tripId={tripId}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: ["trip-transactions", tripId],
            });
            setShowAddForm(false);
          }}
        />
      )}
    </div>
  );
}
