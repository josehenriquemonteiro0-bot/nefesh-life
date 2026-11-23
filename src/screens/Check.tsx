import { TRAINING } from '../domain/content';
import { longToday } from '../domain/dates';
import type { DayLog } from '../domain/types';
import { useStore } from '../state/store';
import { useDoseToggle } from '../state/doses';
import { DecimalInput } from '../components/DecimalInput';
import { SourceTag } from '../components/SourceTag';
import { setSource } from '../domain/sources';

const SLEEP_CHIPS = [5, 6, 7, 8, 9];

const METRICS: [keyof Pick<DayLog, 'e' | 's' | 'd'>, string, string, string][] = [
  ['e', 'Energia', 'baixa', 'alta'],
  ['s', 'Sono', 'mau', 'ótimo'],
  ['d', 'Disposição', 'em baixo', 'excelente'],
];

export function Check({ onSaved }: { onSaved: () => void }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const { slots, doses, toggle } = useDoseToggle();
  const complete = !!(l.e && l.s && l.d);
  return (
    <>
      <p className="mute small" style={{ margin: 0 }}>{longToday()}</p>
      <h1>Check-in de hoje</h1>
      <section className="card">
        {METRICS.map(([f, t, lo, hi]) => (
          <div className="metric" key={f} role="group" aria-label={t}>
            <div className="lbl"><span>{t}</span><span className="mute small">{lo} → {hi}</span></div>
            <div className="chips">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`chip ${l[f] === n ? 'on' : ''}`} aria-pressed={l[f] === n} onClick={() => updateToday((d) => { d[f] = n; })}>{n}</button>
              ))}
            </div>
          </div>
        ))}
        {S.fasting?.on && (
          <div className="metric" role="group" aria-label="Fome">
            <div className="lbl"><span>Fome (jejum)</span><span className="mute small">pouca → muita</span></div>
            <div className="chips">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`chip ${l.hunger === n ? 'on' : ''}`} aria-pressed={l.hunger === n} onClick={() => updateToday((d) => { d.hunger = n; })}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <div className="metric" role="group" aria-label="Horas de sono">
          <div className="lbl"><span>Quantas horas dormiu?</span>{l.sleepH !== undefined ? <SourceTag l={l} f="sleepH" /> : <span className="mute small">opcional</span>}</div>
          <div className="chips">
            {SLEEP_CHIPS.map((h) => (
              <button key={h} className={`chip ${l.sleepH === h ? 'on' : ''}`} aria-pressed={l.sleepH === h} onClick={() => updateToday((d) => { d.sleepH = d.sleepH === h ? undefined : h; setSource(d, 'sleepH', null); })}>{h === 9 ? '9+' : h}</button>
            ))}
            <label className="hin" style={{ width: 92 }}>
              <span>outro</span>
              <DecimalInput
                placeholder="7,5"
                value={l.sleepH !== undefined && !SLEEP_CHIPS.includes(l.sleepH) ? l.sleepH : undefined}
                aria-label="Horas de sono exatas"
                onValue={(v) => updateToday((d) => { if (v === undefined) delete d.sleepH; else d.sleepH = Math.max(0, Math.min(24, Math.round(v * 2) / 2)); setSource(d, 'sleepH', null); })}
              />
            </label>
          </div>
        </div>
        {S.ans && slots.length > 0 && (
          <div className="metric" role="group" aria-label="Spirulina de hoje">
            <div className="lbl"><span>Spirulina hoje</span><span className="mute small">toque no que já tomou</span></div>
            <div className="chips">
              {slots.map((s, i) => (
                <button key={s.l} className={`chip ${doses[i] ? 'on' : ''}`} aria-pressed={!!doses[i]} onClick={() => toggle(i)}>{doses[i] ? '✓ ' : ''}{s.l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="metric" role="group" aria-label="Treino">
          <div className="lbl"><span>Treino</span></div>
          <div className="chips">
            {TRAINING.map((t, i) => (
              <button key={t} className={`chip ${l.t === i ? 'on' : ''}`} aria-pressed={l.t === i} onClick={() => updateToday((d) => { d.t = i; })}>{t}</button>
            ))}
          </div>
        </div>
      </section>
      <button
        className="btn full"
        disabled={!complete}
        onClick={() => {
          toast('Check-in guardado.');
          onSaved();
        }}
      >
        Guardar check-in
      </button>
    </>
  );
}
