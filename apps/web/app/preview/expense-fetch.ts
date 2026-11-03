export async function expenseFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||window.location.pathname!=='/preview/expenses')throw new Error('Expense transport unavailable');const u=new URL(input,window.location.origin),method=init.method||'GET';let endpoint;
 if(u.pathname==='/api/settings/expense-categories'&&method==='GET')endpoint='/preview/expenses-api?categories=1';
 else if(u.pathname==='/api/transactions'&&['GET','POST'].includes(method))endpoint='/preview/expenses-api?'+u.searchParams;
 else throw new Error('Financial history deletion and other transaction operations are disabled');
 const r=await fetch(endpoint,{...init,credentials:'same-origin'});if(!r.ok){const data=await r.json().catch(()=>({error:'Expense request failed'}));throw new Error(data.error||'Expense request failed');}return r;
}
