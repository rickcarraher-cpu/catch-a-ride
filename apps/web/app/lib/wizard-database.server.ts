import type {Pool} from 'pg';
import type {Staff} from './staff-reads.server';
import {createDatabaseBooking} from './business-write.server';
type DB=Pick<Pool,'query'>;
export async function readWizardData(db:DB,staff:Staff,resource:string,search=''){
 if(resource==='services')return (await db.query(`SELECT id,name,description,default_price,duration_minutes,is_variable_price,is_airport_service,is_addon,is_tip_addon,can_passenger_request FROM services WHERE tenant_id=$1 AND is_active=true ORDER BY display_order,id LIMIT 200`,[staff.tenantId])).rows;
 if(resource==='drivers')return (await db.query(`SELECT id,name,is_active FROM employees WHERE tenant_id=$1 AND is_active=true ORDER BY name LIMIT 200`,[staff.tenantId])).rows;
 if(resource==='clients'){
  if(search.trim().length<2)return [];
  return (await db.query(`SELECT id,name,email,phone,address,street_address,city,state,zip_code,notification_preference,cc_emails FROM clients WHERE tenant_id=$1 AND is_active IS NOT FALSE AND (position(lower($2) in lower(name))>0 OR position(lower($2) in lower(coalesce(email,'')))>0 OR position($2 in coalesce(phone,''))>0) ORDER BY name,id LIMIT 25`,[staff.tenantId,search.trim().slice(0,100)])).rows;
 }
 if(resource==='vehicles')return (await db.query(`SELECT v.id,v.name,v.category,v.passenger_capacity,v.is_active FROM vehicles v WHERE v.is_active=true AND EXISTS(SELECT 1 FROM employees e WHERE e.id=v.employee_id AND e.tenant_id=$1) AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va JOIN employees e ON e.id=va.employee_id WHERE va.vehicle_id=v.id AND e.tenant_id IS DISTINCT FROM $1) ORDER BY v.id LIMIT 200`,[staff.tenantId])).rows;
 throw new Response('Wizard read unavailable',{status:404});
}
export async function saveWizardBooking(db:DB,staff:Staff,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Staff required',{status:403});
 const d=body as Record<string,unknown>;
 if(!d||typeof d!=='object'||Array.isArray(d))throw new Response('Invalid booking',{status:400});
 // This first database wizard path intentionally excludes modes needing separate workflows.
 if(d.is_tour||d._is_round_trip||d.return_date||d.wedding_id||d.vehicle_id||d.payment_method||d.send_notification===true)throw new Response('Use one-way, no specific vehicle, no payment method and Save Without Sending for this test milestone',{status:400});
 const lines=d.services;
 if(!Array.isArray(lines)||lines.length<1||lines.length>30)throw new Response('Select at least one service (maximum 30)',{status:400});
 let cents=0;const validated=[];
 for(const row of lines){
  if(!row||!Number.isSafeInteger(Number(row.service_id))||Number(row.service_id)<1||!Number.isFinite(Number(row.service_price))||Number(row.service_price)<0||Number(row.service_price)>100000||!Number.isInteger(Number(row.quantity))||Number(row.quantity)<1||Number(row.quantity)>100)throw new Response('Invalid service line',{status:400});
  const found=await db.query('SELECT id,duration_minutes FROM services WHERE id=$1 AND tenant_id=$2 AND is_active=true FOR SHARE',[Number(row.service_id),staff.tenantId]);
  if(found.rowCount!==1)throw new Response('Service not found in your tenant',{status:404});
  const price=Math.round(Number(row.service_price)*100);cents+=price*Number(row.quantity);
  const duration=Number(found.rows[0].duration_minutes??75);if(!Number.isInteger(duration)||duration<0||duration>1440)throw new Response('Invalid service duration',{status:400});
  validated.push({id:Number(row.service_id),price:price/100,quantity:Number(row.quantity),duration});
 }
 // Do not silently discard populated unsupported passenger/flight/admin fields.
 const supported=new Set(['client_id','employee_id','start_time','pickup_address','dropoff_address','pickup_street','pickup_city','pickup_state','pickup_zip','dropoff_street','dropoff_city','dropoff_state','dropoff_zip','notes','num_people','vehicle_category','services','status','booked_by','send_notification','driver_accepted','passenger_confirmed']);
 for(const [key,value] of Object.entries(d))if(!supported.has(key)&&value!==null&&value!==undefined&&value!==false&&value!==''&&value!==0&&!(['_addon_legs','_addon_prices','_addon_quantities'].includes(key)&&typeof value==='object'&&Object.keys(value).length===0))throw new Response(`Field ${key} is not connected yet`,{status:400});
 const addr=(prefix:string)=>d[`${prefix}_address`]||['street','city','state','zip'].map(k=>d[`${prefix}_${k}`]).filter(Boolean).join(', ');
 const record=await createDatabaseBooking(db,staff,{client_id:Number(d.client_id),employee_id:d.employee_id?Number(d.employee_id):null,start_time:d.start_time,pickup_address:addr('pickup'),dropoff_address:addr('dropoff'),notes:d.notes||'',num_people:d.num_people||1,vehicle_category:d.vehicle_category||''});
 for(const line of validated)await db.query(`INSERT INTO appointment_services(appointment_id,service_id,service_price,duration_minutes,quantity) VALUES($1,$2,$3,$4,$5)`,[record.id,line.id,line.price,line.duration,line.quantity]);
 await db.query(`UPDATE appointments SET services_total=$3,balance_due=$3,booking_number=$4,payment_status='unpaid' WHERE id=$1 AND tenant_id=$2`,[record.id,staff.tenantId,cents/100,`TEST-${record.id}`]);
 return {...record,booking_number:`TEST-${record.id}`};
}
