import { readFileSync } from 'node:fs';
import { config } from '../server/config.js';
import { openDb,now,toJson } from '../server/core/db.js';
import { hashPin } from '../server/core/auth.js';
import { blankState } from '../shared/arbitration.js';
import { persist } from '../server/modules/arbitration/routes.js';
const db=openDb(config.databaseUrl);
try {
 await db.tx(async()=>{
  await db.exec("SELECT pg_advisory_xact_lock(hashtext('lpj-arbitration'))");
  if(await db.get('SELECT id FROM users LIMIT 1')){console.log('A base já tem utilizadores. Nada foi alterado. Usa uma base de demonstração vazia.');return;}
  const reference=JSON.parse(readFileSync(new URL('../test/fixtures/demo-arbitration.json',import.meta.url),'utf8'));
  const S=blankState(),map=new Map();
  for(const u of reference.users){
   const {id}=await db.run('INSERT INTO users (name,email,phone,role,status,pin_hash,region,assoc,licence,addr,postal,tel,birth,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',u.name,u.email,u.phone,u.profile,u.status,hashPin(u.pin),u.region,u.assoc||'',u.licence||'',u.addr||'',u.postal||'',u.tel||'',u.birth||'',now(),now());
   map.set(u.id,id);S.users.push({...u,id,role:u.profile});
  }
  const mapped=uid=>uid?map.get(uid)||null:null;
  S.tours=reference.tours.map(t=>({...t,resp:t.resp.map(mapped).filter(Boolean),ja:mapped(t.ja)}));
  S.avail=reference.avail.map(a=>({...a,u:mapped(a.u)}));
  S.noms=reference.noms.map(n=>({...n,u:mapped(n.u),by:mapped(n.by),confBy:mapped(n.confBy)}));
  S.evals=reference.evals.map(e=>({...e,u:mapped(e.u),by:mapped(e.by),valBy:mapped(e.valBy)}));
  S.cad=reference.cad.map(c=>({...c,u:mapped(c.u),decBy:mapped(c.decBy),tid:c.tid||null}));
  await persist(db,blankState(),S);
  console.log(`Demonstração criada: ${S.users.length} utilizadores, ${S.tours.length} torneios, ${S.noms.length} nomeações.`);
  console.log('CA: ca1@example.test / 3690 · JA: ja1@example.test / 1470 · Árbitro: a1@example.test / 2580');
 });
}finally{await db.close();}
