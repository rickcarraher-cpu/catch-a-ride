import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';
import {createDatabaseBooking,saveBusinessSetting} from '../app/lib/business-write.server';
const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
test('booking creation uses real SQL, preserves tenant, validates ownership and blocks service payloads',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{
 await pg.exec(`CREATE TABLE clients(id int,tenant_id int);CREATE TABLE employees(id int,tenant_id int,is_active bool);CREATE TABLE appointments(id serial,tenant_id int,client_id int,employee_id int,start_time timestamptz,status text,pickup_address text,dropoff_address text,notes text,num_people int,vehicle_category text,booked_by text);INSERT INTO clients VALUES(1,1),(2,2);INSERT INTO employees VALUES(3,1,true),(4,2,true);`);
 const body={client_id:1,employee_id:3,start_time:'2026-11-10T09:00:00-06:00',pickup_address:'Test A',dropoff_address:'Test B'};
 await pg.exec('BEGIN');const result=await createDatabaseBooking(db,staff,body);await pg.exec('COMMIT');assert.ok(result.id);
 const rows=await pg.query<{tenant_id:number,status:string}>('SELECT tenant_id,status FROM appointments');assert.equal(rows.rows[0].tenant_id,1);assert.equal(rows.rows[0].status,'pending');
 for(const bad of [{...body,client_id:2},{...body,employee_id:4},{...body,send_notification:true},{...body,start_time:'2026-11-10T09:00'}])await assert.rejects(createDatabaseBooking(db,staff,bad));
 await assert.rejects(createDatabaseBooking(db,{...staff,employeeId:0},body));
 assert.equal((await pg.query('SELECT * FROM appointments')).rows.length,1);
 }finally{await pg.close();}
});
test('settings need admin and reject sensitive or invalid values before database access',async()=>{
 let calls=0;const db={query:async()=>{calls++;return {rowCount:0,rows:[]};}} as unknown as Pick<Pool,'query'>;
 for(const body of [{key:'square_access_token',value:'private'},{key:'send_emails',value:'yes'},{key:'rate_per_mile',value:'NaN'},{key:'business_hours_start',value:'25:00'}])await assert.rejects(saveBusinessSetting(db,staff,body));
 await assert.rejects(saveBusinessSetting(db,{...staff,isAdmin:false},{key:'business_name',value:'Test'}));assert.equal(calls,0);
 await saveBusinessSetting(db,staff,{key:'business_name',value:'Test'});assert.equal(calls,3);
});
