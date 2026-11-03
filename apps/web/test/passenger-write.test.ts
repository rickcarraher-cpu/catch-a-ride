import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';import {createTestPassenger} from '../app/lib/passenger-write.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('passenger create persists tenant and duplicate returns existing ID without editing',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(`CREATE TABLE clients(id serial,tenant_id int,name text,email text,phone text,notes text,street_address text,city text,state text,zip_code text,referral_source text,address text,cc_emails text,notification_preference text);`);
 const body={name:'TEST passenger',email:'test@example.test',phone:'2025550100',notification_preference:'both'};
 await pg.exec('BEGIN');const result=await createTestPassenger(db,staff,body);await pg.exec('COMMIT');assert.ok(result.id);
 await pg.exec('BEGIN');const dupe=await createTestPassenger(db,staff,{...body,name:'Different'});await pg.exec('COMMIT');assert.equal(dupe.existing_id,result.id);
 const rows=await pg.query<{name:string,notification_preference:string}>('SELECT * FROM clients');assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].name,'TEST passenger');assert.equal(rows.rows[0].notification_preference,'none');
 await pg.exec('BEGIN');const other=await createTestPassenger(db,{...staff,tenantId:2},body);await pg.exec('COMMIT');assert.notEqual(other.id,result.id);
 await assert.rejects(createTestPassenger(db,{...staff,employeeId:0},body));await assert.rejects(createTestPassenger(db,staff,{...body,email:'invalid'}));
 }finally{await pg.close();}
});
