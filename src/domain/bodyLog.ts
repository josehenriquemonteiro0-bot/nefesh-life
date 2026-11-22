/**
 * Corpo ao longo do tempo: peso e medidas (entradas próprias e as das reavaliações),
 * gráfico mensal e fotos de progresso privadas (só no telemóvel).
 */
import { dayKey } from './dates';
import { MEASURES as PERIMETERS, type MeasureKey } from './proProfile';
import type { AppState } from './types';

export type Measure = 'peso' | 'cintura' | 'anca' | 'pescoco' | 'gordura' | 'magra';
/** Medidas do registo rápido. */
export const MEASURES: [Measure, string, string][] = [
  ['peso', 'Peso', 'kg'],
  ['cintura', 'Cintura', 'cm'],
  ['anca', 'Anca', 'cm'],
  ['pescoco', 'Pescoço', 'cm'],
];
/** Medidas com gráfico (as do registo rápido e as da avaliação completa). */
export const CHART_MEASURES: [Measure, string, string][] = [...MEASURES, ['gordura', '% gordura', '%'], ['magra', 'Massa magra', 'kg']];
export type BodyEntry = NonNullable<AppState['bodyLog']>[number];

/** Uma avaliação completa (ajuste manual ou lida de um relatório). */
export interface FullEval {
  date: string;
  altura?: number | null;
  peso?: number | null;
  gordura?: number | null;
  magra?: number | null;
  fc?: number | null;
  medidas?: Partial<Record<MeasureKey, number | null>>;
  /** outros dados do relatório, com o nome e a unidade do documento */
  extra?: { label: string; v: number | null | undefined; u: string }[];
}

/** Chave de gráfico: uma medida conhecida ou "x:<nome>" para os outros dados do relatório. */
export type ChartKey = Measure | `x:${string}` | `p:${MeasureKey}`;
export function valueOf(e: BodyEntry, k: ChartKey): number | undefined {
  if (k.startsWith('x:')) return e.extra?.[k.slice(2)]?.v;
  if (k.startsWith('p:')) return e.medidas?.[k.slice(2) as MeasureKey];
  return e[k as Measure];
}
/** Perímetros da avaliação completa que não estão no registo rápido. */
const EXTRA_PERIMETERS = PERIMETERS.filter(([k]) => !['cintura', 'quadril', 'pescoco'].includes(k));

/** Todas as medidas que existem no histórico: [chave, nome, unidade]. Peso sempre. */
export function bodyKeys(series: BodyEntry[]): [ChartKey, string, string][] {
  const any = (k: ChartKey) => series.some((e) => valueOf(e, k) !== undefined);
  return [
    ...CHART_MEASURES.filter(([k]) => k === 'peso' || any(k)),
    ...EXTRA_PERIMETERS.map(([k, t]) => [`p:${k}`, t, 'cm'] as [ChartKey, string, string]).filter(([k]) => any(k)),
    ...extraKeys(series),
  ];
}

export interface BodyEvoRow { key: ChartKey; label: string; unit: string; first: number; firstDate: string; last: number; lastDate: string; diff: number | null }
/** Primeira e última medição de cada medida (diferença só com duas datas diferentes). */
export function bodyEvolution(series: BodyEntry[]): BodyEvoRow[] {
  return bodyKeys(series).flatMap(([key, label, unit]) => {
    const vals = series.filter((e) => valueOf(e, key) !== undefined);
    if (!vals.length) return [];
    const a = vals[0];
    const b = vals[vals.length - 1];
    const first = valueOf(a, key)!;
    const last = valueOf(b, key)!;
    const d = Math.round((last - first) * 1000) / 1000;
    return [{ key, label, unit, first, firstDate: a.date, last, lastDate: b.date, diff: vals.length > 1 && a.date !== b.date ? d : null }];
  });
}
/** Última avaliação completa (ajuste manual ou relatório). */
export const lastAssessment = (series: BodyEntry[]) => [...series].reverse().find((e) => e.fonte);
/** Outros dados que aparecem no histórico (para os gráficos), com a unidade. */
export function extraKeys(series: BodyEntry[]): [ChartKey, string, string][] {
  const m = new Map<string, string>();
  for (const e of series) for (const [k, x] of Object.entries(e.extra ?? {})) if (!m.has(k)) m.set(k, x.u);
  return [...m].map(([k, u]) => [`x:${k}`, k, u]);
}

const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function extra(e: FullEval, old?: BodyEntry['extra']) {
  const out: NonNullable<BodyEntry['extra']> = { ...(old ?? {}) };
  for (const x of e.extra ?? []) {
    const label = x.label.trim().slice(0, 40);
    if (!label) continue;
    if (typeof x.v === 'number' && Number.isFinite(x.v) && x.v >= 0) out[label] = { v: x.v, u: x.u.slice(0, 10) };
    else delete out[label];
  }
  return Object.keys(out).length ? { extra: out } : {};
}

/**
 * Guarda avaliações completas no histórico do corpo e atualiza o perfil (Answers) com a mais recente:
 * cintura/quadril/pescoço passam para as medidas do dia a dia; a % de gordura medida passa a valer no cálculo.
 */
