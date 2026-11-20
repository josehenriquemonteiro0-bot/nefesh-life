import { useState } from 'react';
import { Bar } from '../components/Charts';
import { DecimalInput } from '../components/DecimalInput';
import { Icon } from '../components/Icon';
import { GOAL_LABEL } from '../domain/content';
import { BODY_GOAL_LABEL } from '../domain/body';
import { PlanUpload } from '../components/PlanUpload';
import { PremiumTag } from '../components/PremiumTag';
import { DAYS, EXERCISES, LEVEL_LABEL, exerciseById, levelOf, weekPlan, weekProgress, weekdayIndex, type Exercise, type Level, type Session, type WorkoutLog } from '../domain/training';
import { useStore } from '../state/store';

const KIND_ICON = { forca: 'flame', caminhada: 'steps', intervalos: 'evo', mobilidade: 'wind', descanso: 'moon' } as const;
const INTENSITY: Record<Session['kind'], number> = { forca: 2, intervalos: 3, caminhada: 1, mobilidade: 1, descanso: 0 };

function ExerciseItem({ e, level, done, onToggle }: { e: Exercise; level: Level; done?: boolean; onToggle?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ex ${done ? 'done' : ''}`}>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
        {onToggle && <input type="checkbox" checked={!!done} onChange={onToggle} aria-label={`Feito: ${e.name}`} />}
        <button className="ex-head" onClick={() => setOpen(!open)} aria-expanded={open}>
          <b>{e.name}</b>
          <span className="small mute">{e.dose[level]} · {e.area}</span>
        </button>
        <span className="mute" aria-hidden="true">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div className="ex-body">
          <ol className="small">{e.how.map((h) => <li key={h}>{h}</li>)}</ol>
          {e.easier && <p className="small" style={{ margin: '6px 0 0' }}><b>Mais fácil:</b> {e.easier}</p>}
          {e.caution && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{e.caution}</p>}
        </div>
      )}
    </div>
  );
}

function SessionView({ s, level, onBack }: { s: Session; level: Level; onBack: () => void }) {
  const { todayLog: l, updateToday, toast } = useStore();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [minutes, setMinutes] = useState<number | undefined>(s.minutes);
  const already = (l.workouts || []).some((w) => w.sessionId === s.id);

  const finish = () => {
    const m = Math.max(1, Math.round(minutes ?? s.minutes));
    const mvpa = s.kind === 'mobilidade' ? 0 : s.kind === 'intervalos' ? Math.round(m * 1.5) : m;
    const w: WorkoutLog = { sessionId: s.id, title: s.title, minutes: m, mvpa, strength: s.kind === 'forca' };
    updateToday((d) => {
      d.workouts = [...(d.workouts || []), w];
      d.t = Math.max(d.t ?? 0, INTENSITY[s.kind]);
    });
    toast(`${s.title} registado: ${m} min.`);
    onBack();
  };

  return (
    <>
      <button className="btn ghost sm" onClick={onBack}>← Treino</button>
      <section className="card hero" style={{ marginTop: 14 }}>
        <span className="rtag solid">{LEVEL_LABEL[level]}</span>
        <h1 style={{ margin: '8px 0 6px' }}>{s.title}</h1>
        <p className="small" style={{ margin: 0 }}>{s.minutes} min · {s.text}</p>
      </section>

      {s.exercises.length > 0 && (
        <section className="card">
          <div className="row"><h2 style={{ margin: 0 }}>Circuito</h2>{s.rounds && s.rounds > 1 && <span className="small mute">{s.rounds} voltas</span>}</div>
          <p className="small mute">Toque num exercício para ver como se faz. Comece com 5 minutos de aquecimento: marcha no lugar e rodar os braços.</p>
          <div className="exlist">
            {s.exercises.map((id) => (
              <ExerciseItem key={id} e={exerciseById(id)} level={level} done={done[id]} onToggle={() => setDone({ ...done, [id]: !done[id] })} />
            ))}
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
        {already && <p className="small neon" style={{ margin: '8px 0 0' }}>Já registou esta sessão hoje.</p>}
      </section>
    </>
  );
}

function OtherActivity() {
  const { updateToday, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('Corrida');
  const [min, setMin] = useState<number | undefined>(30);
  const [vig, setVig] = useState(false);
  if (!open) return <button className="btn ghost full" onClick={() => setOpen(true)}>+ Registar outra atividade</button>;
  return (
    <section className="card">
      <h2>Outra atividade</h2>
      <div className="chips" style={{ marginBottom: 12 }}>
        {['Corrida', 'Bicicleta', 'Ginásio', 'Natação', 'Futebol', 'Dança', 'Outra'].map((t) => (
          <button key={t} className={`chip ${type === t ? 'on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>
        ))}
      </div>
      <label className="measure" style={{ marginBottom: 12 }}>
        <span><b>Duração</b></span>
        <span className="measure-in"><DecimalInput decimals={false} value={min} onValue={setMin} aria-label="Minutos da atividade" />min</span>
      </label>
      <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 12 }} role="group" aria-label="Intensidade">
        <button className={!vig ? 'on' : ''} aria-pressed={!vig} onClick={() => setVig(false)}>Moderada</button>
        <button className={vig ? 'on' : ''} aria-pressed={vig} onClick={() => setVig(true)}>Vigorosa</button>
      </div>
      <p className="small mute">Moderada: consegue falar, mas não cantar. Vigorosa: só diz poucas palavras seguidas. Pela OMS, 1 minuto vigoroso vale por 2 moderados.</p>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
        <button
          className="btn sm"
          disabled={!min}
          onClick={() => {
            const m = Math.round(min!);
            updateToday((d) => {
              d.workouts = [...(d.workouts || []), { sessionId: `outra-${type}`, title: type, minutes: m, mvpa: vig ? m * 2 : m, strength: type === 'Ginásio' }];
              d.t = Math.max(d.t ?? 0, vig ? 3 : 2);
            });
            toast(`${type}: ${m} min registados.`);
            setOpen(false);
          }}
        >
          Registar
        </button>
      </div>
    </section>
  );
}

