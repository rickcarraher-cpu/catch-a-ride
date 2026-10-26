import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { XCircle, ImageIcon } from "lucide-react";
import { toast } from "@/utils/notify";
import ProfileImageUpload from "@/components/ProfileImageUpload";
import PortraitBuilderWizard from "@/components/PortraitBuilderWizard";
import { PALETTE } from "@/utils/drivers/colorPalette";
import { DriverModalForm } from "./DriverModalForm";
import { VehiclesSection } from "./VehiclesSection";
import { BlockedTimesSection } from "./BlockedTimesSection";

export function DriverModal({ driver, allDrivers, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const usedColors = new Set(
    allDrivers
      .filter((d) => !driver || d.id !== driver.id)
      .map((d) => d.color?.toLowerCase()),
  );

  const [formData, setFormData] = useState({
    id: driver?.id,
    first_name: driver?.first_name || driver?.name?.split(" ")[0] || "",
    last_name:
      driver?.last_name || driver?.name?.split(" ").slice(1).join(" ") || "",
    email: driver?.email || "",
    phone: driver?.phone || "",
    street_address: driver?.street_address || "",
    city: driver?.city || "",
    state: driver?.state || "",
    zip_code: driver?.zip_code || "",
    notes: driver?.notes || "",
    color:
      driver?.color ||
      (() => {
        return (
          PALETTE.find((c) => !usedColors.has(c.toLowerCase())) || "#2563EB"
        );
      })(),
    salary_rate: driver ? (driver.salary_rate ?? 0.8) : 0.75,
    is_active: driver?.is_active ?? true,
    profile_image_url: driver?.profile_image_url || "",
    copy_communications_to_company:
      driver?.copy_communications_to_company ?? false,
    // Password & access fields
    password: driver?.password || null,
    new_password: "",
    is_admin: driver?.is_admin ?? false,
    force_password_reset: driver?.force_password_reset ?? false,
    // Additional driver permissions and settings
    can_cancel_trip: driver?.can_cancel_trip ?? false,
    hourly_rate: driver?.hourly_rate ?? null,
    is_tour_agent: driver?.is_tour_agent ?? false,
    is_driver: driver?.is_driver ?? true,
  });

  const [showPortraitBuilder, setShowPortraitBuilder] = useState(false);

  // Fetch vehicles assigned to this driver for the portrait builder
  const { data: driverVehicles } = useQuery({
    queryKey: ["vehicle-assignments", driver?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/vehicle-assignments?employee_id=${driver.id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch driver vehicles");
      return res.json();
    },
    enabled: !!driver?.id,
  });

  // Auto-set commission when name changes
  const handleNameChange = (firstName, lastName) => {
    let rate = formData.salary_rate;
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    if (fullName.includes("lisa k")) {
      rate = 1.0;
    } else if (!driver) {
      rate = 0.75;
    }
    setFormData({
      ...formData,
      first_name: firstName,
      last_name: lastName,
      salary_rate: rate,
    });
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = driver ? `/api/employees/${driver.id}` : "/api/employees";
      const method = driver ? "PATCH" : "POST";

      // Prepare data - include password fields
      const payload = { ...data };

      // Remove the masked password value - it's just a display indicator, not a real value
      delete payload.password;

      // Only include new_password if it was actually set
      if (!payload.new_password || payload.new_password.trim() === "") {
        delete payload.new_password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => {
      toast.success(driver ? "Driver updated" : "Driver added");
      onSuccess();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {driver ? "Edit Driver" : "New Driver"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <DriverModalForm
            formData={formData}
            setFormData={setFormData}
            handleNameChange={handleNameChange}
            usedColors={usedColors}
          />

          {/* Profile Image Upload */}
          <ProfileImageUpload
            value={formData.profile_image_url}
            onChange={(url) =>
              setFormData({ ...formData, profile_image_url: url })
            }
          />

          {/* Build Portrait Button - only show when editing a driver */}
          {driver && (
            <button
              type="button"
              onClick={() => setShowPortraitBuilder(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm"
            >
              <ImageIcon size={18} />
              Build Portrait Card
            </button>
          )}

          {/* Vehicles section (edit mode only) */}
          {driver && <VehiclesSection driver={driver} />}

          {/* Blocked Times section (edit mode only) */}
          {driver && <BlockedTimesSection driver={driver} />}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(formData)}
            disabled={mutation.isPending || !formData.first_name}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending
              ? "Saving..."
              : driver
                ? "Update Driver"
                : "Add Driver"}
          </button>
        </div>
      </div>

      {/* Portrait Builder Wizard */}
      {showPortraitBuilder && driver && (
        <PortraitBuilderWizard
          driver={driver}
          vehicles={driverVehicles || []}
          onClose={() => setShowPortraitBuilder(false)}
          onComplete={async ({
            portraitUrl,
            vehicleAssignmentId,
            vehicleDescription,
          }) => {
            try {
              if (!vehicleAssignmentId)
                throw new Error("No vehicle assignment selected");
              const res = await fetch(
                `/api/vehicle-assignments/${vehicleAssignmentId}`,
                {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    profile_image_url: portraitUrl,
                    profile_description: vehicleDescription || null,
                  }),
                },
              );
              if (!res.ok)
                throw new Error("Failed to update vehicle assignment portrait");
              toast.success("Portrait card saved to vehicle profile!");
              queryClient.invalidateQueries(["vehicle-assignments"]);
              queryClient.invalidateQueries(["employees"]);
              setShowPortraitBuilder(false);
            } catch (err) {
              console.error("Error updating portrait:", err);
              toast.error("Failed to save portrait");
            }
          }}
        />
      )}
    </div>
  );
}
