export type BodyGoal = 'perder-suave' | 'perder-moderado' | 'manter' | 'ganhar-suave' | 'ganhar-moderado';
export type Goal = 'energia' | 'desporto' | 'imunidade' | 'foco' | 'nutricao' | 'peso';
export type AreaKey = 'energia' | 'sono' | 'nutricao' | 'hidratacao' | 'movimento';
export type HabitKey = 'sono' | 'passos' | 'resp';
export type Scores = Record<AreaKey, number>;

/** Respostas da avaliação. Todos os campos são opcionais durante o preenchimento. */
export interface Answers {
  name?: string;
  goal?: Goal;
  sexo?: string;
  /** idade em anos (versões antigas guardavam um intervalo, ex.: '30-44') */
  idade?: number | string;
  /** altura em cm */
  altura?: number;
  /** objetivo para o corpo */
  corpo?: BodyGoal;
  /** medidas em cm (opcionais) */
  cintura?: number;
  pescoco?: number;
  anca?: number;
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
  /** plano do nutricionista vs execução, por índice da refeição do plano */
  planLog?: Record<string, import('./planAdherence').PlanMealLog>;
  /** treinos feitos no dia */
  workouts?: import('./training').WorkoutLog[];
  /** diário alimentar do dia, por refeição */
  meals?: Partial<Record<'pa' | 'almoco' | 'lanche' | 'jantar', import('./foods').FoodEntry[]>>;
  /** passos do dia (registados ou lidos do app Saúde) */
  steps?: number;
  /** horas de sono na noite anterior */
  sleepH?: number;
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
  /** formato em que a pessoa toma a Spirulina */
  format?: 'caps' | 'po' | 'nibs';
  proDose?: ProDose | null;
  /** a pessoa prefere seguir a recomendação geral do rótulo */
  followLabel?: boolean;
  /** data em que aceitou o aviso de privacidade */
  consent?: string;
  /** código de acesso ao serviço de fotos (versões antigas) */
  photoCode?: string;
  /** metas definidas pelo nutricionista, que substituem as da app */
  nutriPro?: { kcal?: number; protein?: number; by: string; at: string } | null;
  /** assinatura Premium (para o lançamento; na fase de testes está tudo aberto) */
  premium?: boolean;
  /** plano do nutricionista lido pela IA */
  nutriPlan?: (import('./planRead').ParsedPlan & { at: string; name: string }) | null;
  /** a pessoa prefere não ver calorias */
  hideCalories?: boolean;
  /** planos carregados pela pessoa (o ficheiro fica no IndexedDB) */
  plans?: Partial<Record<'nutri' | 'treino', { name: string; type: string; size: number; at: string; by?: string }>>;
}

/** Um passo do cálculo da dose, com a sua origem: estudo ou critério NEFESH. */
export interface WhyStep {
  label: string;
  value: string;
  kind: 'evidencia' | 'criterio' | 'rotulo' | 'profissional';
  note: string;
  studies?: string[];
}

export interface ProDose {
  g: number;
  by: string;
  at: string;
}

export interface Plan {
  /** dose diária final, em gramas */
  g: number;
  /** referência dos estudos ajustada à pessoa, antes do limite do rótulo */
  gStudy: number;
  /** true quando o rótulo limitou a dose */
  capped: boolean;
  /** true quando a sugestão personalizada fica acima da recomendação geral do rótulo */
  aboveLabel: boolean;
  format: 'caps' | 'po' | 'nibs';
  /** unidades de 0,5 g (= cápsulas) */
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
  | { id: keyof Answers; t: string; kind: 'num'; min: number; max: number; def: number; unit: string; step?: number; hint?: string }
  | { id: keyof Answers; t: string; kind: 'measures'; hint: string }
  | { id: keyof Answers; t: string; kind: 'scale'; labels: [string, string] }
  | { id: keyof Answers; t: string; kind: 'options'; o: [string, string][]; multi?: boolean };
