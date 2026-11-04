import {test} from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';import {readManagement} from '../app/lib/management-read.server';
test('management resources bind tenant, omit credential columns and cap passenger pages',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:[]};}} as unknown as Pick<Pool,'query'>;
 const staff={employeeId:51,tenantId:2,isAdmin:true,isDispatcher:true};
 for(const resource of ['drivers','passengers','services','vehicles','vehicle-assignments'])await readManagement(db,staff,resource,2);
 for(const c of calls){assert.equal(c.args[0],2);assert.doesNotMatch(c.sql,/SELECT \*|password|reset_token|access_token|DELETE|UPDATE|INSERT/);}
 assert.equal(calls[1].args[1],200);assert.match(calls[3].sql,/IS DISTINCT FROM \$1/); // placeholder corrected below
 await assert.rejects(readManagement(db,staff,'passengers',0));await assert.rejects(readManagement(db,staff,'unknown'));
});
