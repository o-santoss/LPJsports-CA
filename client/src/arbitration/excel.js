import {cadStats,FUN,iso,pd,today} from '../../../shared/arbitration.js';
const DAY=86400000,TODAY=pd(today()),CA_EMAIL='conselhoarbitragemfpt@gmail.com',CA_PHONE='96 214 14 57';
const fmtPT=d=>d.toLocaleDateString('pt-PT',{timeZone:'UTC'});
const fptOf=t=>t.fptNo||(t.scope==='int'?'INT':'');
const XS=[
 {},
 {f:{sz:18,b:1},fill:'C0C0C0',b:'medium',h:'center'},
 {f:{sz:14,b:1},h:'right'},
 {f:{sz:14},b:'dashed',h:'center'},
 {f:{sz:16,b:1},fill:'FFFF00',h:'center',w:1},
 {f:{sz:11},h:'left'},
 {f:{sz:14,b:1},fill:'FF6600',h:'center'},
 {f:{sz:11,b:1},fill:'C0C0C0',b:'medium',h:'center',w:1},
 {f:{sz:14},fill:'C0C0C0',b:'thin',h:'center'},
 {f:{sz:14},b:'thin',h:'center'},
 {f:{sz:12},b:'thin',h:'left'},
 {f:{sz:14},b:'thin',h:'center',n:164},
 {f:{sz:14,b:1},fill:'00ABEA',b:'thin',h:'center'},
 {f:{sz:14,b:1},fill:'FFFF00',b:'medium',h:'center'},
 {f:{sz:11,u:1,c:'0000D4'},h:'left'},
 {f:{sz:14,b:1},fill:'C0C0C0',b:'medium',h:'center'},
 {f:{sz:11,b:1},fill:'C0C0C0',b:'thin',h:'center',w:1},
 {f:{sz:11},b:'thin',h:'center'},
 {f:{sz:11},b:'thin',h:'center',n:164},
 {f:{sz:11},b:'thin',h:'left',w:1},
 {f:{sz:14,b:1},h:'right'},
 {f:{sz:16},fill:'FF6600',h:'center',w:1},
 {f:{sz:11,b:1},h:'left'},
 {f:{sz:14},b:'dashed',h:'center',n:164},
 {f:{sz:11},h:'left',w:1}
];
const xlEsc=v=>String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const xlCol=i=>{let s='',n=i+1;while(n){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26)}return s};
const xlRef=a=>{const m=/^([A-Z]+)(\d+)$/.exec(a);let c=0;for(const ch of m[1])c=c*26+ch.charCodeAt(0)-64;return {c:c-1,r:+m[2]}};
const xlSerial=s=>{const [y,m,d]=s.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(1899,11,30))/DAY)};
function xlNew(name){const sh={name,cells:{},merges:[],cols:[],heights:{},landscape:true};
  sh.set=(ref,v,st)=>{const p=xlRef(ref);(sh.cells[p.r]??={})[p.c]={v,s:st||0}};
  sh.range=(ref,v,st)=>{const [a,b]=ref.split(':'),pa=xlRef(a),pb=xlRef(b);for(let r=pa.r;r<=pb.r;r++)for(let c=pa.c;c<=pb.c;c++)sh.set(xlCol(c)+r,r===pa.r&&c===pa.c?v:null,st);if(a!==b)sh.merges.push(ref)};
  return sh}
