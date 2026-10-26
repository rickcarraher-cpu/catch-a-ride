import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

export function WizardNavigation({
  step,
  totalSteps,
  onPrev,
  onNext,
  onSubmit,
  onCancel,
  canProceed,
  isSubmitting,
  currentStepInfo,
  submissionErrorMessage,
  validationErrors = [], // NEW: Array of validation error messages
  hideButtons = false, // NEW: Hide navigation buttons when step contains submit
}) {
  return (
    <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 mt-2">
      {/* Show validation errors when there are any missing fields */}
      {validationErrors.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Please complete the following:
            </p>
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
              {validationErrors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Cancel booking button */}
      <button
        onClick={onCancel}
        className="w-full py-3 border-2 border-red-200 text-red-600 font-semibold rounded-2xl hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
      >
        <X size={16} /> Cancel Booking Request
      </button>

      {/* Navigation buttons - hide when step contains its own submit button */}
      {!hideButtons && (
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={onPrev}
              className="px-5 py-4 border-2 border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 hover:border-gray-300 active:scale-95 transition-all flex items-center gap-2 text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={`flex-1 py-4 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 text-sm bg-gradient-to-r ${currentStepInfo?.gradient}`}
            >
              Continue <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 py-5 bg-gradient-to-r from-red-500 to-orange-500 text-white font-extrabold rounded-2xl hover:from-red-600 hover:to-orange-600 transition-all shadow-xl hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base uppercase tracking-wide ring-4 ring-orange-300 ring-offset-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={20} className="animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} /> Click to Submit - Required
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Persistent error shown after a failed submission */}
      {submissionErrorMessage && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Booking failed</p>
            <p className="text-xs text-red-600 mt-0.5">
              {submissionErrorMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
