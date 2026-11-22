/**
 * NEFESH Life Pro: avaliação física do aluno (sem dependências: a app e o servidor usam-no).
 * Composição corporal por dobras cutâneas — Jackson & Pollock (3 e 7 dobras) + equação de Siri —
 * ou % de gordura medida por outro método (bioimpedância, DEXA…).
 */
import { MEASURE_KEYS, type MeasureKey } from './proProfile';

export type Fold = 'peitoral' | 'axilar' | 'triceps' | 'subescapular' | 'abdominal' | 'suprailiaca' | 'coxa';
export const FOLD_NAME: Record<Fold, string> = {
  peitoral: 'Peitoral', axilar: 'Axilar média', triceps: 'Tríceps', subescapular: 'Subescapular', abdominal: 'Abdominal', suprailiaca: 'Suprailíaca', coxa: 'Coxa',
};
export type Protocol = 'jp3' | 'jp7' | 'medido';
export const PROTOCOL_NAME: Record<Protocol, string> = { jp3: 'Pollock 3 dobras', jp7: 'Pollock 7 dobras', medido: '% de gordura medida (bioimpedância…)' };

/** Dobras de cada protocolo (o de 3 dobras depende do sexo). */
export function foldsFor(p: Protocol, sexo: '' | 'f' | 'm'): Fold[] {
  if (p === 'jp7') return ['peitoral', 'axilar', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'];
  if (p === 'jp3') return sexo === 'f' ? ['triceps', 'suprailiaca', 'coxa'] : ['peitoral', 'abdominal', 'coxa'];
  return [];
}

export interface Assessment {
  id?: number;
  day: string;
  peso: number | null;
  altura: number | null;
  idade: number | null;
  sexo: '' | 'f' | 'm';
  protocol: Protocol;
  folds: Partial<Record<Fold, number>>;
  /** % de gordura medida (protocolo "medido") */
  gorduraMedida: number | null;
  medidas: Partial<Record<MeasureKey, number>>;
  fc: number | null;
  notas: string;
  photos?: { id: number; pose: Pose }[];
}
export type Pose = 'frente' | 'lado' | 'costas';
export const POSES: Pose[] = ['frente', 'lado', 'costas'];
export const POSE_NAME: Record<Pose, string> = { frente: 'Frente', lado: 'Lado', costas: 'Costas' };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Densidade corporal (Jackson & Pollock) → % de gordura (Siri). null se faltar algo. */
export function bodyFat(a: Pick<Assessment, 'protocol' | 'folds' | 'sexo' | 'idade' | 'gorduraMedida'>): number | null {
  if (a.protocol === 'medido') return a.gorduraMedida ?? null;
  if (!a.sexo || !a.idade) return null;
  const list = foldsFor(a.protocol, a.sexo);
  if (!list.every((f) => typeof a.folds[f] === 'number' && (a.folds[f] as number) > 0)) return null;
  const S = list.reduce((s, f) => s + (a.folds[f] as number), 0);
  const age = a.idade;
  let d: number;
  if (a.protocol === 'jp7') d = a.sexo === 'm' ? 1.112 - 0.00043499 * S + 0.00000055 * S * S - 0.00028826 * age : 1.097 - 0.00046971 * S + 0.00000056 * S * S - 0.00012828 * age;
  else d = a.sexo === 'm' ? 1.10938 - 0.0008267 * S + 0.0000016 * S * S - 0.0002574 * age : 1.0994921 - 0.0009929 * S + 0.0000023 * S * S - 0.0001392 * age;
  const pct = 495 / d - 450;
  return pct > 0 && pct < 70 ? r1(pct) : null;
}

/** Resultados calculados: % gordura, massa gorda e magra, IMC, relação cintura/quadril, soma das dobras. */
export function results(a: Assessment) {
  const gordura = bodyFat(a);
  const peso = a.peso;
  const gorda = gordura !== null && peso ? r1((peso * gordura) / 100) : null;
  const magra = gorda !== null && peso ? r1(peso - gorda) : null;
  const imc = peso && a.altura ? r1(peso / (a.altura / 100) ** 2) : null;
  const rcq = a.medidas.cintura && a.medidas.quadril ? Math.round((a.medidas.cintura / a.medidas.quadril) * 100) / 100 : null;
  const list = foldsFor(a.protocol, a.sexo);
  const somaDobras = list.length && list.every((f) => a.folds[f]) ? r1(list.reduce((s, f) => s + (a.folds[f] as number), 0)) : null;
  return { gordura, gorda, magra, imc, rcq, somaDobras };
}

const dec = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = r1(Number(String(v).replace(',', '.')));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export function cleanAssessment(x: unknown, today: string): Assessment {
  const o = (x ?? {}) as Record<string, unknown>;
  const protocol: Protocol = o.protocol === 'jp3' || o.protocol === 'jp7' ? o.protocol : 'medido';
  const folds: Partial<Record<Fold, number>> = {};
  for (const f of Object.keys(FOLD_NAME) as Fold[]) {
    const v = dec((o.folds as Record<string, unknown> | undefined)?.[f], 1, 80);
    if (v !== null) folds[f] = v;
  }
  const medidas: Partial<Record<MeasureKey, number>> = {};
  for (const k of MEASURE_KEYS) {
    const v = dec((o.medidas as Record<string, unknown> | undefined)?.[k], 10, 250);
    if (v !== null) medidas[k] = v;
  }
  const idade = dec(o.idade, 8, 100);
  return {
    day: /^\d{4}-\d{2}-\d{2}$/.test(String(o.day ?? '')) ? String(o.day) : today,
    peso: dec(o.peso, 25, 300),
    altura: dec(o.altura, 100, 230),
    idade: idade === null ? null : Math.round(idade),
    sexo: o.sexo === 'f' || o.sexo === 'm' ? o.sexo : '',
    protocol,
    folds,
    gorduraMedida: dec(o.gorduraMedida, 2, 70),
    medidas,
    fc: dec(o.fc, 30, 150),
    notas: String(o.notas ?? '').replace(/\s+/g, ' ').trim().slice(0, 300),
  };
}

/** Métricas para os gráficos de evolução. */
export const METRICS = [
  { key: 'peso', label: 'Peso', unit: 'kg' },
  { key: 'gordura', label: '% gordura', unit: '%' },
  { key: 'magra', label: 'Massa magra', unit: 'kg' },
  { key: 'cintura', label: 'Cintura', unit: 'cm' },
  { key: 'quadril', label: 'Quadril', unit: 'cm' },
  { key: 'abdomen', label: 'Abdómen', unit: 'cm' },
  { key: 'braco_d', label: 'Braço', unit: 'cm' },
  { key: 'coxa_d', label: 'Coxa', unit: 'cm' },
  { key: 'somaDobras', label: 'Soma das dobras', unit: 'mm' },
] as const;
export type MetricKey = (typeof METRICS)[number]['key'];

export function metricValue(a: Assessment, k: MetricKey): number | null {
  const r = results(a);
  if (k === 'peso') return a.peso;
  if (k === 'gordura' || k === 'magra' || k === 'somaDobras') return r[k];
  return a.medidas[k] ?? null;
}

/** Pontos de uma métrica ao longo do tempo (mais antigo primeiro). */
export const series = (list: Assessment[], k: MetricKey) =>
  [...list].sort((a, b) => a.day.localeCompare(b.day)).map((a) => ({ day: a.day, v: metricValue(a, k) })).filter((p): p is { day: string; v: number } => p.v !== null);