export function Training() {
  const { S, todayLog } = useStore();
  const [open, setOpen] = useState<Session | null>(null);
  const [lib, setLib] = useState(false);
  const level = levelOf(S.ans);
  const plan = weekPlan(S.ans);
  const today = weekdayIndex();
  const p = weekProgress(S);

  if (open) return <SessionView s={open} level={level} onBack={() => { setOpen(null); window.scrollTo(0, 0); }} />;

  const s = plan[today];
  const doneToday = (todayLog.workouts || []).length > 0;

  return (
    <>
      <div className="row"><h1>Treino</h1><PremiumTag f="treinoObjetivo" /></div>
      <p className="mute small" style={{ marginTop: 0 }}>
        Plano {LEVEL_LABEL[level].toLowerCase()} · {S.ans?.corpo ? BODY_GOAL_LABEL[S.ans.corpo] : S.ans?.goal ? GOAL_LABEL[S.ans.goal] : 'bem-estar geral'} · exercícios em casa, sem material
      </p>

      <section className="card">
        <h2>Esta semana</h2>
        <div className="weekstrip">
          {DAYS.map((d, i) => (
            <div key={d} className={`wd ${i === today ? 'today' : ''} ${p.doneDays[i] ? 'done' : ''}`}>
              <span>{d.slice(0, 3)}</span>
              <i>{p.doneDays[i] ? '✓' : ''}</i>
            </div>
          ))}
        </div>
        <div className="row small" style={{ marginTop: 12 }}><span>Atividade moderada a vigorosa</span><span className="mute">{p.mvpa} / {p.goalMin} min</span></div>
        <Bar pct={(p.mvpa / p.goalMin) * 100} />
        <div className="row small"><span>Dias de força</span><span className="mute">{p.strengthDays} / {p.goalStrength}</span></div>
        <Bar pct={(p.strengthDays / p.goalStrength) * 100} />
        <p className="small mute" style={{ margin: '6px 0 0' }}>Recomendação da OMS para adultos: 150 minutos por semana e força 2 vezes por semana.</p>
      </section>

      <button className="card today-session" onClick={() => setOpen(s)}>
        <span className="small" style={{ opacity: 0.8 }}>Hoje · {DAYS[today]}{doneToday ? ' · registado ✓' : ''}</span>
        <span className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
          <Icon name={KIND_ICON[s.kind]} />
          <span style={{ flex: 1 }}>
            <b style={{ font: '600 20px Sora' }}>{s.title}</b>
            <span className="small" style={{ display: 'block', opacity: 0.85 }}>{s.minutes} min · {s.text}</span>
          </span>
        </span>
        <span className="btn sm" style={{ alignSelf: 'flex-start' }}>Começar</span>
      </button>

      <OtherActivity />
      <p />
      <PlanUpload kind="treino" />

      <section className="card">
        <h2>O plano da semana</h2>
        <ul className="weeklist">
          {plan.map((x, i) => (
            <li key={i}>
              <button onClick={() => setOpen(x)} className={i === today ? 'on' : ''}>
                <span className="small mute" style={{ width: 62 }}>{DAYS[i]}</span>
                <Icon name={KIND_ICON[x.kind]} />
                <span style={{ flex: 1 }}>{x.title}</span>
                <span className="small mute">{x.minutes ? `${x.minutes} min` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Biblioteca de exercícios</h2>
          <button className="btn ghost sm" onClick={() => setLib(!lib)}>{lib ? 'Fechar' : `Ver ${EXERCISES.length}`}</button>
        </div>
        {lib && <div className="exlist" style={{ marginTop: 12 }}>{EXERCISES.map((e) => <ExerciseItem key={e.id} e={e} level={level} />)}</div>}
      </section>

      <p className="small mute">
        Se sentir dor no peito, falta de ar fora do normal, tonturas ou dor nas articulações, pare e fale com um profissional de saúde. Se tem uma doença crónica ou está grávida, confirme o plano com o seu médico antes de começar.
      </p>
    </>
  );
}
