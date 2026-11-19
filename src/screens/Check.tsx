import { TRAINING } from '../domain/content';
import { longToday } from '../domain/dates';
import type { DayLog } from '../domain/types';
import { useStore } from '../state/store';

const METRICS: [keyof Pick<DayLog, 'e' | 's' | 'd'>, string, string, string][] = [
  ['e', 'Energia', 'baixa', 'alta'],
  ['s', 'Sono', 'mau', 'ótimo'],
  ['d', 'Disposição', 'em baixo', 'excelente'],
];

export function Check({ onSaved }: { onSaved: () => void }) {
  const { todayLog: l, updateToday, toast } = useStore();
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
