export async function databaseOperationsFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||!['/preview/blocked-times','/preview/manage-availability','/preview/communication-log'].includes(window.location.pathname))throw new Error('Operation unavailable');
 const u=new URL(input,window.location.origin),method=init.method||'GET';let endpoint;
 if(u.pathname==='/api/employees'&&method==='GET')endpoint='/preview/database-api?resource=manage-drivers';
 else if(u.pathname==='/api/email/logs'&&method==='GET')endpoint='/preview/communication-api?kind=email&page='+(new URLSearchParams(window.location.search).get('page')||'1');
 else if(u.pathname==='/api/sms/messages'&&method==='GET')endpoint='/preview/communication-api?kind=sms&page='+(new URLSearchParams(window.location.search).get('page')||'1');
 else {const m=u.pathname.match(/^\/api\/blocked-times(\/recurring)?(?:\/(\d+))?$/);if(!m)throw new Error('Recurring generation and bulk cleanup are not connected; no data changed');if(m[1]&&method!=='GET')throw new Error('Recurring series writes/generation are not connected yet');const p=new URLSearchParams(u.searchParams);if(m[1])p.set('recurring','1');if(m[2])p.set('id',m[2]);endpoint='/preview/availability-api?'+p;}
 const r=await fetch(endpoint,{...init,credentials:'same-origin'});if(!r.ok){const d=await r.json().catch(()=>({error:'Request failed'}));throw new Error(d.error||'Operation failed');}return r;
}
