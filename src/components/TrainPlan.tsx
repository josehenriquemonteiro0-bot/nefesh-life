import { useEffect, useState } from 'react';
import { shortDate, todayKey } from '../domain/dates';
import { loadFile } from '../domain/files';
import type { PhotoError } from '../domain/photo';
import { readWorkoutPlan, type PlanWorkout } from '../domain/planRead';
import { describeTrainChanges, lastPerformance, perSet, weekTrainAdherence, type TrainSessionLog, type TrainSetLog } from '../domain/trainAdherence';
import type { DayLog } from '../domain/types';
import { useStore } from '../state/store';
import { Bar } from './Charts';
import { DecimalInput } from './DecimalInput';
import { PremiumTag } from './PremiumTag';

const STATUS: Record<TrainSessionLog['status'], string> = { seguido: 'Feito como planeado', alterado: 'Feito com alterações', saltado: 'Não fiz' };

function clearSession(d: DayLog, ref: string) {
  if (d.trainLog) {
    const t = { ...d.trainLog };
    delete t[ref];
    d.trainLog = t;
  }
  d.workouts = (d.workouts || []).filter((w) => w.sessionId !== `plano-${ref}`);
}

/** Registar um treino do plano do personal, série a série. */
function TrainSessionSheet({ idx, onClose }: { idx: number; onClose: () => void }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const w: PlanWorkout = S.trainPlan!.workouts[idx];
  const ref = String(idx);
  const current = l.trainLog?.[ref];
  const last = w.exercises.map((e) => lastPerformance(S, e.name));
  const initial = (): TrainSetLog[] =>
    w.exercises.flatMap((e, i) =>
      Array.from({ length: Math.max(1, e.sets || 1) }, (_, k) => {
        const prev = current?.sets.find((s) => s.ex === i && s.set === k);
        return prev ?? { ex: i, set: k, done: false, reps: perSet(e.reps, e.sets, k), load: last[i]?.load || perSet(e.load, e.sets, k) };
      }),
    );
  const [sets, setSets] = useState<TrainSetLog[]>(initial);
  const [minutes, setMinutes] = useState<number | undefined>(current?.minutes ?? 45);
  const [note, setNote] = useState(current?.note ?? '');
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const patch = (i: number, k: number, v: Partial<TrainSetLog>) => setSets(sets.map((s) => (s.ex === i && s.set === k ? { ...s, ...v } : s)));

  const save = (status: TrainSessionLog['status'], list: TrainSetLog[], changes?: string[]) => {
    const m = Math.max(1, Math.round(minutes ?? 45));
    updateToday((d) => {
      clearSession(d, ref);
      const log: TrainSessionLog = { status, sets: list, ...(status !== 'saltado' ? { minutes: m } : {}), ...(changes?.length ? { changes } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
      d.trainLog = { ...(d.trainLog || {}), [ref]: log };
      if (status !== 'saltado') {
        d.workouts = [...(d.workouts || []), { sessionId: `plano-${ref}`, title: w.name, minutes: m, mvpa: m, strength: true }];
        d.t = Math.max(d.t ?? 0, 2);
      }
    });
    toast(`${w.name}: ${STATUS[status].toLowerCase()}.`);
    onClose();
  };

  const asPlanned = () =>
    save('seguido', w.exercises.flatMap((e, i) => Array.from({ length: Math.max(1, e.sets || 1) }, (_, k) => ({ ex: i, set: k, done: true, reps: perSet(e.reps, e.sets, k), load: perSet(e.load, e.sets, k) }))));

  const saveDone = () => {
    const changes = describeTrainChanges(w.exercises, sets);
    save(changes.length ? 'alterado' : 'seguido', sets, changes);
  };

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={w.name}>
        <div className="row">
          <div>
            <h2 style={{ margin: 0 }}>{w.name}</h2>
            {w.focus && <p className="small mute" style={{ margin: '2px 0 0' }}>{w.focus}</p>}
          </div>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>
        {current && (
          <div className={`plan-status st-${current.status}`}>
            <span><b>{STATUS[current.status]}</b>{current.changes?.length ? `: ${current.changes.join('; ')}` : ''}</span>
            <button className="btn ghost sm" onClick={() => { updateToday((d) => clearSession(d, ref)); toast(`${w.name}: registo desfeito.`); onClose(); }}>Desfazer</button>
          </div>
        )}

        <div className="plan-actions" style={{ margin: '12px 0' }}>
          <button className="btn full" onClick={asPlanned}>✓ Concluí tal como está no plano</button>
          <button className="btn ghost full" onClick={() => save('saltado', [])}>Não fiz este treino</button>
        </div>
        <p className="small mute" style={{ margin: '0 0 8px' }}>Ou registe série a série o que fez (repetições e carga):</p>

        <div className="exlist">
          {w.exercises.map((e, i) => {
            const mine = sets.filter((s) => s.ex === i);
            const doneCount = mine.filter((s) => s.done).length;
            const isOpen = open === i;
            return (
              <div key={i} className="ex">
                <button className="ex-head" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                  <b>{e.name} <span className="small mute">{doneCount}/{mine.length}</span></b>
                  <span className="small mute">
                    {[e.sets ? `${e.sets} × ${e.reps || '—'}` : e.reps, e.load, e.rest && `descanso ${e.rest}`].filter(Boolean).join(' · ')}
                  </span>
                </button>
                {isOpen && (
                  <div className="ex-body">
                    {e.notes && <p className="small" style={{ margin: '6px 0' }}>{e.notes}</p>}
                    {last[i] && (
                      <p className="small neon" style={{ margin: '6px 0' }}>
                        Da última vez ({shortDate(last[i]!.date)}): {[last[i]!.load, last[i]!.reps && `× ${last[i]!.reps}`].filter(Boolean).join(' ')} · {last[i]!.sets} {last[i]!.sets === 1 ? 'série' : 'séries'}
                      </p>
                    )}
                    {mine.map((s) => (
                      <div key={s.set} className={`setrow ${s.done ? 'on' : ''}`}>
                        <label className="row" style={{ gap: 8, flexWrap: 'nowrap', cursor: 'pointer' }}>
                          <input type="checkbox" checked={s.done} onChange={(ev) => patch(i, s.set, { done: ev.target.checked })} aria-label={`Série ${s.set + 1} feita`} />
                          <span className="small" style={{ width: 54 }}>Série {s.set + 1}</span>
                        </label>
                        <input className="setin" value={s.reps ?? ''} onChange={(ev) => patch(i, s.set, { reps: ev.target.value, done: true })} placeholder="reps" aria-label={`Repetições da série ${s.set + 1}`} />
                        <input className="setin" value={s.load ?? ''} onChange={(ev) => patch(i, s.set, { load: ev.target.value, done: true })} placeholder="carga" aria-label={`Carga da série ${s.set + 1}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <label className="measure" style={{ margin: '14px 0 8px' }}>
          <span><b>Duração</b></span>
          <span className="measure-in"><DecimalInput decimals={false} value={minutes} onValue={setMinutes} aria-label="Minutos de treino" />min</span>
        </label>
        <input className="field sm" style={{ width: '100%', marginBottom: 10 }} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Nota para o personal (opcional, ex.: ombro sensível)" aria-label="Nota para o personal" />
        <button className="btn full" disabled={!sets.some((s) => s.done)} onClick={saveDone}>Guardar o que fiz</button>
      </div>
    </div>
  );
}

/** Plano do personal: leitura com IA, treinos da semana e registo. */
export function TrainPlanCard() {
  const { S, update, todayLog: l, toast } = useStore();
  const meta = S.plans?.treino;
  const plan = S.trainPlan && meta && S.trainPlan.name === meta.name ? S.trainPlan : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  if (!meta) return null;

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await loadFile('treino');
      if (!file) throw new Error('O ficheiro já não está neste telemóvel. Carregue-o de novo.');
      const r = await readWorkoutPlan(file, meta.name);
      if (!r.is_workout) {
        setError('Não encontrei um plano de treino neste ficheiro.');
        return;
      }
      update((d) => { d.trainPlan = { ...r, at: todayKey(), name: meta.name }; });
      toast(`Plano lido: ${r.workouts.length} ${r.workouts.length === 1 ? 'treino' : 'treinos'}.`);
    } catch (e) {
      setError((e as PhotoError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!plan)
    return (
      <section className="card">
        <h3 style={{ margin: 0 }}>Transformar o plano em treinos <PremiumTag f="lerPlano" /></h3>
        <p className="small mute" style={{ margin: '4px 0 10px' }}>A NEFESH Life lê o plano do seu personal (por exemplo, exportado do MyFit) e mostra cada treino com séries, repetições e cargas, para registar o que fez. Nada do que o profissional escreveu é alterado.</p>
        <button className="btn sm" disabled={busy} onClick={read}>{busy ? 'A ler o plano… (até 1 minuto)' : 'Ler o meu plano de treino'}</button>
        {busy && <div className="prog" style={{ margin: '12px 0 0' }}><i className="indeterminate" /></div>}
        {error && <p className="small warn-t" style={{ margin: '10px 0 0' }}>{error}</p>}
      </section>
    );

  const wk = weekTrainAdherence(S);
  const pro = plan.professional || meta.by;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>O treino {pro ? `de ${pro}` : 'do seu personal'}</h2>
        <PremiumTag f="lerPlano" />
      </div>
      <div className="row small" style={{ marginTop: 8 }}>
        <span>{wk.done} de {wk.planned} treinos esta semana</span>
        <span className="mute">{wk.pct}%</span>
      </div>
      <Bar pct={wk.pct} />
      <div className="planmeals" style={{ marginTop: 10 }}>
        {plan.workouts.map((w, i) => {
          const st = l.trainLog?.[String(i)];
          return (
            <button key={i} className={`planrow ${st ? `st-${st.status}` : ''}`} onClick={() => setOpen(i)}>
              <span className="st-dot" aria-hidden="true">{st ? (st.status === 'seguido' ? '✓' : st.status === 'alterado' ? '✎' : '–') : ''}</span>
              <span style={{ flex: 1, display: 'grid' }}>
                <b>{w.name}{w.day ? ` · ${w.day}` : ''}</b>
                <span className="small mute">{st ? STATUS[st.status] + ' hoje' : `${w.focus ? `${w.focus} · ` : ''}${w.exercises.length} ${w.exercises.length === 1 ? 'exercício' : 'exercícios'}`}</span>
              </span>
              <span className="mute" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
      {plan.notes && <p className="small" style={{ margin: '12px 0 0' }}><b>Orientações do plano:</b> {plan.notes}</p>}
      <p className="small mute" style={{ margin: '10px 0 0' }}>
        Transcrição feita por IA. Em caso de dúvida, vale o plano original do seu personal.{' '}
        <button className="link small inline" disabled={busy} onClick={read}>{busy ? 'A ler…' : 'Ler de novo'}</button>
      </p>
      {error && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{error}</p>}
      {open !== null && plan.workouts[open] && <TrainSessionSheet idx={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
