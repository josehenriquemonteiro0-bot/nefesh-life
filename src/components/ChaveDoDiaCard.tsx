import { useEffect, useRef, useState } from 'react';
import { chaveDoDia, chavesPorTema, temasDasChaves } from '../domain/chavesDoDia';
import { whatsappShare } from '../domain/content';
import { bibleLink } from '../domain/biblia';
import { drawChaveCard, shareImage } from '../domain/shareCard';
import { useStore } from '../state/store';

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
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  const link = `${location.origin}${import.meta.env.BASE_URL}`;
  const legenda = `🔑 Chave do dia: “${c.texto}” (${c.referencia})\n\nUma chave nova todos os dias na NEFESH Life 🌿 ${link}`;
  // a imagem fica pronta antes do toque: o iPhone só abre a partilha logo a seguir ao toque
  const img = useRef<Promise<Blob> | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      img.current = drawChaveCard({ texto: c.texto, referencia: c.referencia });
      img.current.catch(() => (img.current = null));
    }, 600);
    return () => window.clearTimeout(id);
  }, [c.texto, c.referencia, link]);
  const instagram = async () => {
    setBusy(true);
    // o Instagram não leva o texto: a legenda fica copiada para colar
    navigator.clipboard?.writeText(legenda).catch(() => undefined);
    try {
      const blob = await (img.current ?? drawChaveCard({ texto: c.texto, referencia: c.referencia }));
      const r = await shareImage(blob, legenda, 'nefesh-chave-do-dia.png');
      if (r === 'partilhado') toast('Partilhado. Obrigado por espalhar a chave! 🌿');
      else if (r === 'descarregado') toast('Imagem guardada. Publique-a no Instagram (história ou publicação); a legenda está copiada.');
    } catch {
      toast('Não foi possível criar a imagem. Tente outra vez.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card chave-card">
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🔑 Chave do dia</p>
      <p className="chave-texto">{c.texto}</p>
      <p className="small" style={{ margin: 0 }}><Ref r={c.referencia} /></p>
      <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginTop: 10 }}>
        <button className="link small inline" aria-expanded={aberto} onClick={() => { setAberto(!aberto); setTema(null); }}>{aberto ? 'Fechar temas' : 'Ver por tema'}</button>
        <a className="link small inline" href={whatsappShare(`${c.texto} — ${c.referencia}`)} target="_blank" rel="noreferrer">Partilhar no WhatsApp</a>
        <button className="link small inline" disabled={busy} onClick={instagram}>{busy ? 'A criar a imagem…' : 'Partilhar no Instagram'}</button>
      </div>
      <p className="small mute" style={{ margin: '6px 0 0' }}>Instagram: escolha história ou publicação; a legenda fica copiada para colar.</p>
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
