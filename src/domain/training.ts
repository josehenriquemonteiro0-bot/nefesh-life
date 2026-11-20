import type { Answers, AppState, Goal } from './types';
import { keyDaysAgo, parseKey, todayKey } from './dates';

/**
 * Guia de atividade física.
 *
 * Base: recomendações da OMS para adultos (2020): 150 a 300 min/semana de
 * atividade moderada (ou 75 a 150 min vigorosa) e fortalecimento muscular em
 * 2 ou mais dias. O plano adapta o volume ao nível e o tipo de sessão ao objetivo.
 * Exercícios de peso corporal, sem material, para fazer em casa.
 */

export type Level = 'iniciante' | 'intermedio' | 'avancado';

export interface Exercise {
  id: string;
  name: string;
  area: string;
  how: string[];
  /** repetições ou segundos por nível */
  dose: Record<Level, string>;
  easier?: string;
  caution?: string;
}

export const EXERCISES: Exercise[] = [
  { id: 'agachamento', name: 'Agachamento', area: 'Pernas e glúteos', how: ['Pés à largura dos ombros, pontas ligeiramente para fora.', 'Desça como se fosse sentar numa cadeira, costas direitas.', 'Joelhos na direção dos pés; suba a empurrar o chão.'], dose: { iniciante: '10 repetições', intermedio: '15 repetições', avancado: '20 repetições' }, easier: 'Sente-se e levante-se de uma cadeira.' },
  { id: 'flexoes', name: 'Flexões', area: 'Peito, ombros e braços', how: ['Mãos um pouco mais afastadas que os ombros.', 'Corpo em linha reta da cabeça aos pés.', 'Desça o peito até perto do chão e empurre para cima.'], dose: { iniciante: '6 repetições (apoiadas)', intermedio: '10 repetições', avancado: '15 repetições' }, easier: 'Mãos apoiadas numa mesa ou na parede.' },
  { id: 'ponte', name: 'Ponte de glúteos', area: 'Glúteos e lombar', how: ['Deitado de costas, joelhos dobrados, pés no chão.', 'Suba a anca até alinhar joelhos, anca e ombros.', 'Aperte os glúteos 2 segundos em cima e desça devagar.'], dose: { iniciante: '12 repetições', intermedio: '15 repetições', avancado: '20 repetições (uma perna)' } },
  { id: 'prancha', name: 'Prancha', area: 'Abdominais', how: ['Antebraços no chão, cotovelos por baixo dos ombros.', 'Corpo em linha reta, sem deixar a anca cair.', 'Respire normalmente durante o tempo indicado.'], dose: { iniciante: '20 segundos', intermedio: '40 segundos', avancado: '60 segundos' }, easier: 'Joelhos apoiados no chão.' },
  { id: 'afundos', name: 'Afundos', area: 'Pernas e equilíbrio', how: ['Dê um passo grande à frente.', 'Desça até os dois joelhos ficarem a 90 graus.', 'Volte à posição inicial e troque de perna.'], dose: { iniciante: '6 por perna', intermedio: '10 por perna', avancado: '14 por perna' }, easier: 'Apoie uma mão numa parede.', caution: 'Se tiver dor no joelho, faça passos mais curtos ou troque por agachamento.' },
  { id: 'remada', name: 'Remada com mochila', area: 'Costas e braços', how: ['Encha uma mochila com livros ou garrafas.', 'Incline o tronco à frente, costas direitas.', 'Puxe a mochila até à barriga e desça devagar.'], dose: { iniciante: '10 repetições', intermedio: '12 repetições', avancado: '15 repetições' } },
  { id: 'superman', name: 'Super-homem', area: 'Lombar', how: ['Deitado de barriga para baixo, braços esticados à frente.', 'Levante braços e pernas uns centímetros do chão.', 'Segure 2 segundos e desça.'], dose: { iniciante: '8 repetições', intermedio: '12 repetições', avancado: '15 repetições' } },
  { id: 'escalador', name: 'Escalador', area: 'Cardio e abdominais', how: ['Posição de flexão, braços esticados.', 'Leve um joelho ao peito e troque, em ritmo.', 'Mantenha a anca baixa.'], dose: { iniciante: '20 segundos', intermedio: '30 segundos', avancado: '45 segundos' }, easier: 'Faça devagar, um joelho de cada vez.' },
  { id: 'polichinelos', name: 'Polichinelos', area: 'Cardio', how: ['Salte abrindo pernas e braços ao mesmo tempo.', 'Salte de volta à posição inicial.', 'Aterre com suavidade.'], dose: { iniciante: '30 segundos', intermedio: '45 segundos', avancado: '60 segundos' }, easier: 'Sem salto: abra uma perna de cada vez.' },
  { id: 'gato_vaca', name: 'Gato-vaca', area: 'Mobilidade da coluna', how: ['De quatro apoios, mãos por baixo dos ombros.', 'Arredonde as costas a expirar; arqueie-as a inspirar.', 'Movimento lento e controlado.'], dose: { iniciante: '8 ciclos', intermedio: '10 ciclos', avancado: '12 ciclos' } },
  { id: 'anca', name: 'Abertura de anca', area: 'Mobilidade da anca', how: ['Em posição de afundo, joelho de trás no chão.', 'Empurre a anca à frente até sentir alongar.', 'Respire fundo; troque de lado.'], dose: { iniciante: '30 s por lado', intermedio: '40 s por lado', avancado: '45 s por lado' } },
  { id: 'peito_porta', name: 'Alongamento de peito', area: 'Ombros e postura', how: ['Antebraço apoiado na ombreira de uma porta.', 'Avance o corpo até sentir alongar o peito.', 'Mantenha e troque de lado.'], dose: { iniciante: '30 s por lado', intermedio: '30 s por lado', avancado: '40 s por lado' } },
];

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)!;

