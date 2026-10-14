// Validação dos dados que chegam dos formulários.
import { badRequest } from './http.js';

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const digits = (s) => String(s ?? '').replace(/\D/g, '');

export function str(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}
export function text(v, max = 5000) {
  return String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}
export const isEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e);
export const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

export function email(v) {
  const e = str(v, 160).toLowerCase();
  if (!isEmail(e)) throw badRequest('O email não parece válido.');
  return e;
}
export function phone(v, required = true) {
  const p = str(v, 30);
  if (!p && !required) return '';
  if (digits(p).length < 9) throw badRequest('O telemóvel tem de ter pelo menos 9 algarismos.');
  return p;
}
export function fullName(v) {
  const n = str(v, 120).replace(/\s+/g, ' ');
  if (n.split(' ').filter(Boolean).length < 2) throw badRequest('Escreve o nome completo (nome e apelido).');
  return n;
}
export function oneOf(v, list, { optional = false, label = 'valor' } = {}) {
  const s = str(v, 200);
  if (!s && optional) return '';
  if (!list.includes(s)) throw badRequest(`Escolhe um ${label} da lista.`);
  return s;
}
export function date(v, { optional = true } = {}) {
  const s = str(v, 10);
  if (!s && optional) return '';
  if (!isDate(s)) throw badRequest('Data inválida.');
  return s;
}
// Campos próprios de cada app: objeto pequeno com texto, números, booleanos ou listas de texto.
export function extraObj(v, maxBytes = 8192) {
  if (v == null) return {};
  if (typeof v !== 'object' || Array.isArray(v)) throw badRequest('Dados extra inválidos.');
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)) continue;
    if (typeof val === 'string') out[k] = str(val, 500);
    else if (typeof val === 'number' || typeof val === 'boolean' || val === null) out[k] = val;
    else if (Array.isArray(val)) out[k] = val.slice(0, 50).map((x) => (typeof x === 'object' && x ? extraObj(x, 2048) : str(x, 200)));
    else if (typeof val === 'object') out[k] = extraObj(val, 4096);
  }
  if (JSON.stringify(out).length > maxBytes) throw badRequest('Dados extra demasiado grandes.');
  return out;
}
