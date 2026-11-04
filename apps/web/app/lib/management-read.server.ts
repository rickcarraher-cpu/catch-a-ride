import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function readManagement(db:Pick<Pool,'query'>,staff:Staff,resource:string,page=1,filters:{vehicleId?:number;employeeId?:number}={}){
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Response('Invalid page',{status:400});
 if(resource==='drivers')return (await db.query(`SELECT id,tenant_id,name,email,phone,color,is_active,is_admin,is_dispatcher,is_driver,is_tour_agent,can_cancel_trip,copy_communications_to_company,salary_rate,hourly_rate,street_address,city,state,zip_code,notes,profile_image_url,adp_worker_id,rotation_order,first_name,last_name FROM employees WHERE tenant_id=$1 ORDER BY name,id LIMIT 500`,[staff.tenantId])).rows;
 if(resource==='passengers')return (await db.query(`SELECT id,name,email,phone,notes,is_active,notification_preference,address,street_address,city,state,zip_code,cc_emails,referral_source,created_at FROM clients WHERE tenant_id=$1 ORDER BY name,id LIMIT 200 OFFSET $2`,[staff.tenantId,(page-1)*200])).rows;
 if(resource==='services')return (await db.query(`SELECT id,name,description,default_price,duration_minutes,is_active,is_variable_price,is_airport_service,is_addon,is_tip_addon,can_passenger_request,display_order FROM services WHERE tenant_id=$1 ORDER BY display_order,id LIMIT 500`,[staff.tenantId])).rows;
 if(resource==='vehicles')return (await db.query(`SELECT v.id,v.employee_id,v.name,v.year,v.color,v.plate,v.category,v.passenger_capacity,v.is_active,e.name AS employee_name,
 COALESCE((SELECT json_agg(json_build_object('id',d.id,'name',d.name)) FROM vehicle_assignments va JOIN employees d ON d.id=va.employee_id AND d.tenant_id=$1 WHERE va.vehicle_id=v.id),'[]'::json) AS assigned_drivers
 FROM vehicles v JOIN employees e ON e.id=v.employee_id AND e.tenant_id=$1 WHERE NOT EXISTS(SELECT 1 FROM vehicle_assignments va JOIN employees d ON d.id=va.employee_id WHERE va.vehicle_id=v.id AND d.tenant_id IS DISTINCT FROM $1) ORDER BY v.id LIMIT 500`,[staff.tenantId])).rows;
 if(resource==='vehicle-categories')return (await db.query(`SELECT id::text,name,display_order,is_active FROM vehicle_categories
 UNION ALL SELECT 'existing:'||v.category,v.category,2147483647,true FROM vehicles v JOIN employees e ON e.id=v.employee_id AND e.tenant_id=$1
 WHERE nullif(trim(v.category),'') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM vehicle_categories c WHERE c.name=v.category)
 AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va LEFT JOIN employees d ON d.id=va.employee_id WHERE va.vehicle_id=v.id AND d.tenant_id IS DISTINCT FROM $1)
 GROUP BY v.category ORDER BY display_order,name LIMIT 500`,[staff.tenantId])).rows;
 if(resource==='blocked-times'){if(!Number.isSafeInteger(filters.employeeId)||Number(filters.employeeId)<1)throw new Response('Select driver',{status:400});return (await db.query(`SELECT b.id,b.employee_id,b.start_time,b.end_time,b.reason,b.type FROM blocked_times b JOIN employees e ON e.id=b.employee_id AND e.tenant_id=$1 WHERE b.employee_id=$2 AND coalesce(b.is_deleted,false)=false ORDER BY b.start_time LIMIT 500`,[staff.tenantId,filters.employeeId])).rows;}
 if(resource==='vehicle-assignments')return (await db.query(`SELECT va.id AS assignment_id,va.vehicle_id,va.employee_id,v.name,v.category,v.passenger_capacity,v.year,v.color,v.plate,va.profile_image_url,va.profile_description FROM vehicle_assignments va JOIN employees e ON e.id=va.employee_id AND e.tenant_id=$1 JOIN vehicles v ON v.id=va.vehicle_id JOIN employees owner ON owner.id=v.employee_id AND owner.tenant_id=$1 WHERE NOT EXISTS(SELECT 1 FROM vehicle_assignments x JOIN employees other ON other.id=x.employee_id WHERE x.vehicle_id=v.id AND other.tenant_id IS DISTINCT FROM $1) AND ($2::int IS NULL OR va.vehicle_id=$2) AND ($3::int IS NULL OR va.employee_id=$3) ORDER BY va.id LIMIT 1000`,[staff.tenantId,filters.vehicleId||null,filters.employeeId||null])).rows;
 throw new Response('Management read unavailable',{status:404});
}

export async function readPassengerForBooking(db:Pick<Pool,'query'>,staff:Staff,id:number){
 if(!Number.isSafeInteger(id)||id<1)throw new Response('Invalid passenger',{status:400});
 const result=await db.query('SELECT id AS client_id,name,phone,email,notification_preference,street_address,city,state,zip_code FROM clients WHERE id=$1 AND tenant_id=$2',[id,staff.tenantId]);
 if(result.rows.length!==1)throw new Response('Passenger not found in your tenant',{status:404});
 return result.rows[0];
}