export type SessionKind = 'forca' | 'caminhada' | 'intervalos' | 'mobilidade' | 'descanso';

export interface Session {
  id: string;
  kind: SessionKind;
  title: string;
  minutes: number;
  /** minutos que contam para a meta da OMS (atividade moderada a vigorosa) */
  mvpa: number;
  exercises: string[];
  rounds?: number;
  text: string;
}

const STRENGTH_A = ['agachamento', 'flexoes', 'ponte', 'prancha', 'remada'];
const STRENGTH_B = ['afundos', 'remada', 'superman', 'flexoes', 'escalador'];
const STRENGTH_C = ['agachamento', 'remada', 'afundos', 'flexoes', 'ponte', 'prancha'];
const HIIT = ['polichinelos', 'agachamento', 'escalador', 'afundos'];
const MOBILITY = ['gato_vaca', 'anca', 'peito_porta', 'ponte'];

export function levelOf(a: Answers | null | undefined): Level {
  const v = a?.ativ;
  if (v === '5+') return 'avancado';
  if (v === '3-4') return 'intermedio';
  return 'iniciante';
}

export const LEVEL_LABEL: Record<Level, string> = { iniciante: 'Iniciante', intermedio: 'Intermédio', avancado: 'Avançado' };

function session(kind: SessionKind, level: Level, variant = ''): Session {
  const walk = { iniciante: 35, intermedio: 35, avancado: 45 }[level];
  const rounds = { iniciante: 2, intermedio: 3, avancado: 4 }[level];
  switch (kind) {
    case 'forca':
      return { id: `forca${variant}`, kind, title: `Força em casa ${variant}`.trim(), minutes: 10 + rounds * 6, mvpa: 10 + rounds * 4, exercises: variant === 'B' ? STRENGTH_B : variant === 'C' ? STRENGTH_C : STRENGTH_A, rounds, text: `${rounds} voltas ao circuito, 30 a 60 s de descanso entre exercícios.` };
    case 'caminhada':
      return { id: 'caminhada', kind, title: 'Caminhada rápida', minutes: walk, mvpa: walk, exercises: [], text: 'Ritmo em que consegue falar mas não cantar. Conta também para os passos do dia.' };
    case 'intervalos':
      return { id: 'intervalos', kind, title: 'Cardio intervalado', minutes: 10 + rounds * 4, mvpa: 10 + rounds * 4, exercises: HIIT, rounds, text: `${rounds} voltas: cada exercício no tempo indicado, 20 s de pausa entre eles.` };
    case 'mobilidade':
      return { id: 'mobilidade', kind, title: 'Mobilidade e alongamento', minutes: 15, mvpa: 0, exercises: MOBILITY, rounds: 1, text: 'Dia de recuperação: movimentos lentos, sem dor. O descanso também faz parte do treino.' };
    default:
      return { id: 'descanso', kind: 'descanso', title: 'Descanso ativo', minutes: 0, mvpa: 0, exercises: [], text: 'Dia livre: um passeio leve ou alongar, se apetecer. O descanso também faz parte do treino.' };
  }
}

