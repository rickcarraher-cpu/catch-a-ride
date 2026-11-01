import { useState } from "react";
import { Bell, BellOff, FileText } from "lucide-react";

/**
 * SaveConfirmPrompt - Two-step flow for new trips:
 *   Step 1: "Is this a quote?" → Yes (save as quote, no notifications) / No (go to step 2)
 *   Step 2: "Send confirmations?" → Yes (notify) / No (don't notify)
 *
 * For editing existing trips, skips straight to step 2 (send confirmations?).
 */
export function SaveConfirmPrompt({ isEditing, onConfirm, onCancel }) {
  // For edits, skip the quote question — go straight to confirmation question
  const [step, setStep] = useState(isEditing ? "confirmations" : "quote");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = (value) => {
    if (isSubmitting) return; // Prevent double-clicks
    setIsSubmitting(true);
    onConfirm(value);
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel();
  };

  // Step 1: "Is this a quote?"
  if (step === "quote") {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-full mb-3">
              <FileText size={28} className="text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Is this a Quote?
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Quotes are saved without sending any notifications to the driver
              or passenger.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleConfirm("quote")}
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={18} />
              Yes — Save as Quote
            </button>
            <button
              onClick={() => setStep("confirmations")}
              disabled={isSubmitting}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              No — Continue
            </button>
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: "Send confirmations?"
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
            <Bell size={28} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? "Update Trip" : "Create Trip"}
          </h3>
          <p className="text-sm text-gray-600 mt-2">
            Send notifications to the <strong>driver</strong> (acceptance link)
            and <strong>passenger</strong> (confirmation)?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleConfirm(true)}
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Bell size={18} />
            Yes — Send Confirmations
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BellOff size={18} />
            No — Save & Go to All Trips
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
