import React, { useState } from 'react';
import { norm } from '../lib/fmt.js';
import { useApp } from '../App.jsx';

// Ajuda do núcleo. Cada módulo (ex.: arbitragem) acrescenta as suas perguntas.
export default function Help({ pub }) {
  const { config, me } = useApp();
  const [q, setQ] = useState('');
  const org = config.org;
  const roles = config.roles;
  const faq = [
    ['Criar conta e entrar', <><ol><li>No ecrã de entrada, toca em <b>Criar conta</b>.</li><li>Preenche o nome, o email, o telemóvel, a região e a associação.</li><li>Escolhe um <b>código de 4 algarismos</b>. Códigos fáceis, como 1234 ou 0000, não são aceites.</li><li>A conta fica <b>por aprovar</b>. O {org} confirma os dados e aprova o acesso, e recebes um email quando isso acontecer.</li></ol><p>Para entrar, usa o email ou o telemóvel do registo e o teu código. Ao fim de 5 tentativas erradas, a conta fica bloqueada durante 15 minutos.</p></>],
    ['Esqueci-me do código', <p>No ecrã de entrada, toca em <b>Esqueci-me do código</b> e escreve o teu email. Recebes um código de confirmação de 6 algarismos, válido durante 20 minutos, e escolhes um código novo. Por segurança, as outras sessões abertas terminam.</p>],
    ['O meu perfil e a foto', <p>Em <b>Perfil</b> (o teu círculo no canto superior direito) alteras os teus dados, a associação, as preferências de email e o código. Toca na foto para escolher uma imagem: é cortada em quadrado e reduzida automaticamente. Também podes descarregar todos os teus dados.</p>],
    ['Notificações e emails', <><p>Tudo o que a plataforma te envia fica em <b>Notificações</b>. Por email recebes sempre a aprovação da conta e os códigos de confirmação. Os avisos de alterações, os documentos novos e as mensagens também seguem por email se tiveres essa opção ligada no Perfil.</p>{roles.length > 1 && <p>{roles.slice(1).map((r) => r.plural).join(' e ')} podem enviar mensagens. Qualquer pessoa pode responder a uma mensagem que recebeu.</p>}</>],
    ['Documentos', <p>Em <b>Documentos</b> estão os regulamentos, as regras, as tabelas e as circulares do {org}. Procura pelo nome, filtra por categoria e descarrega. Os documentos novos aparecem marcados como <b>Novo</b>.</p>],
    ['Administração', <p>O {org} aprova ou recusa registos, cria e edita utilizadores (perfil, estado, dados e código), desbloqueia contas, publica documentos e vê todos os emails enviados e o registo de ações.</p>],
    ['Cores e aparência', <p>No botão da paleta, no topo, escolhes uma de seis paletas de cores e o modo claro, escuro ou automático. A escolha fica guardada no teu dispositivo.</p>],
    ['Os meus dados e privacidade', <p>A plataforma guarda só o necessário para funcionar: os dados do perfil, as mensagens e o registo de ações importantes. Em Perfil podes descarregar todos os teus dados. Para apagar a conta, pede ao {org}.</p>],
  ];
  const shown = faq.filter(([t]) => !q || norm(t).includes(norm(q)));
  return (
    <>
      <header className="ph"><p className="eyebrow">Ajuda</p><h1>Como funciona a {config.name}</h1><p className="sub">O essencial para usar a plataforma.</p></header>
      <section className="sect">
        <div className="sect-h"><h2>Quem faz o quê</h2></div>
        <div className="roles">{roles.map((r, i) => (
          <div key={r.key} className={`role ${me?.role === r.key ? 'me' : ''}`}>
            <h3>{r.label}</h3>
            <ul>
              {i > 0 && <li>Tudo o que o perfil anterior faz</li>}
              {i === 0 && <><li>Gerir o perfil, a foto e o código</li><li>Receber notificações e responder a mensagens</li><li>Consultar e descarregar documentos</li></>}
              {i > 0 && !r.admin && <li>Enviar mensagens a outras pessoas</li>}
              {r.admin && <><li>Aprovar contas e gerir utilizadores</li><li>Publicar documentos</li><li>Ver os emails enviados e o registo de ações</li></>}
            </ul>
          </div>
        ))}</div>
      </section>
      <section className="sect">
        <div className="sect-h"><h2>Perguntas frequentes</h2></div>
        <input className="inp" type="search" placeholder="Procurar na ajuda" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar na ajuda" style={{ marginBottom: 12 }} />
        {shown.map(([t, b]) => <details key={t} className="faq" open={!!q}><summary>{t}</summary><div className="fb">{b}</div></details>)}
        {!shown.length && <p className="pmeta">Nada encontrado.</p>}
      </section>
      {pub && <p className="pmeta">Precisas de ajuda com a tua conta? Fala com o {org}.</p>}
    </>
  );
}
