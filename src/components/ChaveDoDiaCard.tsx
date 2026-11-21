import { useState } from 'react';
import { chaveDoDia, chavesPorTema, temasDasChaves } from '../domain/chavesDoDia';
import { whatsappShare } from '../domain/content';
import { bibleLink } from '../domain/biblia';

/** Referência que abre o versículo na Bíblia online. */
function Ref({ r }: { r: string }) {
  const url = bibleLink(r);
  return url ? <a className="chave-ref" href={url} target="_blank" rel="noreferrer" aria-label={`Ler ${r} na Bíblia`}>📖 {r}</a> : <>{r}</>;
}

/** Cartão "Chave do dia" (Mente): frase em destaque, referência por baixo e leitura por tema. */
export function ChaveDoDiaCard() {
  const c = chaveDoDia();
  const [aberto, setAberto] = useState(false);
  const [tema, setTema] = useState<string | null>(null);
  return (
    <section className="card chave-card">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🔑 Chave do dia</p>
      <p className="chave-texto">{c.texto}</p>
      <p className="small" style={{ margin: 0 }}><Ref r={c.referencia} /></p>
      <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginTop: 10 }}>
        <button className="link small inline" aria-expanded={aberto} onClick={() => { setAberto(!aberto); setTema(null); }}>{aberto ? 'Fechar temas' : 'Ver por tema'}</button>
        <a className="link small inline" href={whatsappShare(`${c.texto} — ${c.referencia}`)} target="_blank" rel="noreferrer">Partilhar no WhatsApp</a>
      </div>
      {aberto && (
        <div style={{ marginTop: 10 }}>
          <div className="chips" role="group" aria-label="Temas">
            {temasDasChaves().map((t) => (
              <button key={t} className={`chip sm ${tema === t ? 'on' : ''}`} aria-pressed={tema === t} onClick={() => setTema(tema === t ? null : t)}>{t}</button>
            ))}
          </div>
          {tema && (
            <ul className="chave-lista">
              {chavesPorTema(tema).map((x) => (
                <li key={x.id}>
                  <p style={{ margin: 0 }}>{x.texto}</p>
                  <p className="small" style={{ margin: '2px 0 0' }}><Ref r={x.referencia} /></p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
