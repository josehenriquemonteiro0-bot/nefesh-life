/**
 * Listas do ciclo menstrual, sem dependências (partilhadas com o servidor do assistente).
 */
export const CYCLE_SYMPTOMS = [
  'Cólicas', 'Dor lombar', 'Dor de cabeça', 'Enxaqueca', 'Inchaço', 'Sensibilidade mamária', 'Náuseas', 'Diarreia', 'Obstipação',
  'Acne', 'Cansaço', 'Insónia', 'Irritabilidade', 'Ansiedade', 'Tristeza', 'Choro fácil', 'Desejo de doces', 'Mais fome',
];

/** Fluxo: 1 leve … 4 muito intenso (a borra/escape regista-se à parte). */
export const FLOW_LABEL = ['', 'Leve', 'Moderado', 'Intenso', 'Muito intenso'];

export type Mucus = 'seco' | 'pegajoso' | 'cremoso' | 'aquoso' | 'clara';
export const MUCUS: [Mucus, string][] = [['seco', 'Seco'], ['pegajoso', 'Pegajoso'], ['cremoso', 'Cremoso'], ['aquoso', 'Aquoso'], ['clara', 'Clara de ovo']];

export const PRODUCTS = ['Penso', 'Tampão', 'Copo menstrual', 'Cueca menstrual'];

export type Method = 'nenhum' | 'preservativo' | 'pilula' | 'anel' | 'adesivo' | 'diu_cobre' | 'diu_h' | 'implante' | 'injecao';
export const METHODS: [Method, string][] = [
  ['nenhum', 'Nenhum'],
  ['preservativo', 'Preservativo'],
  ['pilula', 'Pílula'],
  ['anel', 'Anel vaginal'],
  ['adesivo', 'Adesivo'],
  ['diu_cobre', 'DIU de cobre'],
  ['diu_h', 'DIU hormonal'],
  ['implante', 'Implante'],
  ['injecao', 'Injeção'],
];
/** Métodos hormonais: não há ovulação nem fases a estimar. */
export const HORMONAL: Method[] = ['pilula', 'anel', 'adesivo', 'diu_h', 'implante', 'injecao'];
/** Métodos com que é comum deixar de ter menstruação. */
export const MAY_STOP: Method[] = ['diu_h', 'implante', 'injecao'];

export type CycleGoal = 'acompanhar' | 'engravidar' | 'evitar';
export const GOALS: [CycleGoal, string][] = [['acompanhar', 'Conhecer o meu ciclo'], ['engravidar', 'Tentar engravidar'], ['evitar', 'Evitar gravidez']];

/** O que o assistente pode registar no ciclo (campo title da ação "ciclo"). */
export const CYCLE_EVENTS = [
  'menstruacao', 'fim', 'borra', 'sintomas', 'dor', 'muco',
  'relacao_protegida', 'relacao_desprotegida', 'teste_ovulacao_pos', 'teste_ovulacao_neg', 'teste_gravidez_pos', 'teste_gravidez_neg',
] as const;
export type CycleEvent = (typeof CYCLE_EVENTS)[number];
