// Configuração lida das variáveis de ambiente (ver .env.example).
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

// Carrega um ficheiro .env simples, se existir (sem dependências externas).
const envFile = resolve(process.env.ENV_FILE || '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = process.env;

export const config = {
  databaseUrl: env.DATABASE_URL || '',
  supabaseUrl: (env.SUPABASE_URL || '').replace(/\/$/, ''),
  storageKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
  storageBuckets: { photos: env.SUPABASE_PHOTOS_BUCKET || 'photos', docs: env.SUPABASE_DOCUMENTS_BUCKET || 'documents' },
  port: Number(env.PORT) || 3000,
  host: env.HOST || '0.0.0.0',
  dataDir: resolve(env.DATA_DIR || './data'),
  publicDir: resolve(env.PUBLIC_DIR || './public'),
  production: env.NODE_ENV === 'production',
  publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  // Atrás de um proxy (Render, Railway, Nginx…) o IP real vem em X-Forwarded-For.
  trustProxy: env.TRUST_PROXY === '1' || env.VERCEL === '1',
  sessionDays: Number(env.SESSION_DAYS) || 30,
  mail: {
    brevoKey: env.BREVO_API_KEY || '',
    from: env.MAIL_FROM || '',
    fromName: env.MAIL_FROM_NAME || 'C.Arbitragem',
    replyTo: env.MAIL_REPLY_TO || '',
  },
  // Primeira conta de administrador, criada no primeiro arranque se a base estiver vazia.
  admin: {
    name: env.ADMIN_NAME || '',
    email: env.ADMIN_EMAIL || '',
    pin: env.ADMIN_PIN || '',
  },
};
