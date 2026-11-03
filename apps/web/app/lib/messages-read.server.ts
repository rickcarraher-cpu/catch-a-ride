import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function readMessages(db:Pick<Pool,'query'>,staff:Staff,conversationId:string|null,phone:string|null,unread=false){
 if(conversationId||phone){
  if(conversationId&&!/^[1-9]\d{0,9}$/.test(conversationId))throw new Response('Invalid conversation',{status:400});
  if(phone&&phone.length>40)throw new Response('Invalid phone filter',{status:400});
  const r=await db.query(`SELECT id,conversation_id,phone,message,direction,sent_at,read_at,is_urgent FROM sms_messages WHERE tenant_id=$1 AND (($2::integer IS NOT NULL AND conversation_id=$2) OR ($2::integer IS NULL AND phone=$3)) ORDER BY sent_at,id LIMIT 501`,[staff.tenantId,conversationId?Number(conversationId):null,phone]);
  if(r.rows.length>500)throw new Response('Thread exceeds 500 messages; narrower history view needed',{status:422});
  return {messages:r.rows};
 }
 const r=await db.query(`WITH grouped AS (
 SELECT DISTINCT ON (COALESCE(conversation_id::text,phone)) conversation_id,phone,message AS last_message,direction AS last_direction,sent_at AS last_sent_at,client_id FROM sms_messages WHERE tenant_id=$1 ORDER BY COALESCE(conversation_id::text,phone),sent_at DESC,id DESC
 ), unread AS (SELECT COALESCE(conversation_id::text,phone) AS group_key,count(*) AS unread_count,bool_or(is_urgent) AS has_urgent_unread FROM sms_messages WHERE tenant_id=$1 AND direction='inbound' AND read_at IS NULL GROUP BY COALESCE(conversation_id::text,phone))
 SELECT g.conversation_id,g.phone,g.last_message,g.last_direction,g.last_sent_at,c.name AS client_name,c.id AS client_id,coalesce(u.unread_count,0) AS unread_count,coalesce(u.has_urgent_unread,false) AS has_urgent_unread,'[]'::json AS participants
 FROM grouped g LEFT JOIN clients c ON c.id=g.client_id AND c.tenant_id=$1 LEFT JOIN unread u ON u.group_key=COALESCE(g.conversation_id::text,g.phone)
 WHERE ($2::boolean=false OR coalesce(u.unread_count,0)>0) ORDER BY g.last_sent_at DESC LIMIT 201`,[staff.tenantId,unread]);
 if(r.rows.length>200)throw new Response('More than 200 conversations; history pagination needed',{status:422});
 return {conversations:r.rows};
}
