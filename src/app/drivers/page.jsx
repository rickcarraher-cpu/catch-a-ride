"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDrivers } from "@/hooks/useDrivers";
import { useVehiclesByDriver } from "@/hooks/useVehiclesByDriver";
import { printDrivers } from "@/utils/drivers/printDrivers";
import { DriversHeader } from "@/components/Drivers/DriversHeader";
import { DriversSearch } from "@/components/Drivers/DriversSearch";
import { DriversGrid } from "@/components/Drivers/DriversGrid";
import { DriverModal } from "@/components/Drivers/DriverModal/DriverModal";
import { DeleteWarningModal } from "@/components/Drivers/DeleteWarningModal";
import BackToDashboard from "@/components/BackToDashboard";

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null);

  const { drivers, isLoading, deleteMutation } = useDrivers();
  const vehiclesByDriver = useVehiclesByDriver();

  // Fetch all vehicle assignments (includes profile_image_url + profile_description per vehicle)
  const { data: allVehicleAssignments } = useQuery({
    queryKey: ["vehicle-assignments"],
    queryFn: async () => {
      const res = await fetch("/api/vehicle-assignments");
      if (!res.ok) throw new Error("Failed to fetch vehicle assignments");
      return res.json();
    },
  });

  // Build lookup: employee_id → array of vehicle_assignment objects (with profile data)
  const assignmentsByDriver = (allVehicleAssignments || []).reduce(
    (acc, va) => {
      if (!acc[va.employee_id]) acc[va.employee_id] = [];
      acc[va.employee_id].push(va);
      return acc;
    },
    {},
  );

  const filteredDrivers = drivers?.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handlePrintDrivers = () => {
    printDrivers(filteredDrivers, vehiclesByDriver);
  };

  const handleAddDriver = () => {
    setEditingDriver(null);
    setIsModalOpen(true);
  };

  const handleEditDriver = (driver) => {
    setEditingDriver(driver);
    setIsModalOpen(true);
  };

  const handleDeleteDriver = async (id) => {
    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.hasUpcomingTrips) {
          // Show warning modal with upcoming trips
          const driver = drivers.find((d) => d.id === id);
          setDeleteWarning({
            driver,
            trips: data.trips,
          });
        } else {
          alert(`Error: ${data.error || "Failed to delete driver"}`);
        }
        return;
      }

      // Success - invalidate queries to refresh the list
      queryClient.invalidateQueries(["employees"]);
      queryClient.refetchQueries(["employees"]);
    } catch (error) {
      console.error("Failed to delete driver:", error);
      alert("Failed to delete driver. Please try again.");
    }
  };

  const handleToggleActive = async (driver) => {
    const action = driver.is_active ? "deactivate" : "reactivate";
    const confirmMessage = driver.is_active
      ? `Deactivate ${driver.name}? They will no longer be available for trips but all historical data will be preserved.`
      : `Reactivate ${driver.name}? They will become available for trips again.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/employees/${driver.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !driver.is_active }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(`Failed to ${action} driver: ${data.error || "Unknown error"}`);
        return;
      }

      queryClient.invalidateQueries(["employees"]);
      queryClient.refetchQueries(["employees"]);
    } catch (error) {
      console.error(`Failed to ${action} driver:`, error);
      alert(`Failed to ${action} driver. Please try again.`);
    }
  };

  return (
    <div className="space-y-6">
      <BackToDashboard />
      <DriversHeader
        onAddDriver={handleAddDriver}
        onPrint={handlePrintDrivers}
        isLoading={isLoading}
        hasDrivers={!!filteredDrivers?.length}
      />

      <DriversSearch value={search} onChange={setSearch} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DriversGrid
          drivers={filteredDrivers}
          vehiclesByDriver={vehiclesByDriver}
          assignmentsByDriver={assignmentsByDriver}
          isLoading={isLoading}
          onEdit={handleEditDriver}
          onDelete={handleDeleteDriver}
          onToggleActive={handleToggleActive}
        />
      </div>

      {isModalOpen && (
        <DriverModal
          driver={editingDriver}
          allDrivers={drivers || []}
          onClose={() => {
            setIsModalOpen(false);
            setEditingDriver(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingDriver(null);
            queryClient.invalidateQueries(["employees"]);
            queryClient.invalidateQueries(["vehicles"]);
            queryClient.refetchQueries(["employees"]);
          }}
        />
      )}

      {deleteWarning && (
        <DeleteWarningModal
          driver={deleteWarning.driver}
          trips={deleteWarning.trips}
          onClose={() => setDeleteWarning(null)}
        />
      )}
    </div>
  );
}
