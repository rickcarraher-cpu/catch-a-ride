import type { Pool } from 'pg';
import type { SignedInUser } from './auth-core.server';
type Database = Pick<Pool, 'query'>;
export type Staff = { employeeId: number; tenantId: number; isAdmin: boolean; isDispatcher: boolean };
export async function resolveStaff(db: Database, user: SignedInUser | null): Promise<Staff> {
  if (!user) throw new Response('Sign-in required', { status: 401 });
  const result = await db.query(`SELECT id, tenant_id, is_admin, is_dispatcher
    FROM employees WHERE lower(trim(email)) = $1 ORDER BY id LIMIT 2`, [user.email.trim().toLowerCase()]);
  // Do not infer rights from driver availability or fall back to tenant 1.
  if (result.rows.length !== 1) throw new Response('Staff membership is missing or ambiguous', { status: 403 });
  const row = result.rows[0];
  if ((!row.is_admin && !row.is_dispatcher) || !Number.isSafeInteger(row.tenant_id) || row.tenant_id < 1) throw new Response('Staff access required', { status: 403 });
  return { employeeId: row.id, tenantId: row.tenant_id, isAdmin: row.is_admin === true, isDispatcher: row.is_dispatcher === true };
}
export const BUSINESS_SETTINGS = ['business_name','business_phone','business_address','business_hours_start','business_hours_end','timezone','rate_per_mile','manual_mileage','booking_message','booking_page_message','provider_label'];
export async function readStaffDashboard(db: Database, staff: Staff, page: number, search='', testsOnly=false, status='') {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Response('Invalid page', { status: 400 });
  if(status!==''&&status!=='needs_review')throw new Response('Invalid status filter',{status:400});
  if(search.length>100)throw new Response('Search too long',{status:400});
  const offset = (page - 1) * 50;
  const trips = await db.query(`SELECT a.id, a.start_time, a.status, a.booking_number,
    a.pickup_address, a.dropoff_address, a.vehicle_category, a.employee_id,
    a.distance_miles, a.balance_due, a.payment_status,
    c.name AS client_name, e.name AS employee_name
    FROM appointments a
    LEFT JOIN clients c ON c.id = a.client_id AND c.tenant_id = a.tenant_id
    LEFT JOIN employees e ON e.id = a.employee_id AND e.tenant_id = a.tenant_id
    WHERE a.tenant_id = $1 AND ($3='' OR position(lower($3) in lower(coalesce(a.booking_number,'')))>0 OR position(lower($3) in lower(coalesce(c.name,'')))>0)
    AND ($4::boolean=false OR a.booking_number LIKE 'TEST-%') AND ($5='' OR a.status=$5) ORDER BY a.created_at DESC NULLS LAST,a.id DESC LIMIT 51 OFFSET $2`, [staff.tenantId, offset,search,testsOnly,status]);
  const settings = await db.query(`SELECT key, value FROM settings WHERE tenant_id = $1 AND key = ANY($2::text[]) ORDER BY key, id`, [staff.tenantId, BUSINESS_SETTINGS]);
  const safe: Record<string, string> = {};
  for (const row of settings.rows) if (BUSINESS_SETTINGS.includes(row.key) && typeof row.value === 'string') safe[row.key] = row.value;
  return { trips: trips.rows.slice(0, 50), hasMore: trips.rows.length > 50, settings: safe, page };
}

export async function readStaffTimeline(db: Database, staff: Staff, day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0,10)!==day) throw new Response('Invalid date',{status:400});
  const drivers=await db.query(`SELECT id, name, color, is_active FROM employees WHERE tenant_id=$1 AND is_active=true ORDER BY name LIMIT 200`,[staff.tenantId]);
  const trips=await db.query(`SELECT a.id,a.start_time,a.status,a.booking_number,a.employee_id,a.pickup_address,a.dropoff_address,a.vehicle_category,a.num_people,a.is_tentative,a.tentative_reason,c.name AS client_name,e.name AS employee_name,60 AS duration_minutes
    FROM appointments a LEFT JOIN clients c ON c.id=a.client_id AND c.tenant_id=a.tenant_id
    LEFT JOIN employees e ON e.id=a.employee_id AND e.tenant_id=a.tenant_id
    WHERE a.tenant_id=$1 AND a.start_time >= ($2::date::timestamp AT TIME ZONE 'America/Chicago')
    AND a.start_time < (($2::date+1)::timestamp AT TIME ZONE 'America/Chicago')
    AND a.status NOT IN ('deleted','cancelled') ORDER BY a.start_time,a.id LIMIT 501`,[staff.tenantId,day]);
  if(trips.rows.length>500) throw new Response('More than 500 trips on this date; narrow the review before continuing.',{status:422});
  return {drivers:drivers.rows,trips:trips.rows};
}
