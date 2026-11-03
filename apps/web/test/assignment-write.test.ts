import {test} from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';
import {assignDatabaseTrip} from '../app/lib/assignment-write.server';
const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
test('assignment and unassignment bind tenant without changing time or sending',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rowCount:1,rows:[{id:9,start_time:'unchanged'}]};}} as unknown as Pick<Pool,'query'>;
 for(const driver of [3,null])await assignDatabaseTrip(db,staff,9,{employee_id:driver,send_notification:true});
 for(const call of calls){assert.equal(call.args[1],1);assert.doesNotMatch(call.sql,/SET.*start_time|send_notification|payments/);assert.match(call.sql,/e.tenant_id=\$2/);}
 assert.equal(calls[1].args[2],null);
});
test('temporary review, invalid inputs, time moves and cross-tenant misses fail closed',async()=>{
 let called=false;const db={query:async()=>{called=true;return {rowCount:0,rows:[]};}} as unknown as Pick<Pool,'query'>;
 await assert.rejects(assignDatabaseTrip(db,{...staff,employeeId:0},9,{employee_id:3}));assert.equal(called,false);
 for(const body of [{},{employee_id:'3'},{employee_id:3,start_time:'changed'}])await assert.rejects(assignDatabaseTrip(db,staff,9,body));assert.equal(called,false);
 await assert.rejects(assignDatabaseTrip(db,staff,9,{employee_id:3}),(e:unknown)=>e instanceof Response&&e.status===404);
});

import {PGlite} from '@electric-sql/pglite';
test('temporary assignment changes only TEST bookings in same tenant and preserves time',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(`CREATE TABLE appointments(id int,tenant_id int,employee_id int,start_time timestamptz,booking_number text);CREATE TABLE employees(id int,tenant_id int,is_active bool);INSERT INTO employees VALUES(3,1,true),(4,2,true);INSERT INTO appointments VALUES(1,1,null,'2026-11-10T15:00Z','TEST-1'),(2,1,null,'2026-11-10T15:00Z','LIVE-2'),(3,2,null,'2026-11-10T15:00Z','TEST-3');`);
 await assignDatabaseTrip(db,staff,1,{employee_id:3},true);
 for(const id of [2,3])await assert.rejects(assignDatabaseTrip(db,staff,id,{employee_id:3},true));
 await assert.rejects(assignDatabaseTrip(db,staff,1,{employee_id:4},true));
 await assignDatabaseTrip(db,staff,1,{employee_id:null},true);
 const r=await pg.query<{employee_id:number|null,start_time:Date}>('SELECT employee_id,start_time FROM appointments WHERE id=1');assert.equal(r.rows[0].employee_id,null);assert.equal(new Date(r.rows[0].start_time).toISOString(),'2026-11-10T15:00:00.000Z');
 }finally{await pg.close();}
});
