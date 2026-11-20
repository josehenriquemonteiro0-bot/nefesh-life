import { daysSince, keyDaysAgo } from './dates';
import { bodyOf } from './body';
import { FOODS, entryOf, type FoodEntry, type MealKey } from './foods';
import { indexOf, planFor } from './plan';
import { weekAdherence } from './planAdherence';
import { took } from './stats';
import { weekTrainAdherence } from './trainAdherence';
import type { WorkoutLog } from './training';
import type { Answers, AppState, Evaluation, Slot } from './types';

/* ---------- reavaliação aos 7, 15 e 30 dias ---------- */

export const CHECKPOINTS = [7, 15, 30] as const;

/** Próximo marco de reavaliação (7, 15, 30 e depois a cada 30 dias) e se já chegou. */
export function nextReassessment(S: AppState, now = new Date()) {
  if (!S.planStart) return null;
  const day = daysSince(S.planStart, now);
  const lastEval = S.evals[S.evals.length - 1];
  const sinceLast = lastEval ? daysSince(lastEval.date, now) : day;
  const marks = [...CHECKPOINTS, ...Array.from({ length: 12 }, (_, i) => 60 + i * 30)];
  const evalDay = day - sinceLast;
  // o marco mais recente já atingido e ainda sem avaliação; senão, o próximo
  const passed = marks.filter((m) => m <= day && m > evalDay);
  const target = passed.length ? passed[passed.length - 1] : marks.find((m) => m > day) ?? marks[marks.length - 1];
  return { day, target, due: day >= target, inDays: Math.max(0, target - day) };
}

/** Fotografia do corpo guardada em cada avaliação, para comparar antes e depois. */
export function bodySnapshot(a: Answers): Evaluation['body'] {
  const b = bodyOf(a);
  if (!a.peso) return undefined;
  return { peso: a.peso, bmi: b?.bmi, fat: b?.fat, cintura: a.cintura };
}

/** Comparação entre a primeira avaliação e a mais recente. */
export function compareEvals(S: AppState) {
  if (S.evals.length < 2) return null;
  const first = S.evals[0];
  const last = S.evals[S.evals.length - 1];
  const d = (x?: number, y?: number) => (x !== undefined && y !== undefined ? Math.round((y - x) * 10) / 10 : null);
  return {
    first,
    last,
    days: daysSince(first.date, new Date(last.date)),
    index: indexOf(last.sc) - indexOf(first.sc),
    peso: d(first.body?.peso, last.body?.peso),
    bmi: d(first.body?.bmi, last.body?.bmi),
    fat: d(first.body?.fat, last.body?.fat),
    cintura: d(first.body?.cintura, last.body?.cintura),
  };
}

/* ---------- resumo semanal ---------- */

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function weeklySummary(S: AppState, now = new Date()) {
  const keys = Array.from({ length: 7 }, (_, i) => keyDaysAgo(i, now));
  const prevKeys = Array.from({ length: 7 }, (_, i) => keyDaysAgo(i + 7, now));
  const logs = keys.map((k) => S.logs[k]).filter(Boolean);
  const spirulina = keys.filter((k) => took(S, S.logs[k], now)).length;
  const water = S.ans ? keys.filter((k) => (S.logs[k]?.water ?? 0) >= planFor(S).water).length : 0;
  const checkins = logs.filter((l) => l!.e).length;
  const energy = mean(keys.map((k) => S.logs[k]?.e).filter((v): v is number => !!v));
  const energyPrev = mean(prevKeys.map((k) => S.logs[k]?.e).filter((v): v is number => !!v));
  const sleep = mean(keys.map((k) => S.logs[k]?.sleepH).filter((v): v is number => !!v));
  const minutes = keys.reduce((t, k) => t + (S.logs[k]?.workouts ?? []).reduce((a, w) => a + w.mvpa, 0), 0);
  const plan = S.nutriPlan ? weekAdherence(S, 7, now).pct : null;
  const train = S.trainPlan ? weekTrainAdherence(S, now) : null;
  return {
    spirulina,
    water,
    checkins,
    energy: energy === null ? null : Math.round(energy * 10) / 10,
    energyDelta: energy !== null && energyPrev !== null ? Math.round((energy - energyPrev) * 10) / 10 : null,
    sleep: sleep === null ? null : Math.round(sleep * 10) / 10,
    minutes,
    plan,
    train,
    hasData: logs.length > 0,
  };
}

