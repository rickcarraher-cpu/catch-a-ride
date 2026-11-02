import type {LoaderFunctionArgs,ActionFunctionArgs} from 'react-router';
import {readReviewStaff} from '../lib/review-context.server';
import {getDatabase,authUnavailable} from '../lib/auth.server';
import {readStaffTimeline,readStaffDashboard} from '../lib/staff-reads.server';
export async function loader({request}:LoaderFunctionArgs){
 try{
 const staff=await readReviewStaff(request);const url=new URL(request.url);const resource=url.searchParams.get('resource');
 let result;
 if(resource==='timeline')result=await readStaffTimeline(getDatabase(),staff,url.searchParams.get('date')||'');
 else if(resource==='settings')result=(await readStaffDashboard(getDatabase(),staff,1)).settings;
 else throw new Response('Read endpoint unavailable',{status:404});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof Response)throw error;throw authUnavailable(error);}
}
export function action(_args:ActionFunctionArgs){throw new Response('Database writes disabled on this read-only review',{status:405,headers:{'Cache-Control':'no-store'}});}
