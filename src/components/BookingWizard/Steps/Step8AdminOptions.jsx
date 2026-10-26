/**
 * Step 8: Admin Options (Dispatch Mode Only)
 * Shows dispatch-only fields like driver assignment, booker name, etc.
 * NOW: This is the final step in dispatch mode - includes submit button
 */

import { useState } from "react";
import {
  Calendar,
  User,
  Truck,
  FileText,
  AlertTriangle,
  DollarSign,
  MapPin,
  Loader2,
  CheckCircle2,
  Send,
  Heart,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { useQuery } from "@tanstack/react-query";

export function Step8AdminOptions({
  formData,
  set,
  drivers = [],
  vehicles = [],
  isPassengerMode = true,
  selectedService = null,
  addons = [],
  onSubmit = null,
  onApproveAndSend = null,
  isSubmitting = false,
}) {
  // Fetch vehicle assignments for the selected driver
  const { data: driverVehicles } = useQuery({
    queryKey: ["vehicle-assignments", formData.employee_id],
    queryFn: async () => {
      const res = await fetch(
        `/api/vehicle-assignments?employee_id=${formData.employee_id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch driver vehicles");
      return res.json();
    },
    enabled: !!formData.employee_id,
  });

  // Fetch weddings for the optional wedding link
  const { data: weddings = [] } = useQuery({
    queryKey: ["weddings-active"],
    queryFn: async () => {
      const res = await fetch("/api/weddings?window=all");
      if (!res.ok) return [];
      const data = await res.json();
      return data.sort(
        (a, b) => new Date(b.wedding_date) - new Date(a.wedding_date),
      );
    },
    enabled: !isPassengerMode,
  });

  // This step is only shown in dispatch mode
  if (isPassengerMode) {
    return null;
  }

  return (
    <>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Options</h2>
        <p className="text-sm text-gray-500 mt-1">
          Set driver, vehicle, and finalize booking
        </p>
      </div>

      {/* Driver Assignment */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
          <User size={16} />
          Assign Driver
        </label>
        <select
          value={formData.employee_id || ""}
          onChange={(e) => set({ employee_id: e.target.value })}
          className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all bg-white"
        >
          <option value="">Auto-assign (rotation)</option>
          {drivers
            ?.filter((d) => d.is_active)
            ?.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.name}
              </option>
            ))}
        </select>
      </div>

      {/* Vehicle Assignment */}
      {vehicles && vehicles.length > 0 && (
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
            <Truck size={16} />
            Assign Vehicle
          </label>
          <select
            value={formData.vehicle_id || ""}
            onChange={(e) => set({ vehicle_id: e.target.value })}
            className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all bg-white"
          >
            <option value="">No specific vehicle</option>
            {(() => {
              if (!formData.employee_id || !driverVehicles) {
                return vehicles
                  ?.filter((v) => v.is_active)
                  ?.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name} {vehicle.year && `(${vehicle.year})`}
                    </option>
                  ));
              }

              const driverVehicleIds = new Set(
                driverVehicles.map((v) => v.vehicle_id),
              );
              const assignedVehicles = vehicles.filter(
                (v) => v.is_active && driverVehicleIds.has(v.id),
              );

              return assignedVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name} {vehicle.year && `(${vehicle.year})`}
                </option>
              ));
            })()}
          </select>
        </div>
      )}

      {/* Referred By */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
          <User size={16} />
          How They Heard About Us
        </label>
        <input
          type="text"
          value={formData.referral_source || ""}
          onChange={(e) => set({ referral_source: e.target.value })}
          placeholder="e.g., Google, Facebook, Friend, etc. (optional)"
          className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
        />
        <p className="text-xs text-gray-500 mt-2">
          Optional: Track how this passenger found your service
        </p>
      </div>

      {/* Booked By */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
          <User size={16} />
          Booked By (Your Name)
        </label>
        <input
          type="text"
          value={formData.booker_name || ""}
          onChange={(e) => set({ booker_name: e.target.value })}
          placeholder="Admin name (optional)"
          className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-600"
        />
        <p className="text-xs text-gray-500 mt-2">
          Optional: Record who created this booking for internal tracking
        </p>
      </div>

      {/* Driver Notes */}
      <div>
        <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
          <FileText size={16} />
          Driver Notes (Internal)
        </label>
        <textarea
          value={formData.driver_notes || ""}
          onChange={(e) => set({ driver_notes: e.target.value })}
          placeholder="Private notes for the assigned driver (passenger will not see these)"
          rows={4}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder:text-gray-600"
        />
        <p className="text-xs text-gray-500 mt-2">
          💡 These notes are only visible to drivers and admins
        </p>
      </div>

      {/* Wedding Package Link */}
      {weddings.length > 0 && (
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2 flex items-center gap-2">
            <Heart size={16} className="text-pink-500" />
            Link to Wedding Package (Optional)
          </label>
          <select
            value={formData.wedding_id || ""}
            onChange={(e) =>
              set({
                wedding_id: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-full px-5 py-4 text-base border-2 border-gray-200 rounded-2xl focus:border-pink-400 focus:ring-4 focus:ring-pink-100 outline-none transition-all bg-white"
          >
            <option value="">No Wedding</option>
            {weddings.map((w) => (
              <option key={w.id} value={w.id}>
                {w.venue_name} — {new Date(w.wedding_date).toLocaleDateString()}
                {w.client_name ? ` (${w.client_name})` : ""}
              </option>
            ))}
          </select>
          {formData.wedding_id && (
            <p className="text-xs text-pink-600 mt-2 flex items-center gap-1">
              <Heart size={12} /> This trip will be part of a wedding package
            </p>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white text-xl">ℹ️</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900 mb-1">
              Admin Fields
            </p>
            <p className="text-sm text-blue-800 leading-relaxed">
              These administrative options are only visible to dispatchers. The
              passenger will not see driver notes or internal assignments.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button - NOW PART OF ADMIN STEP */}
      {onSubmit && (
        <div className="space-y-3">
          {/* Approve & Send Confirmations Button */}
          {onApproveAndSend && (
            <button
              onClick={onApproveAndSend}
              disabled={isSubmitting}
              className="w-full py-5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={22} className="animate-spin" /> Approving…
                </>
              ) : (
                <>
                  <Send size={22} /> Approve & Send Confirmations
                </>
              )}
            </button>
          )}

          {/* Original Submit Button */}
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full py-5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-bold text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={22} className="animate-spin" /> Submitting…
              </>
            ) : (
              <>
                <CheckCircle2 size={22} /> Save Without Sending
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
