import {redirect,useLoaderData} from 'react-router';
import type {LoaderFunctionArgs} from 'react-router';
import {readReviewStaff} from '../lib/review-context.server';
import {authUnavailable} from '../lib/auth.server';
import {renderRecoveredDashboard} from '../lib/recovered-dashboard.server';
import './dashboard.css';
export async function loader({request}:LoaderFunctionArgs){
 try{await readReviewStaff(request);const u=new URL(request.url);
  if(['page','q','tests','status'].some(k=>u.searchParams.has(k))){const target=u.searchParams.get('status')==='needs_review'?'/preview/review-orders':'/preview/trips';u.searchParams.delete('status');return redirect(target+(u.searchParams.size?'?'+u.searchParams.toString():''),{headers:{'Cache-Control':'no-store'}});}
  return {markup:renderRecoveredDashboard('database')};
 }catch(e){if(e instanceof Response){if(e.status===401)return redirect('/account/signin');throw e;}throw authUnavailable(e);}
}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function DatabaseDashboard(){const {markup}=useLoaderData<typeof loader>();return <main className="recovery-preview"><aside className="recovery-notice"><strong>Test environment</strong><span> · Live site unchanged. External payments and messages disabled.</span></aside><div className="recovered-layout" dangerouslySetInnerHTML={{__html:markup}}/></main>;}
