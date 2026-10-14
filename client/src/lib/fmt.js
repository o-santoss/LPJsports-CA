// Formatação em português de Portugal.
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const first = (n) => String(n || '').split(' ')[0];
export const initials = (n) => String(n || '?').split(' ').filter(Boolean).map((s) => s[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const pd = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const fdate = (s) => { if (!s) return ''; const d = pd(s); return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}`; };

export function ago(iso) {
  const t = new Date(iso);
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ontem';
  return `${t.getDate()} ${MO[t.getMonth()]}${t.getFullYear() !== new Date().getFullYear() ? ' ' + t.getFullYear() : ''}`;
}
export function fullTime(iso) {
  const t = new Date(iso);
  return `${WD[t.getDay()]}, ${t.getDate()} ${MO[t.getMonth()]} ${t.getFullYear()}, ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
export const fsize = (b) => (b == null ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1048576).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} MB`);
