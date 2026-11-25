import { useEffect, useRef, useState } from 'react';
import { playAmbient, type AmbientPlayer } from '../../domain/ambient';
import { TECHNIQUES, type Technique } from '../../domain/mind';
import { meditationById, type Ambient } from '../../domain/meditations';
import { RITUAL_PREP, markRitual } from '../../domain/sleep';
import { canAccess } from '../../domain/features';
import { keepScreenOn } from '../../domain/voice';
import { useStore } from '../../state/store';
import { usePractice } from './usePractice';

/** Pedido para abrir o ritual ao entrar no ecrã do sono (vindo do Início). */
let pending = false;
export const requestRitual = () => { pending = true; };
export const takeRitualRequest = () => { const p = pending; pending = false; return p; };

const SOUNDS: [Ambient, string][] = [['chuva', '🌧️ Chuva'], ['mar', '🌊 Mar'], ['tom', '🎶 Tom suave'], ['nenhum', '🔇 Silêncio']];
const RELAX = ['pmr', 'bodyscan', 'baralhar', 'nidra'];

/** Som para adormecer com temporizador: nos últimos 5 minutos baixa aos poucos e depois pára sozinho. */
function SleepSound({ kind, minutes, onDone }: { kind: Ambient; minutes: number; onDone: () => void }) {
  const [left, setLeft] = useState(minutes * 60);
  const player = useRef<AmbientPlayer | null>(null);
  useEffect(() => {
    const end = Date.now() + minutes * 60_000;
    const vol0 = 0.5;
    player.current = playAmbient(kind, vol0);
    // o ecrã fica ligado (escuro) para o temporizador correr até ao fim; volta ao normal no fim
    keepScreenOn(true);
    let lastVol = vol0;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s <= 300) {
        // baixa por degraus (o iPhone não muda o volume de um som a tocar: refaz-se a faixa)
        const v = Math.round(vol0 * (s / 300) * 10) / 10;
        if (v !== lastVol) {
          lastVol = v;
          player.current?.setVolume(Math.max(0.02, v));
        }
      }
      if (s <= 0) {
        window.clearInterval(id);
        player.current?.stop();
        player.current = null;
        onDone();
      }
    }, 1000);
    return () => {
      window.clearInterval(id);
      player.current?.stop();
      player.current = null;
      keepScreenOn(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="breath-overlay" role="dialog" aria-label="Som para adormecer" style={{ background: '#05070d' }}>
      <p style={{ fontSize: 40, margin: 0 }}>🌙</p>
      <h2 style={{ margin: '8px 0' }}>Boa noite</h2>
      <p className="small" style={{ opacity: 0.7, maxWidth: 300, textAlign: 'center' }}>Deixe a app aberta e pouse o telemóvel de ecrã para baixo. O som baixa aos poucos e desliga-se sozinho.</p>
      <p className="small" style={{ opacity: 0.6 }}>{kind === 'nenhum' ? 'Em silêncio' : `Desliga-se em ${Math.ceil(left / 60)} min`}</p>
      <button className="btn ghost sm" onClick={onDone}>Parar</button>
    </div>
  );
}

/**
 * Ritual da noite (uma hora antes de deitar), em 4 passos:
 * preparar a casa · esvaziar a cabeça · acalmar (respiração ou relaxamento) · som para adormecer.
 */
