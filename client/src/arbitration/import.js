import {norm,iso,addDays,pd,PISOS,REGIOES,FORDER,TCAT_GROUPS,weekNo,wkey} from '../../../shared/arbitration.js';
const CATMETA={};TCAT_GROUPS.forEach(([,nom,list])=>list.forEach(([name,scope])=>CATMETA[norm(name)]={name,nom:!!nom,scope}));
const weeksOfYear=y=>{const rows=[];for(let k=wkey(y+'-01-04');rows.length<53;k=iso(addDays(k,7))){if(new Date(addDays(k,4)).getUTCFullYear()>y)break;rows.push(k);}return rows;};
const CITY_REG={lisboa:'Lisboa',oeiras:'Lisboa',cascais:'Lisboa',porto:'Norte',braga:'Norte',coimbra:'Centro',viseu:'Centro',faro:'Algarve',quarteira:'Algarve','vale do lobo':'Algarve',vilamoura:'Algarve',loule:'Algarve',funchal:'Madeira','ponta delgada':'Açores',evora:'Alentejo',beja:'Alentejo'};
const regionFor=(S,city)=>S.tours.find(t=>norm(t.city)===norm(city))?.region||CITY_REG[norm(city)]||'';
const needsFor=(S,cat)=>({...S.tours.find(t=>t.cat===cat)?.needs||{JA:1,SUP:0,CHEFE:0,CAD:0,LIN:0}});
const loteRow=o=>({...o,nom:o.kind!=='sem',scope:o.kind==='ca-int'?'int':'nac',resp:o.resp?[Number(o.resp)]:[],ja:null});
export function splitDelimited(txt){
  txt=String(txt||'').replace(/^﻿/,'');
  const first=txt.split(/\r?\n/).find(l=>l.trim())||'';
  const sep=first.includes('\t')?'\t':first.includes(';')?';':',';
  const rows=[];let row=[],cell='',q=false;
  for(let i=0;i<txt.length;i++){const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
    else if(c==='"'&&!cell.trim())q=true;
    else if(c===sep){row.push(cell);cell=''}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}
    else cell+=c}
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(Boolean));
}
const LHDR={name:['nome','torneio','nomedotorneio','prova','designacao','evento','competicao'],cat:['categoria','cat','tipo','tipodetorneio','nivel','grau'],start:['inicio','datainicio','datadeinicio','datadoinicio','de','data','datas','comeco'],end:['fim','datafim','datadefim','datadofim','ate','termino','datafinal'],week:['semana','sem','nsemana','nosemana','nodasemana','semanan','numerodasemana','week','wk'],city:['localidade','cidade','local','concelho'],region:['regiao','associacao','assoc','zona'],club:['clube','organizador','organizacao','entidadeorganizadora','clubeorganizador'],piso:['piso','superficie'],n_JA:['ja','juizarbitro','juizesarbitros','vagasja'],n_SUP:['supervisor','supervisores','sup'],n_CHEFE:['chefe','chefedearbitros','chefes'],n_CAD:['cadeira','arbitrosdecadeira','arbitrodecadeira','arbitros','cadeiras'],n_LIN:['linha','juizesdelinha','juizdelinha','linhas'],hora:['hora','horadeapresentacao','apresentacao'],nomca:['nomeacaoca','nomeacao','nomeacaodoca','ca'],fpt:['numerofpt','nfpt','nofpt','numero','codigo','codigofpt','n','no'],resp:['responsavel','responsaveis','responsavelpelaspropostas'],ano:['ano','epoca']};
const LPOS=['name','cat','city','region','club','start','end','piso','n_JA','n_SUP','n_CHEFE','n_CAD','n_LIN','hora','nomca','fpt'];
const hk=s=>norm(s).replace(/[ºª°]/g,'o').replace(/[^a-z0-9]/g,'');
function lHeader(table){
  for(let r=0;r<Math.min(8,table.length);r++){
    const map={};let hits=0;
    (table[r]||[]).forEach((c,j)=>{const k=hk(c);if(!k)return;for(const f in LHDR){if(map[f]===undefined&&LHDR[f].includes(k)){map[f]=j;hits++;break}}});
    if(hits>=2&&map.name!==undefined)return {row:r,map};
  }
  return null;
}
const MON={jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12};
const okD=(y,mo,d)=>{const x=new Date(Date.UTC(y,mo-1,d,12));return y>1999&&x.getUTCMonth()===mo-1&&x.getUTCDate()===d?iso(x):null};
const yy=s=>String(s).length===2?2000+(+s):+s;
function lDate(v){
  v=String(v||'').trim();if(!v)return null;
  if(/^\d{4,6}(\.\d+)?$/.test(v)){const n=parseFloat(v);return n>20000&&n<80000?iso(addDays(new Date(1899,11,30),Math.floor(n))):null}
  let m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return okD(+m[1],+m[2],+m[3]);
  m=v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/);if(m)return okD(yy(m[3]),+m[2],+m[1]);
  m=norm(v).match(/^(?:[a-z\-]+,?\s+)?(\d{1,2})(?:\s+de)?[\s\/.\-]*([a-z]{3})[a-z]*\.?(?:\s+de)?[\s\/.\-]*(\d{4}|\d{2})\b/);
  if(m&&MON[m[2]])return okD(yy(m[3]),MON[m[2]],+m[1]);
  return null;
}
function lDates(v){const out=[];String(v||'').replace(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-](?:\d{4}|\d{2})/g,x=>{const d=lDate(x);if(d)out.push(d);return x});return out}
function lPiso(v){const n=norm(v);if(!n)return 'Terra batida';const p=PISOS.find(x=>norm(x)===n);if(p)return p;if(/terra|clay|saibro/.test(n))return 'Terra batida';if(/rapid|hard|duro|cimento|indoor|resina/.test(n))return 'Piso rápido';if(/relva|grass|sintet/.test(n))return 'Relva sintética';return 'Terra batida'}
const reEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function lCatGuess(txt){
  const n=norm(txt);if(!n)return null;let best=null,bl=0;
  for(const k in CATMETA){const ab=k.match(/\((\w+)\)/);if(ab&&n===ab[1])return CATMETA[k]}
  for(const k in CATMETA){const al=[k.replace(/\s*\(.*\)\s*/g,'').trim()];const j=k.match(/^itf juniores (j\d+)$/);if(j)al.push('itf '+j[1],j[1]);const mw=k.match(/^itf ([mw]\d+)$/);if(mw)al.push(mw[1]);
    for(const a of al)if(a.length>bl&&new RegExp('(^|[^a-z0-9])'+reEsc(a)+'([^a-z0-9]|$)').test(n)){best=CATMETA[k];bl=a.length}}
  return best;
}
export function tableToRows(table,year,S){
  const h=lHeader(table);let map,body;
  if(h){map=h.map;body=table.slice(h.row+1)}else{map={};LPOS.forEach((f,j)=>{map[f]=j});body=table}
  const out=[];
  body.forEach(c=>{
    const g=f=>map[f]===undefined?'':String(c[map[f]]??'').trim();
    const name=g('name'),city=g('city');if(!name&&!city)return;
    let st=lDate(g('start')),en=lDate(g('end'));
    if(!en){const two=lDates(g('start'));if(two.length>=2){st=two[0];en=two[1]}}
    const wk=parseInt(g('week'),10);
    if(!st&&wk>=1&&wk<=53){const y=parseInt(g('ano'),10)||year,k=weeksOfYear(y).find(x=>weekNo(x)===wk);if(k){st=k;en=en||iso(addDays(pd(k),7))}}
    if(st&&!en&&pd(st).getDay()===0)en=iso(addDays(pd(st),7));
    const cat=g('cat'),m=CATMETA[norm(cat)]||lCatGuess(cat)||lCatGuess(name),nmc=norm(g('nomca'));
    const nom=nmc?['sim','s','1','x','ca','yes','y'].includes(nmc):(m?m.nom:false);
    const needs=needsFor(S,m?m.name:cat);let hasN=false;
    FORDER.forEach(f=>{const v=g('n_'+f);if(v!==''){needs[f]=Math.max(0,Math.min(40,parseInt(v,10)||0));hasN=true}});
    const rg=REGIOES.find(r=>norm(r)===norm(g('region'))),reg=rg||regionFor(S,city);
    const rn=norm(g('resp')),ru=rn?S.users.find(u=>u.role==='ja'&&u.status==='ativo'&&(norm(u.name)===rn||norm(u.email)===rn||norm(u.name).startsWith(rn))):null;
    out.push(loteRow({name,cat:m?m.name:cat,kind:nom?((m&&m.scope==='int')?'ca-int':'ca-nac'):'sem',start:st||'',end:en||'',city,region:reg||'',rAuto:!rg&&!!reg,club:g('club'),piso:lPiso(g('piso')),needs,nAuto:!hasN,resp:ru?ru.id:'',fptNo:g('fpt')}));
  });
  if(!h&&!out.some(r=>r.start))return [];
  return out;
}
async function lZip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),td=new TextDecoder();let e=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-65600);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('zip');
  const n=dv.getUint16(e+10,true),ent={};let p=dv.getUint32(e+16,true);
  for(let k=0;k<n&&dv.getUint32(p,true)===0x02014b50;k++){const nl=dv.getUint16(p+28,true);ent[td.decode(u8.subarray(p+46,p+46+nl))]={m:dv.getUint16(p+10,true),cs:dv.getUint32(p+20,true),us:dv.getUint32(p+24,true),o:dv.getUint32(p+42,true)};p+=46+nl+dv.getUint16(p+30,true)+dv.getUint16(p+32,true)}
  return async name=>{const f=ent[name];if(!f)return null;if(f.us>32*1048576)throw new Error('Folha Excel demasiado grande');const st=f.o+30+dv.getUint16(f.o+26,true)+dv.getUint16(f.o+28,true),d=u8.slice(st,st+f.cs);if(f.m===0)return td.decode(d);if(f.m!==8||typeof DecompressionStream==='undefined')throw new Error('inflate');return await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};
}
export async function lXlsx(buf){
  const rd=await lZip(buf),X=t=>new DOMParser().parseFromString(t,'application/xml'),T=(d,t)=>[...d.getElementsByTagNameNS('*',t)];
  const ssx=await rd('xl/sharedStrings.xml'),ss=ssx?T(X(ssx),'si').map(si=>T(si,'t').filter(t=>!t.parentNode||t.parentNode.localName!=='rPh').map(t=>t.textContent).join('')):[];
  const wb=X(await rd('xl/workbook.xml')||'<x/>'),rl=X(await rd('xl/_rels/workbook.xml.rels')||'<x/>'),rels={};
  T(rl,'Relationship').forEach(r=>{rels[r.getAttribute('Id')]=r.getAttribute('Target')});
  let paths=T(wb,'sheet').map(sh=>{const t=rels[sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sh.getAttribute('r:id')]||'';return t.startsWith('/')?t.slice(1):'xl/'+t.replace(/^\.\//,'')}).filter(x=>x!=='xl/');
  if(!paths.length)paths=['xl/worksheets/sheet1.xml'];
  const sheets=[];
  for(const pth of paths.slice(0,12)){
    const x=await rd(pth);if(!x)continue;const rows=[];
    T(X(x),'row').forEach(r=>{const a=[];T(r,'c').forEach(c=>{const ref=(c.getAttribute('r')||'').replace(/\d+/g,''),t=c.getAttribute('t'),v=T(c,'v')[0];let col=a.length;if(ref){col=0;for(const ch of ref)col=col*26+ch.charCodeAt(0)-64;col--}a[col]=t==='s'?(ss[+(v&&v.textContent)]??''):t==='inlineStr'?T(c,'t').map(z=>z.textContent).join(''):(v?v.textContent:'')});rows.push(Array.from(a,z=>z==null?'':String(z).trim()))});
    sheets.push(rows.filter(r=>r.some(Boolean)));
  }
  return sheets.find(sh=>lHeader(sh))||sheets.find(sh=>sh.length)||[];
}
