/** NEFESH Life Pro: biblioteca de exercícios por grupo muscular e divisões de treino (A, AB, ABC…). */
// sem dependências (o servidor também usa este ficheiro): mesmos campos que planRead.ts
interface WorkoutExercise { name: string; sets: number; reps: string; load: string; rest: string; notes: string }
interface PlanWorkout { name: string; focus: string; day: string; exercises: WorkoutExercise[] }

export type Group =
  | 'peito' | 'costas' | 'ombros' | 'biceps' | 'triceps' | 'quadriceps' | 'posteriores' | 'gluteos'
  | 'panturrilhas' | 'abdomen' | 'cardio' | 'mobilidade';

export const GROUP_NAME: Record<Group, string> = {
  peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps',
  quadriceps: 'Quadríceps', posteriores: 'Posteriores', gluteos: 'Glúteos', panturrilhas: 'Panturrilhas',
  abdomen: 'Abdómen', cardio: 'Cardio', mobilidade: 'Mobilidade',
};
export const GROUPS = Object.keys(GROUP_NAME) as Group[];

/** Atalhos de foco: escolher "Inferior" marca os grupos das pernas. */
export const FOCUS_PRESETS: { label: string; groups: Group[] }[] = [
  { label: 'Inferior', groups: ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'] },
  { label: 'Superior', groups: ['peito', 'costas', 'ombros', 'biceps', 'triceps'] },
  { label: 'Corpo inteiro', groups: ['quadriceps', 'gluteos', 'peito', 'costas', 'ombros', 'abdomen'] },
  { label: 'Empurrar', groups: ['peito', 'ombros', 'triceps'] },
  { label: 'Puxar', groups: ['costas', 'biceps'] },
];

export interface LibExercise { name: string; group: Group; sets: number; reps: string; rest: string }

// [nome, grupo, tipo] — tipo: c = composto (4 × 8-10), i = isolado (3 × 12), t = tempo, r = cardio
type Kind = 'c' | 'i' | 't' | 'r';
const RAW: [string, Group, Kind][] = [
  // peito
  ['Supino reto com barra', 'peito', 'c'], ['Supino reto com halteres', 'peito', 'c'], ['Supino inclinado com barra', 'peito', 'c'],
  ['Supino inclinado com halteres', 'peito', 'c'], ['Supino declinado', 'peito', 'c'], ['Supino na máquina', 'peito', 'c'],
  ['Crucifixo com halteres', 'peito', 'i'], ['Crucifixo inclinado', 'peito', 'i'], ['Peck deck (voador)', 'peito', 'i'],
  ['Crossover (cabo)', 'peito', 'i'], ['Flexões', 'peito', 'c'], ['Flexões inclinadas (mãos no banco)', 'peito', 'c'], ['Paralelas (peito)', 'peito', 'c'],
  // costas
  ['Puxada à frente', 'costas', 'c'], ['Puxada com pega fechada (triângulo)', 'costas', 'c'], ['Puxada com pega supinada', 'costas', 'c'],
  ['Barra fixa', 'costas', 'c'], ['Barra fixa assistida', 'costas', 'c'], ['Remada curvada com barra', 'costas', 'c'],
  ['Remada unilateral com halter (serrote)', 'costas', 'c'], ['Remada sentada (cabo)', 'costas', 'c'], ['Remada baixa na máquina', 'costas', 'c'],
  ['Remada cavalinho (T-bar)', 'costas', 'c'], ['Pulldown com braços estendidos', 'costas', 'i'], ['Pullover com halter', 'costas', 'i'],
  ['Hiperextensão lombar (banco romano)', 'costas', 'i'], ['Encolhimento com halteres', 'costas', 'i'],
  // ombros
  ['Desenvolvimento com halteres', 'ombros', 'c'], ['Desenvolvimento com barra', 'ombros', 'c'], ['Desenvolvimento na máquina', 'ombros', 'c'],
  ['Desenvolvimento Arnold', 'ombros', 'c'], ['Elevação lateral', 'ombros', 'i'], ['Elevação lateral no cabo', 'ombros', 'i'],
  ['Elevação frontal', 'ombros', 'i'], ['Crucifixo invertido (posterior de ombro)', 'ombros', 'i'], ['Face pull (cabo)', 'ombros', 'i'],
  ['Remada alta', 'ombros', 'i'],
  // bíceps
  ['Rosca direta com barra', 'biceps', 'i'], ['Rosca alternada com halteres', 'biceps', 'i'], ['Rosca martelo', 'biceps', 'i'],
  ['Rosca Scott', 'biceps', 'i'], ['Rosca concentrada', 'biceps', 'i'], ['Rosca no cabo', 'biceps', 'i'], ['Rosca inclinada com halteres', 'biceps', 'i'],
  // tríceps
  ['Tríceps na polia (barra)', 'triceps', 'i'], ['Tríceps corda', 'triceps', 'i'], ['Tríceps testa', 'triceps', 'i'],
  ['Tríceps francês com halter', 'triceps', 'i'], ['Tríceps coice (kickback)', 'triceps', 'i'], ['Mergulho no banco', 'triceps', 'i'],
  ['Supino fechado', 'triceps', 'c'], ['Paralelas (tríceps)', 'triceps', 'c'],
  // quadríceps
  ['Agachamento livre', 'quadriceps', 'c'], ['Agachamento goblet (com halter)', 'quadriceps', 'c'], ['Agachamento no Smith', 'quadriceps', 'c'],
  ['Agachamento frontal', 'quadriceps', 'c'], ['Agachamento búlgaro', 'quadriceps', 'c'], ['Agachamento sumô', 'quadriceps', 'c'],
  ['Hack squat', 'quadriceps', 'c'], ['Leg press 45°', 'quadriceps', 'c'], ['Leg press horizontal', 'quadriceps', 'c'],
  ['Cadeira extensora', 'quadriceps', 'i'], ['Afundo (passada)', 'quadriceps', 'c'], ['Afundo andando', 'quadriceps', 'c'],
  ['Subida no banco (step-up)', 'quadriceps', 'c'], ['Agachamento na parede (isometria)', 'quadriceps', 't'], ['Sentar e levantar da cadeira', 'quadriceps', 'c'],
  // posteriores
  ['Mesa flexora', 'posteriores', 'i'], ['Cadeira flexora', 'posteriores', 'i'], ['Flexora em pé (unilateral)', 'posteriores', 'i'],
  ['Stiff com barra', 'posteriores', 'c'], ['Stiff com halteres', 'posteriores', 'c'], ['Levantamento terra', 'posteriores', 'c'],
  ['Levantamento terra romeno', 'posteriores', 'c'], ['Good morning', 'posteriores', 'c'],
  // glúteos
  ['Elevação pélvica (hip thrust)', 'gluteos', 'c'], ['Ponte de glúteos', 'gluteos', 'i'], ['Glúteo na polia (coice)', 'gluteos', 'i'],
  ['Glúteo 4 apoios (coice)', 'gluteos', 'i'], ['Cadeira abdutora', 'gluteos', 'i'], ['Abdução com elástico', 'gluteos', 'i'],
  ['Cadeira adutora', 'gluteos', 'i'], ['Agachamento lateral', 'gluteos', 'i'],
  // panturrilhas
  ['Panturrilha em pé', 'panturrilhas', 'i'], ['Panturrilha sentada', 'panturrilhas', 'i'], ['Panturrilha no leg press', 'panturrilhas', 'i'],
  ['Panturrilha unilateral no degrau', 'panturrilhas', 'i'],
  // abdómen
  ['Prancha', 'abdomen', 't'], ['Prancha lateral', 'abdomen', 't'], ['Abdominal crunch', 'abdomen', 'i'], ['Abdominal infra (elevação de pernas)', 'abdomen', 'i'],
  ['Abdominal na polia', 'abdomen', 'i'], ['Abdominal bicicleta', 'abdomen', 'i'], ['Dead bug', 'abdomen', 'i'], ['Bird dog', 'abdomen', 'i'],
  ['Russian twist', 'abdomen', 'i'], ['Roda abdominal', 'abdomen', 'i'], ['Mountain climber', 'abdomen', 't'], ['Pallof press', 'abdomen', 'i'],
  // cardio
  ['Passadeira (caminhada)', 'cardio', 'r'], ['Passadeira (corrida)', 'cardio', 'r'], ['Bicicleta', 'cardio', 'r'], ['Elíptica', 'cardio', 'r'],
  ['Remo (ergómetro)', 'cardio', 'r'], ['Escada (simulador)', 'cardio', 'r'], ['Corda de saltar', 'cardio', 't'], ['Polichinelos', 'cardio', 't'],
  ['Burpees', 'cardio', 'i'], ['HIIT (intervalado)', 'cardio', 'r'],
  // mobilidade
  ['Mobilidade de anca', 'mobilidade', 't'], ['Mobilidade de ombros', 'mobilidade', 't'], ['Gato-camelo', 'mobilidade', 'i'],
  ['Alongamento de posteriores', 'mobilidade', 't'], ['Alongamento de peitoral', 'mobilidade', 't'], ['Rotação torácica', 'mobilidade', 'i'],
];

const DOSE: Record<Kind, Pick<LibExercise, 'sets' | 'reps' | 'rest'>> = {
  c: { sets: 4, reps: '8-10', rest: '90 s' },
  i: { sets: 3, reps: '12', rest: '60 s' },
  t: { sets: 3, reps: '30 s', rest: '30 s' },
  r: { sets: 1, reps: '20 min', rest: '' },
};

export const LIBRARY: LibExercise[] = RAW.map(([name, group, k]) => ({ name, group, ...DOSE[k] }));

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Grupos que o texto do foco refere (ex.: "inferior", "peito e tríceps", "pernas"). */
export function focusGroups(focus: string): Group[] {
  const f = norm(focus);
  if (!f) return [];
  const out = new Set<Group>();
  for (const p of FOCUS_PRESETS) if (f.includes(norm(p.label))) p.groups.forEach((g) => out.add(g));
  for (const g of GROUPS) if (f.includes(norm(GROUP_NAME[g]).slice(0, 5))) out.add(g);
  if (/perna|membros inf/.test(f)) ['quadriceps', 'posteriores', 'gluteos', 'panturrilhas'].forEach((g) => out.add(g as Group));
  if (/membros sup|braco/.test(f)) ['biceps', 'triceps'].forEach((g) => out.add(g as Group));
  if (/abdo|core/.test(f)) out.add('abdomen');
  if (/full|inteiro/.test(f)) FOCUS_PRESETS[2].groups.forEach((g) => out.add(g));
  if (/gluteo/.test(f)) out.add('gluteos');
  return [...out];
}

/**
 * Exercícios que combinam com o que se escreve. Sem texto: os do foco.
 * Com texto: todos os que contêm as palavras, primeiro os do foco.
 */
export function searchExercises(q: string, focus: string, extra: { name: string; area: string }[] = [], limit = 40): LibExercise[] {
  const groups = focusGroups(focus);
  const words = norm(q).split(/\s+/).filter(Boolean);
  const pool: LibExercise[] = [...LIBRARY];
  for (const x of extra) if (!pool.some((e) => norm(e.name) === norm(x.name))) pool.push({ name: x.name, group: focusGroups(x.area)[0] ?? 'mobilidade', sets: 3, reps: '12', rest: '60 s' });
  const hits = words.length
    ? pool.filter((e) => { const n = norm(e.name) + ' ' + norm(GROUP_NAME[e.group]); return words.every((w) => n.includes(w)); })
    : pool.filter((e) => groups.includes(e.group));
  // primeiro os grupos do foco (pela ordem), dentro de cada grupo os compostos; ao escrever, o que começa pela palavra
  const gi = (e: LibExercise) => (groups.includes(e.group) ? groups.indexOf(e.group) : 99);
  const starts = (e: LibExercise) => (words.length && !norm(e.name).startsWith(words[0]) ? 1 : 0);
  return hits
    .map((e, k) => ({ e, k }))
    .sort((a, b) => starts(a.e) - starts(b.e) || gi(a.e) - gi(b.e) || b.e.sets - a.e.sets || a.k - b.k)
    .map((x) => x.e)
    .slice(0, limit);
}

export const libExercise = (name: string) => LIBRARY.find((e) => norm(e.name) === norm(name));

/** Divisões clássicas: o foco sugerido para cada treino. */
export const SPLITS: Record<number, string[]> = {
  1: ['Corpo inteiro'],
  2: ['Superior', 'Inferior'],
  3: ['Peito, ombros e tríceps', 'Costas e bíceps', 'Inferior'],
  4: ['Peito e tríceps', 'Costas e bíceps', 'Inferior', 'Ombros e abdómen'],
  5: ['Peito', 'Costas', 'Quadríceps e panturrilhas', 'Ombros e abdómen', 'Posteriores e glúteos'],
  6: ['Peito', 'Costas', 'Quadríceps', 'Ombros', 'Bíceps e tríceps', 'Posteriores e glúteos'],
};

export const letter = (i: number) => String.fromCharCode(65 + i);
export const splitName = (n: number) => Array.from({ length: n }, (_, i) => letter(i)).join('');

const blankEx = (): WorkoutExercise => ({ name: '', sets: 3, reps: '10', load: '', rest: '60 s', notes: '' });

/** Monta (ou reajusta) os treinos para N divisões, mantendo os exercícios que já existem. */
export function applySplit(current: PlanWorkout[], n: number): PlanWorkout[] {
  const focus = SPLITS[n] ?? [];
  return Array.from({ length: n }, (_, i) => {
    const w = current[i];
    const filled = w?.exercises.some((e) => e.name.trim());
    return {
      name: `Treino ${letter(i)}`,
      focus: w && (w.focus.trim() || filled) ? w.focus : focus[i] ?? '',
      day: w?.day ?? '',
      exercises: w?.exercises.length ? w.exercises : [blankEx()],
    };
  });
}

/** Junta um exercício da biblioteca ao treino (ocupa a linha vazia do fim, se houver). */
export function addFromLibrary(w: PlanWorkout, e: LibExercise): PlanWorkout {
  const ex: WorkoutExercise = { name: e.name, sets: e.sets, reps: e.reps, load: '', rest: e.rest, notes: '' };
  const list = [...w.exercises];
  const last = list[list.length - 1];
  if (last && !last.name.trim()) list[list.length - 1] = ex;
  else list.push(ex);
  return { ...w, exercises: list.slice(0, 20) };
}
