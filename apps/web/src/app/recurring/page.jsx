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
import {getReport} from "../../../app/preview/use-database-reports";

export default function RecurringPage() {

  const { data: recurringTrips, isLoading,error } = useQuery({
    queryKey: ["recurring-trips"],
    queryFn: async () => {
      return getReport("recurring");
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
      return sum + Number(svc.duration_minutes || 0) * Number(svc.quantity || 1);
    }, 0);

    if (totalMinutes === 0) return "—";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  if(error)return <p role="alert">{error.message}</p>;
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
              <button disabled
                onClick={()=>{}}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  size={18}
                  className={
                    false ? "animate-spin" : ""
                  }
                />
                Generate All
              </button>
              <button disabled
                onClick={()=>{}}
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
                            <button disabled
                              onClick={()=>{}}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Generate next 7 days"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button disabled
                              onClick={()=>{}}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="Edit series"
                            >
                              <Edit size={16} />
                            </button>
                            <button disabled
                              onClick={()=>{}}
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
                Imported series can be reviewed here. Generation and changes are not connected in this test release.
              </p>
            </div>
          </div>
        </div>
      </PageWithBackButton>
    </>
  );
}
