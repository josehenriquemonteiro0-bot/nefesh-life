import { keyDaysAgo, shortDate } from './dates';
import type { AppState } from './types';

/**
 * Plano vs execução: para cada refeição do plano do nutricionista, o que a pessoa fez.
 * - seguido: comeu a opção tal como está no plano
 * - alterado: comeu a refeição com alterações (quantidades, alimentos a menos ou a mais)
 * - saltado: não fez a refeição
 */
export type PlanStatus = 'seguido' | 'alterado' | 'saltado';

export interface PlanMealLog {
  status: PlanStatus;
  /** índice da opção escolhida */
  option: number;
  /** descrição curta das alterações, para o nutricionista */
  changes?: string[];
  note?: string;
}

export const STATUS_LABEL: Record<PlanStatus, string> = { seguido: 'Segui o plano', alterado: 'Com alterações', saltado: 'Não fiz' };

/** Peso de cada estado na adesão: seguido conta inteiro, alterado conta metade. */
const SCORE: Record<PlanStatus, number> = { seguido: 1, alterado: 0.5, saltado: 0 };

export function dayAdherence(S: AppState, key: string) {
  const total = S.nutriPlan?.meals.length ?? 0;
  const log = S.logs[key]?.planLog ?? {};
  const entries = Object.values(log);
  const done = entries.length;
  const followed = entries.filter((e) => e.status === 'seguido').length;
  const changed = entries.filter((e) => e.status === 'alterado').length;
  const skipped = entries.filter((e) => e.status === 'saltado').length;
  const score = entries.reduce((t, e) => t + SCORE[e.status], 0);
  return { total, done, followed, changed, skipped, pct: total ? Math.round((score / total) * 100) : 0 };
}

/** Últimos `n` dias (do mais antigo para hoje), só com dias que tiveram registos no plano. */
export function weekAdherence(S: AppState, n = 7, now = new Date()) {
  const days = Array.from({ length: n }, (_, i) => {
    const key = keyDaysAgo(n - 1 - i, now);
    return { key, ...dayAdherence(S, key) };
  });
  const logged = days.filter((d) => d.done > 0);
  const pct = logged.length ? Math.round(logged.reduce((t, d) => t + d.pct, 0) / logged.length) : null;
  return { days, pct, loggedDays: logged.length };
}

/** Alterações e notas da semana, em texto, para o relatório do nutricionista. */
export function weekChanges(S: AppState, n = 7, now = new Date()): string[] {
  const meals = S.nutriPlan?.meals ?? [];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = keyDaysAgo(i, now);
    const log = S.logs[key]?.planLog ?? {};
    for (const [idx, e] of Object.entries(log)) {
      if (e.status === 'seguido') continue;
      const label = meals[Number(idx)]?.label ?? 'Refeição';
      const what = e.status === 'saltado' ? 'não fez' : (e.changes ?? []).join('; ') || 'com alterações';
      out.push(`${shortDate(key)} · ${label}: ${what}${e.note ? ` (nota: ${e.note})` : ''}`);
    }
  }
  return out;
}

/** Descreve as alterações a partir das escolhas da pessoa. */
export function describeChanges(items: { name: string; eaten: boolean; factor: number }[], extras: string[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (!it.eaten) out.push(`sem ${it.name}`);
    else if (it.factor !== 1) out.push(`${it.name} ×${String(it.factor).replace('.', ',')}`);
  }
  for (const x of extras) out.push(`+ ${x}`);
  return out;
}
