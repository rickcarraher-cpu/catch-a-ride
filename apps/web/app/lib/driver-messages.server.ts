import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';import {safeHistoryText} from './communication-read.server';
const digits="regexp_replace(coalesce(phone,''),'[^0-9]','','g')";
export async function readDriverMessages(db:Pick<Pool,'query'>,staff:Staff,phone:string|null=null){
 if(phone!==null&&(phone.length>40||!/^[+()\d .-]+$/.test(phone)))throw new Response('Invalid driver phone',{status:400});
 const normalize=(p:string)=>{const n=p.replace(/\D/g,'');return n.length===11&&n.startsWith('1')?n.slice(1):n;};
 const employees=(await db.query("SELECT id,name,phone,color,is_active FROM employees WHERE tenant_id=$1 AND nullif(trim(phone),'') IS NOT NULL ORDER BY name,id LIMIT 1001",[staff.tenantId])).rows;
 if(employees.length>1000)throw new Response('Driver list exceeds safe limit',{status:422});
 if(phone!==null){const key=normalize(phone);if(!employees.some(e=>normalize(e.phone)===key))throw new Response('Driver not found in your tenant',{status:404});
 const r=await db.query(`SELECT id,phone,message,direction,sent_at,read_at,sender_name FROM sms_messages WHERE tenant_id=$1 AND (CASE WHEN length(${digits})=11 AND left(${digits},1)='1' THEN substring(${digits} FROM 2) ELSE ${digits} END)=$2 ORDER BY sent_at,id LIMIT 501`,[staff.tenantId,key]);if(r.rows.length>500)throw new Response('Thread exceeds 500 records; use paged communication history',{status:422});return {messages:r.rows.map(m=>({...m,message:safeHistoryText(m.message),sender_name:safeHistoryText(m.sender_name)}))};}
 const r=await db.query(`SELECT DISTINCT ON (phone) phone,message,direction,sent_at,count(*) FILTER (WHERE direction='inbound' AND read_at IS NULL) OVER (PARTITION BY phone) AS unread_count FROM sms_messages WHERE tenant_id=$1 ORDER BY phone,sent_at DESC NULLS LAST,id DESC LIMIT 1001`,[staff.tenantId]);if(r.rows.length>1000)throw new Response('History exceeds review limit; use communication log',{status:422});
 const conversations=employees.map(e=>{const last=r.rows.filter(m=>normalize(m.phone)===normalize(e.phone)).sort((a,b)=>new Date(b.sent_at).getTime()-new Date(a.sent_at).getTime())[0];return {phone:e.phone,employee_id:e.id,employee_name:e.name,employee_color:e.color,last_message:last?safeHistoryText(last.message):null,last_direction:last?.direction||null,last_sent_at:last?.sent_at||null,unread_count:r.rows.filter(m=>normalize(m.phone)===normalize(e.phone)).reduce((sum,m)=>sum+Number(m.unread_count||0),0)};});
 return {employees,conversations,group_conversations:[]};
}
