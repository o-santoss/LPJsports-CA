import { readFileSync } from 'node:fs';
import { config } from '../server/config.js';
import { openDb } from '../server/core/db.js';
const db=openDb(config.databaseUrl);
try {await db.exec(readFileSync(new URL('../server/migrations/002_arbitration.postgres.sql',import.meta.url),'utf8'));console.log('Módulo de arbitragem instalado. Dados existentes preservados.');}finally{await db.close();}
