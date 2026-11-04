import {Link,redirect,useLoaderData} from 'react-router';import type {LoaderFunctionArgs} from 'react-router';import {readReviewStaff} from '../lib/review-context.server';import {authUnavailable} from '../lib/auth.server';
const details:Record<string,{title:string;description:string}>={
 'wedding-trips':{title:'Wedding-trip creation · deferred',description:'You deferred Add Trips to Wedding with the unfinished wedding features. No wedding-trip editor exists in the recovered source. No records have changed.'},
 'tour-creation':{title:'Tour creation · unfinished',description:'Tour review is connected, but participant/itinerary creation is not yet integrated. This is not a working tour booking page.'},
 'import':{title:'Bulk import/restore · unavailable',description:'The legacy bulk importer can replace records destructively. No import or restore has run. The operational subset export is not a restore file.'},
};
export async function loader({request}:LoaderFunctionArgs){try{await readReviewStaff(request);const key=new URL(request.url).searchParams.get('feature')||'';if(!Object.hasOwn(details,key))throw new Response('Unknown deferred feature',{status:404});return details[key];}catch(e){if(e instanceof Response){if(e.status===401)return redirect('/account/signin');throw e;}throw authUnavailable(e);}}
export function headers(){return {'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};}
export default function Deferred(){const data=useLoaderData<typeof loader>();return <main><h1>{data.title}</h1><p>{data.description}</p><p><Link to="/preview/database">Dashboard</Link> · <Link to="/preview/advanced/tours">Review Tours</Link> · <Link to="/preview/advanced/weddings">Review Weddings</Link></p></main>;}
