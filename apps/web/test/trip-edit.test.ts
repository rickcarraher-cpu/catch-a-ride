import {test} from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';import {updateTestTrip} from '../app/lib/trip-edit.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('TEST editor scopes reads/writes and preserves time and services',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];const original={id:1,client_id:2,start_time:'2026-11-10T15:00Z',status:'pending',notes:'old'};
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rowCount:1,rows:sql.includes('FROM appointment_services')?[]:[original]};}} as unknown as Pick<Pool,'query'>;
 await updateTestTrip(db,staff,1,{notes:'new',client_id:2,start_time:'2026-11-10T15:00:00Z',send_notification:false,services:[]});
 const update=calls.find(c=>c.sql.startsWith('UPDATE'));assert.ok(update);assert.match(update.sql,/booking_number LIKE 'TEST-%'/);assert.doesNotMatch(update.sql,/SET.*start_time|SET.*services_total/);assert.equal(update.args[2],'new');
 await assert.rejects(updateTestTrip(db,staff,1,{start_time:'2026-11-10T16:00Z',notes:'bad'}));
 await assert.rejects(updateTestTrip(db,staff,1,{notes:'bad',send_notification:true}));
});
