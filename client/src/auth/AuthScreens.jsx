import {QualificationFields} from '../arbitration/Arbitration.jsx';
// Ecrãs sem sessão: entrar, criar conta, recuperar o código e conta por aprovar.
import React, { useState } from 'react';
import { post } from '../lib/api.js';
import { first } from '../lib/fmt.js';
import { useApp } from '../App.jsx';
import { LpjHero, Field, PinInput, useBusy } from '../ui/kit.jsx';
import Help from '../pages/Help.jsx';

export default function AuthScreens() {
  const [screen, setScreen] = useState('login');
  const [info, setInfo] = useState({});
  const nav = (s, i = {}) => { setScreen(s); setInfo(i); scrollTo(0, 0); };
  if (screen === 'help') return <><button className="back" onClick={() => nav('login')}>‹ Entrar</button><Help pub /></>;
  return (
    <div className="auth">
      {screen === 'login' && <LpjHero />}
      {screen === 'login' && <Login nav={nav} initialId={info.id} />}
      {screen === 'register' && <Register nav={nav} />}
      {screen === 'forgot' && <Forgot nav={nav} initialId={info.id} />}
      {(screen === 'done' || screen === 'pending') && <Waiting nav={nav} done={screen === 'done'} name={info.name} />}
    </div>
  );
}

function Login({ nav, initialId = '' }) {
  const { setMe, refresh, config } = useApp();
  const [id, setId] = useState(initialId);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      setErr('');
      try {
        const r = await post('/api/auth/login', { id, pin });
        setMe(r.user);
        refresh();
      } catch (ex) {
        if (ex.data?.code === 'pendente') return nav('pending', { name: ex.data.name });
        setErr(ex.message);
        setPin('');
      }
    });
  };
  return (
    <>
      <form className="auth-card" onSubmit={submit} noValidate>
        <p className="eyebrow">{config.org}</p><h1>Entrar</h1>
        <p className="sub">Usa o email ou o telemóvel do teu registo e o teu código de 4 algarismos.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <Field label="Email ou telemóvel" id="lg-id"><input className="inp" id="lg-id" autoComplete="username" required value={id} onChange={(e) => setId(e.target.value)} /></Field>
        <Field label="Código" id="lg-pin"><PinInput id="lg-pin" autoComplete="current-password" required value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
        <button className="btn block" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
        <div className="row between mt">
          <button type="button" className="link" onClick={() => nav('forgot', { id })}>Esqueci-me do código</button>
          <button type="button" className="link" onClick={() => nav('register')}>Criar conta</button>
        </div>
      </form>
      <p className="pmeta" style={{ textAlign: 'center' }}><button type="button" className="link" onClick={() => nav('help')}>Como funciona a aplicação?</button></p>
    </>
  );
}

