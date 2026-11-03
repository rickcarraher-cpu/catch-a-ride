import type {Pool} from 'pg';
import type {Staff} from './staff-reads.server';
type DB=Pick<Pool,'query'>;
type Kind='drivers'|'passengers'|'services'|'vehicles';
const spec={
 drivers:{table:'employees',text:['name','first_name','last_name','email','phone','street_address','city','state','zip_code','notes','color','profile_image_url'],bool:['is_active','is_driver','is_tour_agent','can_cancel_trip','copy_communications_to_company'],num:['salary_rate','hourly_rate','rotation_order']},
 passengers:{table:'clients',text:['name','email','phone','notes','notification_preference','address','street_address','city','state','zip_code','cc_emails','referral_source'],bool:['is_active'],num:[]},
 services:{table:'services',text:['name','description'],bool:['is_active','is_variable_price','is_airport_service','is_addon','is_tip_addon','can_passenger_request'],num:['default_price','duration_minutes','display_order']},
 vehicles:{table:'vehicles',text:['name','year','color','plate','category'],bool:['is_active'],num:['employee_id','passenger_capacity']},
};
export function requireManagementStaff(staff:Staff){if(!staff.employeeId||(!staff.isAdmin&&!staff.isDispatcher)||!Number.isSafeInteger(staff.tenantId)||staff.tenantId<1)throw new Response('Staff access required',{status:403});}
const invalid=(message:string)=>new Response(message,{status:400});
export async function assertVehicle(db:DB,tenant:number,id:number){
 const row=await db.query(`SELECT v.id FROM vehicles v JOIN employees e ON e.id=v.employee_id AND e.tenant_id=$2 WHERE v.id=$1 AND NOT EXISTS(SELECT 1 FROM vehicle_assignments va LEFT JOIN employees d ON d.id=va.employee_id WHERE va.vehicle_id=v.id AND d.tenant_id IS DISTINCT FROM $2) FOR UPDATE OF v`,[id,tenant]);
 if(row.rows.length!==1)throw new Response('Vehicle not found in your tenant',{status:404});
}
export async function saveManagement(db:DB,staff:Staff,resource:string,id:number|null,input:unknown){
 requireManagementStaff(staff);if(!Object.hasOwn(spec,resource))throw invalid('Unknown management resource');
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid('Invalid form');
 const d={...input} as Record<string,unknown>;const cfg=spec[resource as Kind];
 if(id!==null&&(!Number.isSafeInteger(id)||id<1))throw invalid('Invalid record');
 if('id' in d){if(d.id!==id)throw invalid('Record mismatch');delete d.id;}
 let driverIds:unknown=undefined;
 if(resource==='vehicles'&&'assigned_driver_ids' in d){driverIds=d.assigned_driver_ids;delete d.assigned_driver_ids;}
 const allowed=new Set<string>([...cfg.text,...cfg.bool,...cfg.num]);
 for(const key of Object.keys(d)){
  if(!allowed.has(key))throw invalid(`Field ${key} is not permitted in management testing`);
  const val=d[key];
  if((cfg.text as readonly string[]).includes(key)){if(val!==null&&(typeof val!=='string'||val.length>(key==='notes'?4000:1000)))throw invalid(`Invalid ${key}`);if(typeof val==='string')d[key]=val.trim();}
  if((cfg.bool as readonly string[]).includes(key)&&typeof val!=='boolean')throw invalid(`Invalid ${key}`);
  if((cfg.num as readonly string[]).includes(key)&&val!==null){if(typeof val!=='number'||!Number.isFinite(val)||(val<0&&key!=='default_price')||Math.abs(val)>1000000)throw invalid(`Invalid ${key}`);if(['duration_minutes','display_order','passenger_capacity','employee_id','rotation_order'].includes(key)&&!Number.isSafeInteger(val))throw invalid(`Invalid ${key}`);}
 }
 if('email' in d&&d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email)))throw invalid('Invalid email');
 if('profile_image_url' in d&&d.profile_image_url&&!/^https:\/\//.test(String(d.profile_image_url)))throw invalid('Use an HTTPS image URL');
 if('salary_rate' in d&&d.salary_rate!==null&&Number(d.salary_rate)>1)throw invalid('Commission must be between 0 and 1');
 if(resource==='passengers'&&'notification_preference' in d&&!['both','email','sms','none'].includes(String(d.notification_preference)))throw invalid('Invalid notification preference');
 if(resource==='drivers'&&('first_name' in d||'last_name' in d)){
  if(typeof d.first_name!=='string'||typeof d.last_name!=='string'||!d.first_name||!d.last_name)throw invalid('First and last name required');
  d.name=`${d.first_name} ${d.last_name}`;
 }
 if(id===null&&(!d.name||typeof d.name!=='string'))throw invalid('Name required');
 if('name' in d&&!d.name)throw invalid('Name required');
 if(resource==='vehicles'){
  if(!Number.isSafeInteger(d.employee_id)||Number(d.employee_id)<1)throw invalid('Select a tenant driver as vehicle owner');
  if(!Array.isArray(driverIds)||driverIds.length>100||driverIds.some(x=>!Number.isSafeInteger(x)||x<1))throw invalid('Select assigned drivers');
  const ids=[...new Set([Number(d.employee_id),...driverIds as number[]])];
  for(const employee of ids){const found=await db.query('SELECT id FROM employees WHERE id=$1 AND tenant_id=$2 FOR SHARE',[employee,staff.tenantId]);if(found.rows.length!==1)throw invalid('Driver does not belong to this tenant');}
  if(id!==null)await assertVehicle(db,staff.tenantId,id);
  driverIds=ids;
 }else if(id!==null){
  const found=await db.query(`SELECT id${resource==='drivers'?',email,is_admin,is_dispatcher':''} FROM ${cfg.table} WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,[id,staff.tenantId]);
  if(found.rows.length!==1)throw new Response('Record not found in your tenant',{status:404});
  const old=found.rows[0];
  if(resource==='drivers'&&(old.is_admin||old.is_dispatcher)&&'email' in d&&String(d.email).toLowerCase()!==String(old.email||'').toLowerCase())throw new Response('Staff sign-in email changes require account administration',{status:403});
 }
 const keys=Object.keys(d);if(!keys.length)throw invalid('No editable fields');
 const returning='id,name'+(resource==='vehicles'?'':',tenant_id');
 let saved;
 if(id===null){const cols=resource==='vehicles'?keys:['tenant_id',...keys];const vals=resource==='vehicles'?Object.values(d):[staff.tenantId,...Object.values(d)];
  saved=await db.query(`INSERT INTO ${cfg.table} (${cols.join(',')}) VALUES (${cols.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING ${returning}`,vals);
 }else{const vals=[...Object.values(d),id];saved=await db.query(`UPDATE ${cfg.table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${vals.length} RETURNING ${returning}`,vals);}
 if(saved.rows.length!==1)throw new Response('Record changed; reload and retry',{status:409});
 const record=saved.rows[0];
 if(resource==='vehicles'){
  await db.query('DELETE FROM vehicle_assignments WHERE vehicle_id=$1 AND NOT (employee_id = ANY($2::int[]))',[record.id,driverIds]);
  for(const driver of driverIds as number[])await db.query('INSERT INTO vehicle_assignments (vehicle_id,employee_id) SELECT $1,$2 WHERE NOT EXISTS(SELECT 1 FROM vehicle_assignments WHERE vehicle_id=$1 AND employee_id=$2)',[record.id,driver]);
 }
 return record;
}
