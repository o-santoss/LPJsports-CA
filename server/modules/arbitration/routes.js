import { execute } from './engine.js';
import { fromJson, toJson } from '../../core/db.js';
import { blankState, canManage } from '../../../shared/arbitration.js';
const sources=[['tours','arb_tournaments'],['avail','arb_availability'],['noms','arb_appointments'],['evals','arb_evaluations'],['cad','arb_logbook']];
export async function loadState(db){
 const S=blankState();
 const users=await db.all('SELECT id,name,email,phone,role,status,region,assoc,licence,addr,postal,tel,birth,photo,extra FROM users');
 const quals=new Map((await db.all('SELECT user_id,data FROM arb_qualifications')).map(r=>[r.user_id,fromJson(r.data,{})]));
 S.users=users.map(u=>{const q=quals.get(u.id)||fromJson(u.extra,{});return {...u,photoUrl:u.photo?'/api/photos/'+u.photo:null,extra:undefined,funcs:q.funcs||[],lv:q.lv||{},courses:q.courses||[],recNext:q.recNext||''};});
 for(const [key,table]of sources)S[key]=(await db.all(`SELECT data FROM ${table}`)).map(r=>fromJson(r.data,{}));
 return S;
}
export function visibleState(S,actor){
 const privileged=['ca','ja'].includes(actor.role);
 const stats=Object.fromEntries(S.users.map(u=>{const es=S.evals.filter(e=>e.u===u.id&&e.status==='validada');return [u.id,{average:es.length?es.reduce((s,e)=>s+e.score,0)/es.length:null}];}));
 return {...S,stats,
 users:S.users.filter(u=>actor.role==='ca'||u.status==='ativo'||u.id===actor.id).map(u=>{const {email,phone,addr,postal,tel,birth,...publicPart}=u;return actor.role==='ca'||u.id===actor.id?u:publicPart;}),
 noms:S.noms.map(n=>n.u===actor.id||actor.role==='ca'||S.tours.some(t=>t.id===n.t&&canManage(actor,t))?n:{id:n.id,u:n.u,ext:n.ext,t:n.t,fn:n.fn,days:n.days,status:n.status,convAt:n.convAt}),
 avail:privileged?S.avail:S.avail.filter(a=>a.u===actor.id),
 evals:S.evals.filter(e=>actor.role==='ca'||(e.u===actor.id&&e.status==='validada')||(e.by===actor.id&&S.tours.some(t=>t.id===e.t&&canManage(actor,t)))),
 cad:actor.role==='ca'?S.cad:S.cad.filter(c=>c.u===actor.id),
 // Only own records, public qualification data and tournament teams leave the server.
 };
}
export async function persist(db,before,after){
 // Delete children first to respect foreign keys.
 for(const [key,table]of [...sources].reverse()){
  const remaining=new Set(after[key].map(x=>x.id));for(const row of before[key])if(!remaining.has(row.id))await db.run(`DELETE FROM ${table} WHERE id = ?`,row.id);
 }
 for(const [key,table]of sources){
  const previous=new Map(before[key].map(x=>[x.id,JSON.stringify(x)]));
  for(const row of after[key]){
   const data=toJson(row);if(previous.get(row.id)===data)continue;
   const cols=key==='avail'?['user_id','week']:key==='noms'?['tournament_id','user_id']:key==='evals'?['appointment_id']:key==='cad'?['user_id','tournament_id']:[];
   const values=key==='avail'?[row.u,row.wk]:key==='noms'?[row.t,row.u]:key==='evals'?[row.n]:key==='cad'?[row.u,row.tid||null]:[];
   const columns=['id',...cols,'data'];await db.run(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT (id) DO UPDATE SET ${[...cols,'data'].map(c=>c+' = EXCLUDED.'+c).join(',')}`,row.id,...values,data);
  }
 }
 const q=u=>JSON.stringify({funcs:u.funcs,lv:u.lv,courses:u.courses,recNext:u.recNext});
 for(const u of after.users){const old=before.users.find(x=>x.id===u.id);if(!old||q(old)!==q(u))await db.run('INSERT INTO arb_qualifications (user_id,data) VALUES (?,?) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data',u.id,q(u));}
}
export function registerArbitrationRoutes(router,{db,notify,audit}){
 router.get('/api/arbitration/counts',async c=>{const S=await loadState(db);const {cadEntries}=await import('../../../shared/arbitration.js');return {canManage:S.tours.some(t=>canManage(c.user,t)),pending:c.user.role==='ca'?S.noms.filter(n=>n.status==='proposta').length+S.evals.filter(e=>e.status==='submetida').length+S.users.flatMap(u=>cadEntries(S,u.id)).filter(e=>e.status==='pendente').length:0};});
 router.get('/api/arbitration/state',async c=>visibleState(await loadState(db),c.user));
 router.post('/api/arbitration/command',async c=>{
  const outcome=await db.tx(async()=>{
   await db.exec("SELECT pg_advisory_xact_lock(hashtext('lpj-arbitration'))");
   const before=await loadState(db),after=structuredClone(before);
   const result=execute(after,c.user,c.body.action,c.body.data||{});await persist(db,before,after);return result;
  });
  await audit(c.user.id,'arbitragem:'+String(c.body.action).slice(0,80),null,null,c.ip);
  for(const event of outcome.events)await notify.send(event);
  return outcome.result;
 },{limit:1024*1024});
}
