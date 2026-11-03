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
