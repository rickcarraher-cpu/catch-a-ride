import {test} from 'node:test';import assert from 'node:assert/strict';import type {Pool} from 'pg';import {updateTestTrip} from '../app/lib/trip-edit.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('TEST editor scopes reads/writes and preserves time and services',async()=>{
 const calls:{sql:string,args:unknown[]}[]=[];const original={id:1,client_id:2,start_time:'2026-11-10T15:00Z',status:'pending',notes:'old'};
 const db={query:async(sql:string,args:unknown[])=>{calls.push({sql,args});return {rowCount:1,rows:sql.includes('FROM appointment_services')?[]:[original]};}} as unknown as Pick<Pool,'query'>;
 await updateTestTrip(db,staff,1,{notes:'new',client_id:2,start_time:'2026-11-10T15:00:00Z',send_notification:false,services:[]});
 const update=calls.find(c=>c.sql.startsWith('UPDATE'));assert.ok(update);assert.match(update.sql,/booking_number LIKE 'TEST-%'/);assert.doesNotMatch(update.sql,/SET.*start_time|SET.*services_total/);assert.equal(update.args[2],'new');
 await assert.rejects(updateTestTrip(db,staff,1,{start_time:'2026-11-10T16:00',notes:'bad'}));
 await assert.rejects(updateTestTrip(db,staff,1,{notes:'bad',send_notification:true}));
});

import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';import {readEditableTrip} from '../app/lib/trip-edit.server';
test('TEST vehicle preference and specific vehicle edits persist without changing time, driver, service prices or balance',async()=>{
 const pg=new PGlite();const db={query:async(sql:string,args?:unknown[])=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows};}} as unknown as Pick<Pool,'query'>;
 try{
 for(const file of ['management','schedule'])await pg.exec(readFileSync(new URL(`./fixtures/${file}-schema.sql`,import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO clients(id,tenant_id,name) VALUES(1,1,'TEST'),(2,2,'FOREIGN');INSERT INTO employees(id,tenant_id,name,is_active) VALUES(1,1,'Driver A',true),(2,1,'Driver B',true),(3,2,'Foreign',true);INSERT INTO vehicles(id,employee_id,name,category,is_active) VALUES(1,1,'Test Sedan','Sedan',true),(2,1,'Test SUV','SUV',true),(3,2,'Other driver','SUV',true),(4,3,'Foreign','SUV',true);INSERT INTO vehicle_assignments(vehicle_id,employee_id) VALUES(1,1),(2,1),(3,2),(4,3);INSERT INTO services(id,tenant_id,name,is_active,duration_minutes) VALUES(1,1,'TEST SERVICE',true,75);INSERT INTO appointments(id,tenant_id,client_id,employee_id,vehicle_id,vehicle_category,start_time,status,booking_number,services_total,balance_due) VALUES(1,1,1,1,1,'Sedan','2026-11-10T15:00:00Z','pending','TEST-1',169,169),(2,1,1,1,1,'Sedan','2026-11-10T15:00:00Z','pending','LIVE-2',200,200),(3,2,2,3,4,'SUV','2026-11-10T15:00:00Z','pending','TEST-3',999,999);INSERT INTO appointment_services(appointment_id,service_id,service_price,duration_minutes,quantity) VALUES(1,1,169,75,1);`);
 await pg.exec('BEGIN');await updateTestTrip(db,staff,1,{vehicle_category:'SUV',vehicle_id:'2',send_notification:false});await pg.exec('COMMIT');
 let trip=await readEditableTrip(db,staff,1);assert.equal(trip.vehicle_id,2);assert.equal(trip.vehicle_category,'SUV');assert.equal(trip.employee_id,1);assert.equal(new Date(trip.start_time).toISOString(),'2026-11-10T15:00:00.000Z');assert.equal(Number(trip.services[0].service_price),169);assert.equal(Number((await pg.query<{balance_due:string}>('SELECT balance_due FROM appointments WHERE id=1')).rows[0].balance_due),169);
 for(const bad of [{vehicle_id:4},{vehicle_id:3},{vehicle_id:'bad'},{vehicle_category:'not configured'},{vehicle_id:2,employee_id:2},{vehicle_id:2,send_notification:true}]){await pg.exec('BEGIN');await assert.rejects(updateTestTrip(db,staff,1,bad));await pg.exec('ROLLBACK');}
 await pg.exec('BEGIN');await assert.rejects(updateTestTrip(db,staff,2,{vehicle_category:'SUV'}));await pg.exec('ROLLBACK');await pg.exec('BEGIN');await assert.rejects(updateTestTrip(db,staff,3,{vehicle_category:'Sedan'}));await pg.exec('ROLLBACK');
 await updateTestTrip(db,staff,1,{vehicle_id:'',vehicle_category:'Sedan',send_notification:false});trip=await readEditableTrip(db,staff,1);assert.equal(trip.vehicle_id,null);assert.equal(trip.vehicle_category,'Sedan');
 }finally{await pg.close();}
});

test('TEST rescheduling and driver changes preserve totals and clear stale date labels',async()=>{
 const pg=new PGlite();const db={query:async(sql:string,args?:unknown[])=>{const r=await pg.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows};}} as unknown as Pick<Pool,'query'>;
 try{for(const file of ['management','schedule'])await pg.exec(readFileSync(new URL(`./fixtures/${file}-schema.sql`,import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO employees(id,tenant_id,name,is_active) VALUES(1,1,'A',true),(2,1,'B',true),(3,2,'FOREIGN',true),(4,1,'Inactive',false);INSERT INTO vehicles(id,employee_id,name,is_active) VALUES(1,1,'A VEHICLE',true),(2,2,'B VEHICLE',true);INSERT INTO appointments(id,tenant_id,start_time,booking_number,employee_id,vehicle_id,services_total,balance_due,display_short_date,display_time) VALUES(1,1,'2026-11-10T15:00:00Z','TEST-1',1,1,169,169,'STALE DATE','STALE TIME');`);
 const run=async(body:unknown)=>{await pg.exec('BEGIN');try{await updateTestTrip(db,staff,1,body);await pg.exec('COMMIT');}catch(e){await pg.exec('ROLLBACK');throw e;}};
 await assert.rejects(run({start_time:'2026-02-30T09:00:00-06:00'}));await assert.rejects(run({employee_id:2}));await assert.rejects(run({employee_id:3,vehicle_id:null}));await assert.rejects(run({employee_id:4,vehicle_id:null}));
 await run({employee_id:2,vehicle_id:2,start_time:'2026-11-11T09:30:00-06:00'});
 const r=(await pg.query<{employee_id:number;vehicle_id:number;start_time:Date;services_total:string;balance_due:string;display_short_date:string|null;display_time:string|null}>('SELECT employee_id,vehicle_id,start_time,services_total,balance_due,display_short_date,display_time FROM appointments WHERE id=1')).rows[0];assert.equal(r.employee_id,2);assert.equal(r.vehicle_id,2);assert.equal(new Date(r.start_time).toISOString(),'2026-11-11T15:30:00.000Z');assert.equal(r.display_short_date,null);assert.equal(r.display_time,null);assert.equal(Number(r.services_total),169);assert.equal(Number(r.balance_due),169);
 await run({employee_id:'',vehicle_id:''});assert.equal((await readEditableTrip(db,staff,1)).employee_id,null);
 }finally{await pg.close();}
});
