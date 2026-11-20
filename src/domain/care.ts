/**
 * Prevenção: check-ups, rastreios e vacinas recomendados pela idade e pelo sexo, com a data
 * da última vez e a próxima; resultados de análises com a evolução; consultas.
 * Orientação geral (Portugal e Brasil): o médico de família decide o que se aplica a cada pessoa.
 */
import { dayKey } from './dates';
import type { AppState } from './types';

export interface PrevItem {
  id: string;
  label: string;
  kind: 'checkup' | 'rastreio' | 'vacina';
  /** de quanto em quanto tempo (meses) */
  every: (age: number) => number;
  applies: (age: number, sex: 'f' | 'm' | undefined, S: Pick<AppState, 'women' | 'ans'>) => boolean;
  note: string;
}

export const PREVENTION: PrevItem[] = [
  { id: 'checkup', label: 'Consulta de rotina (médico de família)', kind: 'checkup', every: (a) => (a >= 40 ? 12 : 24), applies: (a) => a >= 18, note: 'Revisão geral, peso, hábitos e o que deve vigiar na sua idade.' },
  { id: 'tensao', label: 'Medir a tensão arterial', kind: 'checkup', every: () => 12, applies: (a) => a >= 18, note: 'Pode medir na farmácia. Valores repetidos acima de 140/90 merecem consulta.' },
  { id: 'analises', label: 'Análises de rotina (glicemia e colesterol)', kind: 'checkup', every: (a) => (a >= 40 ? 12 : 36), applies: (a) => a >= 18, note: 'Peça ao médico; registe os resultados aqui para ver a evolução.' },
  { id: 'dentista', label: 'Dentista e higiene oral', kind: 'checkup', every: () => 12, applies: () => true, note: 'Uma vez por ano, ou como o seu dentista indicar.' },
  { id: 'olhos', label: 'Consulta de olhos', kind: 'checkup', every: (a) => (a >= 40 ? 24 : 36), applies: (a) => a >= 18, note: 'A partir dos 40 a vista cansada é comum; com diabetes, todos os anos.' },
  { id: 'colo', label: 'Rastreio do cancro do colo do útero', kind: 'rastreio', every: () => 36, applies: (a, s) => s === 'f' && a >= 25 && a <= 65, note: 'Citologia ou teste de HPV, conforme o programa do seu país.' },
  { id: 'mama', label: 'Mamografia', kind: 'rastreio', every: () => 24, applies: (a, s) => s === 'f' && a >= 45 && a <= 74, note: 'Rastreio do cancro da mama, de 2 em 2 anos, conforme o médico.' },
  { id: 'intestino', label: 'Rastreio do cancro do intestino', kind: 'rastreio', every: () => 24, applies: (a) => a >= 50 && a <= 74, note: 'Pesquisa de sangue oculto nas fezes ou colonoscopia, conforme o médico.' },
  { id: 'prostata', label: 'Conversar com o médico sobre a próstata', kind: 'rastreio', every: () => 24, applies: (a, s) => s === 'm' && a >= 50, note: 'Decisão partilhada sobre o PSA e o exame.' },
  { id: 'osso', label: 'Densitometria óssea', kind: 'rastreio', every: () => 24, applies: (a, s, S) => s === 'f' && (a >= 65 || S.women?.mode === 'menopausa'), note: 'Avalia o risco de osteoporose.' },
  { id: 'tetano', label: 'Vacina do tétano e difteria', kind: 'vacina', every: () => 120, applies: () => true, note: 'Reforço de 10 em 10 anos (no Brasil, dT de 10 em 10 anos).' },
  { id: 'gripe', label: 'Vacina da gripe', kind: 'vacina', every: () => 12, applies: (a, _s, S) => a >= 60 || S.women?.mode === 'gravidez' || (S.ans?.safe ?? []).some((x) => x === 'auto' || x === 'antico'), note: 'Todos os outonos, recomendada a partir dos 60 anos, na gravidez e em doenças crónicas.' },
];

const addMonths = (k: string, m: number) => {
  const d = new Date(`${k}T12:00:00`);
  d.setMonth(d.getMonth() + m);
  return dayKey(d);
};
const ageOf = (S: Pick<AppState, 'ans'>) => (typeof S.ans?.idade === 'number' ? S.ans.idade : Number(String(S.ans?.idade ?? '').slice(0, 2)) || 35);

export type PrevStatus = 'atrasado' | 'breve' | 'em-dia' | 'sem-data';

/** Lista de prevenção da pessoa: o que se aplica, quando foi a última vez e quando é a próxima. */
export function preventionFor(S: Pick<AppState, 'ans' | 'women' | 'care'>, now = new Date()) {
  const age = ageOf(S);
  const sex = S.ans?.sexo === 'f' ? 'f' : S.ans?.sexo === 'm' ? 'm' : undefined;
  const today = dayKey(now);
  const soon = dayKey(new Date(now.getTime() + 30 * 86400000));
  return PREVENTION.filter((p) => p.applies(age, sex, S)).map((p) => {
    const last = S.care?.prev?.[p.id];
    const next = last ? addMonths(last, p.every(age)) : null;
    const status: PrevStatus = !next ? 'sem-data' : next < today ? 'atrasado' : next <= soon ? 'breve' : 'em-dia';
    return { ...p, months: p.every(age), last, next, status };
  });
}

/* ---------- análises ---------- */

