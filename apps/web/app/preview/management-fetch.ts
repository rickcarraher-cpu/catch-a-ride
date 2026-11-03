export async function managementFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||!window.location.pathname.startsWith('/preview/manage/'))throw new Error('Management API unavailable');
 if((init.method||'GET')!=='GET')return Response.json({error:'Management writes are not implemented in this read-only batch. No record changed.'},{status:501});
 const url=new URL(input,window.location.origin);const resource=({'/api/employees':'drivers','/api/vehicles':'vehicles','/api/clients':'passengers','/api/services':'services','/api/vehicle-assignments':'vehicle-assignments'} as Record<string,string>)[url.pathname];
 if(!resource)return Response.json({error:'This management read is not connected yet'},{status:501});
 const page=new URLSearchParams(window.location.search).get('page')||'1';
 return fetch(`/preview/database-api?resource=manage-${resource}&page=${encodeURIComponent(page)}`,{credentials:'same-origin'});
}
