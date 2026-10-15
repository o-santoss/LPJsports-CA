// Estrutura da app: sessão, navegação e moldura (topo, menu, rodapé LPJ).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './lib/api.js';
import { loadLook, saveLook, applyLook, watchSystemTheme, PALETTES, isDark } from './lib/theme.js';
import { UIProvider, UIOutlet, useUI, Icon, LpjTop, LpjSide, LpjCredit, AppMark, Seg } from './ui/kit.jsx';
import AuthScreens from './auth/AuthScreens.jsx';
import Home from './pages/Home.jsx';
import Messages from './pages/Messages.jsx';
import Documents from './pages/Documents.jsx';
import Users from './pages/Users.jsx';
import Profile from './pages/Profile.jsx';
import Help from './pages/Help.jsx';
import Arbitration from './arbitration/Arbitration.jsx';
const TournamentPage=()=> <Arbitration view="tournaments"/>;
const AvailabilityPage=()=> <Arbitration view="availability"/>;
const NominationsPage=()=> <Arbitration view="nominations"/>;
const ManagementPage=()=> <Arbitration view="management"/>;
const DirectoryPage=()=> <Arbitration view="directory"/>;
const LogbookPage=()=> <Arbitration view="logbook"/>;

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function useRoute() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  const go = useCallback((p) => {
    if (p !== location.pathname) history.pushState({}, '', p);
    setPath(p);
    scrollTo(0, 0);
  }, []);
  return [path, go];
}

export default function App() {
  return <UIProvider><Root /></UIProvider>;
}

