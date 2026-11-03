import {validateScheduleDay} from './schedule-read.server';
import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function readUnpaidReport(db:Pick<Pool,'query'>,staff:Staff){
 const result=await db.query(`SELECT a.id,a.booking_number,a.start_time,a.created_at,a.status,a.payment_status,a.destination,a.notes,a.num_people,
 a.payment_method,COALESCE(a.original_amount,0) AS original_amount,COALESCE(a.services_total,0) AS services_total,
 COALESCE(a.payments_total,0) AS payments_total,COALESCE(a.balance_due,0) AS balance_due,c.name AS client_name,c.phone AS client_phone,e.name AS employee_name,e.color AS employee_color,
 (a.balance_due>0 AND a.start_time<(date_trunc('day',now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')) AS is_past_due,
 (SELECT json_agg(json_build_object('name',s.name,'is_addon',s.is_addon) ORDER BY l.id) FROM appointment_services l JOIN services s ON s.id=l.service_id AND s.tenant_id=a.tenant_id WHERE l.appointment_id=a.id) AS services,
 (SELECT json_build_object('provider',p.provider,'status',p.status,'created_at',p.created_at) FROM payments p WHERE p.appointment_id=a.id AND p.status IN ('pending','link_created') ORDER BY p.created_at DESC,p.id DESC LIMIT 1) AS active_payment_link
 FROM appointments a LEFT JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id LEFT JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
 WHERE a.tenant_id=$1 AND coalesce(a.payment_status,'unpaid')<>'paid' AND coalesce(a.status,'') NOT IN ('deleted','cancelled','canceled')
 ORDER BY a.start_time,a.id LIMIT 5001`,[staff.tenantId]);
 if(result.rows.length>5000)throw new Response('More than 5000 unpaid records; totals would be incomplete',{status:422});
 const trips=result.rows.map(r=>({...r,balance_due:Number(r.balance_due),original_amount:Number(r.original_amount),payments_total:Number(r.payments_total)}));
 const cents=(rows:typeof trips)=>rows.reduce((sum,r)=>sum+Math.round(r.balance_due*100),0)/100;
 const past=trips.filter(r=>r.is_past_due);const linked=trips.filter(r=>r.active_payment_link);
 return {trips,summary:{total_unpaid:trips.length,total_amount_due:cents(trips),past_due_count:past.length,past_due_amount:cents(past),with_payment_link:linked.length,without_payment_link:trips.length-linked.length}};
}

export async function readPaymentPeriod(db:Pick<Pool,'query'>,staff:Staff,start:string,end:string){
 validateScheduleDay(start);validateScheduleDay(end);const span=(Date.parse(end)-Date.parse(start))/86400000;if(span<0||span>31)throw new Response('Select at most 32 days',{status:400});
 const r=await db.query(`SELECT a.id,a.booking_number,a.start_time,a.payment_date,a.status,a.payment_status,a.payment_method,a.destination,a.pickup_address,a.dropoff_address,a.pickup_street,a.pickup_city,a.dropoff_street,a.dropoff_city,a.notes,a.outgoing_flight_info,a.returning_flight_info,a.balance_due,a.original_amount,a.services_total,a.payments_total,a.tips_total,a.employee_id,c.name AS client_name,e.name AS employee_name,e.color AS employee_color FROM appointments a LEFT JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id LEFT JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND a.payment_date>=($2::date::timestamp AT TIME ZONE 'America/Chicago') AND a.payment_date<(($3::date+1)::timestamp AT TIME ZONE 'America/Chicago') AND coalesce(a.status,'')<>'deleted' ORDER BY a.payment_date,a.id LIMIT 5001`,[staff.tenantId,start,end]);
 if(r.rows.length>5000)throw new Response('Payment report exceeds 5000 records; totals incomplete',{status:422});
 const groupedTrips:Record<string,any[]>={};for(const trip of r.rows){const method=trip.payment_method||'Not Specified';(groupedTrips[method]??=[]).push(trip);}
 const sum=(rows:any[],key:string)=>rows.reduce((n,row)=>n+Math.round(Number(row[key]||0)*100),0)/100;
 const totals:Record<string,{count:number;payments_total:number;tips_total:number}>={};for(const [method,rows] of Object.entries(groupedTrips))totals[method]={count:rows.length,payments_total:sum(rows,'payments_total'),tips_total:sum(rows,'tips_total')};
 return {trips:r.rows,groupedTrips,totals,grandTotal:{count:r.rows.length,payments_total:sum(r.rows,'payments_total'),tips_total:sum(r.rows,'tips_total')},dateRange:{start,end}};
}
