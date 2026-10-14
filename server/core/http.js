// Utilitários HTTP: erros, leitura de JSON, cookies, cabeçalhos de segurança e ficheiros estáticos.
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const badRequest = (m) => new HttpError(400, m);
export const unauthorized = (m = 'A tua sessão terminou. Entra de novo.') => new HttpError(401, m);
export const forbidden = (m = 'Não tens permissão para fazer isto.') => new HttpError(403, m);
export const notFound = (m = 'Não encontrado.') => new HttpError(404, m);
export const conflict = (m) => new HttpError(409, m);
export const tooMany = (m) => new HttpError(429, m);

export function parseCookies(req) {
  const out = {};
  const h = req.headers.cookie;
  if (!h) return out;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function cookieHeader(name, value, { maxAge, secure, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  return c;
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'O pedido é demasiado grande.'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req, limit = 1024 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    const v = JSON.parse(buf.toString('utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    throw badRequest('Pedido inválido.');
  }
}

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data ?? null);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...SECURITY_HEADERS,
    ...headers,
  });
  res.end(body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip', '.woff2': 'font/woff2',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const mimeOf = (file) => MIME[extname(file).toLowerCase()] || 'application/octet-stream';

// Envia um ficheiro do disco. `download` força a transferência com o nome indicado.
export function sendFile(req, res, file, { download, cache = 'no-store' } = {}) {
  let st;
  try { st = statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  const headers = {
    'Content-Type': mimeOf(file),
    'Content-Length': st.size,
    'Cache-Control': cache,
    ...SECURITY_HEADERS,
  };
  if (download) {
    const ascii = download.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    headers['Content-Disposition'] = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(download)}`;
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end(), true;
  createReadStream(file).pipe(res);
  return true;
}

// Ficheiros da app (pasta public/) com regresso ao index.html para as rotas da app.
export function serveStatic(req, res, dir) {
  const url = new URL(req.url, 'http://x');
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { p = '/'; }
  const file = normalize(join(dir, p));
  if (!file.startsWith(dir + sep) && file !== dir) return false;
  const isAsset = p.startsWith('/assets/');
  if (p !== '/' && sendFile(req, res, file, { cache: isAsset ? 'public, max-age=31536000, immutable' : 'no-cache' })) return true;
  if (isAsset) return false;
  return sendFile(req, res, join(dir, 'index.html'), { cache: 'no-cache' });
}
