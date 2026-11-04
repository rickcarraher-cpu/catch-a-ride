import {bookingReviewEnabled} from '../lib/booking-review.server';
import {useState} from 'react';
import {Link,useLocation,redirect,useLoaderData} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Settings from '../../src/app/settings-2/page';
import Assignments from '../../src/app/schedule-timeline/page';
import {readReviewStaff} from '../lib/review-context.server';
import {authUnavailable} from '../lib/auth.server';
import './dashboard.css';
import './operations.css';
export async function loader({request}:LoaderFunctionArgs){try{const staff=await readReviewStaff(request);return {canAssign:bookingReviewEnabled()||(staff.employeeId>0&&(staff.isAdmin||staff.isDispatcher)),canSettings:staff.employeeId>0&&staff.isAdmin};}catch(error){if(error instanceof Response){if(error.status===401)return redirect('/account/signin');throw error;}throw authUnavailable(error);}}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseOperations(){const {canAssign,canSettings}=useLoaderData<typeof loader>();const path=useLocation().pathname;const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}}));
 return <main className="sample-operations"><aside className="recovery-notice"><strong>IMPORTED TEST DATABASE · CONTROLLED TESTING</strong><p>Actual imported records, not browser samples. During temporary review, only TEST-numbered bookings can be assigned/unassigned. Pickup-time changes are disabled. Settings saves require authenticated admin access; other edits, uploads, messages, payments and cleanup remain disabled. Timeline blocks use stored service-line durations × quantities; trips with no eligible service lines use an estimated 60 minutes. This does not certify conflict-free scheduling.</p><Link to="/preview/database">Back to database dashboard</Link></aside><div onClickCapture={e=>{if((e.target as HTMLElement).closest('a'))e.preventDefault();}}><QueryClientProvider client={client}><div onMouseDownCapture={e=>{const el=e.target as HTMLElement;if(!canAssign&&!el.closest('input[type="date"]'))e.stopPropagation();}}>{path.endsWith('settings')?<fieldset disabled={!canSettings}><Settings/></fieldset>:<Assignments/>}</div></QueryClientProvider></div></main>;
}
