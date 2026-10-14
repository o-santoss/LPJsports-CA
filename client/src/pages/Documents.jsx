import React, { useEffect, useMemo, useState } from 'react';
import { get, post, put, del } from '../lib/api.js';
import { fdate, fsize, norm, plural } from '../lib/fmt.js';
import { useApp } from '../App.jsx';
import { useUI, Icon, Chip, Empty, Field, useBusy } from '../ui/kit.jsx';

export default function Documents() {
  const { isAdmin, config, refresh } = useApp();
  const ui = useUI();
  const [docs, setDocs] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [fresh, setFresh] = useState([]);
  const load = () => get('/api/documents').then((r) => { setDocs(r.documents); setFresh((f) => (f.length ? f : r.documents.filter((d) => !d.seen).map((d) => d.id))); }).catch((e) => { ui.toast(e.message); setDocs([]); });
  useEffect(() => { load(); }, []);

  const audLabel = (a) => (a === 'all' ? '' : `A partir de: ${config.roles.find((r) => r.key === a)?.label || a}`);
  const cats = config.docCats.filter((c) => docs?.some((d) => d.cat === c));
  const shown = useMemo(() => (docs || []).filter((d) => (cat === 'all' || d.cat === cat) && (!q || norm(`${d.title} ${d.descr} ${d.cat}`).includes(norm(q)))), [docs, q, cat]);

  const markSeen = async (d) => {
    if (d.kind === 'link') await post(`/api/documents/${d.id}/seen`).catch(() => {});
    setDocs((l) => l.map((x) => (x.id === d.id ? { ...x, seen: true } : x)));
    setTimeout(refresh, 800);
  };
  const edit = (d) => ui.openModal(d ? 'Editar documento' : 'Publicar documento', (close) => <DocForm doc={d} close={close} onSaved={load} />);
  const remove = (d) => ui.confirm('Remover documento', `Remover "${d.title}"? Deixa de estar disponível para todos.`, 'Remover', async () => {
    try { await del(`/api/documents/${d.id}`); ui.toast('Documento removido.'); load(); } catch (e) { ui.toast(e.message); }
  });

  return (
    <>
      <header className="ph row between">
        <div><h1>Documentos</h1><p className="sub">Regulamentos, regras, tabelas e circulares do {config.org}.</p></div>
        {isAdmin && <button className="btn" onClick={() => edit(null)}><Icon name="plus" /> Publicar documento</button>}
      </header>
      <input className="inp" type="search" placeholder="Procurar nos documentos" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Procurar documentos" style={{ marginBottom: 12 }} />
      <div className="row filters">
        <button className={`fchip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Todos <span>{docs?.length || 0}</span></button>
        {cats.map((c) => <button key={c} className={`fchip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} <span>{docs.filter((d) => d.cat === c).length}</span></button>)}
      </div>
      {!docs ? <p className="pmeta">A carregar…</p> : shown.length ? shown.map((d) => (
        <article key={d.id} className="doc">
          <div className="dico" aria-hidden="true">{String(d.ext || 'DOC').slice(0, 4)}</div>
          <div className="pmain">
            <div className="row between"><span className="pname">{d.title}</span><span className="row tight">{fresh.includes(d.id) && <Chip kind="info">Novo</Chip>}{d.aud !== 'all' && <Chip>{audLabel(d.aud)}</Chip>}</span></div>
            <span className="pmeta">{[d.cat, d.kind === 'link' ? 'Link externo' : d.ext, fsize(d.size)].filter(Boolean).join(' · ')}</span>
            {d.descr && <p className="ddesc">{d.descr}</p>}
            <span className="pmeta">{d.ver ? `Versão de ${fdate(d.ver)} · ` : ''}Publicado a {fdate(d.at)}{d.by ? ` por ${d.by}` : ''}{isAdmin ? ` · ${plural(d.views, 'pessoa viu', 'pessoas viram')}` : ''}</span>
            <div className="pact">
              {d.kind === 'link'
                ? <a className="btn sm" href={d.url} target="_blank" rel="noopener noreferrer" onClick={() => markSeen(d)}><Icon name="ext" /> Abrir no site</a>
                : <a className="btn sm" href={`/api/documents/${d.id}/file`} download onClick={() => markSeen(d)}><Icon name="download" /> Descarregar</a>}
              {isAdmin && <><button className="btn sm ghost" onClick={() => edit(d)}>Editar</button><button className="btn sm danger" onClick={() => remove(d)}>Remover</button></>}
            </div>
          </div>
        </article>
      )) : <Empty>{q ? 'Nenhum documento corresponde à pesquisa.' : 'Ainda não há documentos.'}</Empty>}
    </>
  );
}

