// Test double only: exercises async route behavior without touching Supabase.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function testDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec(readFileSync(new URL('../server/migrations/001_core.sql', import.meta.url), 'utf8'));
  return {
    async get(sql, ...args) { return raw.prepare(sql).get(...args); },
    async all(sql, ...args) { return raw.prepare(sql).all(...args); },
    async run(sql, ...args) { const r = raw.prepare(sql).run(...args.map(v => v === undefined ? null : v)); return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    async tx(fn) { raw.exec('BEGIN'); try { const result = await fn(); raw.exec('COMMIT'); return result; } catch(e) { raw.exec('ROLLBACK'); throw e; } },
    async exec() {},
    async close() { raw.close(); },
  };
}
