// Envio de emails. Com BREVO_API_KEY definido envia de verdade (API do Brevo);
// sem chave, regista o email como "simulado" (útil em testes e no computador).
import { now, toJson, fromJson } from './db.js';
import { config } from '../config.js';
import { APP } from '../app.js';

export const signature = () =>
  `\n\n—\n${APP.name} · ${APP.org}\n${config.publicUrl}\nPlataforma desenvolvida por ${APP.owner} · www.lpjsports.pt`;

export function createMailer(db, { fetchImpl = globalThis.fetch } = {}) {
  async function deliver(id) {
    const row = (await db.get('SELECT * FROM emails WHERE id = ?', id));
    if (!row || row.status !== 'pendente') return;
    if (!config.mail.brevoKey || !config.mail.from) {
      (await db.run("UPDATE emails SET status = 'simulado', sent_at = ? WHERE id = ?", now(), id));
      if (!config.production && process.env.LOG_EMAILS !== '0') {
        console.log(`[email simulado] para ${fromJson(row.to_json, []).map((t) => t.email).join(', ')} · ${row.subject}`);
      }
      return;
    }
    try {
      const res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.mail.brevoKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: config.mail.fromName, email: config.mail.from },
          to: fromJson(row.to_json, []),
          ...(fromJson(row.cc_json, []).length ? { cc: fromJson(row.cc_json, []) } : {}),
          ...(config.mail.replyTo ? { replyTo: { email: config.mail.replyTo } } : {}),
          subject: row.subject,
          textContent: row.body,
        }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
      (await db.run("UPDATE emails SET status = 'enviado', sent_at = ?, error = NULL WHERE id = ?", now(), id));
    } catch (e) {
      (await db.run("UPDATE emails SET status = 'erro', error = ? WHERE id = ?", String(e.message || e).slice(0, 500), id));
      console.error('[email] erro ao enviar', id, e.message);
    }
  }

  return {
    // to: [{ email, name }]. Cada destinatário recebe o seu email (os endereços não ficam à vista dos outros).
    async queue({ type, to, cc = [], subject, body }) {
      const ids = [];
      for (const r of to) {
        if (!r?.email) continue;
        const { id } = (await db.run(
          'INSERT INTO emails (type, to_json, cc_json, subject, body, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          type, toJson([{ email: r.email, name: r.name || '' }]), toJson(cc), subject, body + signature(), now()));
        ids.push(id);
      }
      for (const id of ids) await deliver(id);
      return ids;
    },
    deliver,
    // Volta a tentar os emails que falharam (pode ser chamado de hora a hora).
    async retryFailed() {
      const rows = (await db.all("SELECT id FROM emails WHERE status = 'erro' AND created_at > ?", new Date(Date.now() - 86400000).toISOString()));
      for (const r of rows) { (await db.run("UPDATE emails SET status = 'pendente' WHERE id = ?", r.id)); await deliver(r.id); }
      return rows.length;
    },
  };
}