export function SleepRitual({ onClose }: { onClose: () => void }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const [step, setStep] = useState(0);
  const [prep, setPrep] = useState<boolean[]>(RITUAL_PREP.map(() => false));
  const [worries, setWorries] = useState(l.nightDump?.worries ?? '');
  const [tomorrow, setTomorrow] = useState(l.nightDump?.tomorrow ?? '');
  const [sound, setSound] = useState<Ambient>('chuva');
  const [timer, setTimer] = useState(30);
  const [playing, setPlaying] = useState(false);
  const { start, node } = usePractice(() => setStep(3));
  const full = canAccess(S, 'meditacao');
  const save = () => updateToday((d) => markRitual(d, { worries, tomorrow }));
  const close = () => {
    if (step > 0) save();
    onClose();
  };
  const night = TECHNIQUES.filter((t) => t.night);
  const steps = ['Preparar', 'Esvaziar a cabeça', 'Acalmar', 'Adormecer'];

  if (playing) return <SleepSound kind={sound} minutes={timer} onDone={() => { setPlaying(false); onClose(); }} />;
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && close()}>
      {node}
      <div className="sheet paywall" role="dialog" aria-modal="true" aria-label="Ritual da noite">
        <button className="close" onClick={close} aria-label="Fechar">×</button>
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>🌙 Ritual da noite · passo {step + 1} de 4</p>
        <h2 style={{ margin: '4px 0 10px' }}>{steps[step]}</h2>
        <div className="dotsx" style={{ marginBottom: 12 }}>{steps.map((s, i) => <i key={s} className={i === step ? 'on' : ''} />)}</div>

        {step === 0 && (
          <>
            <p className="small mute" style={{ marginTop: 0 }}>A última hora antes de deitar é para abrandar. Marque o que já fez:</p>
            {RITUAL_PREP.map((t, i) => (
              <label key={t} className="small toggle-line" style={{ display: 'flex', margin: '8px 0' }}>
                <input type="checkbox" checked={prep[i]} onChange={(e) => setPrep(prep.map((x, j) => (j === i ? e.target.checked : x)))} />
                {t}
              </label>
            ))}
            <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={() => setStep(1)}>Seguinte</button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="small mute" style={{ marginTop: 0 }}>Tire da cabeça o que a pode manter acordada. Fica guardado só neste telemóvel.</p>
            <label className="small">O que me preocupa (e o que posso fazer amanhã)</label>
            <textarea className="field" rows={3} maxLength={1000} value={worries} onChange={(e) => setWorries(e.target.value)} placeholder="ex.: a reunião de amanhã → rever os slides às 9h" />
            <label className="small" style={{ display: 'block', marginTop: 10 }}>A minha lista para amanhã</label>
            <textarea className="field" rows={3} maxLength={1000} value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} placeholder="ex.: ligar ao médico, comprar fruta, treino às 18h" />
            <p className="small mute">Se as preocupações voltarem na cama, lembre-se: já estão escritas e tratam-se amanhã.</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn ghost sm" onClick={() => setStep(0)}>Voltar</button>
              <button className="btn sm" onClick={() => { save(); setStep(2); }}>Seguinte</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="small mute" style={{ marginTop: 0 }}>Escolha uma prática para acalmar o corpo. Pode fazê-la já deitado.</p>
            <p className="small" style={{ margin: '0 0 6px' }}><b>Respiração (5 min)</b></p>
            <div className="chips">
              {night.map((t) => (
                <button key={t.id} className="chip sm" onClick={() => start({ kind: 'respiracao', id: t.id as Technique['id'], minutes: 5 })}>{t.name}</button>
              ))}
            </div>
            <p className="small" style={{ margin: '12px 0 6px' }}><b>Relaxamento guiado</b></p>
            <div className="med-list">
              {RELAX.map((x) => meditationById(x)!).map((m) => (
                <button key={m.id} className="med-row" onClick={() => start({ kind: 'meditacao', id: m.id })}>
                  <span className="med-play" aria-hidden="true">▶</span>
                  <span style={{ flex: 1, textAlign: 'left' }} className="small"><b>{m.title}{!m.free && !full ? ' 🔒' : ''}</b></span>
                  <span className="small mute">{m.minutes} min</span>
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => setStep(1)}>Voltar</button>
              <button className="btn ghost sm" onClick={() => setStep(3)}>Saltar</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="small mute" style={{ marginTop: 0 }}>Um som calmo, com o volume baixo, que se desliga sozinho.</p>
            <div className="chips">
              {SOUNDS.map(([k, t]) => (
                <button key={k} className={`chip sm ${sound === k ? 'on' : ''}`} aria-pressed={sound === k} onClick={() => setSound(k)}>{t}</button>
              ))}
            </div>
            {sound !== 'nenhum' && (
              <div className="chips" style={{ marginTop: 8 }}>
                {[15, 30, 45, 60].map((m) => (
                  <button key={m} className={`chip sm ${timer === m ? 'on' : ''}`} aria-pressed={timer === m} onClick={() => setTimer(m)}>{m} min</button>
                ))}
              </div>
            )}
            <button
              className="btn"
              style={{ width: '100%', marginTop: 12 }}
              onClick={() => {
                save();
                toast('Ritual da noite feito. Durma bem. 🌙');
                if (sound === 'nenhum') onClose();
                else setPlaying(true);
              }}
            >
              {sound === 'nenhum' ? 'Terminar e dormir' : 'Começar o som e dormir'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
