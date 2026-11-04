export async function managementFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||!window.location.pathname.startsWith('/preview/manage/'))throw new Error('Management API unavailable');
 const url=new URL(input,window.location.origin);
 const match=url.pathname.match(/^\/api\/(employees|vehicles|clients|services|vehicle-assignments|vehicle-categories|blocked-times)(?:\/(\d+))?$/);
 if(!match)throw new Error('This action is not connected; no record changed');
 const resource=({'employees':'drivers','clients':'passengers'} as Record<string,string>)[match[1]]||match[1];
 const method=init.method||'GET';let response:Response;
 if(method==='GET'){
 const page=new URLSearchParams(window.location.search).get('page')||'1';
 response=await fetch(`/preview/database-api?resource=manage-${resource}&page=${encodeURIComponent(page)}&${url.searchParams}`,{credentials:'same-origin'});
 }else{
 if(!['POST','PATCH'].includes(method))throw new Error('Hard deletion is disabled for testing; use deactivate instead');
 response=await fetch(`/preview/management-api?resource=${resource}${match[2]?'&id='+match[2]:''}`,{...init,credentials:'same-origin'});
 }
 if(!response.ok){const error=await response.json().catch(()=>({error:'Request failed'}));throw new Error(error.error||'Request failed');}
 return response;
}
