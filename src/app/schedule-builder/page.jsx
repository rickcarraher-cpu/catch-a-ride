"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Save,
  Car,
  CalendarX2,
  MessageSquare,
  Send,
  Phone,
} from "lucide-react";
import { toast } from "@/utils/notify";

// Helper: group trips by same start-time minute for overlap detection
function groupTripsByTime(trips) {
  const groups = new Map();
  trips.forEach((trip) => {
    let key;
    if (!trip.start_time) {
      key = `invalid-${trip.id}`;
    } else {
      const d = new Date(trip.start_time);
      key = isNaN(d.getTime())
        ? `invalid-${trip.id}`
        : d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trip);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, trips]) => ({ key, trips }));
}

// Overlap badge + popover: shown when 2+ trips share the same start-time minute
function OverlapGroupCard({ trips, formatTime, drivers = [], onAssignTrip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const timeStr = formatTime(trips[0].start_time);
  const names = trips.map((t) => t.client_name).join(", ");

  return (
    <div ref={ref} className="relative">
      {/* Badge trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-amber-50 border-2 border-amber-400 border-dashed rounded-lg p-2 text-left hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <div className="text-amber-800 font-bold text-xs">
              {trips.length} trips @ {timeStr}
            </div>
            <div className="text-amber-600 text-[10px] truncate mt-0.5">
              {names}
            </div>
          </div>
          <div className="bg-amber-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {trips.length}
          </div>
        </div>
        <div className="text-amber-500 text-[9px] mt-1 font-medium">
          Click to assign →
        </div>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Popover header */}
          <div className="bg-amber-50 border-b border-amber-100 px-3 py-2">
            <div className="text-xs font-bold text-amber-800">
              {trips.length} trips at {timeStr}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">
              Assign each trip to a driver
            </div>
          </div>

          {/* Trip rows */}
          <div className="p-2 space-y-2 max-h-80 overflow-y-auto">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-blue-50 border border-blue-200 rounded-lg p-2"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-900 truncate">
                      {trip.client_name}
                    </div>
                    {trip.destination && (
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                        → {trip.destination}
                      </div>
                    )}
                    {trip.booking_number && (
                      <div className="text-[10px] text-blue-600 font-mono mt-0.5">
                        #{trip.booking_number}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/booking/${trip.id}`, "_blank");
                    }}
                    className="text-[9px] text-blue-500 hover:text-blue-700 underline ml-2 flex-shrink-0 whitespace-nowrap"
                  >
                    View
                  </button>
                </div>

                {/* Driver selector */}
                {onAssignTrip && drivers.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) onAssignTrip(trip.id, parseInt(val));
                      e.target.value = "";
                    }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                  >
                    <option value="">Assign to driver…</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: get trip duration - DO NOT RECOMPUTE if already in trip record
function getTripDuration(trip) {
  // If trip already has duration data, use it directly (don't recompute)
  if (trip.duration_minutes && trip.duration_minutes > 0) {
    return trip.duration_minutes;
  }

  // Otherwise get duration from the FIRST main service only (don't sum all services)
  if (!trip.services || trip.services.length === 0) return 0;

  // Filter to main services (non-addons)
  const mainServices = trip.services.filter((s) => !s.is_addon);
  const source = mainServices.length > 0 ? mainServices : trip.services;

  // Use the FIRST service's duration only (don't sum - that would double/triple count)
  return source[0]?.duration_minutes || 0;
}

export default function ScheduleBuilder() {
  // Initialize targetDate to tomorrow
  const getTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const [targetDate, setTargetDate] = useState(getTomorrow());
  const [originalTrips, setOriginalTrips] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]);
  const [workingAssignments, setWorkingAssignments] = useState({});
  const [workingVehicleAssignments, setWorkingVehicleAssignments] = useState(
    {},
  );
  const [vehiclesByDriver, setVehiclesByDriver] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  // SMS progress modal state
  const [showSmsProgressModal, setShowSmsProgressModal] = useState(false);
  const [smsProgressTrips, setSmsProgressTrips] = useState([]);

  // Vehicle picker modal state: { tripId, driverId, vehicles: [...] }
  const [vehiclePickerState, setVehiclePickerState] = useState(null);

  // Quick message modal state: { trip, recipientType: 'driver' | 'passenger' }
  const [messageModal, setMessageModal] = useState(null);

  // Settings for language preferences
  const [appSettings, setAppSettings] = useState({});

  // Drag-and-drop state
  const [draggedTripId, setDraggedTripId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);

  // Load data when targetDate changes
  useEffect(() => {
    if (targetDate) {
      loadScheduleData(targetDate);
    }
  }, [targetDate]);

  // Fetch settings for language preferences
  useEffect(() => {
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => setAppSettings(data))
      .catch(() => {});
  }, []);

  // Sort drivers alphabetically by name, filtering out any "Unassigned" placeholder employee
  const sortedDrivers = useMemo(() => {
    return [...drivers]
      .filter((d) => d.name?.toLowerCase() !== "unassigned")
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drivers]);

  const loadScheduleData = async (date) => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split("T")[0];

      // Fetch schedule data and draft in parallel for faster loading
      const [response, draftResponse] = await Promise.all([
        fetch(`/api/schedule-builder/tomorrow?date=${dateStr}`),
        fetch(`/api/schedule-builder/draft?date=${dateStr}`).catch(() => null),
      ]);

      if (!response.ok) throw new Error("Failed to load schedule data");

      const data = await response.json();
      setOriginalTrips(data.trips || []);
      setDrivers(data.drivers || []);
      setBlockedTimes(data.blockedTimes || []);
      setVehiclesByDriver(data.vehiclesByDriver || {});

      // Initialize working assignments with current state
      const initial = {};
      const initialVehicles = {};
      (data.trips || []).forEach((trip) => {
        initial[trip.id] = trip.employee_id;
        initialVehicles[trip.id] = trip.vehicle_id || null;
      });

      // Process draft if available
      if (draftResponse && draftResponse.ok) {
        try {
          const draftData = await draftResponse.json();
          if (draftData.draft && Object.keys(draftData.draft).length > 0) {
            // Build a set of active driver IDs so we can skip stale draft entries
            const activeDriverIds = new Set(
              (data.drivers || []).map((d) => d.id),
            );

            // Only apply draft assignments that reference an active driver (or null/unassigned)
            for (const [tripIdStr, driverId] of Object.entries(
              draftData.draft,
            )) {
              const tripId = parseInt(tripIdStr);
              if (!driverId || activeDriverIds.has(driverId)) {
                initial[tripId] = driverId;
              }
              // else: draft references an inactive driver → keep the DB value instead
            }

            if (draftData.vehicleAssignments) {
              Object.assign(initialVehicles, draftData.vehicleAssignments);
            }
            setDraftSavedAt(draftData.savedAt);
          } else {
            setDraftSavedAt(null);
          }
        } catch (draftError) {
          console.warn("Could not parse draft:", draftError);
          setDraftSavedAt(null);
        }
      } else {
        setDraftSavedAt(null);
      }

      setWorkingAssignments(initial);
      setWorkingVehicleAssignments(initialVehicles);
    } catch (error) {
      console.error("Error loading schedule:", error);
      alert("Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  };

  // Save draft without assigning
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const dateStr = targetDate.toISOString().split("T")[0];
      const response = await fetch("/api/schedule-builder/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          assignments: workingAssignments,
          vehicleAssignments: workingVehicleAssignments,
        }),
      });

      if (!response.ok) throw new Error("Failed to save draft");

      setDraftSavedAt(new Date().toISOString());

      // Update originalTrips to reflect the saved draft state
      setOriginalTrips((prevTrips) =>
        prevTrips.map((trip) => ({
          ...trip,
          employee_id: workingAssignments[trip.id] ?? trip.employee_id,
          vehicle_id: workingVehicleAssignments[trip.id] ?? trip.vehicle_id,
        })),
      );

      alert("Draft saved! Your slot assignments are preserved.");
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  // ─── Clear draft + reload after save ────────────────────────────────────────
  const clearDraftAndReload = async () => {
    const dateStr = targetDate.toISOString().split("T")[0];
    await fetch(`/api/schedule-builder/draft?date=${dateStr}`, {
      method: "DELETE",
    }).catch((err) => console.warn("Could not delete draft:", err));
    await loadScheduleData(targetDate);
  };

  // Assign trip to driver (with vehicle auto-selection or picker)
  const assignTrip = (tripId, driverId) => {
    const driverVehicles = vehiclesByDriver[driverId] || [];

    // Always set the driver assignment
    setWorkingAssignments((prev) => ({ ...prev, [tripId]: driverId }));

    if (driverVehicles.length === 1) {
      // Auto-select the only vehicle
      setWorkingVehicleAssignments((prev) => ({
        ...prev,
        [tripId]: driverVehicles[0].id,
      }));
    } else if (driverVehicles.length > 1) {
      // Show vehicle picker modal
      setVehiclePickerState({ tripId, driverId, vehicles: driverVehicles });
    } else {
      // No vehicles — clear vehicle assignment
      setWorkingVehicleAssignments((prev) => ({ ...prev, [tripId]: null }));
    }
  };

  // Handle vehicle selection from picker
  const handleVehicleSelect = (tripId, vehicleId) => {
    setWorkingVehicleAssignments((prev) => ({ ...prev, [tripId]: vehicleId }));
    setVehiclePickerState(null);
  };

  // Unassign trip
  const unassignTrip = (tripId) => {
    setWorkingAssignments((prev) => ({ ...prev, [tripId]: null }));
    setWorkingVehicleAssignments((prev) => ({ ...prev, [tripId]: null }));
  };

  // Get trips by driver (using working assignments)
  const getTripsByDriver = (driverId) => {
    return originalTrips.filter(
      (trip) => workingAssignments[trip.id] === driverId,
    );
  };

  // Get unassigned trips
  const unassignedTrips = useMemo(() => {
    return originalTrips.filter((trip) => !workingAssignments[trip.id]);
  }, [originalTrips, workingAssignments]);

  // Detect conflicts for a driver
  const getConflicts = (driverId) => {
    const trips = getTripsByDriver(driverId);
    const conflicts = [];

    for (let i = 0; i < trips.length; i++) {
      for (let j = i + 1; j < trips.length; j++) {
        const trip1Start = new Date(trips[i].start_time);
        const trip1End = new Date(
          trip1Start.getTime() + getTripDuration(trips[i]) * 60000,
        );
        const trip2Start = new Date(trips[j].start_time);
        const trip2End = new Date(
          trip2Start.getTime() + getTripDuration(trips[j]) * 60000,
        );

        if (trip1Start < trip2End && trip2Start < trip1End) {
          conflicts.push({ trip1: trips[i], trip2: trips[j] });
        }
      }
    }

    return conflicts;
  };

  // Helper to get vehicle name by id
  const getVehicleName = (vehicleId) => {
    if (!vehicleId) return null;
    for (const driverVehicles of Object.values(vehiclesByDriver)) {
      const found = driverVehicles.find((v) => v.id === vehicleId);
      if (found) return found.name;
    }
    return null;
  };

  // Check if there are any changes (driver OR vehicle)
  const hasChanges = useMemo(() => {
    return originalTrips.some(
      (trip) =>
        trip.employee_id !== workingAssignments[trip.id] ||
        (trip.vehicle_id || null) !==
          (workingVehicleAssignments[trip.id] || null),
    );
  }, [originalTrips, workingAssignments, workingVehicleAssignments]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Get summary of changes
  const changesSummary = useMemo(() => {
    const changes = [];
    originalTrips.forEach((trip) => {
      const oldDriver = trip.employee_id;
      const newDriver = workingAssignments[trip.id];
      const oldVehicle = trip.vehicle_id || null;
      const newVehicle = workingVehicleAssignments[trip.id] || null;

      if (oldDriver !== newDriver || oldVehicle !== newVehicle) {
        const oldDriverName =
          sortedDrivers.find((d) => d.id === oldDriver)?.name || "Unassigned";
        const newDriverName =
          sortedDrivers.find((d) => d.id === newDriver)?.name || "Unassigned";
        const oldVehicleName =
          getVehicleName(oldVehicle) || trip.vehicle_name || null;
        const newVehicleName = getVehicleName(newVehicle) || null;
        changes.push({
          trip,
          from: oldDriverName,
          to: newDriverName,
          oldVehicleName,
          newVehicleName,
          vehicleChanged: oldVehicle !== newVehicle,
        });
      }
    });
    return changes;
  }, [
    originalTrips,
    workingAssignments,
    workingVehicleAssignments,
    sortedDrivers,
    vehiclesByDriver,
  ]);

  // Save all assignments
  const handleSaveAssignments = async () => {
    if (!hasChanges) {
      alert("No changes to save");
      return;
    }
    setShowConfirmModal(true);
  };

  // Save all assignments — Use SAFE MODE where backend sends notifications FIRST,
  // then updates DB. This prevents orphaned assignments.
  const confirmSave = async () => {
    setSaving(true);
    setShowConfirmModal(false);

    try {
      const assignments = Object.entries(workingAssignments).map(
        ([appointmentId, employeeId]) => ({
          appointmentId: parseInt(appointmentId),
          employeeId,
          vehicleId: workingVehicleAssignments[parseInt(appointmentId)] || null,
        }),
      );

      // NEW SAFE MODE: Backend handles notification → DB update sequence
      // If notification fails, DB is NOT updated (no orphaned assignments!)
      const response = await fetch("/api/schedule-builder/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments,
          skipNotifications: false, // SAFE MODE ENABLED
        }),
      });

      if (!response.ok) throw new Error("Failed to save assignments");

      const result = await response.json();

      setSaving(false);

      // Show result message
      const successMsg =
        result.notificationsFailed > 0
          ? `⚠️  ${result.notificationsSent} trips assigned successfully.\n❌ ${result.notificationsFailed} notifications failed - those assignments were rolled back.`
          : `✅ Successfully assigned ${result.updated} trip(s)!\n📬 All notifications sent.`;

      alert(successMsg);

      // Clear draft and reload
      await clearDraftAndReload();
    } catch (error) {
      console.error("Error saving assignments:", error);
      alert("Failed to save assignments: " + error.message);
      setSaving(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Drag handlers
  const handleDragStart = (e, tripId) => {
    setDraggedTripId(tripId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e, zone) => {
    e.preventDefault();
    setDragOverZone(zone);
  };

  const handleDragLeave = (e) => {
    // Don't clear dragOverZone on internal drag movements
    // Only clear when mouse actually leaves to a non-droppable area
    e.preventDefault();
    // The dragOverZone will be updated by the next dragEnter event
    // So we don't need to clear it here - this prevents flickering
  };

  const handleDrop = (e, driverId) => {
    e.preventDefault();
    e.stopPropagation(); // prevent bubbling to outer container
    if (draggedTripId) {
      assignTrip(draggedTripId, driverId);
    }
    setDraggedTripId(null);
    setDragOverZone(null);
  };

  const handleDropUnassigned = (e) => {
    e.preventDefault();
    e.stopPropagation(); // prevent bubbling to outer container
    if (draggedTripId) {
      unassignTrip(draggedTripId);
    }
    setDraggedTripId(null);
    setDragOverZone(null);
  };

  // Detect which trip IDs would conflict if the dragged trip is dropped on the hovered driver
  const flashingConflictIds = useMemo(() => {
    if (
      !draggedTripId ||
      !dragOverZone ||
      !dragOverZone.startsWith("driver-")
    ) {
      return new Set();
    }
    const driverId = parseInt(dragOverZone.replace("driver-", ""));
    const draggedTrip = originalTrips.find((t) => t.id === draggedTripId);
    if (!draggedTrip) return new Set();

    const driverTrips = getTripsByDriver(driverId);
    const conflictingIds = new Set();

    const draggedStart = new Date(draggedTrip.start_time);
    const draggedEnd = new Date(
      draggedStart.getTime() + getTripDuration(draggedTrip) * 60000,
    );

    for (const trip of driverTrips) {
      if (trip.id === draggedTripId) continue;
      const tripStart = new Date(trip.start_time);
      const tripEnd = new Date(
        tripStart.getTime() + getTripDuration(trip) * 60000,
      );
      if (draggedStart < tripEnd && tripStart < draggedEnd) {
        conflictingIds.add(trip.id);
      }
    }

    if (conflictingIds.size > 0) {
      conflictingIds.add(draggedTripId);
    }

    return conflictingIds;
  }, [draggedTripId, dragOverZone, originalTrips, workingAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div
            className="rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"
            style={{ animation: "spin 1s linear infinite" }}
          ></div>
          <p className="text-gray-600">Loading schedule builder...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 z-10 shadow-sm flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </a>
              <div className="w-px h-6 bg-gray-300" />
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1.5 rounded-xl shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-gray-900">
                  Scheduling for
                </h1>
                <input
                  type="date"
                  value={
                    targetDate ? targetDate.toISOString().split("T")[0] : ""
                  }
                  onChange={(e) => {
                    const newDate = new Date(e.target.value + "T00:00:00");
                    setTargetDate(newDate);
                  }}
                  className="px-2 py-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {draftSavedAt && (
                <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-[11px]">
                  <Save className="w-3 h-3" />
                  <span className="font-medium">
                    Draft saved {new Date(draftSavedAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {hasChanges && (
                <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-2 py-1 rounded-lg text-[11px]">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-medium">
                    {changesSummary.length} unsaved
                  </span>
                </div>
              )}
              <button
                onClick={handleSaveDraft}
                disabled={savingDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-[11px] shadow transition-all bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3 h-3" />
                {savingDraft ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={handleSaveAssignments}
                disabled={!hasChanges || saving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-[11px] shadow transition-all ${
                  hasChanges && !saving
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                {saving ? "Assigning & Sending SMS..." : "Assign All"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content — outer container acts as fallback "unassign" drop zone */}
      <div
        className="flex-1 overflow-hidden flex gap-3 p-3"
        onDragOver={handleDragOver}
        onDrop={(e) => {
          // fallback: dropping outside any driver column unassigns the trip
          e.preventDefault();
          if (draggedTripId) {
            unassignTrip(draggedTripId);
          }
          setDraggedTripId(null);
          setDragOverZone(null);
        }}
      >
        {/* Unassigned Trips Panel - now sticky */}
        <div className="w-56 flex-shrink-0 flex flex-col sticky top-0 h-full">
          <div
            className={`bg-white rounded-xl shadow-lg border-2 border-dashed flex flex-col h-full transition-all ${
              dragOverZone === "unassigned"
                ? "border-blue-500 shadow-2xl"
                : "border-gray-300"
            }`}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, "unassigned")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropUnassigned}
          >
            <div
              className={`${unassignedTrips.length > 0 ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-gray-700 to-gray-900"} text-white p-2.5 rounded-t-xl flex-shrink-0`}
            >
              <h2 className="font-bold text-xs flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Unassigned
                <span
                  className={`ml-auto ${unassignedTrips.length > 0 ? "bg-white text-amber-700" : "bg-white text-gray-900"} px-2 py-0.5 rounded-full text-xs font-bold`}
                >
                  {unassignedTrips.length}
                </span>
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {unassignedTrips.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CheckCircle className="w-7 h-7 mx-auto mb-2 opacity-50" />
                  <p className="font-medium text-xs">All assigned!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupTripsByTime(unassignedTrips).map(
                    ({ key, trips: timeGroup }) => {
                      if (timeGroup.length > 1) {
                        return (
                          <OverlapGroupCard
                            key={key}
                            trips={timeGroup}
                            formatTime={formatTime}
                            drivers={sortedDrivers}
                            onAssignTrip={assignTrip}
                          />
                        );
                      }
                      const trip = timeGroup[0];
                      return (
                        <TripCard
                          key={trip.id}
                          trip={trip}
                          formatTime={formatTime}
                          onDragStart={(e) => handleDragStart(e, trip.id)}
                          isDragging={draggedTripId === trip.id}
                          isConflicting={flashingConflictIds.has(trip.id)}
                          onMessage={(t, type) =>
                            setMessageModal({ trip: t, recipientType: type })
                          }
                        />
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Driver Columns — add onDragOver so drag stays alive between columns */}
        <div
          className="flex-1 overflow-x-auto overflow-y-hidden"
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, "transit")}
        >
          <div
            className="flex gap-3 h-full"
            style={{ minWidth: "max-content" }}
            onDragOver={handleDragOver}
          >
            {sortedDrivers.map((driver) => (
              <div
                key={driver.id}
                className="flex flex-col"
                style={{ width: 125, minWidth: 125 }}
              >
                <DriverColumn
                  driver={driver}
                  trips={getTripsByDriver(driver.id)}
                  conflicts={getConflicts(driver.id)}
                  unassignedTrips={unassignedTrips}
                  onAssignTrip={assignTrip}
                  onUnassignTrip={unassignTrip}
                  formatTime={formatTime}
                  dragOverZone={dragOverZone}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  draggedTripId={draggedTripId}
                  flashingConflictIds={flashingConflictIds}
                  vehiclesByDriver={vehiclesByDriver}
                  workingVehicleAssignments={workingVehicleAssignments}
                  onVehicleChange={(tripId, vehicleId) =>
                    setWorkingVehicleAssignments((prev) => ({
                      ...prev,
                      [tripId]: vehicleId,
                    }))
                  }
                  blockedTimes={blockedTimes.filter(
                    (bt) => Number(bt.employee_id) === Number(driver.id),
                  )}
                  isDriverBlockedForTrip={null}
                  onMessage={(t, type) =>
                    setMessageModal({ trip: t, recipientType: type })
                  }
                  drivers={sortedDrivers}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <ConfirmationModal
          changes={changesSummary}
          onConfirm={confirmSave}
          onCancel={() => setShowConfirmModal(false)}
          saving={saving}
        />
      )}

      {/* Vehicle Picker Modal */}
      {vehiclePickerState && (
        <VehiclePickerModal
          tripId={vehiclePickerState.tripId}
          driverName={
            sortedDrivers.find((d) => d.id === vehiclePickerState.driverId)
              ?.name || "Driver"
          }
          vehicles={vehiclePickerState.vehicles}
          onSelect={handleVehicleSelect}
          onCancel={() => {
            // If cancelled, keep driver but set no vehicle
            setWorkingVehicleAssignments((prev) => ({
              ...prev,
              [vehiclePickerState.tripId]: null,
            }));
            setVehiclePickerState(null);
          }}
        />
      )}

      {/* Quick Message Modal */}
      {messageModal && (
        <QuickMessageModal
          trip={messageModal.trip}
          recipientType={messageModal.recipientType}
          drivers={drivers}
          workingAssignments={workingAssignments}
          settings={appSettings}
          onClose={() => setMessageModal(null)}
        />
      )}

      <style>{`
        @keyframes flash-yellow {
          0%, 100% {
            outline: 2px solid transparent;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          50% {
            outline: 2px solid #eab308;
            box-shadow: 0 0 0 4px rgba(234,179,8,0.35), 0 0 12px rgba(234,179,8,0.4);
          }
        }
        .conflict-flash {
          animation: flash-yellow 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function TripCard({
  trip,
  formatTime,
  isSmall = false,
  onDragStart,
  isDragging = false,
  isConflicting = false,
  vehicleName = null,
  driverVehicles = [],
  selectedVehicleId = null,
  onVehicleChange = null,
  onMessage = null,
  driverName = null,
}) {
  const serviceName = trip.services?.[0]?.service_name || "Trip";
  const duration = getTripDuration(trip);
  const isReturnTrip =
    trip.notes && trip.notes.toLowerCase().includes("return trip");
  const isDestinationTrip = !isReturnTrip && !!trip.destination;

  const handleClick = (e) => {
    if (e.defaultPrevented) return;
    window.open(`/booking/${trip.id}`, "_blank");
  };

  const showVehicleSelector = driverVehicles.length > 1 && onVehicleChange;

  // Check if start_time is invalid/unparseable
  const hasInvalidTime =
    !trip.start_time || isNaN(new Date(trip.start_time).getTime());

  return (
    <div
      className={`bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 rounded-lg p-2.5 shadow-sm relative ${
        isConflicting
          ? "conflict-flash cursor-pointer"
          : isDragging
            ? "opacity-40 scale-95 transition-all"
            : "hover:shadow-md cursor-pointer transition-all hover:ring-2 hover:ring-blue-300"
      }`}
      draggable
      onDragStart={onDragStart}
      onClick={handleClick}
      title="Click to view trip details (opens in new tab)"
    >
      {/* Warning badge for invalid time */}
      {hasInvalidTime && (
        <div
          className="absolute -top-1 -right-1 z-20 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
          title="Invalid trip time - click to edit"
        >
          !
        </div>
      )}

      {/* Time and Duration */}
      <div className="flex items-start justify-between mb-2">
        <div className="font-bold text-gray-900 text-sm">
          {formatTime(trip.start_time)}
        </div>
        <div className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-medium">
          {duration}m
        </div>
      </div>

      {/* Passenger Name */}
      <div className="text-gray-900 font-bold text-xs mb-1.5">
        {trip.client_name}
      </div>

      {/* Referred By - Show if available */}
      {trip.referral_source && (
        <div className="mb-1.5">
          <span className="text-[10px] font-medium bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200 flex items-center gap-0.5 w-fit">
            📍 Referred: {trip.referral_source}
          </span>
        </div>
      )}

      {/* Preferred Vehicle Category */}
      {trip.vehicle_category && (
        <div className="mb-1.5">
          <span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-0.5 w-fit">
            ⭐ Preferred: {trip.vehicle_category}
          </span>
        </div>
      )}

      {/* Type of Vehicle */}
      {showVehicleSelector ? (
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={selectedVehicleId || ""}
            onChange={(e) => {
              e.stopPropagation();
              onVehicleChange(trip.id, parseInt(e.target.value) || null);
            }}
            className="w-full text-[10px] bg-teal-50 text-teal-800 border border-teal-200 rounded px-1 py-0.5 font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer"
          >
            <option value="">🚗 Select vehicle...</option>
            {driverVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                🚗 {v.name}
              </option>
            ))}
          </select>
        </div>
      ) : vehicleName ? (
        <div className="mb-2">
          <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-0.5 w-fit">
            🚗 {vehicleName}
          </span>
        </div>
      ) : (
        <div className="mb-2">
          <span className="text-[10px] font-medium text-gray-400 italic">
            No vehicle assigned
          </span>
        </div>
      )}

      {/* Destination */}
      {trip.destination && (
        <div className="text-gray-700 text-[11px] mb-2 font-medium">
          → {trip.destination}
        </div>
      )}

      {/* # Passengers / Luggage - More prominent */}
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {trip.num_people > 0 && (
          <div className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
            👤 {trip.num_people}
          </div>
        )}
        {(trip.num_bags_checked || 0) + (trip.num_bags_carry_on || 0) > 0 && (
          <div className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[11px]">
            🧳 {(trip.num_bags_checked || 0) + (trip.num_bags_carry_on || 0)}
          </div>
        )}
        {trip.num_car_seats > 0 && (
          <div className="bg-pink-100 text-pink-800 px-2 py-0.5 rounded font-bold text-[11px]">
            🚼 {trip.num_car_seats}
          </div>
        )}
        {trip.num_golf_bags > 0 && (
          <div className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold text-[11px]">
            ⛳ {trip.num_golf_bags}
          </div>
        )}
      </div>

      {/* Trip Type Badges */}
      {isReturnTrip ? (
        <div className="mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full border border-purple-200">
            Return Trip
          </span>
        </div>
      ) : isDestinationTrip ? (
        <div className="mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-200">
            Destination Trip
          </span>
        </div>
      ) : null}

      {/* Quick Message Buttons */}
      {onMessage && (
        <div className="mt-2 flex gap-1" onClick={(e) => e.stopPropagation()}>
          {trip.client_phone && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMessage(trip, "passenger");
              }}
              className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-[9px] font-semibold transition-colors border border-green-200"
              title={`Message ${trip.client_name}`}
            >
              <MessageSquare className="w-2.5 h-2.5" />
              Pax
            </button>
          )}
          {driverName && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMessage(trip, "driver");
              }}
              className="flex-1 flex items-center justify-center gap-1 px-1.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-[9px] font-semibold transition-colors border border-purple-200"
              title={`Message ${driverName}`}
            >
              <MessageSquare className="w-2.5 h-2.5" />
              Driver
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DriverColumn({
  driver,
  trips,
  conflicts,
  unassignedTrips,
  onAssignTrip,
  onUnassignTrip,
  formatTime,
  dragOverZone,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  draggedTripId,
  flashingConflictIds,
  vehiclesByDriver = {},
  workingVehicleAssignments = {},
  onVehicleChange = null,
  blockedTimes = [],
  isDriverBlockedForTrip = null,
  onMessage = null,
  drivers = [],
}) {
  const handleUnassign = (tripId) => {
    onUnassignTrip(tripId);
  };

  const sortedTrips = [...trips].sort(
    (a, b) => new Date(a.start_time) - new Date(b.start_time),
  );

  // Group trips by start-time minute to detect same-time overlaps
  const groupedTrips = useMemo(
    () => groupTripsByTime(sortedTrips),
    [sortedTrips],
  );

  const isDropZone = dragOverZone === `driver-${driver.id}`;
  const driverVehicles = vehiclesByDriver[driver.id] || [];

  // Helper to get the vehicle name for a specific trip
  const getVehicleNameForTrip = (tripId) => {
    const vehicleId = workingVehicleAssignments[tripId];
    if (!vehicleId) return null;
    const found = driverVehicles.find((v) => v.id === vehicleId);
    return found ? found.name : null;
  };

  // Format blocked time display
  const formatBlockedTime = (block) => {
    const start = new Date(block.start_time);
    const end = new Date(block.end_time);
    const isAllDay =
      start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      end.getHours() === 23 &&
      end.getMinutes() === 59;

    if (isAllDay) return "All Day";
    return `${formatTime(block.start_time)} - ${formatTime(block.end_time)}`;
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-lg border-2 transition-all relative flex flex-col h-full ${
        isDropZone
          ? "border-green-500 border-solid shadow-2xl"
          : "border-gray-200"
      }`}
      onDragOver={onDragOver}
      onDragEnter={(e) => onDragEnter(e, `driver-${driver.id}`)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, driver.id)}
    >
      {/* Driver header */}
      <div
        className="p-2.5 rounded-t-xl text-white font-bold text-center flex-shrink-0"
        style={{ backgroundColor: driver.color || "#6366f1" }}
      >
        <div className="text-sm truncate">{driver.name}</div>
        <div className="text-[11px] opacity-90 mt-0.5">
          {sortedTrips.length} {sortedTrips.length === 1 ? "trip" : "trips"}
        </div>
        {driverVehicles.length > 0 && (
          <div className="text-[10px] opacity-80 mt-0.5 truncate flex items-center justify-center gap-0.5">
            <Car className="w-2.5 h-2.5" />
            {driverVehicles.length === 1
              ? driverVehicles[0].name
              : `${driverVehicles.length} vehicles`}
          </div>
        )}
      </div>

      {/* Blocked times indicator */}
      {blockedTimes.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-2 mx-2 mt-2 rounded flex-shrink-0">
          <div className="flex items-center gap-1.5 text-red-800 text-xs font-semibold mb-1">
            <CalendarX2 className="w-3.5 h-3.5" />
            {blockedTimes.length} blocked time
            {blockedTimes.length !== 1 ? "s" : ""}
          </div>
          {blockedTimes.map((block) => (
            <div key={block.id} className="text-[10px] text-red-700 mt-0.5">
              • {formatBlockedTime(block)}
              {block.reason && ` (${block.reason})`}
            </div>
          ))}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-2 mx-2 mt-2 rounded flex-shrink-0">
          <div className="flex items-center gap-1.5 text-red-800 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Trip list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {sortedTrips.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <Users className="w-7 h-7 mx-auto mb-2 opacity-50" />
            <p className="text-xs font-medium">No trips</p>
            <p className="text-[11px] mt-0.5">Drag here to assign</p>
          </div>
        )}
        {groupedTrips.map(({ key, trips: timeGroup }) => {
          // Multiple trips at the same time → show overlap badge + popover
          if (timeGroup.length > 1) {
            return (
              <OverlapGroupCard
                key={key}
                trips={timeGroup}
                formatTime={formatTime}
                drivers={drivers}
                onAssignTrip={onAssignTrip}
              />
            );
          }

          // Single trip → normal TripCard
          const trip = timeGroup[0];
          const isBlocked =
            isDriverBlockedForTrip && isDriverBlockedForTrip(driver.id, trip);

          return (
            <div key={trip.id} className="relative group">
              {isBlocked && (
                <div
                  className="absolute -top-1 -left-1 z-20 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold"
                  title="Driver has blocked time during this trip"
                >
                  !
                </div>
              )}
              <TripCard
                trip={trip}
                formatTime={formatTime}
                isSmall
                onDragStart={(e) => onDragStart(e, trip.id)}
                isDragging={draggedTripId === trip.id}
                isConflicting={flashingConflictIds.has(trip.id)}
                vehicleName={getVehicleNameForTrip(trip.id)}
                driverVehicles={driverVehicles}
                selectedVehicleId={workingVehicleAssignments[trip.id] || null}
                onVehicleChange={
                  driverVehicles.length > 1 ? onVehicleChange : null
                }
                onMessage={onMessage}
                driverName={driver.name}
              />
              <button
                onClick={() => handleUnassign(trip.id)}
                className="absolute top-0.5 right-0.5 bg-red-500 text-white w-3.5 h-3.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-[9px] flex items-center justify-center hover:bg-red-600 z-10"
                title="Unassign"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VehiclePickerModal({
  tripId,
  driverName,
  vehicles,
  onSelect,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white p-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Car className="w-5 h-5" />
            Select Vehicle
          </h2>
          <p className="mt-1 text-teal-100 text-sm">
            {driverName} has multiple vehicles. Which one for this trip?
          </p>
        </div>

        <div className="p-4 space-y-2">
          {vehicles.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => onSelect(tripId, vehicle.id)}
              className="w-full text-left bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-300 rounded-lg p-3 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-gray-400 group-hover:text-teal-600" />
                <div>
                  <div className="font-semibold text-sm text-gray-900">
                    {vehicle.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {[vehicle.year, vehicle.color, vehicle.plate]
                      .filter(Boolean)
                      .join(" · ")}
                    {vehicle.passenger_capacity
                      ? ` · ${vehicle.passenger_capacity} pax`
                      : ""}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="w-full px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-all"
          >
            Skip (no vehicle)
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ changes, onConfirm, onCancel, saving }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-5">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Confirm Driver Assignments
          </h2>
          <p className="mt-1.5 text-green-100 text-sm">
            You're about to assign {changes.length}{" "}
            {changes.length === 1 ? "trip" : "trips"}
          </p>
        </div>

        <div className="p-5 max-h-[400px] overflow-y-auto">
          <div className="space-y-2.5">
            {changes.map((change, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-3 border border-gray-200"
              >
                <div className="font-semibold text-gray-900 text-sm mb-1.5">
                  {change.trip.client_name}
                  <span className="ml-2 text-xs text-gray-600">
                    (
                    {new Date(change.trip.start_time).toLocaleTimeString(
                      "en-US",
                      { hour: "numeric", minute: "2-digit" },
                    )}
                    )
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {change.from}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {change.to}
                  </span>
                </div>
                {change.newVehicleName && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-teal-700">
                    <Car className="w-3 h-3" />
                    <span className="font-medium">{change.newVehicleName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 p-5 flex items-center justify-end gap-2.5 border-t border-gray-200">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-5 py-1.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-5 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? "Assigning..." : "Confirm & Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SmsProgressModal({ trips, onDone }) {
  const total = trips.length;
  const done = trips.filter(
    (t) => t.status === "sent" || t.status === "failed",
  ).length;
  const allDone = done === total;
  const failCount = trips.filter((t) => t.status === "failed").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white p-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Send className="w-5 h-5" />
            {allDone ? "All Done!" : "Sending Confirmations…"}
          </h2>
          <p className="text-indigo-100 text-sm mt-0.5">
            {allDone
              ? `${total - failCount} sent${failCount > 0 ? `, ${failCount} failed` : ""}`
              : `${done} of ${total} sent`}
          </p>
          {/* Progress bar */}
          <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Trip list */}
        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          {trips.map((trip) => {
            const isPending = trip.status === "pending";
            const isSending = trip.status === "sending";
            const isSent = trip.status === "sent";
            const isFailed = trip.status === "failed";

            return (
              <div
                key={trip.appointmentId}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isSending
                    ? "border-blue-200 bg-blue-50"
                    : isSent
                      ? "border-green-200 bg-green-50"
                      : isFailed
                        ? "border-red-200 bg-red-50"
                        : "border-gray-100 bg-gray-50"
                }`}
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">
                  {isSending && (
                    <div
                      className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"
                      style={{ animation: "spin 0.8s linear infinite" }}
                    />
                  )}
                  {isSent && <CheckCircle className="w-5 h-5 text-green-500" />}
                  {isFailed && (
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  )}
                  {isPending && (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                {/* Trip info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {trip.clientName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {trip.time}
                    {trip.driverName ? ` · ${trip.driverName}` : ""}
                  </p>
                </div>

                {/* Status label */}
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isSending
                      ? "bg-blue-100 text-blue-700"
                      : isSent
                        ? "bg-green-100 text-green-700"
                        : isFailed
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isSending
                    ? "Sending…"
                    : isSent
                      ? "✓ Sent"
                      : isFailed
                        ? "Failed"
                        : "Pending"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {allDone && (
          <div className="p-5 border-t border-gray-100 bg-gray-50">
            {failCount === 0 ? (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-green-800">All Sent!</p>
                  <p className="text-xs text-green-600">
                    {total} confirmation{total !== 1 ? "s" : ""} delivered
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-yellow-800">
                    {total - failCount} sent, {failCount} failed
                  </p>
                  <p className="text-xs text-yellow-600">
                    Check communication logs for details
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={onDone}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-500 text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickMessageModal({
  trip,
  recipientType,
  drivers,
  workingAssignments,
  settings,
  onClose,
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isDriver = recipientType === "driver";
  const language = isDriver
    ? settings?.driver_language || "English"
    : settings?.passenger_language || "English";

  // Get driver info
  const assignedDriverId = workingAssignments?.[trip.id] || trip.employee_id;
  const driver = drivers?.find((d) => d.id === assignedDriverId);

  const recipientName = isDriver
    ? driver?.name || "Driver"
    : trip.client_name || "Passenger";

  const recipientPhone = isDriver ? driver?.phone : trip.client_phone;

  const recipientEmail = isDriver ? driver?.email : trip.client_email;

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setSending(true);
    try {
      if (isDriver && driver) {
        // Send to driver via driver-messages API
        const res = await fetch("/api/sms/driver-messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: driver.id,
            message: message.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send");
        toast.success(`Message sent to ${driver.name} ✓`);
      } else {
        // Send to passenger via send-custom API
        const res = await fetch("/api/sms/send-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: trip.client_id,
            phone: trip.client_phone,
            email: trip.client_email,
            name: trip.client_name,
            message: message.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send");

        const channels = [];
        if (data.results?.sms) channels.push("SMS");
        if (data.results?.email) channels.push("Email");
        const channelText =
          channels.length > 0 ? ` via ${channels.join(" & ")}` : "";
        toast.success(`Message sent to ${trip.client_name}${channelText} ✓`);
      }
      onClose();
    } catch (err) {
      console.error("Send message error:", err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const tripTime = new Date(trip.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const langEmoji =
    {
      English: "🇺🇸",
      Spanish: "🇪🇸",
      French: "🇫🇷",
      Portuguese: "🇧🇷",
      Chinese: "🇨🇳",
      Korean: "🇰🇷",
      Arabic: "🇸🇦",
      Russian: "🇷🇺",
      Hindi: "🇮🇳",
      Creole: "🇭🇹",
    }[language] || "🌐";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div
          className="p-5 text-white"
          style={{
            background: isDriver
              ? "linear-gradient(135deg, #7c3aed, #a855f7)"
              : "linear-gradient(135deg, #059669, #10b981)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-lg">
                Message {isDriver ? "Driver" : "Passenger"}
              </h2>
              <p className="text-sm opacity-90">{recipientName}</p>
            </div>
          </div>
          {/* Trip info badge */}
          <div className="mt-3 bg-white/15 rounded-lg px-3 py-2 text-sm">
            <span className="font-semibold">{trip.client_name}</span>
            <span className="mx-1.5 opacity-60">·</span>
            <span>{tripTime}</span>
            {trip.booking_number && (
              <>
                <span className="mx-1.5 opacity-60">·</span>
                <span>#{trip.booking_number}</span>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Language indicator */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <span className="text-lg">{langEmoji}</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-800">
                {isDriver ? "Driver" : "Passenger"} Language: {language}
              </p>
              <p className="text-[11px] text-blue-600">
                Compose your message in {language}
              </p>
            </div>
            <a
              href="/settings"
              target="_blank"
              className="text-[10px] text-blue-500 hover:underline"
            >
              Change
            </a>
          </div>

          {/* Contact info */}
          <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
            {recipientPhone && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                <Phone size={11} /> {recipientPhone}
              </p>
            )}
            {recipientEmail && (
              <p className="text-xs text-gray-600 flex items-center gap-1.5">
                📧 {recipientEmail}
              </p>
            )}
            {!recipientPhone && !recipientEmail && (
              <p className="text-xs text-red-600 font-medium">
                ⚠️ No contact info available
              </p>
            )}
          </div>

          {/* Message input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Type your message in ${language}...`}
              rows={4}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-[11px] text-gray-400">
              {message.length} characters
              {message.length > 160 &&
                " · May be split into multiple SMS segments"}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={
              sending || !message.trim() || (!recipientPhone && !recipientEmail)
            }
            className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 ${
              isDriver
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            <Send size={14} />
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
