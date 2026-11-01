import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOperationsFetch, sampleSettings, chicagoSampleTimestamp } from '../app/preview/operations-samples';
import { STORAGE_KEY, sampleWorkspace, decodeWorkspace } from '../app/preview/workspace-model';
function store() { const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);}}; }
const post=(body:unknown)=>({method:'POST',body:JSON.stringify(body)});
test('ordinary settings persist; credentials/auth bypass/integration calls fail closed without network',async()=>{
 const storage=store(),api=createOperationsFetch(storage),old=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('Unexpected real network');};
 try {
  assert.equal((await api('/api/settings',post({key:'business_name',value:'Sample Test Company'}))).status,200);
  assert.equal(sampleSettings(storage).business_name,'Sample Test Company');
  assert.equal((await api('/api/settings',post({key:'business_hours_start',value:'30:99'}))).status,400);
  for(const key of ['bypass_dashboard_login','clicksend_api_key','resend_key']) assert.equal((await api('/api/settings',post({key,value:'NEVER_SAVE'}))).status,403);
  for(const path of ['/api/data/backup','/api/schedule-timeline/notify-send','/api/test-email','/api/cleanup']) assert.equal((await api(path,post({}))).status,501);
 } finally {globalThis.fetch=old;}
});
test('timeline assignment persists and reloads, rejects nonexistent driver, allows unassignment',async()=>{
 const storage=store(),api=createOperationsFetch(storage);
 storage.setItem(STORAGE_KEY,JSON.stringify(sampleWorkspace()));
 let data=await (await api('/api/schedule-timeline?date=2026-11-10')).json();
 assert.equal(data.trips[0].employee_id,1);assert.equal(data.drivers.length,2);
 const patch=(id:number|null)=>({method:'PATCH',body:JSON.stringify({employee_id:id,send_notification:true})});
 assert.equal((await api('/api/appointments/sample-trip-1',patch(2))).status,200);
 data=await (await createOperationsFetch(storage)('/api/schedule-timeline?date=2026-11-10')).json();assert.equal(data.trips[0].employee_id,2);
 assert.equal((await api('/api/appointments/sample-trip-1',patch(99))).status,400);
 await api('/api/appointments/sample-trip-1',patch(null));assert.equal(decodeWorkspace(storage.getItem(STORAGE_KEY)!).trips[0].driverId,'');
 const result=await api('/api/appointments/sample-trip-1',{method:'PATCH',body:JSON.stringify({employee_id:1,start_time:'2026-11-10T16:30:00Z'})});
 assert.equal(result.status,200);assert.equal(decodeWorkspace(storage.getItem(STORAGE_KEY)!).trips[0].when,'2026-11-10T10:30');
});

test('timeline fixture uses Chicago DST instead of month approximations',()=>{
 assert.equal(chicagoSampleTimestamp('2026-11-01T10:00'),'2026-11-01T10:00:00-06:00');
 assert.equal(chicagoSampleTimestamp('2026-10-31T10:00'),'2026-10-31T10:00:00-05:00');
});
