"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from "lucide-react";

export default function RepairOrphanedAssignmentsPage() {
  const [loading, setLoading] = useState(true);
  const [orphanedTrips, setOrphanedTrips] = useState([]);
  const [repairing, setRepairing] = useState(false);
  const [repairAction, setRepairAction] = useState("notify"); // "notify" or "unassign"
  const [repairResult, setRepairResult] = useState(null);

  useEffect(() => {
    loadOrphanedTrips();
  }, []);

  const loadOrphanedTrips = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/schedule-builder/repair-orphaned-assignments",
      );
      if (!response.ok) throw new Error("Failed to load orphaned trips");
      const data = await response.json();
      setOrphanedTrips(data.trips || []);
    } catch (error) {
      console.error("Error loading orphaned trips:", error);
      alert("Failed to load orphaned trips");
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async () => {
    if (
      !confirm(
        repairAction === "notify"
          ? `Send notifications for ${orphanedTrips.length} orphaned trips?\n\nThis will:\n- Send driver confirmation SMS/email\n- Send passenger confirmation\n- Set confirmation tokens\n\nNote: This will take ~${Math.ceil((orphanedTrips.length * 3) / 60)} minutes (3s delay between each).`
          : `Unassign drivers from ${orphanedTrips.length} orphaned trips?\n\nThis will:\n- Remove driver assignment\n- Clear vehicle assignment\n- Set status back to "pending"\n\nThis is a safer option if you want to re-assign manually.`,
      )
    ) {
      return;
    }

    setRepairing(true);
    setRepairResult(null);

    try {
      const response = await fetch(
        "/api/schedule-builder/repair-orphaned-assignments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: repairAction }),
        },
      );

      if (!response.ok) throw new Error("Repair request failed");

      const data = await response.json();
      setRepairResult(data);

      // Reload the list to show remaining orphaned trips
      await loadOrphanedTrips();
    } catch (error) {
      console.error("Error repairing orphaned trips:", error);
      alert("Failed to repair orphaned trips");
    } finally {
      setRepairing(false);
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-blue-600 border-r-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-500 text-sm">
            Loading orphaned assignments...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mb-4"
          >
            ← Back to Dashboard
          </a>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Repair Orphaned Driver Assignments
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            These trips have a driver assigned but no confirmation token —
            meaning they were assigned before notifications were sent. This can
            happen if the Schedule Builder 2.0 was used before the
            notification-first fix was deployed.
          </p>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {orphanedTrips.length} Orphaned Assignment
                {orphanedTrips.length !== 1 ? "s" : ""} Found
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Last 30 days · Excludes cancelled trips
              </p>
            </div>
            <button
              onClick={loadOrphanedTrips}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {orphanedTrips.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Repair Action
              </h3>
              <div className="flex items-start gap-4 mb-4">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="repairAction"
                    value="notify"
                    checked={repairAction === "notify"}
                    onChange={(e) => setRepairAction(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Send Notifications
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Send driver/passenger confirmations and set tokens. Use
                      this if you want to keep the assignments.
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="repairAction"
                    value="unassign"
                    checked={repairAction === "unassign"}
                    onChange={(e) => setRepairAction(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      Unassign Drivers
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Remove driver assignments and start over. Use this if you
                      want to re-assign manually.
                    </p>
                  </div>
                </label>
              </div>
              <button
                onClick={handleRepair}
                disabled={repairing}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {repairing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Repairing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Repair All ({orphanedTrips.length})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Repair Result */}
        {repairResult && (
          <div
            className={`rounded-lg border p-6 mb-6 ${
              repairResult.failed === 0
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {repairResult.failed === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3
                  className={`text-sm font-semibold ${
                    repairResult.failed === 0
                      ? "text-green-900"
                      : "text-amber-900"
                  }`}
                >
                  {repairResult.message}
                </h3>
                <p
                  className={`text-xs mt-1 ${
                    repairResult.failed === 0
                      ? "text-green-700"
                      : "text-amber-700"
                  }`}
                >
                  {repairResult.repaired} repaired · {repairResult.failed}{" "}
                  failed
                </p>
                {repairResult.results && repairResult.results.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                    {repairResult.results.map((r, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        {r.status === "repaired" ? (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-600" />
                        )}
                        <span
                          className={
                            r.status === "repaired"
                              ? "text-green-700"
                              : "text-red-700"
                          }
                        >
                          {r.booking_number}: {r.action || r.status}
                          {r.error && ` (${r.error})`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Trips Table */}
        {orphanedTrips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">All Clear!</h3>
            <p className="text-sm text-gray-500 mt-1">
              No orphaned driver assignments found in the last 30 days.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Booking #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Passenger
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date/Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orphanedTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {trip.booking_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {trip.passenger_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {trip.driver_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDateTime(trip.start_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            trip.status === "confirmed"
                              ? "bg-green-100 text-green-700"
                              : trip.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
