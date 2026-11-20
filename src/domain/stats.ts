import { AREAS, CAPS_PER_BOTTLE, GLASS_ML, GOAL_LABEL } from './content';
import { dayKey, daysAgo, daysSince, fmtNum, keyDaysAgo } from './dates';
import { SLEEP_HABIT, STEPS_HABIT } from './health';
import { studiesFor } from './science';
import { BODY_GOAL_LABEL, bodyOf, targetsFor } from './body';
import { totals } from './foods';
import { weekProgress } from './training';
import { weekAdherence, weekChanges } from './planAdherence';
import { trainChanges, weekTrainAdherence } from './trainAdherence';
import { indexOf, planFor, slotsFor } from './plan';
import { doseText } from './lots';
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
    const viaRecipe = S.logs[k].viaRecipe || {};
    (S.logs[k].doses || []).forEach((d, i) => {
      if (d && !viaRecipe[i] && sl[i]) used += sl[i].n;
    });
  }
  const per = sl.reduce((t, s) => t + s.n, 0) || 1;
  const left = Math.max(0, S.stockCaps - used);
  return { left, used, days: Math.floor(left / per), pct: S.stockCaps ? Math.min(100, (left / S.stockCaps) * 100) : 0 };
}

/** Segunda-feira (chave) da semana de uma data local. */
function mondayOf(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
}

/**
 * Sequência do ritual: dias seguidos com a Spirulina tomada. É a única sequência da app
 * (Início, Evolução e Comunidade). Um dia falhado por semana (segunda a domingo) conta como
 * dia de descanso e não a quebra. Hoje ainda por cumprir também não a quebra.
 */
