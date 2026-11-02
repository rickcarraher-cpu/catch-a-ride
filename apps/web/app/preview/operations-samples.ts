import { STORAGE_KEY, sampleWorkspace, decodeWorkspace, saveTrip } from './workspace-model';
import { sampleSettings, SETTINGS_KEY, SAFE_SETTINGS } from './sample-settings';
export { sampleSettings } from './sample-settings';
export function chicagoSampleTimestamp(when: string) {
  const probe = new Date(`${when.slice(0,10)}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',timeZoneName:'longOffset'}).formatToParts(probe).find(p=>p.type==='timeZoneName')?.value.replace('GMT','');
  return `${when}:00${offset || '-06:00'}`;
}
export function createOperationsFetch(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  return async (input: string, init: RequestInit = {}) => {
    if (!input.startsWith('/api/')) return Response.json({ error: 'External requests blocked in sample mode.' }, { status: 403 });
    const url = new URL(input, 'https://sample.invalid'); const method = (init.method || 'GET').toUpperCase();
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const raw = storage.getItem(STORAGE_KEY); const state = raw ? decodeWorkspace(raw) : sampleWorkspace();
    if (url.pathname === '/api/settings' && method === 'GET') return Response.json(sampleSettings(storage));
    if (url.pathname === '/api/settings' && method === 'POST') {
      if (!SAFE_SETTINGS.has(body.key) || typeof body.value !== 'string' || body.value.length > 2000) return Response.json({ error: 'This setting is disconnected in sample mode. Never enter real credentials.' }, { status: 403 });
      if (['business_hours_start','business_hours_end'].includes(body.key) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.value)) return Response.json({error:'Enter a valid time.'},{status:400});
      if (['rate_per_mile','credit_card_fee_percent'].includes(body.key) && (!Number.isFinite(Number(body.value)) || Number(body.value)<0 || Number(body.value)>1000)) return Response.json({error:'Enter a valid nonnegative sample rate.'},{status:400});
      storage.setItem(SETTINGS_KEY, JSON.stringify({ ...sampleSettings(storage), [body.key]: body.value }));
      return Response.json({ key: body.key, value: body.value });
    }
    if (url.pathname === '/api/blocked-times' && method === 'GET') return Response.json([]);
    if (url.pathname === '/api/schedule-timeline' && method === 'GET') {
      const drivers = state.drivers.map((d, i) => ({ ...d, id: i + 1, is_active: true, color: ['#2563eb','#16a34a','#9333ea'][i%3] }));
      const trips = state.trips.filter(t => t.status !== 'cancelled' && t.when.slice(0,10) === url.searchParams.get('date')).map(t => ({
        id: t.id, client_name: t.passenger, start_time: chicagoSampleTimestamp(t.when),
        duration_minutes: 60, employee_id: t.driverId ? state.drivers.findIndex(d => d.id === t.driverId) + 1 : null,
        pickup_address: t.pickup, dropoff_address: t.dropoff, status: t.status, booking_number: 'SAMPLE', is_tentative: false,
      }));
      return Response.json({ drivers, trips });
    }
    if (/^\/api\/appointments\/[^/]+$/.test(url.pathname) && method === 'PATCH') {
      const trip = state.trips.find(t => t.id === url.pathname.split('/')[3]);
      if (!trip) return Response.json({error:'Sample trip not found.'},{status:404});
      const index = body.employee_id == null ? -1 : Number(body.employee_id)-1;
      if (body.employee_id != null && (!Number.isInteger(index) || index<0 || index>=state.drivers.length)) return Response.json({error:'Unknown sample driver.'},{status:400});
      let when = trip.when;
      if (body.start_time) {
        const date = new Date(body.start_time);
        if (!Number.isFinite(date.getTime())) return Response.json({error:'Invalid sample time.'},{status:400});
        const parts = new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Chicago', year:'numeric', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date);
        const p = Object.fromEntries(parts.map(p=>[p.type,p.value])); when = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
      }
      storage.setItem(STORAGE_KEY, JSON.stringify(saveTrip(state, trip.id, { ...trip, when, driverId:index<0?'':state.drivers[index].id })));
      return Response.json({ id:trip.id, saved:true, send_notification:false });
    }
    return Response.json({error:'Disconnected in sample mode. No real data, charges or messages changed.'},{status:501});
  };
}
export async function operationsFetch(input: string, init?: RequestInit) {
  if(typeof window!=='undefined' && ['/preview/database-settings','/preview/database-assignments'].includes(window.location.pathname)){
    if((init?.method||'GET').toUpperCase()!=='GET'){
      const match=input.match(/^\/api\/appointments\/([1-9]\d*)$/);
      if(match && init?.method==='PATCH' && window.location.pathname==='/preview/database-assignments')return fetch(`/preview/database-api?resource=assignment&id=${match[1]}`,{...init,credentials:'same-origin'});
      return Response.json({error:'This database write is not enabled'},{status:405});
    }
    const url=new URL(input,window.location.origin);
    if(!input.startsWith('/api/'))return Response.json({error:'Unavailable in read-only review'},{status:403});
    if(url.pathname==='/api/schedule-timeline')return fetch(`/preview/database-api?resource=timeline&date=${encodeURIComponent(url.searchParams.get('date')||'')}`,{credentials:'same-origin'});
    if(url.pathname==='/api/settings')return fetch('/preview/database-api?resource=settings',{credentials:'same-origin'});
    return Response.json({error:'Not connected in database read-only review'},{status:501});
  }
  if (typeof window === 'undefined' || !['/preview/settings','/preview/assignments'].includes(window.location.pathname)) throw new Error('Sample operations unavailable outside isolated preview.');
  return createOperationsFetch(window.localStorage)(input, init);
}
