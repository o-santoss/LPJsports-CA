export const FUN={JA:'Juiz-Árbitro',SUP:'Supervisor',CHEFE:'Chefe de Árbitros',CAD:'Árbitro de Cadeira',LIN:'Juiz de Linha'};
export const FUNS={JA:'JA',SUP:'Supervisor',CHEFE:'Chefe',CAD:'Cadeira',LIN:'Linha'};
export const FORDER=['JA','SUP','CHEFE','CAD','LIN'];
export const GRP_A=['JA','SUP','CHEFE','CAD'];
export const LV={
 A:{l:'Árbitro',s:'Árbitro',o:['Nível 1 FPT','Nível 2 FPT','Nível 3 FPT','White Badge','Bronze Badge','Silver Badge']},
 J:{l:'Juiz-Árbitro',s:'JA',o:['Nível 1 FPT','Nível 2 FPT','Nível 3 FPT']},
 C:{l:'Chefe de Árbitros',s:'Chefe',o:['Nacional','White Badge','Internacional']},
 S:{l:'Supervisor',s:'Supervisor',o:['White Badge','Silver Badge']}
};
export const LVORDER=['J','S','C','A'],LVFORM=['A','J','C','S'];
export const COURSE_TYPES=['Recertificação','Curso'];
export const PLACES=['Complexo de Ténis do Jamor, Oeiras','CT Porto, Porto','CT Coimbra, Coimbra','CT Funchal, Funchal','Online'];
export const PROFILE={arb:'Árbitro',ja:'JA / Chefe de Árbitros',ca:'Conselho de Arbitragem'};
export const STATUS={ativo:['ok','Ativo'],pendente:['warn','Por aprovar'],suspenso:['bad','Suspenso'],recusado:['bad','Recusado']};
export const REGIOES=['Norte','Centro','Lisboa','Alentejo','Algarve','Madeira','Açores'];
export const PISOS=['Terra batida','Piso rápido','Relva sintética'];
// [grupo, nomeação pelo CA (1/0), [[categoria, âmbito]]]
export const TCAT_GROUPS=[
 ['Sem nomeação do CA · outros nacionais e internacionais não profissionais',0,[['Torneio A','nac'],['Torneio B','nac'],['Torneio C','nac'],['Campeonato Regional (CR)','nac'],['Tennis Europe (TE)','int'],['ITF Juniores J30','int'],['ITF Juniores J60','int'],['ITF Juniores J100','int'],['ITF Juniores J200','int'],['ITF Juniores J300','int'],['ITF Masters Tour','int'],['Outro torneio nacional','nac'],['Outro torneio internacional','int']]],
 ['Nomeação do CA · nacionais',1,[['PM Sénior 5000€','nac'],['PM Sénior 7500€','nac'],['Campeonato Nacional (CN)','nac']]],
 ['Nomeação do CA · profissionais',1,[['ITF M15','int'],['ITF M25','int'],['ITF W15','int'],['ITF W35','int'],['ITF W50','int'],['ITF W75','int'],['ITF W100','int'],['WTA 125','int'],['ATP Challenger 50','int'],['ATP Challenger 75','int'],['ATP Challenger 100','int'],['ATP Challenger 125','int']]]
];

