import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';import {readUnpaidReport} from '../app/lib/report-read.server';import {readDailySchedule} from '../app/lib/schedule-read.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('unpaid report aggregates stored balances without repricing, isolates tenants and omits operational links',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{
 for(const name of ['management','schedule','report'])await pg.exec(readFileSync(new URL(`./fixtures/${name}-schema.sql`,import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO employees(id,tenant_id,name) VALUES(1,1,'LOCAL'),(2,2,'FOREIGN');INSERT INTO clients(id,tenant_id,name) VALUES(1,1,'LOCAL'),(2,2,'FOREIGN');INSERT INTO services(id,tenant_id,name) VALUES(1,1,'LOCAL SERVICE'),(2,2,'FOREIGN SERVICE');`);
 const data=[[1,1,'unpaid','pending',0.1],[2,1,'partial','completed',0.2],[3,1,'paid','confirmed',99],[4,2,'unpaid','pending',999],[5,1,'unpaid','cancelled',888],[6,1,null,'pending',0]];
 for(const [id,tenant,ps,status,balance] of data)await db.query(`INSERT INTO appointments(id,tenant_id,client_id,employee_id,start_time,payment_status,status,balance_due,services_total) VALUES ($1,$2,1,1,'2026-11-10T15:00:00Z',$3,$4,$5,700)`,[id,tenant,ps,status,balance]);
 await pg.exec(`INSERT INTO appointment_services(appointment_id,service_id,service_price,duration_minutes,quantity) VALUES(1,1,5000,75,1),(1,2,8888,75,1);INSERT INTO payments(appointment_id,status,provider,amount,currency,payment_url,created_at) VALUES(1,'link_created','Square',0.1,'USD','https://private-link.invalid/NEVER',now());`);
 const result=await readUnpaidReport(db,staff);assert.equal(result.trips.length,3);assert.equal(result.summary.total_amount_due,0.3);assert.equal(result.summary.with_payment_link,1);assert.equal(Number(result.trips[0].services_total),700);assert.equal(result.trips[0].services.length,1);assert(!JSON.stringify(result).includes('NEVER'));assert(!JSON.stringify(result).includes('FOREIGN'));assert.equal(result.trips[0].active_payment_link.provider,'Square');
 }finally{await pg.close();}
});
test('weekly trip reads preserve cancelled records and stored totals but reject unbounded spans',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{for(const name of ['management','schedule'])await pg.exec(readFileSync(new URL(`./fixtures/${name}-schema.sql`,import.meta.url),'utf8'));
 await pg.exec(`INSERT INTO appointments(id,tenant_id,start_time,status,services_total,tips_total) VALUES(1,1,'2026-11-02T16:00:00Z','pending',123.45,6.78),(2,1,'2026-11-05T16:00:00Z','cancelled',999,99),(3,2,'2026-11-02T16:00:00Z','pending',888,88),(4,1,'2026-11-08T16:00:00Z','pending',777,77);`);
 const r=await readDailySchedule(db,staff,'2026-11-01','2026-11-07',true);assert.deepEqual(r.trips.map(t=>t.id),[1,2]);assert.equal(Number(r.trips[0].services_total),123.45);assert.equal(Number(r.trips[0].tips_total),6.78);
 await assert.rejects(readDailySchedule(db,staff,'2026-11-01','2026-11-08',true));await assert.rejects(readDailySchedule(db,staff,'2026-11-07','2026-11-01',true));
 }finally{await pg.close();}
});

import {readPaymentPeriod} from '../app/lib/report-read.server';
test('payment report uses stored payment totals and Central payment_date range without provider calls',async()=>{
 const pg=new PGlite();const db={query:(sql:string,args?:unknown[])=>pg.query(sql,args)} as unknown as Pick<Pool,'query'>;
 try{for(const f of ['management','schedule'])await pg.exec(readFileSync(new URL(`./fixtures/${f}-schema.sql`,import.meta.url),'utf8'));
 const entries=[[1,1,'2026-11-01T04:59:59Z','Cash',9],[2,1,'2026-11-01T05:00:00Z','Cash',0.1],[3,1,'2026-11-02T05:59:59Z','Cash',0.2],[4,1,'2026-11-02T06:00:00Z','Cash',8],[5,2,'2026-11-01T12:00:00Z','Cash',999]];
 for(const [id,tenant,paid,method,total] of entries)await db.query(`INSERT INTO appointments(id,tenant_id,start_time,status,payment_date,payment_method,payments_total,tips_total,services_total) VALUES($1,$2,'2026-12-01T12:00:00Z','pending',$3,$4,$5,0,777)`,[id,tenant,paid,method,total]);
 const r=await readPaymentPeriod(db,staff,'2026-11-01','2026-11-01');assert.deepEqual(r.trips.map(t=>t.id),[2,3]);assert.equal(r.grandTotal.payments_total,0.3);assert.equal(r.totals.Cash.payments_total,0.3);assert.equal(Number(r.trips[0].services_total),777);await assert.rejects(readPaymentPeriod(db,staff,'2026-01-01','2026-12-31'));
 }finally{await pg.close();}
});

import {readRecurringTrips} from '../app/lib/recurring-read.server';
test('recurring review scopes tenant and exposes durations but no nested private payloads',async()=>{
 const pg=new PGlite();const db={query:(q:string,p?:unknown[])=>pg.query(q,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(readFileSync(new URL('./fixtures/management-schema.sql',import.meta.url),'utf8'));await pg.exec(`CREATE TABLE recurring_appointments(id serial,tenant_id int,client_id int,employee_id int,start_time time,frequency text,day_of_week int,destination text,num_occurrences int,notes text,services_data jsonb,is_deleted boolean);INSERT INTO clients(id,tenant_id,name) VALUES(1,1,'Local'),(2,2,'Foreign');INSERT INTO recurring_appointments(tenant_id,client_id,services_data) VALUES(1,1,'[{"duration_minutes":75,"quantity":2,"private":"NEVER"}]'),(2,2,'[]');`);
 const r=await readRecurringTrips(db,staff);assert.equal(r.length,1);assert.equal(r[0].client_name,'Local');assert.equal(r[0].services_data[0].duration_minutes,'75');assert(!JSON.stringify(r).includes('NEVER'));assert(!JSON.stringify(r).includes('Foreign'));
 }finally{await pg.close();}
});
