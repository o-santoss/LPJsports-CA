import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { badRequest, notFound, mimeOf, SECURITY_HEADERS } from './http.js';

function objectUrl(kind, name, action = 'object') {
  const bucket = config.storageBuckets[kind];
  if (!bucket || !config.supabaseUrl || !config.storageKey) throw new Error('Supabase Storage configuration is required');
  if (!/^[a-f0-9]{24}\.[a-z0-9]+$/.test(name)) throw badRequest('Nome de ficheiro inválido.');
  return `${config.supabaseUrl}/storage/v1/${action}/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`;
}
const headers = () => ({ apikey: config.storageKey, Authorization: `Bearer ${config.storageKey}` });
async function checked(response) {
  if (response.status === 404) throw notFound('Ficheiro não encontrado.');
  if (!response.ok) throw new Error(`Storage request failed (${response.status})`);
  return response;
}
export async function saveFile(kind, buf, ext) {
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  await checked(await fetch(objectUrl(kind, name), { method: 'POST', headers: { ...headers(), 'Content-Type': mimeOf(name), 'x-upsert': 'false' }, body: buf }));
  return name;
}
export async function removeFile(kind, name) {
  if (!name) return;
  const response = await fetch(objectUrl(kind, name), { method: 'DELETE', headers: headers() });
  if (response.status !== 404) await checked(response);
}
export async function sendStoredFile(req, res, kind, name, { download } = {}) {
  if (kind === 'docs') {
    const response = await checked(await fetch(objectUrl(kind, name, 'object/sign'), { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }) }));
    const data = await response.json();
    const url = new URL(`${config.supabaseUrl}/storage/v1${data.signedURL}`);
    if (download) url.searchParams.set('download', download);
    res.writeHead(302, { ...SECURITY_HEADERS, Location: url.href, 'Cache-Control': 'no-store' });
    res.end();
  } else {
    const response = await checked(await fetch(objectUrl(kind, name), { headers: headers() }));
    const buf = Buffer.from(await response.arrayBuffer());
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': mimeOf(name), 'Cache-Control': 'private, max-age=86400', 'Content-Length': buf.length });
    res.end(req.method === 'HEAD' ? undefined : buf);
  }
  return true;
}

// Recebe "data:<mime>;base64,<dados>" (ou só base64) e devolve o Buffer.
export function decodeDataUrl(data, maxBytes) {
  const m = String(data || '').match(/^data:([^;,]*)(;base64)?,(.*)$/s);
  const b64 = m ? m[3] : String(data || '');
  if (!b64) throw badRequest('Ficheiro vazio.');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw badRequest('Ficheiro vazio.');
  if (buf.length > maxBytes) throw badRequest(`O ficheiro tem mais de ${Math.round(maxBytes / 1048576)} MB.`);
  return { buf, mime: m ? m[1] : '' };
}

// Confirma pelos primeiros bytes que é mesmo uma imagem JPEG/PNG/WebP.
export function imageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

// A signed receipt binds a newly uploaded document to this administrator.
// Only the per-object upload URL leaves the server; the service key stays here.
export async function signDocumentUpload(userId, ext, size) {
  if (!Number.isInteger(size) || size < 1 || size > 15 * 1048576) throw badRequest('Escolhe um ficheiro até 15 MB.');
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  const response = await checked(await fetch(objectUrl('docs', name, 'object/upload/sign'), { method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: '{}' }));
  const data = await response.json();
  const payload = Buffer.from(JSON.stringify({ userId, name, size, exp: Date.now() + 15 * 60000 })).toString('base64url');
  const signature = createHmac('sha256', config.storageKey).update(payload).digest('base64url');
  return { uploadUrl: `${config.supabaseUrl}/storage/v1${data.url}`, receipt: `${payload}.${signature}` };
}
export async function verifyDocumentUpload(receipt, userId) {
  const [payload, signature = ''] = String(receipt || '').split('.');
  const expected = createHmac('sha256', config.storageKey).update(payload || '').digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw badRequest('Upload inválido.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw badRequest('Upload inválido.'); }
  if (data.userId !== userId || data.exp < Date.now()) throw badRequest('Upload expirado. Envia o ficheiro novamente.');
  const response = await checked(await fetch(objectUrl('docs', data.name), { method: 'HEAD', headers: headers() }));
  if (Number(response.headers.get('content-length')) !== data.size) throw badRequest('O tamanho do ficheiro não corresponde ao upload.');
  return { name: data.name, size: data.size };
}
