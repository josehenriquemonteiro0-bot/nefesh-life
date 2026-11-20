/** Origem dos dados: distingue o que foi medido do que foi declarado. */
import { keyDaysAgo } from './dates';
import type { AppState, DataSource, DayLog, SourcedField } from './types';

export const SOURCE_LABEL: Record<DataSource, string> = {
  integration: 'medido · app Saúde',
  device: 'medido · captura do app Saúde',
  declared: 'escrito por si',
};

/** Origem de um valor do dia (registos antigos, sem origem, contam como escritos). */
export const sourceOf = (l: DayLog | undefined, f: SourcedField): DataSource => l?.src?.[f] ?? 'declared';
export const isMeasured = (s: DataSource) => s !== 'declared';

/** Guarda a origem de um valor; sem valor, apaga também a origem. */
export function setSource(l: DayLog, f: SourcedField, s: DataSource | null) {
  const src = { ...(l.src || {}) };
  if (s && s !== 'declared') src[f] = s;
  else delete src[f];
  if (Object.keys(src).length) l.src = src;
  else delete l.src;
}

/** Nos últimos n dias com valor: quantos foram medidos e quantos escritos. */
export function sourceCount(S: AppState, f: 'steps' | 'sleepH', n = 7, now = new Date()) {
  let measured = 0;
  let declared = 0;
  for (let i = 0; i < n; i++) {
    const l = S.logs[keyDaysAgo(i, now)];
    if (l?.[f] === undefined) continue;
    if (isMeasured(sourceOf(l, f))) measured++;
    else declared++;
  }
  return { measured, declared };
}

/** Texto curto para relatórios: "medido em 5 de 7 dias" ou "escrito por si". */
export function sourceSummary(c: { measured: number; declared: number }) {
  const t = c.measured + c.declared;
  if (!t) return '';
  if (!c.measured) return 'escrito por si';
  if (!c.declared) return 'medido pelo app Saúde';
  return `medido em ${c.measured} de ${t} dias, o resto escrito por si`;
}
