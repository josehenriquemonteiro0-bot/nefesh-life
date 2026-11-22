import { useEffect, useState } from 'react';
import { embedUrl, libraryVideo, loadVideos } from '../domain/exVideos';
import { ROUTINES, animFor } from '../domain/exerciseAnims';
import type { PhotoError } from '../domain/photo';
import { fetchTip, tipKey, videoSearchUrl } from '../domain/tips';
import { useStore } from '../state/store';
import { ExerciseAnim, RoutineAnim } from './ExerciseAnim';

/** "Como fazer": animação (se houver), dicas da IA (guardadas) e vídeos no YouTube. */
export function ExerciseHelp({ name, notes, video }: { name: string; notes?: string; video?: string }) {
  const { S, update } = useStore();
  const routine = ROUTINES[name];
  const anim = routine ? null : animFor(name, notes);
  const tip = S.exerciseTips?.[tipKey(name)];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setV] = useState(0);
  const [player, setPlayer] = useState<string | null>(null);
  useEffect(() => { loadVideos().then(() => setV((x) => x + 1)); }, []);
  const proVideo = video && /^https:\/\//.test(video) ? video : undefined;
  const demo = proVideo ?? libraryVideo(name);
  const play = (url: string) => { const e = embedUrl(url); if (e) setPlayer(e); else window.open(url, '_blank', 'noopener'); };

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
      {routine && <RoutineAnim steps={routine} />}
      {anim && <ExerciseAnim id={anim} />}
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn ghost sm" onClick={() => (open && tip ? setOpen(false) : load())} disabled={busy}>
          {busy ? 'A preparar dicas…' : open && tip ? 'Fechar dicas' : 'Como fazer'}
        </button>
        {demo && <button className="btn sm" onClick={() => play(demo)}>{proVideo ? '▶ Vídeo do personal' : '▶ Ver demonstração'}</button>}
        <a className="btn ghost sm" href={videoSearchUrl(name)} target="_blank" rel="noopener">{demo ? 'Outros vídeos ↗' : 'Ver vídeos ↗'}</a>
      </div>
      {player && (
        <div className="video-player">
          <iframe src={player} title={`Vídeo: ${name}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          <div className="row" style={{ marginTop: 6 }}>
            <span className="small mute">{proVideo ? 'Vídeo escolhido pelo seu personal' : 'Demonstração NEFESH'}</span>
            <button className="link small inline" onClick={() => setPlayer(null)}>Fechar vídeo</button>
          </div>
        </div>
      )}
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
