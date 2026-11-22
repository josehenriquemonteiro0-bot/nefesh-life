import { useState } from 'react';
import { animFor } from '../domain/exerciseAnims';
import type { PhotoError } from '../domain/photo';
import { fetchTip, tipKey, videoSearchUrl } from '../domain/tips';
import { useStore } from '../state/store';
import { ExerciseAnim } from './ExerciseAnim';

/** "Como fazer": animação (se houver), dicas da IA (guardadas) e vídeos no YouTube. */
export function ExerciseHelp({ name, notes, video }: { name: string; notes?: string; video?: string }) {
  const { S, update } = useStore();
  const anim = animFor(name);
  const tip = S.exerciseTips?.[tipKey(name)];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setOpen(true);
    if (tip) return;
    setBusy(true);
    setError(null);
    try {
      const t = await fetchTip(name, notes);
      update((d) => { d.exerciseTips = { ...(d.exerciseTips || {}), [tipKey(name)]: t }; });
    } catch (e) {
      setError((e as PhotoError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="exhelp">
      {anim && <ExerciseAnim id={anim} />}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={() => (open && tip ? setOpen(false) : load())} disabled={busy}>
          {busy ? 'A preparar dicas…' : open && tip ? 'Fechar dicas' : 'Como fazer'}
        </button>
        {video && /^https:\/\//.test(video) && <a className="btn sm" href={video} target="_blank" rel="noopener noreferrer">▶ Vídeo do personal</a>}
        <a className="btn ghost sm" href={videoSearchUrl(name)} target="_blank" rel="noopener">{video ? 'Outros vídeos ↗' : 'Ver vídeos ↗'}</a>
      </div>
      {error && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{error}</p>}
      {open && tip && (
        <div className="tipbox small">
          <ol>{tip.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          <p><b>Evite:</b> {tip.mistakes.join(' · ')}</p>
          <p><b>Respiração:</b> {tip.breathing}</p>
          <p><b>Trabalha:</b> {tip.muscles}</p>
          <p className="warn-t">{tip.safety}</p>
          <p className="mute">Dicas gerais geradas por IA. Siga sempre as indicações do seu personal.</p>
        </div>
      )}
    </div>
  );
}
