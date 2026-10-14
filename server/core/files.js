// Ficheiros enviados pelos utilizadores (documentos e fotos), guardados em DATA_DIR/uploads.
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { badRequest } from './http.js';

export const uploadDir = (kind) => {
  const d = join(config.dataDir, 'uploads', kind);
  mkdirSync(d, { recursive: true });
  return d;
};

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

export function saveFile(kind, buf, ext) {
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  writeFileSync(join(uploadDir(kind), name), buf);
  return name;
}

export function removeFile(kind, name) {
  if (!name) return;
  const f = join(uploadDir(kind), basename(name));
  try { if (existsSync(f)) unlinkSync(f); } catch {}
}

export const filePath = (kind, name) => join(uploadDir(kind), basename(String(name || '')));

// Confirma pelos primeiros bytes que é mesmo uma imagem JPEG/PNG/WebP.
export function imageType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
