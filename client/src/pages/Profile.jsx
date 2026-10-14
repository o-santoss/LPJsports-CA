import React, { useState } from 'react';
import { put, del } from '../lib/api.js';
import { squarePhoto } from '../lib/image.js';
import { useApp } from '../App.jsx';
import { useUI, Icon, Field, Avatar, PinInput, useBusy } from '../ui/kit.jsx';

export default function Profile() {
  const { me, setMe, config, logout } = useApp();
  const ui = useUI();
  const [f, setF] = useState({ name: me.name, email: me.email, phone: me.phone, region: me.region, assoc: me.assoc, addr: me.addr, postal: me.postal, tel: me.tel, birth: me.birth, notif: { ...me.notif } });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      try { const r = await put('/api/me', f); setMe(r.user); ui.toast('Perfil guardado.'); } catch (ex) { ui.toast(ex.message); }
    });
  };
  const photo = async (file) => {
    if (!file) return;
    try {
      const data = await squarePhoto(file);
      const r = await put('/api/me/photo', { data });
      setMe(r.user);
      ui.toast('Foto de perfil atualizada.');
    } catch (ex) { ui.toast(ex.message); }
  };
  const removePhoto = async () => { try { const r = await del('/api/me/photo'); setMe(r.user); ui.toast('Foto removida.'); } catch (ex) { ui.toast(ex.message); } };

  return (
    <>
      <header className="ph row between">
        <div className="phead lg">
          <label className="phwrap" title={me.photoUrl ? 'Mudar a foto' : 'Adicionar foto'}>
            <Avatar user={me} size="big" />
            <span className="phcam"><Icon name="cam" /></span>
            <input type="file" id="ph-file" accept="image/*" aria-label={me.photoUrl ? 'Mudar a foto de perfil' : 'Adicionar foto de perfil'} onChange={(e) => { photo(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <div>
            <p className="eyebrow">{me.roleLabel}</p><h1>{me.name}</h1>
            <p className="sub">{[me.region, me.licence || 'sem licença'].filter(Boolean).join(' · ')}</p>
            <p className="row tight" style={{ marginTop: 4 }}>
              <label className="link" htmlFor="ph-file" style={{ cursor: 'pointer' }}>{me.photoUrl ? 'Mudar foto' : 'Adicionar foto de perfil'}</label>
              {me.photoUrl && <><span className="pmeta">·</span><button type="button" className="link" onClick={removePhoto}>Remover</button></>}
            </p>
          </div>
        </div>
        <button className="btn ghost" onClick={logout}><Icon name="out" /> Sair</button>
      </header>

      <form className="card" onSubmit={save}>
        <h2>Dados pessoais</h2>
        <div className="grid2">
          <Field label="Nome" id="pf-n"><input className="inp" id="pf-n" value={f.name} onChange={set('name')} required /></Field>
          <Field label="Email" id="pf-e"><input className="inp" id="pf-e" type="email" value={f.email} onChange={set('email')} required /></Field>
          <Field label="Telemóvel" id="pf-p"><input className="inp" id="pf-p" inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Região" id="pf-r"><select className="inp" id="pf-r" value={f.region} onChange={set('region')}><option value="">—</option>{config.regions.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Associação" id="pf-a"><select className="inp" id="pf-a" value={f.assoc} onChange={set('assoc')}><option value="">Escolher…</option>{config.assocs.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Data de nascimento" id="pf-b"><input className="inp" id="pf-b" type="date" value={f.birth} onChange={set('birth')} /></Field>
          <Field label="Morada" id="pf-ad"><input className="inp" id="pf-ad" value={f.addr} onChange={set('addr')} autoComplete="street-address" /></Field>
          <Field label="Código postal e localidade" id="pf-cp"><input className="inp" id="pf-cp" value={f.postal} onChange={set('postal')} placeholder="0000-000 Localidade" /></Field>
          <Field label="Telefone fixo" id="pf-t"><input className="inp" id="pf-t" inputMode="tel" value={f.tel} onChange={set('tel')} /></Field>
        </div>
        <fieldset className="fs"><legend className="lbl">Receber email quando</legend>
          <label className="sw"><input type="checkbox" checked={f.notif.conf} onChange={(e) => setF({ ...f, notif: { ...f.notif, conf: e.target.checked } })} /> Houver alterações que me digam respeito ou documentos novos</label>
          <label className="sw"><input type="checkbox" checked={f.notif.msg} onChange={(e) => setF({ ...f, notif: { ...f.notif, msg: e.target.checked } })} /> Receber uma mensagem</label>
          <p className="pmeta">A aprovação da conta e os códigos de confirmação seguem sempre por email.</p>
        </fieldset>
        <div className="row end"><button className="btn" disabled={busy}>Guardar</button></div>
      </form>

      <ChangePin />

      <section className="card mt">
        <h2>Os meus dados</h2>
        <p className="hint">Podes descarregar todos os dados que a plataforma tem sobre ti (RGPD). Para apagar a conta, fala com o {config.org}.</p>
        <a className="btn ghost" href="/api/me/export" download><Icon name="download" /> Descarregar os meus dados</a>
      </section>
    </>
  );
}

function ChangePin() {
  const ui = useUI();
  const [f, setF] = useState({ old: '', pin: '', pin2: '' });
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card mt" onSubmit={(e) => { e.preventDefault(); run(async () => { try { await put('/api/me/pin', f); setF({ old: '', pin: '', pin2: '' }); ui.toast('Código alterado.'); } catch (ex) { ui.toast(ex.message); } }); }}>
      <h2>Código de acesso</h2>
      <div className="grid3">
        <Field label="Código atual" id="pn-o"><PinInput id="pn-o" value={f.old} onChange={set('old')} autoComplete="current-password" /></Field>
        <Field label="Código novo" id="pn-n"><PinInput id="pn-n" value={f.pin} onChange={set('pin')} autoComplete="new-password" /></Field>
        <Field label="Repete" id="pn-r"><PinInput id="pn-r" value={f.pin2} onChange={set('pin2')} autoComplete="new-password" /></Field>
      </div>
      <div className="row end"><button className="btn" disabled={busy}><Icon name="lock" /> Alterar código</button></div>
    </form>
  );
}
