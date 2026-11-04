import type {LoaderFunctionArgs} from 'react-router';
import {readReviewStaff} from '../lib/review-context.server';
import {getDatabase,authUnavailable} from '../lib/auth.server';
import {createOperationalExport} from '../lib/close-up-export.server';
export async function loader({request}:LoaderFunctionArgs){
 try{const staff=await readReviewStaff(request);const data=await createOperationalExport(getDatabase(),staff.tenantId);return Response.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'attachment; filename="catcharide-PRIVATE-operational-subset.json"'}});}
 catch(e){if(e instanceof Response)return e;return authUnavailable(e);}
}
