/**
 * Animações dos exercícios: uma figura de traços que alterna entre duas posições.
 * Coordenadas numa área de 120 × 100 (chão em y = 92). Vista de lado, exceto os polichinelos.
 * N = membro mais próximo (desenhado por cima), F = membro mais afastado (mais claro).
 */
export type Joint = 'head' | 'neck' | 'mid' | 'hip' | 'kN' | 'aN' | 'kF' | 'aF' | 'eN' | 'hN' | 'eF' | 'hF';
export type Pose = Partial<Record<Joint, [number, number]>>;

export interface Anim {
  a: Pose;
  b: Pose;
  /** duração de um ciclo completo, em segundos */
  dur: number;
  /** elementos de cenário */
  props?: ('door' | 'mat' | 'bag')[];
  /** texto curto do ritmo, ex.: "desce 2 s, sobe 1 s" */
  cue: string;
}

/** Preenche membros afastados que não foram indicados, desviando um pouco os mais próximos. */
export function complete(p: Pose, dx = -3): Required<Omit<Pose, 'mid'>> & Pose {
  const off = (v?: [number, number]): [number, number] => (v ? [v[0] + dx, v[1]] : [0, 0]);
  return {
    ...p,
    kF: p.kF ?? off(p.kN),
    aF: p.aF ?? off(p.aN),
    eF: p.eF ?? off(p.eN),
    hF: p.hF ?? off(p.hN),
  } as Required<Omit<Pose, 'mid'>> & Pose;
}

