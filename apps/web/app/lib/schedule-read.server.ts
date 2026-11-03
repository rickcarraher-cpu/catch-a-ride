import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export function validateScheduleDay(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw new Response('Select a valid schedule date',{status:400});}
export async function readDailySchedule(db:Pick<Pool,'query'>,staff:Staff,day:string,endDay=day,includeCancelled=false){
 validateScheduleDay(day);validateScheduleDay(endDay);
 const span=(Date.parse(endDay)-Date.parse(day))/86400000;if(span<0||span>6)throw new Response("Select at most seven days",{status:400});const cap=span===0?500:3500;
 const trips=await db.query(`SELECT a.id,a.tenant_id,a.client_id,a.employee_id,a.start_time,a.status,a.booking_number,a.is_tentative,a.tentative_reason,
 a.pickup_address,a.dropoff_address,a.pickup_street,a.pickup_city,a.pickup_state,a.pickup_zip,a.dropoff_street,a.dropoff_city,a.dropoff_state,a.dropoff_zip,
 a.destination,a.notes,a.driver_notes,a.num_people,a.num_bags_checked,a.num_bags_carry_on,a.outgoing_flight_info,a.returning_flight_info,a.return_date,
 a.vehicle_id,a.vehicle_category,a.driver_accepted,a.driver_declined_reason,a.passenger_confirmed,a.payment_method,a.payment_status,a.services_total,a.balance_due,a.payments_total,a.tips_total,
 a.distance_miles,a.distance_method,a.created_at,a.booked_by,a.booker_name,a.display_short_date,a.display_time,a.needs_receipt,
 c.name AS client_name,c.phone AS client_phone,c.email AS client_email,e.name AS employee_name,
 CASE WHEN ve.tenant_id=a.tenant_id AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va LEFT JOIN employees vd ON vd.id=va.employee_id WHERE va.vehicle_id=v.id AND vd.tenant_id IS DISTINCT FROM a.tenant_id) THEN v.name ELSE NULL END AS vehicle_name,
 COALESCE((SELECT json_agg(json_build_object('id',line.id,'service_id',line.service_id,'name',s.name,'service_price',line.service_price,'duration_minutes',line.duration_minutes,'quantity',line.quantity,'stop_description',line.stop_description) ORDER BY line.id)
 FROM appointment_services line JOIN services s ON s.id=line.service_id AND s.tenant_id=a.tenant_id WHERE line.appointment_id=a.id),'[]'::json) AS services
 FROM appointments a LEFT JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id
 LEFT JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
 LEFT JOIN vehicles v ON v.id=a.vehicle_id LEFT JOIN employees ve ON ve.id=v.employee_id
 WHERE a.tenant_id=$1 AND a.start_time>=($2::date::timestamp AT TIME ZONE 'America/Chicago')
 AND a.start_time<(($3::date+1)::timestamp AT TIME ZONE 'America/Chicago')
 AND coalesce(a.status,'')<>'deleted' AND ($4::boolean OR coalesce(a.status,'') NOT IN ('cancelled','canceled')) ORDER BY a.start_time,a.id LIMIT $5`,[staff.tenantId,day,endDay,includeCancelled,cap+1]);
 if(trips.rows.length>cap)throw new Response('Trip limit exceeded; selected schedule cannot be shown completely',{status:422});
 const drivers=await db.query('SELECT id,name,email,phone,color,is_active FROM employees WHERE tenant_id=$1 ORDER BY name,id LIMIT 1001',[staff.tenantId]);
 if(drivers.rows.length>1000)throw new Response('Driver limit exceeded; schedule cannot be shown completely',{status:422});
 const blocked=await db.query(`SELECT b.id,b.employee_id,b.start_time,b.end_time,b.reason,b.type FROM blocked_times b JOIN employees e ON e.id=b.employee_id AND e.tenant_id=$1
 WHERE coalesce(b.is_deleted,false)=false AND b.start_time<(($3::date+1)::timestamp AT TIME ZONE 'America/Chicago') AND b.end_time>=($2::date::timestamp AT TIME ZONE 'America/Chicago') ORDER BY b.start_time,b.id LIMIT 1001`,[staff.tenantId,day,endDay]);
 if(blocked.rows.length>1000)throw new Response('Blocked-time limit exceeded',{status:422});
 const setting=await db.query("SELECT value FROM settings WHERE tenant_id=$1 AND key='business_name' ORDER BY id DESC LIMIT 1",[staff.tenantId]);
 return {day,trips:trips.rows,drivers:drivers.rows,blockedTimes:blocked.rows,settings:{company_name:setting.rows[0]?.value||'Schedule'}};
}

export async function readCalendarMonth(db:Pick<Pool,'query'>,staff:Staff,month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Response('Invalid calendar month',{status:400});
 validateScheduleDay(month+'-01');
 const result=await db.query(`SELECT a.id,a.start_time,a.employee_id,a.status,a.is_tentative,a.booking_number
 FROM appointments a WHERE a.tenant_id=$1
 AND a.start_time>=($2::date::timestamp AT TIME ZONE 'America/Chicago')
 AND a.start_time<(($2::date+INTERVAL '1 month')::timestamp AT TIME ZONE 'America/Chicago')
 AND coalesce(a.status,'') NOT IN ('cancelled','canceled','deleted')
 AND coalesce(a.is_tentative,false)=false ORDER BY a.start_time,a.id LIMIT 5001`,[staff.tenantId,month+'-01']);
 if(result.rows.length>5000)throw new Response('More than 5000 trips in this month; calendar counts cannot be shown completely',{status:422});
 return {trips:result.rows};
}
