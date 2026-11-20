import { useState } from 'react';
import { DAYS, weekdayIndex, type WorkoutLog } from '../domain/training';
import { GYM, gymWeek, logLoads, setsFor, type GymLevel, type GymSession } from '../domain/gym';
import { shortDate, todayKey } from '../domain/dates';
import { useStore } from '../state/store';
import { shareMoment } from '../domain/social';
import { DecimalInput } from './DecimalInput';
import { ExerciseHelp } from './ExerciseHelp';
import { Icon } from './Icon';

/** Uma sessão do ginásio: exercícios com séries, a carga usada da última vez e registo. */
function GymSessionView({ s, level, onBack }: { s: GymSession; level: GymLevel; onBack: () => void }) {
  const { S, update, updateToday, todayLog: l, toast } = useStore();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [loads, setLoads] = useState<Record<string, string>>(() => ({ ...(S.gymLoads ?? {}) }));
  const [minutes, setMinutes] = useState<number | undefined>(s.minutes || 30);
  const already = (l.workouts || []).some((w) => w.sessionId === s.id);

  const finish = () => {
    const m = Math.max(1, Math.round(minutes ?? s.minutes));
    const w: WorkoutLog = { sessionId: s.id, title: `Ginásio: ${s.title}`, minutes: m, mvpa: m, strength: s.kind === 'forca' };
    updateToday((d) => {
      d.workouts = [...(d.workouts || []), w];
      d.t = Math.max(d.t ?? 0, 2);
    });
    // guarda as cargas para a próxima vez
    const used = Object.fromEntries(Object.entries(loads).filter(([id, v]) => v.trim() && s.exercises.includes(id)));
    update((d) => {
      d.gymLoads = { ...(d.gymLoads ?? {}), ...used };
      // histórico das cargas, para ver a evolução
      d.gymLoadLog = logLoads(d.gymLoadLog, used, todayKey());
    });
    toast(`Ginásio: ${s.title} registado (${m} min).`);
    // treino concluído aparece no mural da comunidade
    if (S.community && m >= 10) shareMoment('treino', m);
    onBack();
  };

  return (
    <>
      <button className="btn ghost sm" onClick={onBack}>← Treino</button>
      <section className="card hero" style={{ marginTop: 14 }}>
        <span className="rtag solid">Ginásio · {level === 'iniciante' ? 'Iniciante' : 'Intermediário'}</span>
        <h1 style={{ margin: '8px 0 6px' }}>{s.title}</h1>
        <p className="small" style={{ margin: 0 }}>{s.minutes} min · {s.text}</p>
      </section>

      {s.exercises.length > 0 && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Exercícios</h2>
          <p className="small mute">Escolha uma carga com que consiga fazer todas as repetições com boa técnica, deixando 2 de reserva. Quando ficar fácil, aumente um pouco.</p>
          <div className="exlist">
            {s.exercises.map((id) => {
              const e = GYM[id];
              return (
                <div key={id} className={`ex ${done[id] ? 'done' : ''}`}>
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
                    <input type="checkbox" checked={!!done[id]} onChange={() => setDone({ ...done, [id]: !done[id] })} aria-label={`Feito: ${e.name}`} />
                    <span style={{ flex: 1 }}>
                      <b>{e.name}</b>
                      <span className="small mute" style={{ display: 'block' }}>{setsFor(id, level, S.ans)} · {e.area}</span>
                    </span>
                    <label className="hin" style={{ width: 86 }}>
                      <span>carga</span>
                      <input value={loads[id] ?? ''} placeholder="kg" onChange={(ev) => setLoads({ ...loads, [id]: ev.target.value })} aria-label={`Carga de ${e.name}`} />
                    </label>
                  </div>
                  {(() => {
                    const hist = (S.gymLoadLog?.[id] ?? []).filter((x) => x.d !== todayKey());
                    const last = hist[hist.length - 1];
                    return last ? <p className="small neon" style={{ margin: '6px 0 0' }}>Da última vez ({shortDate(last.d)}): {last.v}{/kg/i.test(last.v) ? '' : ' kg'}</p> : null;
                  })()}
                  <p className="small mute" style={{ margin: '6px 0 0' }}>{e.tip}</p>
                  <ExerciseHelp name={e.name} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <h2>Registar</h2>
        <label className="measure" style={{ marginBottom: 12 }}>
          <span><b>Duração</b><span className="small mute">o tempo que fez</span></span>
          <span className="measure-in"><DecimalInput decimals={false} value={minutes} onValue={setMinutes} aria-label="Minutos" />min</span>
        </label>
        <button className="btn full" onClick={finish} disabled={!minutes}>{already ? 'Registar outra vez' : 'Concluir e registar'}</button>
      </section>
    </>
  );
}

/** Separador "No ginásio": treinos sugeridos para quem treina sem personal. */
export function GymPlan({ level, levelPicker, personal }: { level: GymLevel; levelPicker: JSX.Element; personal: JSX.Element }) {
  const { S, todayLog } = useStore();
  const [open, setOpen] = useState<GymSession | null>(null);
  const week = gymWeek(S.ans, level);
  const today = weekdayIndex();
  if (open) return <GymSessionView s={open} level={level} onBack={() => { setOpen(null); window.scrollTo(0, 0); }} />;
  const s = week[today];
  const doneToday = (todayLog.workouts || []).some((w) => w.sessionId.startsWith('ginasio'));
  return (
    <>
      <h2 style={{ margin: '0 0 4px' }}>Treinos sugeridos no ginásio</h2>
      <p className="mute small" style={{ margin: '0 0 10px' }}>Para quem treina sem personal: máquinas, halteres e cardio.</p>
      {levelPicker}
      <p className="small mute" style={{ margin: '-6px 0 12px' }}>
        {level === 'iniciante'
          ? 'Iniciante: corpo inteiro 3 vezes por semana, 3 séries de 10 a 12 repetições, com máquinas e cargas leves para aprender a técnica.'
          : 'Intermediário: superior e inferior 4 vezes por semana, 3 a 4 séries de 8 a 10 repetições, com barra e halteres.'}
      </p>
      <button className="card today-session" onClick={() => setOpen(s)}>
        <span className="small" style={{ opacity: 0.8 }}>Hoje · {DAYS[today]}{doneToday ? ' · registado ✓' : ''}</span>
        <span className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
          <Icon name={s.kind === 'forca' ? 'flame' : s.kind === 'cardio' ? 'evo' : 'moon'} />
          <span style={{ flex: 1 }}>
            <b style={{ font: '600 20px Sora' }}>{s.title}</b>
            <span className="small" style={{ display: 'block', opacity: 0.85 }}>{s.minutes ? `${s.minutes} min · ` : ''}{s.exercises.length ? `${s.exercises.length} exercícios` : s.text}</span>
          </span>
        </span>
        <span className="btn sm" style={{ alignSelf: 'flex-start' }}>{s.kind === 'descanso' ? 'Ver' : 'Começar'}</span>
      </button>
      {personal}
      <section className="card">
        <h2>A semana no ginásio</h2>
        <ul className="weeklist">
          {week.map((x, i) => (
            <li key={i}>
              <button onClick={() => setOpen(x)} className={i === today ? 'on' : ''}>
                <span className="small mute" style={{ width: 62 }}>{DAYS[i]}</span>
                <Icon name={x.kind === 'forca' ? 'flame' : x.kind === 'cardio' ? 'evo' : 'moon'} />
                <span style={{ flex: 1 }}>{x.title}</span>
                <span className="small mute">{x.minutes ? `${x.minutes} min` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
