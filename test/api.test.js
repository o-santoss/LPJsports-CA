import { Readable } from 'node:stream';
import { testDb } from './sqlite-fixture.js';
// Testes automáticos da API do núcleo. Correr com: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'lpj-test-'));
Object.assign(process.env, {
  DATA_DIR: dir, ADMIN_NAME: 'Teresa Antunes', ADMIN_EMAIL: 'admin@exemplo.pt', ADMIN_PIN: '3690',
  LOG_EMAILS: '0', SUPABASE_URL: 'https://storage.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', ENV_FILE: join(dir, 'none.env'),
});
const realFetch = globalThis.fetch;
const objects = new Map();
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://storage.example.test/')) return realFetch(url, options);
  const u = new URL(url);
  const key = u.pathname.replace('/storage/v1/object', '');
  if (key.startsWith('/upload/sign/')) return new Response(JSON.stringify({ url: '/object/upload/sign' + key.slice(12) + '?token=test-signed' }));
  if (key.startsWith('/sign/')) return new Response(JSON.stringify({ signedURL: '/object/signed' + key.slice(5) }), { headers: { 'Content-Type': 'application/json' } });
  if (options.method === 'POST') { objects.set(key, options.body); return new Response('{}'); }
  if (options.method === 'DELETE') { objects.delete(key); return new Response('{}'); }
  const data = objects.get(key);
  return data ? new Response(data, { headers: { 'Content-Length': String(data.length) } }) : new Response('', { status: 404 });
};
const { createApp } = await import('../server/index.js');

let app, base;
before(async () => {
  app = await createApp({ db: testDb() });

});
after(async () => { globalThis.fetch = realFetch; await app.db.close(); rmSync(dir, { recursive: true, force: true }); });

// Pequeno cliente com cookies
function client() {
  let cookie = '';
  return async (method, path, body, { csrf = true } = {}) => {
    const req = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
    Object.assign(req, { method, url: path, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(csrf ? { 'x-lpj': '1' } : {}), ...(cookie ? { cookie } : {}) }, socket: { remoteAddress: '127.0.0.1' } });
    let payload = Buffer.alloc(0);
    const res = {
      headersSent: false, headers: new Headers(), status: 0,
      writeHead(status, headers) { this.status = status; this.headersSent = true; for (const [k,v] of Object.entries(headers)) { for (const item of [].concat(v)) this.headers.append(k, item); } },
      end(data) { if (data) payload = Buffer.from(data); },
      async json() { return JSON.parse(payload.toString()); },
      async arrayBuffer() { return payload; },
    };
    await app.handle(req, res);
    const sc = res.headers.getSetCookie();
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : await res.arrayBuffer(), headers: res.headers };
  };
}
const lastEmailTo = async (email) => (await app.db.all('SELECT * FROM emails ORDER BY id DESC')).find((e) => e.to_json.includes(email));

const admin = client();
const ana = client();

test('configuração pública e rotas protegidas', async () => {
  const anon = client();
  const cfg = await anon('GET', '/api/config');
  assert.equal(cfg.status, 200);
  assert.equal(cfg.data.app.name, 'C.Arbitragem');
  assert.equal(cfg.data.app.assocs.length, 13);
  assert.equal((await anon('GET', '/api/me')).status, 401);
  assert.equal((await anon('POST', '/api/auth/login', { id: 'x', pin: '1' }, { csrf: false })).status, 403, 'sem cabeçalho x-lpj é recusado');
});

