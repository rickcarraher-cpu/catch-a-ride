import {Link,useLoaderData,redirect} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';
import {readReviewStaff} from '../lib/review-context.server';
import {databaseDashboardLink} from '../lib/recovered-dashboard.server';
import {authUnavailable} from '../lib/auth.server';
export async function loader({request}:LoaderFunctionArgs){try{await readReviewStaff(request);const destination=new URL(request.url).searchParams.get('destination')||'';const target=databaseDashboardLink(destination);if(target&&!target.startsWith('/preview/feature'))return redirect(target,{headers:{'Cache-Control':'no-store'}});return {destination:destination.startsWith('/')&&!destination.startsWith('//')?destination.slice(0,120):'Unknown feature'};}catch(e){if(e instanceof Response){if(e.status===401)return redirect('/account/signin');throw e;}throw authUnavailable(e);}}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function Feature(){const {destination}=useLoaderData<typeof loader>();return <main className="dashboard"><h1>Not connected for testing yet</h1><p>Requested original destination: {destination}</p><p>This link now has an explicit destination, but its operational feature has not been restored. No database mutation, payment, message, import or cleanup action was performed.</p><p><Link to="/preview/database">Back to database dashboard</Link></p><p><Link to="/preview/database?status=needs_review#database-trips">Review Orders — database-backed</Link></p></main>;}
