import React, { useEffect, useMemo, useState } from 'react';
import { get, post, put, del } from '../lib/api.js';
import { fdate, fullTime, ago, norm, plural } from '../lib/fmt.js';
import { useApp } from '../App.jsx';
import { useUI, Icon, Chip, Empty, Field, Seg, Avatar, PinInput, useBusy } from '../ui/kit.jsx';

const STATUS = { ativo: ['ok', 'Ativo'], pendente: ['warn', 'Por aprovar'], suspenso: ['bad', 'Suspenso'], recusado: ['bad', 'Recusado'] };
const EMAIL_ST = { enviado: ['ok', 'Enviado'], simulado: ['', 'Simulado (sem Brevo)'], pendente: ['warn', 'A enviar'], erro: ['bad', 'Erro'] };

export default function Users() {
  const { config, refresh, me } = useApp();
  const ui = useUI();
  const [seg, setSeg] = useState('pend');
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const load = () => get('/api/users').then((r) => setUsers(r.users)).catch((e) => { ui.toast(e.message); setUsers([]); });
  useEffect(() => { load(); }, []);
  const pend = (users || []).filter((u) => u.status === 'pendente');
  useEffect(() => { if (users && !pend.length && seg === 'pend') setSeg('all'); }, [users]);

  const approve = async (u) => {
    try { await post(`/api/users/${u.id}/approve`); ui.toast(`Conta de ${u.name} aprovada. Foi enviado um email.`); load(); refresh(); } catch (e) { ui.toast(e.message); }
  };
  const reject = (u) => ui.openModal('Recusar registo', (close) => <Reject u={u} close={close} onDone={() => { load(); refresh(); }} />);
  const edit = (u) => ui.openModal(u ? 'Editar utilizador' : 'Novo utilizador', (close) => <UserForm u={u} close={close} onSaved={load} self={u?.id === me.id} />);

  const list = useMemo(() => (users || []).filter((u) => (role === 'all' || u.role === role) && (!q || norm(`${u.name} ${u.email} ${u.phone} ${u.licence}`).includes(norm(q)))), [users, q, role]);

  return (
    <>
      <header className="ph row between">
        <div><p className="eyebrow">Administração</p><h1>Utilizadores</h1></div>
        <button className="btn" onClick={() => edit(null)}><Icon name="plus" /> Novo utilizador</button>
      </header>
      <Seg items={[['pend', `Por aprovar${pend.length ? ` (${pend.length})` : ''}`], ['all', 'Todos'], ['emails', 'Emails'], ['audit', 'Registo de ações']]} value={seg} onChange={setSeg} />
      {!users ? <p className="pmeta">A carregar…</p> : seg === 'pend' ? (
        <>
          <p className="hint">Pessoas que criaram conta. Só entram na app depois de aprovadas. Podes corrigir os dados antes de aprovar.</p>
          {pend.length ? <div className="plist">{pend.map((u) => (
            <div key={u.id} className="prow"><Avatar user={u} /><div className="pmain">
              <span className="pname">{u.name}</span>
              <span className="pmeta">{u.email} · {u.phone}{u.region ? ` · ${u.region}` : ''}</span>
              {u.assoc && <span className="pmeta">{u.assoc}</span>}
              <span className="pmeta">Registo {ago(u.createdAt)}</span>
              <div className="pact"><button className="btn sm okf" onClick={() => approve(u)}><Icon name="check" /> Aprovar</button><button className="btn sm ghost" onClick={() => edit(u)}>Ver e editar</button><button className="btn sm danger" onClick={() => reject(u)}>Recusar</button></div>
            </div></div>
          ))}</div> : <Empty>Não há registos por aprovar.</Empty>}
        </>
      ) : seg === 'all' ? (
        <>
          <div className="row toolbar">
            <input className="inp search" type="search" placeholder="Procurar por nome, email, telemóvel ou licença" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar utilizadores" />
            <select className="inp sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Perfil"><option value="all">Todos os perfis</option>{config.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select>
          </div>
          <p className="rescount">{plural(list.length, 'utilizador', 'utilizadores')}</p>
          {list.length ? <div className="plist">{list.map((u) => (
            <button key={u.id} className="prow click" onClick={() => edit(u)} style={{ textAlign: 'left', width: '100%', border: 0, borderTop: '1px solid var(--line)', background: 'none', font: 'inherit', color: 'inherit' }}>
              <Avatar user={u} />
              <div className="pmain">
                <div className="row between"><span className="pname">{u.name}</span><span className="row tight">{u.status !== 'ativo' && <Chip kind={STATUS[u.status][0]}>{STATUS[u.status][1]}</Chip>}{u.locked && <Chip kind="bad">Bloqueada</Chip>}</span></div>
                <span className="pmeta">{u.roleLabel} · {u.email}</span>
                <span className="pmeta">{[u.region, u.assoc].filter(Boolean).join(' · ') || '—'}{u.lastLoginAt ? ` · última entrada ${ago(u.lastLoginAt)}` : ' · nunca entrou'}</span>
              </div>
            </button>
          ))}</div> : <Empty>Nenhum utilizador corresponde à pesquisa.</Empty>}
        </>
      ) : seg === 'emails' ? <Emails /> : <Audit />}
    </>
  );
}

function Reject({ u, close, onDone }) {
  const ui = useUI();
  const [reason, setReason] = useState('');
  const [busy, run] = useBusy();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(async () => { try { await post(`/api/users/${u.id}/reject`, { reason }); ui.toast(`Registo de ${u.name} recusado.`); close(); onDone(); } catch (ex) { ui.toast(ex.message); } }); }}>
      <p className="hint"><b>{u.name}</b> recebe um email a dizer que o registo não foi aprovado.</p>
      <Field label="Motivo (opcional, segue no email)" id="rj-r"><textarea className="inp" id="rj-r" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <div className="row end"><button type="button" className="btn ghost" onClick={close}>Cancelar</button><button className="btn dangerf" disabled={busy}>Recusar registo</button></div>
    </form>
  );
}