function xlCell(ref,{v,s}){const st=s?` s="${s}"`:'';if(v===null||v===undefined||v==='')return `<c r="${ref}"${st}/>`;if(typeof v==='number')return `<c r="${ref}"${st}><v>${v}</v></c>`;if(v&&v.d)return `<c r="${ref}"${st}><v>${xlSerial(v.d)}</v></c>`;return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xlEsc(v)}</t></is></c>`}
function xlSheetXml(sh){
  const rows=Object.keys(sh.cells).map(Number).sort((a,b)=>a-b);
  let x=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>`;
  if(sh.cols.length)x+=`<cols>${sh.cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  x+='<sheetData>'+rows.map(r=>{const cs=sh.cells[r],ks=Object.keys(cs).map(Number).sort((a,b)=>a-b),ht=sh.heights[r];return `<row r="${r}"${ht?` ht="${ht}" customHeight="1"`:''}>${ks.map(c=>xlCell(xlCol(c)+r,cs[c])).join('')}</row>`}).join('')+'</sheetData>';
  if(sh.merges.length)x+=`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
  return x+`<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${sh.landscape?'landscape':'portrait'}" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function xlStyles(){
  const fonts=[],fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'],borders=['<border><left/><right/><top/><bottom/><diagonal/></border>'],fk={},flk={},bk={};
  const fid=f=>{f=f||{};const x=`<font>${f.b?'<b/>':''}${f.u?'<u/>':''}<sz val="${f.sz||11}"/><color rgb="FF${f.c||'000000'}"/><name val="Calibri"/><family val="2"/></font>`;if(fk[x]===undefined){fk[x]=fonts.length;fonts.push(x)}return fk[x]};
  fid({});
  const flid=c=>{if(!c)return 0;const x=`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`;if(flk[x]===undefined){flk[x]=fills.length;fills.push(x)}return flk[x]};
  const side=(n,t)=>`<${n} style="${t}"><color auto="1"/></${n}>`;
  const bid=t=>{if(!t)return 0;const x=t==='dashed'?`<border><left/><right/><top/>${side('bottom','dashed')}<diagonal/></border>`:`<border>${side('left',t)}${side('right',t)}${side('top',t)}${side('bottom',t)}<diagonal/></border>`;if(bk[x]===undefined){bk[x]=borders.length;borders.push(x)}return bk[x]};
  const xfs=XS.map(st=>{const f=fid(st.f),fl=flid(st.fill),b=bid(st.b);return `<xf numFmtId="${st.n||0}" fontId="${f}" fillId="${fl}" borderId="${b}" xfId="0" applyFont="1" applyFill="${fl?1:0}" applyBorder="${b?1:0}" applyNumberFormat="${st.n?1:0}" applyAlignment="1"><alignment vertical="center"${st.h?` horizontal="${st.h}"`:''}${st.w?' wrapText="1"':''}/></xf>`});
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function zipStore(files){
  const enc=new TextEncoder(),parts=[],central=[],now=new Date();let off=0;
  const time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),date=((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
  for(const f of files){
    const nm=enc.encode(f.name),d=f.data,crc=crc32(d);
    const lh=new Uint8Array(30+nm.length),v=new DataView(lh.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint16(10,time,true);v.setUint16(12,date,true);v.setUint32(14,crc,true);v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,nm.length,true);v.setUint16(28,0,true);lh.set(nm,30);
    parts.push(lh,d);
    const ch=new Uint8Array(46+nm.length),w=new DataView(ch.buffer);
    w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x0800,true);w.setUint16(10,0,true);w.setUint16(12,time,true);w.setUint16(14,date,true);w.setUint32(16,crc,true);w.setUint32(20,d.length,true);w.setUint32(24,d.length,true);w.setUint16(28,nm.length,true);w.setUint16(30,0,true);w.setUint16(32,0,true);w.setUint16(34,0,true);w.setUint16(36,0,true);w.setUint32(38,0,true);w.setUint32(42,off,true);ch.set(nm,46);
    central.push(ch);off+=lh.length+d.length;
  }
  const cd=central.reduce((s,c)=>s+c.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,cd,true);e.setUint32(16,off,true);
  const all=[...parts,...central,end],out=new Uint8Array(all.reduce((s,a)=>s+a.length,0));let p=0;for(const a of all){out.set(a,p);p+=a.length}
  return out;
}
function xlBuild(sheets){
  const enc=new TextEncoder(),f=(name,s)=>({name,data:enc.encode(s)}),H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const ct=`${H}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  const rels=`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wb=`${H}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xlEsc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`;
  const wbr=`${H}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${R}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`;
  return zipStore([f('[Content_Types].xml',ct),f('_rels/.rels',rels),f('xl/workbook.xml',wb),f('xl/_rels/workbook.xml.rels',wbr),f('xl/styles.xml',xlStyles()),...sheets.map((s,i)=>f(`xl/worksheets/sheet${i+1}.xml`,xlSheetXml(s)))]);
}
export function buildCaderneta(S,u,year,es,pend){
  const getT=id=>S.tours.find(t=>t.id===id),uname=id=>S.users.find(u=>u.id===id)?.name||'—';
  const lv=u.lv||{},st=cadStats(es),fmt=s=>fmtPT(pd(s));
  // Torneios Anuais
  const s=xlNew('Torneios Anuais');s.cols=[6,9,12.5,36,12.5,10.5,10.5,10.7,11.7,10,27,4];
  s.range('A1:K1','CADERNETA DIGITAL',1);s.heights[1]=24;
  [[3,'Nome:',u.name],[4,'Morada:',u.addr||''],[5,'',''],[6,'Código Postal:',u.postal||''],[7,'Telefone:',u.tel||''],[8,'Telémovel:',u.phone||''],[9,'Email:',u.email||''],[10,'Associação:',u.assoc||''],[11,'Nº de Licença:',u.licence||''],[12,'Certificação c/ Árbitro',lv.A||'-'],[13,'Certificação c/ Juíz Árbitro',lv.J||'-'],[14,'Data de Nascimento:',u.birth?{d:u.birth}:'']].forEach(([r,l,v])=>{s.range(`A${r}:C${r}`,l,2);s.range(`D${r}:E${r}`,v,v&&v.d?23:3);s.heights[r]=18.75});
  s.range('G3:K4','MANTENHA TODAS AS PÁGINAS DA CAD ATUALIZADAS',4);
  s.range('G6:K6','Use este ficheiro para registar toda a sua actividade durante o ano',5);
  s.set('G7','De forma a se proceder à sua reclassificação deverá enviar este',5);
  s.set('G8','ficheiro para o Conselho de Arbitragem de',5);s.set('K8','1 a 31 de Dezembro',6);
  s.range('G10:I10','Email do Conselho:',20);s.range('J10:L10',CA_EMAIL,14);
  s.range('G11:I11','Telefone do Conselho:',20);s.range('J11:L11',CA_PHONE,5);
  s.range('G14:K15',u.recNext?`PRÓXIMA RECERTIFICAÇÃO: ${fmt(u.recNext)}`:'SEM DATA DE RECERTIFICAÇÃO',21);
  s.range('C16:E16','Evento',7);s.range('F16:J16','Função',7);s.set('K16','Verificação',7);
  s.range('A17:A18','Linha',7);s.range('B17:B18','Nº Torn.',7);s.range('C17:C18','Data',7);s.range('D17:D18','Nome do Torneio',7);s.range('E17:E18','Tipo de Torneio',7);s.range('F17:F18','Juiz de Linha',7);s.range('G17:H17','Árbitro',7);s.set('G18','Número Encontros',7);s.set('H18','1/2 Finais e Finais',7);s.range('I17:I18','Chefe Árbitros',7);s.range('J17:J18','Juíz Árbitro',7);s.range('K17:K18','Nome do Juíz Árbitro',7);
  s.heights[18]=30;
  let r=19,line=1;
  s.set('A19',line++,8);s.set('B19','',9);s.range('C19:K19',String(year),12);s.heights[19]=19.5;r=20;
  es.forEach(e=>{s.set('A'+r,line++,8);s.set('B'+r,e.fptNo||'',9);s.set('C'+r,{d:e.date},11);s.set('D'+r,e.tname,10);s.set('E'+r,e.tipo||'',9);s.set('F'+r,e.fn==='LIN'?'X':'',9);s.set('G'+r,e.fn==='CAD'?(+e.enc||0):'',9);s.set('H'+r,e.fn==='CAD'?(+e.sf||0):'',9);s.set('I'+r,e.fn==='CHEFE'?'X':'',9);s.set('J'+r,e.fn==='JA'?'X':e.fn==='SUP'?'S':'',9);s.set('K'+r,e.jaName||'',9);s.heights[r]=18.75;r++});
  if(!es.length){s.set('A'+r,line++,8);'BCDEFGHIJK'.split('').forEach(c=>s.set(c+r,'',9));r++}
  s.range(`A${r}:E${r}`,`TOTAL ${year}: ${es.length} torneio${es.length===1?'':'s'}`,13);s.set('F'+r,st.JL,13);s.set('G'+r,st.enc,13);s.set('H'+r,st.sf,13);s.set('I'+r,st.CH,13);s.set('J'+r,st.JA+st.SU,13);s.set('K'+r,'',13);s.heights[r]=19.5;
  // Carreira
  const c=xlNew('Carreira');c.cols=[8,15,3,15,3,16,3,13,3,32,3,28,3,14];
  c.range('A1:F1','NÍVEL COMO ÁRBITRO E JUIZ-ÁRBITRO',15);c.range('H1:N1','CURSOS, RECICLAGENS, SIMPÓSIOS, ESTÁGIOS, ETC.',15);
  [['A3','Ano'],['B3','Árbitro'],['D3','Juiz-Árbitro'],['F3','Data Qualificação'],['H3','Data'],['J3','Formação'],['L3','Local'],['N3','Formador']].forEach(([a,t])=>c.set(a,t,16));
  c.set('A4',year,17);c.set('B4',lv.A||'-',17);c.set('D4',lv.J||'-',17);c.set('F4','',17);
  const cs=(u.courses||[]).filter(k=>+k.date.slice(0,4)===year).sort((a,b)=>a.date.localeCompare(b.date));
  cs.forEach((k,i)=>{const rr=4+i;c.set('H'+rr,{d:k.date},18);c.set('J'+rr,k.name,19);c.set('L'+rr,k.place,19);c.set('N'+rr,'',17)});
  if(!cs.length){c.set('H4','',17);c.set('J4',`Sem formação registada em ${year}`,19);c.set('L4','',17);c.set('N4','',17)}
  const or=Math.max(6,5+cs.length);c.set('A'+or,'Outros níveis:',22);c.set('B'+or,`Chefe de Árbitros: ${lv.C||'-'} · Supervisor: ${lv.S||'-'}`,5);
  if(u.recNext){c.set('A'+(or+1),'Próxima recertificação:',22);c.set('D'+(or+1),fmt(u.recNext),5)}
  // Avaliações
  const a=xlNew('Avaliações');a.cols=[10,13,42,20,28];a.landscape=false;
  a.range('A1:E1','AVALIAÇÕES',15);a.range('A2:A3','Nº Torn.',16);a.range('B2:B3','Data',16);a.range('C2:C3','Nome do Torneio',16);a.range('D2:D3','Função',16);a.range('E2:E3','Avaliador',16);
  const evs=S.evals.filter(e=>e.u===u.id&&e.status==='validada').map(e=>({e,t:getT(e.t)})).filter(x=>x.t&&+x.t.start.slice(0,4)===year).sort((p,q)=>p.t.start.localeCompare(q.t.start));
  evs.forEach(({e,t},i)=>{const rr=4+i;a.set('A'+rr,fptOf(t),17);a.set('B'+rr,{d:t.start},18);a.set('C'+rr,t.name,19);a.set('D'+rr,FUN[e.fn],17);a.set('E'+rr,uname(e.by),17)});
  if(!evs.length){a.set('A4','',17);a.set('B4','',17);a.set('C4',`Sem avaliações validadas em ${year}`,19);a.set('D4','',17);a.set('E4','',17)}
  // Observações
  const o=xlNew('Observações');o.cols=[13,30,30,30,30];o.landscape=false;
  o.range('A1:E1','OBSERVAÇÕES',15);o.set('A3','Data',16);o.range('B3:E3','Observação',16);
  const obs=[`Caderneta exportada da plataforma C.Arbitragem. Inclui só os registos de ${year} aprovados pelo Conselho de Arbitragem (${es.length}).`];
  if(pend)obs.push(`${pend} registo${pend>1?'s':''} ainda por aprovar não ${pend>1?'foram incluídos':'foi incluído'}.`);
  obs.push('No campo Juíz Árbitro, "S" indica a função de Supervisor.');
  obs.forEach((t,i)=>{const rr=4+i;o.set('A'+rr,{d:iso(TODAY)},18);o.range(`B${rr}:E${rr}`,t,19);o.heights[rr]=30});
  // Instruções
  const ins=xlNew('Instruções de Preenchimento');ins.cols=[6,8,14,14,3,6,14,14,3,3,3,3];ins.landscape=false;
  ins.range('A1:L1','INSTRUÇÕES PARA PREENCHIMENTO',15);
  [['1','O preenchimento dos Niveis, será feito pelo Conselho de Arbitragem.'],['2','Os dados inseridos nestas folhas são respeitantes sómente a torneios oficiais.'],['3','Todas as informações transcritas são da inteira responsabilidade do Árbitro.'],['4','Nos torneios internacionais que não tenham o seu respectivo Nº no Calendário da F.P.T., terá em vez do número, as iniciais INT.'],['5','O nome do torneio será igual ao do calendário da F.P.T.'],['6','O Nº de encontros será o total de encontros arbitrados no torneio, incluindo as 1/2 e finais.'],['7','No preenchimento dos torneios, colocar um X na função desempenhada.']].forEach(([n,t],i)=>{const rr=3+i*2;ins.set('A'+rr,n,22);ins.range(`B${rr}:L${rr}`,t,24);ins.heights[rr]=30});
  ins.set('A18','Tipo:',22);
  [['GS','Grand Slam','W','ITF Femininos'],['TD','Taça Davis','JI','ITF Junior'],['FC','Fed Cup','TA','Torneios da TA'],['ATP','ATP Tour','??$','Prize Money (Quantia)'],['C','Challengers','S','Séniores'],['M','ITF Masculinos','J','Juvenis'],['WTA','WTA Tour','V','Veteranos']].forEach(([a1,b1,a2,b2],i)=>{const rr=18+i;ins.set('B'+rr,a1,22);ins.range(`C${rr}:D${rr}`,b1,5);ins.set('F'+rr,a2,22);ins.range(`G${rr}:H${rr}`,b2,5)});
  ins.set('A26','Função:',22);
  [['S','Supervisor','AC','Árbitros de Cadeira'],['JA','Juiz-Árbitro','JL','Juiz de Linha'],['CA','Chefe de Árbitros','AJA','Adjunto de Juiz-Árbitro']].forEach(([a1,b1,a2,b2],i)=>{const rr=26+i;ins.set('B'+rr,a1,22);ins.range(`C${rr}:D${rr}`,b1,5);ins.set('F'+rr,a2,22);ins.range(`G${rr}:H${rr}`,b2,5)});
  return xlBuild([s,c,a,o,ins]);
}


export function downloadCaderneta(S,u,year,entries,pending){
 const bytes=buildCaderneta(S,u,year,entries,pending);const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Caderneta-${u.name.replace(/[^a-zA-Z0-9]/g,'_')}-${year}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
