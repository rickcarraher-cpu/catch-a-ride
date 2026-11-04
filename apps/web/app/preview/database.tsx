import {bookingReviewEnabled,BOOKING_REVIEW_EXPIRY} from '../lib/booking-review.server';
import {useState} from 'react';
import { Form, Link, redirect, useLoaderData,useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getAuth, getDatabase, authUnavailable } from '../lib/auth.server';
import { resolveStaff, readStaffDashboard } from '../lib/staff-reads.server';
import { renderRecoveredDashboard, requireDashboardPreview } from '../lib/recovered-dashboard.server';
import { temporaryReviewEnabled, REVIEW_CONFIG } from '../lib/temporary-review.server';
import { TripsTable } from '../../src/components/Trips/TripsTable';
import './dashboard.css';
export async function loader({request}: LoaderFunctionArgs) {
  requireDashboardPreview();
  const temporary = temporaryReviewEnabled()||bookingReviewEnabled();
  if (!temporary && !request.headers.get('Cookie')?.includes('car_session=')) return redirect('/account/signin', {headers:{'Cache-Control':'no-store'}});
  try {
    let staff;
    if (temporary) {
      // Explicit owner-approved tenant for this Vercel-protected, read-only review.
      staff = { employeeId: 0, tenantId: 1, isAdmin: false, isDispatcher: false };
    } else {
      const user = await getAuth().getUser(request);
      if (!user) return redirect('/account/signin', {headers:{'Cache-Control':'no-store'}});
      staff = await resolveStaff(getDatabase(), user);
    }
    const raw = new URL(request.url).searchParams.get('page') || '1';
    if (!/^[1-9]\d{0,3}$/.test(raw)) throw new Response('Invalid page', {status:400});
    const url=new URL(request.url);const search=(url.searchParams.get('q')||'').trim();const testsOnly=url.searchParams.get('tests')==='1';
    const status=url.searchParams.get('status')||'';
    const data = await readStaffDashboard(getDatabase(),staff,Number(raw),search,testsOnly,status);
    // Every recovered navigation destination is audited against registered database routes.
    return {...data, markup:renderRecoveredDashboard('database'),search,testsOnly,status,tenantId:staff.tenantId, reviewExpires:temporary ? (bookingReviewEnabled()?BOOKING_REVIEW_EXPIRY:REVIEW_CONFIG.expiresAt) : null};
  } catch(error) { if(error instanceof Response) throw error; throw authUnavailable(error); }
}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseDashboard(){
  const {trips,hasMore,settings,page,tenantId,markup,reviewExpires,search,testsOnly,status}=useLoaderData<typeof loader>();
  const revalidator=useRevalidator();const [reviewMessage,setReviewMessage]=useState('');const [busy,setBusy]=useState(false);
  async function decide(id:number,decision:string){
    setBusy(true);setReviewMessage('');try{const r=await fetch(`/preview/database-api?resource=review-order&id=${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision}),credentials:'same-origin'});const result=await r.json();if(!r.ok)throw new Error(result.error||'Review failed');setReviewMessage(`TEST order ${result.status}. No notifications sent.`);revalidator.revalidate();}catch(e){setReviewMessage((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="recovery-preview"><aside className="recovery-notice"><strong>Protected test database · CONTROLLED TESTING · Tenant {tenantId}</strong><p>{reviewExpires ? `Temporary app-password-free review expires ${reviewExpires}. Access is controlled by Vercel Authentication, not an app session.` : "App-authenticated access."}</p><p>Imported records below are database-backed. Enabled dashboard links use this test database. Some operational actions remain restricted; deferred work is labeled separately. No payments, email or SMS are enabled.</p>{reviewExpires ? <p>Close this tab when finished. App logout does not revoke this temporary Vercel-authorized review window.</p> : <Form method="post" action="/account/logout"><button>Sign Out</button></Form>}</aside>
    <div className="recovered-layout" dangerouslySetInnerHTML={{__html:markup}} />
    <section id="database-trips" className="dashboard-sample-trips"><nav><Link to="/preview/online-book">Customer online booking (test)</Link> · <Link to="/preview/database-book">Book using test database (limited)</Link> · <Link to="/preview/database-assignments">Driver assignments (TEST edits)</Link> · <Link to="/preview/database-settings">Settings (staff-admin saves)</Link></nav><h2>{status==='needs_review'?'Review Orders · Awaiting dispatch review':'Database bookings · Newest created first'}</h2><p>Up to 50 records per page. Select a trip below to open its assignment date. Edit works for TEST bookings only. Payments, invoices and deletion remain disabled.</p>
      <Form method="get">{status&&<input type="hidden" name="status" value={status}/>}<label>Booking number or passenger name<input name="q" defaultValue={search} maxLength={100}/></label><label><input type="checkbox" name="tests" value="1" defaultChecked={testsOnly}/> TEST bookings only</label><button type="submit">Search bookings</button></Form>
      <nav><Link to="?status=needs_review#database-trips">Review Orders</Link> · <Link to="?tests=1#database-trips">Show test bookings</Link> · <Link to="#database-trips">Current results</Link></nav>
      <p role="status">{reviewMessage}</p><ul>{trips.map(trip=><li key={trip.id}><Link to={`/preview/database-assignments?date=${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date(trip.start_time))}`}>{trip.booking_number||`Trip ${trip.id}`} — {trip.client_name||'Passenger'} — {new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'short',timeStyle:'short'}).format(new Date(trip.start_time))} Central · Open assignments</Link> {String(trip.booking_number||'').startsWith('TEST-')&&<Link to={`/preview/database-edit?id=${trip.id}`}> · Edit test booking</Link>} {String(trip.booking_number||'').startsWith('TEST-')&&trip.status==='needs_review'&&<><button disabled={busy} onClick={()=>decide(trip.id,'approve')}>Approve TEST order — no sending</button><button disabled={busy} onClick={()=>decide(trip.id,'reject')}>Reject TEST order — no sending</button></>}</li>)}</ul>
      <TripsTable sampleMode databaseReview trips={trips} isLoading={false} error={null} onEdit={(id:number)=>{window.location.href=`/preview/database-edit?id=${id}`;}} onDelete={()=>{}} onInvoice={()=>{}} onPay={()=>{}} onSendThankYou={null} onPageChange={()=>{}} />
      <nav>{page>1&&<Link to={`?page=${page-1}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(search)}&tests=${testsOnly?1:0}#database-trips`}>Previous page</Link>} <span>Page {page}</span> {hasMore&&<Link to={`?page=${page+1}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(search)}&tests=${testsOnly?1:0}#database-trips`}>Next page</Link>}</nav>
      <h2>Imported business settings · Read only</h2><p>Only explicitly allowed business values; no credential or sending settings.</p><dl>{Object.entries(settings).map(([key,value])=><div key={key}><dt><strong>{key}</strong></dt><dd>{value}</dd></div>)}</dl>
    </section></main>;
}
