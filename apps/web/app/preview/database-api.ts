import {readManagement} from '../lib/management-read.server';
import {readMessages} from '../lib/messages-read.server';
import {reviewTestOrder} from '../lib/review-order.server';
import {createTestPassenger} from '../lib/passenger-write.server';
import {bookingReviewEnabled,bookingReviewResource,BOOKING_REVIEW_STAFF} from '../lib/booking-review.server';
import {readEditableTrip,updateTestTrip} from '../lib/trip-edit.server';
import {readWizardData,saveWizardBooking} from '../lib/wizard-database.server';
import type {LoaderFunctionArgs,ActionFunctionArgs} from 'react-router';
import {saveBusinessSetting,createDatabaseBooking,inBusinessTransaction} from '../lib/business-write.server';
import {assignDatabaseTrip} from '../lib/assignment-write.server';
import {getAuth} from '../lib/auth.server';
import {resolveStaff} from '../lib/staff-reads.server';
import {requireSameOrigin} from '../lib/auth-core.server';
import {requireDashboardPreview} from '../lib/recovered-dashboard.server';
import {readReviewStaff} from '../lib/review-context.server';
import {getDatabase,authUnavailable} from '../lib/auth.server';
import {readStaffTimeline,readStaffDashboard} from '../lib/staff-reads.server';
export async function loader({request}:LoaderFunctionArgs){
 try{
 const staff=await readReviewStaff(request);const url=new URL(request.url);const resource=url.searchParams.get('resource');
 let result;
 if(resource?.startsWith('manage-'))result=await readManagement(getDatabase(),staff,resource.slice(7),Number(url.searchParams.get('page')||'1'));
 else if(resource==='messages')result=await readMessages(getDatabase(),staff,url.searchParams.get('conversation_id')||null,url.searchParams.get('phone')||null,url.searchParams.get('unread')==='1');
 else if(resource==='trip')result=await readEditableTrip(getDatabase(),staff,Number(url.searchParams.get('id')));
 else if(resource==='timeline')result=await readStaffTimeline(getDatabase(),staff,url.searchParams.get('date')||'');
 else if(resource==='settings')result=(await readStaffDashboard(getDatabase(),staff,1)).settings;
 else if(['services','drivers','clients','vehicles','vehicle-assignments'].includes(resource||''))result=await readWizardData(getDatabase(),staff,resource!,url.searchParams.get('search')||'');
 else throw new Response('Read endpoint unavailable',{status:404});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof Response)return Response.json({error:await error.text()},{status:error.status,headers:{'Cache-Control':'no-store'}});throw authUnavailable(error);}
}
export async function action({request}:ActionFunctionArgs){
 requireDashboardPreview(); requireSameOrigin(request);
 if(!['PATCH','POST'].includes(request.method))throw new Response('Method not allowed',{status:405});
 if(Number(request.headers.get('Content-Length')||0)>4096)throw new Response('Request too large',{status:413});
 try{
 const url=new URL(request.url);
 const resource=url.searchParams.get('resource');
 const review=bookingReviewEnabled();
 if(review&&!bookingReviewResource(resource))throw new Response('Temporary review allows only passenger lookup and limited test booking',{status:403});
 const staff=review?BOOKING_REVIEW_STAFF:await resolveStaff(getDatabase(),await getAuth().getUser(request));
 if(!['assignment','settings','booking','wizard-booking','lookup','passenger','trip-edit','review-order'].includes(resource||''))throw new Response('Write unavailable',{status:405});
 if(resource==='lookup'&&request.method==='POST'){const d=await request.json();const matches=await readWizardData(getDatabase(),staff,'clients',String(d.value||''));return Response.json({found:matches.length>0,client:matches[0]||null,all_matches:matches},{headers:{'Cache-Control':'no-store'}});}
 const raw=url.searchParams.get('id')||'';
 if(['assignment','trip-edit','review-order'].includes(resource||'')&&!/^[1-9]\d{0,9}$/.test(raw))throw new Response('Invalid trip',{status:400});
 const text=await request.text();if(text.length>4096)throw new Response('Request too large',{status:413});
 let body;try{body=JSON.parse(text);}catch{throw new Response('Invalid JSON',{status:400});}
 if(resource==='review-order'&&request.method==='POST')return Response.json(await reviewTestOrder(getDatabase(),staff,Number(raw),body),{headers:{'Cache-Control':'no-store'}});
 if(resource==='trip-edit'&&request.method==='PATCH')return Response.json(await inBusinessTransaction(getDatabase(),db=>updateTestTrip(db,staff,Number(raw),body)),{headers:{'Cache-Control':'no-store'}});
 if(resource==='passenger'&&request.method==='POST'){
 const passenger=await inBusinessTransaction(getDatabase(),db=>createTestPassenger(db,staff,body));
 return Response.json(passenger,{status:passenger.existing_id?409:201,headers:{'Cache-Control':'no-store'}});
 }
 if(resource==='wizard-booking'&&request.method==='POST')return Response.json(await inBusinessTransaction(getDatabase(),db=>saveWizardBooking(db,staff,body)),{status:201,headers:{'Cache-Control':'no-store'}});
 if(resource==='settings'&&request.method==='POST')return Response.json(await inBusinessTransaction(getDatabase(),db=>saveBusinessSetting(db,staff,body)),{headers:{'Cache-Control':'no-store'}});
 if(resource==='booking'&&request.method==='POST')return Response.json(await inBusinessTransaction(getDatabase(),db=>createDatabaseBooking(db,staff,body)),{status:201,headers:{'Cache-Control':'no-store'}});
 if(resource!=='assignment'||request.method!=='PATCH')throw new Response('Method not allowed',{status:405});
 return Response.json(await assignDatabaseTrip(getDatabase(),staff,Number(raw),body,review),{headers:{'Cache-Control':'no-store'}});
 }catch(error){if(error instanceof Response)return Response.json({error:await error.text()},{status:error.status,headers:{'Cache-Control':'no-store'}});throw authUnavailable(error);}
}
