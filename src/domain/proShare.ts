/**
 * NEFESH Life Pro: relatório de bem-estar que o aluno partilha com o personal (só com autorização,
 * revogável a qualquer momento). Só números dos últimos 14 dias — sem diário, notas, ciclo, medicação.
 */
import { keyDaysAgo } from './dates';
import { planFor } from './plan';
import { tookOn } from './stats';
import { weekTrainAdherence } from './trainAdherence';
import type { AppState } from './types';

export interface ShareDay { d: string; e?: number; sleepH?: number; stress?: number; steps?: number; water?: boolean; kcal?: number; prot?: number; train?: number }
export interface ShareSummary {
  from: string; to: string; goal: string;
  days: ShareDay[];
  avg: { energy: number | null; sleep: number | null; stress: number | null; steps: number | null; kcal: number | null; prot: number | null };
  waterDays: number; foodDays: number; spirulinaDays: number; trainMin: number;
  train: { done: number; planned: number } | null;
  weight: { first: number; last: number; from: string; to: string } | null;
}

const avg = (a: (number | undefined)[]) => {
  const v = a.filter((x): x is number => typeof x === 'number' && x > 0);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};

export function shareSummary(S: AppState, now = new Date()): ShareSummary {
  const keys = Array.from({ length: 14 }, (_, i) => keyDaysAgo(13 - i, now));
  const goalWater = S.ans ? planFor(S).water : 8;
  const days: ShareDay[] = keys.map((k) => {
    const l = S.logs[k];
    if (!l) return { d: k };
    const entries = Object.values(l.meals ?? {}).flat().filter(Boolean) as { kcal?: number; p?: number }[];
    const kcal = entries.reduce((s, x) => s + (x.kcal ?? 0), 0);
    const prot = entries.reduce((s, x) => s + (x.p ?? 0), 0);
    const train = (l.workouts ?? []).reduce((s, w) => s + (w.minutes ?? 0), 0);
    return {
      d: k,
      ...(l.e ? { e: l.e } : {}),
      ...(l.sleepH ? { sleepH: l.sleepH } : {}),
      ...(l.stress ? { stress: l.stress } : {}),
      ...(l.steps ? { steps: l.steps } : {}),
      ...(l.water !== undefined ? { water: (l.water ?? 0) >= goalWater } : {}),
      ...(entries.length ? { kcal: Math.round(kcal), prot: Math.round(prot) } : {}),
      ...(train ? { train } : {}),
    };
  });
  const bl = (S.bodyLog ?? []).filter((b) => b.peso && b.date >= keyDaysAgo(60, now)).sort((a, b) => a.date.localeCompare(b.date));
  const tr = S.trainPlan ? weekTrainAdherence(S, now) : null;
  return {
    from: keys[0], to: keys[13], goal: S.ans?.goal ?? '',
    days,
    avg: { energy: avg(days.map((x) => x.e)), sleep: avg(days.map((x) => x.sleepH)), stress: avg(days.map((x) => x.stress)), steps: avg(days.map((x) => x.steps)), kcal: avg(days.map((x) => x.kcal)), prot: avg(days.map((x) => x.prot)) },
    waterDays: days.filter((x) => x.water).length,
    foodDays: days.filter((x) => x.kcal).length,
    spirulinaDays: keys.filter((k) => tookOn(S, k)).length,
    trainMin: days.reduce((s, x) => s + (x.train ?? 0), 0),
    train: tr ? { done: tr.done, planned: tr.planned } : null,
    weight: bl.length ? { first: bl[0].peso!, last: bl[bl.length - 1].peso!, from: bl[0].date, to: bl[bl.length - 1].date } : null,
  };
}
