// Servidor da base LPJ Sports: API (/api/...) + ficheiros da app React (pasta public/).
import http from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { APP, hasRole, adminRole } from './app.js';
import { openDb, now } from './core/db.js';
import { createRouter } from './core/router.js';
import { HttpError, readJson, sendJson, serveStatic, unauthorized, forbidden, SECURITY_HEADERS } from './core/http.js';
import { loadSession, clientIp, hashPin } from './core/auth.js';
import { createMailer } from './core/mail.js';
import { createNotifier } from './core/notify.js';
import { registerArbitrationRoutes } from './modules/arbitration/routes.js';
import { registerCoreRoutes, HANDLED } from './modules/core/routes.js';

export async function createApp({ databaseUrl = config.databaseUrl, db: providedDb, fetchImpl } = {}) {
  const db = providedDb || openDb(databaseUrl);
  const mailer = createMailer(db, { fetchImpl });
  const notify = createNotifier(db, mailer);
  const audit = async (userId, action, target = null, details = null, ip = null) =>
    (await db.run('INSERT INTO audit (user_id, action, target, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)', userId, action, target, details, ip, now()));

  try { await ensureFirstAdmin(db); } catch (error) { await db.close(); throw error; }

  const router = createRouter();
  const ctx = { db, mailer, notify, audit };
  registerCoreRoutes(router, ctx);
  registerArbitrationRoutes(router, ctx);
  // Os módulos de cada app (ex.: arbitragem) registam aqui as suas rotas.
  for (const m of APP.modules) m.register?.(router, ctx);

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method) || !serveStatic(req, res, config.publicDir)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
        res.end('Não encontrado');
      }
      return;
    }
    const cookies = [];
    try {
      const found = router.match(req.method, url.pathname);
      if (!found) throw new HttpError(404, 'Pedido desconhecido.');
      if (found.notAllowed) throw new HttpError(405, 'Método não permitido.');
      const { route, params } = found;
      // Proteção contra pedidos vindos de outros sites: os pedidos que alteram dados têm de trazer este cabeçalho.
      if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-lpj'] !== '1') throw forbidden('Pedido recusado.');
      const session = (await loadSession(db, req));
      if (route.access !== 'public') {
        if (!session) throw unauthorized();
        if (route.access !== 'user' && !hasRole(session.user, route.access)) throw forbidden();
      }
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readJson(req, route.limit || 1024 * 1024) : {};
      const c = {
        req, res, params, body, query: url.searchParams, ip: clientIp(req),
        user: session?.user || null, sid: session?.sid || null,
        setCookie: (ck) => cookies.push(ck),
      };
      const out = await route.handler(c);
      if (out === HANDLED) return;
      sendJson(res, 200, out ?? { ok: true }, cookies.length ? { 'Set-Cookie': cookies } : {});
    } catch (e) {
      if (!(e instanceof HttpError)) console.error('[erro]', req.method, url.pathname, e.code || 'internal');
      const status = e instanceof HttpError ? e.status : 500;
      const message = e instanceof HttpError ? e.message : 'Ocorreu um erro inesperado. Tenta de novo.';
      if (!res.headersSent) sendJson(res, status, { error: message, ...(e.extra || {}) }, cookies.length ? { 'Set-Cookie': cookies } : {});
      else res.end();
    }
  }

  const server = http.createServer((req, res) => { handle(req, res); });
  server.on('close', async () => { void (await db.close()); });
  return { server, handle, db, mailer, notify };
}

// Primeira conta de administrador a partir de ADMIN_NAME, ADMIN_EMAIL e ADMIN_PIN.
async function ensureFirstAdmin(db) {
  return db.tx(async () => {
    await db.exec("SELECT pg_advisory_xact_lock(hashtext('lpj-bootstrap'))");
  if ((await db.get('SELECT id FROM users LIMIT 1'))) return;
  const { name, email, pin } = config.admin;
  if (!name || !email || !/^\d{4}$/.test(pin)) {
    console.log('[arranque] Base de dados vazia. Define ADMIN_NAME, ADMIN_EMAIL e ADMIN_PIN (4 algarismos) para criar o primeiro administrador.');
    return;
  }
  const t = now();
  (await db.run(`INSERT INTO users (name, email, role, status, pin_hash, consent_at, created_at, updated_at) VALUES (?, ?, ?, 'ativo', ?, ?, ?, ?)`,
    name, email.toLowerCase(), adminRole(), hashPin(pin), t, t, t));
  console.log('[arranque] Administrador criado.');
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { server } = (await createApp());
  server.listen(config.port, config.host, () => {
    console.log(`${APP.name} a correr em ${config.publicUrl} (porta ${config.port})`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
