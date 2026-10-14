// Paletas de cores e modo claro/escuro (guardados no dispositivo da pessoa).
export const PALETTES = {
  azul: { name: 'Piso rápido', l: { bg: '#eef2f5', surface: '#ffffff', s2: '#e3e9ee', line: '#d3dce4', ink: '#12202c', ink2: '#556574', accent: '#1a5d8f', accentInk: '#ffffff', soft: '#dce9f4' }, d: { bg: '#0d151c', surface: '#141f29', s2: '#1b2834', line: '#273644', ink: '#e4ecf2', ink2: '#97a9b8', accent: '#6aaee3', accentInk: '#081521', soft: '#16324a' } },
  terra: { name: 'Terra batida', l: { bg: '#f3ece6', surface: '#fffaf6', s2: '#ebe0d6', line: '#dccdbf', ink: '#2a1c14', ink2: '#6f5a4b', accent: '#b0502a', accentInk: '#ffffff', soft: '#f3ddd1' }, d: { bg: '#18110c', surface: '#221812', s2: '#2d2019', line: '#3e2e23', ink: '#f1e6dc', ink2: '#bba493', accent: '#e58b5f', accentInk: '#1d0e06', soft: '#4a2a1b' } },
  relva: { name: 'Relva', l: { bg: '#edf3ee', surface: '#ffffff', s2: '#e0eae1', line: '#cddbcf', ink: '#13221a', ink2: '#4e6656', accent: '#2c6a3c', accentInk: '#ffffff', soft: '#d9eadc' }, d: { bg: '#0d1610', surface: '#132018', s2: '#1a2a20', line: '#263b2d', ink: '#e2eee5', ink2: '#97b09f', accent: '#76c18b', accentInk: '#06160b', soft: '#1a3a25' } },
  marinho: { name: 'Azul marinho', l: { bg: '#ecf0f8', surface: '#ffffff', s2: '#dfe5f2', line: '#ccd5e8', ink: '#121a33', ink2: '#525d7d', accent: '#2b3f94', accentInk: '#ffffff', soft: '#dde3f6' }, d: { bg: '#0d1020', surface: '#141a2e', s2: '#1c233b', line: '#2a3252', ink: '#e4e8f6', ink2: '#9ba4c6', accent: '#93a5f2', accentInk: '#0a0f2d', soft: '#1f2852' } },
  vinho: { name: 'Vinho', l: { bg: '#f5eef0', surface: '#ffffff', s2: '#ece0e4', line: '#decdd3', ink: '#2a1219', ink2: '#6d5059', accent: '#8c2341', accentInk: '#ffffff', soft: '#f2dbe2' }, d: { bg: '#170c10', surface: '#21131a', s2: '#2c1a22', line: '#3f2630', ink: '#f4e4ea', ink2: '#bc9ca8', accent: '#ec8aa7', accentInk: '#250913', soft: '#4a1e2d' } },
  grafite: { name: 'Grafite', l: { bg: '#f1f1f2', surface: '#ffffff', s2: '#e5e5e7', line: '#d5d5d9', ink: '#18181b', ink2: '#5c5c66', accent: '#3a3a42', accentInk: '#ffffff', soft: '#e3e3e6' }, d: { bg: '#111113', surface: '#1a1a1d', s2: '#232327', line: '#303036', ink: '#ececee', ink2: '#a1a1aa', accent: '#d6d6db', accentInk: '#18181b', soft: '#2e2e33' } },
};
const SEM = {
  l: { '--ok': '#1b7a4b', '--ok-soft': '#dcefe4', '--ok-ink': '#ffffff', '--warn': '#94600b', '--warn-soft': '#f6e9d0', '--bad': '#ad3329', '--bad-soft': '#f5e0dc', '--bad-ink': '#ffffff', '--scrim': 'rgba(12,20,28,.48)', '--lpj-blue': '#4543ee', '--lpj-g1': '#5d6067', '--lpj-g2': '#2e3136', '--lpj-ink': '#111418', '--shadow': '0 1px 2px rgba(18,32,44,.06),0 6px 20px rgba(18,32,44,.07)' },
  d: { '--ok': '#5bc48f', '--ok-soft': '#173527', '--ok-ink': '#06170e', '--warn': '#e5ad48', '--warn-soft': '#3a2b10', '--bad': '#f07f74', '--bad-soft': '#3d1c19', '--bad-ink': '#1e0806', '--scrim': 'rgba(0,0,0,.6)', '--lpj-blue': '#5a58f4', '--lpj-g1': '#a3a3a3', '--lpj-g2': '#6a6a6a', '--lpj-ink': '#f2f2f2', '--shadow': '0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.35)' },
};
const TOK = { bg: '--bg', surface: '--surface', s2: '--surface-2', line: '--line', ink: '--ink', ink2: '--ink-2', accent: '--accent', accentInk: '--accent-ink', soft: '--accent-soft' };
const KEY = 'lpj-look';

export function loadLook() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && PALETTES[s.pal]) return { pal: s.pal, mode: ['auto', 'light', 'dark'].includes(s.mode) ? s.mode : 'auto' };
  } catch {}
  return { pal: 'azul', mode: 'auto' };
}
export function saveLook(look) {
  try { localStorage.setItem(KEY, JSON.stringify(look)); } catch {}
  applyLook(look);
}
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };
export const isDark = (look) => (look.mode === 'auto' ? !!mq.matches : look.mode === 'dark');

export function applyLook(look) {
  const st = document.documentElement.style;
  const keys = [...Object.values(TOK), ...Object.keys(SEM.l)];
  if (look.pal === 'azul' && look.mode === 'auto') {
    keys.forEach((k) => st.removeProperty(k));
    st.removeProperty('color-scheme');
    return;
  }
  const dk = isDark(look);
  const P = PALETTES[look.pal][dk ? 'd' : 'l'];
  Object.entries(TOK).forEach(([k, v]) => st.setProperty(v, P[k]));
  Object.entries(SEM[dk ? 'd' : 'l']).forEach(([k, v]) => st.setProperty(k, v));
  st.setProperty('color-scheme', dk ? 'dark' : 'light');
}
export function watchSystemTheme(getLook) {
  try { mq.addEventListener('change', () => applyLook(getLook())); } catch {}
}
