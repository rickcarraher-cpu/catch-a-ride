import { useQuery } from "@tanstack/react-query";

export function useVehiclesByDriver() {
  const { data: allVehicles } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const res = await fetch("/api/vehicles");
      return res.json();
    },
    staleTime: 0,
  });

  const vehiclesByDriver = (allVehicles || []).reduce((acc, v) => {
    // Use junction table assigned_drivers array
    const assignedDrivers = v.assigned_drivers || [];
    assignedDrivers.forEach((driver) => {
      if (!acc[driver.id]) acc[driver.id] = [];
      acc[driver.id].push(v);
    });
    // Also include legacy employee_id assignment
    if (v.employee_id && !assignedDrivers.some((d) => d.id === v.employee_id)) {
      if (!acc[v.employee_id]) acc[v.employee_id] = [];
      acc[v.employee_id].push(v);
    }
    return acc;
  }, {});

  return vehiclesByDriver;
}
