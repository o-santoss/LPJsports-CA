// Peças de interface reutilizadas em todas as apps: ícones, logótipo LPJ, avatar, janelas, avisos e campos.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ICONS } from './icons.js';
import LPJ from './lpj-paths.json';
import { initials } from '../lib/fmt.js';

export const Icon = ({ name }) => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
);

// ---------- marca LPJ Sports ----------
export const LPJ_URL = 'https://www.lpjsports.pt';
export const LpjLogo = ({ dark }) => (
  <svg className="lpj" viewBox="-2 -2 572 422" aria-hidden="true" focusable="false">
    <path fill={`url(#${dark ? 'lpjgd' : 'lpjg'})`} fillRule="evenodd" d={LPJ.gray} />
    <path className="lpj-b" fillRule="evenodd" d={LPJ.blue} />
    <path className="lpj-w" fillRule="evenodd" d={LPJ.white} />
  </svg>
);
const LpjLink = ({ className, children, label }) => (
  <a className={className} href={LPJ_URL} target="_blank" rel="noopener noreferrer" aria-label={label}>{children}</a>
);
export const LpjCredit = () => (
  <LpjLink className="credit"><span>Desenvolvido por</span><LpjLogo /><span><b>LPJ Sports</b><br />www.lpjsports.pt</span></LpjLink>
);
export const LpjHero = () => (
  <LpjLink className="lpj-hero lpj-dark"><LpjLogo dark /><span className="lh-t">Plataforma desenvolvida pela <b>LPJ Sports</b></span><span className="lh-l">Visitar www.lpjsports.pt →</span></LpjLink>
);
export const LpjBanner = ({ appName }) => (
  <LpjLink className="lpj-banner lpj-dark"><LpjLogo dark /><span className="lb-t"><span><b>{appName}</b> é uma plataforma <b>LPJ Sports</b></span><small>www.lpjsports.pt →</small></span></LpjLink>
);
export const LpjSide = () => (
  <LpjLink className="lpj-side lpj-dark"><LpjLogo dark /><span>www.lpjsports.pt</span></LpjLink>
);
export const LpjTop = () => (
  <LpjLink className="toplpj" label="LPJ Sports — abrir lpjsports.pt"><LpjLogo /></LpjLink>
);
export const AppMark = () => (
  <svg className="mark" viewBox="0 0 34 25" aria-hidden="true"><rect className="mk-bg" x="1" y="1" width="32" height="23" rx="3" /><path className="mk-ln" d="M1 4.5h32M1 20.5h32M9 4.5v16M25 4.5v16M9 12.5h16" /><path className="mk-net" d="M17 1v23" /></svg>
);

// ---------- avatar ----------
export function Avatar({ user, size }) {
  if (!user) return <div className="pav">?</div>;
  if (size === 'big') {
    return user.photoUrl
      ? <span className="avbig"><img src={user.photoUrl} alt={`Foto de ${user.name}`} /></span>
      : <span className="avbig">{initials(user.name)}</span>;
  }
  return user.photoUrl
    ? <div className="pav ph"><img src={user.photoUrl} alt="" /></div>
    : <div className="pav">{initials(user.name)}</div>;
}

export const Chip = ({ kind = '', children }) => <span className={`chip ${kind}`}>{children}</span>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;

// ---------- janelas (modais), avisos (toasts) e confirmações ----------
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [modal, setModal] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const t = useRef(0);
  const toast = useCallback((m) => {
    setToastMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setToastMsg(''), 4200);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((title, render) => setModal({ title, render, key: Date.now() }), []);
  const confirm = useCallback((title, text, yes, fn, danger = true) => {
    setModal({
      title, key: Date.now(),
      render: (close) => (
        <>
          <p className="msgbody">{text}</p>
          <div className="row end">
            <button className="btn ghost" onClick={close}>Cancelar</button>
            <button className={`btn ${danger ? 'dangerf' : ''}`} onClick={async () => { close(); await fn(); }}>{yes}</button>
          </div>
        </>
      ),
    });
  }, []);
  useEffect(() => {
    document.body.classList.toggle('modal-open', !!modal);
    if (!modal) return;
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);
  return (
    <UICtx.Provider value={{ toast, openModal, closeModal, confirm, _modal: modal, _toastMsg: toastMsg }}>
      {children}
    </UICtx.Provider>
  );
}

// Onde aparecem as janelas e os avisos. Fica dentro da app para as janelas terem acesso aos dados da sessão.
export function UIOutlet() {
  const { _modal: modal, _toastMsg: toastMsg, closeModal } = useContext(UICtx);
  return (
    <>
      {modal && (
        <div className="modal" key={modal.key}>
          <div className="scrim" onClick={closeModal} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="mtitle" tabIndex={-1} ref={(el) => el && !el.contains(document.activeElement) && el.focus({ preventScroll: true })}>
            <div className="sh-head"><h2 id="mtitle">{modal.title}</h2><button className="icon-btn" onClick={closeModal} aria-label="Fechar"><Icon name="x" /></button></div>
            <div className="sh-body">{modal.render(closeModal)}</div>
          </div>
        </div>
      )}
      <div className="toast" role="status" hidden={!toastMsg}>{toastMsg}</div>
    </>
  );
}

// ---------- campos de formulário ----------
export function Field({ label, id, children, hint }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="pmeta">{hint}</span>}
    </div>
  );
}
export const PinInput = (props) => (
  <input className="inp pin" type="password" inputMode="numeric" maxLength={4} autoComplete="off"
    {...props} onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); props.onChange?.(e); }} />
);
export const Seg = ({ items, value, onChange }) => (
  <div className="seg" role="tablist">
    {items.map(([k, l]) => (
      <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>
    ))}
  </div>
);

// Botão que mostra "A guardar…" enquanto o pedido decorre e evita cliques duplos.
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    if (busy) return;
    setBusy(true);
    try { return await fn(); } finally { setBusy(false); }
  }, [busy]);
  return [busy, run];
}
