// Notificações na app (caixa de mensagens) e, conforme as preferências de cada pessoa, por email.
import { now } from './db.js';
import { adminRole } from '../app.js';

// Quando é que cada tipo de aviso segue também por email:
// 'always' sempre · 'conf' se a pessoa tiver ligado "alterações" · 'msg' se tiver ligado "mensagens" · 'none' só na app
export const EMAIL_PREF = {
  aprovacao: 'always',
  rejeicao: 'always',
  acesso: 'always',
  registo: 'msg',
  mensagem: 'msg',
  documento: 'conf',
  alteracao: 'conf',
};

export function createNotifier(db, mailer) {
  const wants = (u, kind) => {
    const p = EMAIL_PREF[kind] ?? 'conf';
    if (p === 'always') return true;
    if (p === 'none') return false;
    return p === 'msg' ? !!u.notif_msg : !!u.notif_conf;
  };

  async function send({ from = null, to, kind = 'mensagem', subject, body, link = null, email = true, emailBody }) {
    const ids = [...new Set((to || []).map(Number).filter(Boolean))];
    if (!ids.length) return null;
    let mail;
    const id = await db.tx(async () => {
      const { id } = (await db.run('INSERT INTO messages (from_id, kind, subject, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        from, kind, subject, body, link, now()));
      for (const uid of ids) (await db.run('INSERT INTO message_to (message_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING', id, uid));
      if (email) {
        const qs = ids.map(() => '?').join(',');
        const users = (await db.all(`SELECT id, name, email, notif_conf, notif_msg, status FROM users WHERE id IN (${qs})`, ...ids));
        const rcpt = users.filter((u) => u.status !== 'recusado' && wants(u, kind)).map((u) => ({ email: u.email, name: u.name }));
        if (rcpt.length) {
          const sender = from ? (await db.get('SELECT name FROM users WHERE id = ?', from)) : null;
          const text = emailBody || (sender ? `Mensagem de ${sender.name}:\n\n${body}` : body);
          mail = { type: kind, to: rcpt, subject, body: text };
        }
      }
      return id;
    });
    if (mail) await mailer.queue(mail);
    return id;
  }

  const admins = async () => (await db.all("SELECT id FROM users WHERE role = ? AND status = 'ativo'", adminRole())).map((r) => r.id);

  return { send, admins, wants };
}
