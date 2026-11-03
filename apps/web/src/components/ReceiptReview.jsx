import {Receipt} from "lucide-react";
export default function ReceiptReview({receiptData,onClose}){const receiptTrips=receiptData.trips;return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-amber-600" />
                <h2 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                  Receipts Needed Today
                </h2>
                {receiptTrips.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-amber-600 text-white text-[10px] font-bold rounded-full">
                    {receiptTrips.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {receiptData?.date && (
                  <span className="text-xs text-amber-600 font-medium">
                    {receiptData.date}
                  </span>
                )}
                <button
                  onClick={() => onClose()}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {receiptTrips.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Receipt size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium">No receipts needed today</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {receiptTrips.map((trip) => {
                    const tripTime = new Date(
                      trip.start_time,
                    ).toLocaleTimeString("en-US", {
                      timeZone: "America/Chicago",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });
                    return (
                      <div
                        key={trip.id}
                        className="px-5 py-3 flex items-start gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {trip.booking_number && (
                              <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                #{trip.booking_number}
                              </span>
                            )}
                            <div className="text-xs text-gray-500">
                              {trip.display_short_date ||
                                (trip.start_time
                                  ? new Date(
                                      trip.start_time,
                                    ).toLocaleDateString("en-US",{timeZone:"America/Chicago"})
                                  : "No date")}
                              {" • "}
                              {trip.display_time ||
                                (trip.start_time
                                  ? new Date(
                                      trip.start_time,
                                    ).toLocaleTimeString([], {
                                      timeZone:"America/Chicago",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "")}
                            </div>
                            {trip.employee_name && (
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded-full text-white"
                                style={{
                                  backgroundColor:
                                    trip.employee_color || "#6b7280",
                                }}
                              >
                                {trip.employee_name}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">
                            {trip.client_name || "Unknown Passenger"}
                          </p>
                          {trip.destination && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              → {trip.destination}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          {trip.original_amount > 0 && (
                            <p className="text-sm font-bold text-gray-900">
                              ${Number(trip.original_amount).toFixed(2)}
                            </p>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              trip.payment_status === "paid"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-orange-50 text-orange-700 border border-orange-200"
                            }`}
                          >
                            {trip.payment_status === "paid" ? "Paid" : "Unpaid"}
                          </span>
                          <a
                            href={`/preview/database?q=${encodeURIComponent(trip.booking_number||'')}#database-trips`}

                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline font-medium"
                          >
                            Find trip →
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0 flex justify-end">
              <button
                onClick={() => onClose()}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
);}
