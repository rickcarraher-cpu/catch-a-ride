import {readWizardData} from './wizard-database.server';
import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
type DB=Pick<Pool,'query'>;
export async function readEditableTrip(db:DB,staff:Staff,id:number){
 if(!Number.isSafeInteger(id)||id<1)throw new Response('Invalid trip',{status:400});
 const result=await db.query(`SELECT a.id,a.client_id,a.employee_id,a.vehicle_id,a.start_time,a.status,a.booked_by,a.booker_name,a.notes,a.driver_notes,a.destination,a.pickup_address,a.pickup_street,a.pickup_city,a.pickup_state,a.pickup_zip,a.dropoff_address,a.dropoff_street,a.dropoff_city,a.dropoff_state,a.dropoff_zip,a.num_people,a.num_bags_checked,a.num_bags_carry_on,a.num_car_seats,a.num_golf_bags,a.outgoing_flight_info,a.returning_flight_info,a.return_date,a.vehicle_category,a.payment_method,a.distance_miles,a.distance_method,a.is_tentative,a.tentative_reason,a.booking_number,a.gift_certificate,a.wedding_id,c.name AS client_name,c.email AS client_email,c.phone AS client_phone
 FROM appointments a LEFT JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id WHERE a.id=$1 AND a.tenant_id=$2 AND a.booking_number LIKE 'TEST-%'`,[id,staff.tenantId]);
 if(result.rowCount!==1)throw new Response('Test booking not found',{status:404});
 const services=await db.query(`SELECT x.service_id,x.service_price,x.duration_minutes,x.quantity,x.stop_description,s.name AS service_name FROM appointment_services x JOIN appointments a ON a.id=x.appointment_id JOIN services s ON s.id=x.service_id AND s.tenant_id=a.tenant_id WHERE a.id=$1 AND a.tenant_id=$2 ORDER BY x.id`,[id,staff.tenantId]);
 return {...result.rows[0],services:services.rows};
}
export async function updateTestTrip(db:DB,staff:Staff,id:number,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Staff required',{status:403});
 await db.query("SELECT id FROM appointments WHERE id=$1 AND tenant_id=$2 AND booking_number LIKE 'TEST-%' FOR UPDATE",[id,staff.tenantId]);
 const current=await readEditableTrip(db,staff,id);const d=body as Record<string,unknown>;
 if(!d||typeof d!=='object'||Array.isArray(d))throw new Response('Invalid edit',{status:400});
 if(d.send_notification===true)throw new Response('Choose Save Without Sending',{status:400});
 // Preserve original services/prices/identity/time/assignment. Do not silently lose attempted changes.
 for(const key of ['client_id','employee_id','status','payment_method'])if(d[key]!=null&&String(d[key])!==String(current[key]??''))throw new Response(`Changing ${key} is not enabled in this metadata editor`,{status:400});
 if(d.start_time&&Date.parse(String(d.start_time))!==new Date(current.start_time).getTime())throw new Response('Pickup time changes are not enabled in this editor',{status:400});
 if(d.services){if(!Array.isArray(d.services)||d.services.length!==current.services.length||d.services.some((line:any,i:number)=>['service_id','service_price','duration_minutes','quantity'].some(k=>Number(line[k]||0)!==Number(current.services[i][k]||0))||String(line.stop_description||'')!==String(current.services[i].stop_description||'')))throw new Response('Service/price changes are not enabled in this editor',{status:400});}
 const vehicleEdits:Record<string,unknown>={};
 if(Object.hasOwn(d,'vehicle_id')){
  const raw=d.vehicle_id;const vehicle=raw===null||raw===''?null:Number(raw);
  if(vehicle!==null&&(!Number.isSafeInteger(vehicle)||vehicle<1))throw new Response('Invalid vehicle selection',{status:400});
  if(vehicle!==current.vehicle_id&&!(vehicle===null&&current.vehicle_id==null)){
   if(vehicle!==null){const available=await readWizardData(db,staff,'vehicles');if(!available.some(v=>v.id===vehicle))throw new Response('Vehicle is not available in your tenant',{status:404});
    if(current.employee_id){const assigned=await readWizardData(db,staff,'vehicle-assignments',String(current.employee_id));if(!assigned.some(v=>v.vehicle_id===vehicle))throw new Response('Vehicle is not assigned to this trip’s driver. Choose a driver-matched vehicle.',{status:400});}
   }
   vehicleEdits.vehicle_id=vehicle;
  }
 }
 if(Object.hasOwn(d,'vehicle_category')&&String(d.vehicle_category??'')!==String(current.vehicle_category??'')){
  if(typeof d.vehicle_category!=='string'||!d.vehicle_category||d.vehicle_category.length>80)throw new Response('Select a vehicle preference',{status:400});
  const available=await readWizardData(db,staff,'vehicles');if(!available.some(v=>v.category===d.vehicle_category))throw new Response('Select an available vehicle category',{status:400});
  vehicleEdits.vehicle_category=d.vehicle_category;
 }
 const fields=['notes','driver_notes','destination','pickup_address','pickup_street','pickup_city','pickup_state','pickup_zip','dropoff_address','dropoff_street','dropoff_city','dropoff_state','dropoff_zip','booker_name','outgoing_flight_info','returning_flight_info','tentative_reason'] as const;
 for(const [key,value] of Object.entries(d)){
 if((fields as readonly string[]).includes(key)||['services','start_time','send_notification','vehicle_id','vehicle_category'].includes(key))continue;
 if(String(value??'')!==String(current[key]??''))throw new Response(`Changing ${key} is not enabled in this metadata editor`,{status:400});
 }
 const values:Record<string,unknown>={...vehicleEdits};for(const k of fields)if(Object.hasOwn(d,k)){if(d[k]!=null&&(typeof d[k]!=='string'||String(d[k]).length>2000))throw new Response('Invalid text field',{status:400});values[k]=d[k]||null;}
 if(!Object.keys(values).length)throw new Response('No supported changes',{status:400});
 const keys=Object.keys(values);await db.query(`UPDATE appointments SET ${keys.map((k,i)=>`${k}=$${i+3}`).join(',')} WHERE id=$1 AND tenant_id=$2 AND booking_number LIKE 'TEST-%'`,[id,staff.tenantId,...Object.values(values)]);
 return {id,saved:true};
}
