import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function validateServiceLines(db:Pick<Pool,'query'>,staff:Staff,input:unknown,allowDurationOverride=false){
 if(!Array.isArray(input)||input.length<1||input.length>30)throw new Response('Select at least one service (maximum 30)',{status:400});
 const number=(v:unknown)=>typeof v==='number'||(typeof v==='string'&&v.trim()!=='');
 let cents=0;const validated=[];
 for(const row of input){
  if(!row||typeof row!=='object'||!number(row.service_id)||!Number.isSafeInteger(Number(row.service_id))||Number(row.service_id)<1||!number(row.service_price)||!Number.isFinite(Number(row.service_price))||Number(row.service_price)<0||Number(row.service_price)>100000||!number(row.quantity)||!Number.isInteger(Number(row.quantity))||Number(row.quantity)<1||Number(row.quantity)>100)throw new Response('Invalid service line',{status:400});
  const found=await db.query('SELECT id,duration_minutes FROM services WHERE id=$1 AND tenant_id=$2 AND is_active=true FOR SHARE',[Number(row.service_id),staff.tenantId]);
  if(found.rowCount!==1)throw new Response('Service not found in your tenant',{status:404});
  const price=Math.round(Number(row.service_price)*100);cents+=price*Number(row.quantity);
  const raw=allowDurationOverride&&row.duration_minutes!=null?row.duration_minutes:found.rows[0].duration_minutes??75;
  const duration=Number(raw);if(!number(raw)||!Number.isInteger(duration)||duration<0||duration>1440)throw new Response('Invalid service duration',{status:400});
  if(row.stop_description!=null&&(typeof row.stop_description!=='string'||row.stop_description.length>2000))throw new Response('Invalid stop description',{status:400});
  validated.push({id:Number(row.service_id),price:price/100,quantity:Number(row.quantity),duration,stop:row.stop_description||null});
 }
 return {cents,validated};
}
