import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';import {saveWizardBooking} from './wizard-database.server';import {validateScheduleDay} from './schedule-read.server';
// Caller MUST use inBusinessTransaction. Both bookings/services commit or rollback together.
export async function saveRoundTrip(db:Pick<Pool,'query'>,staff:Staff,body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Response('Invalid round trip',{status:400});
 const {round_trip_return_time,round_trip_services,...outbound}=body as Record<string,unknown>;
 const end=round_trip_return_time,start=outbound.start_time;
 for(const value of [start,end]){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Response('Both pickup times require a valid date and timezone',{status:400});validateScheduleDay(value.slice(0,10));}
 if(Date.parse(end as string)<=Date.parse(start as string))throw new Response('Return pickup must be after outbound pickup',{status:400});
 // No partial mode flags, tour/wedding references, or external side effects accepted.
 if(outbound.is_tour||outbound.wedding_id||outbound._is_round_trip||outbound.return_date)throw new Response('Unsupported round-trip mode',{status:400});
 const back:Record<string,unknown>={...outbound,services:round_trip_services??outbound.services,start_time:end,employee_id:null,vehicle_id:null,outgoing_flight_info:null,return_date:null};
 for(const field of ['address','street','city','state','zip']){back[`pickup_${field}`]=outbound[`dropoff_${field}`]??null;back[`dropoff_${field}`]=outbound[`pickup_${field}`]??null;}
 // Keep per-leg fare/service quantities exactly as the original online wizard does.
 const first=await saveWizardBooking(db,staff,outbound);
 back.notes=[outbound.notes,`Return trip for booking #${first.booking_number}`].filter(Boolean).join('\n');
 const second=await saveWizardBooking(db,staff,back);
 await db.query("UPDATE appointments SET notes=concat_ws(E'\\n',notes,$3::text) WHERE id=$1 AND tenant_id=$2",[first.id,staff.tenantId,`Return booking #${second.booking_number}`]);
 return {...first,return_trip:second,is_round_trip:true};
}
