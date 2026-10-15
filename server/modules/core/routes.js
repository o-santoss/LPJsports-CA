// Rotas do núcleo: entrar/sair, registo, recuperação de código, perfil, utilizadores,
// mensagens, documentos e registos (emails e ações).
import { loadState } from '../arbitration/routes.js';
import { qualification } from '../arbitration/engine.js';
import { randomBytes } from 'node:crypto';
import { now, toJson, fromJson } from '../../core/db.js';
import { badRequest, forbidden, notFound, conflict, sendFile, HttpError } from '../../core/http.js';
import {
  hashPin, verifyPin, validPin, weakPin, createSession, sessionCookie, clearCookie,
  rateLimit, resetCode, hashCode, publicUser, MAX_FAILS, LOCK_MINUTES,
} from '../../core/auth.js';
import { decodeDataUrl, saveFile, removeFile, sendStoredFile, imageType, signDocumentUpload, verifyDocumentUpload } from '../../core/files.js';
import * as v from '../../core/validate.js';
import { APP, hasRole, isAdmin, roleIndex, roleLabel, adminRole } from '../../app.js';
import { config } from '../../config.js';

export const HANDLED = Symbol('handled');
const first = (n) => String(n || '').split(' ')[0];
const STATUSES = ['pendente', 'ativo', 'suspenso', 'recusado'];

