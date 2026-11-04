import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';import {reviewTestOrder} from '../app/lib/review-order.server';
const staff={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
test('review decisions only transition waiting TEST orders in tenant without service effects',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(`CREATE TABLE appointments(id int,tenant_id int,booking_number text,status text);INSERT INTO appointments VALUES(1,1,'TEST-1','needs_review'),(2,1,'IMPORTED','needs_review'),(3,2,'TEST-3','needs_review'),(4,1,'TEST-4','needs_review');`);
 assert.equal((await reviewTestOrder(db,staff,1,{decision:'approve'})).status,'approved');
 for(const id of [1,2,3])await assert.rejects(reviewTestOrder(db,staff,id,{decision:'reject'}));
 assert.equal((await reviewTestOrder(db,staff,4,{decision:'reject'})).status,'cancelled');
 await assert.rejects(reviewTestOrder(db,staff,4,{decision:'approve',send_notification:true}));
 }finally{await pg.close();}
});
