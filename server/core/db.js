// Base de dados SQL. Usa o SQLite que vem incluído no Node (node:sqlite): sem instalações extra,
// e a cópia de segurança é copiar um ficheiro. Para 200–2000 utilizadores chega perfeitamente.
// O resto do código só usa db.get/all/run/tx, por isso trocar para PostgreSQL ou MariaDB
// mais tarde é mexer só neste ficheiro.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const clean = (params) => params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
const plain = (row) => (row ? { ...row } : row);

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = raw.prepare(sql); cache.set(sql, s); }
    return s;
  };
  let depth = 0;
  const db = {
    raw,
    get: (sql, ...p) => plain(stmt(sql).get(...clean(p))),
    all: (sql, ...p) => stmt(sql).all(...clean(p)).map(plain),
    run: (sql, ...p) => {
      const r = stmt(sql).run(...clean(p));
      return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
    },
    exec: (sql) => raw.exec(sql),
    // Transação: tudo ou nada.
    tx(fn) {
      if (depth > 0) return fn();
      depth++;
      raw.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close: () => raw.close(),
  };
  return db;
}

// Aplica, por ordem, os ficheiros .sql de server/migrations que ainda não foram aplicados.
export function migrate(db, dir = MIGRATIONS_DIR) {
  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set(db.all('SELECT name FROM _migrations').map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    db.tx(() => {
      db.exec(sql);
      db.run('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', f, new Date().toISOString());
    });
    applied.push(f);
  }
  return applied;
}

export const now = () => new Date().toISOString();
export const toJson = (v) => JSON.stringify(v ?? null);
export const fromJson = (s, d = null) => { try { return s == null ? d : JSON.parse(s); } catch { return d; } };
