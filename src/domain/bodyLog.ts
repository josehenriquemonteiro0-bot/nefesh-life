/**
 * Corpo ao longo do tempo: peso e medidas (entradas próprias e as das reavaliações),
 * gráfico mensal e fotos de progresso privadas (só no telemóvel).
 */
import { dayKey } from './dates';
import type { AppState } from './types';

export type Measure = 'peso' | 'cintura' | 'anca' | 'pescoco';
export const MEASURES: [Measure, string, string][] = [
  ['peso', 'Peso', 'kg'],
  ['cintura', 'Cintura', 'cm'],
  ['anca', 'Anca', 'cm'],
  ['pescoco', 'Pescoço', 'cm'],
];
export interface BodyEntry {
  date: string;
  peso?: number;
  cintura?: number;
  anca?: number;
  pescoco?: number;
}

/** Todas as medições por data (as do registo do corpo e as das reavaliações). */
export function bodySeries(S: Pick<AppState, 'bodyLog' | 'evals'>): BodyEntry[] {
  const by = new Map<string, BodyEntry>();
  for (const e of S.evals ?? []) {
    if (!e.body) continue;
    const date = e.date.slice(0, 10);
    by.set(date, { ...(by.get(date) ?? { date }), peso: e.body.peso, ...(e.body.cintura ? { cintura: e.body.cintura } : {}) });
  }
  for (const e of S.bodyLog ?? []) by.set(e.date, { ...(by.get(e.date) ?? { date: e.date }), ...e });
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Último valor de cada mês (últimos n meses, do mais antigo para o atual). */
export function monthly(series: BodyEntry[], m: Measure, n = 12, now = new Date()) {
  const out: { month: string; value: number | null }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = dayKey(d).slice(0, 7);
    const inMonth = series.filter((e) => e.date.startsWith(key) && e[m] !== undefined);
    out.push({ month: key, value: inMonth.length ? inMonth[inMonth.length - 1][m]! : null });
  }
  return out;
}

/** Variação de uma medida: desde o início e nos últimos 30 dias. */
export function change(series: BodyEntry[], m: Measure, now = new Date()) {
  const vals = series.filter((e) => e[m] !== undefined);
  if (!vals.length) return null;
  const last = vals[vals.length - 1];
  const cut = dayKey(new Date(now.getTime() - 30 * 86400000));
  const before30 = [...vals].reverse().find((e) => e.date <= cut);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return { last: last[m]!, lastDate: last.date, first: vals[0][m]!, firstDate: vals[0].date, sinceStart: r1(last[m]! - vals[0][m]!), since30: before30 ? r1(last[m]! - before30[m]!) : null };
}

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const photoKey = (id: string) => `progresso-${id}`;
