import {test} from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import type {Pool} from 'pg';import {readMessages} from '../app/lib/messages-read.server';
const staff={employeeId:51,tenantId:1,isAdmin:true,isDispatcher:true};
test('message history scopes list, unread and conversation IDs to tenant without mutations',async()=>{
 const pg=new PGlite();const db={query:(s:string,p?:unknown[])=>pg.query(s,p)} as unknown as Pick<Pool,'query'>;
 try{await pg.exec(`CREATE TABLE clients(id int,tenant_id int,name text);CREATE TABLE sms_messages(id int,tenant_id int,conversation_id int,phone text,message text,direction text,sent_at timestamptz,read_at timestamptz,is_urgent bool,client_id int);INSERT INTO clients VALUES(1,1,'Test');INSERT INTO sms_messages VALUES(1,1,10,'2025550100','Synthetic test','inbound',now(),null,true,1),(2,2,20,'2025550200','Other tenant','inbound',now(),null,false,null);`);
 const all=await readMessages(db,staff,null,null);assert.equal(all.conversations?.length,1);
 const thread=await readMessages(db,staff,'10',null);assert.equal(thread.messages?.length,1);
 const foreign=await readMessages(db,staff,'20',null);assert.equal(foreign.messages?.length,0);
 const unread=await readMessages(db,staff,null,null,true);assert.equal(unread.conversations?.length,1);
 await assert.rejects(readMessages(db,staff,'bad',null));
 }finally{await pg.close();}
});
