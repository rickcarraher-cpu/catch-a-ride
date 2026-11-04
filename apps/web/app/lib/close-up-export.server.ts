import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
// Explicit projections: never SELECT *, credentials, tokens, integration settings,
// or arbitrary metadata-derived fields. This is intentionally NOT a full backup.
export const exportQueries = {
 appointments: `SELECT id,tenant_id,client_id,employee_id,start_time,status,booking_number,notes,vehicle_id,destination,pickup_address,dropoff_address,distance_miles,services_total,balance_due,payments_total,tips_total,payment_status,payment_method FROM appointments WHERE tenant_id=$1 ORDER BY id LIMIT 10001`,
 clients: `SELECT id,tenant_id,name,email,phone,notes FROM clients WHERE tenant_id=$1 ORDER BY id LIMIT 10001`,
 employees: `SELECT id,tenant_id,name,email,phone,is_active,is_admin,is_dispatcher FROM employees WHERE tenant_id=$1 ORDER BY id LIMIT 10001`,
 services: `SELECT id,tenant_id,name,default_price,duration_minutes,is_active,is_addon,is_tip_addon FROM services WHERE tenant_id=$1 ORDER BY id LIMIT 10001`,
 appointment_services: `SELECT s.id,s.appointment_id,s.service_id,s.service_price,s.duration_minutes,s.quantity,s.stop_description FROM appointment_services s JOIN appointments a ON a.id=s.appointment_id JOIN services v ON v.id=s.service_id WHERE a.tenant_id=$1 AND v.tenant_id=$1 ORDER BY s.id LIMIT 10001`,
 vehicles: `SELECT v.id,v.employee_id,v.name,v.year,v.color,v.plate,v.is_active,v.category,v.passenger_capacity FROM vehicles v JOIN employees e ON e.id=v.employee_id WHERE e.tenant_id=$1 AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va JOIN employees other ON other.id=va.employee_id WHERE va.vehicle_id=v.id AND other.tenant_id IS DISTINCT FROM $1) ORDER BY v.id LIMIT 10001`,
 vehicle_assignments: `SELECT va.id,va.vehicle_id,va.employee_id FROM vehicle_assignments va JOIN employees e ON e.id=va.employee_id JOIN vehicles v ON v.id=va.vehicle_id JOIN employees owner ON owner.id=v.employee_id WHERE e.tenant_id=$1 AND owner.tenant_id=$1 AND NOT EXISTS(SELECT 1 FROM vehicle_assignments x JOIN employees other ON other.id=x.employee_id WHERE x.vehicle_id=v.id AND other.tenant_id IS DISTINCT FROM $1) ORDER BY va.id LIMIT 10001`,
};
export async function createOperationalExport(pool:Pick<Pool,'connect'>,tenantId:number){
 if(!Number.isSafeInteger(tenantId)||tenantId<1)throw new Response('Invalid tenant',{status:400});
 const client=await pool.connect();
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout = '15s'");
  const records:Record<string,unknown[]>={},counts:Record<string,number>={};
  for(const [table,sql] of Object.entries(exportQueries)){
   const r=await client.query(sql,[tenantId]);
   if(r.rows.length>10000)throw new Response('Export exceeds safe row limit; no partial file was created',{status:413});
   records[table]=r.rows;counts[table]=r.rows.length;
  }
  const serialized=JSON.stringify(records);
  if(Buffer.byteLength(serialized)>15*1024*1024)throw new Response('Export exceeds safe size limit; no partial file was created',{status:413});
  const result={format:'catcharide-operational-subset-v1',tenant_id:tenantId,generated_at:new Date().toISOString(),complete_backup:false,warning:'PRIVATE customer/staff data. Selected fields only. Not a restore file or full backup. Do not upload to chat.',excluded:['authentication and credentials','all settings and provider configuration','confirmation/action tokens','payments ledger and payroll history','tours/weddings and other tables','unowned/shared vehicles and invalid service relationships'],counts,sha256: createHash('sha256').update(serialized).digest('hex'),records};
  await client.query('COMMIT');return result;
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