function Register({ nav }) {
  const { config } = useApp();
  const [f, setF] = useState({ name: '', email: '', phone: '', region: config.regions.includes('Lisboa') ? 'Lisboa' : '', assoc: '', licence: '', extra:{funcs:[],lv:{},recNext:'',courses:[]}, recLast:'',recPlace:'', pin: '', pin2: '', consent: false });
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      setErr('');
      try {
        const r = await post('/api/auth/register', {...f,extra:{...f.extra,courses:f.recLast?[{type:'Recertificação',name:'Recertificação de árbitros FPT',date:f.recLast,place:f.recPlace}]:[]}});
        nav('done', { name: r.name });
      } catch (ex) { setErr(ex.message); scrollTo(0, 0); }
    });
  };
  return (
    <form className="auth-card" onSubmit={submit} noValidate>
      <p className="eyebrow">Nova conta</p><h1>Criar conta</h1>
      <p className="sub">Preenche o teu perfil. O {config.org} valida os dados e aprova o acesso.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <Field label="Nome completo" id="rg-name"><input className="inp" id="rg-name" autoComplete="name" required value={f.name} onChange={set('name')} /></Field>
      <div className="grid2">
        <Field label="Email" id="rg-email"><input className="inp" id="rg-email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
        <Field label="Telemóvel" id="rg-phone"><input className="inp" id="rg-phone" inputMode="tel" autoComplete="tel" placeholder="912 345 678" required value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Região" id="rg-region">
          <select className="inp" id="rg-region" value={f.region} onChange={set('region')}><option value="">Escolher…</option>{config.regions.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Associação" id="rg-assoc">
          <select className="inp" id="rg-assoc" value={f.assoc} onChange={set('assoc')}><option value="">Escolher…</option>{config.assocs.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
        <Field label="Nº de licença (se tiveres)" id="rg-lic"><input className="inp" id="rg-lic" value={f.licence} onChange={set('licence')} placeholder="FPT-12345" /></Field>
      </div>
      <QualificationFields value={f.extra} onChange={extra=>setF({...f,extra})} registration/>
      <div className="grid2"><Field label="Última recertificação" id="rg-last"><input className="inp" type="date" id="rg-last" value={f.recLast} onChange={set('recLast')}/></Field><Field label="Local da última recertificação" id="rg-place"><input className="inp" id="rg-place" value={f.recPlace} onChange={set('recPlace')}/></Field></div>
      <div className="grid2">
        <Field label="Código de acesso (4 algarismos)" id="rg-pin"><PinInput id="rg-pin" autoComplete="new-password" value={f.pin} onChange={set('pin')} /></Field>
        <Field label="Repete o código" id="rg-pin2"><PinInput id="rg-pin2" autoComplete="new-password" value={f.pin2} onChange={set('pin2')} /></Field>
      </div>
      <p className="pmeta" style={{ marginTop: -6, marginBottom: 12 }}>Códigos fáceis, como 1234 ou 0000, não são aceites.</p>
      <label className="sw"><input type="checkbox" checked={f.consent} onChange={set('consent')} /> <span className="pmeta">Autorizo o {config.org} a tratar estes dados para a gestão da plataforma (RGPD). Posso pedir para os consultar, descarregar ou apagar.</span></label>
      <div className="mt"><button className="btn block" disabled={busy}>{busy ? 'A enviar…' : 'Criar conta'}</button></div>
      <p className="pmeta mt" style={{ textAlign: 'center' }}>Já tens conta? <button type="button" className="link" onClick={() => nav('login')}>Entrar</button></p>
    </form>
  );
}

function Forgot({ nav, initialId = '' }) {
  const [step, setStep] = useState(1);
  const [id, setId] = useState(initialId);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [err, setErr] = useState('');
  const [busy, run] = useBusy();
  const ask = (e) => {
    e.preventDefault();
    run(async () => {
      setErr('');
      try { await post('/api/auth/forgot', { id }); setStep(2); } catch (ex) { setErr(ex.message); }
    });
  };
  const reset = (e) => {
    e.preventDefault();
    run(async () => {
      setErr('');
      try { await post('/api/auth/reset', { id, code, pin, pin2 }); setStep(3); } catch (ex) { setErr(ex.message); }
    });
  };
  return (
    <div className="auth-card">
      <p className="eyebrow">Código de acesso</p><h1>{step === 3 ? 'Código alterado' : 'Esqueceste o código?'}</h1>
      {err && <p className="err" role="alert">{err}</p>}
      {step === 1 && (
        <form onSubmit={ask} noValidate>
          <p className="sub">Escreve o email (ou o telemóvel) da tua conta. Enviamos-te por email um código de confirmação para definires um código novo.</p>
          <Field label="Email ou telemóvel" id="fg-id"><input className="inp" id="fg-id" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} /></Field>
          <button className="btn block" disabled={busy || !id.trim()}>Enviar código de confirmação</button>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={reset} noValidate>
          <p className="sub">Se a conta existir e estiver ativa, recebeste um email com um código de 6 algarismos (vê também a pasta de spam). É válido durante 20 minutos.</p>
          <Field label="Código de confirmação (6 algarismos)" id="fg-code"><input className="inp" id="fg-code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="grid2">
            <Field label="Código novo (4 algarismos)" id="fg-pin"><PinInput id="fg-pin" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} /></Field>
            <Field label="Repete o código novo" id="fg-pin2"><PinInput id="fg-pin2" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value)} /></Field>
          </div>
          <button className="btn block" disabled={busy}>Guardar código novo</button>
          <p className="pmeta mt"><button type="button" className="link" onClick={() => setStep(1)}>Não recebi o email</button></p>
        </form>
      )}
      {step === 3 && <p className="sub">Já podes entrar com o código novo.</p>}
      <button className="btn ghost block mt" onClick={() => nav('login', { id })}>Voltar à entrada</button>
    </div>
  );
}

function Waiting({ nav, done, name }) {
  const { config } = useApp();
  return (
    <div className="auth-card">
      <p className="eyebrow">{done ? 'Registo enviado' : 'Conta por aprovar'}</p>
      <h1>{done ? 'Obrigado' : 'Quase lá'}{name ? `, ${first(name)}` : ''}</h1>
      <p className="sub">{done ? `O teu perfil foi criado e está à espera de aprovação do ${config.org}.` : `O teu perfil ainda está à espera de aprovação do ${config.org}.`} Recebes um email quando a conta for aprovada. Depois disso, entras com o teu email e o teu código de 4 algarismos.</p>
      <button className="btn block" onClick={() => nav('login')}>Voltar à entrada</button>
    </div>
  );
}