function UserForm({ u, close, onSaved, self }) {
  const { config } = useApp();
  const ui = useUI();
  const [f, setF] = useState({
    name: u?.name || '', email: u?.email || '', phone: u?.phone || '', role: u?.role || config.roles[0].key, status: u?.status || 'ativo',
    region: u?.region || '', assoc: u?.assoc || '', licence: u?.licence || '', addr: u?.addr || '', postal: u?.postal || '', tel: u?.tel || '', birth: u?.birth || '', pin: '',
  });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => run(async () => {
    try {
      const body = { ...f };
      if (!body.pin) delete body.pin;
      if (u) await put(`/api/users/${u.id}`, body); else await post('/api/users', body);
      ui.toast(u ? 'Utilizador atualizado.' : `Utilizador criado.${f.status === 'ativo' ? ' Foi enviado um email com as instruções de entrada.' : ''}`);
      close();
      onSaved();
    } catch (e) { ui.toast(e.message); }
  });
  const remove = () => ui.confirm('Apagar utilizador', `Apagar ${u.name}? Esta ação não se pode desfazer.`, 'Apagar', async () => {
    try { await del(`/api/users/${u.id}`); ui.toast('Utilizador apagado.'); onSaved(); } catch (e) { ui.toast(e.message); }
  });
  const unlock = async () => { try { await post(`/api/users/${u.id}/unlock`); ui.toast('Conta desbloqueada.'); onSaved(); close(); } catch (e) { ui.toast(e.message); } };
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      {u && <div className="phead"><Avatar user={u} size="big" /><div><p className="meta"><b>{u.name}</b></p><p className="pmeta">Conta criada a {fdate(u.createdAt)}{u.lastLoginAt ? ` · última entrada ${fullTime(u.lastLoginAt)}` : ' · nunca entrou'}</p>{u.consentAt && <p className="pmeta">Consentimento RGPD a {fdate(u.consentAt)}</p>}</div></div>}
      {u?.locked && <div className="note warn row between"><span>Conta bloqueada por tentativas erradas.</span><button type="button" className="btn sm" onClick={unlock}>Desbloquear</button></div>}
      <div className="grid2">
        <Field label="Nome" id="uf-n"><input className="inp" id="uf-n" value={f.name} onChange={set('name')} required /></Field>
        <Field label="Email" id="uf-e"><input className="inp" id="uf-e" type="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Telemóvel" id="uf-p"><input className="inp" id="uf-p" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Nº de licença" id="uf-l"><input className="inp" id="uf-l" value={f.licence} onChange={set('licence')} /></Field>
        <Field label="Perfil de acesso" id="uf-r"><select className="inp" id="uf-r" value={f.role} onChange={set('role')} disabled={self}>{config.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Field>
        <Field label="Estado da conta" id="uf-s"><select className="inp" id="uf-s" value={f.status} onChange={set('status')} disabled={self}>{Object.entries(STATUS).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Região" id="uf-rg"><select className="inp" id="uf-rg" value={f.region} onChange={set('region')}><option value="">—</option>{config.regions.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Associação" id="uf-as"><select className="inp" id="uf-as" value={f.assoc} onChange={set('assoc')}><option value="">—</option>{config.assocs.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Morada" id="uf-ad"><input className="inp" id="uf-ad" value={f.addr} onChange={set('addr')} /></Field>
        <Field label="Código postal e localidade" id="uf-cp"><input className="inp" id="uf-cp" value={f.postal} onChange={set('postal')} /></Field>
        <Field label="Telefone fixo" id="uf-t"><input className="inp" id="uf-t" value={f.tel} onChange={set('tel')} /></Field>
        <Field label="Data de nascimento" id="uf-b"><input className="inp" id="uf-b" type="date" value={f.birth} onChange={set('birth')} /></Field>
      </div>
      <Field label={u ? 'Definir um código novo (deixa vazio para manter)' : 'Código de acesso (opcional)'} id="uf-pin" hint={u ? 'A pessoa também pode definir o seu em "Esqueci-me do código".' : 'Se ficar vazio, a pessoa recebe um email para definir o seu código.'}>
        <PinInput id="uf-pin" value={f.pin} onChange={set('pin')} style={{ maxWidth: 180 }} />
      </Field>
      <div className="row">{u && !self && <button type="button" className="btn danger" onClick={remove}>Apagar</button>}<span className="grow" /><button type="button" className="btn ghost" onClick={close}>Cancelar</button><button className="btn" disabled={busy}>{u ? 'Guardar' : 'Criar utilizador'}</button></div>
    </form>
  );
}

function Emails() {
  const ui = useUI();
  const [list, setList] = useState(null);
  useEffect(() => { get('/api/emails').then((r) => setList(r.emails)).catch((e) => { ui.toast(e.message); setList([]); }); }, []);
  if (!list) return <p className="pmeta">A carregar…</p>;
  return (
    <>
      <p className="hint">Todos os emails enviados pela plataforma. Sem a chave do Brevo configurada, os emails ficam como "simulado" e não saem.</p>
      {list.length ? <div className="plist">{list.map((e) => (
        <button key={e.id} className="prow click" style={{ textAlign: 'left', width: '100%', border: 0, borderTop: '1px solid var(--line)', background: 'none', font: 'inherit', color: 'inherit' }}
          onClick={() => ui.openModal(e.subject, () => <><p className="pmeta">Para: {e.to.map((t) => `${t.name} <${t.email}>`).join(', ')} · {fullTime(e.at)}</p>{e.error && <p className="err">{e.error}</p>}<div className="msgbody">{e.body}</div></>)}>
          <Icon name="mail" />
          <div className="pmain"><div className="row between"><span className="pname">{e.subject}</span><Chip kind={EMAIL_ST[e.status]?.[0]}>{EMAIL_ST[e.status]?.[1] || e.status}</Chip></div><span className="pmeta">{e.to.map((t) => t.name || t.email).join(', ')} · {ago(e.at)}</span></div>
        </button>
      ))}</div> : <Empty>Ainda não foram enviados emails.</Empty>}
    </>
  );
}

const ACTIONS = { entrou: 'Entrou', registo: 'Criou conta', aprovou: 'Aprovou conta', recusou: 'Recusou registo', criou_utilizador: 'Criou utilizador', editou_utilizador: 'Editou utilizador', apagou_utilizador: 'Apagou utilizador', desbloqueou: 'Desbloqueou conta', conta_bloqueada: 'Conta bloqueada por tentativas', mudou_codigo: 'Mudou o código', repos_codigo: 'Repôs o código por email', pediu_reposicao: 'Pediu para repor o código', publicou_documento: 'Publicou documento', editou_documento: 'Editou documento', apagou_documento: 'Apagou documento' };

function Audit() {
  const ui = useUI();
  const [list, setList] = useState(null);
  useEffect(() => { get('/api/audit').then((r) => setList(r.audit)).catch((e) => { ui.toast(e.message); setList([]); }); }, []);
  if (!list) return <p className="pmeta">A carregar…</p>;
  return (
    <>
      <p className="hint">As últimas 300 ações importantes na plataforma: entradas, aprovações, alterações de contas e documentos.</p>
      {list.length ? <div className="tblwrap"><table><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>
        {list.map((a) => <tr key={a.id}><td>{fullTime(a.created_at)}</td><td>{a.user_name || '—'}</td><td>{ACTIONS[a.action] || a.action}</td><td>{a.details || ''}</td></tr>)}
      </tbody></table></div> : <Empty>Sem registos.</Empty>}
    </>
  );
}