test('administrador entra', async () => {
  const r = await admin('POST', '/api/auth/login', { id: 'admin@exemplo.pt', pin: '3690' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.user.role, 'ca');
  const me = await admin('GET', '/api/me');
  assert.equal(me.data.user.name, 'Teresa Antunes');
});

test('registo fica pendente até o CA aprovar', async () => {
  const bad = await ana('POST', '/api/auth/register', { name: 'Ana', email: 'ana@exemplo.pt', phone: '912345678', pin: '2468', pin2: '2468', consent: true });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /nome completo/);
  const weak = await ana('POST', '/api/auth/register', { name: 'Ana Rodrigues', email: 'ana@exemplo.pt', phone: '912345678', pin: '1111', pin2: '1111', consent: true });
  assert.match(weak.data.error, /fácil/);
  const ok = await ana('POST', '/api/auth/register', {
    name: 'Ana Rodrigues', email: 'Ana@Exemplo.pt', phone: '912 345 678', region: 'Lisboa', assoc: 'Associação de Ténis de Lisboa',
    pin: '2468', pin2: '2468', consent: true, extra: { funcs: ['CAD', 'LIN'] },
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const dup = await ana('POST', '/api/auth/register', { name: 'Ana Rodrigues', email: 'ana@exemplo.pt', phone: '912345678', pin: '2468', pin2: '2468', consent: true });
  assert.equal(dup.status, 409);
  const pend = await ana('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '2468' });
  assert.equal(pend.status, 403);
  assert.equal(pend.data.code, 'pendente');
  const inbox = await admin('GET', '/api/messages');
  assert.ok(inbox.data.messages.some((m) => m.kind === 'registo' && m.subject.includes('Ana Rodrigues')));
  const list = await admin('GET', '/api/users');
  const u = list.data.users.find((x) => x.email === 'ana@exemplo.pt');
  assert.equal(u.status, 'pendente');
  assert.deepEqual(u.extra.funcs, ['CAD', 'LIN']);
  const ap = await admin('POST', `/api/users/${u.id}/approve`);
  assert.equal(ap.data.user.status, 'ativo');
  assert.ok((await lastEmailTo('ana@exemplo.pt')).subject.includes('aprovada'));
});

test('entrar com telemóvel e bloqueio após 5 tentativas', async () => {
  const r = await ana('POST', '/api/auth/login', { id: '912345678', pin: '2468' });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.photoUrl, null);
  const other = client();
  for (let i = 1; i <= 4; i++) {
    const w = await other('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '0001' });
    assert.equal(w.status, 400);
  }
  const locked = await other('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '0001' });
  assert.equal(locked.status, 423);
  const still = await other('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '2468' });
  assert.equal(still.status, 423, 'mesmo com o código certo continua bloqueada');
  const id = (await admin('GET', '/api/users')).data.users.find((x) => x.email === 'ana@exemplo.pt').id;
  await admin('POST', `/api/users/${id}/unlock`);
  assert.equal((await other('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '2468' })).status, 200);
});

test('perfil, foto e mudança de código', async () => {
  const up = await ana('PUT', '/api/me', { addr: 'Rua das Amoreiras, 45', birth: '1991-04-12', assoc: 'Associação de Ténis da Madeira', notif: { conf: false, msg: true } });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.equal(up.data.user.assoc, 'Associação de Ténis da Madeira');
  assert.equal(up.data.user.notif.conf, false);
  const badAssoc = await ana('PUT', '/api/me', { assoc: 'Associação Inventada' });
  assert.equal(badAssoc.status, 400);
  // PNG de 1x1
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const ph = await ana('PUT', '/api/me/photo', { data: png });
  assert.equal(ph.status, 200, JSON.stringify(ph.data));
  assert.match(ph.data.user.photoUrl, /^\/api\/photos\/[a-f0-9]{24}\.png$/);
  const img = await ana('GET', ph.data.user.photoUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.equal((await client()('GET', ph.data.user.photoUrl)).status, 401, 'fotos só para quem tem sessão');
  const notImg = await ana('PUT', '/api/me/photo', { data: 'data:image/png;base64,' + Buffer.from('não é imagem').toString('base64') });
  assert.equal(notImg.status, 400);
  const wrong = await ana('PUT', '/api/me/pin', { old: '9999', pin: '2580', pin2: '2580' });
  assert.equal(wrong.status, 400);
  const ch = await ana('PUT', '/api/me/pin', { old: '2468', pin: '3579', pin2: '3579' });
  assert.equal(ch.status, 200);
  assert.equal((await client()('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '3579' })).status, 200);
  const exp = await ana('GET', '/api/me/export');
  assert.equal(exp.status, 200);
  assert.match(exp.headers.get('content-disposition'), /attachment/);
});

test('recuperar o código por email', async () => {
  const anon = client();
  const r = await anon('POST', '/api/auth/forgot', { id: 'ana@exemplo.pt' });
  assert.equal(r.status, 200);
  const ghost = await anon('POST', '/api/auth/forgot', { id: 'ninguem@exemplo.pt' });
  assert.equal(ghost.status, 200, 'não revela se a conta existe');
  const mail = await lastEmailTo('ana@exemplo.pt');
  const code = mail.body.match(/confirmação: (\d{6})/)[1];
  const wrong = await anon('POST', '/api/auth/reset', { id: 'ana@exemplo.pt', code: '000000', pin: '4826', pin2: '4826' });
  assert.equal(wrong.status, 400);
  const ok = await anon('POST', '/api/auth/reset', { id: 'ana@exemplo.pt', code, pin: '4826', pin2: '4826' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  const reuse = await anon('POST', '/api/auth/reset', { id: 'ana@exemplo.pt', code, pin: '4826', pin2: '4826' });
  assert.equal(reuse.status, 400, 'código de confirmação só serve uma vez');
  assert.equal((await ana('GET', '/api/me')).status, 401, 'sessões antigas terminam');
  assert.equal((await ana('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '4826' })).status, 200);
});

test('mensagens: CA escreve, árbitro lê e responde', async () => {
  const rc = await admin('GET', '/api/recipients');
  assert.ok(rc.data.groups.some((g) => g.key === 'role:arb'));
  const s = await admin('POST', '/api/messages', { to: ['role:arb'], subject: 'Disponibilidades', body: 'Marquem as semanas até sexta.' });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  assert.equal(s.data.n, 1);
  const inbox = await ana('GET', '/api/messages');
  const m = inbox.data.messages.find((x) => x.subject === 'Disponibilidades');
  assert.equal(m.read, false);
  assert.equal(m.from.name, 'Teresa Antunes');
  assert.equal((await ana('GET', '/api/me')).data.unread >= 1, true);
  await ana('POST', `/api/messages/${m.id}/read`);
  assert.equal((await ana('GET', '/api/messages')).data.messages.find((x) => x.id === m.id).read, true);
  const no = await ana('POST', '/api/messages', { to: ['all'], subject: 'x', body: 'y' });
  assert.equal(no.status, 403, 'árbitro não escreve para todos');
  const rep = await ana('POST', '/api/messages', { replyTo: m.id, subject: 'Re: Disponibilidades', body: 'Combinado.' });
  assert.equal(rep.status, 200);
  const out = await admin('GET', '/api/messages');
  assert.ok(out.data.messages.some((x) => x.subject === 'Re: Disponibilidades'));
});

test('documentos: publicar, ver, descarregar e apagar', async () => {
  const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n%teste\n').toString('base64');
  const noFile = await admin('POST', '/api/documents', { title: 'Sem ficheiro', cat: 'Circulares', kind: 'file' });
  assert.equal(noFile.status, 400);
  const badExt = await admin('POST', '/api/documents', { title: 'X', cat: 'Outros', kind: 'file', file: { name: 'virus.exe', data: pdf } });
  assert.equal(badExt.status, 400);
  const d = await admin('POST', '/api/documents', { title: 'Circular 3/2026', cat: 'Circulares', descr: 'Recertificações.', kind: 'file', file: { name: 'Circular 3-2026.pdf', data: pdf }, aud: 'all', notify: true });
  assert.equal(d.status, 200, JSON.stringify(d.data));
  const l = await admin('POST', '/api/documents', { title: 'ITF Regulations', cat: 'Regulamentos', kind: 'link', url: 'https://www.itftennis.com/x.pdf', aud: 'ja' });
  assert.equal(l.status, 200);
  const list = await ana('GET', '/api/documents');
  assert.equal(list.data.documents.length, 1, 'o árbitro não vê o documento só para JA');
  assert.equal(list.data.documents[0].seen, false);
  assert.equal((await ana('GET', '/api/me')).data.unseenDocs, 1);
  const file = await ana('GET', `/api/documents/${d.data.id}/file`);
  assert.equal(file.status, 302);
  assert.match(file.headers.get('location'), /download=Circular/);
  assert.equal((await ana('GET', '/api/documents')).data.documents[0].seen, true);
  assert.equal((await ana('GET', `/api/documents/${l.data.id}/file`)).status, 404);
  assert.equal((await ana('DELETE', `/api/documents/${d.data.id}`)).status, 403);
  assert.equal((await admin('DELETE', `/api/documents/${d.data.id}`)).status, 200);
});

test('administração de utilizadores', async () => {
  const c = await admin('POST', '/api/users', { name: 'Miguel Santos', email: 'miguel@exemplo.pt', phone: '913000000', role: 'ja', status: 'ativo' });
  assert.equal(c.status, 200, JSON.stringify(c.data));
  assert.match((await lastEmailTo('miguel@exemplo.pt')).body, /Esqueci-me do código/);
  const e = await admin('PUT', `/api/users/${c.data.user.id}`, { pin: '1470' });
  assert.equal(e.status, 200);
  const miguel = client();
  assert.equal((await miguel('POST', '/api/auth/login', { id: 'miguel@exemplo.pt', pin: '1470' })).status, 200);
  const seen = await miguel('GET', '/api/users');
  assert.equal(seen.status, 200, 'JA vê a lista de utilizadores ativos');
  assert.equal(seen.data.users[0].email, undefined, 'sem dados pessoais');
  assert.equal((await ana('GET', '/api/users')).status, 403);
  const self = await admin('PUT', `/api/users/${(await admin('GET', '/api/me')).data.user.id}`, { role: 'arb' });
  assert.equal(self.status, 400);
  const rej = await admin('POST', '/api/auth/register', null);
  assert.ok(rej.status >= 400);
  const audit = await admin('GET', '/api/audit');
  assert.ok(audit.data.audit.some((a) => a.action === 'aprovou'));
  const emails = await admin('GET', '/api/emails');
  assert.ok(emails.data.emails.every((x) => ['simulado', 'pendente'].includes(x.status)));
});

test('sair termina a sessão', async () => {
  assert.equal((await ana('POST', '/api/auth/logout')).status, 200);
  assert.equal((await ana('GET', '/api/me')).status, 401);
});

test('home e caixa de saída resolvem os resultados assíncronos', async () => {
  const home = await admin('GET', '/api/home');
  assert.equal(home.status, 200);
  assert.equal(typeof home.data.unread, 'number');
  assert.ok(Array.isArray(home.data.unseenDocTitles));
  const sent = await admin('GET', '/api/messages?box=out');
  assert.equal(sent.status, 200);
  assert.ok(sent.data.messages.some(m => m.subject === 'Disponibilidades' && Array.isArray(m.to)));
});

test('signed document upload requires admin and rejects tampered receipts', async () => {
  const login = client();
  await login('POST', '/api/auth/login', { id: 'ana@exemplo.pt', pin: '4826' });
  assert.equal((await login('POST', '/api/documents/upload', { name: 'test.pdf', size: 100 })).status, 403);
  assert.equal((await admin('POST', '/api/documents/upload', { name: 'bad.exe', size: 100 })).status, 400);
  assert.equal((await admin('POST', '/api/documents/upload', { name: 'large.pdf', size: 16 * 1048576 })).status, 400);
  const signed = await admin('POST', '/api/documents/upload', { name: 'signed.pdf', size: 6 });
  assert.equal(signed.status, 200);
  assert.match(signed.data.uploadUrl, /^https:\/\/storage.example.test\//);
  const name = JSON.parse(Buffer.from(signed.data.receipt.split('.')[0], 'base64url')).name;
  objects.set('/documents/' + name, Buffer.from('%PDF-x'));
  const bad = await admin('POST', '/api/documents', { title: 'Signed', cat: 'Outros', kind: 'file', file: { name: 'signed.pdf', receipt: signed.data.receipt + 'x' } });
  assert.equal(bad.status, 400);
  const saved = await admin('POST', '/api/documents', { title: 'Signed', cat: 'Outros', kind: 'file', file: { name: 'signed.pdf', receipt: signed.data.receipt } });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
});

test('arbitragem: comandos persistem, JA atribuído propõe e só CA confirma',async()=>{
  const jaUser=await admin('POST','/api/users',{name:'JA Arbitragem',email:'ja-arb@exemplo.pt',role:'ja',status:'ativo',pin:'1470'});
  assert.equal(jaUser.status,200);const uid=jaUser.data.user.id;
  const users=(await admin('GET','/api/users')).data.users;const aid=users.find(u=>u.email==='ana@exemplo.pt').id;
  assert.equal((await admin('POST','/api/arbitration/command',{action:'qualification',data:{userId:aid,funcs:['CAD','LIN'],lv:{A:'Nível 1 FPT'},courses:[],recNext:''}})).status,200);
  const date='2030-01-06';
  const created=await admin('POST','/api/arbitration/command',{action:'tour',data:{name:'Persisted Tournament',cat:'Campeonato Nacional (CN)',city:'Lisboa',region:'Lisboa',club:'CT Lisboa',start:date,end:'2030-01-13',needs:{JA:1,CAD:1},resp:[uid]}});
  assert.equal(created.status,200,JSON.stringify(created.data));
  const snapshot=(await admin('GET','/api/arbitration/state')).data;const t=snapshot.tours.find(t=>t.name==='Persisted Tournament');assert.ok(t);
  const jaClient=client();assert.equal((await jaClient('POST','/api/auth/login',{id:'ja-arb@exemplo.pt',pin:'1470'})).status,200);
  const proposed=await jaClient('POST','/api/arbitration/command',{action:'nomination',data:{t:t.id,u:aid,fn:'CAD',days:[date]}});assert.equal(proposed.status,200,JSON.stringify(proposed.data));
  const n=(await admin('GET','/api/arbitration/state')).data.noms.find(n=>n.t===t.id);
  assert.equal((await jaClient('POST','/api/arbitration/command',{action:'convocation',data:{t:t.id,ids:[n.id]}})).status,403);
  const confirmed=await admin('POST','/api/arbitration/command',{action:'convocation',data:{t:t.id,ids:[n.id]}});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
  assert.equal((await admin('GET','/api/arbitration/state')).data.noms.find(x=>x.id===n.id).status,'confirmada');
  const person=client();await person('POST','/api/auth/login',{id:'ana@exemplo.pt',pin:'4826'});
  await person('PUT','/api/me',{extra:{funcs:['JA'],recNext:'2099-01-01'}});
  assert.deepEqual((await admin('GET','/api/arbitration/state')).data.users.find(u=>u.id===aid).funcs,['CAD','LIN']);
});
