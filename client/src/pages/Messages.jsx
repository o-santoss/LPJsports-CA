import React, { useEffect, useMemo, useState } from 'react';
import { get, post } from '../lib/api.js';
import { ago, fullTime, norm } from '../lib/fmt.js';
import { useApp } from '../App.jsx';
import { useUI, Icon, Seg, Empty, Field, useBusy } from '../ui/kit.jsx';

export default function Messages() {
  const { refresh, roleIdx } = useApp();
  const ui = useUI();
  const [box, setBox] = useState('in');
  const [list, setList] = useState(null);
  const canCompose = roleIdx >= 1;
  const load = () => get(`/api/messages?box=${box}`).then((r) => setList(r.messages)).catch((e) => { ui.toast(e.message); setList([]); });
  useEffect(() => { setList(null); load(); }, [box]);

  const open = async (m) => {
    if (box === 'in' && !m.read) {
      await post(`/api/messages/${m.id}/read`).catch(() => {});
      setList((l) => l.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
      refresh();
    }
    ui.openModal(m.subject, (close) => (
      <>
        <p className="pmeta">{box === 'in' ? `De: ${m.from ? m.from.name : 'mensagem automática'}` : `Para: ${m.to.map((t) => t.name).join(', ')}`} · {fullTime(m.at)}</p>
        <div className="msgbody">{m.body}</div>
        {box === 'out' && <p className="pmeta">Lida por {m.to.filter((t) => t.read).length} de {m.to.length}.</p>}
        {box === 'in' && m.from && (
          <div className="row end"><button className="btn" onClick={() => { close(); compose({ replyTo: m }); }}><Icon name="reply" /> Responder</button></div>
        )}
      </>
    ));
  };

  const compose = (pre = {}) => ui.openModal(pre.replyTo ? 'Responder' : 'Nova mensagem', (close) => <Compose pre={pre} close={close} onSent={() => { if (box === 'out') load(); }} />);
  const unread = list?.filter((m) => !m.read).length || 0;

  return (
    <>
      <header className="ph row between">
        <div><h1>Notificações</h1><p className="sub">Avisos automáticos e mensagens</p></div>
        {canCompose && <button className="btn" onClick={() => compose()}><Icon name="send" /> Nova mensagem</button>}
      </header>
      <Seg items={[['in', 'Recebidas'], ['out', 'Enviadas']]} value={box} onChange={setBox} />
      {box === 'in' && unread > 0 && (
        <div className="row end toolbar"><button className="link" onClick={async () => { await post('/api/messages/read-all'); load(); refresh(); }}>Marcar todas como lidas</button></div>
      )}
      {!list ? <p className="pmeta">A carregar…</p> : list.length ? (
        <div className="plist">
          {list.map((m) => (
            <button key={m.id} className="prow click mrow" onClick={() => open(m)} style={{ textAlign: 'left', width: '100%', border: 0, borderTop: '1px solid var(--line)', background: 'none', font: 'inherit', color: 'inherit' }}>
              <Icon name={m.kind === 'mensagem' ? 'mail' : 'bell'} />
              <div className="pmain">
                <span className="pname" style={{ fontWeight: box === 'in' && !m.read ? 700 : 500 }}>{m.subject}</span>
                <span className="pmeta">{box === 'in' ? (m.from ? m.from.name : 'Automática') : `Para ${m.to.length === 1 ? m.to[0].name : `${m.to.length} pessoas`}`} · {ago(m.at)}</span>
              </div>
              {box === 'in' && !m.read && <span className="dot" aria-label="por ler" />}
            </button>
          ))}
        </div>
      ) : <Empty>{box === 'in' ? 'Ainda não recebeste notificações.' : 'Ainda não enviaste mensagens.'}</Empty>}
    </>
  );
}

function Compose({ pre, close, onSent }) {
  const ui = useUI();
  const [rc, setRc] = useState(null);
  const [to, setTo] = useState([]);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState(pre.replyTo ? `Re: ${pre.replyTo.subject.replace(/^Re: /, '')}` : '');
  const [body, setBody] = useState('');
  const [busy, run] = useBusy();
  useEffect(() => { if (!pre.replyTo) get('/api/recipients').then(setRc).catch((e) => ui.toast(e.message)); }, []);
  const people = useMemo(() => (rc?.users || []).filter((u) => !q || norm(u.name).includes(norm(q))).slice(0, 40), [rc, q]);
  const toggle = (k) => setTo((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));
  const send = () => run(async () => {
    try {
      const r = await post('/api/messages', pre.replyTo ? { replyTo: pre.replyTo.id, subject, body } : { to, subject, body });
      ui.toast(`Mensagem enviada a ${r.n} pessoa${r.n === 1 ? '' : 's'}.`);
      close();
      onSent?.();
    } catch (e) { ui.toast(e.message); }
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}>
      {pre.replyTo ? <p className="meta">Para: <b>{pre.replyTo.from.name}</b></p> : (
        <fieldset className="fs">
          <legend className="lbl">Para</legend>
          {!rc ? <p className="pmeta">A carregar…</p> : (
            <>
              <div className="row">{rc.groups.filter((g) => g.n).map((g) => (
                <label key={g.key} className="ck sm"><input type="checkbox" checked={to.includes(g.key)} onChange={() => toggle(g.key)} /> {g.label} ({g.n})</label>
              ))}</div>
              <input className="inp mt" type="search" placeholder="Procurar pessoa" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar pessoa" />
              <div className="row mt">{people.map((u) => (
                <label key={u.id} className="ck sm"><input type="checkbox" checked={to.includes(String(u.id))} onChange={() => toggle(String(u.id))} /> {u.name}</label>
              ))}</div>
            </>
          )}
        </fieldset>
      )}
      <Field label="Assunto" id="cm-s"><input className="inp" id="cm-s" value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
      <Field label="Mensagem" id="cm-b"><textarea className="inp" id="cm-b" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required /></Field>
      <p className="hint">A mensagem fica nas notificações da app e segue também por email para quem tem esse aviso ligado.</p>
      <div className="row end"><button type="button" className="btn ghost" onClick={close}>Cancelar</button><button className="btn" disabled={busy}><Icon name="send" /> Enviar</button></div>
    </form>
  );
}