export interface LabDef {
  key: string;
  name: string;
  unit: string;
  ref: (sex?: 'f' | 'm') => [number | null, number | null];
}

export const LABS: LabDef[] = [
  { key: 'glicemia', name: 'Glicemia em jejum', unit: 'mg/dL', ref: () => [70, 99] },
  { key: 'hba1c', name: 'Hemoglobina glicada (HbA1c)', unit: '%', ref: () => [null, 5.6] },
  { key: 'colesterol', name: 'Colesterol total', unit: 'mg/dL', ref: () => [null, 190] },
  { key: 'ldl', name: 'Colesterol LDL', unit: 'mg/dL', ref: () => [null, 115] },
  { key: 'hdl', name: 'Colesterol HDL', unit: 'mg/dL', ref: (s) => [s === 'f' ? 45 : 40, null] },
  { key: 'trigliceridos', name: 'Triglicéridos', unit: 'mg/dL', ref: () => [null, 150] },
  { key: 'vitd', name: 'Vitamina D (25-OH)', unit: 'ng/mL', ref: () => [30, 100] },
  { key: 'ferritina', name: 'Ferritina', unit: 'ng/mL', ref: (s) => (s === 'f' ? [15, 150] : [30, 400]) },
  { key: 'hemoglobina', name: 'Hemoglobina', unit: 'g/dL', ref: (s) => (s === 'f' ? [12, 15.5] : [13.5, 17.5]) },
  { key: 'b12', name: 'Vitamina B12', unit: 'pg/mL', ref: () => [200, 900] },
  { key: 'tsh', name: 'TSH (tiroide)', unit: 'mUI/L', ref: () => [0.4, 4] },
  { key: 'creatinina', name: 'Creatinina', unit: 'mg/dL', ref: (s) => (s === 'f' ? [0.5, 1.1] : [0.7, 1.3]) },
  { key: 'acidourico', name: 'Ácido úrico', unit: 'mg/dL', ref: (s) => (s === 'f' ? [2.4, 6] : [3.4, 7]) },
  { key: 'psa', name: 'PSA', unit: 'ng/mL', ref: () => [null, 4] },
];
export const labDef = (key: string) => LABS.find((l) => l.key === key);

export interface LabResult {
  id: string;
  date: string;
  key: string;
  name: string;
  value: number;
  unit: string;
  /** referência do laboratório (se a pessoa a escrever), senão a geral */
  lo?: number | null;
  hi?: number | null;
}

/** Fora da referência? (só informa: quem interpreta é o médico) */
export function labFlag(r: LabResult, sex?: 'f' | 'm'): 'baixo' | 'alto' | null {
  const [lo, hi] = r.lo !== undefined || r.hi !== undefined ? [r.lo ?? null, r.hi ?? null] : labDef(r.key)?.ref(sex) ?? [null, null];
  if (lo !== null && r.value < lo) return 'baixo';
  if (hi !== null && r.value > hi) return 'alto';
  return null;
}

/** Evolução por análise: do mais antigo ao mais recente, com a variação desde o anterior. */
export function labSeries(S: Pick<AppState, 'care'>) {
  const by = new Map<string, LabResult[]>();
  for (const r of [...(S.care?.labs ?? [])].sort((a, b) => a.date.localeCompare(b.date))) by.set(r.key, [...(by.get(r.key) ?? []), r]);
  return [...by.entries()].map(([key, list]) => {
    const last = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    return { key, name: last.name, unit: last.unit, list, last, change: prev ? Math.round((last.value - prev.value) * 100) / 100 : null };
  });
}

/* ---------- consultas ---------- */

export interface Visit {
  id: string;
  date: string;
  kind: string;
  who?: string;
  note?: string;
}
export const VISIT_KINDS = ['Médico de família', 'Nutricionista', 'Ginecologia', 'Cardiologia', 'Endocrinologia', 'Dermatologia', 'Dentista', 'Oftalmologia', 'Psicologia', 'Fisioterapia', 'Personal trainer', 'Outra'];

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Linhas para o relatório ao médico: análises (com a evolução), medicação e prevenção. */
export function careReportLines(S: Pick<AppState, 'ans' | 'women' | 'care'>, now = new Date()) {
  const sex = S.ans?.sexo === 'f' ? 'f' : S.ans?.sexo === 'm' ? 'm' : undefined;
  const fmtN = (n: number) => String(n).replace('.', ',');
  const d = (k: string) => k.split('-').reverse().join('/');
  const labs = labSeries(S).map((s) => {
    const flag = labFlag(s.last, sex);
    return `${s.name}: ${s.list.slice(-4).map((r) => `${fmtN(r.value)} (${d(r.date)})`).join(' → ')} ${s.unit}${flag ? ` [${flag === 'alto' ? 'acima' : 'abaixo'} da referência]` : ''}`;
  });
  const meds = (S.care?.meds ?? []).filter((m) => m.active).map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''} às ${m.times.join(', ')}${m.kind === 'suplemento' ? ' (suplemento)' : ''}${m.by ? ` · receitado por ${m.by}` : ''}`);
  const prev = preventionFor(S, now)
    .filter((p) => p.status === 'atrasado' || p.status === 'sem-data')
    .map((p) => `${p.label}: ${p.last ? `última em ${d(p.last)} (em atraso)` : 'sem data registada'}`);
  return { labs, meds, prev };
}
