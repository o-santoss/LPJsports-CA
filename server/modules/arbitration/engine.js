import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, notFound, conflict } from '../../core/http.js';
import { FUN, FORDER, LV, PISOS, REGIOES, today, wkey, wDays, tDays, live, canManage, busy, candidates, cadEntries, categoryMeta, norm } from '../../../shared/arbitration.js';
const id = () => randomUUID();
const text=(x,max=300)=>String(x??'').trim().slice(0,max);
const date=x=>{const s=text(x,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw badRequest('Data inválida.');return s;};
const ids=x=>[...new Set((Array.isArray(x)?x:[]).map(Number).filter(Number.isSafeInteger))];
const number=(x,min=0,max=1000)=>{const n=Number(x||0);if(!Number.isInteger(n)||n<min||n>max)throw badRequest('Número inválido.');return n;};
const requireCA=u=>{if(u.role!=='ca')throw forbidden();};
const item=(a,id)=>{const x=a.find(x=>x.id===id);if(!x)throw notFound();return x;};
const days=(x,allowed)=>{const out=[...new Set(Array.isArray(x)?x:[])].sort();if(!out.length||out.some(d=>!allowed.includes(d)))throw badRequest('Escolhe dias válidos.');return out;};
const fn=x=>{if(!FORDER.includes(x))throw badRequest('Função inválida.');return x;};
export function qualification(data={}) {
 const funcs=[...new Set(Array.isArray(data.funcs)?data.funcs:[])];if(!funcs.length||funcs.some(f=>!FORDER.includes(f)))throw badRequest('Escolhe pelo menos uma função.');
 const lv={};for(const k of Object.keys(LV)){const value=text(data.lv?.[k]);if(value&&!LV[k].o.includes(value))throw badRequest('Nível inválido.');lv[k]=value;}
 const recNext=data.recNext?date(data.recNext):'';
 const courses=(Array.isArray(data.courses)?data.courses:[]).slice(0,200).map(c=>({id:text(c.id)||id(),type:['Curso','Recertificação'].includes(c.type)?c.type:'Curso',name:text(c.name)||'Formação',date:date(c.date),place:text(c.place)}));
 const last=courses.filter(c=>c.type==='Recertificação').map(c=>c.date).sort().at(-1);if(last&&recNext&&recNext<=last)throw badRequest('A próxima recertificação tem de ser posterior à última.');
 return {funcs,lv,recNext,courses};
}
// Commands mutate an in-memory snapshot under the repository transaction lock.
// All actor permissions and state transitions are checked here, never trusted to React.
export function execute(S,actor,action,b={}) {
 const events=[];const current=new Date().toISOString();
 const tell=(to,kind,subject,body)=>{const targets=ids(to).filter(uid=>S.users.some(u=>u.id===uid));if(targets.length)events.push({to:targets,kind,subject,body,link:'/nomeacoes'});};
 const getTour=tid=>item(S.tours,tid);
 const manage=t=>{if(!canManage(actor,t))throw forbidden('Não tens acesso à gestão deste torneio.');};
 const person=uid=>{const u=S.users.find(u=>u.id===Number(uid)&&u.status==='ativo');if(!u)throw badRequest('Utilizador ativo não encontrado.');return u;};
 const checkBusy=(uid,t)=>{if(uid&&busy(S,uid,wkey(t.start),t.id))throw conflict('A pessoa já está nomeada noutro torneio nesta semana.');};
 const syncJA=t=>{
   const old=S.noms.filter(n=>n.t===t.id&&n.jaAuto);S.noms=S.noms.filter(n=>!old.includes(n));
   for(const n of old)if(n.u!==t.ja)tell([n.u],'equipa','Acesso retirado · '+t.name,'Deixaste de ser o Juiz-Árbitro indicado.');
   if(!t.nom&&t.ja){checkBusy(t.ja,t);const n=old.find(n=>n.u===t.ja)||{id:id(),u:t.ja,t:t.id,fn:'JA',status:'registada',by:actor.id,at:current,jaAuto:true};n.days=tDays(t);S.noms.push(n);if(!old.some(n=>n.u===t.ja))tell([t.ja],'acesso','Juiz-Árbitro · '+t.name,'Foste indicado como Juiz-Árbitro. Podes gerir a equipa em Gestão.');}
 };
 const tourInput=(d,previous)=>{
  const meta=categoryMeta(d.cat);const t={id:previous?.id||id(),name:text(d.name),cat:meta?.cat||text(d.cat),city:text(d.city),region:text(d.region),club:text(d.club),start:date(d.start),end:date(d.end),piso:text(d.piso)||'Terra batida',nom:d.nom!==false,scope:d.scope==='int'?'int':'nac',needs:{},resp:ids(d.resp),ja:d.ja?Number(d.ja):null,fptNo:text(d.fptNo,40)};
  if(meta){t.nom=meta.nom;t.scope=meta.scope;}
  if(!t.name||!t.cat||!t.city||!t.club||!REGIOES.includes(t.region)||!PISOS.includes(t.piso)||t.end<t.start||tDays(t).length>31)throw badRequest('Preenche os dados do torneio e verifica as datas (máximo 31 dias).');
  for(const f of FORDER)t.needs[f]=t.nom?number(d.needs?.[f],0,100):0;
  if(t.resp.some(uid=>person(uid).role!=='ja'))throw badRequest('Os responsáveis têm de ter perfil JA.');
  if(t.ja)person(t.ja);if(t.nom)t.ja=null;else t.resp=[];
  if(S.tours.some(x=>x.id!==t.id&&norm(x.name)===norm(t.name)&&x.start===t.start&&norm(x.city)===norm(t.city)))throw conflict('Torneio duplicado.');
  const ns=S.noms.filter(n=>n.t===t.id&&live(n)&&!n.jaAuto);
  if(previous&&previous.nom!==t.nom&&ns.length)throw conflict('Remove/anula a equipa antes de mudar o tipo de nomeação.');
  if(previous&&ns.some(n=>n.days.some(d=>!tDays(t).includes(d))))throw conflict('As novas datas excluem dias de nomeações existentes.');
  for(const f of FORDER)if(t.nom&&ns.filter(n=>n.fn===f).length>t.needs[f])throw conflict('As vagas não podem ser inferiores à equipa atual.');
  if(previous&&wkey(previous.start)!==wkey(t.start))for(const n of ns)checkBusy(n.u,t);
  return t;
 };
 switch(action){
 case 'qualification':{requireCA(actor);const u=S.users.find(u=>u.id===Number(b.userId));if(!u)throw notFound();Object.assign(u,qualification(b));break;}
 case 'availability':{const uid=Number(b.userId)||actor.id;if(uid!==actor.id)requireCA(actor);person(uid);const wk=date(b.wk);if(wkey(wk)!==wk)throw badRequest('A semana tem de começar num domingo.');const existing=S.avail.find(a=>a.u===uid&&a.wk===wk);if(b.remove){S.avail=S.avail.filter(a=>a!==existing);break;}const a={id:existing?.id||id(),u:uid,wk,days:days(b.days,wDays(wk)),note:text(b.note,1000),at:current};if(existing)Object.assign(existing,a);else S.avail.push(a);break;}
 case 'tour':{requireCA(actor);const previous=b.id?getTour(b.id):null;const t=tourInput(b,previous);if(previous)Object.assign(previous,t);else S.tours.push(t);syncJA(t);const added=t.resp.filter(uid=>!previous||!(b.previousResp||[]).includes(uid));tell(added,'acesso','Responsável de torneio · '+t.name,'Tens acesso à gestão deste torneio.');break;}
 case 'tour-delete':{requireCA(actor);getTour(b.id);if(S.noms.some(n=>n.t===b.id&&live(n)))throw conflict('O torneio tem equipa ativa.');S.tours=S.tours.filter(t=>t.id!==b.id);S.evals=S.evals.filter(e=>e.t!==b.id);S.noms=S.noms.filter(n=>n.t!==b.id);S.cad.forEach(c=>{if(c.tid===b.id)c.tid=null;});break;}
 case 'tour-batch':{requireCA(actor);const rows=Array.isArray(b.rows)?b.rows:[];if(!rows.length||rows.length>200)throw badRequest('Envia entre 1 e 200 torneios.');const results=[];for(const [index,row]of rows.entries()){const saved=structuredClone(S),eventCount=events.length;try{const t=tourInput(row);S.tours.push(t);syncJA(t);results.push({index,id:t.id,ok:true});}catch(e){Object.assign(S,saved);events.splice(eventCount);if(e.status)results.push({index,ok:false,error:e.message});else throw e;}}return {events,result:{results}};}
 case 'nomination':{const t=getTour(b.t);manage(t);if(!t.nom)throw badRequest('Usa o registo da equipa para este torneio.');if(t.end<today())throw badRequest('O torneio já terminou.');const u=person(b.u);const f=fn(b.fn);if(!u.funcs.includes(f))throw badRequest('A pessoa não tem esta função no perfil.');if(u.role==='ca')throw badRequest('Escolhe um árbitro.');if(S.noms.some(n=>n.t===t.id&&n.u===u.id&&live(n)))throw conflict('Já pertence à equipa.');checkBusy(u.id,t);if(S.noms.filter(n=>n.t===t.id&&n.fn===f&&live(n)).length>=t.needs[f])throw conflict('Não há vagas nesta função.');const n={id:id(),u:u.id,t:t.id,fn:f,days:days(b.days,tDays(t)),status:'proposta',by:actor.id,at:current};S.noms.push(n);tell([u.id],'selecao','Proposta de nomeação · '+t.name,`${actor.name} propôs-te para ${FUN[f]}. Dias: ${n.days.join(', ')}. Aguarda confirmação do CA.`);break;}
 case 'crew':{const t=getTour(b.t);manage(t);if(t.nom)throw badRequest('Este torneio requer proposta de nomeação.');const u=b.u?person(b.u):null;const ext=text(b.ext);if(!u&&!ext)throw badRequest('Escolhe uma pessoa ou escreve um nome.');if(u&&S.noms.some(n=>n.t===t.id&&n.u===u.id&&live(n)))throw conflict('Já pertence à equipa.');checkBusy(u?.id,t);const n={id:id(),u:u?.id||null,ext:u?'':ext,t:t.id,fn:fn(b.fn),days:days(b.days,tDays(t)),status:'registada',cadSt:'pendente',by:actor.id,at:current};S.noms.push(n);if(u)tell([u.id],'equipa','Equipa do torneio · '+t.name,`Foste registado como ${FUN[n.fn]}. Dias: ${n.days.join(', ')}.`);break;}
 case 'nomination-days':{const n=item(S.noms,b.id),t=getTour(n.t);manage(t);if(!live(n))throw badRequest('Nomeação inativa.');n.days=days(b.days,tDays(t));if(n.status==='registada'&&!n.jaAuto)n.cadSt='pendente';tell([n.u],n.status==='proposta'?'selecao':'alteracao','Alteração de dias · '+t.name,n.days.join(', '));break;}
 case 'nomination-remove':{const n=item(S.noms,b.id),t=getTour(n.t);manage(t);if(n.jaAuto)throw badRequest('Altera o JA na ficha do torneio.');if(n.status==='registada'){S.noms=S.noms.filter(x=>x!==n);}else{if(n.status==='confirmada')requireCA(actor);n.status=n.status==='proposta'?'recusada':'anulada';}tell([n.u,...t.resp],n.status==='recusada'?'recusa':'anulacao','Nomeação alterada · '+t.name,text(b.reason,1000)||'A nomeação foi retirada.');break;}
 case 'convocation':{requireCA(actor);const t=getTour(b.t);if(!t.nom)throw badRequest('Este torneio não tem convocatórias.');const selected=Array.isArray(b.ids)?b.ids:[];const ns=S.noms.filter(n=>n.t===t.id&&selected.includes(n.id)&&['proposta','confirmada'].includes(n.status));if(!ns.length)throw badRequest('Seleciona pelo menos uma pessoa.');for(const n of ns){person(n.u);checkBusy(n.u,t);n.status='confirmada';n.confAt=current;n.confBy=actor.id;n.convAt=current;}
 const all=S.noms.filter(n=>n.t===t.id&&n.status==='confirmada');const groups=b.split?[ns.filter(n=>n.fn!=='LIN'),ns.filter(n=>n.fn==='LIN')]:[ns];
 for(const group of groups.filter(g=>g.length)){const label=b.split?(group[0].fn==='LIN'?'Juízes de Linha':'Árbitros, Chefe e Supervisor'):'';const chief=all.find(n=>n.fn==='CHEFE');const name=n=>S.users.find(u=>u.id===n.u)?.name||n.ext;const body=`Ficam convocados para ${t.name}${label?' · '+label:''}.\n${t.start} a ${t.end}\n${t.club}, ${t.city}\n${label==='Juízes de Linha'&&chief?'Chefe de Árbitros: '+name(chief)+'\n':''}\n`+FORDER.map(f=>{const members=group.filter(n=>n.fn===f);return members.length?FUN[f]+'\n'+members.map(n=>'• '+name(n)+' — '+n.days.join(', ')).join('\n'):'';}).filter(Boolean).join('\n\n');tell([...group.map(n=>n.u),...t.resp],'convocatoria','Convocatória · '+t.name+(label?' · '+label:''),body);}
 break;}
 case 'evaluation':{const n=item(S.noms,b.n),t=getTour(n.t);manage(t);if(!t.nom||t.scope!=='nac'||t.end>=today()||n.status!=='confirmada'||n.u===actor.id||(actor.role!=='ca'&&t.resp.includes(n.u)))throw forbidden('Avaliação indisponível.');let e=S.evals.find(e=>e.n===n.id);if(e?.status==='validada')throw conflict('Avaliação já validada.');const data={id:e?.id||id(),n:n.id,u:n.u,t:t.id,fn:n.fn,score:number(b.score,1,7),comment:text(b.comment,2000),by:actor.id,at:current,status:actor.role==='ca'?'validada':'submetida'};if(e)Object.assign(e,data);else S.evals.push(data);if(data.status==='validada')tell([n.u],'avaliacao','Avaliação disponível · '+t.name,'A tua avaliação já está disponível no histórico.');break;}
 case 'evaluation-validate':{requireCA(actor);const es=b.all?S.evals.filter(e=>e.status==='submetida'):[item(S.evals,b.id)];for(const e of es){e.status='validada';e.valBy=actor.id;e.valAt=current;tell([e.u],'avaliacao','Avaliação disponível','A tua avaliação já está disponível no histórico.');}break;}
 case 'logbook':{let c=b.id?item(S.cad,b.id):null;if(c&&(c.u!==actor.id||c.status==='aprovado'))throw forbidden();const t=b.tid?getTour(b.tid):null;const dt=date(b.date),wk=wkey(dt),f=fn(b.fn);if(dt>today())throw badRequest('Só podes registar trabalho já realizado.');if(t&&(dt<t.start||dt>t.end||t.end>=today()))throw badRequest('A data não pertence a um torneio concluído.');const tname=t?.name||text(b.tname);if(!tname)throw badRequest('Indica o nome do torneio.');const jaName=f==='JA'?actor.name:text(b.jaName);if(!jaName)throw badRequest('Indica o Juiz-Árbitro.');if(t&&cadEntries(S,actor.id).some(e=>e.tid===t.id&&e.fn===f&&e.key!=='c:'+c?.id))throw conflict('Já existe um registo para este torneio/função.');const enc=f==='CAD'?number(b.enc,1):0,sf=f==='CAD'?number(b.sf,0,enc):0;const data={id:c?.id||id(),u:actor.id,tid:t?.id||null,tname,date:dt,wk,fn:f,enc,sf,jaName,tipo:text(b.tipo,30)||'S',fptNo:t?.fptNo||text(b.fptNo,40),status:'pendente',reason:'',at:current};if(c)Object.assign(c,data);else S.cad.push(data);break;}
 case 'logbook-delete':{const c=item(S.cad,b.id);if(c.u!==actor.id||c.status==='aprovado')throw forbidden();S.cad=S.cad.filter(x=>x!==c);break;}
 case 'logbook-counts':{const n=item(S.noms,b.id);if(n.u!==actor.id||n.fn!=='CAD'||!live(n)||getTour(n.t).end>=today())throw forbidden();n.enc=number(b.enc,1);n.sf=number(b.sf,0,n.enc);break;}
 case 'logbook-decision':{requireCA(actor);const entries=b.all?S.users.flatMap(u=>cadEntries(S,u.id).filter(e=>e.status==='pendente')):[S.users.flatMap(u=>cadEntries(S,u.id)).find(e=>e.key===b.key)];for(const e of entries){if(!e)throw notFound();const status=b.approve?'aprovado':'recusado',reason=b.approve?'':text(b.reason,1000);if(!b.approve&&!reason)throw badRequest('Indica o motivo da recusa.');if(e.src==='ca'||(e.src==='ja'&&e.jaAuto))throw badRequest('Este registo é automático.');const record=item(e.src==='self'?S.cad:S.noms,e.id);Object.assign(record,e.src==='self'?{status,reason,decBy:actor.id,decAt:current}:{cadSt:status,cadReason:reason});tell([e.u],b.approve?'cadok':'cadno','Caderneta · '+e.tname,b.approve?'Registo aprovado.':'Registo recusado: '+reason);}break;}
 case 'tournament-message':{const t=getTour(b.t);manage(t);const team=S.noms.filter(n=>n.t===t.id&&live(n)).map(n=>n.u),cand=candidates(S,t).map(x=>x.u.id);const to=b.group==='team'?team:b.group==='candidates'?cand:[...team,...cand];const subject=text(b.subject,160),body=text(b.body,5000);if(!subject||!body)throw badRequest('Preenche o assunto e a mensagem.');tell(to,'mensagem',subject,body);break;}
 default:throw badRequest('Operação desconhecida.');
 }
 return {events,result:{ok:true}};
}
