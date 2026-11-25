import { useEffect, useRef, useState } from 'react';
import { breathPhase, type Technique } from '../domain/mind';
import { speak, stopSpeaking, ttsSupported, voiceLang } from '../domain/voice';
import { useStore } from '../state/store';

/** Sessão de respiração guiada: círculo que cresce e encolhe, contagem e voz opcional. */
export function BreathSession({ tech, minutes, onEnd }: { tech: Technique; minutes: number; onEnd: (done: number) => void }) {
  const { S } = useStore();
  const [t, setT] = useState(0);
  const [voice, setVoice] = useState(false);
  const total = minutes * 60;
  const last = useRef('');
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setT(Math.min(total, (Date.now() - start) / 1000)), 200);
    return () => {
      window.clearInterval(id);
      stopSpeaking();
    };
  }, [total]);
  const ph = breathPhase(tech, t);
  // cada mudança de fase: vibração curta e, se ligada, a voz
  const cycleLen = tech.steps.reduce((x, [, n]) => x + n, 0);
  const key = `${Math.floor(t / cycleLen)}-${ph.name}-${ph.n}`;
  useEffect(() => {
    if (key === last.current) return;
    last.current = key;
    try {
      navigator.vibrate?.(40);
    } catch {
      /* sem vibração */
    }
    if (voice) speak(ph.name, voiceLang(S));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (t >= total) onEnd(minutes);
  }, [t >= total]); // eslint-disable-line react-hooks/exhaustive-deps
  const left = Math.max(0, Math.ceil(total - t));
  return (
    <div className="breath-overlay" role="dialog" aria-label="Respiração guiada">
      <p className="small" style={{ opacity: 0.8 }}>{tech.name}</p>
      <div className={`breath-circle ${ph.big ? 'grow' : 'shrink'}`} style={{ transitionDuration: `${ph.n}s` }}>
        <span>{ph.name}</span>
        <b>{ph.left}</b>
      </div>
      <p className="small" style={{ opacity: 0.8 }}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        {ttsSupported() && <button className="btn ghost sm" onClick={() => setVoice(!voice)}>{voice ? '🔊 Voz ligada' : '🔈 Guiar com voz'}</button>}
        <button className="btn ghost sm" onClick={() => onEnd(Math.round((t / 60) * 10) / 10)}>Terminar</button>
      </div>
    </div>
  );
}

