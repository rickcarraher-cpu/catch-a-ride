import type {Pool} from 'pg';import type {Staff} from './staff-reads.server';
export async function createTestPassenger(db:Pick<Pool,'query'>,staff:Staff,body:unknown){
 if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher))throw new Response('Staff access required',{status:403});
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Response('Invalid passenger',{status:400});
 const d=body as Record<string,unknown>;const keys=['name','email','phone','notes','street_address','city','state','zip_code','referral_source','address','cc_emails'];
 for(const [key,value] of Object.entries(d))if(!keys.includes(key)&&key!=='notification_preference')throw new Response('Unsupported passenger field',{status:400});
 for(const key of keys)if(d[key]!=null&&(typeof d[key]!=='string'||String(d[key]).length>2000))throw new Response('Invalid passenger details',{status:400});
 const name=String(d.name||'').trim();if(!name||name.length>100)throw new Response('Passenger name required (maximum 100 characters)',{status:400});
 const email=String(d.email||'').trim().toLowerCase();const phone=String(d.phone||'').trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Response('Invalid passenger email',{status:400});
 const identity=email||phone.replace(/\D/g,'')||name.toLowerCase();
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`passenger:${staff.tenantId}:${identity}`]);
 if(email||phone){const found=await db.query(`SELECT id FROM clients WHERE tenant_id=$1 AND (( $2<>'' AND lower(trim(email))=$2) OR ($3<>'' AND regexp_replace(coalesce(phone,''),'[^0-9]','','g')=$3)) ORDER BY id LIMIT 2`,[staff.tenantId,email,phone.replace(/\D/g,'')]);
 if(found.rows.length>1)throw new Response('Multiple matching passengers; use passenger lookup instead',{status:409});
 if(found.rows.length===1)return {existing_id:found.rows[0].id};}
 const r=await db.query(`INSERT INTO clients(tenant_id,name,email,phone,notes,street_address,city,state,zip_code,referral_source,address,cc_emails,notification_preference)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'none') RETURNING id,name`,[staff.tenantId,name,email||null,phone||null,d.notes||null,d.street_address||null,d.city||null,d.state||null,d.zip_code||null,d.referral_source||null,d.address||null,d.cc_emails||null]);
 return r.rows[0];
}
