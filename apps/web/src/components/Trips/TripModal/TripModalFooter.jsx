import { useState } from "react";
import {
  Send,
  MessageSquare,
  Receipt,
  AlertCircle,
  X,
  Eye,
  CheckCircle,
  DollarSign,
  Heart,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmationStatusModal } from "@/components/ConfirmationStatusModal";
import { ConfirmationPreviewModal } from "@/components/ConfirmationPreviewModal";
import PaymentCorrectionModal from "./PaymentCorrectionModal";
import { InvoiceModal } from "@/components/Trips/InvoiceModal";

export function TripModalFooter({
  formData,
  setFormData,
  isEditing,
  isSaving,
  onCancel,
  onSave,
  onApproveAndSend,
  tripId,
  onMessagePassenger,
  trip,
}) {
  const [isResending, setIsResending] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState(null);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPaymentCorrectionModal, setShowPaymentCorrectionModal] =
    useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const handleResendConfirmation = async (channel = "all") => {
    if (!tripId) return;

    setIsResending(true);
    try {
      const res = await fetch(
        `/api/appointments/${tripId}/resend-confirmation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "all", channel }),
        },
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to resend confirmation");
      }

      const data = await res.json();

      // Show the status modal with the confirmation details
      setConfirmationStatus(data.status);
      setShowStatusModal(true);

      const channelLabel =
        channel === "email"
          ? "Email"
          : channel === "sms"
            ? "SMS"
            : "Email & SMS";
      toast.success(`${channelLabel} confirmations sent ✓`);
    } catch (error) {
      console.error("Failed to resend confirmation:", error);
      toast.error(error.message || "Failed to resend confirmation");
    } finally {
      setIsResending(false);
    }
  };

  const handlePrintReceipt = (e) => {
    // Check if trip is paid before allowing receipt — trust DB payment_status first
    const isPaid = formData.payment_status === "paid";

    if (!isPaid) {
      e.preventDefault();
      setShowUnpaidModal(true);
    }
    // If paid, let the link work normally (default behavior)
  };

  const handleSendDriverNotice = async () => {
    if (!tripId) return;
    setIsResending(true);
    try {
      const res = await fetch(
        `/api/appointments/${tripId}/resend-driver-notification`,
        { method: "POST" },
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to send driver notice");
      }
      toast.success("Driver notice sent ✓");
    } catch (error) {
      console.error("Failed to send driver notice:", error);
      toast.error(error.message || "Failed to send driver notice");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col gap-3">
        {/* Row 1: Booked By */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            Booked By:
          </label>
          <select
            className="bg-transparent border-none text-sm font-semibold text-blue-600 focus:ring-0"
            value={formData.booked_by}
            onChange={(e) =>
              setFormData({ ...formData, booked_by: e.target.value })
            }
          >
            <option value="Admin">Admin</option>
            <option value="Online">Online</option>
          </select>
          {formData.booked_by === "Admin" && (
            <input
              type="text"
              placeholder="Booker's name"
              className="w-48 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.booker_name}
              onChange={(e) =>
                setFormData({ ...formData, booker_name: e.target.value })
              }
            />
          )}
        </div>

        {/* Row 1.5: Last edited by (only when editing and last_modified_by exists) */}
        {isEditing && trip?.last_modified_by && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Last edited by:
            </label>
            <span className="text-sm text-gray-600">
              {trip.last_modified_by}
            </span>
          </div>
        )}

        {/* Row 2: Action Buttons (only when editing) */}
        {isEditing && (
          <div className="flex flex-col gap-2 pb-2 border-b border-gray-200">
            {/* Wedding trip banner */}
            {trip?.wedding_id && (
              <div className="flex items-start gap-2 px-3 py-2 bg-pink-50 border border-pink-200 rounded-lg">
                <Heart size={14} className="text-pink-600 mt-0.5 shrink-0" />
                <p className="text-xs text-pink-800 leading-snug">
                  <strong>Wedding trip</strong> — coordinator receives passenger
                  communications. Send driver confirmations below, or use the{" "}
                  <strong>Wedding record</strong> to notify everyone at once.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {onMessagePassenger && !trip?.wedding_id && (
                <button
                  onClick={onMessagePassenger}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Send a message to the passenger"
                >
                  <MessageSquare size={14} />
                  Message
                </button>
              )}
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors flex items-center gap-1.5"
                title="Preview the confirmation email and SMS"
              >
                <Eye size={14} />
                Preview
              </button>

              {/* Wedding trips: show driver-only notice button instead of passenger-inclusive send buttons */}
              {trip?.wedding_id ? (
                <button
                  onClick={handleSendDriverNotice}
                  disabled={isResending}
                  className="px-3 py-1.5 text-xs font-medium text-pink-700 bg-pink-50 border border-pink-200 hover:bg-pink-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  title="Send notice to the assigned driver only (coordinator handles passenger)"
                >
                  <Send size={14} />
                  {isResending ? "Sending..." : "Notify Driver"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleResendConfirmation("all")}
                    disabled={isResending}
                    className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    title="Resend confirmation email/SMS to passenger, driver, and dispatch"
                  >
                    <Send size={14} />
                    {isResending ? "Sending..." : "Resend All"}
                  </button>
                  <button
                    onClick={() => handleResendConfirmation("email")}
                    disabled={isResending}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    title="Resend confirmation email only to passenger, driver, and dispatch"
                  >
                    <Send size={14} />
                    {isResending ? "Sending..." : "Email Only"}
                  </button>
                  <button
                    onClick={() => handleResendConfirmation("sms")}
                    disabled={isResending}
                    className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    title="Resend confirmation SMS only to passenger and driver"
                  >
                    <Send size={14} />
                    {isResending ? "Sending..." : "SMS Only"}
                  </button>
                </>
              )}

              <button
                onClick={() => setShowPaymentCorrectionModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1.5"
                title="Generate a payment link for a correction amount"
              >
                <DollarSign size={14} />
                Payment Correction
              </button>

              {/* Send Invoice button */}
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1.5"
                title="Send an invoice to the passenger"
              >
                <FileText size={14} />
                Send Invoice
              </button>

              <a
                href={`/receipt/${tripId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handlePrintReceipt}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5"
                title="Print trip receipt"
              >
                <Receipt size={14} />
                Receipt
              </a>
            </div>
          </div>
        )}

        {/* Row 3: Cancel and Save/Update Buttons */}
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving || !formData.client_id || !formData.start_time}
            className="px-5 py-2.5 bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Without Sending"}
          </button>
          <button
            onClick={onApproveAndSend}
            disabled={isSaving || !formData.client_id || !formData.start_time}
            className={`px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2 ${
              formData.wedding_id
                ? "bg-pink-600 hover:bg-pink-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <CheckCircle size={16} />
            {isSaving
              ? "Saving..."
              : formData.wedding_id
                ? isEditing
                  ? "Update & Notify Driver"
                  : "Save & Notify Driver"
                : isEditing
                  ? "Update & Send Confirmations"
                  : "Approve & Send Confirmations"}
          </button>
        </div>
      </div>

      {/* Unpaid Trip Modal */}
      {showUnpaidModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 relative">
              <button
                onClick={() => setShowUnpaidModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <AlertCircle size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Receipt Not Available
                  </h3>
                  <p className="text-orange-100 text-sm">Trip is not paid</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6">
              <p className="text-gray-700 text-base leading-relaxed">
                Receipts can only be generated for trips that have been{" "}
                <strong>paid in full</strong>.
              </p>
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800">
                  <strong>Current Status:</strong>{" "}
                  <span className="uppercase font-semibold">
                    {formData.payment_status || "Unpaid"}
                  </span>
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  Please ensure payment is recorded before printing a receipt.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowUnpaidModal(false)}
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Status Modal */}
      <ConfirmationStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        status={confirmationStatus}
      />

      {/* Confirmation Preview Modal */}
      <ConfirmationPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        tripId={tripId}
      />

      {/* Payment Correction Modal */}
      {showPaymentCorrectionModal && (
        <PaymentCorrectionModal
          trip={trip}
          onClose={() => setShowPaymentCorrectionModal(false)}
        />
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && tripId && (
        <InvoiceModal
          tripId={tripId}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </>
  );
}
