/**
 * Treinos sugeridos no ginásio, para quem treina sem personal.
 *
 * Base: recomendações do ACSM para treino de força em adultos saudáveis —
 * iniciantes: corpo inteiro 2 a 3 vezes por semana, 1 a 3 séries de 8 a 12 repetições;
 * intermédios: divisão superior/inferior 4 vezes por semana, 3 a 4 séries de 6 a 12 repetições.
 * O objetivo para o corpo ajusta o cardio (perder gordura) e as séries (ganhar massa).
 */
import type { Answers } from './types';

export { GYM } from './gymData';
export type { GymExercise, GymLevel } from './gymData';
import { GYM, type GymLevel } from './gymData';

export interface GymSession {
  id: string;
  title: string;
  minutes: number;
  /** exercícios do ginásio (ids de GYM); vazio para cardio ou descanso */
  exercises: string[];
  rest: string;
  text: string;
  kind: 'forca' | 'cardio' | 'descanso';
}

const FULL_A = ['legpress', 'supino_maq', 'puxada', 'remada_sentada', 'prancha'];
const FULL_B = ['agachamento_goblet', 'peso_morto_romeno', 'press_ombros', 'remada_halter', 'elevacao_pelvica'];
const UPPER = ['supino_barra', 'remada_curvada', 'press_ombros', 'puxada', 'biceps', 'triceps'];
const LOWER = ['agachamento_barra', 'peso_morto_romeno', 'legpress', 'afundos_halteres', 'gemeos', 'prancha'];

/** Plano de segunda a domingo no ginásio. */
export function gymWeek(a: Answers | null | undefined, level: GymLevel): GymSession[] {
  const corpo = a?.corpo ?? (a?.goal === 'peso' ? 'perder-suave' : 'manter');
  const lose = corpo.startsWith('perder');
  const gain = corpo.startsWith('ganhar');
  const cardio = lose ? ' + 20 min de cardio (passadeira, bicicleta ou elíptica)' : '';
  const rest = gain ? '90 a 120 s entre séries' : '60 a 90 s entre séries';
  const S = (id: string, title: string, ex: string[], min: number): GymSession => ({
    id: `ginasio-${id}`,
    title,
    minutes: min + (lose ? 20 : 0),
    exercises: ex,
    rest,
    kind: 'forca',
    text: `Aqueça 5 a 10 min (passadeira ou bicicleta). ${rest}.${cardio ? ` No fim${cardio}.` : ''}`,
  });
  const C: GymSession = { id: 'ginasio-cardio', title: 'Cardio moderado', minutes: lose ? 40 : 30, exercises: [], rest: '', kind: 'cardio', text: 'Passadeira inclinada, bicicleta, elíptica ou caminhada rápida, num ritmo em que consegue falar mas não cantar.' };
  const R: GymSession = { id: 'descanso', title: 'Descanso ativo', minutes: 0, exercises: [], rest: '', kind: 'descanso', text: 'Dia livre: um passeio leve ou alongar. O músculo cresce no descanso.' };
  if (level === 'iniciante') {
    // corpo inteiro 3 vezes por semana (2 com ganhar massa é pouco: mantém 3)
    return [S('a', 'Corpo inteiro A', FULL_A, 45), lose ? C : R, S('b', 'Corpo inteiro B', FULL_B, 45), C, S('a', 'Corpo inteiro A', FULL_A, 45), lose ? C : R, R];
  }
  // superior/inferior 4 vezes por semana
  return [S('sup', 'Superior', UPPER, 55), S('inf', 'Inferior', LOWER, 55), C, S('sup', 'Superior', UPPER, 55), S('inf', 'Inferior', LOWER, 55), lose || !gain ? C : R, R];
}

/** Séries ajustadas ao objetivo: ganhar massa acrescenta uma série nos exercícios principais (intermédio). */
export function setsFor(id: string, level: GymLevel, a: Answers | null | undefined) {
  const base = GYM[id].sets[level];
  const gain = (a?.corpo ?? '').startsWith('ganhar');
  if (!gain || level !== 'intermedio') return base;
  return base.replace(/^(\d+)/, (n) => String(Math.min(5, Number(n) + 1)));
}

/** Número da carga escrita ("25", "25 kg", "2x10 kg" → 25 / 10); null se não houver número. */
export function loadKg(v: string): number | null {
  const m = v.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:kg)?\s*$/i) ?? v.replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** Junta as cargas de hoje ao histórico (uma por dia e exercício; guarda as últimas 12). */
export function logLoads(log: Record<string, { d: string; v: string }[]> | undefined, loads: Record<string, string>, day: string) {
  const out = { ...(log ?? {}) };
  for (const [id, raw] of Object.entries(loads)) {
    const v = raw.trim();
    if (!v) continue;
    const list = (out[id] ?? []).filter((x) => x.d !== day);
    out[id] = [...list, { d: day, v }].slice(-12);
  }
  return out;
}

/** Evolução das cargas: primeira e última, por exercício com pelo menos 2 registos. */
export function loadProgress(log: Record<string, { d: string; v: string }[]> | undefined, names?: Record<string, string>) {
  return Object.entries(log ?? {})
    .filter(([id, l]) => l.length >= 2 && (GYM[id] || id.startsWith('livre:')))
    .map(([id, l]) => {
      const a = loadKg(l[0].v);
      const b = loadKg(l[l.length - 1].v);
      return { id, name: GYM[id]?.name ?? names?.[id] ?? id.slice(6), first: l[0], last: l[l.length - 1], times: l.length, delta: a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null };
    })
    .sort((x, y) => (y.last.d > x.last.d ? 1 : -1));
}

