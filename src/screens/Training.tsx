import { notePremiumUse } from '../domain/analytics';
import { useEffect, useState } from 'react';
import { Bar } from '../components/Charts';
import { DecimalInput } from '../components/DecimalInput';
import { Icon } from '../components/Icon';
import { GOAL_LABEL, whatsappLink } from '../domain/content';
import { BODY_GOAL_LABEL } from '../domain/body';
import { PlanUpload } from '../components/PlanUpload';
import { PremiumTag } from '../components/PremiumTag';
import { ExerciseAnim } from '../components/ExerciseAnim';
import { GymPlan } from '../components/GymPlan';
import { TrainPlanCard } from '../components/TrainPlan';
import { DAYS, EXERCISES, LEVEL_LABEL, exerciseById, levelOf, weekPlan, weekProgress, weekdayIndex, weeklyActivity, workoutHistory, type Exercise, type Level, type Session, type WorkoutLog } from '../domain/training';
import { loadProgress } from '../domain/gym';
import { fmtNum, shortDate } from '../domain/dates';
import { Columns } from '../components/Charts';
import { HEALTH_WORKOUT_ID } from '../domain/healthSync';
import { useStore } from '../state/store';
import { shareMoment } from '../domain/social';
import { PhaseHint } from '../components/Cycle';

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
          <ExerciseAnim id={e.id} />
          <ol className="small">{e.how.map((h) => <li key={h}>{h}</li>)}</ol>
          {e.easier && <p className="small" style={{ margin: '6px 0 0' }}><b>Mais fácil:</b> {e.easier}</p>}
          {e.caution && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{e.caution}</p>}
        </div>
      )}
    </div>
  );
}

