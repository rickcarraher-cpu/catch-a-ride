import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';
import {saveManagement} from '../app/lib/management-write.server';import {readPassengerForBooking,readManagement} from '../app/lib/management-read.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
async function setup(){const pg=new PGlite();await pg.exec(readFileSync(new URL('./fixtures/management-schema.sql',import.meta.url),'utf8'));return {pg,db:{query:async(s:string,p?:unknown[])=>{const r=await pg.query(s,p);return {...r,rowCount:r.affectedRows??r.rows.length};}} as unknown as Pick<Pool,'query'>};}
test('all four management records create, edit and reload against owner-reported types',async()=>{const {pg,db}=await setup();try{
 const d=await saveManagement(db,staff,'drivers',null,{first_name:'TEST',last_name:'DRIVER',email:'fixture@example.test',adp_worker_id:'TEST-ADP',is_active:true,is_driver:true,salary_rate:0.75,hourly_rate:null});
 await saveManagement(db,staff,'drivers',d.id,{phone:'TEST PHONE',notes:'saved'});
 const c=await saveManagement(db,staff,'passengers',null,{name:'TEST PASSENGER',notification_preference:'none',is_active:true});await saveManagement(db,staff,'passengers',c.id,{city:'TEST CITY'});
 assert.equal((await readPassengerForBooking(db,staff,c.id)).client_id,c.id);await assert.rejects(readPassengerForBooking(db,{...staff,tenantId:2},c.id));
 const s=await saveManagement(db,staff,'services',null,{name:'TEST SERVICE',default_price:25.5,duration_minutes:75,is_active:true});await saveManagement(db,staff,'services',s.id,{default_price:-5});
 const v=await saveManagement(db,staff,'vehicles',null,{name:'TEST VEHICLE',category:'Sedan',employee_id:d.id,assigned_driver_ids:[d.id],passenger_capacity:4,is_active:true});
 await db.query('UPDATE vehicle_assignments SET profile_description=$1 WHERE vehicle_id=$2',['keep profile',v.id]);
 await saveManagement(db,staff,'vehicles',v.id,{name:'TEST UPDATED',employee_id:d.id,assigned_driver_ids:[d.id],passenger_capacity:5});
 assert.equal((await readManagement(db,staff,'vehicle-categories'))[0].name,'Sedan');assert.equal((await readManagement(db,staff,'drivers'))[0].adp_worker_id,'TEST-ADP');
 assert.equal((await readManagement(db,staff,'drivers'))[0].phone,'TEST PHONE');assert.equal((await readManagement(db,staff,'passengers'))[0].city,'TEST CITY');assert.equal(Number((await readManagement(db,staff,'services'))[0].default_price),-5);
 assert.equal((await readManagement(db,staff,'vehicles'))[0].passenger_capacity,5);
 const a=await readManagement(db,staff,'vehicle-assignments',1,{employeeId:d.id});assert.equal(a.length,1);assert.equal(a[0].profile_description,'keep profile');
 assert.equal((await readManagement(db,staff,'vehicle-assignments',1,{employeeId:9999})).length,0);
 const driver=(await db.query('SELECT * FROM employees WHERE id=$1',[d.id])).rows[0];assert.equal(driver.password,null);assert.equal(driver.is_admin,null);assert.equal(driver.is_dispatcher,null);
 }finally{await pg.close();}});
test('management rejects foreign tenant writes, credential/role fields and staff email takeovers',async()=>{const {pg,db}=await setup();try{
 const local=await saveManagement(db,staff,'drivers',null,{name:'LOCAL',is_active:true});const foreign=await saveManagement(db,{...staff,tenantId:2},'drivers',null,{name:'FOREIGN',is_active:true});
 const c=await saveManagement(db,{...staff,tenantId:2},'passengers',null,{name:'FOREIGN CLIENT'});const s=await saveManagement(db,{...staff,tenantId:2},'services',null,{name:'FOREIGN SERVICE'});
 for(const [kind,id] of [['drivers',foreign.id],['passengers',c.id],['services',s.id]] as const)await assert.rejects(saveManagement(db,staff,kind,id,{name:'WRONG'}));
 for(const body of [{name:'bad',tenant_id:2},{name:'bad',password:'never'},{name:'bad',is_admin:true},{name:'bad',is_dispatcher:true},{name:'bad',new_password:'never'}])await assert.rejects(saveManagement(db,staff,'drivers',null,body));
 await db.query('UPDATE employees SET email=$1,is_admin=true,is_dispatcher=true,is_active=false WHERE id=$2',['admin@example.test',local.id]);await assert.rejects(saveManagement(db,staff,'drivers',local.id,{email:'other@example.test'}));
 await saveManagement(db,staff,'drivers',local.id,{notes:'inactive admin remains admin'});const admin=(await db.query('SELECT is_active,is_admin,is_dispatcher FROM employees WHERE id=$1',[local.id])).rows[0];assert.deepEqual(admin,{is_active:false,is_admin:true,is_dispatcher:true});
 await assert.rejects(saveManagement(db,staff,'vehicles',null,{name:'BAD VEHICLE',employee_id:foreign.id,assigned_driver_ids:[foreign.id]}));
 await assert.rejects(saveManagement(db,{...staff,isDispatcher:false},'passengers',null,{name:'NO ACCESS'}));
 }finally{await pg.close();}});
test('vehicle assignment changes are atomic and cross-tenant junctions fail closed',async()=>{const {pg,db}=await setup();try{
 const d1=await saveManagement(db,staff,'drivers',null,{name:'ONE'});const d2=await saveManagement(db,staff,'drivers',null,{name:'TWO'});const foreign=await saveManagement(db,{...staff,tenantId:2},'drivers',null,{name:'FOREIGN'});
 const v=await saveManagement(db,staff,'vehicles',null,{name:'TEST',employee_id:d1.id,assigned_driver_ids:[d1.id,d2.id]});
 await saveManagement(db,staff,'vehicles',v.id,{name:'TEST2',employee_id:d2.id,assigned_driver_ids:[d2.id]});assert.equal((await readManagement(db,staff,'vehicle-assignments')).length,1);
 await pg.exec('BEGIN');await assert.rejects(saveManagement(db,staff,'vehicles',v.id,{name:'SHOULD NOT SAVE',employee_id:d2.id,assigned_driver_ids:[foreign.id]}));await pg.exec('ROLLBACK');assert.equal((await db.query('SELECT name FROM vehicles WHERE id=$1',[v.id])).rows[0].name,'TEST2');
 await db.query('INSERT INTO vehicle_assignments(vehicle_id,employee_id) VALUES ($1,$2)',[v.id,foreign.id]);assert.equal((await readManagement(db,staff,'vehicles')).length,0);await assert.rejects(saveManagement(db,staff,'vehicles',v.id,{name:'NO',employee_id:d2.id,assigned_driver_ids:[d2.id]}));
 }finally{await pg.close();}});
