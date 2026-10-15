import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitDelimited,tableToRows} from '../client/src/arbitration/import.js';
import {buildCaderneta} from '../client/src/arbitration/excel.js';
import {blankState} from '../shared/arbitration.js';
import {writeFileSync} from 'node:fs';

test('CSV/TSV: quoted delimiters, Portuguese dates, columns and week-only imports',()=>{
 const table=splitDelimited('Nome;Categoria;Início;Fim;Localidade;Região;Clube;Cadeira\n"Torneio; especial";PM Sénior 5000€;01/11/2026;08/11/2026;Lisboa;Lisboa;CT Teste;3');
 assert.equal(table[1][0],'Torneio; especial');const rows=tableToRows(table,2026,blankState());assert.equal(rows[0].start,'2026-11-01');assert.equal(rows[0].end,'2026-11-08');assert.equal(rows[0].needs.CAD,3);assert.equal(rows[0].nom,true);
 const weekly=tableToRows(splitDelimited('Nome\tCategoria\tSemana\tAno\tLocalidade\tClube\nTeste\tTorneio A\t45\t2026\tFaro\tCT Faro'),2026,blankState());assert.equal(weekly[0].region,'Algarve');assert.ok(weekly[0].start.startsWith('2026-'));assert.equal(weekly[0].nom,false);
});
test('Excel export: original five-sheet model produces an XLSX ZIP',()=>{
 const S=blankState(),u={id:1,name:'Árbitro Teste',lv:{A:'Nível 2 FPT'},courses:[],recNext:'2027-01-01'};S.users.push(u);
 const bytes=buildCaderneta(S,u,2026,[{date:'2026-10-01',tname:'Torneio Teste',fn:'CAD',enc:10,sf:2,tipo:'S',status:'aprovado',jaName:'JA Teste'}],1);
 assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);const text=new TextDecoder().decode(bytes);assert.match(text,/Torneios Anuais/);assert.match(text,/Carreira/);assert.match(text,/Avaliações/);assert.match(text,/Observações/);assert.match(text,/Instruções de Preenchimento/);assert.ok(!text.includes('undefined'));
 if(process.env.EXPORT_TEST_XLSX)writeFileSync(process.env.EXPORT_TEST_XLSX,bytes);
});