function SessionView({ s, level, onBack }: { s: Session; level: Level; onBack: () => void }) {
  useEffect(() => notePremiumUse('treinoObjetivo'), [s.id]);
  const { S, todayLog: l, updateToday, toast } = useStore();
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
    // treino concluído aparece no mural da comunidade
    if (S.community && m >= 10) shareMoment('treino', m);
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

type TrainTab = 'personal' | 'ginasio' | 'casa';

/** Resumo da semana, comum aos dois separadores. */
function WeekSummary() {
  const { S } = useStore();
  const p = weekProgress(S);
  const today = weekdayIndex();
  return (
    <section className="card">
      <div className="weekstrip">
        {DAYS.map((d, i) => (
          <div key={d} className={`wd ${i === today ? 'today' : ''} ${p.doneDays[i] ? 'done' : ''}`}>
            <span>{d.slice(0, 3)}</span>
            <i>{p.doneDays[i] ? '✓' : ''}</i>
          </div>
        ))}
      </div>
      <div className="mini-bars">
        <div>
          <div className="row small"><span>Atividade</span><span className="mute">{p.mvpa}/{p.goalMin} min</span></div>
          <Bar pct={(p.mvpa / p.goalMin) * 100} />
        </div>
        <div>
          <div className="row small"><span>Força</span><span className="mute">{p.strengthDays}/{p.goalStrength} dias</span></div>
          <Bar pct={(p.strengthDays / p.goalStrength) * 100} />
        </div>
      </div>
      <p className="small mute" style={{ margin: '4px 0 0' }}>Meta da OMS: 150 minutos por semana e força 2 vezes por semana.</p>
    </section>
  );
}

/** Histórico dos treinos, minutos por semana e evolução das cargas. */
function TrainingHistory() {
  const { S } = useStore();
  const [all, setAll] = useState(false);
  const hist = workoutHistory(S, 30);
  const weeks = weeklyActivity(S, 8);
  const loads = loadProgress(S.gymLoadLog, S.exNames);
  if (!hist.length && !loads.length) return null;
  const shown = all ? hist : hist.slice(0, 5);
  const avg = Math.round(weeks.slice(0, 7).reduce((t, w) => t + w.mvpa, 0) / 7);
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Histórico e evolução</h2>
        <PremiumTag f="treinoCompleto" />
      </div>
      <p className="small mute" style={{ margin: '6px 0 4px' }}>Minutos de atividade por semana (meta 150)</p>
      <Columns values={weeks.map((w) => w.mvpa)} goal={150} label={(v) => `${v} min`} axis={['há 8 semanas', 'esta semana']} />
      <p className="small" style={{ margin: '6px 0 0' }}>
        Média das 7 semanas anteriores: <b>{avg} min</b> · força em <b>{weeks.slice(0, 7).reduce((t, w) => t + w.strength, 0)}</b> dias
      </p>
      {loads.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Cargas no ginásio</h3>
          <ul className="plain small">
            {loads.slice(0, 8).map((x) => (
              <li key={x.id} className="row">
                <span>{x.name}</span>
                <span className={x.delta && x.delta > 0 ? 'neon' : 'mute'}>
                  {x.first.v} → {x.last.v}{x.delta ? ` (${x.delta > 0 ? '+' : ''}${fmtNum(x.delta)} kg)` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {hist.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 6px' }}>Últimos treinos</h3>
          <ul className="plain small">
            {shown.map((d) => (
              <li key={d.day}>
                <b>{shortDate(d.day)}</b>{' '}
                <span className="mute">
                  {d.items.map((w) => `${w.sessionId === HEALTH_WORKOUT_ID ? '⌚ ' : w.sessionId === 'coach' ? '🎙️ ' : ''}${w.title} · ${w.minutes} min`).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
          {hist.length > 5 && <button className="link small inline" onClick={() => setAll(!all)}>{all ? 'Ver menos' : `Ver os ${hist.length} dias com treino`}</button>}
        </>
      )}
    </section>
  );
}

/** A importância do personal e o pedido de indicação à NEFESH. */
function PersonalNote() {
  const { S } = useStore();
  return (
    <section className="card personal-note">
      <h2 style={{ marginTop: 0 }}>🏋️ Um personal faz a diferença</h2>
      <p className="small" style={{ marginTop: 0 }}>
        Estes treinos são uma sugestão geral para o seu objetivo, em casa ou no ginásio. Um personal trainer avalia a sua postura e a sua condição, ajusta os exercícios e as cargas e faz-o progredir com segurança.
      </p>
      <p className="small mute">A NEFESH indica-lhe um profissional de exercício parceiro para montar um treino feito à sua medida. Depois, carregue esse plano em "Com personal".</p>
      <a className="btn sm" href={whatsappLink(`Olá NEFESH! Gostava de uma indicação de personal trainer para montar um treino personalizado${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)} target="_blank" rel="noopener">
        Pedir indicação de personal
      </a>
    </section>
  );
}

export function Training() {
  const { S, todayLog, update } = useStore();
  const hasProFile = !!S.plans?.treino;
  const hasPro = !!(S.trainPlan && S.plans?.treino?.name === S.trainPlan.name);
  const [tab, setTab] = useState<TrainTab>(hasProFile ? 'personal' : S.trainWhere ?? 'casa');
  const [open, setOpen] = useState<Session | null>(null);
  const [lib, setLib] = useState(false);
  // nível dos treinos sugeridos: escolhido pela pessoa ou deduzido da avaliação (avançado conta como intermédio)
  const auto = levelOf(S.ans);
  const level: Level = S.trainLevel ?? (auto === 'iniciante' ? 'iniciante' : 'intermedio');
  const plan = weekPlan(S.ans, level);
  const today = weekdayIndex();

  if (open) return <SessionView s={open} level={level} onBack={() => { setOpen(null); window.scrollTo(0, 0); }} />;

  const levelPicker = (
    <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 14 }} role="group" aria-label="Nível">
      {(['iniciante', 'intermedio'] as const).map((lv) => (
        <button key={lv} className={level === lv ? 'on' : ''} aria-pressed={level === lv} onClick={() => update((d) => { d.trainLevel = lv; })}>
          {lv === 'iniciante' ? 'Iniciante' : 'Intermediário'}
        </button>
      ))}
    </div>
  );
  const s = plan[today];
  const doneToday = (todayLog.workouts || []).length > 0;

  return (
    <>
      <h1>Treino</h1>
      <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 14 }} role="group" aria-label="Onde treina" data-tour="treino-onde">
        {([['personal', 'Com personal'], ['ginasio', 'No ginásio'], ['casa', 'Em casa']] as [TrainTab, string][]).map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-pressed={tab === k} onClick={() => { setTab(k); update((d) => { d.trainWhere = k; }); }}>{t}</button>
        ))}
      </div>

      <PhaseHint kind="train" />
      <WeekSummary />
      <OtherActivity />
      <p />

      {tab === 'ginasio' ? (
        <GymPlan level={level === 'iniciante' ? 'iniciante' : 'intermedio'} levelPicker={levelPicker} personal={<PersonalNote />} />
      ) : tab === 'personal' ? (
        <>
          {hasPro ? (
            <>
              <TrainPlanCard />
              <PlanUpload kind="treino" />
            </>
          ) : (
            <>
              {!hasProFile && <PersonalNote />}
              {!hasProFile && (
                <section className="card">
                  <h2>Treina com um personal?</h2>
                  <p className="small mute" style={{ margin: 0 }}>
                    Carregue o plano que ele lhe deu (do MyFit ou de outra app, em PDF, fotografia, Excel ou Word). A NEFESH Life transforma-o em treinos para registar série a série, com as cargas e a sua evolução.
                  </p>
                </section>
              )}
              <PlanUpload kind="treino" />
              <TrainPlanCard />
            </>
          )}
        </>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 6 }}>
            <h2 style={{ margin: 0 }}>Treinos sugeridos</h2>
            <PremiumTag f="treinoObjetivo" />
          </div>
          <p className="mute small" style={{ margin: '0 0 10px' }}>
            Para o seu objetivo: {S.ans?.corpo ? BODY_GOAL_LABEL[S.ans.corpo] : S.ans?.goal ? GOAL_LABEL[S.ans.goal] : 'bem-estar geral'} · sem material
          </p>
          {levelPicker}
          <p className="small mute" style={{ margin: '-6px 0 12px' }}>
            {level === 'iniciante'
              ? 'Iniciante: 2 voltas por circuito, versões mais fáceis quando precisar e caminhada em vez de cardio intenso.'
              : 'Intermediário: 3 voltas por circuito, mais repetições e um dia de cardio intervalado.'}
          </p>

          <button className="card today-session" onClick={() => setOpen(s)}>
            <span className="small" style={{ opacity: 0.8 }}>Hoje · {DAYS[today]}{doneToday ? ' · registado ✓' : ''}</span>
            <span className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
              <Icon name={KIND_ICON[s.kind]} />
              <span style={{ flex: 1 }}>
                <b style={{ font: '600 20px Sora' }}>{s.title}</b>
                <span className="small" style={{ display: 'block', opacity: 0.85 }}>{s.minutes} min · {s.text}</span>
              </span>
            </span>
            {s.exercises.length > 0 && (
              <span className="anim-strip" aria-hidden="true">
                {s.exercises.slice(0, 4).map((id) => <ExerciseAnim key={id} id={id} size="sm" />)}
              </span>
            )}
            <span className="btn sm" style={{ alignSelf: 'flex-start' }}>Começar</span>
          </button>

          <PersonalNote />

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
        </>
      )}

      <TrainingHistory />

      <p className="small mute">
        Se sentir dor no peito, falta de ar fora do normal, tonturas ou dor nas articulações, pare e fale com um profissional de saúde. Se tem uma doença crónica ou está grávida, confirme o plano com o seu médico antes de começar.
      </p>
    </>
  );
}
