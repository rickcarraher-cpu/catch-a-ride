import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';import {readDailySchedule,validateScheduleDay} from '../app/lib/schedule-read.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('daily and print shared reads respect 25-hour fall DST day and stored trip values',async()=>{
 const pg=new PGlite();const db={query:(sql:string,args?:unknown[])=>pg.query(sql,args)} as unknown as Pick<Pool,'query'>;
 try{
 await pg.exec(readFileSync(new URL('./fixtures/management-schema.sql',import.meta.url),'utf8'));await pg.exec(readFileSync(new URL('./fixtures/schedule-schema.sql',import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO employees(id,tenant_id,name,is_active) VALUES(1,1,'Local driver',false),(2,2,'Foreign driver',true);
 INSERT INTO clients(id,tenant_id,name,phone) VALUES(1,1,'Local passenger','TEST'),(2,2,'Foreign passenger','NEVER');
 INSERT INTO vehicles(id,employee_id,name) VALUES(1,1,'Local vehicle'),(2,2,'Foreign vehicle');
 INSERT INTO services(id,tenant_id,name) VALUES(1,1,'Local service'),(2,2,'Foreign service');
 INSERT INTO settings(tenant_id,key,value) VALUES(1,'business_name','TEST COMPANY'),(2,'business_name','FOREIGN COMPANY'),(1,'square_access_token','MUST NOT RETURN');`);
 const times=['2026-11-01T04:59:59Z','2026-11-01T05:00:00Z','2026-11-02T05:59:59Z','2026-11-02T06:00:00Z'];
 for(let i=0;i<times.length;i++)await db.query(`INSERT INTO appointments(id,tenant_id,client_id,employee_id,vehicle_id,start_time,status,booking_number,balance_due,services_total,distance_miles,driver_confirmation_token) VALUES ($1,1,1,1,1,$2,'pending',$3,123.45,150,42.5,'NEVER EXPOSE')`,[i+1,times[i],'TEST-'+(i+1)]);
 await pg.exec(`INSERT INTO appointments(id,tenant_id,client_id,employee_id,vehicle_id,start_time,status) VALUES(10,2,2,2,2,'2026-11-01T12:00:00Z','pending'),(11,1,2,2,2,'2026-11-01T12:00:00Z','pending'),(12,1,1,1,1,'2026-11-01T12:00:00Z','cancelled');
 INSERT INTO appointment_services(appointment_id,service_id,service_price,duration_minutes,quantity) VALUES(2,1,150,75,1),(2,2,999,75,1);
 INSERT INTO blocked_times(employee_id,start_time,end_time,reason,is_deleted) VALUES(1,'2026-11-01T04:00:00Z','2026-11-01T06:00:00Z','LOCAL',false),(2,'2026-11-01T05:00:00Z','2026-11-02T00:00:00Z','FOREIGN',false);`);
 const result=await readDailySchedule(db,staff,'2026-11-01');assert.deepEqual(result.trips.map(t=>t.id),[2,11,3]);assert.equal(Number(result.trips[0].balance_due),123.45);assert.equal(Number(result.trips[0].distance_miles),42.5);assert.equal(result.trips[0].services.length,1);assert.equal(Number(result.trips[0].services[0].service_price),150);
 const badRelation=result.trips.find(t=>t.id===11);assert.equal(badRelation.client_name,null);assert.equal(badRelation.employee_name,null);assert.equal(badRelation.vehicle_name,null);
 assert.deepEqual(result.drivers.map(d=>d.id),[1]);assert.equal(result.drivers[0].is_active,false);assert.equal(result.blockedTimes.length,1);assert.equal(result.settings.company_name,'TEST COMPANY');
 const encoded=JSON.stringify(result);for(const secret of ['NEVER EXPOSE','Foreign passenger','Foreign driver','Foreign vehicle','Foreign service','MUST NOT RETURN'])assert(!encoded.includes(secret));
 }finally{await pg.close();}
});
test('spring DST day is 23 hours and invalid dates rejected',async()=>{
 const pg=new PGlite();const db={query:(sql:string,args?:unknown[])=>pg.query(sql,args)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(readFileSync(new URL('./fixtures/management-schema.sql',import.meta.url),'utf8'));await pg.exec(readFileSync(new URL('./fixtures/schedule-schema.sql',import.meta.url),'utf8'));
 for(const [id,time] of [[1,'2026-03-08T05:59:59Z'],[2,'2026-03-08T06:00:00Z'],[3,'2026-03-09T04:59:59Z'],[4,'2026-03-09T05:00:00Z']] as const)await db.query('INSERT INTO appointments(id,tenant_id,start_time,status) VALUES($1,1,$2,\'pending\')',[id,time]);
 assert.deepEqual((await readDailySchedule(db,staff,'2026-03-08')).trips.map(t=>t.id),[2,3]);
 for(const date of ['2026-02-30','2026-11-01T00:00:00Z','',"2026-11-01';DROP TABLE appointments;--"])assert.throws(()=>validateScheduleDay(date));
 }finally{await pg.close();}
});
test('oversized day fails rather than presenting incomplete print output',async()=>{
 const db={query:async()=>({rows:Array.from({length:501},(_,id)=>({id}))})} as unknown as Pick<Pool,'query'>;
 await assert.rejects(readDailySchedule(db,staff,'2026-11-01'),e=>e instanceof Response&&e.status===422);
});

import {readCalendarMonth} from '../app/lib/schedule-read.server';
test('month counts use Central boundaries, exclude cancelled/tentative/foreign rows and reject overflow',async()=>{
 const pg=new PGlite();const db={query:(sql:string,args?:unknown[])=>pg.query(sql,args)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(readFileSync(new URL('./fixtures/schedule-schema.sql',import.meta.url),'utf8'));
 const data=[['2026-11-01T04:59:59Z',1,'pending',false],['2026-11-01T05:00:00Z',1,'pending',false],['2026-12-01T05:59:59Z',1,'pending',false],['2026-12-01T06:00:00Z',1,'pending',false],['2026-11-15T12:00:00Z',2,'pending',false],['2026-11-15T12:00:00Z',1,'cancelled',false],['2026-11-15T12:00:00Z',1,'pending',true]];
 for(let i=0;i<data.length;i++)await db.query('INSERT INTO appointments(id,start_time,tenant_id,status,is_tentative) VALUES ($1,$2,$3,$4,$5)',[i+1,...data[i]]);
 assert.deepEqual((await readCalendarMonth(db,staff,'2026-11')).trips.map(t=>t.id),[2,3]);
 for(const month of ['2026-13','2026-0','2026-11-01',"2026-11';--"])await assert.rejects(readCalendarMonth(db,staff,month));
 const tooMany={query:async()=>({rows:Array.from({length:5001},(_,id)=>({id}))})} as unknown as Pick<Pool,'query'>;await assert.rejects(readCalendarMonth(tooMany,staff,'2026-11'),e=>e instanceof Response&&e.status===422);
 }finally{await pg.close();}
});
