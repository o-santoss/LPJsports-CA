import React, { useEffect, useState } from 'react';
import { get } from '../lib/api.js';
import { first, ago, plural } from '../lib/fmt.js';
import { useApp } from '../App.jsx';
import { LpjBanner, Icon, Empty } from '../ui/kit.jsx';

export default function Home() {
  const { me, config, go, isAdmin } = useApp();
  const [h, setH] = useState(null);
  useEffect(() => { get('/api/home').then(setH).catch(() => setH({ latest: [] })); }, []);
  return (
    <>
      <header className="ph"><p className="eyebrow">{me.roleLabel}</p><h1>Olá, {first(me.name)}</h1></header>
      <LpjBanner appName={config.name} />
      <div className="helpcta">
        <span><b>Como funciona a aplicação?</b><br /><span className="pmeta">O que podes fazer e onde está cada coisa.</span></span>
        <button className="btn sm ghost" onClick={() => go('/ajuda')}><Icon name="help" /> Abrir ajuda</button>
      </div>
      {!me.photoUrl && (
        <div className="bar"><span><b>Põe uma foto no teu perfil</b><br /><span className="pmeta">Ajuda a equipa a reconhecer-te.</span></span><button className="btn sm ghost" onClick={() => go('/perfil')}><Icon name="cam" /> Adicionar foto</button></div>
      )}
      {h?.unseenDocs > 0 && (
        <div className="bar">
          <span><b>{plural(h.unseenDocs, 'documento novo', 'documentos novos')}</b><br /><span className="pmeta">{h.unseenDocTitles.filter(Boolean).join(' · ')}</span></span>
          <button className="btn sm ghost" onClick={() => go('/documentos')}><Icon name="doc" /> Ver documentos</button>
        </div>
      )}
      {isAdmin && h && (
        <section className="sect">
          <div className="sect-h"><h2>Administração</h2></div>
          <div className="kpis">
            <button className={`kpi ${h.pending ? 'attn' : ''}`} onClick={() => go('/utilizadores')}><b>{h.pending}</b><span>Registos por aprovar</span></button>
            <button className="kpi" onClick={() => go('/utilizadores')}><b>{h.users}</b><span>Utilizadores ativos</span></button>
            {h.emailErrors > 0 && <button className="kpi attn" onClick={() => go('/utilizadores')}><b>{h.emailErrors}</b><span>Emails com erro</span></button>}
          </div>
        </section>
      )}
      <section className="sect">
        <div className="sect-h"><h2>Últimas notificações</h2>{h?.unread > 0 && <span className="pmeta">{plural(h.unread, 'por ler', 'por ler')}</span>}</div>
        {!h ? <p className="pmeta">A carregar…</p> : h.latest.length ? (
          <div className="plist">
            {h.latest.map((m) => (
              <button key={m.id} className="prow click mrow" onClick={() => go('/mensagens')} style={{ textAlign: 'left', width: '100%', border: 0, background: 'none', font: 'inherit', color: 'inherit' }}>
                <Icon name={m.kind === 'mensagem' ? 'mail' : 'bell'} />
                <div className="pmain"><span className="pname" style={{ fontWeight: m.read ? 500 : 700 }}>{m.subject}</span><span className="pmeta">{m.from || 'Automática'} · {ago(m.at)}</span></div>
                {!m.read && <span className="dot" aria-label="por ler" />}
              </button>
            ))}
          </div>
        ) : <Empty>Ainda não tens notificações.</Empty>}
      </section>
    </>
  );
}
