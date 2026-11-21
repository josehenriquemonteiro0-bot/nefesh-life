import { useEffect, useRef, useState } from 'react';
import { longToday, shortDate } from '../domain/dates';
import { MOODS, MOOD_LABEL, STRESS_LABEL, TECHNIQUES, breathPhase, gratitudeLog, logBreath, moodInsights, needsSupport, takeBreathRequest, techniqueOf, type Technique } from '../domain/mind';
import { speak, stopSpeaking, ttsSupported, voiceLang } from '../domain/voice';
import { useStore } from '../state/store';
import { MeditationLibrary } from '../components/MeditationLibrary';
import { ChaveDoDiaCard } from '../components/ChaveDoDiaCard';
import type { Nav } from '../App';

/** Sessão de respiração guiada: círculo que cresce e encolhe, contagem e voz opcional. */
function BreathSession({ tech, minutes, onEnd }: { tech: Technique; minutes: number; onEnd: (done: number) => void }) {
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

export function Mind({ go }: { go: Nav }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const [tech, setTech] = useState<Technique['id']>('coerencia');
  const [min, setMin] = useState(3);
  const [running, setRunning] = useState(false);
  const [grat, setGrat] = useState<string[]>(() => [...(l.grat ?? []), '', '', ''].slice(0, 3));
  const insights = moodInsights(S);
  const support = needsSupport(S);
  const log = gratitudeLog(S).filter((x) => x.items.length);

  // pedido do Coach para uma pausa
  useEffect(() => {
    const m = takeBreathRequest();
    if (m) {
      setMin(Math.max(2, Math.min(5, Math.round(m))));
      setRunning(true);
    }
  }, []);

  const finish = (done: number) => {
    setRunning(false);
    if (done >= 1) {
      updateToday((d) => logBreath(d, done));
      toast(`Pausa feita: ${done >= 2 ? Math.round(done) : done} min. O hábito "respiração" ficou marcado. 🌿`);
    }
  };

  return (
    <>
      {running && <BreathSession tech={techniqueOf(tech)} minutes={min} onEnd={finish} />}
      <h1>Mente</h1>
      <ChaveDoDiaCard />
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>{longToday()}</p>
        <h2 style={{ margin: '4px 0 8px' }}>Como está o seu humor?</h2>
        <div className="mood-row" role="group" aria-label="Humor">
          {MOODS.map((e, i) => (
            <button key={i} className={`mood ${l.d === i + 1 ? 'on' : ''}`} aria-pressed={l.d === i + 1} aria-label={MOOD_LABEL[i]} onClick={() => updateToday((d) => { d.d = i + 1; })}>
              {e}
            </button>
          ))}
        </div>
        <p className="small" style={{ margin: '12px 0 6px', opacity: 0.85 }}>E o stress?</p>
        <div className="chips" role="group" aria-label="Stress">
          {STRESS_LABEL.map((t, i) => (
            <button key={t} className={`chip sm ${l.stress === i + 1 ? 'on' : ''}`} aria-pressed={l.stress === i + 1} onClick={() => updateToday((d) => { d.stress = i + 1; })}>{t}</button>
          ))}
        </div>
      </section>

      {support && (
        <section className="card warn-card">
          <p className="small" style={{ margin: 0 }}>
            Nos últimos dias tem-se sentido em baixo ou muito stressado. Falar com alguém ajuda: um amigo, o médico de família ou um psicólogo.
            Em Portugal, SNS 24 (808 24 24 24, opção 4) e SOS Voz Amiga; no Brasil, CVV 188. Em perigo, ligue 112 / 192.
          </p>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => go('pros')}>Ver profissionais</button>
        </section>
      )}

      <MeditationLibrary />

      <section className="card" data-tour="respirar">
        <div className="row">
          <h2 style={{ margin: 0 }}>Respiração guiada</h2>
          {(l.breath ?? 0) > 0 && <span className="small neon">hoje: {l.breath} min ✓</span>}
        </div>
        <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Técnica">
          {TECHNIQUES.map((x) => (
            <button key={x.id} className={`chip sm ${tech === x.id ? 'on' : ''}`} aria-pressed={tech === x.id} onClick={() => setTech(x.id)}>{x.name}</button>
          ))}
        </div>
        <p className="small mute" style={{ margin: '8px 0' }}>{techniqueOf(tech).text}</p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          {[2, 3, 5].map((m) => (
            <button key={m} className={`chip sm ${min === m ? 'on' : ''}`} aria-pressed={min === m} onClick={() => setMin(m)}>{m} min</button>
          ))}
          <button className="btn sm" onClick={() => setRunning(true)}>Começar</button>
        </div>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Diário de gratidão</h2>
        <p className="small mute" style={{ marginTop: 0 }}>Três coisas boas de hoje, por pequenas que sejam.</p>
        {grat.map((g, i) => (
          <input key={i} className="field sm" style={{ marginBottom: 6, width: '100%', boxSizing: 'border-box' }} value={g} maxLength={140} placeholder={['ex.: o café com a minha irmã', 'ex.: terminei o treino', 'ex.: o sol ao fim da tarde'][i]} aria-label={`Gratidão ${i + 1}`} onChange={(e) => setGrat(grat.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <button
          className="btn sm"
          disabled={!grat.some((g) => g.trim())}
          onClick={() => {
            updateToday((d) => { d.grat = grat.map((g) => g.trim()).filter(Boolean); });
            toast('Guardado no seu diário. 💚');
          }}
        >
          Guardar
        </button>
        {log.filter((x) => x.day !== log[0]?.day || !l.grat).length > 0 && (
          <details className="small" style={{ marginTop: 10 }}>
            <summary>Dias anteriores</summary>
            {log.map((x) => (
              <p key={x.day} style={{ margin: '6px 0 0' }}><b>{shortDate(x.day)}:</b> {x.items.join(' · ')}</p>
            ))}
          </details>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>O que a app percebeu</h2>
        {insights.length ? (
          insights.slice(0, 3).map((x) => <p key={x.text} className="small" style={{ margin: '0 0 6px' }}>• {x.text}</p>)
        ) : (
          <p className="small mute" style={{ margin: 0 }}>Registe o humor durante uma ou duas semanas: a app mostra o que mais o ajuda (sono, movimento, respiração).</p>
        )}
        <p className="small mute" style={{ margin: '6px 0 0' }}>Também pode pedir ao NEFESH Voice Assistant: "estou stressado, ajuda-me a fazer uma pausa".</p>
      </section>
    </>
  );
}
