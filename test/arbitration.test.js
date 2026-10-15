import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execute,qualification} from '../server/modules/arbitration/engine.js';
import {visibleState,loadState} from '../server/modules/arbitration/routes.js';
import {blankState,wkey,addDays,iso,today,cadEntries,cadStats} from '../shared/arbitration.js';
import {testDb} from './sqlite-fixture.js';
const ca={id:1,name:'CA Admin',role:'ca',status:'ativo'},ja={id:2,name:'JA User',role:'ja',status:'ativo'},arb={id:3,name:'Arbitro Teste',role:'arb',status:'ativo'},other={id:4,name:'Other JA',role:'ja',status:'ativo'};
const fixture=()=>{const S=blankState();S.users=[ca,ja,arb,other].map(u=>({...u,email:'private@example.test',phone:'999999999',region:'Lisboa',funcs:['JA','CAD','LIN'],lv:{},courses:[],recNext:''}));return S;};
const tour=(S,actor=ca,changes={})=>{execute(S,actor,'tour',{name:'Torneio Teste',cat:'Campeonato Nacional (CN)',start:iso(addDays(wkey(today()),7)),end:iso(addDays(wkey(today()),14)),city:'Lisboa',region:'Lisboa',club:'CT Teste',needs:{JA:1,CAD:2,LIN:2},resp:[ja.id],...changes});return S.tours.at(-1);};
const propose=(S,t,u=arb)=>{execute(S,ja,'nomination',{t:t.id,u:u.id,fn:'CAD',days:[t.start]});return S.noms.at(-1);};
const rejects=(f,status)=>assert.throws(f,e=>e.status===status);
test('role and tournament-scoped permissions are enforced server side',()=>{
 const S=fixture();rejects(()=>tour(S,arb),403);const t=tour(S);
 rejects(()=>execute(S,other,'nomination',{t:t.id,u:arb.id,fn:'CAD',days:[t.start]}),403);
 const n=propose(S,t);rejects(()=>execute(S,ja,'convocation',{t:t.id,ids:[n.id]}),403);
 const out=execute(S,ca,'convocation',{t:t.id,ids:[n.id]});assert.equal(n.status,'confirmada');assert.equal(out.events[0].kind,'convocatoria');assert.ok(out.events[0].to.includes(ja.id));
});
test('weekly occupancy, capacity, duplicate nomination and day validation',()=>{
 const S=fixture(),t=tour(S),n=propose(S,t);rejects(()=>propose(S,t),409);
 rejects(()=>execute(S,ja,'nomination-days',{id:n.id,days:['2000-01-01']}),400);
 execute(S,ca,'convocation',{t:t.id,ids:[n.id]});const t2=tour(S,ca,{name:'Outro torneio'});rejects(()=>propose(S,t2),409);
 rejects(()=>execute(S,ja,'nomination-remove',{id:n.id}),403);
 execute(S,ca,'nomination-remove',{id:n.id});assert.equal(n.status,'anulada');assert.doesNotThrow(()=>propose(S,t2));
});
test('availability validates Sunday anchor and protects other people',()=>{
 const S=fixture(),wk=wkey(today());rejects(()=>execute(S,arb,'availability',{userId:ja.id,wk,days:[wk]}),403);
 rejects(()=>execute(S,arb,'availability',{wk:iso(addDays(wk,1)),days:[wk]}),400);
 execute(S,arb,'availability',{wk,days:[wk],note:'Depois das 18h'});assert.equal(S.avail[0].u,arb.id);
 execute(S,ca,'availability',{userId:arb.id,wk,days:[wk,iso(addDays(wk,7))]});assert.equal(S.avail.length,1);assert.equal(S.avail[0].days.length,2);
});
test('evaluations wait for tournament end and CA validation; private data is filtered',()=>{
 const S=fixture(),t=tour(S),n=propose(S,t);execute(S,ca,'convocation',{t:t.id,ids:[n.id]});rejects(()=>execute(S,ja,'evaluation',{n:n.id,score:7}),403);
 t.start=iso(addDays(today(),-10));t.end=iso(addDays(today(),-3));n.days=[t.start];execute(S,ja,'evaluation',{n:n.id,score:6,comment:'Bom trabalho'});
 assert.equal(visibleState(S,arb).evals.length,0);assert.equal(visibleState(S,other).evals.length,0);assert.equal(visibleState(S,arb).users.find(u=>u.id===ja.id).email,undefined);
 execute(S,ca,'evaluation-validate',{id:S.evals[0].id});assert.equal(visibleState(S,arb).evals[0].score,6);assert.equal(visibleState(S,other).stats[arb.id].average,6);
 rejects(()=>execute(S,ja,'evaluation',{n:n.id,score:7}),409);
});
test('CA appointments become approved logbook entries; manual entries require approval',()=>{
 const S=fixture(),t=tour(S),n=propose(S,t);execute(S,ca,'convocation',{t:t.id,ids:[n.id]});t.end=iso(addDays(today(),-1));t.start=iso(addDays(today(),-8));n.days=[t.start];
 assert.equal(cadEntries(S,arb.id)[0].status,'aprovado');
 execute(S,arb,'logbook-counts',{id:n.id,enc:10,sf:2});assert.equal(cadStats(cadEntries(S,arb.id)).enc,10);
 rejects(()=>execute(S,arb,'logbook',{tname:'Manual',date:iso(addDays(today(),1)),fn:'LIN',jaName:'JA'}),400);
 execute(S,arb,'logbook',{tname:'Manual',date:today(),fn:'CAD',enc:3,sf:1,jaName:'JA',tipo:'S'});const c=S.cad[0];
 execute(S,ca,'logbook-decision',{key:'c:'+c.id,approve:false,reason:'Corrige a data'});assert.equal(c.status,'recusado');
 execute(S,arb,'logbook',{...c,date:today()});assert.equal(c.status,'pendente');execute(S,ca,'logbook-decision',{key:'c:'+c.id,approve:true});rejects(()=>execute(S,arb,'logbook-delete',{id:c.id}),403);
});
test('club tournaments: assigned JA can register external and platform crew',()=>{
 const S=fixture(),t=tour(S,ca,{cat:'Torneio A',ja:arb.id,resp:[]});assert.equal(t.nom,false);assert.equal(S.noms[0].jaAuto,true);
 execute(S,arb,'crew',{t:t.id,ext:'Pessoa Externa',fn:'LIN',days:[t.start]});assert.equal(S.noms[1].ext,'Pessoa Externa');
 rejects(()=>execute(S,other,'crew',{t:t.id,ext:'X',fn:'LIN',days:[t.start]}),403);
 rejects(()=>execute(S,ca,'convocation',{t:t.id,ids:S.noms.map(n=>n.id)}),400);
});
test('qualification controls, level/date validation and partial batch imports',()=>{
 const S=fixture();rejects(()=>execute(S,arb,'qualification',{userId:arb.id,funcs:['JA']}),403);
 rejects(()=>qualification({funcs:['INVALID']}),400);rejects(()=>qualification({funcs:['CAD'],lv:{A:'Unknown'}}),400);
 execute(S,ca,'qualification',{userId:arb.id,funcs:['LIN'],lv:{},courses:[],recNext:'2030-01-01'});assert.deepEqual(S.users.find(u=>u.id===arb.id).funcs,['LIN']);
 const t=tour(S);const result=execute(S,ca,'tour-batch',{rows:[{...t,name:'Batch valid',id:undefined},{...t,name:'Invalid',end:'2000-01-01'}]});assert.deepEqual(result.result.results.map(r=>r.ok),[true,false]);assert.ok(!S.tours.some(t=>t.name==='Invalid'));
});
test('additive repository loads domain rows without core user secrets',async()=>{
 const db=testDb();try{await db.run('INSERT INTO users (name,email,role,pin_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)','Test User','test@test.pt','ca','secret',today(),today());const S=await loadState(db);assert.equal(S.users.length,1);assert.equal(S.users[0].pin_hash,undefined);assert.deepEqual(S.tours,[]);}finally{await db.close();}
});

