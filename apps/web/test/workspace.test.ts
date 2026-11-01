import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleWorkspace, saveTrip, addDriver, removeDriver, decodeWorkspace, emptyTrip } from '../app/preview/workspace-model';
const trip = { ...emptyTrip, passenger: 'Test Rider', pickup: 'Test Hotel', dropoff: 'Test Station', when: '2026-12-01T10:30' };
test('create, assign, edit, cancel and complete sample bookings without mutating prior state', () => {
  const original = sampleWorkspace();
  let state = saveTrip(original, 'new-trip', trip);
  assert.equal(original.trips.length, 1); assert.equal(state.trips.length, 2);
  state = saveTrip(state, 'new-trip', { ...trip, driverId: state.drivers[1].id, pickup: 'Changed Hotel' });
  assert.equal(state.trips[1].pickup, 'Changed Hotel'); assert.equal(state.trips.length, 2);
  state = saveTrip(state, 'new-trip', { ...state.trips[1], status: 'cancelled' });
  assert.equal(state.trips[1].status, 'cancelled');
  state = saveTrip(state, 'new-trip', { ...state.trips[1], status: 'completed' });
  assert.equal(state.trips[1].status, 'completed');
});
test('driver assignment must exist; scheduled work blocks removal', () => {
  const state = sampleWorkspace();
  assert.throws(() => saveTrip(state, 'bad', { ...trip, driverId: 'forged' }));
  assert.throws(() => removeDriver(state, 'sample-driver-1'), /Reassign/);
  let next = saveTrip(state, 'sample-trip-1', { ...state.trips[0], status: 'cancelled' });
  next = removeDriver(next, 'sample-driver-1'); assert.equal(next.trips[0].driverId, '');
  next = addDriver(next, 'new-driver', 'Practice Driver'); assert.equal(next.drivers.length, 2);
  assert.throws(() => addDriver(next, 'another', ' practice driver '), /already exists/);
});
test('reject invalid input and corrupted browser data', () => {
  const state = sampleWorkspace();
  for (const invalid of [{ passenger: '' }, { pickup: 'x'.repeat(201) }, { when: 'not a date' }, { when: '2026-02-31T10:30' }, { status: 'unknown' }]) {
    assert.throws(() => saveTrip(state, 'bad', { ...trip, ...invalid } as typeof trip));
  }
  for (const raw of ['not JSON', '{}', '{"version":2,"trips":[],"drivers":[]}']) assert.throws(() => decodeWorkspace(raw));
  assert.throws(() => decodeWorkspace(JSON.stringify({ ...state, drivers: [] })));
  assert.throws(() => decodeWorkspace(JSON.stringify({ ...state, trips: [state.trips[0], state.trips[0]] })));
});
test('browser serialization preserves sample data and strips unknown fields', () => {
  const state = sampleWorkspace();
  assert.deepEqual(decodeWorkspace(JSON.stringify(state)), state);
  assert.deepEqual(decodeWorkspace(JSON.stringify({ ...state, secret: 'ignored' })), state);
  assert.notEqual(sampleWorkspace(), sampleWorkspace());
});
