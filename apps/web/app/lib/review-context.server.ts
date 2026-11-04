import {bookingReviewEnabled} from './booking-review.server';
import {getAuth,getDatabase} from './auth.server';
import {resolveStaff} from './staff-reads.server';
import {temporaryReviewEnabled} from './temporary-review.server';
import {requireDashboardPreview} from './recovered-dashboard.server';
export async function readReviewStaff(request:Request){
 requireDashboardPreview();
 if(temporaryReviewEnabled()||bookingReviewEnabled())return {employeeId:0,tenantId:1,isAdmin:false,isDispatcher:false};
 if(!request.headers.get('Cookie')?.includes('car_session='))throw new Response('Sign-in required',{status:401});
 return resolveStaff(getDatabase(),await getAuth().getUser(request));
}