function Root() {
  const [config, setConfig] = useState(null);
  const [me, setMe] = useState(undefined); // undefined = a carregar; null = sem sessão
  const [counts, setCounts] = useState({ unread: 0, unseenDocs: 0, pending: 0 });
  const [path, go] = useRoute();
  const [look, setLook] = useState(loadLook);
  const ui = useUI();

  useEffect(() => { applyLook(look); }, [look]);
  useEffect(() => { document.body.classList.toggle('authed', !!me); }, [me]);
  useEffect(() => { watchSystemTheme(() => loadLook()); }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await get('/api/me');
      setMe(r.user);
      const c = { unread: r.unread, unseenDocs: r.unseenDocs, pending: 0, canManage:false };
      try { const domain=await get('/api/arbitration/counts');c.pending=domain.pending||0;c.canManage=domain.canManage; } catch {}
      if (r.user.role === config?.roles.find((x) => x.admin)?.key) {
        const h = await get('/api/home');
        c.pending += h.pending || 0;
      }
      setCounts(c);
      return r.user;
    } catch (e) {
      if (e.status === 401) setMe(null);
      return null;
    }
  }, [config]);

  useEffect(() => { get('/api/config').then((r) => { setConfig(r.app); document.title = r.app.name; }).catch(() => setConfig(false)); }, []);
  useEffect(() => { if (config) refresh(); }, [config, refresh]);
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setMe((prev) => {
        if (prev) ui.toast('A tua sessão terminou. Entra de novo.');
        return null;
      });
    });
  }, [ui]);
  // Atualiza os contadores de tempos a tempos e quando a pessoa volta à janela.
  useEffect(() => {
    if (!me) return;
    const t = setInterval(refresh, 60000);
    const onFocus = () => refresh();
    addEventListener('focus', onFocus);
    return () => { clearInterval(t); removeEventListener('focus', onFocus); };
  }, [me, refresh]);

  const isAdmin = !!(me && config && config.roles.find((r) => r.key === me.role)?.admin);
  const roleIdx = me && config ? config.roles.findIndex((r) => r.key === me.role) : -1;
  const logout = useCallback(async () => {
    try { await post('/api/auth/logout'); } catch {}
    setMe(null);
    go('/');
  }, [go]);

  const openLook = () => ui.openModal('Cores e aparência', (close) => <LookPicker look={look} onChange={(l) => { setLook(l); saveLook(l); }} close={close} />);

  const value = useMemo(() => ({ config, me, setMe, refresh, counts, setCounts, go, path, logout, isAdmin, roleIdx }), [config, me, refresh, counts, go, path, logout, isAdmin, roleIdx]);

  if (config === false) return <div className="auth"><div className="auth-card"><h1>Sem ligação</h1><p className="sub">Não foi possível falar com o servidor. Confirma a internet e recarrega a página.</p></div></div>;
  if (!config || me === undefined) return <div className="boot" aria-busy="true"><AppMark /></div>;

  const tabs = me ? [
    ['/', 'Início', 'home', 0],
    ['/disponibilidade', 'Disponibilidade', 'cal', 0],
    ['/nomeacoes', 'Nomeações', 'users', 0],
    ['/caderneta', 'Caderneta', 'doc', 0],
    ['/torneios', 'Torneios', 'cal', 0],
    ...(roleIdx>=1||counts.canManage ? [['/gestao', 'Gestão', 'users', counts.pending]] : []),
    ...(roleIdx >= 1 ? [['/arbitros', 'Árbitros', 'users', 0]] : []),
    ['/mensagens', 'Notificações', 'bell', counts.unread],
    ['/documentos', 'Documentos', 'doc', counts.unseenDocs],
    ...(isAdmin ? [['/utilizadores', 'Utilizadores', 'users', counts.pending]] : []),
    ['/ajuda', 'Ajuda', 'help', 0],
  ] : [];
  const pages = { '/torneios': TournamentPage, '/disponibilidade':AvailabilityPage, '/nomeacoes':NominationsPage, '/gestao':ManagementPage, '/arbitros':roleIdx>=1?DirectoryPage:Home, '/caderneta':LogbookPage, '/': Home, '/mensagens': Messages, '/documentos': Documents, '/utilizadores': isAdmin ? Users : Home, '/perfil': Profile, '/ajuda': Help };
  const Page = pages[path] || Home;

  return (
    <Ctx.Provider value={value}>
      <div className={`app ${me ? 'authed' : ''}`}>
        <header className="top">
          <a className="brand" href="/" onClick={(e) => { e.preventDefault(); go('/'); }}>
            <AppMark /><div><b>{config.name}</b><small>{config.tagline}</small></div>
          </a>
          <LpjTop />
          <button className="icon-btn" onClick={openLook} aria-label="Cores e aparência" title="Cores e aparência"><Icon name="palette" /></button>
          {me && (
            <button className={`avatar ${me.photoUrl ? 'ph' : ''}`} onClick={() => go('/perfil')} aria-label="O meu perfil">
              {me.photoUrl ? <img src={me.photoUrl} alt="" /> : initialsOf(me.name)}
            </button>
          )}
        </header>
        <div className="layout">
          {me && (
            <nav className="nav" aria-label="Navegação principal">
              {tabs.map(([p, l, ic, b], index) => (
                <button key={p} className={`nv ${index>=4?'nv-x':''} ${path === p ? 'on' : ''}`} onClick={() => go(p)} aria-current={path === p ? 'page' : undefined}>
                  <Icon name={ic} /><span>{l}</span>{b ? <b className="bdg">{b}</b> : null}
                </button>
              ))}
              <button className="nv nv-more" onClick={()=>ui.openModal('Mais',close=><div className="plist">{tabs.slice(4).map(([p,l,ic,b])=><button className="prow" key={p} onClick={()=>{go(p);close();}}><Icon name={ic}/><span>{l}</span>{b>0&&<b className="bdg">{b}</b>}</button>)}</div>)}><Icon name="more"/><span>Mais</span></button>
              <LpjSide />
            </nav>
          )}
          <main id="main">
            {me ? <Page key={path} /> : <AuthScreens />}
            <LpjCredit />
          </main>
        </div>
      </div>
      <UIOutlet />
    </Ctx.Provider>
  );
}

const initialsOf = (n) => String(n || '?').split(' ').filter(Boolean).map((s) => s[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase();

function LookPicker({ look, onChange, close }) {
  const dk = isDark(look);
  return (
    <>
      <p className="hint">Escolhe as cores da aplicação. A escolha fica guardada neste dispositivo.</p>
      <div className="swatches">
        {Object.entries(PALETTES).map(([k, p]) => {
          const c = p[dk ? 'd' : 'l'];
          return (
            <button key={k} className="swb" aria-pressed={look.pal === k} onClick={() => onChange({ ...look, pal: k })}>
              <span className="swp" style={{ background: c.bg }}><i style={{ background: c.accent }} /><i className="bar" style={{ background: c.surface }} /><i style={{ background: c.soft }} /></span>
              {p.name}
            </button>
          );
        })}
      </div>
      <p className="lbl" style={{ marginBottom: 8 }}>Modo</p>
      <Seg items={[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']]} value={look.mode} onChange={(m) => onChange({ ...look, mode: m })} />
      <div className="row end"><button className="btn" onClick={close}>Concluído</button></div>
    </>
  );
}
