import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function reviewTestOrder(db:Pick<Pool,'query'>,staff:Staff,id:number,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Staff required',{status:403});
 if(!Number.isSafeInteger(id)||id<1||!body||typeof body!=='object'||Array.isArray(body))throw new Response('Invalid review request',{status:400});
 const d=body as Record<string,unknown>;if(Object.keys(d).some(k=>k!=='decision')||!['approve','reject'].includes(String(d.decision)))throw new Response('Invalid review decision',{status:400});
 const status=d.decision==='approve'?'approved':'cancelled';
 const result=await db.query(`UPDATE appointments SET status=$3 WHERE id=$1 AND tenant_id=$2 AND booking_number LIKE 'TEST-%' AND status='needs_review' RETURNING id,status`,[id,staff.tenantId,status]);
 if(result.rowCount!==1)throw new Response('TEST order not awaiting review; refresh before continuing',{status:409});
 return result.rows[0];
}
