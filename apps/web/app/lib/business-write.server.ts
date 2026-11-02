import type {Pool} from 'pg';
import type {Staff} from './staff-reads.server';
export const EDITABLE_SETTINGS=['business_name','business_phone','business_address','business_hours_start','business_hours_end','booking_message','rate_per_mile','manual_mileage'] as const;
type Connection=Pick<Pool,'query'>;
function requireStaff(staff:Staff){if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher)||!Number.isSafeInteger(staff.tenantId)||staff.tenantId<1)throw new Response('Verified staff required',{status:403});}
export async function saveBusinessSetting(db:Connection,staff:Staff,body:unknown){
 requireStaff(staff);if(!staff.isAdmin)throw new Response('Administrator required',{status:403});
 const data=body as Record<string,unknown>;
 if(!data||typeof data.key!=='string'||!EDITABLE_SETTINGS.includes(data.key as typeof EDITABLE_SETTINGS[number])||typeof data.value!=='string'||data.value.length>2000)throw new Response('Setting not permitted',{status:400});
 if(data.key.startsWith('business_hours_')&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.value))throw new Response('Invalid time',{status:400});
 if(data.key==='rate_per_mile'&&(!data.value.trim()||!Number.isFinite(Number(data.value))||Number(data.value)<0||Number(data.value)>1000))throw new Response('Invalid rate',{status:400});
 if(data.key==='manual_mileage'&&!['yes','no'].includes(data.value))throw new Response('Invalid setting value',{status:400});
 // Serialize this settings key without requiring an unverified unique constraint.
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`settings:${staff.tenantId}:${data.key}`]);
 const updated=await db.query('UPDATE settings SET value=$3 WHERE tenant_id=$1 AND key=$2 RETURNING id',[staff.tenantId,data.key,data.value]);
 if(!updated.rowCount)await db.query('INSERT INTO settings (tenant_id,key,value) VALUES ($1,$2,$3)',[staff.tenantId,data.key,data.value]);
 return {key:data.key,value:data.value};
}
export async function createDatabaseBooking(db:Connection,staff:Staff,body:unknown){
 requireStaff(staff);const d=body as Record<string,unknown>;
 const allowed=new Set(['client_id','employee_id','start_time','pickup_address','dropoff_address','notes','num_people','vehicle_category']);
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!allowed.has(k)))throw new Response('Unsupported booking fields or mode',{status:400});
 if(!Number.isSafeInteger(d.client_id)||Number(d.client_id)<1)throw new Response('Existing passenger required',{status:400});
 const driver=d.employee_id??null;
 if(driver!==null&&(!Number.isSafeInteger(driver)||Number(driver)<1))throw new Response('Invalid driver',{status:400});
 if(typeof d.start_time!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(d.start_time)||!Number.isFinite(Date.parse(d.start_time)))throw new Response('Explicit timezone required',{status:400});
 for(const key of ['pickup_address','dropoff_address'])if(typeof d[key]!=='string'||!String(d[key]).trim()||String(d[key]).length>500)throw new Response('Pickup and destination required',{status:400});
 if(d.notes!==undefined&&(typeof d.notes!=='string'||d.notes.length>2000))throw new Response('Invalid notes',{status:400});
 if(d.num_people!==undefined&&(!Number.isInteger(d.num_people)||Number(d.num_people)<1||Number(d.num_people)>100))throw new Response('Invalid passenger count',{status:400});
 if(d.vehicle_category!==undefined&&(typeof d.vehicle_category!=='string'||d.vehicle_category.length>80))throw new Response('Invalid vehicle category',{status:400});
 const owner=await db.query('SELECT id FROM clients WHERE id=$1 AND tenant_id=$2 FOR SHARE',[d.client_id,staff.tenantId]);
 if(owner.rowCount!==1)throw new Response('Passenger not found in your tenant',{status:404});
 if(driver!==null){const found=await db.query('SELECT id FROM employees WHERE id=$1 AND tenant_id=$2 AND is_active=true FOR SHARE',[driver,staff.tenantId]);if(found.rowCount!==1)throw new Response('Eligible driver not found',{status:404});}
 const result=await db.query(`INSERT INTO appointments (tenant_id,client_id,employee_id,start_time,status,pickup_address,dropoff_address,notes,num_people,vehicle_category,booked_by)
 VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,'TEST DATABASE') RETURNING id,start_time,status`,[staff.tenantId,d.client_id,driver,d.start_time,d.pickup_address,d.dropoff_address,d.notes||null,d.num_people||1,d.vehicle_category||null]);
 return result.rows[0];
}
export async function inBusinessTransaction<T>(pool:Pick<Pool,'connect'>,work:(db:Connection)=>Promise<T>):Promise<T>{
 const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
