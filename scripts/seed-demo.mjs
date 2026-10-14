// Dados de demonstração (contas de exemplo, documentos e mensagens) para testar a app.
// Uso: npm run seed:demo   (só corre numa base de dados vazia)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../server/config.js';
import { openDb, now, toJson } from '../server/core/db.js';
import { hashPin } from '../server/core/auth.js';
import { saveFile } from '../server/core/files.js';

const db = openDb(config.databaseUrl);

try {
await db.tx(async () => {
  await db.exec("SELECT pg_advisory_xact_lock(hashtext('lpj-demo-seed'))");
  if (await db.get('SELECT id FROM users LIMIT 1')) {
    console.log('A base de dados já tem utilizadores. Nada foi alterado.');
    return;
  }
const t = now();
const add = async (name, email, phone, role, status, pin, region, assoc, extra = {}) => (await db.run(
  `INSERT INTO users (name, email, phone, role, status, pin_hash, region, assoc, licence, extra, consent_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  name, email, phone, role, status, hashPin(pin), region, assoc, `FPT-${Math.floor(10000 + Math.random() * 89999)}`, toJson(extra), t, t, t)).id;

const L = 'Associação de Ténis de Lisboa', P = 'Associação de Ténis do Porto', M = 'Associação de Ténis da Madeira', C = 'Associação de Ténis de Coimbra';
const ca = (await add('Teresa Antunes', 'teresa.antunes@exemplo.pt', '962 141 457', 'ca', 'ativo', '3690', 'Lisboa', L));
const ja = (await add('Miguel Santos', 'miguel.santos@exemplo.pt', '913 220 114', 'ja', 'ativo', '1470', 'Lisboa', L));
const ana = (await add('Ana Rodrigues', 'ana.rodrigues@exemplo.pt', '991 925 140', 'arb', 'ativo', '2580'.replace('2580', '2468'), 'Lisboa', L));
const others = await Promise.all([
  ['Marco Lopes', 'Norte', P], ['Vera Correia', 'Centro', C], ['Daniel Sousa', 'Lisboa', L], ['Joana Matos', 'Madeira', M],
  ['Nélson Duarte', 'Norte', P], ['Tomás Vieira', 'Lisboa', L],
].map(async ([n, r, a], i) => (await add(n, n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@exemplo.pt', `91${i} 000 00${i}`, 'arb', 'ativo', '5' + String(100 + i), r, a))));
(await add('Rafael Gouveia', 'rafael.gouveia@exemplo.pt', '936 552 018', 'arb', 'pendente', '4826', 'Madeira', M));

// documentos (os PDFs do protótipo, se estiverem disponíveis)
const docsDir = process.env.DEMO_DOCS || '../docs';
const docs = [
  ['Regulamento Geral de Provas 2026', 'Regulamentos', 'Regulamento Geral de Provas da FPT. Entra em vigor a 1 de janeiro de 2026.', '2025-11-20', 'regulamento-geral-de-provas-2026.pdf'],
  ['Regras de Ténis 2025', 'Regras', 'As Regras de Ténis em português, edição de 2025.', '2025-03-08', 'regras-de-tenis-2025.pdf'],
  ['Tabela de Remunerações 2025', 'Remunerações', 'Valores por função e por nível nas provas nacionais e internacionais de 2025.', '2025-02-07', 'tabela-remuneracoes-2025.pdf'],
];
for (const [title, cat, descr, ver, file] of docs) {
  const p = join(docsDir, file);
  if (!existsSync(p)) continue;
  const buf = readFileSync(p);
  const name = (await saveFile('docs', buf, 'pdf'));
  (await db.run(`INSERT INTO documents (title, cat, descr, ver, kind, file, fname, ext, size, aud, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'file', ?, ?, 'PDF', ?, 'all', ?, ?, ?)`, title, cat, descr, ver, name, `${title}.pdf`, buf.length, ca, t, t));
}
(await db.run(`INSERT INTO documents (title, cat, descr, kind, url, ext, aud, created_by, created_at, updated_at)
  VALUES ('ITF World Tennis Tour Regulations 2026', 'Regulamentos', 'Regulamentos oficiais do ITF World Tennis Tour (site da ITF).', 'link', 'https://www.itftennis.com/media/15546/2026-wtt-regulations.pdf', 'LINK', 'ja', ?, ?, ?)`, ca, t, t));

// mensagens
const msg = async (from, to, subject, body, kind = 'mensagem') => {
  const id = (await db.run('INSERT INTO messages (from_id, kind, subject, body, created_at) VALUES (?, ?, ?, ?, ?)', from, kind, subject, body, t)).id;
  for (const u of to) await db.run('INSERT INTO message_to (message_id, user_id) VALUES (?, ?)', id, u);
};
(await msg(ca, [ja, ana, ...others], 'Bem-vindos à nova plataforma', 'Olá a todos,\n\nA partir de agora as disponibilidades, as nomeações e os documentos ficam todos aqui.\nQualquer dúvida, respondam a esta mensagem.\n\nTeresa Antunes\nConselho de Arbitragem'));
(await msg(null, [ca], 'Novo registo por aprovar: Rafael Gouveia', 'Rafael Gouveia criou conta e aguarda aprovação.', 'registo'));

console.log('Dados de demonstração criados.');
console.log('  CA:      teresa.antunes@exemplo.pt · 3690');
console.log('  JA:      miguel.santos@exemplo.pt · 1470');
console.log('  Árbitro: ana.rodrigues@exemplo.pt · 2468');
console.log('  Por aprovar: rafael.gouveia@exemplo.pt · 4826');

});
} finally { await db.close(); }
