/**
 * Pontos NEFESH: consistência nos hábitos de cada dia, sequência com dia de descanso,
 * níveis e pontos de evolução do Índice NEFESH.
 */
import { STEP_GOAL } from './content';
import { dayKey, keyDaysAgo } from './dates';
import { indexOf, planFor, slotsFor } from './plan';
import { streak, took } from './stats';
import type { AppState, DayLog } from './types';

/** Letras dos hábitos (iguais às do servidor). */
export type Flag = 's' | 'a' | 'c' | 'm' | 't' | 'p' | 'n';

export const HABIT_POINTS: { flag: Flag; label: string; full: number; part?: number; partLabel?: string }[] = [
  { flag: 's', label: 'Spirulina do dia', full: 20, part: 10, partLabel: 'parte das tomas' },
  { flag: 'a', label: 'Meta de água', full: 15, part: 7, partLabel: 'metade da meta' },
  { flag: 'm', label: '3 refeições registadas', full: 15, part: 5, partLabel: '1 ou 2 refeições' },
  { flag: 't', label: 'Treino ou atividade', full: 15 },
  { flag: 'c', label: 'Check-in', full: 10 },
  { flag: 'p', label: `Meta de passos (${STEP_GOAL.toLocaleString('pt-PT')})`, full: 10, part: 5, partLabel: '5 000 passos' },
  { flag: 'n', label: '7 horas de sono', full: 10 },
];
export const DAY_CAP = 100;

const mealsLogged = (l: DayLog) =>
  Object.values(l.meals ?? {}).filter((m) => (m ?? []).some((e) => !e.auto)).length;

/** Pontos e hábitos cumpridos num dia (sem o bónus da sequência). */
export function dayScore(S: AppState, key: string, now = new Date()): { points: number; flags: string; parts: Record<Flag, number>; halved: boolean } {
  const l = S.logs[key];
  const parts = { s: 0, a: 0, c: 0, m: 0, t: 0, p: 0, n: 0 } as Record<Flag, number>;
  if (!l || !S.ans) return { points: 0, flags: '', parts, halved: false };
  const doses = (l.doses ?? []).filter(Boolean).length;
  if (took(S, l, now)) parts.s = 20;
  else if (doses) parts.s = 10;
  const goal = planFor(S).water;
  const w = l.water ?? 0;
  if (w >= goal) parts.a = 15;
  else if (w >= goal / 2) parts.a = 7;
  const meals = mealsLogged(l);
  if (meals >= 3) parts.m = 15;
  else if (meals) parts.m = 5;
  if ((l.workouts ?? []).length || (l.t ?? 0) > 0) parts.t = 15;
  if (l.e) parts.c = 10;
  if ((l.steps ?? 0) >= STEP_GOAL) parts.p = 10;
  else if ((l.steps ?? 0) >= 5000) parts.p = 5;
  if ((l.sleepH ?? 0) >= 7) parts.n = 10;
  const full: Record<Flag, number> = { s: 20, a: 15, c: 10, m: 15, t: 15, p: 10, n: 10 };
  const flags = (Object.keys(parts) as Flag[]).filter((f) => parts[f] === full[f]).join('');
  // a Spirulina é a chave do dia: sem nenhuma toma, os outros hábitos valem metade
  const others = Object.entries(parts).filter(([k]) => k !== 's').reduce((a, [, v]) => a + v, 0);
  const keyed = parts.s ? others : Math.round(others / 2);
  return { points: parts.s + keyed, flags, parts, halved: !parts.s && others > 0 };
}

/** Segunda-feira (chave) da semana de uma data. */
export function weekStart(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

/** A sequência da comunidade é a sequência do ritual da Spirulina (com dia de descanso semanal). */
export const activityStreak = (S: AppState, now = new Date()) => streak(S, now);

/** Pontos do dia com o bónus da sequência (+5% com 7 dias, +10% com 30), até 100. */
export function dayPoints(S: AppState, key: string, streak: number, now = new Date()) {
  const base = dayScore(S, key, now).points;
  const mult = streak >= 30 ? 1.1 : streak >= 7 ? 1.05 : 1;
  return Math.min(DAY_CAP, Math.round(base * mult));
}

export const LEVELS: [string, number][] = [
  ['Semente', 0],
  ['Broto', 300],
  ['Folha', 1000],
  ['Raiz', 2500],
  ['Árvore', 5000],
  ['Floresta', 10000],
  ['Oceano', 20000],
  ['Nefesh', 40000],
];

export function totalPoints(S: AppState, now = new Date()) {
  return Object.keys(S.logs).reduce((t, k) => t + dayScore(S, k, now).points, 0);
}

export function levelOf(total: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && total >= LEVELS[i + 1][1]) i++;
  const [name, from] = LEVELS[i];
  const next = LEVELS[i + 1];
  return { index: i, name, total, next: next?.[0] ?? null, toNext: next ? next[1] - total : 0, pct: next ? Math.round(((total - from) / (next[1] - from)) * 100) : 100 };
}

/**
 * Pontos de evolução da semana: quem se reavalia nesta semana ganha 20 pontos,
 * mais 5 por cada ponto que o Índice NEFESH subiu, ou 30 por manter um Índice de 70 ou mais.
 */
export function evolutionPoints(S: AppState, now = new Date()) {
  const ws = weekStart(now);
  const i = S.evals.map((e) => e.date >= ws).lastIndexOf(true);
  if (i < 1) return { points: 0, delta: null as number | null, idx: null as number | null };
  const last = indexOf(S.evals[i].sc);
  const delta = last - indexOf(S.evals[i - 1].sc);
  let pts = 20;
  if (delta > 0) pts += delta * 5;
  else if (delta >= -2 && last >= 70) pts += 30;
  return { points: Math.min(150, pts), delta, idx: last };
}

/** O que a app envia ao servidor: os dias desta semana, a sequência, o nível e o Índice. */
export function weekPayload(S: AppState, now = new Date()) {
  const ws = weekStart(now);
  const streak = activityStreak(S, now);
  const days: Record<string, { p: number; f: string; parts: Record<Flag, number> }> = {};
  for (let i = 0; i < 7; i++) {
    const k = keyDaysAgo(i, now);
    if (k < ws) break;
    const sc = dayScore(S, k, now);
    // a app envia os hábitos; os pontos oficiais são calculados no servidor, com as provas
    if (sc.points) days[k] = { p: dayPoints(S, k, streak, now), f: sc.flags, parts: sc.parts };
  }
  const evo = evolutionPoints(S, now);
  const first = S.evals[0];
  const last = S.evals[S.evals.length - 1];
  return {
    days,
    evo: evo.points,
    streak,
    level: levelOf(totalPoints(S, now)).index,
    idx: last ? indexOf(last.sc) : undefined,
    idxFirst: first ? indexOf(first.sc) : undefined,
    dose: S.ans ? slotsFor(S, now).reduce((t, x) => t + x.n, 0) : undefined,
  };
}

export const weekTotal = (p: ReturnType<typeof weekPayload>) => Object.values(p.days).reduce((t, d) => t + d.p, 0) + p.evo;
