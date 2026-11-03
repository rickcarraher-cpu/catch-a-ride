import type {LoaderFunctionArgs} from 'react-router';import {readReviewStaff} from '../lib/review-context.server';import {getDatabase,authUnavailable} from '../lib/auth.server';import {readDailySchedule} from '../lib/schedule-read.server';import {readUnpaidReport} from '../lib/report-read.server';
export async function loader({request}:LoaderFunctionArgs){try{const staff=await readReviewStaff(request);const url=new URL(request.url);const type=url.searchParams.get('type');let result;
 if(type==='unpaid')result=await readUnpaidReport(getDatabase(),staff);
 else if(type==='trips')result=await readDailySchedule(getDatabase(),staff,url.searchParams.get('start')||'',url.searchParams.get('end')||'',true);
 else throw new Response('Unknown report',{status:404});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(e instanceof Response)return Response.json({error:await e.text()},{status:e.status,headers:{'Cache-Control':'no-store'}});throw authUnavailable(e);}}
