/**
 * NEFESH Life Pro: relatório de bem-estar que o aluno partilha com o personal (só com autorização,
 * revogável a qualquer momento). Só números dos últimos 14 dias — sem diário, notas, ciclo, medicação.
 * As medidas e avaliações do corpo só vão com uma segunda autorização (proShare.body).
 */
import { bodyEvolution, bodySeries } from './bodyLog';
import { labSeries } from './care';
import { fastDays } from './fasting';
import { dayAdherence, weekChanges } from './planAdherence';
import { keyDaysAgo } from './dates';
import { planFor } from './plan';
import { tookOn } from './stats';
import { weekTrainAdherence } from './trainAdherence';
import { diaryStats } from './sleep';
import type { AppState } from './types';

export interface ShareDay { d: string; e?: number; sleepH?: number; stress?: number; steps?: number; water?: boolean; kcal?: number; prot?: number; train?: number }
export interface ShareSummary {
  from: string; to: string; goal: string;
  days: ShareDay[];
  avg: { energy: number | null; sleep: number | null; stress: number | null; steps: number | null; kcal: number | null; prot: number | null };
  waterDays: number; foodDays: number; spirulinaDays: number; trainMin: number;
  train: { done: number; planned: number } | null;
  weight: { first: number; last: number; from: string; to: string } | null;
  /** medidas e avaliações do corpo (só com autorização própria) */
  body?: ShareBody[];
  labs?: ShareLab[];
  nutri?: ShareNutri;
  /** diário do sono, só números (só com autorização própria) */
  sleep?: ShareSleep;
}
/** Médias do diário do sono (14 noites): eficiência, horas dormidas, minutos até adormecer, despertares, qualidade e horários. */
export interface ShareSleep { nights: number; eff: number | null; asleepH: number | null; lat: number | null; wakes: number | null; q: number | null; bedAvg: string | null; upAvg: string | null }
/** Para o nutricionista: adesão ao plano por dia, alterações, fome e jejum. */
export interface ShareNutri { adherence: number | null; days: { d: string; pct: number | null; hunger?: number }[]; changes: string[]; hunger: number | null; fastAvg: number | null; fastDays: number }
export interface ShareLab { name: string; unit: string; value: number; date: string; prev: number | null; lo: number | null; hi: number | null }
function nutriBlock(S: AppState, keys: string[]): ShareNutri {
  const days = keys.map((d) => { const a = dayAdherence(S, d); const h = S.logs[d]?.hunger; return { d, pct: a.done ? a.pct : null, ...(h ? { hunger: h } : {}) }; });
  const done = days.filter((x) => x.pct !== null);
  const fd = fastDays(S, 14);
  return {
    adherence: done.length ? Math.round(done.reduce((t, x) => t + (x.pct ?? 0), 0) / done.length) : null,
    days,
    changes: weekChanges(S, 14).slice(-20),
    hunger: avg(days.map((x) => x.hunger)),
    fastAvg: fd.length ? Math.round((fd.reduce((t, x) => t + x.hours, 0) / fd.length) * 10) / 10 : null,
    fastDays: fd.filter((x) => x.reached).length,
  };
}
export interface ShareBody { label: string; unit: string; first: number; last: number; from: string; to: string; diff: number | null }

const avg = (a: (number | undefined)[]) => {
  const v = a.filter((x): x is number => typeof x === 'number' && x > 0);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};

export function shareSummary(S: AppState, now = new Date(), opts: { body?: boolean; labs?: boolean; nutri?: boolean; sleep?: boolean } = { body: !!S.proShare?.body }): ShareSummary {
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
    ...(opts.body ? { body: bodyEvolution(bodySeries(S)).slice(0, 40).map((r) => ({ label: r.label, unit: r.unit, first: r.first, last: r.last, from: r.firstDate, to: r.lastDate, diff: r.diff })) } : {}),
    ...(opts.labs ? { labs: labSeries(S).slice(0, 30).map((x) => ({ name: x.name, unit: x.unit, value: x.last.value, date: x.last.date, prev: x.change !== null ? Math.round((x.last.value - x.change) * 100) / 100 : null, lo: x.last.lo ?? null, hi: x.last.hi ?? null })) } : {}),
    ...(opts.nutri ? { nutri: nutriBlock(S, keys) } : {}),
    ...(opts.sleep ? (() => { const d = diaryStats(S, 14, now); return d.nights ? { sleep: { nights: d.nights, eff: d.eff, asleepH: d.asleepH, lat: d.lat, wakes: d.wakes, q: d.q, bedAvg: d.bedAvg, upAvg: d.upAvg } } : {}; })() : {}),
  };
}
