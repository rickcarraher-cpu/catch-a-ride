import {useState} from 'react';
import {Link,useLocation,redirect} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Settings from '../../src/app/settings-2/page';
import Assignments from '../../src/app/schedule-timeline/page';
import {readReviewStaff} from '../lib/review-context.server';
import {authUnavailable} from '../lib/auth.server';
import './dashboard.css';
import './operations.css';
export async function loader({request}:LoaderFunctionArgs){try{await readReviewStaff(request);return null;}catch(error){if(error instanceof Response){if(error.status===401)return redirect('/account/signin');throw error;}throw authUnavailable(error);}}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseOperations(){const path=useLocation().pathname;const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}}));
 return <main className="sample-operations"><aside className="recovery-notice"><strong>IMPORTED TEST DATABASE · READ ONLY</strong><p>Actual imported records, not browser samples. Editing, dragging, uploads, messages, payments and cleanup are disabled. Timeline blocks use an illustrative 60-minute duration until service durations are connected.</p><Link to="/preview/database">Back to database dashboard</Link></aside><div onClickCapture={e=>{if((e.target as HTMLElement).closest('a'))e.preventDefault();}}><QueryClientProvider client={client}><div onMouseDownCapture={e=>{const el=e.target as HTMLElement;if(!el.closest('input[type="date"]'))e.stopPropagation();}}>{path.endsWith('settings')?<fieldset disabled><Settings/></fieldset>:<Assignments/>}</div></QueryClientProvider></div></main>;
}
