export async function messagesFetch(input:string,init:RequestInit={}){
 if(typeof window==='undefined'||window.location.pathname!=='/preview/database-messages')throw new Error('Message history unavailable');
 if((init.method||'GET')!=='GET')return Response.json({error:'Sending, read-status changes and deletion are disabled in this history-only connection. No message sent.'},{status:501});
 const url=new URL(input,window.location.origin);
 if(url.pathname==='/api/sms/conversations')return fetch(`/preview/database-api?resource=messages&unread=${url.searchParams.get('unread_only')==='true'?1:0}`,{credentials:'same-origin'});
 if(url.pathname==='/api/sms/messages/thread')return fetch(`/preview/database-api?resource=messages&conversation_id=${encodeURIComponent(url.searchParams.get('conversation_id')||'')}&phone=${encodeURIComponent(url.searchParams.get('phone')||'')}`,{credentials:'same-origin'});
 return Response.json({error:'Recipient lookup unavailable in history-only connection'},{status:501});
}
