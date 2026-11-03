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
