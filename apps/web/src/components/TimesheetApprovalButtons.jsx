import { Check, X, ThumbsUp, AlertCircle } from "lucide-react";

export function TimesheetApprovalButtons({
  driver,
  onApprove,
  onReject,
  isApproving,
  isDriverMode = false,
}) {
  const approval = driver.approval;
  const driverId = driver.driver.id;

  // In driver mode, look at driver_status. In admin mode, look at admin_status.
  const relevantStatus = isDriverMode
    ? approval?.driver_status
    : approval?.admin_status;

  const respondedBy = isDriverMode ? null : approval?.admin_responded_by;

  const rejectionReason = isDriverMode
    ? approval?.driver_reason
    : approval?.admin_reason;

  if (relevantStatus === "approved") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-md">
          <Check size={16} />
          <span>{isDriverMode ? "Accepted" : "Approved"}</span>
        </div>
        {respondedBy && <span className="text-gray-500">by {respondedBy}</span>}
      </div>
    );
  }

  if (relevantStatus === "rejected") {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md">
            <X size={16} />
            <span>{isDriverMode ? "Disputed" : "Rejected"}</span>
          </div>
          {respondedBy && (
            <span className="text-gray-500">by {respondedBy}</span>
          )}
        </div>
        {rejectionReason && (
          <p className="text-xs text-gray-600 italic">
            Reason: {rejectionReason}
          </p>
        )}
      </div>
    );
  }

  // Show action buttons if not yet decided
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onApprove(driverId)}
        disabled={isApproving}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
      >
        {isDriverMode ? <ThumbsUp size={16} /> : <Check size={16} />}
        {isDriverMode ? "Accept" : "Approve"}
      </button>
      <button
        onClick={() => onReject(driverId)}
        disabled={isApproving}
        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md text-sm font-medium transition-colors"
      >
        {isDriverMode ? <AlertCircle size={16} /> : <X size={16} />}
        {isDriverMode ? "Dispute" : "Reject"}
      </button>
    </div>
  );
}
