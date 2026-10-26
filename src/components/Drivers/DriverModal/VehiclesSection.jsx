import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Car,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  FileText,
} from "lucide-react";
import { toast } from "@/utils/notify";
import ProfileImageUpload from "@/components/ProfileImageUpload";

export function VehiclesSection({ driver }) {
  const queryClient = useQueryClient();
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAssignExisting, setShowAssignExisting] = useState(false);
  const [expandedVehicle, setExpandedVehicle] = useState(null);
  const [editingProfile, setEditingProfile] = useState({});
  const [vehicleForm, setVehicleForm] = useState({
    name: "",
    year: "",
    color: "",
    plate: "",
    category: "",
    passenger_capacity: "",
  });

  // Fetch vehicles assigned to this driver via junction table
  const { data: vehicles, refetch: refetchVehicles } = useQuery({
    queryKey: ["vehicle-assignments", driver?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/vehicle-assignments?employee_id=${driver.id}`,
      );
      if (!res.ok) throw new Error("Failed to fetch assigned vehicles");
      return res.json();
    },
    enabled: !!driver?.id,
  });

  // Fetch ALL vehicles so we can offer any for assignment
  const { data: allVehiclesList } = useQuery({
    queryKey: ["all-vehicles-list"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to fetch vehicles");
      return res.json();
    },
    enabled: !!driver?.id,
  });

  // Show all vehicles except ones already assigned to THIS driver
  const assignedVehicleIds = new Set((vehicles || []).map((v) => v.vehicle_id));
  const assignableVehicles = (allVehiclesList || []).filter(
    (v) => v.id && !assignedVehicleIds.has(v.id),
  );

  const assignVehicleMutation = useMutation({
    mutationFn: async (vehicleId) => {
      const res = await fetch("/api/vehicle-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId, employee_id: driver.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign vehicle");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Vehicle assigned");
      setShowAssignExisting(false);
      refetchVehicles();
      queryClient.invalidateQueries(["all-vehicles-list"]);
      queryClient.invalidateQueries(["vehicles"]);
    },
    onError: (err) => toast.error(err.message),
  });

  const addVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...vehicleForm };
      if (payload.passenger_capacity) {
        payload.passenger_capacity =
          parseInt(payload.passenger_capacity) || null;
      } else {
        payload.passenger_capacity = null;
      }
      // Create the vehicle first
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add vehicle");
      }
      const newVehicle = await res.json();
      // Then assign it to this driver
      const assignRes = await fetch("/api/vehicle-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: newVehicle.id,
          employee_id: driver.id,
        }),
      });
      if (!assignRes.ok) {
        const assignData = await assignRes.json();
        throw new Error(
          assignData.error || "Vehicle created but failed to assign",
        );
      }
      return newVehicle;
    },
    onSuccess: () => {
      toast.success("Vehicle added and assigned");
      setVehicleForm({
        name: "",
        year: "",
        color: "",
        plate: "",
        category: "",
        passenger_capacity: "",
      });
      setShowAddVehicle(false);
      refetchVehicles();
      queryClient.invalidateQueries(["all-vehicles-list"]);
      queryClient.invalidateQueries(["vehicles"]);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId) => {
      // Unassign from this driver only — don't deactivate the vehicle
      const res = await fetch(
        `/api/vehicle-assignments?vehicle_id=${vehicleId}&employee_id=${driver.id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to unassign vehicle");
    },
    onSuccess: () => {
      toast.success("Vehicle removed from driver");
      refetchVehicles();
      queryClient.invalidateQueries(["all-vehicles-list"]);
      queryClient.invalidateQueries(["vehicles"]);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateVehicleProfileMutation = useMutation({
    mutationFn: async ({
      assignmentId,
      profile_image_url,
      profile_description,
    }) => {
      const res = await fetch(`/api/vehicle-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_image_url, profile_description }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update vehicle profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Vehicle profile updated");
      refetchVehicles();
      setEditingProfile({});
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveVehicleProfile = (assignmentId) => {
    const profile = editingProfile[assignmentId] || {};
    updateVehicleProfileMutation.mutate({
      assignmentId,
      profile_image_url: profile.profile_image_url,
      profile_description: profile.profile_description,
    });
  };

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Car size={12} className="text-blue-500" />
          Assigned Vehicles
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAssignExisting((v) => !v);
              if (!showAssignExisting) setShowAddVehicle(false);
            }}
            className="text-xs font-semibold text-green-600 hover:underline"
          >
            {showAssignExisting ? "Cancel" : "Assign Existing"}
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => {
              setShowAddVehicle((v) => !v);
              if (!showAddVehicle) setShowAssignExisting(false);
            }}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            {showAddVehicle ? "Cancel" : "+ Create New"}
          </button>
        </div>
      </div>

      {/* Existing vehicles list */}
      {vehicles && vehicles.length > 0 ? (
        <div className="space-y-1.5">
          {vehicles.map((v) => (
            <div
              key={v.assignment_id}
              className="border border-gray-100 rounded-lg overflow-hidden"
            >
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Car size={14} className="text-gray-400 shrink-0" />
                  <div className="text-sm min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{v.name}</span>
                    {(v.color || v.category || v.passenger_capacity) && (
                      <span className="text-gray-400 ml-1.5 text-xs truncate">
                        {[
                          v.color,
                          v.category,
                          v.passenger_capacity
                            ? `${v.passenger_capacity} passenger(s)`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setExpandedVehicle(
                        expandedVehicle === v.assignment_id
                          ? null
                          : v.assignment_id,
                      )
                    }
                    className="p-1 text-gray-400 hover:text-blue-600 rounded shrink-0"
                    title="Edit vehicle-specific profile"
                  >
                    {expandedVehicle === v.assignment_id ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Remove ${v.name} from this driver?\n\nThe vehicle will remain active and can be assigned to other drivers.`,
                        )
                      )
                        deleteVehicleMutation.mutate(v.vehicle_id);
                    }}
                    className="p-1 text-gray-300 hover:text-red-500 rounded shrink-0"
                    title="Remove vehicle from this driver"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expandable profile section */}
              {expandedVehicle === v.assignment_id && (
                <div className="bg-white border-t border-gray-100 p-3 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <User size={12} className="text-purple-500" />
                    Vehicle-Specific Driver Profile
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1.5">
                      Profile Image for this Vehicle
                    </label>
                    <ProfileImageUpload
                      currentImageUrl={
                        editingProfile[v.assignment_id]?.profile_image_url ??
                        v.profile_image_url
                      }
                      onImageUrlChange={(url) => {
                        setEditingProfile({
                          ...editingProfile,
                          [v.assignment_id]: {
                            ...editingProfile[v.assignment_id],
                            profile_image_url: url,
                            profile_description:
                              editingProfile[v.assignment_id]
                                ?.profile_description ?? v.profile_description,
                          },
                        });
                      }}
                      driverName={driver.name}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      This image will be shown to passengers when{" "}
                      {driver.name?.split(" ")[0] || "driver"} drives this
                      vehicle
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                      <FileText size={10} />
                      Driver Bio for this Vehicle
                    </label>
                    <textarea
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-600 resize-none"
                      placeholder="e.g., 'Professional driver with 10 years experience. Specializes in airport transfers.'"
                      rows={3}
                      value={
                        editingProfile[v.assignment_id]?.profile_description ??
                        v.profile_description ??
                        ""
                      }
                      onChange={(e) => {
                        setEditingProfile({
                          ...editingProfile,
                          [v.assignment_id]: {
                            ...editingProfile[v.assignment_id],
                            profile_description: e.target.value,
                            profile_image_url:
                              editingProfile[v.assignment_id]
                                ?.profile_image_url ?? v.profile_image_url,
                          },
                        });
                      }}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Optional: Add a custom bio shown only when driving this
                      vehicle
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={updateVehicleProfileMutation.isPending}
                    onClick={() => handleSaveVehicleProfile(v.assignment_id)}
                    className="w-full py-1.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {updateVehicleProfileMutation.isPending
                      ? "Saving…"
                      : "Save Vehicle Profile"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAddVehicle && (
          <p className="text-xs text-gray-400 italic">
            No vehicles assigned yet.
          </p>
        )
      )}

      {/* Assign existing vehicle dropdown */}
      {showAssignExisting && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-2">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Choose an existing vehicle
          </label>
          {assignableVehicles.length > 0 ? (
            <select
              className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-600"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  assignVehicleMutation.mutate(Number(e.target.value));
                }
              }}
            >
              <option value="" disabled>
                Select a vehicle…
              </option>
              {assignableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.color ? ` — ${v.color}` : ""}
                  {v.category ? ` (${v.category})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-gray-500 italic">
              All vehicles are already assigned to this driver.
            </p>
          )}
        </div>
      )}

      {/* Add vehicle inline form */}
      {showAddVehicle && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Vehicle Name *
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                placeholder="e.g. GMC Yukon"
                value={vehicleForm.name}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Category
              </label>
              <select
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={vehicleForm.category}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    category: e.target.value,
                  })
                }
              >
                <option value="">Select...</option>
                <option value="X-Larger SUV's">X-Larger SUV&apos;s</option>
                <option value="Larger SUV's">Larger SUV&apos;s</option>
                <option value="Mid Sized SUV">Mid Sized SUV</option>
                <option value="Standard SUV">Standard SUV</option>
                <option value="LUXURY CAR">Luxury Car</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Color
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                placeholder="Black"
                value={vehicleForm.color}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    color: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Passengers
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                placeholder="6"
                value={vehicleForm.passenger_capacity}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    passenger_capacity: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Year
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                placeholder="2022"
                value={vehicleForm.year}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    year: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Plate
              </label>
              <input
                type="text"
                className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                placeholder="ABC-1234"
                value={vehicleForm.plate}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    plate: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!vehicleForm.name || addVehicleMutation.isPending}
            onClick={() => addVehicleMutation.mutate()}
            className="w-full py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {addVehicleMutation.isPending ? "Adding…" : "Save Vehicle"}
          </button>
        </div>
      )}
    </div>
  );
}