export function registerCoreRoutes(r, { db, notify, audit }) {
  const getUser = async (id) => (await db.get('SELECT * FROM users WHERE id = ?', Number(id)));
  const findLogin = async (id) => {
    const e = v.str(id, 160).toLowerCase();
    const d = v.digits(e);
    return (await db.get('SELECT * FROM users WHERE email = ?', e))
      || (d.length >= 9 ? (await db.get("SELECT * FROM users WHERE replace(replace(replace(phone,' ',''),'-',''),'+','') LIKE ?", '%' + d.slice(-9))) : null);
  };
  const minutesLeft = (iso) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60000));

  // ---------- configuração pública ----------
  r.get('/api/config', () => ({
    app: {
      key: APP.key, name: APP.name, tagline: APP.tagline, org: APP.org, owner: APP.owner, ownerUrl: APP.ownerUrl,
      roles: APP.roles, regions: APP.regions, assocs: APP.assocs, docCats: APP.docCats, docExt: APP.docExt, modules: APP.modules,
    },
  }), { access: 'public' });

  r.get('/api/health', () => ({ ok: true, time: now() }), { access: 'public' });

  // ---------- entrar e sair ----------
  r.post('/api/auth/login', async (c) => {
    rateLimit('login:' + c.ip, 30, 15 * 60000);
    const id = v.str(c.body.id, 160);
    const pin = String(c.body.pin ?? '');
    if (!id || !pin) throw badRequest('Preenche o email (ou telemóvel) e o código.');
    const u = (await findLogin(id));
    if (!u) throw badRequest('Não encontrámos nenhuma conta com esse email ou telemóvel.');
    if (u.lock_until && u.lock_until > now()) {
      throw new HttpError(423, `Conta bloqueada por excesso de tentativas. Tenta de novo dentro de ${minutesLeft(u.lock_until)} min ou usa "Esqueci-me do código".`);
    }
    if (!verifyPin(pin, u.pin_hash)) {
      const fails = u.fails + 1;
      if (fails >= MAX_FAILS) {
        (await db.run('UPDATE users SET fails = 0, lock_until = ? WHERE id = ?', new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(), u.id));
        (await audit(u.id, 'conta_bloqueada', `user:${u.id}`, null, c.ip));
        throw new HttpError(423, `Código errado. A conta ficou bloqueada durante ${LOCK_MINUTES} minutos.`);
      }
      (await db.run('UPDATE users SET fails = ? WHERE id = ?', fails, u.id));
      const left = MAX_FAILS - fails;
      throw badRequest(`Código errado. ${left === 1 ? 'Resta 1 tentativa' : `Restam ${left} tentativas`} antes de a conta ficar bloqueada.`);
    }
    if (u.status === 'pendente') throw new HttpError(403, 'A tua conta ainda está à espera de aprovação.', { code: 'pendente', name: u.name });
    if (u.status !== 'ativo') throw new HttpError(403, 'Esta conta não está ativa. Fala com o administrador.', { code: u.status });
    (await db.run('UPDATE users SET fails = 0, lock_until = NULL, last_login_at = ? WHERE id = ?', now(), u.id));
    const token = (await createSession(db, u.id, c.req));
    c.setCookie(sessionCookie(token, c.req));
    (await audit(u.id, 'entrou', null, null, c.ip));
    return { user: publicUser((await getUser(u.id)), { full: true }) };
  }, { access: 'public' });

  r.post('/api/auth/logout', async (c) => {
    if (c.sid) (await db.run('DELETE FROM sessions WHERE id = ?', c.sid));
    c.setCookie(clearCookie(c.req));
    return { ok: true };
  }, { access: 'public' });

  // ---------- criar conta ----------
  r.post('/api/auth/register', async (c) => {
    rateLimit('register:' + c.ip, 10, 60 * 60000);
    const b = c.body;
    const name = v.fullName(b.name);
    const email = v.email(b.email);
    const phone = v.phone(b.phone);
    const region = v.oneOf(b.region, APP.regions, { optional: true, label: 'região' });
    const assoc = v.oneOf(b.assoc, APP.assocs, { optional: true, label: 'associação' });
    const pin = String(b.pin ?? '');
    if ((await db.get('SELECT id FROM users WHERE email = ?', email))) throw conflict('Já existe uma conta com esse email.');
    if (!validPin(pin)) throw badRequest('O código tem de ter exatamente 4 algarismos.');
    if (weakPin(pin)) throw badRequest('Esse código é demasiado fácil de adivinhar. Escolhe outro.');
    if (pin !== String(b.pin2 ?? '')) throw badRequest('Os dois códigos não são iguais.');
    if (!b.consent) throw badRequest('Para criar conta tens de autorizar o tratamento dos dados.');
    const extra = b.extra?.funcs ? qualification(b.extra) : {};
    const t = now();
    const { id } = (await db.run(`INSERT INTO users (name, email, phone, role, status, pin_hash, region, assoc, licence, extra, consent_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?)`,
      name, email, phone, APP.defaultRole, hashPin(pin), region, assoc, v.str(b.licence, 40), toJson(extra), t, t, t));
    (await audit(id, 'registo', `user:${id}`, null, c.ip));
    (await notify.send({
      to: (await notify.admins()), kind: 'registo', subject: `Novo registo por aprovar: ${name}`,
      body: `${name} criou conta e aguarda aprovação.\n\nEmail: ${email}\nTelemóvel: ${phone}${region ? `\nRegião: ${region}` : ''}${assoc ? `\nAssociação: ${assoc}` : ''}`,
      link: '/utilizadores',
    }));
    return { ok: true, name };
  }, { access: 'public', limit: 64 * 1024 });

  // ---------- recuperar o código por email ----------
  r.post('/api/auth/forgot', async (c) => {
    rateLimit('forgot:' + c.ip, 8, 60 * 60000);
    const u = (await findLogin(c.body.id));
    // Responde sempre o mesmo, para não revelar que contas existem.
    if (u && u.status === 'ativo') {
      const code = resetCode();
      (await db.run('UPDATE pin_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', now(), u.id));
      (await db.run('INSERT INTO pin_resets (user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)',
        u.id, hashCode(code), new Date(Date.now() + 20 * 60000).toISOString(), now()));
      (await notify.send({
        to: [u.id], kind: 'acesso', subject: `${APP.name}: código para definir um novo código de acesso`,
        body: `Olá ${first(u.name)},\n\nPediste para definir um novo código de acesso.\n\nCódigo de confirmação: ${code}\n\nÉ válido durante 20 minutos. Se não foste tu, ignora este email: o teu código atual continua a funcionar.`,
      }));
      (await audit(u.id, 'pediu_reposicao', null, null, c.ip));
    }
    return { ok: true };
  }, { access: 'public' });

  r.post('/api/auth/reset', async (c) => {
    rateLimit('reset:' + c.ip, 20, 60 * 60000);
    const u = (await findLogin(c.body.id));
    const code = v.digits(c.body.code);
    const pin = String(c.body.pin ?? '');
    const fail = () => badRequest('O código de confirmação está errado ou já expirou. Pede um novo.');
    if (!u || u.status !== 'ativo') throw fail();
    const pr = (await db.get('SELECT * FROM pin_resets WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', u.id));
    if (!pr || pr.expires_at < now() || pr.tries >= 5) throw fail();
    if (hashCode(code) !== pr.code_hash) {
      (await db.run('UPDATE pin_resets SET tries = tries + 1 WHERE id = ?', pr.id));
      throw fail();
    }
    if (!validPin(pin)) throw badRequest('O código novo tem de ter exatamente 4 algarismos.');
    if (weakPin(pin)) throw badRequest('Esse código é demasiado fácil de adivinhar. Escolhe outro.');
    if (pin !== String(c.body.pin2 ?? '')) throw badRequest('Os dois códigos não são iguais.');
    (await db.tx(async () => {
      (await db.run('UPDATE users SET pin_hash = ?, fails = 0, lock_until = NULL, updated_at = ? WHERE id = ?', hashPin(pin), now(), u.id));
      (await db.run('UPDATE pin_resets SET used_at = ? WHERE id = ?', now(), pr.id));
      (await db.run('DELETE FROM sessions WHERE user_id = ?', u.id));
    }));
    (await audit(u.id, 'repos_codigo', null, null, c.ip));
    return { ok: true };
  }, { access: 'public' });

  // ---------- o meu perfil ----------
  r.get('/api/me', async (c) => {
    const unread = (await db.get('SELECT COUNT(*) n FROM message_to WHERE user_id = ? AND read_at IS NULL', c.user.id)).n;
    return { user: publicUser(c.user, { full: true }), unread, unseenDocs: (await unseenDocs(c.user)).length };
  });

  r.put('/api/me', async (c) => {
    const b = c.body;
    const me = c.user;
    const email = b.email !== undefined ? v.email(b.email) : me.email;
    if (email !== me.email && (await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', email, me.id))) {
      throw conflict('Esse email já está a ser usado noutra conta.');
    }
    // Qualifications are edited exclusively via the CA-only domain command.
    const extra = fromJson(me.extra, {});
    (await db.run(`UPDATE users SET name = ?, email = ?, phone = ?, region = ?, assoc = ?, addr = ?, postal = ?, tel = ?, birth = ?,
      notif_conf = ?, notif_msg = ?, extra = ?, updated_at = ? WHERE id = ?`,
      b.name !== undefined ? v.fullName(b.name) : me.name,
      email,
      b.phone !== undefined ? v.phone(b.phone) : me.phone,
      b.region !== undefined ? v.oneOf(b.region, APP.regions, { optional: true, label: 'região' }) : me.region,
      b.assoc !== undefined ? v.oneOf(b.assoc, APP.assocs, { optional: true, label: 'associação' }) : me.assoc,
      b.addr !== undefined ? v.str(b.addr, 200) : me.addr,
      b.postal !== undefined ? v.str(b.postal, 80) : me.postal,
      b.tel !== undefined ? v.str(b.tel, 30) : me.tel,
      b.birth !== undefined ? v.date(b.birth) : me.birth,
      b.notif ? (b.notif.conf ? 1 : 0) : me.notif_conf,
      b.notif ? (b.notif.msg ? 1 : 0) : me.notif_msg,
      toJson(extra), now(), me.id));
    return { user: publicUser((await getUser(me.id)), { full: true }) };
  });

  r.put('/api/me/pin', async (c) => {
    const { old, pin, pin2 } = c.body;
    if (!verifyPin(String(old ?? ''), c.user.pin_hash)) throw badRequest('O código atual não está certo.');
    if (!validPin(pin)) throw badRequest('O código novo tem de ter 4 algarismos.');
    if (weakPin(pin)) throw badRequest('Esse código é demasiado fácil de adivinhar.');
    if (pin !== pin2) throw badRequest('Os dois códigos novos não são iguais.');
    (await db.run('UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?', hashPin(pin), now(), c.user.id));
    (await db.run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', c.user.id, c.sid));
    (await audit(c.user.id, 'mudou_codigo', null, null, c.ip));
    return { ok: true };
  });

  r.put('/api/me/photo', async (c) => {
    const { buf } = decodeDataUrl(c.body.data, 2 * 1048576);
    const ext = imageType(buf);
    if (!ext) throw badRequest('Escolhe uma imagem JPG, PNG ou WebP.');
    const name = (await saveFile('photos', buf, ext));
    (await db.run('UPDATE users SET photo = ?, updated_at = ? WHERE id = ?', name, now(), c.user.id));
    (await removeFile('photos', c.user.photo));
    return { user: publicUser((await getUser(c.user.id)), { full: true }) };
  }, { limit: 3 * 1048576 });

  r.del('/api/me/photo', async (c) => {
    (await removeFile('photos', c.user.photo));
    (await db.run('UPDATE users SET photo = NULL, updated_at = ? WHERE id = ?', now(), c.user.id));
    return { user: publicUser((await getUser(c.user.id)), { full: true }) };
  });

  // RGPD: a pessoa pode descarregar todos os seus dados.
  r.get('/api/me/export', async (c) => {
    const me = publicUser(c.user, { full: true });
    const messages = (await db.all(`SELECT m.subject, m.body, m.created_at, mt.read_at FROM message_to mt JOIN messages m ON m.id = mt.message_id
      WHERE mt.user_id = ? ORDER BY m.id`, c.user.id));
    const sent = (await db.all('SELECT subject, body, created_at FROM messages WHERE from_id = ? ORDER BY id', c.user.id));
    const domain=await loadState(db);
    const person=domain.users.find(u=>u.id===c.user.id);
    const arbitragem={qualificacoes:{funcs:person?.funcs,lv:person?.lv,courses:person?.courses,recNext:person?.recNext},disponibilidades:domain.avail.filter(a=>a.u===c.user.id),nomeacoes:domain.noms.filter(n=>n.u===c.user.id),avaliacoes:domain.evals.filter(e=>e.u===c.user.id&&e.status==='validada'),caderneta:domain.cad.filter(e=>e.u===c.user.id)};
    const data = { arbitragem, exportadoEm: now(), app: APP.name, perfil: me, mensagensRecebidas: messages, mensagensEnviadas: sent };
    c.res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="os-meus-dados-${APP.key}.json"`,
      'Cache-Control': 'no-store',
    });
    c.res.end(JSON.stringify(data, null, 2));
    return HANDLED;
  });

  r.get('/api/photos/:file', async (c) => {
    if (!/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(c.params.file)) throw notFound();
    if (!(await sendStoredFile(c.req, c.res, 'photos', c.params.file))) throw notFound();
    return HANDLED;
  });

  // ---------- utilizadores (administração) ----------
  const ADMIN = { access: adminRole() };

  r.get('/api/users', async (c) => {
    const rows = (await db.all('SELECT * FROM users ORDER BY lower(name)'));
    const full = isAdmin(c.user);
    return { users: rows.filter((u) => full || u.status === 'ativo').map((u) => publicUser(u, { full })) };
  }, { access: APP.roles[Math.min(1, APP.roles.length - 1)].key });

  const userFields = (b, prev = {}) => ({
    name: b.name !== undefined ? v.fullName(b.name) : prev.name,
    email: b.email !== undefined ? v.email(b.email) : prev.email,
    phone: b.phone !== undefined ? v.phone(b.phone, false) : prev.phone ?? '',
    role: b.role !== undefined ? v.oneOf(b.role, APP.roles.map((x) => x.key), { label: 'perfil' }) : prev.role ?? APP.defaultRole,
    status: b.status !== undefined ? v.oneOf(b.status, STATUSES, { label: 'estado' }) : prev.status ?? 'ativo',
    region: b.region !== undefined ? v.oneOf(b.region, APP.regions, { optional: true, label: 'região' }) : prev.region ?? '',
    assoc: b.assoc !== undefined ? v.oneOf(b.assoc, APP.assocs, { optional: true, label: 'associação' }) : prev.assoc ?? '',
    licence: b.licence !== undefined ? v.str(b.licence, 40) : prev.licence ?? '',
    addr: b.addr !== undefined ? v.str(b.addr, 200) : prev.addr ?? '',
    postal: b.postal !== undefined ? v.str(b.postal, 80) : prev.postal ?? '',
    tel: b.tel !== undefined ? v.str(b.tel, 30) : prev.tel ?? '',
    birth: b.birth !== undefined ? v.date(b.birth) : prev.birth ?? '',
    extra: prev.extra ?? '{}',
  });

  r.post('/api/users', async (c) => {
    const f = userFields(c.body);
    if ((await db.get('SELECT id FROM users WHERE email = ?', f.email))) throw conflict('Já existe um utilizador com esse email.');
    let pin = String(c.body.pin ?? '');
    if (pin && (!validPin(pin) || weakPin(pin))) throw badRequest('O código tem de ter 4 algarismos e não pode ser fácil de adivinhar.');
    const definedPin = !!pin;
    if (!pin) pin = randomBytes(24).toString('hex'); // inutilizável: a pessoa define o seu em "Esqueci-me do código"
    const t = now();
    const { id } = (await db.run(`INSERT INTO users (name, email, phone, role, status, pin_hash, region, assoc, licence, addr, postal, tel, birth, extra, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      f.name, f.email, f.phone, f.role, f.status, hashPin(pin), f.region, f.assoc, f.licence, f.addr, f.postal, f.tel, f.birth, f.extra, t, t));
    (await audit(c.user.id, 'criou_utilizador', `user:${id}`, f.email, c.ip));
    if (f.status === 'ativo') {
      (await notify.send({
        to: [id], kind: 'acesso', subject: `A tua conta em ${APP.name} está pronta`,
        body: `Olá ${first(f.name)},\n\n${c.user.name} criou a tua conta em ${APP.name}.\n\nEntra em ${config.publicUrl} com o teu email (${f.email}).${definedPin ? ' O código de acesso foi-te comunicado pelo administrador; podes alterá-lo no teu perfil.' : ' Para definir o teu código de 4 algarismos, toca em "Esqueci-me do código" no ecrã de entrada.'}`,
      }));
    }
    return { user: publicUser((await getUser(id)), { full: true }) };
  }, ADMIN);

  r.put('/api/users/:id', async (c) => {
    const u = (await getUser(c.params.id));
    if (!u) throw notFound('Utilizador não encontrado.');
    const f = userFields(c.body, u);
    if (f.email !== u.email && (await db.get('SELECT id FROM users WHERE email = ? AND id <> ?', f.email, u.id))) throw conflict('Já existe um utilizador com esse email.');
    if (u.id === c.user.id && (f.role !== u.role || f.status !== 'ativo')) throw badRequest('Não podes mudar o teu próprio perfil de acesso nem desativar a tua conta.');
    const pin = String(c.body.pin ?? '');
    if (pin && (!validPin(pin) || weakPin(pin))) throw badRequest('O código tem de ter 4 algarismos e não pode ser fácil de adivinhar.');
    (await db.tx(async () => {
      (await db.run(`UPDATE users SET name = ?, email = ?, phone = ?, role = ?, status = ?, region = ?, assoc = ?, licence = ?, addr = ?, postal = ?, tel = ?, birth = ?, extra = ?, updated_at = ?
        ${pin ? ', pin_hash = ?, fails = 0, lock_until = NULL' : ''} WHERE id = ?`,
        f.name, f.email, f.phone, f.role, f.status, f.region, f.assoc, f.licence, f.addr, f.postal, f.tel, f.birth, f.extra, now(), ...(pin ? [hashPin(pin)] : []), u.id));
      if (f.status !== 'ativo' || pin) (await db.run('DELETE FROM sessions WHERE user_id = ?', u.id));
    }));
    (await audit(c.user.id, 'editou_utilizador', `user:${u.id}`, pin ? 'com novo código' : null, c.ip));
    return { user: publicUser((await getUser(u.id)), { full: true }) };
  }, ADMIN);

  r.post('/api/users/:id/approve', async (c) => {
    const u = (await getUser(c.params.id));
    if (!u) throw notFound('Utilizador não encontrado.');
    if (u.status === 'ativo') return { user: publicUser(u, { full: true }) };
    (await db.run("UPDATE users SET status = 'ativo', updated_at = ? WHERE id = ?", now(), u.id));
    (await audit(c.user.id, 'aprovou', `user:${u.id}`, null, c.ip));
    (await notify.send({
      to: [u.id], kind: 'aprovacao', subject: `${APP.name}: a tua conta foi aprovada`,
      body: `Olá ${first(u.name)},\n\nA tua conta foi aprovada pelo ${APP.org}. Já podes entrar em ${config.publicUrl} com o teu email e o teu código de 4 algarismos.`,
    }));
    return { user: publicUser((await getUser(u.id)), { full: true }) };
  }, ADMIN);

  r.post('/api/users/:id/reject', async (c) => {
    const u = (await getUser(c.params.id));
    if (!u) throw notFound('Utilizador não encontrado.');
    const reason = v.text(c.body.reason, 600);
    (await db.run("UPDATE users SET status = 'recusado', updated_at = ? WHERE id = ?", now(), u.id));
    (await db.run('DELETE FROM sessions WHERE user_id = ?', u.id));
    (await audit(c.user.id, 'recusou', `user:${u.id}`, reason, c.ip));
    // O email segue mesmo sem a pessoa poder entrar.
    (await notify.send({
      to: [u.id], kind: 'rejeicao', subject: `${APP.name}: registo não aprovado`,
      body: `Olá ${first(u.name)},\n\nO teu registo em ${APP.name} não foi aprovado.${reason ? `\n\nMotivo: ${reason}` : ''}\n\nSe achas que é um engano, responde a este email ou contacta o ${APP.org}.`,
    }));
    return { user: publicUser((await getUser(u.id)), { full: true }) };
  }, ADMIN);

  r.post('/api/users/:id/unlock', async (c) => {
    const u = (await getUser(c.params.id));
    if (!u) throw notFound('Utilizador não encontrado.');
    (await db.run('UPDATE users SET fails = 0, lock_until = NULL WHERE id = ?', u.id));
    (await audit(c.user.id, 'desbloqueou', `user:${u.id}`, null, c.ip));
    return { user: publicUser((await getUser(u.id)), { full: true }) };
  }, ADMIN);

  r.del('/api/users/:id', async (c) => {
    const u = (await getUser(c.params.id));
    if (!u) throw notFound('Utilizador não encontrado.');
    if (u.id === c.user.id) throw badRequest('Não podes apagar a tua própria conta.');
    (await removeFile('photos', u.photo));
    (await db.run('DELETE FROM users WHERE id = ?', u.id));
    (await audit(c.user.id, 'apagou_utilizador', `user:${u.id}`, u.email, c.ip));
    return { ok: true };
  }, ADMIN);

  // ---------- mensagens e notificações ----------
  const canCompose = (u) => roleIndex(u.role) >= 1 || APP.roles.length === 1;

  r.get('/api/messages', async (c) => {
    const box = c.query.get('box') === 'out' ? 'out' : 'in';
    if (box === 'in') {
      const rows = (await db.all(`SELECT m.*, mt.read_at, u.name AS from_name FROM message_to mt JOIN messages m ON m.id = mt.message_id
        LEFT JOIN users u ON u.id = m.from_id WHERE mt.user_id = ? ORDER BY m.id DESC LIMIT 300`, c.user.id));
      return { messages: rows.map((m) => ({ id: m.id, kind: m.kind, subject: m.subject, body: m.body, link: m.link, at: m.created_at, read: !!m.read_at, from: m.from_id ? { id: m.from_id, name: m.from_name || 'Utilizador removido' } : null })) };
    }
    const rows = (await db.all('SELECT * FROM messages WHERE from_id = ? ORDER BY id DESC LIMIT 300', c.user.id));
    return {
      messages: await Promise.all(rows.map(async (m) => {
        const to = (await db.all('SELECT u.id, u.name, mt.read_at FROM message_to mt JOIN users u ON u.id = mt.user_id WHERE mt.message_id = ?', m.id));
        return { id: m.id, kind: m.kind, subject: m.subject, body: m.body, at: m.created_at, to: to.map((t) => ({ id: t.id, name: t.name, read: !!t.read_at })) };
      })),
    };
  });

  r.post('/api/messages/:id/read', async (c) => {
    (await db.run('UPDATE message_to SET read_at = ? WHERE message_id = ? AND user_id = ? AND read_at IS NULL', now(), Number(c.params.id), c.user.id));
    return { ok: true };
  });
  r.post('/api/messages/read-all', async (c) => {
    (await db.run('UPDATE message_to SET read_at = ? WHERE user_id = ? AND read_at IS NULL', now(), c.user.id));
    return { ok: true };
  });

  // Destinatários possíveis para quem pode escrever mensagens.
  r.get('/api/recipients', async (c) => {
    if (!canCompose(c.user)) throw forbidden();
    const users = (await db.all("SELECT id, name, role, region FROM users WHERE status = 'ativo' AND id <> ? ORDER BY lower(name)", c.user.id));
    const groups = APP.roles.map((ro) => ({ key: `role:${ro.key}`, label: `Todos: ${ro.plural}`, n: users.filter((u) => u.role === ro.key).length }));
    return { users: users.map((u) => ({ id: u.id, name: u.name, role: u.role, roleLabel: roleLabel(u.role), region: u.region })), groups: [{ key: 'all', label: 'Todos os utilizadores', n: users.length }, ...groups] };
  });

  r.post('/api/messages', async (c) => {
    const subject = v.str(c.body.subject, 160);
    const body = v.text(c.body.body, 5000);
    if (!subject || !body) throw badRequest('Escreve o assunto e a mensagem.');
    let to = [];
    const replyTo = Number(c.body.replyTo) || 0;
    if (replyTo) {
      const orig = (await db.get('SELECT m.* FROM messages m JOIN message_to mt ON mt.message_id = m.id WHERE m.id = ? AND mt.user_id = ?', replyTo, c.user.id));
      if (!orig || !orig.from_id) throw badRequest('Não é possível responder a esta mensagem.');
      to = [orig.from_id];
    } else {
      if (!canCompose(c.user)) throw forbidden('Só podes responder a mensagens que recebeste.');
      const active = (await db.all("SELECT id, role FROM users WHERE status = 'ativo' AND id <> ?", c.user.id));
      for (const t of [].concat(c.body.to || [])) {
        if (t === 'all') to.push(...active.map((u) => u.id));
        else if (typeof t === 'string' && t.startsWith('role:')) to.push(...active.filter((u) => u.role === t.slice(5)).map((u) => u.id));
        else if (active.some((u) => u.id === Number(t))) to.push(Number(t));
      }
    }
    to = [...new Set(to)];
    if (!to.length) throw badRequest('Escolhe pelo menos um destinatário.');
    const id = (await notify.send({ from: c.user.id, to, kind: 'mensagem', subject, body }));
    return { ok: true, id, n: to.length };
  });

  // ---------- documentos ----------
  const canSee = (u, d) => d.aud === 'all' || hasRole(u, d.aud);
  async function unseenDocs(u) {
    const rows = (await db.all('SELECT d.id, d.aud FROM documents d LEFT JOIN document_seen s ON s.document_id = d.id AND s.user_id = ? WHERE s.user_id IS NULL', u.id));
    return rows.filter((d) => canSee(u, d));
  }
  const docOut = (d, u) => ({
    id: d.id, title: d.title, cat: d.cat, descr: d.descr, ver: d.ver, kind: d.kind, url: d.kind === 'link' ? d.url : null,
    fname: d.fname, ext: d.ext, size: d.size, aud: d.aud, at: d.created_at, updatedAt: d.updated_at,
    seen: !!d.seen, by: d.by_name || null,
    ...(isAdmin(u) ? { views: d.views ?? 0 } : {}),
  });

  r.get('/api/documents', async (c) => {
    const rows = (await db.all(`SELECT d.*, s.user_id AS seen, u.name AS by_name,
      (SELECT COUNT(*) FROM document_seen x WHERE x.document_id = d.id) AS views
      FROM documents d LEFT JOIN document_seen s ON s.document_id = d.id AND s.user_id = ? LEFT JOIN users u ON u.id = d.created_by
      ORDER BY d.created_at DESC`, c.user.id));
    return { documents: rows.filter((d) => canSee(c.user, d)).map((d) => docOut(d, c.user)) };
  });

  async function docInput(b, prev, userId) {
    const title = v.str(b.title, 160);
    if (!title) throw badRequest('Escreve o título do documento.');
    const kind = v.oneOf(b.kind ?? prev?.kind ?? 'file', ['file', 'link'], { label: 'tipo' });
    const aud = b.aud === 'all' || !b.aud ? 'all' : v.oneOf(b.aud, APP.roles.map((x) => x.key), { label: 'público' });
    const out = { title, kind, aud, cat: v.oneOf(b.cat || 'Outros', APP.docCats, { label: 'categoria' }), descr: v.text(b.descr, 1000), ver: v.date(b.ver) };
    if (kind === 'link') {
      const url = v.str(b.url, 600);
      if (!/^https:\/\/[^\s]+$/i.test(url)) throw badRequest('O link tem de começar por https://');
      out.url = url;
    }
    if (kind === 'file' && b.file) {
      const fname = v.str(b.file.name, 160).replace(/[\\/]/g, '_');
      const ext = (fname.split('.').pop() || '').toLowerCase();
      if (!APP.docExt.includes(ext)) throw badRequest(`Tipo de ficheiro não aceite. Aceites: ${APP.docExt.join(', ')}.`);
      if (b.file.receipt) {
        const upload = await verifyDocumentUpload(b.file.receipt, userId);
        if (!upload.name.endsWith('.' + ext)) throw badRequest('Extensão inválida.');
        out.newFile = { stored: upload.name, size: upload.size, ext, fname };
      } else {
        const { buf } = decodeDataUrl(b.file.data, 3 * 1048576);
        out.newFile = { buf, size: buf.length, ext, fname };
      }
    } else if (kind === 'file' && !prev?.file) throw badRequest('Escolhe o ficheiro.');
    return out;
  }

  r.post('/api/documents/upload', async (c) => {
    const ext = String(c.body.name || '').split('.').pop().toLowerCase();
    if (!APP.docExt.includes(ext)) throw badRequest('Tipo de ficheiro não aceite.');
    return signDocumentUpload(c.user.id, ext, c.body.size);
  }, ADMIN);

  r.post('/api/documents', async (c) => {
    const d = await docInput(c.body, undefined, c.user.id);
    const t = now();
    let file = null;
    if (d.newFile) file = (d.newFile.stored || await saveFile('docs', d.newFile.buf, d.newFile.ext));
    const { id } = (await db.run(`INSERT INTO documents (title, cat, descr, ver, kind, file, url, fname, ext, size, aud, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      d.title, d.cat, d.descr, d.ver, d.kind, file, d.url ?? null, d.newFile?.fname ?? null, d.newFile ? d.newFile.ext.toUpperCase() : 'LINK', d.newFile?.size ?? null, d.aud, c.user.id, t, t));
    (await db.run('INSERT INTO document_seen (document_id, user_id, seen_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', id, c.user.id, t));
    (await audit(c.user.id, 'publicou_documento', `doc:${id}`, d.title, c.ip));
    if (c.body.notify) {
      const to = (await db.all("SELECT id, role FROM users WHERE status = 'ativo' AND id <> ?", c.user.id)).filter((u) => d.aud === 'all' || hasRole(u, d.aud)).map((u) => u.id);
      (await notify.send({ to, kind: 'documento', subject: `Documento novo: ${d.title}`, body: `${c.user.name} publicou um documento novo em ${APP.name}: ${d.title} (${d.cat}).${d.descr ? `\n\n${d.descr}` : ''}\n\nEstá em Documentos: ${config.publicUrl}/documentos`, link: '/documentos' }));
    }
    return { ok: true, id };
  }, { ...ADMIN, limit: 4 * 1048576 });

  r.put('/api/documents/:id', async (c) => {
    const prev = (await db.get('SELECT * FROM documents WHERE id = ?', Number(c.params.id)));
    if (!prev) throw notFound('Documento não encontrado.');
    const d = await docInput(c.body, prev, c.user.id);
    let file = d.kind === 'file' ? prev.file : null, fname = d.kind === 'file' ? prev.fname : null, ext = d.kind === 'file' ? prev.ext : 'LINK', size = d.kind === 'file' ? prev.size : null;
    if (d.newFile) { file = (d.newFile.stored || await saveFile('docs', d.newFile.buf, d.newFile.ext)); fname = d.newFile.fname; ext = d.newFile.ext.toUpperCase(); size = d.newFile.size; }
    (await db.run('UPDATE documents SET title = ?, cat = ?, descr = ?, ver = ?, kind = ?, file = ?, url = ?, fname = ?, ext = ?, size = ?, aud = ?, updated_at = ? WHERE id = ?',
      d.title, d.cat, d.descr, d.ver, d.kind, file, d.url ?? null, fname, ext, size, d.aud, now(), prev.id));
    if (prev.file && prev.file !== file) await removeFile('docs', prev.file);
    (await audit(c.user.id, 'editou_documento', `doc:${prev.id}`, d.title, c.ip));
    return { ok: true };
  }, { ...ADMIN, limit: 4 * 1048576 });

  r.del('/api/documents/:id', async (c) => {
    const d = (await db.get('SELECT * FROM documents WHERE id = ?', Number(c.params.id)));
    if (!d) throw notFound('Documento não encontrado.');
    (await removeFile('docs', d.file));
    (await db.run('DELETE FROM documents WHERE id = ?', d.id));
    (await audit(c.user.id, 'apagou_documento', `doc:${d.id}`, d.title, c.ip));
    return { ok: true };
  }, ADMIN);

  const markSeen = async (docId, uid) => (await db.run('INSERT INTO document_seen (document_id, user_id, seen_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', docId, uid, now()));

  r.get('/api/documents/:id/file', async (c) => {
    const d = (await db.get('SELECT * FROM documents WHERE id = ?', Number(c.params.id)));
    if (!d || d.kind !== 'file' || !canSee(c.user, d)) throw notFound('Documento não encontrado.');
    (await markSeen(d.id, c.user.id));
    if (!(await sendStoredFile(c.req, c.res, 'docs', d.file, { download: d.fname }))) throw notFound('O ficheiro já não existe.');
    return HANDLED;
  });

  r.post('/api/documents/:id/seen', async (c) => {
    const d = (await db.get('SELECT * FROM documents WHERE id = ?', Number(c.params.id)));
    if (!d || !canSee(c.user, d)) throw notFound('Documento não encontrado.');
    (await markSeen(d.id, c.user.id));
    return { ok: true };
  });

  // ---------- início, emails e registo de ações ----------
  r.get('/api/home', async (c) => {
    const unread = (await db.get('SELECT COUNT(*) n FROM message_to WHERE user_id = ? AND read_at IS NULL', c.user.id)).n;
    const latest = (await db.all(`SELECT m.id, m.subject, m.kind, m.created_at, mt.read_at, u.name AS from_name FROM message_to mt JOIN messages m ON m.id = mt.message_id
      LEFT JOIN users u ON u.id = m.from_id WHERE mt.user_id = ? ORDER BY m.id DESC LIMIT 5`, c.user.id));
    const docs = (await unseenDocs(c.user));
    const out = {
      unread,
      latest: latest.map((m) => ({ id: m.id, subject: m.subject, kind: m.kind, at: m.created_at, read: !!m.read_at, from: m.from_name || null })),
      unseenDocs: docs.length,
      unseenDocTitles: await Promise.all(docs.slice(0, 5).map(async (d) => (await db.get('SELECT title FROM documents WHERE id = ?', d.id))?.title)),
    };
    if (isAdmin(c.user)) {
      out.pending = (await db.get("SELECT COUNT(*) n FROM users WHERE status = 'pendente'")).n;
      out.users = (await db.get("SELECT COUNT(*) n FROM users WHERE status = 'ativo'")).n;
      out.emailErrors = (await db.get("SELECT COUNT(*) n FROM emails WHERE status = 'erro'")).n;
    }
    return out;
  });

  r.get('/api/emails', async (c) => {
    const rows = (await db.all('SELECT * FROM emails ORDER BY id DESC LIMIT 300'));
    return { emails: rows.map((e) => ({ id: e.id, type: e.type, to: fromJson(e.to_json, []), cc: fromJson(e.cc_json, []), subject: e.subject, body: e.body, status: e.status, error: e.error, at: e.created_at, sentAt: e.sent_at })) };
  }, ADMIN);

  r.get('/api/audit', async () => ({
    audit: (await db.all('SELECT a.*, u.name AS user_name FROM audit a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300')),
  }), ADMIN);
}
