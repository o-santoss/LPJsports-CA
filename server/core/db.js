import postgres from 'postgres';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

export function openDb(url = process.env.DATABASE_URL, { schema } = {}) {
  if (!url) throw new Error('DATABASE_URL is required');
  const caPath=process.env.DATABASE_CA_CERT_PATH||resolve('supabase-ca.crt');
  const ca=process.env.DATABASE_CA_CERT?.replace(/\\n/g,'\n')||(existsSync(caPath)?readFileSync(caPath,'utf8'):undefined);
  const ssl=process.env.DATABASE_SSL==='disable'?false:ca?{rejectUnauthorized:true,ca}:'verify-full';
  const sql = postgres(url, {
    connection: schema ? { search_path: schema } : {},
    prepare: false, max: 1, idle_timeout: 20, connect_timeout: 15,
    ssl,
    types: { bigint: { to: 20, from: [20], serialize: String, parse: Number } },
    transform: { undefined: null },
  });
  const scope = new AsyncLocalStorage();
  const statement = text => { let n = 0; return text.replace(/\?/g, () => `$${++n}`); };
  const query = async (text, params) => {
    const rows = await (scope.getStore() || sql).unsafe(statement(text), params.map(v => v === undefined ? null : v));
    return rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
  };
  return {
    get: async (text, ...params) => (await query(text, params))[0],
    all: (text, ...params) => query(text, params),
    async run(text, ...params) {
      const identity = /^\s*INSERT INTO (users|messages|documents|emails|pin_resets|audit)\s/i.test(text);
      const rows = await (scope.getStore() || sql).unsafe(statement(identity ? text + ' RETURNING id' : text), params.map(v => v === undefined ? null : v));
      return { changes: rows.count, id: rows[0]?.id };
    },
    exec: text => (scope.getStore() || sql).unsafe(text),
    tx: fn => scope.getStore() ? fn() : sql.begin(tx => scope.run(tx, fn)),
    close: () => sql.end({ timeout: 5 }),
  };
}
export const now = () => new Date().toISOString();
export const toJson = v => JSON.stringify(v ?? null);
export const fromJson = (s, d = null) => { if (typeof s === 'object' && s !== null) return s; try { return s == null ? d : JSON.parse(s); } catch { return d; } };
