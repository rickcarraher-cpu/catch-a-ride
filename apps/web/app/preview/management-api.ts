import type {ActionFunctionArgs} from 'react-router';
import {getDatabase,getAuth,authUnavailable} from '../lib/auth.server';
import {resolveStaff} from '../lib/staff-reads.server';
import {requireSameOrigin} from '../lib/auth-core.server';
import {requireDashboardPreview} from '../lib/recovered-dashboard.server';
import {bookingReviewEnabled,BOOKING_REVIEW_STAFF} from '../lib/booking-review.server';
import {saveManagement} from '../lib/management-write.server';
import {inBusinessTransaction} from '../lib/business-write.server';
export async function action({request}:ActionFunctionArgs){
 try{
 requireDashboardPreview();requireSameOrigin(request);
 if(!['POST','PATCH'].includes(request.method))throw new Response('Hard deletion is disabled; deactivate instead',{status:405});
 if(Number(request.headers.get('Content-Length')||0)>16384)throw new Response('Form too large',{status:413});
 const text=await request.text();if(text.length>16384)throw new Response('Form too large',{status:413});
 let body;try{body=JSON.parse(text);}catch{throw new Response('Invalid form JSON',{status:400});}
 const url=new URL(request.url),raw=url.searchParams.get('id');
 if(request.method==='PATCH'&&(!raw||!/^[1-9]\d{0,9}$/.test(raw)))throw new Response('Invalid record',{status:400});
 if(request.method==='POST'&&raw)throw new Response('Unexpected record',{status:400});
 const staff=bookingReviewEnabled()?BOOKING_REVIEW_STAFF:await resolveStaff(getDatabase(),await getAuth().getUser(request));
 if(!bookingReviewEnabled()&&!staff.isAdmin)throw new Response('Management administrator required',{status:403});
 const result=await inBusinessTransaction(getDatabase(),db=>saveManagement(db,staff,url.searchParams.get('resource')||'',raw?Number(raw):null,body));
 return Response.json(result,{status:request.method==='POST'?201:200,headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof Response)return Response.json({error:await error.text()},{status:error.status,headers:{'Cache-Control':'no-store'}});throw authUnavailable(error);}
}