export const ANIMS: Record<string, Anim> = {
  agachamento: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92], eN: [70, 36], hN: [82, 38] },
    b: { head: [66, 33], neck: [63, 43], hip: [46, 66], kN: [68, 71], aN: [60, 92], eN: [76, 47], hN: [89, 47] },
    dur: 3,
    cue: 'Desce em 2 s, sobe em 1 s',
  },
  flexoes: {
    a: { head: [93, 52], neck: [85, 58], hip: [53, 69], kN: [36, 79], aN: [18, 89], eN: [86, 75], hN: [86, 91] },
    b: { head: [93, 76], neck: [85, 80], hip: [53, 84], kN: [36, 87], aN: [18, 89], eN: [74, 83], hN: [86, 91] },
    dur: 2.6,
    props: ['mat'],
    cue: 'Desce em 2 s, empurra em 1 s',
  },
  ponte: {
    a: { head: [18, 85], neck: [27, 86], hip: [55, 88], kN: [70, 72], aN: [80, 91], eN: [40, 90], hN: [52, 91] },
    b: { head: [18, 85], neck: [28, 84], hip: [56, 68], kN: [77, 69], aN: [80, 91], eN: [40, 90], hN: [52, 91] },
    dur: 3,
    props: ['mat'],
    cue: 'Sobe, aperta 2 s, desce devagar',
  },
  prancha: {
    a: { head: [93, 73], neck: [85, 77], hip: [53, 81], kN: [36, 85], aN: [18, 89], eN: [85, 91], hN: [100, 91] },
    b: { head: [93, 72], neck: [85, 76], hip: [53, 80], kN: [36, 84], aN: [18, 89], eN: [85, 91], hN: [100, 91] },
    dur: 3,
    props: ['mat'],
    cue: 'Corpo em linha reta, respira normalmente',
  },
  afundos: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [66, 73], aN: [72, 92], kF: [54, 73], aF: [46, 92], eN: [66, 42], hN: [63, 53] },
    b: { head: [60, 31], neck: [60, 42], hip: [60, 68], kN: [77, 71], aN: [77, 92], kF: [55, 90], aF: [40, 92], eN: [66, 56], hN: [63, 67] },
    dur: 3,
    cue: 'Desce até os joelhos a 90°, volta e troca',
  },
  remada: {
    a: { head: [89, 35], neck: [81, 41], hip: [55, 58], kN: [60, 74], aN: [56, 92], eN: [81, 57], hN: [81, 72] },
    b: { head: [89, 35], neck: [81, 41], hip: [55, 58], kN: [60, 74], aN: [56, 92], eN: [69, 45], hN: [78, 56] },
    dur: 2.6,
    props: ['bag'],
    cue: 'Puxa até à barriga, desce em 2 s',
  },
  superman: {
    a: { head: [93, 86], neck: [85, 88], hip: [54, 89], kN: [36, 89], aN: [18, 89], eN: [97, 88], hN: [109, 88] },
    b: { head: [95, 80], neck: [85, 84], hip: [54, 89], kN: [36, 86], aN: [18, 81], eN: [98, 81], hN: [109, 77] },
    dur: 3,
    props: ['mat'],
    cue: 'Levanta braços e pernas, segura 2 s',
  },
  escalador: {
    a: { head: [93, 52], neck: [85, 58], hip: [55, 66], kN: [70, 78], aN: [58, 89], kF: [37, 78], aF: [19, 89], eN: [86, 75], hN: [86, 91] },
    b: { head: [93, 52], neck: [85, 58], hip: [55, 66], kN: [37, 78], aN: [19, 89], kF: [70, 78], aF: [58, 89], eN: [86, 75], hN: [86, 91] },
    dur: 1,
    props: ['mat'],
    cue: 'Joelhos ao peito, em ritmo',
  },
  polichinelos: {
    a: { head: [60, 15], neck: [60, 26], hip: [60, 54], kN: [58, 73], aN: [57, 92], kF: [62, 73], aF: [63, 92], eN: [53, 39], hN: [51, 52], eF: [67, 39], hF: [69, 52] },
    b: { head: [60, 12], neck: [60, 23], hip: [60, 51], kN: [51, 70], aN: [42, 89], kF: [69, 70], aF: [78, 89], eN: [47, 17], hN: [43, 6], eF: [73, 17], hF: [77, 6] },
    dur: 1.1,
    cue: 'Abre e fecha, aterra com suavidade',
  },
  gato_vaca: {
    a: { head: [89, 74], neck: [80, 64], mid: [62, 52], hip: [44, 63], kN: [44, 91], aN: [26, 91], eN: [80, 78], hN: [80, 91] },
    b: { head: [91, 55], neck: [80, 62], mid: [62, 70], hip: [44, 61], kN: [44, 91], aN: [26, 91], eN: [80, 77], hN: [80, 91] },
    dur: 4,
    props: ['mat'],
    cue: 'Arredonda a expirar, arqueia a inspirar',
  },
  anca: {
    a: { head: [56, 25], neck: [56, 36], hip: [56, 64], kN: [74, 72], aN: [76, 91], kF: [47, 91], aF: [29, 91], eN: [63, 50], hN: [58, 61] },
    b: { head: [61, 28], neck: [60, 39], hip: [62, 67], kN: [77, 73], aN: [76, 91], kF: [47, 91], aF: [29, 91], eN: [67, 53], hN: [63, 64] },
    dur: 4,
    props: ['mat'],
    cue: 'Empurra a anca à frente e respira fundo',
  },
  peito_porta: {
    a: { head: [52, 17], neck: [52, 28], hip: [52, 55], kN: [52, 73], aN: [52, 92], eN: [70, 28], hN: [70, 13], eF: [48, 42], hF: [46, 54] },
    b: { head: [62, 19], neck: [60, 30], hip: [55, 56], kN: [53, 74], aN: [52, 92], eN: [70, 28], hN: [70, 13], eF: [56, 44], hF: [54, 56] },
    dur: 4,
    props: ['door'],
    cue: 'Avança o corpo até sentir o peito a alongar',
  },
  posterior: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92], eN: [62, 40], hN: [63, 53] },
    b: { head: [78, 80], neck: [71, 71], hip: [57, 52], kN: [58, 72], aN: [58, 92], eN: [72, 82], hN: [67, 91] },
    dur: 5,
    cue: 'Desce devagar com as costas longas e segura 30 s',
  },
  quadriceps: {
    a: { head: [58, 16], neck: [58, 27], hip: [58, 54], kN: [59, 72], aN: [47, 62], kF: [57, 73], aF: [57, 92], eN: [52, 44], hN: [47, 60], eF: [67, 35], hF: [77, 31] },
    b: { head: [60, 16], neck: [60, 27], hip: [61, 54], kN: [58, 73], aN: [45, 60], kF: [59, 73], aF: [57, 92], eN: [53, 44], hN: [45, 58], eF: [69, 35], hF: [79, 31] },
    dur: 4,
    cue: 'Puxa o calcanhar ao glúteo, joelhos juntos, 30 s por lado',
  },
  circ_bracos: {
    a: { head: [60, 15], neck: [60, 26], hip: [60, 54], kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [47, 30], hN: [35, 30], eF: [73, 30], hF: [85, 30] },
    b: { head: [60, 15], neck: [60, 26], hip: [60, 54], kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [51, 15], hN: [47, 4], eF: [69, 15], hF: [73, 4] },
    dur: 1.6,
    cue: 'Círculos grandes e lentos, para a frente e para trás',
  },
  marcha: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92], kF: [59, 73], aF: [58, 92], eN: [66, 40], hN: [71, 50], eF: [54, 40], hF: [50, 50] },
    b: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [74, 57], aN: [72, 75], kF: [59, 73], aF: [58, 92], eN: [54, 40], hN: [50, 50], eF: [66, 40], hF: [71, 50] },
    dur: 1.2,
    cue: 'Joelho à altura da anca, alterna em ritmo',
  },
  balanco_perna: {
    a: { head: [58, 16], neck: [58, 27], hip: [58, 54], kN: [70, 71], aN: [80, 87], kF: [57, 73], aF: [57, 92], eN: [64, 40], hN: [70, 50], eF: [52, 38], hF: [46, 46] },
    b: { head: [60, 16], neck: [60, 27], hip: [59, 54], kN: [50, 72], aN: [41, 89], kF: [58, 73], aF: [57, 92], eN: [64, 40], hN: [70, 50], eF: [52, 38], hF: [46, 46] },
    dur: 1.6,
    cue: 'Balança a perna à frente e atrás, tronco direito, 10 por lado',
  },
  deadbug: {
    a: { head: [24, 84], neck: [32, 86], hip: [58, 88], kN: [60, 70], aN: [75, 70], kF: [60, 70], aF: [75, 70], eN: [34, 72], hN: [34, 59], eF: [34, 72], hF: [34, 59] },
    b: { head: [24, 84], neck: [32, 86], hip: [58, 88], kN: [77, 82], aN: [95, 86], kF: [60, 70], aF: [75, 70], eN: [22, 80], hN: [10, 83], eF: [34, 72], hF: [34, 59] },
    dur: 3,
    props: ['mat'],
    cue: 'Estica braço e perna opostos, lombar colada ao chão',
  },
  crianca: {
    a: { head: [82, 86], neck: [72, 83], hip: [42, 79], kN: [58, 90], aN: [36, 91], eN: [88, 86], hN: [101, 89] },
    b: { head: [82, 84], neck: [72, 80], hip: [42, 76], kN: [58, 90], aN: [36, 91], eN: [88, 85], hN: [101, 89] },
    dur: 6,
    props: ['mat'],
    cue: 'Inspira em 4 s, expira em 6 s, ombros soltos',
  },
};