/* ---------- Spirulina no diário ---------- */

/** Refeição do diário em que entra cada toma, pelo nome da toma. */
export function mealForSlot(label: string): MealKey {
  if (/almoço/i.test(label)) return 'almoco';
  if (/jantar/i.test(label)) return 'jantar';
  if (/treino|lanche/i.test(label)) return 'lanche';
  return 'pa';
}

/** Entrada do diário para uma toma de Spirulina (cápsulas, pó ou palhinha). */
export function spirulinaEntry(S: AppState, slot: Slot, idx: number): FoodEntry {
  const format = planFor(S).format;
  const id = format === 'caps' ? 'spirulina_caps' : format === 'po' ? 'spirulina_po' : 'spirulina_nibs';
  const food = FOODS.find((f) => f.id === id)!;
  return { ...entryOf(food, slot.n * 0.5), auto: `spirulina-${idx}` };
}

/* ---------- treino e calorias do dia ---------- */

/** Equivalentes metabólicos (MET) aproximados por tipo de sessão (Compêndio de Atividades Físicas). */
function metOf(w: WorkoutLog): number {
  const id = w.sessionId;
  if (id.startsWith('plano-') || id.startsWith('forca') || w.strength) return 5;
  if (id === 'intervalos') return 8;
  if (id === 'mobilidade') return 2.5;
  if (id === 'caminhada') return 3.5;
  // outras atividades: vigorosa quando os minutos contam a dobrar
  return w.mvpa >= w.minutes * 2 ? 8 : 4.5;
}

/** Calorias gastas nos treinos registados num dia (estimativa). */
export function workoutKcal(S: AppState, key: string): number {
  const kg = S.ans?.peso ?? 70;
  return Math.round((S.logs[key]?.workouts ?? []).reduce((t, w) => t + (metOf(w) - 1) * kg * (w.minutes / 60), 0));
}

/* ---------- a Spirulina e você ---------- */

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/**
 * Compara como a pessoa se sentiu nos dias com o ritual da Spirulina e nos dias sem ele
 * (últimos 30 dias com check-in). É uma observação pessoal, não uma prova científica.
 */
export function spirulinaInsight(S: AppState, now = new Date(), days = 30) {
  const rows = Array.from({ length: days }, (_, i) => S.logs[keyDaysAgo(i, now)]).filter((l) => l && l.e);
  const withR = rows.filter((l) => took(S, l, now));
  const without = rows.filter((l) => !took(S, l, now));
  const group = (ls: typeof rows) => ({ n: ls.length, e: avg(ls.map((l) => l!.e!)), s: avg(ls.map((l) => l!.s!).filter(Boolean)), d: avg(ls.map((l) => l!.d!).filter(Boolean)) });
  const a = group(withR);
  const b = group(without);
  const first = S.evals[0];
  const last = S.evals[S.evals.length - 1];
  return {
    with: a,
    without: b,
    /** há dias suficientes nos dois grupos para comparar */
    comparable: a.n >= 3 && b.n >= 3,
    /** fez o ritual em (quase) todos os dias com check-in */
    allIn: a.n >= 5 && b.n === 0,
    energyDiff: a.e !== null && b.e !== null ? Math.round((a.e - b.e) * 10) / 10 : null,
    checkins: rows.length,
    index: first && last && first !== last ? { from: indexOf(first.sc), to: indexOf(last.sc) } : null,
  };
}
