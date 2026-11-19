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
  /** tomas feitas através de uma receita (índices), que não gastam cápsulas */
  viaRecipe?: Record<number, string>;
}

export interface Bottle {
  at: string;
  product: 'caps' | 'po' | 'nibs';
  code: string | null;
  url: string | null;
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
  bottles?: Bottle[];
}

/** Um passo do cálculo da dose, com a sua origem: estudo ou critério NEFESH. */
export interface WhyStep {
  label: string;
  value: string;
  kind: 'evidencia' | 'criterio';
  note: string;
  studies?: string[];
}

export interface Plan {
  g: number;
  caps: number;
  /** dose em g por kg de peso */
  gPerKg: number;
  why: WhyStep[];
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