test('the complete prototype demo fits the relational repository',async()=>{
 const {readFileSync}=await import('node:fs');const {persist}=await import('../server/modules/arbitration/routes.js');const reference=JSON.parse(readFileSync(new URL('./fixtures/demo-arbitration.json',import.meta.url),'utf8'));
 const db=testDb();try{const S=blankState(),mapping=new Map();for(const u of reference.users){const {id}=await db.run('INSERT INTO users (name,email,role,status,pin_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',u.name,u.email,u.profile,u.status,'unused',today(),today());mapping.set(u.id,id);S.users.push({...u,id,role:u.profile});}
 const uid=x=>x?mapping.get(x)||null:null;
 S.tours=reference.tours.map(t=>({...t,resp:t.resp.map(uid).filter(Boolean),ja:uid(t.ja)}));S.avail=reference.avail.map(a=>({...a,u:uid(a.u)}));S.noms=reference.noms.map(n=>({...n,u:uid(n.u),by:uid(n.by)}));S.evals=reference.evals.map(e=>({...e,u:uid(e.u),by:uid(e.by)}));S.cad=reference.cad.map(c=>({...c,u:uid(c.u),tid:c.tid||null}));
 await db.tx(()=>persist(db,blankState(),S));const loaded=await loadState(db);assert.equal(loaded.tours.length,27);assert.equal(loaded.noms.length,80);assert.equal(loaded.users.length,32);assert.equal(loaded.avail.length,75);
 }finally{await db.close();}
});
