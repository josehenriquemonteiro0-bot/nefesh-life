export type BodyGoal = 'perder-suave' | 'perder-moderado' | 'manter' | 'ganhar-suave' | 'ganhar-moderado';
export type Goal = 'energia' | 'desporto' | 'imunidade' | 'foco' | 'nutricao' | 'peso';
export type AreaKey = 'energia' | 'sono' | 'nutricao' | 'hidratacao' | 'movimento';
/** 'passos' fica para registos antigos; o hábito de passos passou para o cartão dos passos */
export type HabitKey = 'sono' | 'passos' | 'resp' | 'veg';
export type Scores = Record<AreaKey, number>;
/**
 * Origem de um dado (especificação v2, secção 7):
 * device = medido por um aparelho e lido de uma captura do app Saúde;
 * integration = chegou sozinho do app Saúde / Apple Watch (atalho NEFESH Saúde);
 * declared = escrito ou tocado pela pessoa.
 */
export type DataSource = 'device' | 'integration' | 'declared';
export type SourcedField = 'steps' | 'sleepH' | 'exMin';

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
  /** % de gordura e massa magra medidas (avaliação física, bioimpedância, relatório), com a data e quem mediu */
  gorduraMedida?: number;
  magraMedida?: number;
  medidaData?: string;
  medidaPor?: string;
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
  /** a pessoa saltou as medidas na pergunta do dia (não voltar a pedir) */
  medidasSaltadas?: boolean;
  prior?: string;
  safe?: string[];
}

