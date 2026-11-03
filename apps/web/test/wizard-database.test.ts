import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';
import {saveWizardBooking,readWizardData} from '../app/lib/wizard-database.server';
const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
test('service lines and totals persist atomically and use tenant-specific services',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(`CREATE TABLE clients(id int,tenant_id int);CREATE TABLE employees(id int,tenant_id int,is_active bool);CREATE TABLE services(id int,tenant_id int,is_active bool,duration_minutes int);CREATE TABLE appointments(id serial,tenant_id int,client_id int,employee_id int,start_time timestamptz,status text,pickup_address text,dropoff_address text,notes text,num_people int,vehicle_category text,booked_by text,services_total numeric,balance_due numeric,booking_number text,payment_status text,payment_method text,destination text);CREATE TABLE appointment_services(appointment_id int,service_id int,service_price numeric,duration_minutes int,quantity int);INSERT INTO clients VALUES(1,1);INSERT INTO services VALUES(1,1,true,75),(2,2,true,60);`);
 const body={client_id:1,start_time:'2026-11-10T09:00:00-06:00',pickup_address:'A',dropoff_address:'B',services:[{service_id:1,service_price:12.34,quantity:2}],send_notification:false,payment_method:'Cash',destination:'Test airport terminal'};
 await pg.exec('BEGIN');await saveWizardBooking(db,staff,body);await pg.exec('COMMIT');
 const totals=await pg.query<{services_total:string}>('SELECT services_total,payment_method,payment_status,destination FROM appointments');assert.equal(Number(totals.rows[0].services_total),24.68);assert.equal((totals.rows[0] as unknown as {payment_method:string}).payment_method,'Cash');assert.equal((totals.rows[0] as unknown as {destination:string}).destination,'Test airport terminal');assert.equal((await pg.query('SELECT * FROM appointment_services')).rows.length,1);
 await pg.exec('BEGIN');await assert.rejects(saveWizardBooking(db,staff,{...body,services:[{service_id:2,service_price:1,quantity:1}]}));await pg.exec('ROLLBACK');assert.equal((await pg.query('SELECT * FROM appointments')).rows.length,1);
 for(const changed of [{send_notification:true},{is_tour:true},{vehicle_id:1},{driver_notes:'Do not discard'}])await assert.rejects(saveWizardBooking(db,staff,{...body,...changed}));
 }finally{await pg.close();}
});
test('wizard reads bind tenant, restrict vehicle ownership, and do not list all passengers on empty search',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rows:[]};}} as unknown as Pick<Pool,'query'>;
 assert.deepEqual(await readWizardData(db,staff,'clients',''),[]);assert.equal(calls.length,0);
 for(const type of ['vehicles','services','drivers','clients'])await readWizardData(db,staff,type,'ab');
 for(const c of calls){assert.equal(c.args[0],1);assert.doesNotMatch(c.sql,/SELECT \*|password|token|UPDATE|INSERT/);}
 assert.match(calls[0].sql,/IS DISTINCT FROM \$1/);
});

test('unsupported booking options explain the specific blocker without database access',async()=>{
 const db={query:async()=>{throw new Error('Must not query');}} as unknown as Pick<Pool,'query'>;
 for(const [field,value,expected] of [['vehicle_id',1,'Specific vehicle'],['payment_method','Unknown Payment','Unsupported payment'],['send_notification',true,'Save Without Sending'],['_is_round_trip',true,'Round-trip']] as const){
  try{await saveWizardBooking(db,staff,{[field]:value});assert.fail('Expected rejection');}catch(error){assert.ok(error instanceof Response);assert.ok((await error.text()).includes(expected));}
 }
});
