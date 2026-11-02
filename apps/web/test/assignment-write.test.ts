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
