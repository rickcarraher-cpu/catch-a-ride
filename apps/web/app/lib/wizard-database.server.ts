import {validateServiceLines} from './service-lines.server';
import type {Pool} from 'pg';
import type {Staff} from './staff-reads.server';
import {createDatabaseBooking} from './business-write.server';
type DB=Pick<Pool,'query'>;
export async function readWizardData(db:DB,staff:Staff,resource:string,search=''){
 if(resource==='services')return (await db.query(`SELECT id,name,description,default_price,duration_minutes,is_active,display_order,is_variable_price,is_airport_service,is_addon,is_tip_addon,can_passenger_request FROM services WHERE tenant_id=$1 AND is_active=true ORDER BY display_order,id LIMIT 200`,[staff.tenantId])).rows;
 if(resource==='drivers')return (await db.query(`SELECT id,name,is_active FROM employees WHERE tenant_id=$1 AND is_active=true ORDER BY name LIMIT 200`,[staff.tenantId])).rows;
 if(resource==='clients'){
  if(search.trim().length<2)return [];
  return (await db.query(`SELECT id,name,email,phone,address,street_address,city,state,zip_code,notification_preference,cc_emails FROM clients WHERE tenant_id=$1 AND is_active IS NOT FALSE AND (position(lower($2) in lower(name))>0 OR position(lower($2) in lower(coalesce(email,'')))>0 OR position($2 in coalesce(phone,''))>0) ORDER BY name,id LIMIT 25`,[staff.tenantId,search.trim().slice(0,100)])).rows;
 }
 if(resource==='vehicle-assignments'){
  if(!/^[1-9]\d*$/.test(search))throw new Response('Invalid driver',{status:400});
  return (await db.query(`SELECT v.id AS vehicle_id,e.id AS employee_id FROM vehicles v JOIN employees e ON e.id=$2 AND e.tenant_id=$1
    WHERE v.is_active=true AND (v.employee_id=e.id OR EXISTS(SELECT 1 FROM vehicle_assignments va WHERE va.vehicle_id=v.id AND va.employee_id=e.id))
    AND EXISTS(SELECT 1 FROM employees owner WHERE owner.id=v.employee_id AND owner.tenant_id=$1)
    AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va JOIN employees other ON other.id=va.employee_id WHERE va.vehicle_id=v.id AND other.tenant_id IS DISTINCT FROM $1)
    ORDER BY v.id LIMIT 200`,[staff.tenantId,Number(search)])).rows;
 }
 if(resource==='vehicles')return (await db.query(`SELECT v.id,v.name,v.category,v.passenger_capacity,v.is_active FROM vehicles v WHERE v.is_active=true AND EXISTS(SELECT 1 FROM employees e WHERE e.id=v.employee_id AND e.tenant_id=$1) AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va JOIN employees e ON e.id=va.employee_id WHERE va.vehicle_id=v.id AND e.tenant_id IS DISTINCT FROM $1) ORDER BY v.id LIMIT 200`,[staff.tenantId])).rows;
 throw new Response('Wizard read unavailable',{status:404});
}
export async function saveWizardBooking(db:DB,staff:Staff,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Staff required',{status:403});
 const d=body as Record<string,unknown>;
 if(!d||typeof d!=='object'||Array.isArray(d))throw new Response('Invalid booking',{status:400});
 // This first database wizard path intentionally excludes modes needing separate workflows.
 if(d.is_tour)throw new Response('Tour booking is not connected yet',{status:400});
 if(d._is_round_trip||d.return_date)throw new Response('Round-trip booking is not connected yet; choose one-way',{status:400});
 if(d.wedding_id)throw new Response('Wedding booking is not connected yet',{status:400});
 let selectedVehicle:number|null=null;
 if(d.vehicle_id){
  selectedVehicle=Number(d.vehicle_id);if(!Number.isSafeInteger(selectedVehicle)||selectedVehicle<1)throw new Response('Invalid vehicle',{status:400});
  const vehicles=await readWizardData(db,staff,'vehicles');
  if(!vehicles.some(v=>v.id===selectedVehicle))throw new Response('Vehicle not available in your tenant',{status:404});
  if(d.employee_id){const assigned=await readWizardData(db,staff,'vehicle-assignments',String(d.employee_id));if(!assigned.some(v=>v.vehicle_id===selectedVehicle))throw new Response('Vehicle is not assigned to the selected driver',{status:400});}
 }

 if(d.payment_method!=null&&d.payment_method!==''&&!['Cash','Square Invoice','Venmo','Zelle','Farm','Comp','Credit Card','Square','Stripe'].includes(String(d.payment_method)))throw new Response('Unsupported payment preference',{status:400});
 if(d.send_notification===true)throw new Response('Choose Save Without Sending, then No — Save & Go to All Trips',{status:400});
 if(d.destination!=null&&(typeof d.destination!=='string'||d.destination.length>500))throw new Response('Destination must be text of at most 500 characters',{status:400});
 const textFields=['pickup_street','pickup_city','pickup_state','pickup_zip','dropoff_street','dropoff_city','dropoff_state','dropoff_zip','outgoing_flight_info','returning_flight_info','customs_clearance_location','requested_driver_name','booker_name','driver_notes','tentative_reason'] as const;
 const countFields=['num_bags_checked','num_bags_carry_on','num_car_seats','num_golf_bags'] as const;
 for(const key of textFields)if(d[key]!=null&&(typeof d[key]!=='string'||String(d[key]).length>2000))throw new Response('Invalid booking text field',{status:400});
 for(const key of countFields)if(d[key]!=null&&(!Number.isInteger(Number(d[key]))||Number(d[key])<0||Number(d[key])>100))throw new Response('Invalid baggage count',{status:400});
 if(d.distance_miles!=null&&(!Number.isFinite(Number(d.distance_miles))||Number(d.distance_miles)<0||Number(d.distance_miles)>100000))throw new Response('Invalid distance',{status:400});
 for(const key of ['is_international_flight','needs_receipt','is_tentative'])if(d[key]!=null&&typeof d[key]!=='boolean')throw new Response('Invalid booking flag',{status:400});
 const inactiveTourDefault=(key:string,value:unknown)=>!d.is_tour&&(
   (key==='tour_payment_split'&&value==='single')||
   (['tour_participants','tour_itinerary'].includes(key)&&Array.isArray(value)&&value.length===0)
 );
 if(d.status!=null&&!['pending','needs_review','quote'].includes(String(d.status)))throw new Response('Unsupported booking status',{status:400});
 const {cents,validated}=await validateServiceLines(db,staff,d.services);
 // Do not silently discard populated unsupported passenger/flight/admin fields.
 const supported=new Set([...textFields,...countFields,'distance_miles','is_international_flight','needs_receipt','is_tentative','client_id','employee_id','start_time','pickup_address','dropoff_address','pickup_street','pickup_city','pickup_state','pickup_zip','dropoff_street','dropoff_city','dropoff_state','dropoff_zip','notes','num_people','vehicle_category','services','vehicle_id','destination','payment_method','status','booked_by','send_notification','driver_accepted','passenger_confirmed']);
 for(const [key,value] of Object.entries(d))if(!supported.has(key)&&!inactiveTourDefault(key,value)&&value!==null&&value!==undefined&&value!==false&&value!==''&&value!==0&&!(['_addon_legs','_addon_prices','_addon_quantities'].includes(key)&&typeof value==='object'&&Object.keys(value).length===0))throw new Response(`Field ${key} is not connected yet`,{status:400});
 const addr=(prefix:string)=>d[`${prefix}_address`]||['street','city','state','zip'].map(k=>d[`${prefix}_${k}`]).filter(Boolean).join(', ');
 const record=await createDatabaseBooking(db,staff,{client_id:Number(d.client_id),employee_id:d.employee_id?Number(d.employee_id):null,start_time:d.start_time,pickup_address:addr('pickup'),dropoff_address:addr('dropoff'),notes:d.notes||'',num_people:d.num_people||1,vehicle_category:d.vehicle_category||''});
 for(const line of validated)await db.query(`INSERT INTO appointment_services(appointment_id,service_id,service_price,duration_minutes,quantity) VALUES($1,$2,$3,$4,$5)`,[record.id,line.id,line.price,line.duration,line.quantity]);
 await db.query(`UPDATE appointments SET services_total=$3,original_amount=$3,payments_total=0,balance_due=$3,booking_number=$4,payment_status='unpaid',payment_method=$5,destination=$6,vehicle_id=$7,status=$8 WHERE id=$1 AND tenant_id=$2`,[record.id,staff.tenantId,cents/100,`TEST-${record.id}`,d.payment_method||null,d.destination||null,selectedVehicle,d.status||'pending']);
 const metadata:Record<string,unknown>={};
 for(const key of textFields)metadata[key]=d[key]||null;
 for(const key of countFields)metadata[key]=d[key]==null?null:Number(d[key]);
 metadata.distance_miles=d.distance_miles==null?null:Number(d.distance_miles);
 for(const key of ['is_international_flight','needs_receipt','is_tentative'])metadata[key]=d[key]===true;
 const keys=Object.keys(metadata); // All keys originate from fixed server allowlists above.
 await db.query(`UPDATE appointments SET ${keys.map((key,i)=>`${key}=$${i+3}`).join(',')} WHERE id=$1 AND tenant_id=$2`,[record.id,staff.tenantId,...Object.values(metadata)]);
 return {...record,booking_number:`TEST-${record.id}`};
}
