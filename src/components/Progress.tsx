import { FEELS, deloadSuggestion, inDeload, startDeload, type Feel } from '../domain/progression';
import { keyDaysAgo, shortDate, todayKey } from '../domain/dates';
import { useStore } from '../state/store';

/** Como correu o exercício: decide a progressão da próxima vez. */
export function FeelChips({ value, onPick, label }: { value?: Feel; onPick: (f: Feel | undefined) => void; label: string }) {
  return (
    <div className="chips feel" role="group" aria-label={`Como correu: ${label}`}>
      {FEELS.map(([k, t]) => (
        <button key={k} className={`chip sm ${value === k ? 'on' : ''}`} aria-pressed={value === k} onClick={() => onPick(value === k ? undefined : k)}>{t}</button>
      ))}
    </div>
  );
}

/** Semana leve: sugerida pela app (5 semanas seguidas de força, ou sono e energia em baixo). */
export function DeloadCard() {
  const { S, update, toast } = useStore();
  const today = todayKey();
  if (inDeload(S, today))
    return (
      <section className="card phase-hint">
        <p className="small" style={{ margin: 0 }}>
          🌱 <b>Semana leve até {shortDate(S.trainDeload!.to)}:</b> mesmas cargas, menos uma série em cada exercício. A progressão volta na semana seguinte.{' '}
          <button className="link small inline" onClick={() => update((d) => { d.trainDeload = { from: d.trainDeload!.from, to: keyDaysAgo(1) }; })}>Terminar já</button>
        </p>
      </section>
    );
  const sug = deloadSuggestion(S);
  if (!sug) return null;
  return (
    <section className="card phase-hint">
      <p className="small" style={{ margin: 0 }}>🌱 <b>Que tal uma semana leve?</b> {sug.reason}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
        <button className="btn sm" onClick={() => { update((d) => { d.trainDeload = startDeload(today); }); toast('Semana leve marcada: menos uma série e sem subir cargas durante 7 dias.'); }}>Fazer semana leve</button>
        <button className="btn ghost sm" onClick={() => update((d) => { d.trainDeload = { from: today, to: keyDaysAgo(1) }; })}>Agora não</button>
      </div>
    </section>
  );
}
