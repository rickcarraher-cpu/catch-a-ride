import { Form, Link, redirect, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getAuth, getDatabase, authUnavailable } from '../lib/auth.server';
import { resolveStaff, readStaffDashboard } from '../lib/staff-reads.server';
import { renderRecoveredDashboard, requireDashboardPreview } from '../lib/recovered-dashboard.server';
import { TripsTable } from '../../src/components/Trips/TripsTable';
import './dashboard.css';
export async function loader({request}: LoaderFunctionArgs) {
  requireDashboardPreview();
  if (!request.headers.get('Cookie')?.includes('car_session=')) return redirect('/account/signin', {headers:{'Cache-Control':'no-store'}});
  try {
    const user = await getAuth().getUser(request);
    if (!user) return redirect('/account/signin', {headers:{'Cache-Control':'no-store'}});
    const staff = await resolveStaff(getDatabase(), user);
    const raw = new URL(request.url).searchParams.get('page') || '1';
    if (!/^[1-9]\d{0,3}$/.test(raw)) throw new Response('Invalid page', {status:400});
    const data = await readStaffDashboard(getDatabase(),staff,Number(raw));
    // Navigation in recovered layout remains isolated samples; explicitly label it.
    return {...data, markup:renderRecoveredDashboard(),tenantId:staff.tenantId};
  } catch(error) { if(error instanceof Response) throw error; throw authUnavailable(error); }
}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseDashboard(){
  const {trips,hasMore,settings,page,tenantId,markup}=useLoaderData<typeof loader>();
  return <main className="recovery-preview"><aside className="recovery-notice"><strong>Protected test database · READ ONLY · Tenant {tenantId}</strong><p>Imported records below are database-backed. Original layout links still open isolated samples, not real booking writes. No payments, email or SMS are enabled.</p><Form method="post" action="/account/logout"><button>Sign Out</button></Form></aside>
    <div className="recovered-layout" dangerouslySetInnerHTML={{__html:markup}} />
    <section className="dashboard-sample-trips"><h2>Imported bookings · Read only</h2><p>Up to 50 records per page, newest first. Actions are disabled; no updates are made.</p>
      <fieldset disabled><TripsTable sampleMode trips={trips} isLoading={false} error={null} onEdit={()=>{}} onDelete={()=>{}} onInvoice={()=>{}} onPay={()=>{}} onSendThankYou={null} onPageChange={()=>{}} /></fieldset>
      <nav>{page>1&&<Link to={`?page=${page-1}`}>Previous page</Link>} <span>Page {page}</span> {hasMore&&<Link to={`?page=${page+1}`}>Next page</Link>}</nav>
      <h2>Imported business settings · Read only</h2><p>Only explicitly allowed business values; no credential or sending settings.</p><dl>{Object.entries(settings).map(([key,value])=><div key={key}><dt><strong>{key}</strong></dt><dd>{value}</dd></div>)}</dl>
    </section></main>;
}
