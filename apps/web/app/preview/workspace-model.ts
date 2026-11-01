export const STORAGE_KEY = 'catcharide-isolated-workspace-v1';
export type Driver = { id: string; name: string };
export type Trip = { id: string; passenger: string; pickup: string; dropoff: string; when: string; driverId: string; status: 'scheduled' | 'completed' | 'cancelled' };
export type Workspace = { version: 1; drivers: Driver[]; trips: Trip[] };
export const emptyTrip = { passenger: '', pickup: '', dropoff: '', when: '', driverId: '', status: 'scheduled' as const };
export function sampleWorkspace(): Workspace {
  return { version: 1, drivers: [{ id: 'sample-driver-1', name: 'Sample Driver A' }, { id: 'sample-driver-2', name: 'Sample Driver B' }], trips: [
    { id: 'sample-trip-1', passenger: 'Sample Passenger', pickup: 'Sample Hotel', dropoff: 'Sample Airport', when: '2026-11-10T09:00', driverId: 'sample-driver-1', status: 'scheduled' },
  ] };
}
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function validateTrip(trip: Omit<Trip, 'id'>, drivers: Driver[]) {
  if (!text(trip.passenger, 100) || !text(trip.pickup, 200) || !text(trip.dropoff, 200)) throw new Error('Enter passenger, pickup and destination within the field limits.');
  const date = new Date(`${trip.when}:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trip.when) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 16) !== trip.when) throw new Error('Choose a valid pickup date and time.');
  if (trip.driverId !== '' && !drivers.some(d => d.id === trip.driverId)) throw new Error('Choose an available sample driver.');
  if (!['scheduled', 'completed', 'cancelled'].includes(trip.status)) throw new Error('Choose a valid trip status.');
}
export function saveTrip(state: Workspace, id: string, trip: Omit<Trip, 'id'>): Workspace {
  validateTrip(trip, state.drivers);
  const clean = { ...trip, id, passenger: trip.passenger.trim(), pickup: trip.pickup.trim(), dropoff: trip.dropoff.trim() };
  const exists = state.trips.some(t => t.id === id);
  if (!exists && state.trips.length >= 200) throw new Error('Test workspace limit reached. Reset sample data to start again.');
  return { ...state, trips: exists ? state.trips.map(t => t.id === id ? clean : t) : [...state.trips, clean] };
}
export function addDriver(state: Workspace, id: string, name: string): Workspace {
  const clean = name.trim();
  if (!text(clean, 80)) throw new Error('Enter a sample driver name (1–80 characters).');
  if (state.drivers.length >= 50) throw new Error('Test driver limit reached.');
  if (state.drivers.some(d => d.name.toLowerCase() === clean.toLowerCase())) throw new Error('That sample driver already exists.');
  return { ...state, drivers: [...state.drivers, { id, name: clean }] };
}
export function removeDriver(state: Workspace, id: string): Workspace {
  if (state.trips.some(t => t.driverId === id && t.status === 'scheduled')) throw new Error('Reassign scheduled trips before removing this driver.');
  return { ...state, drivers: state.drivers.filter(d => d.id !== id), trips: state.trips.map(t => t.driverId === id ? { ...t, driverId: '' } : t) };
}
export function decodeWorkspace(raw: string): Workspace {
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.drivers) || !Array.isArray(value.trips) || value.drivers.length > 50 || value.trips.length > 200) throw new Error('Invalid test workspace.');
  const drivers: Driver[] = value.drivers.map((d: Driver) => {
    if (!d || !text(d.id, 100) || !text(d.name, 80)) throw new Error('Invalid sample driver.');
    return { id: d.id, name: d.name };
  });
  if (new Set(drivers.map(d => d.id)).size !== drivers.length) throw new Error('Duplicate test driver.');
  const trips: Trip[] = value.trips.map((t: Trip) => {
    if (!t || !text(t.id, 100)) throw new Error('Invalid sample trip.');
    validateTrip(t, drivers);
    return { id: t.id, passenger: t.passenger, pickup: t.pickup, dropoff: t.dropoff, when: t.when, driverId: t.driverId, status: t.status };
  });
  if (new Set(trips.map(t => t.id)).size !== trips.length) throw new Error('Duplicate test trip.');
  return { version: 1, drivers, trips };
}
