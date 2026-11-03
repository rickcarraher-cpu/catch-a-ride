import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSampleFetch, WIZARD_KEY, initialWizardSamples } from '../app/preview/wizard-samples';
import { STORAGE_KEY, decodeWorkspace } from '../app/preview/workspace-model';
function storage() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) || null, setItem: (key: string, value: string) => { map.set(key, value); } }; }
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
test('original wizard samples never call real fetch, including blocked communications/payments', async () => {
  const old = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Unexpected real request'); };
  try {
    const api = createSampleFetch(storage());
    for (const path of ['/api/settings', '/api/vehicles', '/api/vehicles/categories', '/api/settings/preferred-locations']) assert.equal((await api(path)).status, 200);
    for (const path of ['/api/appointments/message-only', '/api/payments', '/api/recurring', '/api/appointments/distance', 'https://external.example']) assert.ok((await api(path, post({}))).status >= 400);
  } finally { globalThis.fetch = old; }
});
test('lookup, new sample client and original booking payload persist to browser workspace only', async () => {
  const store = storage(); const api = createSampleFetch(store);
  const lookup = await (await api('/api/appointments/lookup', post({ type: 'phone', value: '2025550100' }))).json();
  assert.equal(lookup.found, true); assert.equal(lookup.client.name, 'Sample Passenger');
  const client = await (await api('/api/clients', post({ name: 'Practice Rider', phone: '2025550101' }))).json();
  const result = await api('/api/appointments', post({ client_id: client.id, start_time: '2026-11-15T10:30:00-06:00', pickup_address: 'Sample Hotel', dropoff_address: 'Sample Airport', send_notification: true, payment_method: 'Credit Card', employee_id: 'sample-driver-2' }));
  assert.equal(result.status, 201);
  const booking = await result.json(); assert.equal(booking.send_notification, false); assert.equal(booking.payment_url, null);
  const state = decodeWorkspace(store.getItem(STORAGE_KEY)!);
  assert.equal(state.trips[1].passenger, 'Practice Rider'); assert.equal(state.trips[1].when, '2026-11-15T10:30'); assert.equal(state.trips[1].driverId, 'sample-driver-2');
  const clone = await (await api(`/api/appointments/lookup?booking_number=${booking.booking_number}`)).json();
  assert.equal(clone.id, booking.id);
  const reopened = createSampleFetch(store); assert.equal((await (await reopened('/api/clients')).json()).length, 2);
});
test('invalid booking and failed storage do not report a successful booking', async () => {
  const store = storage(); const api = createSampleFetch(store);
  assert.equal((await api('/api/appointments', post({}))).status, 400);
  assert.equal(store.getItem(STORAGE_KEY), null);
  const before = JSON.stringify(initialWizardSamples()); store.setItem(WIZARD_KEY, before);
  const failing = createSampleFetch({ getItem: store.getItem, setItem: (key, value) => { if (key === STORAGE_KEY) throw new Error('Storage full'); store.setItem(key, value); } });
  await assert.rejects(failing('/api/appointments', post({ client_id: 'sample-client-1', start_time: '2026-11-15T10:30:00-06:00' })), /Storage full/);
  assert.equal(store.getItem(WIZARD_KEY), before);
});

test('two sample vehicles match categories and assigned drivers without network', async () => {
  const store = storage(); const api = createSampleFetch(store);
  const vehicles = await (await api('/api/vehicles')).json();
  assert.deepEqual(vehicles.map((v: {name:string}) => v.name), ['Sample Sedan', 'Sample SUV']);
  const categories = await (await api('/api/vehicles/categories')).json();
  assert.deepEqual(categories.categories, ['Sedan', 'SUV']);
  for (const [driver, vehicle] of [['sample-driver-1',1],['sample-driver-2',2]] as const) {
    const assignments = await (await api(`/api/vehicle-assignments?employee_id=${driver}`)).json();
    assert.equal(assignments.length,1); assert.equal(assignments[0].vehicle_id,vehicle);
  }
  const payload = { client_id:'sample-client-1',start_time:'2026-11-15T10:30:00-06:00',employee_id:'sample-driver-2',vehicle_id:1 };
  assert.equal((await api('/api/appointments',post(payload))).status,400);
  const saved = await api('/api/appointments',post({...payload,vehicle_id:2}));
  assert.equal(saved.status,201); assert.equal((await saved.json()).vehicle_id,2);
});

import {readWizardList} from '../app/preview/read-list';
test('wizard list reads reject unsupported objects rather than poisoning shared cache',async()=>{
 await assert.rejects(readWizardList(Response.json({error:'Unsupported'},{status:501})));
 await assert.rejects(readWizardList(Response.json({error:'Wrong shape'})));
 assert.deepEqual(await readWizardList(Response.json([{id:1}])),[{id:1}]);
});

test('online passenger transport maps services and saves to protected test API; unknown services stay blocked',async()=>{
 const oldWindow=globalThis.window;const oldFetch=globalThis.fetch;const calls:string[]=[];
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{pathname:'/preview/online-book',origin:'https://preview.example'}}});
 globalThis.fetch=async(input)=>{calls.push(String(input));return Response.json([]);};
 try{
  const {sampleFetch}=await import('../app/preview/wizard-samples');
  await sampleFetch('/api/services');await sampleFetch('/api/appointments',{method:'POST',body:'{}'});
  assert.ok(calls[0].startsWith('/preview/database-api?resource=services'));
  assert.ok(calls[1].startsWith('/preview/database-api?resource=wizard-booking'));
  const blocked=await sampleFetch('/api/appointments/message-only',{method:'POST',body:'{}'});assert.equal(blocked.status,501);assert.equal(calls.length,2);
 }finally{globalThis.fetch=oldFetch;Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});}
});

import {editorFetch} from '../app/preview/editor-fetch';
test('editor routes TEST reads/updates to protected API and blocks payment/provider operations',async()=>{
 const oldWindow=globalThis.window,oldFetch=globalThis.fetch;const calls:string[]=[];
 Object.defineProperty(globalThis,'window',{configurable:true,value:{location:{pathname:'/preview/database-edit',origin:'https://preview.example',search:'?id=9'}}});
 globalThis.fetch=async(input)=>{calls.push(String(input));return Response.json([]);};
 try{await editorFetch('/api/appointments/9');await editorFetch('/api/appointments/9',{method:'PATCH',body:'{}'});
 assert.ok(calls[0].includes('resource=trip&id=9'));assert.ok(calls[1].includes('resource=trip-edit&id=9'));
 for(const path of ['/api/payments/square/checkout','/api/appointments/9/resend-driver-notification','https://external.example'])assert.equal((await editorFetch(path,{method:'POST',body:'{}'})).status,501);
 assert.equal(calls.length,2);
 }finally{globalThis.fetch=oldFetch;Object.defineProperty(globalThis,'window',{configurable:true,value:oldWindow});}
});
