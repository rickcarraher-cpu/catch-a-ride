import type {Pool} from 'pg';
import type {Staff} from './staff-reads.server';
export async function assignDatabaseTrip(db:Pick<Pool,'query'>,staff:Staff,tripId:number,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Verified staff required',{status:403});
 if(!Number.isSafeInteger(tripId)||tripId<1||!body||typeof body!=='object')throw new Response('Invalid assignment',{status:400});
 const data=body as Record<string,unknown>;
 if(!Object.hasOwn(data,'employee_id'))throw new Response('Driver selection required',{status:400});
 const driver=data.employee_id;
 if(driver!==null&&(!Number.isSafeInteger(driver)||Number(driver)<1))throw new Response('Invalid driver',{status:400});
 // Assignment-only milestone: never accept rescheduling, prices, customer fields or service actions.
 if(data.start_time!==undefined)throw new Response('Time changes are disabled; move vertically to assign only',{status:400});
 const result=await db.query(`UPDATE appointments a SET employee_id=$3
 WHERE a.id=$1 AND a.tenant_id=$2 AND ($3::integer IS NULL OR EXISTS
 (SELECT 1 FROM employees e WHERE e.id=$3 AND e.tenant_id=$2 AND e.is_active=true))
 RETURNING a.id,a.employee_id,a.start_time`,[tripId,staff.tenantId,driver]);
 if(result.rowCount!==1)throw new Response('Trip or eligible driver not found in your tenant',{status:404});
 return result.rows[0];
}