function DocForm({ doc, close, onSaved }) {
  const { config } = useApp();
  const ui = useUI();
  const [f, setF] = useState({ title: doc?.title || '', cat: doc?.cat || config.docCats[0], descr: doc?.descr || '', ver: doc?.ver || '', kind: doc?.kind || 'file', url: doc?.url || '', aud: doc?.aud || 'all', notify: !doc });
  const [file, setFile] = useState(null);
  const [busy, run] = useBusy();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => run(async () => {
    try {
      const body = { ...f };
      if (f.kind === 'file' && file) {
        if (file.size > 15 * 1048576) return ui.toast('O ficheiro tem mais de 15 MB.');
        const upload = await post('/api/documents/upload', { name: file.name, size: file.size });
        const result = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!result.ok) throw new Error('Não foi possível enviar o ficheiro.');
        body.file = { name: file.name, receipt: upload.receipt };
      }
      if (doc) await put(`/api/documents/${doc.id}`, body); else await post('/api/documents', body);
      ui.toast(doc ? 'Documento atualizado.' : 'Documento publicado.');
      close();
      onSaved();
    } catch (e) { ui.toast(e.message); }
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Field label="Título" id="dc-t"><input className="inp" id="dc-t" value={f.title} onChange={set('title')} required /></Field>
      <div className="grid2">
        <Field label="Categoria" id="dc-c"><select className="inp" id="dc-c" value={f.cat} onChange={set('cat')}>{config.docCats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Data da versão (opcional)" id="dc-v"><input className="inp" id="dc-v" type="date" value={f.ver} onChange={set('ver')} /></Field>
      </div>
      <Field label="Descrição (opcional)" id="dc-d"><textarea className="inp" id="dc-d" rows={3} value={f.descr} onChange={set('descr')} /></Field>
      <fieldset className="fs"><legend className="lbl">Tipo</legend><div className="row">
        <label className="ck"><input type="radio" name="kind" value="file" checked={f.kind === 'file'} onChange={set('kind')} /> Ficheiro</label>
        <label className="ck"><input type="radio" name="kind" value="link" checked={f.kind === 'link'} onChange={set('kind')} /> Link para outro site</label>
      </div></fieldset>
      {f.kind === 'file'
        ? <Field label={doc?.kind === 'file' ? `Substituir ficheiro (atual: ${doc.fname})` : 'Ficheiro'} id="dc-f" hint={`Aceites: ${config.docExt.join(', ')} · até 15 MB`}><input className="inp" id="dc-f" type="file" accept={config.docExt.map((x) => '.' + x).join(',')} onChange={(e) => setFile(e.target.files[0] || null)} /></Field>
        : <Field label="Endereço (https://…)" id="dc-u"><input className="inp" id="dc-u" type="url" value={f.url} onChange={set('url')} placeholder="https://" /></Field>}
      <Field label="Quem pode ver" id="dc-a">
        <select className="inp" id="dc-a" value={f.aud} onChange={set('aud')}>
          <option value="all">Todos</option>
          {config.roles.slice(1).map((r) => <option key={r.key} value={r.key}>A partir de: {r.label}</option>)}
        </select>
      </Field>
      {!doc && <label className="sw"><input type="checkbox" checked={f.notify} onChange={set('notify')} /> Avisar quem pode ver o documento (notificação e email)</label>}
      <div className="row end mt"><button type="button" className="btn ghost" onClick={close}>Cancelar</button><button className="btn" disabled={busy}>{busy ? 'A enviar…' : doc ? 'Guardar' : 'Publicar'}</button></div>
    </form>
  );
}
