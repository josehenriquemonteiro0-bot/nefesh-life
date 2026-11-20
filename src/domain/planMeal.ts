/**
 * Marcar uma refeição do plano do nutricionista no registo do dia (segui, com alterações,
 * não fiz). Usado pelo cartão do plano e pelo Coach.
 */
import type { FoodEntry } from './foods';
import { STATUS_LABEL, type PlanMealLog, type PlanStatus } from './planAdherence';
import { diaryMeal, planEntries } from './planRead';
import type { AppState, DayLog } from './types';
import { perSet, type TrainSessionLog } from './trainAdherence';

/** Remove do diário as entradas que vieram desta refeição do plano, e a marcação. */
export function clearPlanMeal(d: DayLog, ref: string) {
  if (d.meals) {
    const m = { ...d.meals };
    for (const k of Object.keys(m) as (keyof typeof m)[]) m[k] = (m[k] || []).filter((e) => e.planRef !== ref);
    d.meals = m;
  }
  if (d.planLog) {
    const p = { ...d.planLog };
    delete p[ref];
    d.planLog = p;
  }
}

/** Grava a refeição idx do plano: as entradas vão para o diário (refeição certa) e fica o ✓. */
export function savePlanMeal(S: Pick<AppState, 'nutriPlan'>, d: DayLog, idx: number, option: number, status: PlanStatus, entries: FoodEntry[], changes?: string[], note?: string) {
  const meal = S.nutriPlan?.meals[idx];
  if (!meal) return null;
  const ref = String(idx);
  clearPlanMeal(d, ref);
  if (entries.length) {
    const target = diaryMeal(meal.meal);
    d.meals = { ...(d.meals || {}) };
    d.meals[target] = [...(d.meals[target] || []), ...entries.map((e) => ({ ...e, planRef: ref }))];
  }
  const entry: PlanMealLog = { status, option, ...(changes?.length ? { changes } : {}), ...(note?.trim() ? { note: note.trim() } : {}) };
  d.planLog = { ...(d.planLog || {}), [ref]: entry };
  return `${meal.label}: ${STATUS_LABEL[status].toLowerCase()}`;
}

/** O Coach marca a refeição do plano: seguida (ou com alterações) põe a opção no diário; "não fiz" só marca. */
export function coachPlanMeal(S: Pick<AppState, 'nutriPlan'>, d: DayLog, idx: number, option: number, status: PlanStatus, note?: string) {
  const meal = S.nutriPlan?.meals[idx];
  if (!meal) return null;
  const opt = meal.options[option] ? option : 0;
  const items = status === 'saltado' ? [] : meal.options[opt]?.items ?? [];
  return savePlanMeal(S, d, idx, opt, status, planEntries(items), status === 'alterado' && note ? [note] : undefined, note);
}

/** O Coach marca um treino do plano do personal (feito como planeado, com alterações, ou não fez). */
export function coachPlanWorkout(S: Pick<AppState, 'trainPlan'>, d: DayLog, idx: number, minutes: number, status: PlanStatus, note?: string) {
  const w = S.trainPlan?.workouts[idx];
  if (!w) return null;
  const ref = String(idx);
  if (d.trainLog) {
    const t = { ...d.trainLog };
    delete t[ref];
    d.trainLog = t;
  }
  d.workouts = (d.workouts || []).filter((x) => x.sessionId !== `plano-${ref}`);
  const m = Math.max(1, Math.round(minutes || 45));
  const sets = w.exercises.flatMap((e, i) => Array.from({ length: Math.max(1, e.sets || 1) }, (_, k) => ({ ex: i, set: k, done: status !== 'saltado', reps: perSet(e.reps, e.sets, k), load: perSet(e.load, e.sets, k) })));
  const log: TrainSessionLog = { status, sets, ...(status !== 'saltado' ? { minutes: m } : {}), ...(status === 'alterado' && note ? { changes: [note] } : {}), ...(note?.trim() ? { note: note.trim() } : {}) };
  d.trainLog = { ...(d.trainLog || {}), [ref]: log };
  if (status !== 'saltado') {
    d.workouts = [...(d.workouts || []), { sessionId: `plano-${ref}`, title: w.name, minutes: m, mvpa: m, strength: true }];
    d.t = Math.max(d.t ?? 0, 2);
  }
  return `${w.name}: ${status === 'seguido' ? 'feito como planeado' : status === 'alterado' ? 'feito com alterações' : 'não fiz'}${status !== 'saltado' ? `, ${m} min` : ''}`;
}
