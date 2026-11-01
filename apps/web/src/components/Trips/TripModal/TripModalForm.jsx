import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Timer, CheckCircle } from "lucide-react";
import { PassengerDriverSection } from "./FormSections/PassengerDriverSection";
import { ServicesSection } from "./FormSections/ServicesSection";
import { PassengerBaggageSection } from "./FormSections/PassengerBaggageSection";
import { FlightInfoSection } from "./FormSections/FlightInfoSection";
import { DestinationSection } from "./FormSections/DestinationSection";
import { PaymentMethodSection } from "./FormSections/PaymentMethodSection";
import { NotesSection } from "./FormSections/NotesSection";
import { TransactionsSection } from "./TransactionsSection";
import WeddingSection from "./WeddingSection";

// Find the "Before/After SBH" (or similar) addon from the services list
function getAfterHoursAddon(services) {
  if (!services) return null;
  return services.find((s) => {
    const n = s.name.toLowerCase();
    return (
      s.is_addon &&
      s.is_active &&
      (n.includes("sbh") ||
        n.includes("after hour") ||
        n.includes("before hour") ||
        n.includes("off hour") ||
        n.includes("after-hour"))
    );
  });
}

function TourDetailsSection({ tripId, trip }) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(true);

  // Editable tour pricing fields (local state, saved on blur)
  const [tourFlatFee, setTourFlatFee] = useState(trip?.tour_flat_fee || "");
  const [tourPaymentSplit, setTourPaymentSplit] = useState(
    trip?.tour_payment_split || "single",
  );
  const [tourEndTime, setTourEndTime] = useState(trip?.tour_end_time || "");
  const [tourParticipantType, setTourParticipantType] = useState(
    trip?.tour_participant_type || "passengers",
  );

  // New participant form
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    phone: "",
    email: "",
    pickup_location: "",
    dropoff_location: "",
  });

  // New itinerary stop form
  const [showAddStop, setShowAddStop] = useState(false);
  const [newStop, setNewStop] = useState({ location: "", description: "" });

  // Editing participant
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editParticipant, setEditParticipant] = useState({});

  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["tour-participants", tripId],
    queryFn: async () => {
      const res = await fetch(
        `/api/tours/participants?appointment_id=${tripId}`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.participants || [];
    },
    enabled: !!tripId,
  });

  const { data: itinerary = [], isLoading: loadingItinerary } = useQuery({
    queryKey: ["tour-itinerary", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/tours/itinerary?appointment_id=${tripId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.itinerary || [];
    },
    enabled: !!tripId,
  });

  // Save tour pricing fields
  const saveTourFields = useCallback(
    async (fields) => {
      try {
        const res = await fetch(`/api/appointments/${tripId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fields, send_notification: false }),
        });
        if (!res.ok) throw new Error("Failed to save");
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      } catch (err) {
        console.error("Failed to save tour fields:", err);
        toast.error("Failed to save tour field");
      }
    },
    [tripId, queryClient],
  );

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/tours/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          appointment_id: tripId,
          participant_type: tourParticipantType || "guest",
        }),
      });
      if (!res.ok) throw new Error("Failed to add participant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tour-participants", tripId],
      });
      setNewParticipant({
        name: "",
        phone: "",
        email: "",
        pickup_location: "",
        dropoff_location: "",
      });
      setShowAddParticipant(false);
      toast.success("Participant added");
    },
    onError: () => toast.error("Failed to add participant"),
  });

  // Update participant mutation
  const updateParticipantMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/tours/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update participant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tour-participants", tripId],
      });
      setEditingParticipantId(null);
      setEditParticipant({});
      toast.success("Participant updated");
    },
    onError: () => toast.error("Failed to update participant"),
  });

  // Delete participant mutation
  const deleteParticipantMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/tours/participants?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete participant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tour-participants", tripId],
      });
      toast.success("Participant removed");
    },
    onError: () => toast.error("Failed to remove participant"),
  });

  // Add itinerary stop mutation
  const addStopMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/tours/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          appointment_id: tripId,
          sequence_order: (itinerary?.length || 0) + 1,
        }),
      });
      if (!res.ok) throw new Error("Failed to add stop");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-itinerary", tripId] });
      setNewStop({ location: "", description: "" });
      setShowAddStop(false);
      toast.success("Stop added");
    },
    onError: () => toast.error("Failed to add stop"),
  });

  // Delete itinerary stop mutation
  const deleteStopMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/tours/itinerary?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete stop");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-itinerary", tripId] });
      toast.success("Stop removed");
    },
    onError: () => toast.error("Failed to remove stop"),
  });

  // Send payment links mutation
  const sendPaymentLinksMutation = useMutation({
    mutationFn: async (provider) => {
      const res = await fetch(`/api/tours/${tripId}/send-payment-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send payment links");
      }
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter(
        (r) => r.sms_sent || r.email_sent,
      ).length;
      toast.success(
        `Payment links sent to ${successCount} of ${data.total_participants} participants`,
      );
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send payment links");
    },
  });

  const isLoading = loadingParticipants || loadingItinerary;

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent";
  const labelClass = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-purple-100 hover:bg-purple-200 transition-colors text-left"
      >
        <span className="font-bold text-purple-900 flex items-center gap-2 text-sm">
          🚌 Tour Details
          {participants.length >= 0 && (
            <span className="text-xs font-normal text-purple-600">
              • {(trip?.num_people || 0) + 1} participant
              {(trip?.num_people || 0) + 1 !== 1 ? "s" : ""}
            </span>
          )}
          {itinerary.length > 0 && (
            <span className="text-xs font-normal text-purple-600">
              • {itinerary.length} stop{itinerary.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span className="text-purple-600 text-sm">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-5">
          {isLoading ? (
            <p className="text-sm text-purple-600 text-center py-2">
              Loading tour data...
            </p>
          ) : (
            <>
              {/* Tour Pricing Fields */}
              <div className="bg-white rounded-xl p-4 border border-purple-200 space-y-3">
                <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                  💰 Tour Pricing
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Flat Fee ($)</label>
                    <input
                      type="number"
                      value={tourFlatFee}
                      onChange={(e) => setTourFlatFee(e.target.value)}
                      onBlur={() =>
                        saveTourFields({ tour_flat_fee: tourFlatFee })
                      }
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Payment Split</label>
                    <select
                      value={tourPaymentSplit}
                      onChange={(e) => {
                        setTourPaymentSplit(e.target.value);
                        saveTourFields({ tour_payment_split: e.target.value });
                      }}
                      className={inputClass}
                    >
                      <option value="single">Single Payer</option>
                      <option value="divided">Divided Equally</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Tour End Time</label>
                    <input
                      type="time"
                      value={tourEndTime}
                      onChange={(e) => setTourEndTime(e.target.value)}
                      onBlur={() =>
                        saveTourFields({ tour_end_time: tourEndTime || null })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Participant Type</label>
                    <select
                      value={tourParticipantType}
                      onChange={(e) => {
                        setTourParticipantType(e.target.value);
                        saveTourFields({
                          tour_participant_type: e.target.value,
                        });
                      }}
                      className={inputClass}
                    >
                      <option value="passengers">Passengers</option>
                      <option value="guests">Guests</option>
                    </select>
                  </div>
                </div>
                {tourPaymentSplit === "divided" &&
                  participants.length >= 0 &&
                  tourFlatFee && (
                    <div className="text-sm text-purple-700 bg-purple-50 rounded-lg px-3 py-2">
                      Per person:{" "}
                      <span className="font-bold">
                        $
                        {Math.ceil(
                          Number(tourFlatFee) /
                            Math.max((trip?.num_people || 0) + 1, 1),
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
              </div>

              {/* Participants */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                    👥 Participants ({participants.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddParticipant(!showAddParticipant)}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-100 rounded-lg"
                  >
                    {showAddParticipant ? "Cancel" : "+ Add"}
                  </button>
                </div>

                {showAddParticipant && (
                  <div className="bg-white rounded-xl p-3 border border-purple-200 space-y-2">
                    <input
                      type="text"
                      placeholder="Name *"
                      value={newParticipant.name}
                      onChange={(e) =>
                        setNewParticipant((p) => ({
                          ...p,
                          name: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Phone"
                        value={newParticipant.phone}
                        onChange={(e) =>
                          setNewParticipant((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={newParticipant.email}
                        onChange={(e) =>
                          setNewParticipant((p) => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Pickup Location"
                        value={newParticipant.pickup_location}
                        onChange={(e) =>
                          setNewParticipant((p) => ({
                            ...p,
                            pickup_location: e.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="Drop-off Location"
                        value={newParticipant.dropoff_location}
                        onChange={(e) =>
                          setNewParticipant((p) => ({
                            ...p,
                            dropoff_location: e.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newParticipant.name.trim()) {
                          toast.error("Name is required");
                          return;
                        }
                        addParticipantMutation.mutate(newParticipant);
                      }}
                      disabled={addParticipantMutation.isPending}
                      className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {addParticipantMutation.isPending
                        ? "Adding..."
                        : "Add Participant"}
                    </button>
                  </div>
                )}

                {participants.length > 0 ? (
                  <div className="space-y-2">
                    {participants.map((p, i) => (
                      <div
                        key={p.id || i}
                        className="bg-white rounded-lg p-3 border border-purple-100 text-sm"
                      >
                        {editingParticipantId === p.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editParticipant.name || ""}
                              onChange={(e) =>
                                setEditParticipant((ep) => ({
                                  ...ep,
                                  name: e.target.value,
                                }))
                              }
                              className={inputClass}
                              placeholder="Name"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editParticipant.phone || ""}
                                onChange={(e) =>
                                  setEditParticipant((ep) => ({
                                    ...ep,
                                    phone: e.target.value,
                                  }))
                                }
                                className={inputClass}
                                placeholder="Phone"
                              />
                              <input
                                type="email"
                                value={editParticipant.email || ""}
                                onChange={(e) =>
                                  setEditParticipant((ep) => ({
                                    ...ep,
                                    email: e.target.value,
                                  }))
                                }
                                className={inputClass}
                                placeholder="Email"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={editParticipant.pickup_location || ""}
                                onChange={(e) =>
                                  setEditParticipant((ep) => ({
                                    ...ep,
                                    pickup_location: e.target.value,
                                  }))
                                }
                                className={inputClass}
                                placeholder="Pickup"
                              />
                              <input
                                type="text"
                                value={editParticipant.dropoff_location || ""}
                                onChange={(e) =>
                                  setEditParticipant((ep) => ({
                                    ...ep,
                                    dropoff_location: e.target.value,
                                  }))
                                }
                                className={inputClass}
                                placeholder="Drop-off"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateParticipantMutation.mutate({
                                    id: p.id,
                                    ...editParticipant,
                                  })
                                }
                                disabled={updateParticipantMutation.isPending}
                                className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                              >
                                {updateParticipantMutation.isPending
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingParticipantId(null);
                                  setEditParticipant({});
                                }}
                                className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {i + 1}. {p.name}
                              </p>
                              {p.phone && (
                                <p className="text-gray-500 text-xs mt-0.5">
                                  📱 {p.phone}
                                </p>
                              )}
                              {p.email && (
                                <p className="text-gray-500 text-xs">
                                  ✉️ {p.email}
                                </p>
                              )}
                              {p.pickup_location && (
                                <p className="text-gray-600 text-xs mt-1">
                                  🟢 Pickup: {p.pickup_location}
                                </p>
                              )}
                              {p.dropoff_location && (
                                <p className="text-gray-600 text-xs">
                                  🔴 Drop-off: {p.dropoff_location}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingParticipantId(p.id);
                                  setEditParticipant({
                                    name: p.name,
                                    phone: p.phone || "",
                                    email: p.email || "",
                                    pickup_location: p.pickup_location || "",
                                    dropoff_location: p.dropoff_location || "",
                                  });
                                }}
                                className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-50 rounded-lg"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Remove ${p.name}?`))
                                    deleteParticipantMutation.mutate(p.id);
                                }}
                                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 rounded-lg"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-purple-500 italic">
                    No participants recorded.
                  </p>
                )}
              </div>

              {/* Itinerary Stops */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                    📍 Itinerary ({itinerary.length} stops)
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddStop(!showAddStop)}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-100 rounded-lg"
                  >
                    {showAddStop ? "Cancel" : "+ Add Stop"}
                  </button>
                </div>

                {showAddStop && (
                  <div className="bg-white rounded-xl p-3 border border-purple-200 space-y-2">
                    <input
                      type="text"
                      placeholder="Location *"
                      value={newStop.location}
                      onChange={(e) =>
                        setNewStop((s) => ({ ...s, location: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newStop.description}
                      onChange={(e) =>
                        setNewStop((s) => ({
                          ...s,
                          description: e.target.value,
                        }))
                      }
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newStop.location.trim()) {
                          toast.error("Location is required");
                          return;
                        }
                        addStopMutation.mutate(newStop);
                      }}
                      disabled={addStopMutation.isPending}
                      className="w-full px-3 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {addStopMutation.isPending ? "Adding..." : "Add Stop"}
                    </button>
                  </div>
                )}

                {itinerary.length > 0 ? (
                  <div className="space-y-2">
                    {itinerary
                      .sort((a, b) => a.sequence_order - b.sequence_order)
                      .map((stop, i) => (
                        <div
                          key={stop.id || i}
                          className="bg-white rounded-lg p-3 border border-purple-100 flex items-start gap-3 text-sm"
                        >
                          <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                            {stop.sequence_order || i + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">
                              {stop.location}
                            </p>
                            {stop.description && (
                              <p className="text-gray-500 text-xs mt-0.5">
                                {stop.description}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove stop "${stop.location}"?`))
                                deleteStopMutation.mutate(stop.id);
                            }}
                            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 bg-red-50 rounded-lg shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-purple-500 italic">
                    No itinerary stops recorded.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Time-Based Quote Section ─────────────────────────────────────────────────
function TimeBasedQuoteSection({ formData, setFormData, services, tripId }) {
  const HOURLY_RATE = 55;
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState("");
  const [lastApplied, setLastApplied] = useState(null);

  const rawHours = parseFloat(hours) || 0;
  const roundedHours = rawHours > 0 ? Math.ceil(rawHours * 4) / 4 : 0;
  const calculatedPrice = roundedHours > 0 ? roundedHours * HOURLY_RATE : 0;

  const handleToggle = () => {
    setEnabled((prev) => !prev);
    // Only clear hours when CLOSING the panel (enabled is currently true)
    if (enabled) {
      setHours("");
      setLastApplied(null);
    }
  };

  const applyMutation = useMutation({
    mutationFn: async ({ price, updatedServices }) => {
      const payload = {
        status: "quote",
        send_notification: false,
        // Always include original_amount as a direct fallback
        original_amount: price,
      };

      if (updatedServices) {
        payload.services = updatedServices;
      }

      const res = await fetch(`/api/appointments/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to apply price");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      const { price, updatedServices } = variables;
      // Update local form state to reflect the saved change
      if (updatedServices) {
        setFormData((prev) => ({
          ...prev,
          services: updatedServices,
          status: "quote",
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          original_amount: price,
          status: "quote",
        }));
      }
      setLastApplied(price);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(
        `✓ Price saved: $${price.toFixed(2)} (${roundedHours}h @ $${HOURLY_RATE}/hr) — status set to Quote`,
      );
    },
    onError: (err) => {
      toast.error(err.message || "Failed to apply price");
    },
  });

  const handleApply = () => {
    if (calculatedPrice <= 0) {
      toast.error("Please enter a valid duration first");
      return;
    }

    if (!tripId) {
      toast.error("Trip must be saved before applying a time-based price");
      return;
    }

    let updatedServices = null;
    if (formData.services && formData.services.length > 0) {
      const firstMainIdx = formData.services.findIndex((ss) => {
        const sd = services?.find((ser) => ser.id == ss.service_id);
        return !sd?.is_addon;
      });

      if (firstMainIdx !== -1) {
        updatedServices = formData.services.map((s, i) => {
          if (i === firstMainIdx) {
            return {
              ...s,
              service_price: calculatedPrice,
              // Ensure duration_minutes is never null to avoid DB constraint error
              duration_minutes: s.duration_minutes || 75,
            };
          }
          return {
            ...s,
            duration_minutes: s.duration_minutes || 75,
          };
        });
      }
    }

    applyMutation.mutate({ price: calculatedPrice, updatedServices });
  };

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <button
        type="button"
        onClick={handleToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
          enabled
            ? "border-blue-400 bg-blue-50 text-blue-900"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-blue-300"
        }`}
      >
        <Timer
          size={18}
          className={enabled ? "text-blue-600" : "text-gray-400"}
        />
        <span className="font-semibold text-sm flex-1">Time-Based Quote</span>
        <span
          className={`inline-block w-10 h-5 rounded-full transition-colors relative ${
            enabled ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : ""
            }`}
          />
        </span>
      </button>

      {/* Expanded panel */}
      {enabled && (
        <div className="border-2 border-blue-200 rounded-xl bg-blue-50 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            <p className="text-sm font-bold text-blue-900">
              Price by Duration — ${HOURLY_RATE}/hr
            </p>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
              Sets status → Quote
            </span>
          </div>

          {/* Hours input */}
          <div>
            <label className="text-xs font-semibold text-blue-800 uppercase tracking-wide block mb-1">
              Duration (hours)
            </label>
            <input
              type="number"
              min="0.25"
              step="0.25"
              placeholder="e.g. 2.5"
              value={hours}
              onChange={(e) => {
                setHours(e.target.value);
                setLastApplied(null);
              }}
              className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            />
          </div>

          {/* Calculation preview */}
          {rawHours > 0 && (
            <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-blue-700">
                <span>Entered duration:</span>
                <span className="font-semibold">
                  {rawHours} hr{rawHours !== 1 ? "s" : ""}
                </span>
              </div>
              {roundedHours !== rawHours && (
                <div className="flex justify-between text-blue-700">
                  <span>Rounded to nearest 15 min:</span>
                  <span className="font-semibold">
                    {roundedHours} hrs ({Math.round(roundedHours * 60)} min)
                  </span>
                </div>
              )}
              <div className="flex justify-between text-blue-700">
                <span>Rate:</span>
                <span className="font-semibold">${HOURLY_RATE}.00/hr</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-blue-100">
                <span className="font-bold text-blue-900">
                  Calculated Price:
                </span>
                <span className="text-lg font-extrabold text-emerald-700">
                  ${calculatedPrice.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Success confirmation */}
          {lastApplied !== null && lastApplied === calculatedPrice && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg">
              <CheckCircle size={15} className="text-emerald-600 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">
                Price saved: ${lastApplied.toFixed(2)} — status set to Quote
              </span>
            </div>
          )}

          {/* Apply button */}
          <button
            type="button"
            onClick={handleApply}
            disabled={applyMutation.isPending || calculatedPrice <= 0}
            className={`w-full py-2.5 text-white font-bold rounded-lg text-sm transition-colors ${
              calculatedPrice > 0 && !applyMutation.isPending
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-blue-300 cursor-default"
            }`}
          >
            {applyMutation.isPending
              ? "Saving..."
              : calculatedPrice > 0
                ? `Apply Price & Set as Quote`
                : "Enter duration above"}
          </button>
        </div>
      )}
    </div>
  );
}

export function TripModalForm({
  formData,
  setFormData,
  clients,
  drivers,
  services,
  isAirportTrip,
  isReturnTrip,
  trip,
  tripPrice,
  ratePerMile,
  settings,
}) {
  // Fetch vehicles to match category with addon services
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to fetch vehicles");
      return res.json();
    },
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Section 1: Passenger & Driver */}
      <PassengerDriverSection
        formData={formData}
        setFormData={setFormData}
        clients={clients}
        drivers={drivers}
        tripId={trip?.id}
      />

      {/* Section 2: Destination (includes Services + Addresses) */}
      <DestinationSection
        formData={formData}
        setFormData={setFormData}
        isReturnTrip={isReturnTrip}
        services={services}
        ratePerMile={ratePerMile}
        manualMileage={settings?.manual_mileage === "yes"}
      />

      {/* Section 2.5: Time-Based Quote (edit mode only) */}
      {trip && (
        <TimeBasedQuoteSection
          formData={formData}
          setFormData={setFormData}
          services={services}
          tripId={trip.id}
        />
      )}

      {/* Section 3: Services & Pricing (total only) */}
      <ServicesSection
        formData={formData}
        services={services}
        settings={settings}
        trip={trip}
      />

      {/* Section 4: Passenger & Baggage */}
      <PassengerBaggageSection
        formData={formData}
        setFormData={setFormData}
        isAirportTrip={isAirportTrip}
      />

      {/* Section 5: Flight Information (if airport trip OR round trip with return date OR existing flight info) */}
      {(isAirportTrip ||
        !!formData.return_date ||
        !!formData.outgoing_flight_info ||
        !!formData.returning_flight_info) && (
        <FlightInfoSection
          formData={formData}
          setFormData={setFormData}
          isReturnTrip={isReturnTrip}
        />
      )}

      {/* Section 6: Payment Method */}
      <PaymentMethodSection formData={formData} setFormData={setFormData} />

      {/* Section 7: Notes (includes Status at the end) */}
      <NotesSection formData={formData} setFormData={setFormData} />

      {/* Section 7.5: Wedding (optional) */}
      <WeddingSection
        formData={formData}
        setFormData={setFormData}
        tripId={trip?.id}
      />

      {/* Section 8: Tour Details (if this is a tour trip) */}
      {trip?.is_tour && trip?.id && (
        <TourDetailsSection tripId={trip.id} trip={trip} />
      )}

      {trip && trip.id && (
        <TransactionsSection
          tripId={trip.id}
          tripPrice={tripPrice}
          trip={trip}
        />
      )}
    </div>
  );
}
