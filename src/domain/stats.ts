import { AREAS, CAPS_PER_BOTTLE, GLASS_ML, GOAL_LABEL } from './content';
import { daysSince, fmtNum, keyDaysAgo } from './dates';
import { healthProvider } from './health';
import { calcPlan, indexOf, slotsFor } from './plan';
import type { AppState, DayLog } from './types';
import type { IconName } from '../components/Icon';

/** O ritual do dia está cumprido quando todas as tomas foram marcadas. */
export function took(S: AppState, l: DayLog | undefined, now = new Date()) {
  if (!l || !l.doses) return false;
  return l.doses.filter(Boolean).length >= Math.max(1, slotsFor(S, now).length);
}

export function stock(S: AppState, now = new Date()) {
  const sl = slotsFor(S, now);
  let used = 0;
  for (const k in S.logs) {
    if (k < S.stockStart) continue;
    (S.logs[k].doses || []).forEach((d, i) => {
      if (d) used += (sl[i] || sl[0] || { n: 0 }).n;
    });
  }
  const per = sl.reduce((t, s) => t + s.n, 0) || 1;
  const left = Math.max(0, S.stockCaps - used);
  return { left, used, days: Math.floor(left / per), pct: S.stockCaps ? Math.min(100, (left / S.stockCaps) * 100) : 0 };
}

/** Dias seguidos com o ritual cumprido. Hoje ainda por cumprir não quebra a sequência. */
export function streak(S: AppState, now = new Date()) {
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (took(S, S.logs[keyDaysAgo(i, now)], now)) n++;
    else if (i > 0) break;
  }
  return n;
}

export function bestStreak(S: AppState, now = new Date()) {
  let best = 0;
  let cur = 0;
  let prev: string | null = null;
  for (const k of Object.keys(S.logs).sort()) {
    if (took(S, S.logs[k], now)) {
      cur = prev && daysSince(prev, now) - daysSince(k, now) === 1 ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = k;
    } else {
      cur = 0;
      prev = null;
    }
  }
  return best;
}

export function average(S: AppState, from: number, to: number, f: 'e' | 's' | 'd', now = new Date()) {
  let s = 0;
  let n = 0;
  for (let i = from; i <= to; i++) {
    const v = S.logs[keyDaysAgo(i, now)]?.[f];
    if (v) {
      s += v;
      n++;
    }
  }
  return n ? s / n : 0;
}

export function adherence(S: AppState, n = 14, now = new Date()) {
  let y = 0;
  for (let i = 0; i < n; i++) if (took(S, S.logs[keyDaysAgo(i, now)], now)) y++;
  return Math.round((y / n) * 100);
}

/** Variação (%) entre os primeiros 7 e os últimos 7 registos; precisa de pelo menos 10. */
export function changeSinceStart(S: AppState, f: 'e' | 's' | 'd') {
  const ks = Object.keys(S.logs).filter((k) => S.logs[k][f]).sort();
  if (ks.length < 10) return null;
  const mean = (arr: string[]) => arr.reduce((t, k) => t + (S.logs[k][f] || 0), 0) / arr.length;
  const a = mean(ks.slice(0, 7));
  const b = mean(ks.slice(-7));
  return Math.round(((b - a) / a) * 100);
}

export function habitOn(S: AppState, l: DayLog, k: string) {
  if (S.health && k === 'passos') return healthProvider.steps(0) >= 6000;
  if (S.health && k === 'sono') return healthProvider.sleep(0) >= 7;
  return !!(l.hab || {})[k as keyof NonNullable<DayLog['hab']>];
}

export type Badge = [IconName, string, boolean];

export function badges(S: AppState, now = new Date()): Badge[] {
  if (!S.ans) return [];
  const logs = Object.values(S.logs);
  const st = stock(S, now);
  const days = logs.filter((l) => took(S, l, now)).length;
  const best = bestStreak(S, now);
  const goalW = calcPlan(S.ans).water;
  const hyd = logs.filter((l) => (l.water || 0) >= goalW).length;
  const ck = logs.filter((l) => l.e).length;
  return [
    ['star', 'Primeiro ritual', days >= 1],
    ['flame', '7 dias seguidos', best >= 7],
    ['leaf', '21 dias: hábito criado', best >= 21],
    ['cal', '30 dias de ritual', days >= 30],
    ['bottle', 'Primeiro frasco', st.used >= CAPS_PER_BOTTLE],
    ['drop', 'Hidratação em dia 5×', hyd >= 5],
    ['chart', '10 check-ins', ck >= 10],
    ['quiz', 'Reavaliação feita', S.evals.length >= 2],
  ];
}

/** Relatório em texto simples, para partilhar com um profissional. */
export function report(S: AppState, now = new Date()) {
  if (!S.ans) return 'Ainda sem avaliação.';
  const c = calcPlan(S.ans);
  const f = (v: number) => (v ? fmtNum(v.toFixed(1)) : '—');
  const ev = S.evals[S.evals.length - 1];
  const water7 = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]?.water || 0).reduce((a, b) => a + b, 0) / 7;
  const lines = [
    `Relatório NEFESH Life — ${now.toLocaleDateString('pt-PT')}`,
    S.ans.name ? `Nome: ${S.ans.name}` : null,
    `Objetivo: ${GOAL_LABEL[S.ans.goal ?? 'energia']}`,
    `Índice NEFESH: ${ev ? `${indexOf(ev.sc)}/100 (${AREAS.map(([k, t]) => `${t} ${ev.sc[k]}`).join(', ')})` : '—'}`,
    `Dose atual: ${fmtNum(c.g)} g/dia (${c.caps} cápsulas)`,
    `Adesão: ${adherence(S, 14, now)}% em 14 dias · ${adherence(S, 30, now)}% em 30 dias`,
    `Médias última semana (1–5): energia ${f(average(S, 0, 6, 'e', now))}, sono ${f(average(S, 0, 6, 's', now))}, disposição ${f(average(S, 0, 6, 'd', now))}`,
    `Semana anterior: energia ${f(average(S, 7, 13, 'e', now))}, sono ${f(average(S, 7, 13, 's', now))}, disposição ${f(average(S, 7, 13, 'd', now))}`,
    S.health
      ? `Passos médios (7 dias): ${Math.round(Array.from({ length: 7 }, (_, i) => healthProvider.steps(i + 1)).reduce((a, b) => a + b, 0) / 7).toLocaleString('pt-PT')}`
      : null,
    `Hidratação média (7 dias): ${f((water7 * GLASS_ML) / 1000)} L/dia`,
  ];
  return lines.filter(Boolean).join('\n');
}
