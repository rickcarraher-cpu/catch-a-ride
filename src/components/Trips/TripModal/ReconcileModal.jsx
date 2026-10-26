import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function ReconcileModal({ results, onApply, onCancel, isApplying }) {
  const [selectedMatch, setSelectedMatch] = useState(null);

  const resultData = results?.results?.[0];
  const hasMatches =
    resultData?.status === "found_matches" && resultData?.matches?.length > 0;
  const noMatches = resultData?.status === "no_match";
  const alreadyPaid = resultData?.status === "already_paid";
  const error =
    resultData?.status === "error" || resultData?.status === "api_error";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900">
            Square Payment Reconciliation
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Results from searching Square's API
          </p>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {hasMatches && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-2xl">✓</div>
                <div>
                  <p className="text-sm font-bold text-green-900">
                    {resultData.matches.length} Matching Payment
                    {resultData.matches.length > 1 ? "s" : ""} Found!
                  </p>
                  <p className="text-xs text-green-700">
                    Expected amounts:{" "}
                    {resultData.expected_amounts?.join(" or ")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Select a payment to apply:
                </p>

                {resultData.matches.map((match, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedMatch(match)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      selectedMatch?.payment_id === match.payment_id
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-25"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-lg font-bold text-gray-900">
                          ${match.amount?.toFixed(2)}
                          {match.tip > 0 && (
                            <span className="text-sm text-green-600 ml-2">
                              (+ ${match.tip?.toFixed(2)} tip)
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {match.card_brand} •••• {match.card_last_4}
                        </div>
                      </div>
                      {selectedMatch?.payment_id === match.payment_id && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-semibold">
                          ✓ Selected
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        {new Date(match.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                      {match.receipt_url && (
                        <a
                          href={match.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          View Receipt →
                        </a>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 font-mono mt-2">
                      {match.payment_id}
                    </div>
                  </button>
                ))}
              </div>

              {selectedMatch && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-900 mb-1">
                    What will happen when you apply:
                  </p>
                  <ul className="text-xs text-blue-700 space-y-0.5 list-disc list-inside">
                    <li>Trip payment status will be set to "paid"</li>
                    <li>
                      Payment transaction of ${selectedMatch.amount?.toFixed(2)}{" "}
                      will be recorded
                    </li>
                    {selectedMatch.tip > 0 && (
                      <li>
                        Tip of ${selectedMatch.tip?.toFixed(2)} will be recorded
                      </li>
                    )}
                    <li>Driver commission will be calculated (if assigned)</li>
                    <li>Square payment ID will be linked to this trip</li>
                  </ul>
                </div>
              )}
            </>
          )}

          {noMatches && (
            <>
              <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-2xl">⚠️</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-900">
                    No Matching Payments Found
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Searched {resultData.checked_payments} completed payments in
                    Square
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Expected amounts:</span>
                  <span className="font-semibold text-gray-900">
                    {resultData.expected_amounts?.join(" or ")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Search date range:</span>
                  <span className="text-gray-800">
                    {new Date(
                      resultData.date_range?.start,
                    ).toLocaleDateString()}{" "}
                    –{" "}
                    {new Date(resultData.date_range?.end).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Payments checked:</span>
                  <span className="font-semibold text-gray-900">
                    {resultData.checked_payments}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Suggestions:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-1 space-y-0.5 list-disc list-inside">
                  <li>
                    Check if the payment was made to a different Square account
                  </li>
                  <li>Verify the trip amount matches what the customer paid</li>
                  <li>
                    Confirm the payment date falls within the search range
                  </li>
                  <li>Use "Verify Square" if a payment link was generated</li>
                  <li>
                    Use "Mark as Paid" if you've verified payment outside Square
                  </li>
                </ul>
              </div>
            </>
          )}

          {alreadyPaid && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-2xl">ℹ️</div>
              <div>
                <p className="text-sm font-bold text-blue-900">Already Paid</p>
                <p className="text-xs text-blue-700">
                  This trip is already marked as paid in the system
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-2xl">❌</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">Error</p>
                <p className="text-xs text-red-700 mt-1">
                  {resultData?.error ||
                    "An error occurred while searching Square"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onCancel}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {hasMatches ? "Cancel" : "Close"}
          </button>
          {hasMatches && selectedMatch && (
            <button
              onClick={() => onApply(selectedMatch)}
              disabled={isApplying}
              className="px-6 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>Apply Payment</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