/** Rotinas de vários movimentos (início e fim do treino): o aluno vê-as passo a passo. */
export const ROUTINES: Record<string, { anim: string; label: string }[]> = {
  'Mobilidade articular geral': [
    { anim: 'circ_bracos', label: 'Círculos de braços · 30 s' },
    { anim: 'anca', label: 'Abertura de anca · 30 s por lado' },
    { anim: 'gato_vaca', label: 'Gato-vaca · 8 vezes' },
    { anim: 'agachamento', label: 'Agachamento lento · 8 vezes' },
  ],
  'Alongamento dinâmico': [
    { anim: 'marcha', label: 'Joelhos ao peito · 20 s' },
    { anim: 'balanco_perna', label: 'Balanço de perna · 10 por lado' },
    { anim: 'afundos', label: 'Afundo lento · 6 por lado' },
    { anim: 'circ_bracos', label: 'Círculos de braços · 30 s' },
  ],
  'Ativação de core': [
    { anim: 'deadbug', label: 'Dead bug · 10 por lado' },
    { anim: 'prancha', label: 'Prancha · 30 s' },
  ],
  'Ativação de glúteos (mini band)': [
    { anim: 'ponte', label: 'Ponte de glúteos · 15 vezes' },
    { anim: 'agachamento', label: 'Agachamento com elástico nos joelhos · 15 vezes' },
  ],
  'Alongamento final (volta à calma)': [
    { anim: 'posterior', label: 'Posterior da coxa · 30 s' },
    { anim: 'quadriceps', label: 'Quadríceps em pé · 30 s por lado' },
    { anim: 'peito_porta', label: 'Peito na parede · 30 s' },
    { anim: 'crianca', label: 'Postura da criança · 40 s' },
  ],
};

/** Palavras-chave para reconhecer exercícios de planos de personal (ex.: MyFit). */
const MATCH: [RegExp, string][] = [
  [/agachamento|squat/i, 'agachamento'],
  [/afundo|avan[cç]o|lunge|passada/i, 'afundos'],
  [/flex[aã]o|flexões|push.?up/i, 'flexoes'],
  [/prancha|plank/i, 'prancha'],
  [/eleva[cç][aã]o p[eé]lvica|ponte|glute bridge|hip thrust/i, 'ponte'],
  [/remada curvada|remada com halter|remada unilateral|bent.?over/i, 'remada'],
  [/super.?(man|homem)|hiperextens[aã]o de lombar solo/i, 'superman'],
  [/escalador|mountain climber/i, 'escalador'],
  [/polichinelo|jumping jack/i, 'polichinelos'],
  [/relaxamento|respira[cç][aã]o|postura da crian[cç]a|child.?s pose/i, 'crianca'],
  [/alongamento (de )?posterior|isquiotibia/i, 'posterior'],
  [/alongamento (de )?quadr[ií]ceps/i, 'quadriceps'],
  [/alongamento (de )?peit/i, 'peito_porta'],
  [/mobilidade de ombro|c[ií]rculos de bra[cç]o/i, 'circ_bracos'],
  [/mobilidade de anca|mobilidade de quadril/i, 'anca'],
  [/gato|camelo|cat.?cow/i, 'gato_vaca'],
  [/dead.?bug/i, 'deadbug'],
];

/** Animação para um nome de exercício qualquer, se houver correspondência. */
export function animFor(name: string): string | null {
  for (const [re, id] of MATCH) if (re.test(name)) return id;
  return null;
}
