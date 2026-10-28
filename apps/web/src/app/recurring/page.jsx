"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Repeat,
  Trash2,
  XCircle,
  AlertCircle,
  Edit,
  RefreshCw,
  Search,
  MapPin,
  Clock,
  Briefcase,
  Hash,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { PageWithBackButton } from "@/components/PageWithBackButton";
import { BookingWizardMain } from "@/components/BookingWizard/BookingWizardMain";

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);

  const { data: recurringTrips, isLoading } = useQuery({
    queryKey: ["recurring-trips"],
    queryFn: async () => {
      const res = await fetch("/api/recurring");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });
  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });
  const { data: vehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => fetch("/api/vehicles").then((r) => r.json()),
  });
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: () => fetch("/api/services").then((r) => r.json()),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });
  const { data: preferredLocations } = useQuery({
    queryKey: ["preferred-locations"],
    queryFn: () =>
      fetch("/api/settings/preferred-locations").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/recurring/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["recurring-trips"]);
      toast.success("Recurring series removed");
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (recurring_id) => {
      const res = await fetch("/api/recurring/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recurring_id, days_ahead: 30 }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Generated ${data.generated} appointment${data.generated !== 1 ? "s" : ""}`,
      );
      queryClient.invalidateQueries(["appointments"]);
    },
    onError: () => {
      toast.error("Failed to generate appointments");
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/recurring/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days_ahead: 30 }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Generated ${data.generated} appointment${data.generated !== 1 ? "s" : ""} from all series`,
      );
      queryClient.invalidateQueries(["appointments"]);
    },
    onError: () => {
      toast.error("Failed to generate appointments");
    },
  });

  const formatTime12h = (timeStr) => {
    if (!timeStr) return "—";
    const [h, m] = timeStr.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${display}:${m} ${ampm}`;
  };

  const frequencyLabel = (freq) => {
    const labels = {
      daily: "Daily",
      weekly: "Weekly",
      "bi-weekly": "Bi-Weekly",
      monthly: "Monthly",
    };
    return labels[freq] || freq;
  };

  // Calculate total duration from services_data
  const formatDuration = (services_data) => {
    if (
      !services_data ||
      !Array.isArray(services_data) ||
      services_data.length === 0
    ) {
      return "—";
    }

    const totalMinutes = services_data.reduce((sum, svc) => {
      return sum + (svc.duration_minutes || 0) * (svc.quantity || 1);
    }, 0);

    if (totalMinutes === 0) return "—";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // If showing wizard, render it fullscreen
  if (showWizard) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-y-auto">
        <button
          onClick={() => {
            setShowWizard(false);
            setEditingTrip(null);
          }}
          className="absolute top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
        >
          <ArrowLeft size={18} />
          Back to List
        </button>
        <BookingWizardMain
          isPassengerMode={false}
          isRecurringMode={true}
          services={services || []}
          settings={settings || {}}
          preferredLocations={preferredLocations || []}
          drivers={drivers || []}
          vehicles={vehicles || []}
          onClose={() => {
            setShowWizard(false);
            setEditingTrip(null);
          }}
          onSuccess={() => {
            setShowWizard(false);
            setEditingTrip(null);
            queryClient.invalidateQueries(["recurring-trips"]);
            toast.success("Recurring series created successfully");
          }}
        />
      </div>
    );
  }

  return (
    <>
      <PageWithBackButton>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Recurring Trips
              </h1>
              <p className="text-gray-500 mt-1">
                Set up automated repeating schedules for regular passengers.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => generateAllMutation.mutate()}
                disabled={generateAllMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    generateAllMutation.isPending ? "animate-spin" : ""
                  }
                />
                Generate All
              </button>
              <button
                onClick={() => {
                  setEditingTrip(null);
                  setShowWizard(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                New Series
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Passenger
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    # Trips
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Loading recurring trips...
                    </td>
                  </tr>
                ) : !recurringTrips || recurringTrips.length === 0 ? (
                  <tr>
                    <td
                      colSpan="8"
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      No recurring series found. Create your first one!
                    </td>
                  </tr>
                ) : (
                  recurringTrips.map((trip) => {
                    const occLabel =
                      trip.num_occurrences > 0
                        ? `${trip.num_occurrences}`
                        : "∞";
                    return (
                      <tr
                        key={trip.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-gray-900">
                            {trip.client_name || "Unknown"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
                            <Repeat size={12} />
                            {frequencyLabel(trip.frequency)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {formatTime12h(trip.start_time)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 font-medium">
                            <Clock size={14} className="text-gray-400" />
                            {formatDuration(trip.services_data)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">
                            {trip.employee_name || "Unassigned"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500 truncate max-w-[150px] block">
                            {trip.destination || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 font-medium">
                            {occLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => generateMutation.mutate(trip.id)}
                              disabled={generateMutation.isPending}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Generate next 7 days"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingTrip(trip);
                                setShowWizard(true);
                              }}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit series"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Remove this recurring series? This won't delete existing appointments.",
                                  )
                                )
                                  deleteMutation.mutate(trip.id);
                              }}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Delete series"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-blue-900">
                How Recurring Trips Work
              </p>
              <p className="text-xs text-blue-700 mt-0.5">
                Click "Generate All" to create appointments for the next 30 days
                from all recurring series. You can also generate from individual
                series. Generated appointments appear in your Trips list and can
                be edited or cancelled independently without affecting the
                recurring series.
              </p>
            </div>
          </div>
        </div>
      </PageWithBackButton>
    </>
  );
}