export function saveEvals(d: AppState, evals: FullEval[], fonte: 'manual' | 'relatorio', por = '', updateWeight = true) {
  const valid = evals.filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  const before = bodySeries(d);
  const lastBefore = before[before.length - 1]?.date ?? '';
  let log = [...(d.bodyLog ?? [])];
  for (const e of valid) {
    const m = e.medidas ?? {};
    const rest = Object.fromEntries(Object.entries(m).filter(([k, v]) => has(v) && !['cintura', 'quadril', 'pescoco'].includes(k))) as Partial<Record<MeasureKey, number>>;
    const entry: BodyEntry = {
      ...(log.find((x) => x.date === e.date) ?? {}),
      date: e.date,
      ...(has(e.peso) ? { peso: e.peso } : {}),
      ...(has(m.cintura) ? { cintura: m.cintura } : {}),
      ...(has(m.quadril) ? { anca: m.quadril } : {}),
      ...(has(m.pescoco) ? { pescoco: m.pescoco } : {}),
      ...(has(e.altura) ? { altura: e.altura } : {}),
      ...(has(e.gordura) ? { gordura: e.gordura } : {}),
      ...(has(e.magra) ? { magra: e.magra } : {}),
      ...(has(e.fc) ? { fc: e.fc } : {}),
      ...(Object.keys(rest).length ? { medidas: rest } : {}),
      ...(extra(e, log.find((x) => x.date === e.date)?.extra)),
      fonte,
      ...(por.trim() ? { por: por.trim().slice(0, 80) } : {}),
    };
    log = [...log.filter((x) => x.date !== e.date), entry];
  }
  d.bodyLog = log.sort((a, b) => a.date.localeCompare(b.date));
  if (!d.ans || !valid.length) return;
  const sorted = [...valid].sort((a, b) => a.date.localeCompare(b.date));
  const newest = sorted[sorted.length - 1];
  const ans = { ...d.ans };
  const heightFrom = [...sorted].reverse().find((e) => has(e.altura));
  if (heightFrom) ans.altura = heightFrom.altura!;
  if (newest.date >= lastBefore) {
    const m = newest.medidas ?? {};
    if (updateWeight && has(newest.peso)) ans.peso = newest.peso;
    if (has(m.cintura)) ans.cintura = m.cintura;
    if (has(m.quadril)) ans.anca = m.quadril;
    if (has(m.pescoco)) ans.pescoco = m.pescoco;
  }
  const fatFrom = [...sorted].reverse().find((e) => has(e.gordura));
  if (fatFrom && fatFrom.date >= (ans.medidaData ?? '')) {
    ans.gorduraMedida = fatFrom.gordura!;
    ans.magraMedida = has(fatFrom.magra) ? fatFrom.magra : undefined;
    ans.medidaData = fatFrom.date;
    ans.medidaPor = por.trim().slice(0, 80) || undefined;
  }
  d.ans = ans;
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
export function monthly(series: BodyEntry[], m: ChartKey, n = 12, now = new Date()) {
  const out: { month: string; value: number | null }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = dayKey(d).slice(0, 7);
    const inMonth = series.filter((e) => e.date.startsWith(key) && valueOf(e, m) !== undefined);
    out.push({ month: key, value: inMonth.length ? valueOf(inMonth[inMonth.length - 1], m)! : null });
  }
  return out;
}

/** Variação de uma medida: desde o início e nos últimos 30 dias. */
export function change(series: BodyEntry[], m: ChartKey, now = new Date()) {
  const vals = series.filter((e) => valueOf(e, m) !== undefined);
  if (!vals.length) return null;
  const last = vals[vals.length - 1];
  const cut = dayKey(new Date(now.getTime() - 30 * 86400000));
  const before30 = [...vals].reverse().find((e) => e.date <= cut);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const v = (e: BodyEntry) => valueOf(e, m)!;
  return { last: v(last), lastDate: last.date, first: v(vals[0]), firstDate: vals[0].date, sinceStart: r1(v(last) - v(vals[0])), since30: before30 ? r1(v(last) - v(before30)) : null };
}

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const photoKey = (id: string) => `progresso-${id}`;

const n = (v: number) => String(v).replace('.', ',');
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
/** Uma linha para a IA e para o relatório em texto: cada medida da primeira à última medição. */
export function bodyContext(S: Pick<AppState, 'bodyLog' | 'evals'>, max = 16): string {
  const series = bodySeries(S);
  const rows = bodyEvolution(series);
  if (!rows.length) return '';
  const u = (r: BodyEvoRow) => (r.unit === '%' ? '%' : r.unit ? ` ${r.unit}` : '');
  const parts = rows.slice(0, max).map((r) => (r.diff === null ? `${r.label} ${n(r.last)}${u(r)} (${dmy(r.lastDate)})` : `${r.label} ${n(r.first)} → ${n(r.last)}${u(r)} (${dmy(r.firstDate)} → ${dmy(r.lastDate)})`));
  const last = lastAssessment(series);
  return `Medidas do corpo: ${parts.join('; ')}.${last ? ` Última avaliação completa em ${dmy(last.date)}${last.por ? ` (${last.por})` : ''}.` : ''}`;
}
