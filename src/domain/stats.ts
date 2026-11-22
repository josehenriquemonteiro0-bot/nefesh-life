import { bodyContext } from './bodyLog';
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
import { sourceCount, sourceSummary } from './sources';
import { careReportLines } from './care';
import type { AppState, DayLog } from './types';
import type { IconName } from '../components/Icon';

/** Meio-dia do dia de uma chave (para saber a dose desse dia). */
export const dayDate = (k: string) => new Date(`${k}T12:00:00`);

/**
 * O ritual do dia está cumprido quando todas as tomas DESSE dia foram marcadas.
 * Usa o número de tomas guardado ao marcar; nos registos antigos, a dose da data do dia
 * (passe a data do registo em "when": na semana de adaptação havia menos tomas).
 */
export function took(S: AppState, l: DayLog | undefined, when = new Date()) {
  if (!l || !l.doses) return false;
  const need = l.slots ?? slotsFor(S, when).length;
  return l.doses.filter(Boolean).length >= Math.max(1, need);
}
/** Ritual cumprido no dia k. */
export const tookOn = (S: AppState, k: string) => took(S, S.logs[k], dayDate(k));

/**
 * Ritmo real das tomas: fração dos dias com o ritual feito nos últimos 14 dias
 * (desde o início do frasco). Com menos de 5 dias de histórico, assume todos os dias.
 * Hoje só conta se já tomou, para não baixar o ritmo de manhã.
 */
export function pace(S: AppState, now = new Date()) {
  const start = [S.planStart, S.stockStart].filter(Boolean).sort().pop() ?? null;
  const span = start ? Math.min(14, daysSince(start, now)) : 0;
  if (span < 5) return 1;
  const today = tookOn(S, keyDaysAgo(0, now)) ? 1 : 0;
  let yes = today;
  for (let i = 1; i <= span; i++) if (tookOn(S, keyDaysAgo(i, now))) yes++;
  const n = span + today;
  return Math.max(0.25, Math.min(1, yes / n));
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
  const rate = pace(S, now);
  // dias até acabar ao ritmo real da pessoa; planDays: se tomasse todos os dias
  const days = Math.floor(left / (per * rate));
  return { left, used, days, planDays: Math.floor(left / per), rate, ends: dayKey(new Date(now.getTime() + days * 86400000)), pct: S.stockCaps ? Math.min(100, (left / S.stockCaps) * 100) : 0 };
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
    if (tookOn(S, keyDaysAgo(i, now))) {
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
  // a mesma regra da sequência: um dia falhado por semana (segunda a domingo) é descanso
  const keys = Object.keys(S.logs).sort();
  if (!keys.length) return 0;
  const today = keyDaysAgo(0, now);
  let best = 0, cur = 0;
  let rested = new Set<string>();
  for (let d = new Date(`${keys[0]}T12:00:00`); dayKey(d) <= today; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    if (tookOn(S, k)) {
      cur++;
      best = Math.max(best, cur);
    } else if (k !== today) {
      const wk = mondayOf(d);
      if (cur > 0 && !rested.has(wk)) rested.add(wk);
      else {
        cur = 0;
        rested = new Set();
      }
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
  for (let i = 0; i < n; i++) if (tookOn(S, keyDaysAgo(i, now))) y++;
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
  const days = Object.keys(S.logs).filter((k) => tookOn(S, k)).length;
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
      return `Corpo: IMC ${fmtNum(b.bmi)} (${b.bmiLabel}) · gordura ${fmtNum(b.fat)}% (${b.fatMethod === 'avaliacao' ? 'medida em avaliação' : b.fatMethod === 'medidas' ? 'medidas' : 'estimada pelo IMC'})\nObjetivo para o corpo: ${BODY_GOAL_LABEL[b.corpo]} · meta ${tg.kcal} kcal e ${tg.protein} g de proteína/dia (${tg.source === 'pro' ? `definida por ${tg.by}` : 'referência geral da app'})`;
    })(),
    bodyContext(S) || null,
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
    meanOf(S, 'steps', now) !== null ? `Passos médios (7 dias): ${Math.round(meanOf(S, 'steps', now)!).toLocaleString('pt-PT')} (${sourceSummary(sourceCount(S, 'steps', 7, now))})` : null,
    meanOf(S, 'sleepH', now) !== null ? `Sono médio (7 dias): ${fmtNum(meanOf(S, 'sleepH', now)!.toFixed(1))} h (${sourceSummary(sourceCount(S, 'sleepH', 7, now))})` : null,
    `Hidratação média (7 dias): ${f((water7 * GLASS_ML) / 1000)} L/dia`,
    (() => {
      const c = careReportLines(S, now);
      return [
        c.meds.length ? `Medicação e suplementos:\n${c.meds.map((x) => `  - ${x}`).join('\n')}` : null,
        c.labs.length ? `Análises (evolução):\n${c.labs.map((x) => `  - ${x}`).join('\n')}` : null,
        c.prev.length ? `Prevenção por rever:\n${c.prev.map((x) => `  - ${x}`).join('\n')}` : null,
      ].filter(Boolean).join('\n') || null;
    })(),
  ];
  return lines.filter(Boolean).join('\n');
}

/** Mensagem de encomenda já preenchida, com frascos suficientes para 30 dias de ritual. */
export function reorderText(S: AppState, now = new Date()) {
  const st = stock(S, now);
  const per = slotsFor(S, now).reduce((t, s) => t + s.n, 0) || 4;
  const format = S.format ?? 'caps';
  const n = Math.max(1, Math.ceil((per * 30) / CAPS_PER_BOTTLE));
  const name = { caps: 'Spirulina em cápsulas (120 cápsulas)', po: 'Spirulina em pó (60 g)', nibs: 'Spirulina em palhinha / Nibs (60 g)' }[format];
  return `Olá NEFESH! Quero encomendar ${n} ${n === 1 ? 'frasco' : 'frascos'} de ${name}${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}. O meu stock acaba em ${st.days} ${st.days === 1 ? 'dia' : 'dias'}.`;
}

/**
 * A sequência parou ontem (e não é o dia de descanso da semana): para mostrar
 * "Não faz mal, recomece hoje" em vez de a deixar ir a zero sem uma palavra.
 */
export function streakBreak(S: AppState, now = new Date()) {
  if (tookOn(S, keyDaysAgo(1, now))) return null;
  const prev = streak(S, daysAgo(2, now));
  const cur = streak(S, now);
  if (prev < 2 || cur >= prev) return null;
  return { prev, best: bestStreak(S, now) };
}

/** Resumo do primeiro mês (marco dos 30 dias). */
export function monthSummary(S: AppState, now = new Date()) {
  const keys = Array.from({ length: 30 }, (_, i) => keyDaysAgo(i, now)).filter((k) => !S.planStart || k >= S.planStart);
  const goal = S.ans ? planFor(S).water : 8;
  const e = (ks: string[]) => {
    const v = ks.map((k) => S.logs[k]?.e).filter((x): x is number => !!x);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const sorted = [...keys].sort();
  return {
    days: keys.length,
    spirulina: keys.filter((k) => tookOn(S, k)).length,
    water: keys.filter((k) => (S.logs[k]?.water ?? 0) >= goal).length,
    checkins: keys.filter((k) => S.logs[k]?.e).length,
    minutes: keys.reduce((t, k) => t + (S.logs[k]?.workouts ?? []).reduce((a, w) => a + w.minutes, 0), 0),
    best: bestStreak(S, now),
    energyFirst: e(sorted.slice(0, 7)),
    energyLast: e(sorted.slice(-7)),
  };
}
