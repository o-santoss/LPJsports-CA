// Contas e sessões: códigos guardados com scrypt, sessões em cookie HttpOnly, bloqueio após tentativas falhadas.
import { scryptSync, randomBytes, timingSafeEqual, createHash, randomInt } from 'node:crypto';
import { now, fromJson } from './db.js';
import { cookieHeader, parseCookies, tooMany } from './http.js';
import { config } from '../config.js';
import { APP, roleLabel } from '../app.js';

export const COOKIE = 'lpj_sid';
export const MAX_FAILS = 5;
export const LOCK_MINUTES = 15;

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(pin), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPin(pin, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const got = scryptSync(String(pin), Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const validPin = (p) => /^\d{4}$/.test(String(p || ''));
export const weakPin = (p) => /^(\d)\1{3}$/.test(p) || ['1234', '4321', '0123', '1212', '2580', '0000'].includes(p);

const sha = (s) => createHash('sha256').update(s).digest('hex');

export async function createSession(db, userId, req) {
  const token = randomBytes(32).toString('base64url');
  const exp = new Date(Date.now() + config.sessionDays * 86400000).toISOString();
  (await db.run('INSERT INTO sessions (id, user_id, created_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?)',
    sha(token), userId, now(), exp, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 200)));
  return token;
}

export function sessionCookie(token, req) {
  return cookieHeader(COOKIE, token, { maxAge: config.sessionDays * 86400, secure: isHttps(req) });
}
export const clearCookie = (req) => cookieHeader(COOKIE, '', { maxAge: 0, secure: isHttps(req) });

export function isHttps(req) {
  if (config.production) return true;
  return config.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

export function clientIp(req) {
  if (config.trustProxy) {
    const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (f) return f;
  }
  return req.socket?.remoteAddress || '';
}

// Lê a sessão do cookie. Devolve { user, sid } ou null. Prolonga a sessão se estiver a meio da validade.
export async function loadSession(db, req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const sid = sha(token);
  const row = (await db.get('SELECT s.id AS sid, s.expires_at, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', sid));
  if (!row) return null;
  if (row.expires_at < now()) {
    (await db.run('DELETE FROM sessions WHERE id = ?', sid));
    return null;
  }
  if (row.status !== 'ativo') {
    (await db.run('DELETE FROM sessions WHERE user_id = ?', row.id));
    return null;
  }
  const half = Date.now() + (config.sessionDays * 86400000) / 2;
  if (new Date(row.expires_at).getTime() < half) {
    (await db.run('UPDATE sessions SET expires_at = ? WHERE id = ?', new Date(Date.now() + config.sessionDays * 86400000).toISOString(), sid));
  }
  const { sid: _s, expires_at: _e, ...user } = row;
  return { user, sid };
}

// Limite simples por IP para tentativas de entrada e recuperação de código.
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) { buckets.set(key, { n: 1, reset: t + windowMs }); return; }
  b.n++;
  if (b.n > max) {
    const min = Math.ceil((b.reset - t) / 60000);
    throw tooMany(`Demasiadas tentativas. Espera ${min} minuto${min === 1 ? '' : 's'} e tenta de novo.`);
  }
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k); }, 600000).unref();

export const resetCode = () => String(randomInt(0, 1000000)).padStart(6, '0');
export const hashCode = (c) => sha('reset:' + c);

// Forma pública de um utilizador (nunca inclui o código nem dados internos).
export function publicUser(u, { full = false } = {}) {
  if (!u) return null;
  const base = {
    id: u.id,
    name: u.name,
    role: u.role,
    roleLabel: roleLabel(u.role),
    status: u.status,
    region: u.region,
    assoc: u.assoc,
    photoUrl: u.photo ? `/api/photos/${u.photo}` : null,
  };
  if (!full) return base;
  return {
    ...base,
    email: u.email,
    phone: u.phone,
    licence: u.licence,
    addr: u.addr,
    postal: u.postal,
    tel: u.tel,
    birth: u.birth,
    extra: fromJson(u.extra, {}),
    notif: { conf: !!u.notif_conf, msg: !!u.notif_msg },
    consentAt: u.consent_at,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
    locked: !!(u.lock_until && u.lock_until > now()),
  };
}

export const appRoles = () => APP.roles.map((r) => r.key);
