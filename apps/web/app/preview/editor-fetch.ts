export async function editorFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||window.location.pathname!=='/preview/database-edit')throw new Error('Editor API unavailable');
 const u=new URL(input,window.location.origin);const method=(init.method||'GET').toUpperCase();const id=new URLSearchParams(window.location.search).get('id')||'';
 if(input==='/api/settings'&&method==='GET')return fetch('/preview/database-api?resource=settings',{credentials:'same-origin'});
 if(u.pathname===`/api/appointments/${id}`&&method==='GET')return fetch(`/preview/database-api?resource=trip&id=${id}`,{credentials:'same-origin'});
 if(u.pathname==='/api/vehicles/categories'&&method==='GET'){const r=await fetch('/preview/database-api?resource=vehicles',{credentials:'same-origin'});if(!r.ok)return r;const vehicles=await r.json();if(!Array.isArray(vehicles))return Response.json({error:'Invalid vehicle list'},{status:502});return Response.json({categories:[...new Set(vehicles.map((v:{category:string})=>v.category).filter(Boolean))]});}
 if(u.pathname==='/api/vehicle-assignments'&&method==='GET')return fetch(`/preview/database-api?resource=vehicle-assignments&search=${encodeURIComponent(u.searchParams.get('employee_id')||'')}`,{credentials:'same-origin'});
 if(u.pathname==='/api/vehicles'&&method==='GET')return fetch('/preview/database-api?resource=vehicles',{credentials:'same-origin'});
 if(u.pathname==='/api/clients'&&method==='GET'){
  const r=await fetch(`/preview/database-api?resource=trip&id=${id}`,{credentials:'same-origin'});if(!r.ok)return r;const trip=await r.json();return Response.json([{id:trip.client_id,name:trip.client_name,email:trip.client_email,phone:trip.client_phone}]);
 }
 if(u.pathname===`/api/appointments/${id}`&&method==='PATCH')return fetch(`/preview/database-api?resource=trip-edit&id=${id}`,{...init,credentials:'same-origin'});
 return Response.json({error:'This operation is disconnected in the test metadata editor'},{status:501});
}