/** Plano de segunda a domingo, por nível e objetivo. O nível pode ser escolhido pela pessoa. */
export function weekPlan(a: Answers | null | undefined, chosen?: Level): Session[] {
  const level = chosen ?? levelOf(a);
  const goal: Goal = a?.goal ?? 'energia';
  const F = (v: string) => session('forca', level, v);
  const W = session('caminhada', level);
  const I = session('intervalos', level);
  const M = session('mobilidade', level);
  // 4 dias de caminhada ou cardio, 2 de força e 1 de mobilidade (dia de recuperação)
  const plans: Record<Goal, Session[]> = {
    peso: [W, F('A'), I, W, F('B'), W, M],
    desporto: [F('A'), W, I, F('B'), W, W, M],
    energia: [W, F('A'), W, M, F('B'), W, W],
    foco: [W, F('A'), W, M, F('B'), W, W],
    imunidade: [W, F('A'), W, M, F('B'), W, W],
    nutricao: [W, F('A'), W, M, F('B'), W, W],
  };
  // o objetivo para o corpo tem prioridade: ganhar massa pede 3 dias de força; perder gordura, mais cardio
  const corpo = a?.corpo ?? (goal === 'peso' ? 'perder-suave' : 'manter');
  const plan = corpo.startsWith('ganhar') ? [F('A'), W, F('B'), W, F('C'), W, M] : corpo.startsWith('perder') ? plans.peso : plans[goal];
  // iniciantes: substituir o intervalado por caminhada
  return level === 'iniciante' ? plan.map((s) => (s.kind === 'intervalos' ? W : s)) : plan;
}

export const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
/** Índice 0 = segunda-feira. */
export const weekdayIndex = (d = new Date()) => (d.getDay() + 6) % 7;

export interface WorkoutLog {
  sessionId: string;
  title: string;
  minutes: number;
  mvpa: number;
  strength: boolean;
}

/** Minutos de atividade e dias de força na semana atual (segunda a domingo). */
export function weekProgress(S: AppState, now = new Date()) {
  const start = weekdayIndex(now);
  let mvpa = 0;
  let strengthDays = 0;
  const doneDays: boolean[] = Array(7).fill(false);
  for (let i = 0; i <= start; i++) {
    const k = keyDaysAgo(start - i, now);
    const ws = S.logs[k]?.workouts || [];
    if (ws.length) doneDays[i] = true;
    mvpa += ws.reduce((t, w) => t + w.mvpa, 0);
    if (ws.some((w) => w.strength)) strengthDays++;
  }
  return { mvpa, strengthDays, doneDays, goalMin: 150, goalStrength: 2 };
}

export const isToday = (k: string, now = new Date()) => parseKey(k).getTime() === parseKey(todayKey(now)).getTime();
