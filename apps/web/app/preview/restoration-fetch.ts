export async function restorationFetch(input:string,init:RequestInit={}){if(typeof window==='undefined'||!['/preview/timesheet-report','/preview/weddings-2','/preview/weddings-2-review'].includes(window.location.pathname))throw new Error('Restoration transport unavailable');if((init.method||'GET')!=='GET')throw new Error('Payroll submission/approval/rate edits and wedding saves/messages are not connected. Nothing changed.');const u=new URL(input,window.location.origin);let path;
 if(u.pathname==='/api/timesheets')path='/preview/restoration-api?type=payroll&'+u.searchParams;
 else if(u.pathname==='/api/weddings-2')path='/preview/restoration-api?type=weddings2&'+u.searchParams;
 else if(u.pathname==='/api/employees')path='/preview/database-api?resource=manage-drivers';
 else if(u.pathname==='/api/services')path='/preview/database-api?resource=manage-services';
 else if(u.pathname==='/api/clients')return Response.json([]);
 else if(/^\/api\/appointments\/\d+$/.test(u.pathname))path='/preview/database-api?resource=trip&id='+u.pathname.split('/').pop();
 else throw new Error('Operation is not connected in this review');
 const r=await fetch(path,{credentials:'same-origin'});if(!r.ok){const d=await r.json().catch(()=>({error:'Request failed'}));throw new Error(d.error||'Request failed');}return r;}
