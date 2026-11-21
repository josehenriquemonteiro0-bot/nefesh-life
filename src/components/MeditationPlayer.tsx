import { useEffect, useRef, useState } from 'react';
import { playAmbient, type AmbientPlayer } from '../domain/ambient';
import { estimateSeconds, type Ambient, type Meditation } from '../domain/meditations';
import { keepScreenOn, speak, stopSpeaking, ttsSupported, voiceLang } from '../domain/voice';
import { useStore } from '../state/store';

const AMBIENTS: [Ambient, string][] = [
  ['chuva', '🌧️ Chuva'],
  ['mar', '🌊 Mar'],
  ['tom', '🎵 Tom'],
  ['nenhum', '🔇 Sem som'],
];
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Leitor de meditação: a voz do telemóvel lê cada frase devagar e espera a pausa (ou toca a
 * gravação real, quando a sessão a tiver), com som de fundo, legenda e o tempo que falta.
 */
export function MeditationPlayer({ m, onEnd }: { m: Meditation; onEnd: (minutes: number) => void }) {
  const { S } = useStore();
  const lang = voiceLang(S);
  const total = estimateSeconds(m);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [ambient, setAmbient] = useState<Ambient>(m.ambient);
  const [vol, setVol] = useState(0.5);
  const amb = useRef<AmbientPlayer | null>(null);
  const timer = useRef(0);
  const audio = useRef<HTMLAudioElement>(null);
  const live = useRef({ paused: false, step: 0, done: false });
  const useVoice = !m.audio;

  // relógio da sessão
  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      if (!live.current.paused) setElapsed((e) => e + 0.5);
    }, 500);
    return () => window.clearInterval(id);
  }, [started]);

  const cleanup = () => {
    window.clearTimeout(timer.current);
    stopSpeaking();
    amb.current?.stop();
    amb.current = null;
    keepScreenOn(false);
  };
  useEffect(() => cleanup, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (complete: boolean) => {
    if (live.current.done) return;
    live.current.done = true;
    cleanup();
    const secs = m.audio && audio.current ? audio.current.currentTime : elapsed;
    onEnd(complete ? m.minutes : Math.round((secs / 60) * 10) / 10);
  };

  /** Diz o passo i e, no fim da frase, espera a pausa e segue para o seguinte. */
  const run = (i: number) => {
    live.current.step = i;
    setStep(i);
    if (i >= m.steps.length) return finish(true);
    const [text, pause] = m.steps[i];
    const next = () => {
      if (live.current.paused || live.current.done) return;
      timer.current = window.setTimeout(() => run(i + 1), pause * 1000);
    };
    if (ttsSupported()) speak(text, lang, next, 0.86);
    else timer.current = window.setTimeout(next, (text.split(/\s+/).length / 2.2) * 1000);
  };

  const start = () => {
    setStarted(true);
    keepScreenOn(true);
    amb.current = playAmbient(ambient, vol);
    if (useVoice) run(0);
    else audio.current?.play().catch(() => {});
  };

  const togglePause = () => {
    const p = !paused;
    setPaused(p);
    live.current.paused = p;
    if (useVoice) {
      if (p) {
        window.clearTimeout(timer.current);
        stopSpeaking();
      } else run(live.current.step);
    } else if (audio.current) {
      if (p) audio.current.pause();
      else audio.current.play().catch(() => {});
    }
  };

  const changeAmbient = (a: Ambient) => {
    setAmbient(a);
    amb.current?.stop();
    amb.current = started ? playAmbient(a, vol) : null;
  };

  const left = Math.max(0, total - elapsed);
  return (
    <div className="breath-overlay med-overlay" role="dialog" aria-label={`Meditação: ${m.title}`}>
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>{m.title}</p>
      <div className={`breath-circle med-circle ${started && !paused ? 'pulse' : ''}`}>
        <b>{started ? mmss(m.audio && audio.current ? Math.max(0, (audio.current.duration || total) - audio.current.currentTime) : left) : `${m.minutes} min`}</b>
      </div>
      <p className="med-caption">{started ? (useVoice ? m.steps[Math.min(step, m.steps.length - 1)][0] : 'A ouvir…') : m.desc}</p>
      {m.audio && <audio ref={audio} src={m.audio} preload="auto" onEnded={() => finish(true)} />}
      {!started ? (
        <button className="btn" onClick={start}>▶ Começar</button>
      ) : (
        <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
          <button className="btn ghost sm" onClick={togglePause}>{paused ? '▶ Retomar' : '⏸ Pausa'}</button>
          <button className="btn ghost sm" onClick={() => finish(false)}>Terminar</button>
        </div>
      )}
      <div className="chips" style={{ justifyContent: 'center' }} role="group" aria-label="Som de fundo">
        {AMBIENTS.map(([k, t]) => (
          <button key={k} className={`chip sm ${ambient === k ? 'on' : ''}`} aria-pressed={ambient === k} onClick={() => changeAmbient(k)}>{t}</button>
        ))}
      </div>
      {ambient !== 'nenhum' && (
        <label className="small med-vol">
          Volume do fundo
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); amb.current?.setVolume(v); }} />
        </label>
      )}
      {!started && !ttsSupported() && useVoice && <p className="small" style={{ opacity: 0.8 }}>Este telemóvel não lê em voz alta: siga o texto no ecrã.</p>}
      {!started && <button className="link small inline" onClick={() => finish(false)}>Fechar</button>}
    </div>
  );
}
