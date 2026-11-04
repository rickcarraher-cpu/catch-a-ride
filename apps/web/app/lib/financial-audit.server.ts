import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
// Diagnostic comparisons only. Never repairs totals or substitutes calculated fares.
export async function readFinancialAudit(db:Pick<Pool,'query'>,staff:Staff){
 const result=await db.query(`SELECT a.id,a.booking_number,a.start_time,a.services_total,a.original_amount,a.balance_due,a.payments_total,
 x.line_count,x.line_total,x.foreign_line_count
 FROM appointments a LEFT JOIN LATERAL (
 SELECT count(s.id)::int AS line_count,coalesce(sum(s.service_price*coalesce(s.quantity,1)) FILTER(WHERE v.id IS NOT NULL),0) AS line_total,
 count(*) FILTER(WHERE v.id IS NULL)::int AS foreign_line_count
 FROM appointment_services s LEFT JOIN services v ON v.id=s.service_id AND v.tenant_id=a.tenant_id WHERE s.appointment_id=a.id
 ) x ON true
 WHERE a.tenant_id=$1 AND coalesce(a.status,'')<>'deleted' AND (
 a.services_total IS NULL OR a.balance_due IS NULL OR a.payments_total IS NULL
 OR (x.line_count>0 AND abs(a.services_total-x.line_total)>0.01)
 OR x.foreign_line_count>0 OR (a.original_amount IS NOT NULL AND a.original_amount<a.services_total) OR abs(a.balance_due-(coalesce(a.original_amount,a.services_total)-a.payments_total))>0.01)
 ORDER BY a.id DESC LIMIT 201`,[staff.tenantId]);
 return {trips:result.rows.slice(0,200),hasMore:result.rows.length>200};
}