export const live = n => ['proposta','confirmada','registada'].includes(n.status);
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
export const pd = s => new Date(String(s).slice(0,10)+'T12:00:00Z');
export const iso = d => d.toISOString().slice(0,10);
export const addDays = (d,n) => new Date(pd(typeof d === 'string' ? d : iso(d)).getTime()+n*86400000);
export const wkey = s => { const d=pd(s); return iso(addDays(d,-d.getUTCDay())); };
export const daysBetween = (a,b) => { const out=[]; for(let d=a;d<=b;d=iso(addDays(d,1))) {out.push(d);if(out.length>370)break;}return out; };
export const tDays = t => daysBetween(t.start,t.end);
export const wDays = k => daysBetween(k,iso(addDays(k,7)));
export const weekNo = k => { const d=addDays(k,1); const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);return Math.ceil(((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000+1)/7); };
export const fmtDate = s => s ? pd(s).toLocaleDateString('pt-PT',{timeZone:'UTC'}) : '—';
export const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const stateOf = t => t.end<today()?'ended':t.start<=today()?'live':'upcoming';
export const canManage = (u,t) => u.role==='ca'||(t.nom ? u.role==='ja'&&t.resp.includes(u.id) : t.ja===u.id);
export const recState = u => {if(!u.recNext)return 'none';const d=(pd(u.recNext)-pd(today()))/86400000;return d<0?'bad':d<=90?'warn':'ok';};
export const blankState = () => ({users:[],tours:[],avail:[],noms:[],evals:[],cad:[]});
export const categoryMeta = cat => {for(const [,nom,list] of TCAT_GROUPS){const hit=list.find(([c])=>norm(c)===norm(cat));if(hit)return {cat:hit[0],nom:!!nom,scope:hit[1]};}return null;};
export const busy = (S,uid,k,except) => S.noms.find(n=>n.u===uid&&n.t!==except&&['confirmada','registada'].includes(n.status)&&wkey(S.tours.find(t=>t.id===n.t)?.start||'2000-01-01')===k);
export const experience = (S,uid) => {const result=Object.fromEntries(FORDER.map(f=>[f,0]));for(const n of S.noms){if(n.u===uid&&['confirmada','registada'].includes(n.status)&&S.tours.some(t=>t.id===n.t&&t.end<today()))result[n.fn]++;}return result;};
export const average = (S,uid) => {if(S.stats?.[uid])return S.stats[uid].average;const a=S.evals.filter(e=>e.u===uid&&e.status==='validada');return a.length?a.reduce((s,e)=>s+e.score,0)/a.length:null;};
export function candidates(S,t){return S.avail.filter(a=>a.wk===wkey(t.start)&&a.days.some(d=>tDays(t).includes(d))).map(a=>({a,u:S.users.find(u=>u.id===a.u)})).filter(({u})=>u&&u.status==='ativo'&&u.role!=='ca'&&!busy(S,u.id,wkey(t.start),t.id));}
export function cadEntries(S,uid,year){
 const out=S.cad.filter(c=>c.u===uid).map(c=>({...c,key:'c:'+c.id,src:'self'}));
 for(const n of S.noms){const t=S.tours.find(t=>t.id===n.t);if(n.u!==uid||!t||t.end>=today()||!['confirmada','registada'].includes(n.status))continue;
 const ja=S.noms.find(x=>x.t===t.id&&x.fn==='JA'&&live(x));const jaName=S.users.find(u=>u.id===(ja?.u||t.ja))?.name||'';
 out.push({...n,id:n.id,key:'n:'+n.id,src:t.nom?'ca':'ja',tid:t.id,date:n.days[0]||t.start,wk:wkey(t.start),tname:t.name,tipo:tipoCode(t.cat),fptNo:t.fptNo||(t.scope==='int'?'INT':''),jaName,status:t.nom||n.jaAuto?'aprovado':n.cadSt||'pendente',reason:n.cadReason||''});
 }
 return out.filter(e=>!year||e.date.slice(0,4)===String(year)).sort((a,b)=>a.date.localeCompare(b.date));
}
export const tipoCode = cat => /7500/.test(cat)?'7500$':/5000/.test(cat)?'5000$':/^ITF M/.test(cat)?'M':/^ITF W/.test(cat)?'W':/Juniores/.test(cat)?'JI':/Challenger/.test(cat)?'C':/WTA/.test(cat)?'WTA':/Masters/.test(cat)?'V':'S';
export function cadStats(es){const ok=es.filter(e=>e.status==='aprovado'),by=f=>ok.filter(e=>e.fn===f);return {n:ok.length,JA:by('JA').length,AC:by('CAD').length,JL:by('LIN').length,CH:by('CHEFE').length,SU:by('SUP').length,enc:by('CAD').reduce((s,e)=>s+(e.enc||0),0),sf:by('CAD').reduce((s,e)=>s+(e.sf||0),0),pend:es.filter(e=>e.status==='pendente').length,rej:es.filter(e=>e.status==='recusado').length};}
