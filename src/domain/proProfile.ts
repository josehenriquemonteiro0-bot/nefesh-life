/** Perfil do aluno registado pelo profissional (sem dependências: a app e o servidor usam-no). */
export interface StudentProfile {
  sexo: '' | 'f' | 'm';
  idade: number | null;
  altura: number | null;
  peso: number | null;
  objetivo: string;
  nivel: '' | 'iniciante' | 'intermedio' | 'avancado';
  dias: number | null;
  lesoes: string;
  notas: string;
  /** avaliação física: perímetros em cm, composição corporal, FC em repouso, data */
  medidas?: Partial<Record<MeasureKey, number | null>>;
  gordura?: number | null;
  magra?: number | null;
  fc?: number | null;
  dataAval?: string;
}

/** Perímetros (cm). */
export const MEASURES = [
  ['pescoco', 'Pescoço'], ['ombros', 'Ombros'], ['peito', 'Peito/tórax'], ['cintura', 'Cintura'], ['abdomen', 'Abdómen'], ['quadril', 'Quadril'],
  ['braco_d', 'Braço dir.'], ['braco_e', 'Braço esq.'], ['antebraco', 'Antebraço'], ['coxa_d', 'Coxa dir.'], ['coxa_e', 'Coxa esq.'], ['panturrilha', 'Panturrilha'],
] as const;
export type MeasureKey = (typeof MEASURES)[number][0];
export const MEASURE_KEYS = MEASURES.map((m) => m[0]) as MeasureKey[];

export const OBJETIVOS = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Força', 'Saúde e bem-estar', 'Reabilitação', 'Desempenho desportivo'];
export const NIVEL_NAME = { iniciante: 'iniciante', intermedio: 'intermédio', avancado: 'avançado' } as const;

const num = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
/** número com 1 casa decimal (medidas), aceita vírgula */
const dec = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')) * 10) / 10;
  return String(v ?? '').trim() !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const txt = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanProfile(p: unknown): StudentProfile {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    sexo: o.sexo === 'f' || o.sexo === 'm' ? o.sexo : '',
    idade: num(o.idade, 8, 100),
    altura: num(o.altura, 100, 230),
    peso: dec(o.peso, 25, 300),
    objetivo: txt(o.objetivo, 60),
    nivel: o.nivel === 'iniciante' || o.nivel === 'intermedio' || o.nivel === 'avancado' ? o.nivel : '',
    dias: num(o.dias, 1, 7),
    lesoes: txt(o.lesoes, 300),
    notas: txt(o.notas, 300),
    medidas: Object.fromEntries(MEASURE_KEYS.map((k) => [k, dec(((o.medidas ?? {}) as Record<string, unknown>)[k], 10, 250)]).filter(([, v]) => v !== null)),
    gordura: dec(o.gordura, 2, 70),
    magra: dec(o.magra, 15, 150),
    fc: num(o.fc, 30, 150),
    dataAval: /^\d{4}-\d{2}-\d{2}$/.test(String(o.dataAval ?? '')) ? String(o.dataAval) : '',
  };
}

export const profileEmpty = (p: StudentProfile | null | undefined) =>
  !p || Object.entries(p).every(([k, v]) => (k === 'medidas' ? !v || !Object.values(v).some((x) => x !== null && x !== undefined) : v === '' || v === null || v === undefined));

/** Uma linha curta (cartão do aluno e pedidos à IA). */
export function profileText(p: StudentProfile | null | undefined): string {
  if (!p || profileEmpty(p)) return '';
  const a = [
    p.sexo === 'f' ? 'Mulher' : p.sexo === 'm' ? 'Homem' : '',
    p.idade ? `${p.idade} anos` : '',
    p.altura ? `${p.altura} cm` : '',
    p.peso ? `${fmt(p.peso)} kg` : '',
    p.nivel ? NIVEL_NAME[p.nivel] : '',
    p.objetivo ? `objetivo: ${p.objetivo.toLowerCase()}` : '',
    p.dias ? `disponível ${p.dias}× por semana` : '',
    p.lesoes ? `lesões/limitações: ${p.lesoes}` : '',
    p.notas ? `notas: ${p.notas}` : '',
    p.gordura ? `${fmt(p.gordura)}% de gordura` : '',
    p.magra ? `${fmt(p.magra)} kg de massa magra` : '',
    p.fc ? `FC repouso ${p.fc} bpm` : '',
    measuresText(p),
  ].filter(Boolean);
  return a.join(' · ');
}

const fmt = (n: number) => String(n).replace('.', ',');

/** "cintura 72 cm, quadril 98 cm…" */
export function measuresText(p: StudentProfile | null | undefined): string {
  const m = p?.medidas ?? {};
  const a = MEASURES.filter(([k]) => m[k]).map(([k, l]) => `${l.toLowerCase()} ${fmt(m[k] as number)} cm`);
  return a.length ? `perímetros: ${a.join(', ')}${p?.dataAval ? ` (avaliação de ${p.dataAval.split('-').reverse().join('/')})` : ''}` : '';
}
