import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {resolveStaff,readStaffDashboard,BUSINESS_SETTINGS,readStaffTimeline} from '../app/lib/staff-reads.server';
const user={id:'1',email:'staff@example.test',name:'Staff'};
const dbFor=(rows:unknown[])=>({query:async()=>({rows})}) as unknown as Pick<Pool,'query'>;
test('explicit admin/dispatcher membership does not require active driver flag',async()=>{
 const staff=await resolveStaff(dbFor([{id:51,tenant_id:1,is_admin:true,is_dispatcher:true,is_active:false}]),user);
 assert.equal(staff.tenantId,1);assert.equal(staff.employeeId,51);
});
test('missing, ambiguous, driver-only and invalid tenant fail closed',async()=>{
 for(const rows of [[],[{id:1,tenant_id:1,is_admin:false,is_dispatcher:false}],[{id:1,tenant_id:null,is_admin:true}],[{id:1,tenant_id:1,is_admin:true},{id:2,tenant_id:2,is_admin:true}]]) await assert.rejects(resolveStaff(dbFor(rows),user),(e:unknown)=>e instanceof Response&&e.status===403);
 await assert.rejects(resolveStaff(dbFor([]),null),(e:unknown)=>e instanceof Response&&e.status===401);
});
test('all reads scope tenant and paginate; safe setting allowlist excludes credentials',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:sql.includes('FROM appointments')?Array.from({length:51},(_,id)=>({id})):[{key:'business_name',value:'Test'},{key:'square_access_token',value:'PRIVATE'}]};}} as unknown as Pick<Pool,'query'>;
 const staff={employeeId:51,tenantId:2,isAdmin:true,isDispatcher:false};
 const data=await readStaffDashboard(db,staff,2);
 assert.equal(data.trips.length,50);assert.equal(data.hasMore,true);assert.deepEqual(data.settings,{business_name:'Test'});
 for(const call of calls){assert.equal(call.args[0],2);assert.match(call.sql,/tenant_id = \$1/);assert.doesNotMatch(call.sql,/SELECT \*|UPDATE|INSERT|DELETE/);}
 assert.equal(calls[0].args[1],50);assert.match(calls[0].sql,/c.tenant_id = a.tenant_id/);assert.match(calls[0].sql,/e.tenant_id = a.tenant_id/);
 assert.ok(!BUSINESS_SETTINGS.includes('bypass_dashboard_login'));await assert.rejects(readStaffDashboard(db,staff,0));
});

test('database timeline scopes tenant and Chicago date, rejects bad dates and excessive results',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:[]};}} as unknown as Pick<Pool,'query'>;
 const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
 await readStaffTimeline(db,staff,'2026-11-02');
 assert.equal(calls.length,2);for(const c of calls){assert.equal(c.args[0],1);assert.doesNotMatch(c.sql,/SELECT \*|UPDATE|DELETE|INSERT/);}
 assert.match(calls[1].sql,/America\/Chicago/);assert.equal(calls[1].args[1],'2026-11-02');
 await assert.rejects(readStaffTimeline(db,staff,'2026-02-31'));
});

test('review orders filter is validated and tenant bound',async()=>{
 const calls:unknown[][]=[];const db={query:async(sql:string,args:unknown[])=>{calls.push(args);return {rows:[]};}} as unknown as Pick<Pool,'query'>;
 const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
 await readStaffDashboard(db,staff,1,'',false,'needs_review');assert.equal(calls[0][0],1);assert.equal(calls[0][4],'needs_review');
 await assert.rejects(readStaffDashboard(db,staff,1,'',false,'invalid'));
});
