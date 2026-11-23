import { useEffect, useState } from 'react';
import { proApi } from '../domain/pro';
import { useStore } from '../state/store';

export interface DirEntry { name: string; kind: string; reg: string; city: string; online: boolean; areas: string; bio: string; contact: string }
const KIND: Record<string, string> = { personal: 'Personal trainer', nutricionista: 'Nutricionista', medico: 'Médico(a)', outro: 'Profissional de saúde' };

/** Link de contacto: https, e-mail ou WhatsApp (telefone). */
export function contactHref(c: string, msg = '') {
  if (/^https:\/\//i.test(c)) return c;
  if (c.includes('@')) return `mailto:${c}${msg ? `?subject=${encodeURIComponent('Acompanhamento NEFESH')}&body=${encodeURIComponent(msg)}` : ''}`;
  return `https://wa.me/${c.replace(/[^\d]/g, '')}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
}

/** Profissional: aparecer (ou não) no diretório NEFESH, com cidade, online, áreas e contacto. */
export function DirectoryEditor() {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(false);
  const [f, setF] = useState({ city: '', online: true, areas: '', bio: '', contact: '' });
  const [err, setErr] = useState('');
  useEffect(() => { proApi<{ entry: Omit<DirEntry, 'name' | 'kind' | 'reg'> | null }>('diretorio').then((r) => { if (r.entry) { setOn(true); setF(r.entry); } }).catch(() => undefined); }, []);
  const save = (next: boolean) => proApi<{ entry: unknown }>('diretorio/guardar', { on: next, ...f })
    .then(() => { setOn(next); setErr(''); toast(next ? 'Está no diretório NEFESH.' : 'Saiu do diretório.'); if (!next) setOpen(false); })
    .catch((e) => setErr((e as Error).message));
  return (
    <section className="card">
      <div className="row"><h2 style={{ margin: 0 }}>Diretório NEFESH</h2><span className={`small ${on ? 'neon' : 'mute'}`}>{on ? '✓ visível' : 'não aparece'}</span></div>
      <p className="small mute" style={{ margin: '4px 0 8px' }}>Os utilizadores da NEFESH Life encontram profissionais verificados em Início → Profissionais e contactam-no diretamente.</p>
      {!open ? <button className="btn ghost sm" onClick={() => setOpen(true)}>{on ? 'Editar o meu perfil' : 'Aparecer no diretório'}</button> : (
        <>
          <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
            <label className="small">Cidade<input className="field sm" maxLength={60} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="ex.: Lisboa" /></label>
            <label className="small">Contacto<input className="field sm" maxLength={200} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="WhatsApp, e-mail ou site" /></label>
          </div>
          <label className="small" style={{ display: 'block', marginTop: 8 }}>Áreas<input className="field sm" style={{ width: '100%' }} maxLength={160} value={f.areas} onChange={(e) => setF({ ...f, areas: e.target.value })} placeholder="ex.: emagrecimento, diabetes, desporto, vegetarianos" /></label>
          <label className="small" style={{ display: 'block', marginTop: 8 }}>Sobre si<textarea className="field" rows={2} maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="Uma ou duas frases sobre como trabalha" /></label>
          <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={f.online} onChange={(e) => setF({ ...f, online: e.target.checked })} /><span className="small">Também faço acompanhamento online</span></label>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
            <button className="btn sm" onClick={() => save(true)}>{on ? 'Guardar' : 'Aparecer no diretório'}</button>
            {on && <button className="btn ghost sm" onClick={() => save(false)}>Sair do diretório</button>}
            <button className="link small inline" onClick={() => setOpen(false)}>Fechar</button>
          </div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>O nome, a área e o registo profissional aparecem como verificados pela equipa NEFESH.</p>
        </>
      )}
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}

/** Utilizador: profissionais verificados, com filtro por área e contacto direto. */
export function DirectoryList() {
  const { S } = useStore();
  const [list, setList] = useState<DirEntry[] | null>(null);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => { proApi<{ list: DirEntry[] }>('diretorio/lista').then((r) => setList(r.list)).catch(() => setList([])); }, []);
  if (!list?.length) return null;
  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const shown = list.filter((x) => (!kind || x.kind === kind) && (!q.trim() || norm(`${x.name} ${x.city} ${x.areas}`).includes(norm(q.trim()))));
  const kinds = [...new Set(list.map((x) => x.kind))];
  return (
    <>
      <h2 style={{ marginTop: 18 }}>Profissionais verificados</h2>
      <p className="small mute" style={{ marginTop: 0 }}>Registo profissional confirmado pela equipa NEFESH. Todos acompanham pela NEFESH Life Pro: o plano entra na sua app.</p>
      <div className="chips" style={{ marginBottom: 8 }}>
        <button className={`chip sm ${!kind ? 'on' : ''}`} onClick={() => setKind('')}>Todos</button>
        {kinds.map((k) => <button key={k} className={`chip sm ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{KIND[k] ?? k}</button>)}
      </div>
      <input className="field sm" style={{ width: '100%', marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por cidade ou área (ex.: Porto, diabetes)" aria-label="Procurar profissionais" />
      {shown.map((x) => (
        <section className="card pro" key={`${x.name}${x.reg}`}>
          <div className="av">{x.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
          <div>
            <h2 style={{ margin: '0 0 2px' }}>{x.name} <span className="small neon">✓</span></h2>
            <p className="small" style={{ margin: '0 0 4px' }}>{KIND[x.kind] ?? x.kind} · {x.reg}</p>
            <p className="small mute" style={{ margin: '0 0 4px' }}>{[x.city, x.online ? 'online' : ''].filter(Boolean).join(' · ')}{x.areas ? ` · ${x.areas}` : ''}</p>
            {x.bio && <p className="small" style={{ margin: '0 0 6px' }}>{x.bio}</p>}
            <a className="btn sm" href={contactHref(x.contact, `Olá ${x.name}! Encontrei-o(a) no diretório da NEFESH Life e gostava de saber como funciona o acompanhamento${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)} target="_blank" rel="noopener noreferrer">Contactar</a>
          </div>
        </section>
      ))}
      {!shown.length && <p className="small mute">Nenhum profissional com estes filtros.</p>}
    </>
  );
}
