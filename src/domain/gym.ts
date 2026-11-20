/**
 * Treinos sugeridos no ginásio, para quem treina sem personal.
 *
 * Base: recomendações do ACSM para treino de força em adultos saudáveis —
 * iniciantes: corpo inteiro 2 a 3 vezes por semana, 1 a 3 séries de 8 a 12 repetições;
 * intermédios: divisão superior/inferior 4 vezes por semana, 3 a 4 séries de 6 a 12 repetições.
 * O objetivo para o corpo ajusta o cardio (perder gordura) e as séries (ganhar massa).
 */
import type { Answers } from './types';

export type GymLevel = 'iniciante' | 'intermedio';

export interface GymExercise {
  name: string;
  area: string;
  /** séries × repetições por nível */
  sets: Record<GymLevel, string>;
  /** dica curta de segurança/execução */
  tip: string;
}

export const GYM: Record<string, GymExercise> = {
  legpress: { name: 'Leg press', area: 'Pernas', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Pés à largura dos ombros; não bloqueie os joelhos em cima.' },
  supino_maq: { name: 'Supino na máquina', area: 'Peito', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Pegas à altura do peito; empurre sem tirar as costas do banco.' },
  puxada: { name: 'Puxada à frente', area: 'Costas', sets: { iniciante: '3 × 12', intermedio: '4 × 10' }, tip: 'Puxe a barra até ao peito com o tronco ligeiramente inclinado para trás.' },
  remada_sentada: { name: 'Remada sentada (cabo)', area: 'Costas', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Costas direitas; puxe os cotovelos para trás e aperte as omoplatas.' },
  prancha: { name: 'Prancha', area: 'Abdominais', sets: { iniciante: '3 × 20 s', intermedio: '3 × 45 s' }, tip: 'Corpo em linha reta, sem deixar a anca cair.' },
  agachamento_goblet: { name: 'Agachamento goblet (com halter)', area: 'Pernas e glúteos', sets: { iniciante: '3 × 10', intermedio: '3 × 12' }, tip: 'Halter junto ao peito; desça com as costas direitas e os joelhos na linha dos pés.' },
  peso_morto_romeno: { name: 'Peso morto romeno (halteres)', area: 'Posteriores e glúteos', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Leve a anca atrás com os joelhos ligeiramente fletidos; costas sempre direitas.' },
  press_ombros: { name: 'Press de ombros (máquina ou halteres)', area: 'Ombros', sets: { iniciante: '3 × 12', intermedio: '3 × 10' }, tip: 'Não arqueie a lombar; desça até as mãos ficarem à altura das orelhas.' },
  remada_halter: { name: 'Remada unilateral com halter', area: 'Costas', sets: { iniciante: '3 × 10 por lado', intermedio: '3 × 10 por lado' }, tip: 'Apoie a mão e o joelho num banco; puxe o halter até à anca.' },
  elevacao_pelvica: { name: 'Elevação pélvica', area: 'Glúteos', sets: { iniciante: '3 × 12', intermedio: '4 × 10' }, tip: 'Costas apoiadas no banco; suba a anca e aperte os glúteos em cima.' },
  supino_barra: { name: 'Supino com barra', area: 'Peito', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Desça a barra até ao meio do peito; peça a alguém para o ajudar com cargas altas.' },
  remada_curvada: { name: 'Remada curvada com barra', area: 'Costas', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Tronco inclinado, costas direitas; puxe a barra até ao umbigo.' },
  agachamento_barra: { name: 'Agachamento com barra', area: 'Pernas e glúteos', sets: { iniciante: '3 × 10', intermedio: '4 × 8' }, tip: 'Comece com carga leve e aprenda a técnica; desça até as coxas ficarem paralelas ao chão.' },
  afundos_halteres: { name: 'Afundos com halteres', area: 'Pernas e equilíbrio', sets: { iniciante: '3 × 8 por perna', intermedio: '3 × 10 por perna' }, tip: 'Passo grande; os dois joelhos a 90 graus.' },
  biceps: { name: 'Curl de bíceps', area: 'Braços', sets: { iniciante: '2 × 12', intermedio: '3 × 10' }, tip: 'Cotovelos junto ao corpo; desça devagar.' },
  triceps: { name: 'Tríceps na polia', area: 'Braços', sets: { iniciante: '2 × 12', intermedio: '3 × 12' }, tip: 'Cotovelos fixos ao lado do corpo; estique os braços por completo.' },
  gemeos: { name: 'Gémeos em pé', area: 'Pernas', sets: { iniciante: '2 × 15', intermedio: '3 × 15' }, tip: 'Suba até à ponta dos pés e desça devagar.' },
};

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
export function loadProgress(log: Record<string, { d: string; v: string }[]> | undefined) {
  return Object.entries(log ?? {})
    .filter(([id, l]) => l.length >= 2 && GYM[id])
    .map(([id, l]) => {
      const a = loadKg(l[0].v);
      const b = loadKg(l[l.length - 1].v);
      return { id, name: GYM[id].name, first: l[0], last: l[l.length - 1], times: l.length, delta: a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null };
    })
    .sort((x, y) => (y.last.d > x.last.d ? 1 : -1));
}

