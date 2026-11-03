import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';import {requireManagementStaff} from './management-write.server';
type DB=Pick<Pool,'query'>;
export async function readAvailability(db:DB,staff:Staff,recurring=false,employeeId:number|null=null){
 if(employeeId!==null&&(!Number.isSafeInteger(employeeId)||employeeId<1))throw new Response('Invalid driver',{status:400});
 const table=recurring?'recurring_blocked_times':'blocked_times';
 const fields=recurring?'b.id,b.employee_id,b.start_time,b.end_time,b.frequency,b.day_of_week,b.reason,b.num_occurrences,b.type,b.created_at':'b.id,b.employee_id,b.start_time,b.end_time,b.reason,b.type,b.recurring_blocked_time_id';
 const r=await db.query(`SELECT ${fields},e.name AS employee_name,e.color AS employee_color FROM ${table} b JOIN employees e ON e.id=b.employee_id AND e.tenant_id=$1 WHERE coalesce(b.is_deleted,false)=false AND ($2::int IS NULL OR b.employee_id=$2) ORDER BY b.id DESC LIMIT 5001`,[staff.tenantId,employeeId]);
 if(r.rows.length>5000)throw new Response('Availability list exceeds 5000 records',{status:422});return r.rows;
}
export async function writeAvailability(db:DB,staff:Staff,id:number|null,body:unknown,remove=false){
 requireManagementStaff(staff);
 if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw new Response('Invalid availability record',{status:400});
 if(id!==null){const found=await db.query('SELECT b.id FROM blocked_times b JOIN employees e ON e.id=b.employee_id AND e.tenant_id=$2 WHERE b.id=$1 AND coalesce(b.is_deleted,false)=false FOR UPDATE OF b',[id,staff.tenantId]);if(found.rows.length!==1)throw new Response('Availability not found in your tenant',{status:404});}
 if(remove){if(id===null)throw new Response('Select availability',{status:400});await db.query('UPDATE blocked_times SET is_deleted=true WHERE id=$1',[id]);return {id,removed:true};}
 const d=body as Record<string,unknown>;const fields=['employee_id','start_time','end_time','reason','type'];
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!fields.includes(k)))throw new Response('Invalid availability fields',{status:400});
 if(!Number.isSafeInteger(d.employee_id)||Number(d.employee_id)<1)throw new Response('Select a driver',{status:400});
 for(const key of ['start_time','end_time'])if(typeof d[key]!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(String(d[key]))||!Number.isFinite(Date.parse(String(d[key]))))throw new Response('Valid timezone-qualified start/end required',{status:400});
 const duration=Date.parse(String(d.end_time))-Date.parse(String(d.start_time));if(duration<=0||duration>366*86400000)throw new Response('End must follow start within one year',{status:400});
 if(!['blocked','available'].includes(String(d.type||'blocked')))throw new Response('Invalid availability type',{status:400});
 if(d.reason!=null&&(typeof d.reason!=='string'||d.reason.length>2000))throw new Response('Invalid reason',{status:400});
 const driver=await db.query('SELECT id FROM employees WHERE id=$1 AND tenant_id=$2 FOR SHARE',[d.employee_id,staff.tenantId]);if(driver.rows.length!==1)throw new Response('Driver not found in your tenant',{status:404});
 const values=[d.employee_id,d.start_time,d.end_time,d.reason||null,d.type||'blocked'];
 const saved=id===null?await db.query('INSERT INTO blocked_times(employee_id,start_time,end_time,reason,type,is_deleted) VALUES($1,$2,$3,$4,$5,false) RETURNING id',values):await db.query('UPDATE blocked_times SET employee_id=$1,start_time=$2,end_time=$3,reason=$4,type=$5 WHERE id=$6 RETURNING id',[...values,id]);
 return saved.rows[0];
}
