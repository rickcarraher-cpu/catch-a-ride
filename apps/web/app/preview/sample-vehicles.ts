export const SAMPLE_VEHICLES = [
  { id: 1, name: 'Sample Sedan', category: 'Sedan', passenger_capacity: 4, capacity: 4, is_active: true },
  { id: 2, name: 'Sample SUV', category: 'SUV', passenger_capacity: 6, capacity: 6, is_active: true },
];
export const SAMPLE_CATEGORIES = ['Sedan', 'SUV'];
export function sampleVehicleAssignments(drivers: { id: string }[], employeeId?: string | null) {
  return drivers.slice(0, 2).map((driver, index) => ({
    assignment_id: index + 1, vehicle_id: SAMPLE_VEHICLES[index].id, employee_id: driver.id,
    name: SAMPLE_VEHICLES[index].name, category: SAMPLE_VEHICLES[index].category,
    passenger_capacity: SAMPLE_VEHICLES[index].passenger_capacity,
  })).filter(assignment => !employeeId || assignment.employee_id === employeeId);
}