export function streak(S: AppState, now = new Date()) {
  let n = 0;
  const rested = new Set<string>();
  for (let i = 0; i < 730; i++) {
    if (took(S, S.logs[keyDaysAgo(i, now)], now)) {
      n++;
      continue;
    }
    if (i === 0) continue;
    const wk = mondayOf(daysAgo(i, now));
    if (n > 0 && !rested.has(wk)) {
      rested.add(wk);
      continue;
    }
    break;
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

export function habitOn(_S: AppState, l: DayLog, k: string) {
  if (k === 'passos' && l.steps !== undefined) return l.steps >= STEPS_HABIT;
  if (k === 'sono' && l.sleepH !== undefined) return l.sleepH >= SLEEP_HABIT;
  return !!(l.hab || {})[k as keyof NonNullable<DayLog['hab']>];
}

export type Badge = [IconName, string, boolean];

export function badges(S: AppState, now = new Date()): Badge[] {
  if (!S.ans) return [];
  const logs = Object.values(S.logs);
  const st = stock(S, now);
  const days = logs.filter((l) => took(S, l, now)).length;
  const best = bestStreak(S, now);
  const goalW = planFor(S).water;
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

/** Média dos últimos 7 dias de um valor registado, ou null se não houver registos. */
export function meanOf(S: AppState, f: 'steps' | 'sleepH', now = new Date()) {
  const v = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]?.[f]).filter((x): x is number => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Relatório em texto simples, para partilhar com um profissional. */
export function report(S: AppState, now = new Date()) {
  if (!S.ans) return 'Ainda sem avaliação.';
  const c = planFor(S);
  const f = (v: number) => (v ? fmtNum(v.toFixed(1)) : '—');
  const ev = S.evals[S.evals.length - 1];
  const water7 = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]?.water || 0).reduce((a, b) => a + b, 0) / 7;
  const lines = [
    `Relatório NEFESH Life — ${now.toLocaleDateString('pt-PT')}`,
    S.ans.name ? `Nome: ${S.ans.name}` : null,
    `Objetivo: ${GOAL_LABEL[S.ans.goal ?? 'energia']}`,
    `Índice NEFESH: ${ev ? `${indexOf(ev.sc)}/100 (${AREAS.map(([k, t]) => `${t} ${ev.sc[k]}`).join(', ')})` : '—'}`,
    (() => {
      const b = bodyOf(S.ans!);
      if (!b) return null;
      const tg = targetsFor(S);
      return `Corpo: IMC ${fmtNum(b.bmi)} (${b.bmiLabel}) · gordura ${fmtNum(b.fat)}% (${b.fatMethod === 'medidas' ? 'medidas' : 'estimada pelo IMC'})\nObjetivo para o corpo: ${BODY_GOAL_LABEL[b.corpo]} · meta ${tg.kcal} kcal e ${tg.protein} g de proteína/dia (${tg.source === 'pro' ? `definida por ${tg.by}` : 'referência geral da app'})`;
    })(),
    (() => {
      const days = Array.from({ length: 7 }, (_, i) => S.logs[keyDaysAgo(i, now)]?.meals).filter((m) => m && Object.values(m).some((x) => x?.length));
      if (!days.length) return null;
      const avg = days.reduce((t, m) => t + totals(Object.values(m!).flat() as never).kcal, 0) / days.length;
      return `Alimentação: média de ${Math.round(avg)} kcal/dia (${days.length} ${days.length === 1 ? 'dia registado' : 'dias registados'} na última semana)`;
    })(),
    (() => {
      const w = weekProgress(S, now);
      return w.mvpa || w.strengthDays ? `Atividade esta semana: ${w.mvpa} min moderados a vigorosos · ${w.strengthDays} ${w.strengthDays === 1 ? 'dia' : 'dias'} de força` : null;
    })(),
    S.plans?.nutri ? `Plano alimentar carregado: ${S.plans.nutri.name}${S.plans.nutri.by ? ` (${S.plans.nutri.by})` : ''}` : null,
    (() => {
      if (!S.nutriPlan) return null;
      const w = weekAdherence(S, 7, now);
      if (w.pct === null) return null;
      const changes = weekChanges(S, 7, now);
      return `Adesão ao plano alimentar (7 dias): ${w.pct}% em ${w.loggedDays} ${w.loggedDays === 1 ? 'dia registado' : 'dias registados'}${changes.length ? `\nAlterações ao plano:\n${changes.map((c) => `  - ${c}`).join('\n')}` : ''}`;
    })(),
    (() => {
      if (!S.trainPlan) return null;
      const w = weekTrainAdherence(S, now);
      const list = trainChanges(S, 7, now);
      if (!w.done && !list.length) return null;
      return `Treinos do plano do personal esta semana: ${w.done} de ${w.planned}${list.length ? `\nRegisto dos treinos (7 dias):\n${list.map((c) => `  - ${c}`).join('\n')}` : ''}`;
    })(),
    S.plans?.treino ? `Plano de treino carregado: ${S.plans.treino.name}${S.plans.treino.by ? ` (${S.plans.treino.by})` : ''}` : null,
    `Dose atual: ${fmtNum(c.g)} g/dia (${doseText(c.caps, c.format)} · ${fmtNum(c.gPerKg.toFixed(3))} g/kg)${S.proDose ? ` · indicada por ${S.proDose.by}` : ' · dentro do rótulo'}`,
    `Base científica: ${studiesFor(S.ans.goal ?? 'energia').filter((x) => x.level !== 'seguranca').map((x) => x.cite).join('; ')}`,
    `Adesão: ${adherence(S, 14, now)}% em 14 dias · ${adherence(S, 30, now)}% em 30 dias`,
    `Médias última semana (1–5): energia ${f(average(S, 0, 6, 'e', now))}, sono ${f(average(S, 0, 6, 's', now))}, disposição ${f(average(S, 0, 6, 'd', now))}`,
    `Semana anterior: energia ${f(average(S, 7, 13, 'e', now))}, sono ${f(average(S, 7, 13, 's', now))}, disposição ${f(average(S, 7, 13, 'd', now))}`,
    meanOf(S, 'steps', now) !== null ? `Passos médios (7 dias): ${Math.round(meanOf(S, 'steps', now)!).toLocaleString('pt-PT')}` : null,
    meanOf(S, 'sleepH', now) !== null ? `Sono médio (7 dias): ${fmtNum(meanOf(S, 'sleepH', now)!.toFixed(1))} h` : null,
    `Hidratação média (7 dias): ${f((water7 * GLASS_ML) / 1000)} L/dia`,
  ];
  return lines.filter(Boolean).join('\n');
}
