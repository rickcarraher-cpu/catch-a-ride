"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Car,
  Trash2,
  XCircle,
  Printer,
  Users,
  Pencil,
} from "lucide-react";
import { toast } from "@/utils/notify";
import { PageWithBackButton } from "@/components/PageWithBackButton";

// No longer needed - categories are fetched dynamically from the database
// const CATEGORY_OPTIONS = [
//   "X-Larger SUV's",
//   "Larger SUV's",
//   "Mid Sized SUV",
//   "Standard SUV",
//   "LUXURY CAR",
// ];

export default function VehiclesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      if (!res.ok) throw new Error("Failed to fetch vehicles");
      return res.json();
    },
  });

  const { data: drivers } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch drivers");
      return res.json();
    },
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete vehicle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["vehicles"]);
      toast.success("Vehicle removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredVehicles = vehicles
    ?.filter((v) => {
      const q = search.toLowerCase();
      return (
        v.name?.toLowerCase().includes(q) ||
        v.plate?.toLowerCase().includes(q) ||
        v.category?.toLowerCase().includes(q) ||
        v.employee_name?.toLowerCase().includes(q) ||
        v.color?.toLowerCase().includes(q)
      );
    })
    ?.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const printVehicles = () => {
    const list = filteredVehicles || [];
    const rows = list
      .map(
        (v) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#000;">${v.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${v.category || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${v.color || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${v.year || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${v.plate || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;color:#000;">${v.passenger_capacity || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#000;">${v.employee_name || "Unassigned"}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><title>Vehicle List</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #000; }
  h1 { font-size: 22px; margin: 0 0 4px; font-weight: 800; color: #000; }
  p.sub { font-size: 13px; color: #000; margin: 0 0 20px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 10px 12px; background: #f9fafb; border-bottom: 2px solid #000; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #000; font-weight: 700; }
  @media print { body { padding: 16px; } }
</style>
</head><body>
<h1>Vehicle List</h1>
<p class="sub">Printed ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} &mdash; ${list.length} vehicle${list.length !== 1 ? "s" : ""}</p>
<table>
  <thead><tr>
    <th>Name</th><th>Category</th><th>Color</th><th>Year</th><th>Plate</th><th style="text-align:center;">Capacity</th><th>Driver</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body></html>`;

    const printWindow =
      typeof window !== "undefined" ? window.open("", "_blank") : null;
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <PageWithBackButton>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Vehicles
            </h1>
            <p className="text-gray-500 mt-1">
              Manage your fleet and assign drivers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={printVehicles}
              disabled={isLoading || !filteredVehicles?.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer size={18} />
              Print List
            </button>
            <button
              onClick={() => {
                setEditingVehicle(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Vehicle
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by name, plate, category, color, or driver..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table view */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Plate
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      Loading vehicles...
                    </td>
                  </tr>
                ) : filteredVehicles?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-gray-400"
                    >
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles?.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 shrink-0">
                            <Car size={18} />
                          </div>
                          <span className="font-semibold text-gray-900">
                            {vehicle.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {vehicle.category ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                            {vehicle.category}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {vehicle.color || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {vehicle.year || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {vehicle.plate ? (
                          <span className="font-mono text-xs bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-gray-700">
                            {vehicle.plate}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {vehicle.passenger_capacity ? (
                          <span className="inline-flex items-center gap-1 text-gray-700 font-semibold">
                            <Users size={13} className="text-gray-400" />
                            {vehicle.passenger_capacity}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const drivers = vehicle.assigned_drivers || [];
                          const hasDrivers =
                            drivers.length > 0 || vehicle.employee_name;
                          if (!hasDrivers) {
                            return (
                              <span className="text-gray-400 italic text-xs">
                                Unassigned
                              </span>
                            );
                          }
                          // Combine junction table drivers with legacy employee_name
                          const driverNames = drivers.map((d) => d.name);
                          if (
                            vehicle.employee_name &&
                            !driverNames.includes(vehicle.employee_name)
                          ) {
                            driverNames.unshift(vehicle.employee_name);
                          }
                          return (
                            <span className="font-medium text-gray-900">
                              {driverNames.join(", ")}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingVehicle(vehicle);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit vehicle"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Remove "${vehicle.name}"? This will deactivate the vehicle.`,
                                )
                              )
                                deleteMutation.mutate(vehicle.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete vehicle"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer summary */}
          {!isLoading && filteredVehicles?.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              {filteredVehicles.length} vehicle
              {filteredVehicles.length !== 1 ? "s" : ""}
              {search && ` matching "${search}"`}
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <VehicleModal
          vehicle={editingVehicle}
          drivers={drivers || []}
          onClose={() => {
            setIsModalOpen(false);
            setEditingVehicle(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingVehicle(null);
            queryClient.invalidateQueries(["vehicles"]);
          }}
        />
      )}
    </PageWithBackButton>
  );
}

function VehicleModal({ vehicle, drivers, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: vehicle?.name || "",
    category: vehicle?.category || "",
    color: vehicle?.color || "",
    year: vehicle?.year || "",
    plate: vehicle?.plate || "",
    passenger_capacity: vehicle?.passenger_capacity || "",
    employee_id: vehicle?.employee_id || "",
  });

  // Track which driver IDs are selected
  const [selectedDriverIds, setSelectedDriverIds] = useState(new Set());
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  // Load existing assignments when editing
  React.useEffect(() => {
    if (!vehicle?.id) {
      setAssignmentsLoaded(true);
      return;
    }
    fetch(`/api/vehicle-assignments?vehicle_id=${vehicle.id}`)
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set((data || []).map((a) => a.employee_id));
        // Also include legacy employee_id if present
        if (vehicle.employee_id) ids.add(vehicle.employee_id);
        setSelectedDriverIds(ids);
        setAssignmentsLoaded(true);
      })
      .catch(() => setAssignmentsLoaded(true));
  }, [vehicle?.id]);

  // Fetch vehicle categories from the database
  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ["vehicle-categories"],
    queryFn: async () => {
      const res = await fetch("/api/vehicle-categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const categories = categoriesData?.categories || [];

  const toggleDriver = (driverId) => {
    setSelectedDriverIds((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const url = vehicle ? `/api/vehicles/${vehicle.id}` : "/api/vehicles";
      const method = vehicle ? "PATCH" : "POST";
      const payload = {
        ...data,
        employee_id: data.employee_id || null,
        passenger_capacity: data.passenger_capacity
          ? parseInt(data.passenger_capacity)
          : null,
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to save vehicle");
      }
      const saved = await res.json();
      const vehicleId = saved.id || vehicle?.id;

      // Sync driver assignments
      // Get current assignments
      const existingRes = await fetch(
        `/api/vehicle-assignments?vehicle_id=${vehicleId}`,
      );
      const existingAssignments = existingRes.ok
        ? await existingRes.json()
        : [];
      const existingIds = new Set(
        existingAssignments.map((a) => a.employee_id),
      );

      const toAdd = [...selectedDriverIds].filter((id) => !existingIds.has(id));
      const toRemove = [...existingIds].filter(
        (id) => !selectedDriverIds.has(id),
      );

      await Promise.all([
        ...toAdd.map((empId) =>
          fetch("/api/vehicle-assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vehicle_id: vehicleId, employee_id: empId }),
          }),
        ),
        ...toRemove.map((empId) =>
          fetch(
            `/api/vehicle-assignments?vehicle_id=${vehicleId}&employee_id=${empId}`,
            {
              method: "DELETE",
            },
          ),
        ),
      ]);

      return saved;
    },
    onSuccess: () => {
      toast.success(vehicle ? "Vehicle updated" : "Vehicle added");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const activeDrivers = drivers.filter((d) => d.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            {vehicle ? "Edit Vehicle" : "New Vehicle"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Vehicle Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Vehicle Name *
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. GMC Yukon XL"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Category
            </label>
            <select
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              disabled={loadingCategories}
            >
              <option value="">
                {loadingCategories
                  ? "Loading categories..."
                  : "Select category..."}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Color
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                placeholder="Black"
              />
            </div>

            {/* Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Year
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
                placeholder="2024"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Plate */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                License Plate
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.plate}
                onChange={(e) =>
                  setFormData({ ...formData, plate: e.target.value })
                }
                placeholder="ABC-1234"
              />
            </div>

            {/* Passenger Capacity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Passenger Capacity
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-600"
                value={formData.passenger_capacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    passenger_capacity: e.target.value,
                  })
                }
                placeholder="6"
              />
            </div>
          </div>

          {/* Assigned Drivers — multi-select checkboxes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} />
              Assigned Drivers
              {selectedDriverIds.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                  {selectedDriverIds.size} selected
                </span>
              )}
            </label>
            {!assignmentsLoaded ? (
              <p className="text-xs text-gray-400 italic">Loading...</p>
            ) : activeDrivers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                No active drivers found.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {activeDrivers.map((d) => {
                  const checked = selectedDriverIds.has(d.id);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? "bg-blue-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDriver(d.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: d.color || "#6b7280" }}
                      >
                        {(d.first_name || d.name || "").charAt(0)}
                      </div>
                      <span
                        className={`text-sm ${checked ? "font-semibold text-blue-900" : "text-gray-700"}`}
                      >
                        {d.first_name || d.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-gray-400">
              Select all drivers who may drive this vehicle. A vehicle can have
              any number of drivers.
            </p>
          </div>
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
            disabled={mutation.isPending || !formData.name}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {mutation.isPending
              ? "Saving..."
              : vehicle
                ? "Update Vehicle"
                : "Add Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}
