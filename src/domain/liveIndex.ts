/**
 * Índice NEFESH vivo: metade vem da avaliação (o que a pessoa respondeu) e metade do que
 * faz nos últimos 14 dias (energia e sono do check-in, água, atividade, vegetais). Assim o
 * número central acompanha os hábitos, e a reavaliação mostra a mudança real.
 * Cada área só usa o comportamento quando há registos suficientes (senão, só a avaliação).
 */
import { AREAS, STEP_GOAL } from './content';
import { keyDaysAgo } from './dates';
import { indexOf, planFor, scores } from './plan';
import type { AppState, AreaKey, Scores } from './types';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Pontuação de cada área a partir dos registos dos últimos 14 dias (só as que têm dados). */
export function behaviorScores(S: AppState, now = new Date(), days = 14): Partial<Scores> {
  const logs = Array.from({ length: days }, (_, i) => S.logs[keyDaysAgo(i, now)]).filter(Boolean);
  const out: Partial<Scores> = {};
  const e = logs.map((l) => l!.e).filter((v): v is number => !!v);
  if (e.length >= 3) out.energia = clamp(((mean(e)! - 1) / 4) * 100);
  const s = logs.map((l) => l!.sleepH).filter((v): v is number => typeof v === 'number');
  if (s.length >= 3) {
    const h = mean(s)!;
    out.sono = clamp(h >= 7 && h <= 8.5 ? 100 : h < 7 ? 100 - (7 - h) * 35 : 100 - (h - 8.5) * 15);
  }
  const goal = S.ans ? planFor(S).water : 8;
  const w = logs.filter((l) => (l!.water ?? 0) > 0).map((l) => Math.min(1, (l!.water ?? 0) / goal));
  if (w.length >= 3) out.hidratacao = clamp(mean(w)! * 100);
  const mvpa = logs.reduce((t, l) => t + (l!.workouts ?? []).reduce((a, x) => a + x.mvpa, 0), 0);
  const steps = logs.map((l) => l!.steps).filter((v): v is number => typeof v === 'number');
  if (mvpa > 0 || steps.length >= 3) out.movimento = clamp(Math.max((mvpa / (days / 7) / 150) * 100, steps.length >= 3 ? (mean(steps)! / STEP_GOAL) * 100 : 0));
  if (logs.some((l) => l!.hab?.veg)) out.nutricao = clamp((logs.filter((l) => l!.hab?.veg).length / Math.max(7, logs.length)) * 100);
  return out;
}

/** Áreas do Índice: avaliação e comportamento a meias (só avaliação onde não há registos). */
export function liveScores(S: AppState, now = new Date(), ans = S.ans): Scores {
  const base = ans ? scores(ans) : ({ energia: 50, sono: 50, nutricao: 50, hidratacao: 50, movimento: 50 } as Scores);
  const b = behaviorScores(S, now);
  return Object.fromEntries(AREAS.map(([k]) => [k, b[k as AreaKey] === undefined ? base[k as AreaKey] : Math.round((base[k as AreaKey] + b[k as AreaKey]!) / 2)])) as Scores;
}

export const liveIndex = (S: AppState, now = new Date()) => indexOf(liveScores(S, now));

/** Índice inicial (a primeira avaliação, tal como foi vista) e o de agora. */
export function indexTrend(S: AppState, now = new Date()) {
  const first = S.evals[0];
  return { from: first ? indexOf(first.sc) : null, now: liveIndex(S, now) };
}