export interface DayLog {
  doses?: boolean[];
  /** número de tomas desse dia quando foram marcadas (a dose muda depois da adaptação) */
  slots?: number;
  water?: number;
  hab?: Partial<Record<HabitKey, boolean>>;
  /** energia, sono, disposição (1–5) */
  e?: number;
  s?: number;
  d?: number;
  /** fome (1–5), no check-in de quem faz jejum */
  hunger?: number;
  /** treino: 0 nenhum, 1 leve, 2 moderado, 3 intenso */
  t?: number;
  /** plano do nutricionista vs execução, por índice da refeição do plano */
  planLog?: Record<string, import('./planAdherence').PlanMealLog>;
  /** plano de treino do personal vs execução, por índice do treino */
  trainLog?: Record<string, import('./trainAdherence').TrainSessionLog>;
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
  /** relatos guardados pelo assistente (ex.: "dificuldade em recuperar dos treinos") */
  notes?: string[];
  /** tomas de medicação e suplementos (id@HH:MM → tomada) */
  meds?: Record<string, boolean>;
  /** stress (1–5), gratidão (até 3 frases) e minutos de respiração guiada (o humor é a disposição, d) */
  stress?: number;
  grat?: string[];
  breath?: number;
  /** minutos de meditação guiada */
  medit?: number;
  /** ciclo menstrual / menopausa / gravidez: menstruação, fluxo (1–3) e sintomas */
  /** ciclo: menstruação (fluxo 1 leve … 4 muito intenso), borra, sintomas, dor 0–10, muco, relação (p protegida, u sem proteção), libido, testes de ovulação e gravidez, produtos */
  cycle?: {
    p?: boolean; flow?: 1 | 2 | 3 | 4; sy?: string[]; spot?: boolean; pain?: number; mucus?: import('./cycleData').Mucus;
    sex?: 'p' | 'u'; libido?: 1 | 2 | 3; ovt?: '+' | '-'; pt?: '+' | '-'; prod?: string[];
  };
  /** origem de cada valor medível (sem entrada = escrito pela pessoa) */
  src?: Partial<Record<SourcedField, DataSource>>;
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
  /** medidas no dia da avaliação, para comparar antes e depois */
  body?: { peso: number; bmi?: number; fat?: number; cintura?: number };
  /** áreas calculadas com respostas em falta (acertadas quando a pessoa responde às perguntas do dia) */
  prov?: AreaKey[];
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
  /** perguntas do dia: quantas hoje e as adiadas hoje */
  laterAsk?: { d: string; n: number; skip?: string[] };
  /** última pergunta do dia mostrada (e a que foi para o fim da fila hoje) */
  laterLast?: { id: string; d: string; demote?: string };
  /** último "agora não" ao pedido de conta */
  accountAsk?: string;
  /** desafio da semana (micro-ação para o pilar mais fraco) */
  challenge?: import('./firstWeek').Challenge;
  /** cartões da primeira semana já fechados (dias) */
  journeySeen?: number[];
  /** Início progressivo (só para quem começou com esta versão) e o interruptor do Perfil */
  homeProgressive?: boolean;
  homeAll?: boolean;
  /** último insight da Evolução já visto (n.º de check-ins) */
  insightSeen?: number;
  /** o ecrã dos 30 dias já foi visto */
  month30Seen?: boolean;
  bottles?: Bottle[];
  /** formato em que a pessoa toma a Spirulina */
  format?: 'caps' | 'po' | 'nibs';
  proDose?: ProDose | null;
  /** ligação ao personal pelo NEFESH Life Pro (código, nome, versão do plano) */
  proLink?: { code: string; pro: string; version: number; at: string };
  /** o aluno partilha o resumo de bem-estar com o personal (autorização revogável); at = último envio */
  /** NEFESH Pro: nutricionista (ou médico) a que a pessoa está ligada, o plano dele e a partilha do resumo */
  nutriLink?: { code: string; pro: string; version: number; at: string };
  proNutriRx?: import('./proNutri').NutriRx | null;
  nutriShare?: { on: boolean; at?: string; body?: boolean; labs?: boolean };
  /** jejum intermitente: definições, jejuns feitos e prescrição de um profissional por ativar */
  fasting?: import('./fasting').FastingSettings | null;
  fastSessions?: import('./fasting').FastSession[];
  fastingRx?: import('./fasting').FastingRx | null;
  proShare?: { on: boolean; at?: string; /** também as medidas e avaliações do corpo */ body?: boolean };
  /** a pessoa prefere seguir a recomendação geral do rótulo */
  followLabel?: boolean;
  /** data em que aceitou o aviso de privacidade */
  consent?: string;
  /** código de acesso ao serviço de fotos (versões antigas) */
  photoCode?: string;
  /** metas definidas pelo nutricionista, que substituem as da app */
  nutriPro?: { kcal?: number; protein?: number; by: string; at: string } | null;
  /** assinatura Premium (para o lançamento; na fase de testes está tudo aberto) */
  /** Premium ativo: origem e validade (o formato antigo `true` conta como teste) */
  premium?: boolean | import('./features').PremiumInfo;
  /** dicas de execução já pedidas, por nome do exercício */
  exerciseTips?: Record<string, import('./tips').ExerciseTip>;
  /** plano de treino do personal lido pela IA */
  trainPlan?: (import('./planRead').ParsedWorkoutPlan & { at: string; name: string }) | null;
  /** plano do nutricionista lido pela IA */
  nutriPlan?: (import('./planRead').ParsedPlan & { at: string; name: string }) | null;
  /** ligação ao app Saúde pelo atalho: data em que foi ligada e última receção */
  health2?: { since: string; lastAt?: string };
  /** onde treina (separador do Treino que abre primeiro) */
  trainWhere?: 'personal' | 'ginasio' | 'casa';
  /** últimas cargas usadas no ginásio, por exercício */
  gymLoads?: Record<string, string>;
  /** produtos lidos pelo código de barras (ou pela foto do rótulo), por código */
  scanned?: Record<string, import('./barcode').ScannedFood>;
  /** nomes dos exercícios livres (fora da lista do ginásio) registados por voz */
  exNames?: Record<string, string>;
  /** histórico das cargas no ginásio, por exercício (mais antigo primeiro) */
  gymLoadLog?: Record<string, { d: string; v: string }[]>;
  /** progressão automática por exercício (ginásio pelo id; em casa "casa:id") */
  prog?: import('./progression').Prog;
  /** semana leve (menos uma série, sem subir cargas) */
  trainDeload?: { from: string; to: string };
  /** corridas, caminhadas e voltas de bicicleta com GPS (o percurso fica na base de ficheiros local) */
  runs?: import('./gps').RunSummary[];
  /** plano de corrida que se ajusta (do sofá aos 5 km, 10 km) */
  runPlan?: import('./runPlans').RunPlanState;
  /** false quando a pessoa desliga as notificações da comunidade */
  communityPush?: boolean;
  /** tutorial guiado já visto */
  tourDone?: boolean;
  /** língua do reconhecimento de voz (por omissão, a do telemóvel) */
  voiceLang?: 'pt-PT' | 'pt-BR';
  /** o Coach lê as respostas em voz alta */
  voiceReply?: boolean;
  /** "O que a IA percebeu" de cada relatório semanal (segunda-feira da semana → texto) */
  reportNotes?: Record<string, string>;
  /** último relatório semanal aberto (segunda-feira da semana) */
  reportSeen?: string;
  /** dicas de primeira visita já fechadas, por separador */
  tipsSeen?: Record<string, boolean>;
  /** nível escolhido para os treinos sugeridos (sobrepõe-se ao da avaliação) */
  trainLevel?: 'iniciante' | 'intermedio';
  /** participa na comunidade (pontos, ligas, amigos) */
  community?: { nick: string; since: string };
  /** foto de perfil (JPEG pequeno em data URL) */
  avatar?: string;
  /** última alteração (ISO), para sincronizar com a conta */
  updatedAt?: string;
  /** false quando a pessoa desliga as estatísticas anónimas */
  stats?: boolean;
  /** prevenção (última data de cada check-up/rastreio/vacina), análises, consultas e medicação */
  care?: {
    prev?: Record<string, string>;
    labs?: import('./care').LabResult[];
    visits?: import('./care').Visit[];
    meds?: import('./meds').Med[];
  };
  /** o que o assistente sabe: factos pedidos pela pessoa, padrões escondidos e lembretes confirmados */
  memory?: { facts?: { id: string; text: string; at: string }[]; hidden?: string[] };
  reminders?: { id: string; date: string; time: string; text: string }[];
  /** peso e medidas ao longo do tempo (cm, kg) */
  bodyLog?: {
    date: string; peso?: number; cintura?: number; anca?: number; pescoco?: number;
    /** avaliação mais completa (ajuste manual ou relatório anexado) */
    altura?: number; gordura?: number; magra?: number; fc?: number;
    medidas?: Partial<Record<import('./proProfile').MeasureKey, number>>;
    /** outros dados do relatório (dobras, RCQ, densidade…), pelo nome do documento */
    extra?: Record<string, { v: number; u: string }>;
    fonte?: 'manual' | 'relatorio'; por?: string;
  }[];
  /** fotos de progresso (só neste telemóvel, na base de ficheiros local) */
  progressPhotos?: { id: string; date: string; pose: 'frente' | 'lado' | 'costas' }[];
  /** saúde da mulher: modo, ciclo e menstruação habituais, data prevista do parto */
  women?: {
    mode: 'ciclo' | 'gravidez' | 'menopausa' | 'nao'; cycleLen?: number; periodLen?: number; lastStart?: string; due?: string; show?: boolean;
    method?: import('./cycleData').Method; goal?: import('./cycleData').CycleGoal;
    /** avisos do ciclo: menstruação a chegar, janela fértil, atraso; plain = texto com detalhes (por defeito, discreto) */
    notif?: { period?: boolean; fertile?: boolean; late?: boolean; plain?: boolean; time?: string };
  };
  /**
   * Consentimentos opcionais (RGPD/LGPD), com a data de cada escolha. O consentimento para
   * personalizar a app (necessário) é o `consent`.
   */
  consents?: { rd?: { on: boolean; at: string }; marketing?: { on: boolean; at: string } };
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
