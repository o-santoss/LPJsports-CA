import {loadState,persist} from '../server/modules/arbitration/routes.js';
import {execute} from '../server/modules/arbitration/engine.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { openDb } from '../server/core/db.js';

// Opt-in only. Uses an isolated schema; never reads or changes application tables.
test('Postgres: identities, transactions, rollback, conflict handling and timestamps', { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = process.env.TEST_DATABASE_URL;
  const admin = postgres(url, { prepare: false, max: 1, ssl: process.env.DATABASE_SSL === 'disable' ? false : 'verify-full' });
  const schema = 'lpj_test_' + randomBytes(8).toString('hex');
  let db;
  try {
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    db = openDb(url, { schema });
    await db.exec(readFileSync(new URL('../server/migrations/001_core.postgres.sql', import.meta.url), 'utf8'));
    const t = new Date().toISOString();
    const insert = () => db.run('INSERT INTO users (name, email, role, pin_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', 'Test User', 'test@example.test', 'ca', 'unused', t, t);
    await assert.rejects(db.tx(async () => { await insert(); throw new Error('rollback'); }), /rollback/);
    assert.equal((await db.get('SELECT COUNT(*) n FROM users')).n, 0);
    const { id } = await db.tx(insert);
    assert.equal(typeof id, 'number');
    const row = await db.get('SELECT * FROM users WHERE id = ?', id);
    assert.equal(row.created_at, t);
    const message = await db.run('INSERT INTO messages (kind, subject, body, created_at) VALUES (?, ?, ?, ?)', 'mensagem', 'test', 'test', t);
    for (let i = 0; i < 2; i++) await db.run('INSERT INTO message_to (message_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', message.id, id);
    assert.equal((await db.get('SELECT COUNT(*) n FROM message_to')).n, 1);
    await assert.rejects(db.tx(async () => { await db.run('UPDATE users SET name = ? WHERE id = ?', 'Changed', id); await db.tx(async () => { throw new Error('nested rollback'); }); }), /nested rollback/);
    assert.equal((await db.get('SELECT name FROM users WHERE id = ?', id)).name, 'Test User');
    await db.exec(readFileSync(new URL('../server/migrations/002_arbitration.postgres.sql',import.meta.url),'utf8'));
    const before=await loadState(db),after=structuredClone(before);
    execute(after,{id,name:'Test User',role:'ca'},'tour',{name:'Postgres Tournament',cat:'Torneio A',start:'2030-01-06',end:'2030-01-13',city:'Lisboa',region:'Lisboa',club:'CT Teste',needs:{},resp:[]});
    await db.tx(()=>persist(db,before,after));
    assert.equal((await loadState(db)).tours[0].name,'Postgres Tournament');

  } finally {
    if (db) await db.close();
    await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});
