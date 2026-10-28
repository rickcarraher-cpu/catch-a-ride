import { DriverCard } from "./DriverCard";

export function DriversGrid({
  drivers,
  vehiclesByDriver,
  assignmentsByDriver = {},
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
}) {
  if (isLoading) {
    return (
      <div className="col-span-full py-12 text-center text-gray-500">
        Loading drivers...
      </div>
    );
  }

  if (!drivers || drivers.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-gray-500">
        No drivers found.
      </div>
    );
  }

  return (
    <>
      {drivers.map((driver) => {
        const driverVehicles = vehiclesByDriver[driver.id] || [];
        const driverAssignments = assignmentsByDriver[driver.id] || [];
        return (
          <DriverCard
            key={driver.id}
            driver={driver}
            vehicles={driverVehicles}
            vehicleAssignments={driverAssignments}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        );
      })}
    </>
  );
}
