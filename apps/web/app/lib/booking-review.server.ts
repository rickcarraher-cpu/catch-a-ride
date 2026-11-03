export const BOOKING_REVIEW_EXPIRY='2026-11-03T03:14:00Z';
export function bookingReviewEnabled(env:Record<string,string|undefined>=process.env,now=Date.now()){
 return env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='preview/bounded-booking-review'&&Number.isFinite(now)&&now<Date.parse(BOOKING_REVIEW_EXPIRY);
}
export function bookingReviewResource(resource:string|null){return resource==='passenger'||resource==='lookup'||resource==='wizard-booking';}
// Restricted test capability, not an app session or general administrator login.
export const BOOKING_REVIEW_STAFF={employeeId:51,tenantId:1,isAdmin:false,isDispatcher:true};
