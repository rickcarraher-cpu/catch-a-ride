import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';
import {createTestPassenger} from '../app/lib/passenger-write.server';import {saveWizardBooking} from '../app/lib/wizard-database.server';import {readStaffDashboard,readStaffTimeline} from '../app/lib/staff-reads.server';import {readEditableTrip,updateTestTrip} from '../app/lib/trip-edit.server';import {assignDatabaseTrip} from '../app/lib/assignment-write.server';
const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
test('database workflow: passenger -> online request -> review -> edit -> assign -> reload -> unassign',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{
 const text=['status','booked_by','booker_name','notes','driver_notes','destination','pickup_address','pickup_street','pickup_city','pickup_state','pickup_zip','dropoff_address','dropoff_street','dropoff_city','dropoff_state','dropoff_zip','outgoing_flight_info','returning_flight_info','vehicle_category','payment_method','distance_method','tentative_reason','booking_number','gift_certificate','payment_status','customs_clearance_location','requested_driver_name'];
 const ints=['client_id','employee_id','vehicle_id','num_people','num_bags_checked','num_bags_carry_on','num_car_seats','num_golf_bags','wedding_id'];
 await pg.exec(`CREATE TABLE appointments(id serial PRIMARY KEY,tenant_id int,start_time timestamptz,return_date timestamptz,created_at timestamptz DEFAULT now(),is_tentative bool,is_international_flight bool,needs_receipt bool,distance_miles numeric,services_total numeric,balance_due numeric,payments_total numeric DEFAULT 0,original_amount numeric,${text.map(k=>k+' text')},${ints.map(k=>k+' int')});
 CREATE TABLE clients(id serial PRIMARY KEY,tenant_id int,name text,email text,phone text,notes text,street_address text,city text,state text,zip_code text,referral_source text,address text,cc_emails text,notification_preference text);
 CREATE TABLE employees(id int,tenant_id int,name text,color text,is_active bool);INSERT INTO employees VALUES(51,1,'Test Driver','blue',true),(52,2,'Other','red',true);
 CREATE TABLE services(id int,tenant_id int,name text,is_active bool,duration_minutes int);INSERT INTO services VALUES(1,1,'Test service',true,75);
 CREATE TABLE appointment_services(id serial,appointment_id int,service_id int,service_price numeric,duration_minutes int,quantity int,stop_description text);
 CREATE TABLE settings(id serial,tenant_id int,key text,value text);`);
 await pg.exec('BEGIN');const person=await createTestPassenger(db,staff,{name:'Workflow Test',email:'workflow@example.test'});await pg.exec('COMMIT');
 await pg.exec('BEGIN');const saved=await saveWizardBooking(db,staff,{client_id:person.id,start_time:'2026-11-10T08:50:00-06:00',pickup_address:'Test A',dropoff_address:'Test B',destination:'Test destination',distance_miles:28.5,status:'needs_review',payment_method:'Cash',send_notification:false,services:[{service_id:1,service_price:84,quantity:1}],is_tour:false,tour_payment_split:'single',tour_participants:[],tour_itinerary:[]});await pg.exec('COMMIT');
 let queue=await readStaffDashboard(db,staff,1,'',true,'needs_review');assert.equal(queue.trips.length,1);assert.equal(Number(queue.trips[0].balance_due),84);assert.equal(Number(queue.trips[0].distance_miles),28.5);
 await pg.exec('BEGIN');await updateTestTrip(db,staff,saved.id,{notes:'Edited TEST ONLY',send_notification:false});await pg.exec('COMMIT');
 const reread=await readEditableTrip(db,staff,saved.id);assert.equal(reread.notes,'Edited TEST ONLY');assert.equal(reread.services.length,1);
 await assignDatabaseTrip(db,staff,saved.id,{employee_id:51},true);let timeline=await readStaffTimeline(db,staff,'2026-11-10');assert.equal(timeline.trips[0].employee_id,51);
 assert.equal(new Date(timeline.trips[0].start_time).toISOString(),'2026-11-10T14:50:00.000Z');
 await assignDatabaseTrip(db,staff,saved.id,{employee_id:null},true);timeline=await readStaffTimeline(db,staff,'2026-11-10');assert.equal(timeline.trips[0].employee_id,null);
 queue=await readStaffDashboard(db,staff,1,'TEST-',true,'needs_review');assert.equal(queue.trips.length,1);assert.equal(Number(queue.trips[0].balance_due),84);
 }finally{await pg.close();}
});
