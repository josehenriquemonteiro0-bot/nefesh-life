export type Goal = 'energia' | 'desporto' | 'imunidade' | 'foco' | 'nutricao' | 'peso';
export type AreaKey = 'energia' | 'sono' | 'nutricao' | 'hidratacao' | 'movimento';
export type HabitKey = 'sono' | 'passos' | 'resp';
export type Scores = Record<AreaKey, number>;

/** Respostas da avaliação. Todos os campos são opcionais durante o preenchimento. */
export interface Answers {
  name?: string;
  goal?: Goal;
  sexo?: string;
  idade?: string;
  peso?: number;
  ativ?: string;
  sonoh?: string;
  sonoq?: number;
  energia?: number;
  stress?: number;
  agua?: string;
  cafe?: string;
  veg?: string;
  proc?: string;
  dieta?: string;
  prior?: string;
  safe?: string[];
}

export interface DayLog {
  doses?: boolean[];
  water?: number;
  hab?: Partial<Record<HabitKey, boolean>>;
  /** energia, sono, disposição (1–5) */
  e?: number;
  s?: number;
  d?: number;
  /** treino: 0 nenhum, 1 leve, 2 moderado, 3 intenso */
  t?: number;
}

export interface Evaluation {
  date: string;
  sc: Scores;
}

export interface AppState {
  sample: boolean;
  intro?: boolean;
  health?: boolean;
  notifications?: boolean;
  ans: Answers | null;
  planStart: string | null;
  reminder: string;
  stockStart: string;
  stockCaps: number;
  logs: Record<string, DayLog>;
  evals: Evaluation[];
}

export interface Plan {
  g: number;
  caps: number;
  why: [string, string][];
  flags: string[];
  start: boolean;
  when: string;
  water: number;
}

export interface Slot {
  l: string;
  n: number;
}

export type Question =
  | { id: keyof Answers; t: string; kind: 'text'; placeholder: string }
  | { id: keyof Answers; t: string; kind: 'num'; min: number; max: number; def: number; unit: string }
  | { id: keyof Answers; t: string; kind: 'scale'; labels: [string, string] }
  | { id: keyof Answers; t: string; kind: 'options'; o: [string, string][]; multi?: boolean };
