import type { Anim, Pose } from './exerciseAnims';

/**
 * Animações de ginásio (máquinas, halteres, barra, cabos, cardio).
 * Mesmo sistema das animações de casa: área 120 × 100, chão em y = 92, vista de lado a olhar para a direita.
 * `gear` desenha o aparelho (fixo), `hold` o peso que acompanha a mão ou o pé, `cable` o cabo da polia.
 */

const BENCH = 'M18 70 H100 M26 70 V92 M92 70 V92';
const SEAT = 'M42 68 H70 M56 68 V92';

// deitado no banco (supino, tríceps testa, pullover)
const LYING: Pose = { head: [26, 62], neck: [36, 66], hip: [62, 66], kN: [80, 70], aN: [84, 92] };
// sentado direito (desenvolvimento, francês, puxada)
const SITTING: Pose = { head: [58, 27], neck: [58, 38], hip: [58, 65], kN: [77, 65], aN: [78, 90] };
// de pé
const STAND: Pose = { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92] };
// inclinado para a frente com as costas direitas (remadas, coice)
const BENT: Pose = { head: [89, 35], neck: [81, 41], hip: [55, 58], kN: [60, 74], aN: [56, 92] };
// quatro apoios
const QUAD: Pose = { head: [89, 70], neck: [80, 66], hip: [46, 64], kN: [46, 91], aN: [28, 91], eN: [80, 78], hN: [80, 91] };
// deitado de barriga para cima, joelhos fletidos
const SUPINE: Pose = { head: [24, 84], neck: [32, 86], mid: [45, 87], hip: [58, 88], kN: [72, 72], aN: [84, 91] };

const swapSides = (p: Pose): Pose => ({ ...p, kN: p.kF, aN: p.aF, kF: p.kN, aF: p.aN, eN: p.eF, hN: p.hF, eF: p.eN, hF: p.hN });

const walkA: Pose = {
  head: [60, 12], neck: [60, 23], hip: [59, 49], kN: [65, 66], aN: [68, 85], kF: [53, 67], aF: [45, 84],
  eN: [55, 35], hN: [52, 46], eF: [65, 35], hF: [71, 43],
};
const runA: Pose = {
  head: [66, 13], neck: [64, 24], hip: [58, 49], kN: [74, 58], aN: [70, 76], kF: [52, 66], aF: [38, 76],
  eN: [56, 36], hN: [64, 42], eF: [70, 33], hF: [78, 26],
};
const crunchA: Pose = { ...SUPINE, eN: [30, 76], hN: [22, 79] };

export const GYM_ANIMS: Record<string, Anim> = {
  // ——— peito ———
  supino: {
    a: { ...LYING, eN: [37, 53], hN: [38, 40] },
    b: { ...LYING, eN: [27, 71], hN: [39, 60] },
    dur: 3, gear: BENCH, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Desce até ao peito em 2 s, empurra em 1 s',
  },
  supino_halteres: {
    a: { ...LYING, eN: [37, 53], hN: [38, 40] },
    b: { ...LYING, eN: [27, 71], hN: [36, 60] },
    dur: 3, gear: BENCH, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Desce até à linha do peito, empurra e junta em cima',
  },
  supino_inclinado: {
    a: { head: [31, 40], neck: [38, 49], hip: [58, 68], kN: [76, 66], aN: [80, 90], eN: [45, 37], hN: [46, 24] },
    b: { head: [31, 40], neck: [38, 49], hip: [58, 68], kN: [76, 66], aN: [80, 90], eN: [30, 57], hN: [42, 48] },
    dur: 3, gear: 'M30 48 L56 74 H88 M48 74 V92 M84 74 V92', hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Banco inclinado: desce ao peito alto, empurra para cima',
  },
  crucifixo: {
    a: { ...LYING, eN: [41, 50], hN: [39, 39] },
    b: { ...LYING, eN: [44, 66], hN: [52, 75] },
    dur: 3.4, gear: BENCH, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Abre os braços em arco devagar, cotovelos fletidos, e junta em cima',
  },
  voador: {
    a: { ...STAND, kF: [63, 73], aF: [64, 92], kN: [57, 73], aN: [56, 92], eN: [46, 30], hN: [34, 34], eF: [74, 30], hF: [86, 34] },
    b: { ...STAND, kF: [63, 73], aF: [64, 92], kN: [57, 73], aN: [56, 92], eN: [48, 36], hN: [58, 38], eF: [72, 36], hF: [62, 38] },
    dur: 3, view: 'front',
    cue: 'Junta as mãos à frente do peito e abre devagar',
  },
  paralelas: {
    a: { head: [64, 16], neck: [60, 26], hip: [57, 53], kN: [52, 70], aN: [42, 80], eN: [60, 38], hN: [60, 50] },
    b: { head: [66, 28], neck: [61, 38], hip: [57, 64], kN: [52, 81], aN: [42, 90], eN: [49, 42], hN: [60, 50] },
    dur: 3, gear: 'M40 50 H84 M80 50 V92',
    cue: 'Desce até os cotovelos a 90°, sobe sem balançar',
  },

  // ——— costas ———
  puxada: {
    a: { ...SITTING, head: [55, 27], neck: [56, 38], eN: [63, 26], hN: [65, 13] },
    b: { ...SITTING, head: [53, 28], neck: [55, 39], eN: [46, 50], hN: [58, 42] },
    dur: 3, gear: 'M40 68 H70 M56 68 V92 M70 58 H88', cable: { from: [64, 3], to: 'hN' },
    cue: 'Puxa a barra ao peito, cotovelos para baixo; sobe devagar',
  },
  barra_fixa: {
    a: { head: [65, 24], neck: [60, 32], hip: [60, 59], kN: [57, 76], aN: [48, 86], eN: [61, 20], hN: [62, 8] },
    b: { head: [65, 12], neck: [60, 20], hip: [60, 47], kN: [57, 64], aN: [48, 74], eN: [53, 19], hN: [62, 8] },
    dur: 3, gear: 'M28 8 H96',
    cue: 'Sobe até o queixo passar a barra, desce controlado',
  },
  remada_sentada: {
    a: { head: [47, 36], neck: [46, 47], hip: [44, 74], kN: [63, 64], aN: [80, 74], eN: [59, 52], hN: [72, 56] },
    b: { head: [45, 36], neck: [44, 47], hip: [44, 74], kN: [63, 64], aN: [80, 74], eN: [33, 54], hN: [45, 59] },
    dur: 3, gear: 'M28 78 H58 M42 78 V92 M86 64 V84', cable: { from: [104, 60], to: 'hN' },
    cue: 'Puxa até à barriga, aperta as omoplatas, volta devagar',
  },
  pulldown_reto: {
    a: { ...STAND, head: [62, 17], neck: [61, 28], eN: [72, 20], hN: [83, 13] },
    b: { ...STAND, head: [62, 17], neck: [61, 28], eN: [66, 41], hN: [68, 54] },
    dur: 3, cable: { from: [100, 3], to: 'hN' },
    cue: 'Braços esticados: leva a barra às coxas e sobe devagar',
  },
  pullover: {
    a: { ...LYING, eN: [37, 52], hN: [38, 39] },
    b: { ...LYING, eN: [23, 60], hN: [10, 57] },
    dur: 3.4, gear: BENCH, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Leva o halter para trás da cabeça e volta por cima do peito',
  },
  hiperextensao: {
    a: { head: [74, 88], neck: [70, 80], hip: [60, 56], kN: [44, 68], aN: [30, 80], eN: [64, 72], hN: [70, 70] },
    b: { head: [92, 40], neck: [83, 45], hip: [60, 56], kN: [44, 68], aN: [30, 80], eN: [74, 54], hN: [80, 52] },
    dur: 3.4, gear: 'M50 62 L68 52 M58 58 L64 92 M26 84 H36 M30 84 L36 92',
    cue: 'Desce com as costas direitas e sobe até ficar em linha',
  },
  encolhimento: {
    a: { ...STAND, eN: [61, 41], hN: [62, 54] },
    b: { ...STAND, head: [60, 13], neck: [60, 23], eN: [61, 37], hN: [62, 50] },
    dur: 2.4, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Sobe os ombros às orelhas, segura 1 s, desce',
  },

  // ——— ombros ———
  desenvolvimento: {
    a: { ...SITTING, eN: [53, 48], hN: [58, 36] },
    b: { ...SITTING, eN: [60, 25], hN: [60, 12] },
    dur: 3, gear: 'M44 68 H70 M56 68 V92 M48 68 V34', hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Empurra para cima sem arquear a lombar, desce às orelhas',
  },
  elevacao_lateral: {
    a: { ...STAND, kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [52, 39], hN: [50, 52], eF: [68, 39], hF: [70, 52] },
    b: { ...STAND, kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [47, 29], hN: [35, 30], eF: [73, 29], hF: [85, 30] },
    dur: 3, view: 'front', hold: [{ at: 'hN', kind: 'db' }, { at: 'hF', kind: 'db' }],
    cue: 'Sobe os braços até aos ombros, desce em 2 s',
  },
  elevacao_frontal: {
    a: { ...STAND, eN: [61, 40], hN: [63, 53] },
    b: { ...STAND, eN: [73, 28], hN: [86, 27] },
    dur: 3, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Sobe à frente até à altura dos ombros, sem balançar',
  },
  remada_alta: {
    a: { ...STAND, eN: [61, 40], hN: [63, 53] },
    b: { ...STAND, eN: [55, 27], hN: [66, 33] },
    dur: 3, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Puxa junto ao corpo até ao peito, cotovelos em cima',
  },
  face_pull: {
    a: { ...STAND, eN: [72, 29], hN: [85, 29] },
    b: { ...STAND, eN: [54, 22], hN: [67, 19] },
    dur: 3, cable: { from: [108, 28], to: 'hN' },
    cue: 'Puxa a corda à cara, cotovelos altos e abertos',
  },
  crucifixo_inv: {
    a: { ...BENT, eN: [81, 54], hN: [81, 67] },
    b: { ...BENT, eN: [73, 42], hN: [64, 34] },
    dur: 3, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Tronco inclinado: abre os braços para trás e aperta as omoplatas',
  },

  // ——— braços ———
  rosca: {
    a: { ...STAND, eN: [61, 40], hN: [63, 53] },
    b: { ...STAND, eN: [61, 40], hN: [71, 31] },
    dur: 2.8, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Cotovelo parado junto ao corpo; sobe em 1 s, desce em 2 s',
  },
  rosca_barra: {
    a: { ...STAND, eN: [61, 40], hN: [63, 53] },
    b: { ...STAND, eN: [61, 40], hN: [71, 31] },
    dur: 2.8, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Cotovelos parados; sobe sem balançar o tronco, desce devagar',
  },
  rosca_cabo: {
    a: { ...STAND, eN: [61, 40], hN: [63, 53] },
    b: { ...STAND, eN: [61, 40], hN: [71, 31] },
    dur: 2.8, cable: { from: [84, 90], to: 'hN' },
    cue: 'Cotovelos parados; sobe e desce com controlo',
  },
  triceps_polia: {
    a: { ...STAND, head: [63, 17], neck: [62, 28], eN: [61, 42], hN: [70, 33] },
    b: { ...STAND, head: [63, 17], neck: [62, 28], eN: [61, 42], hN: [64, 55] },
    dur: 2.6, cable: { from: [82, 3], to: 'hN' },
    cue: 'Cotovelos colados ao corpo; estica até ao fim e volta devagar',
  },
  triceps_testa: {
    a: { ...LYING, eN: [33, 52], hN: [33, 39] },
    b: { ...LYING, eN: [33, 52], hN: [23, 60] },
    dur: 3, gear: BENCH, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Só o cotovelo dobra: desce à testa e estica',
  },
  triceps_frances: {
    a: { ...SITTING, eN: [57, 25], hN: [57, 12] },
    b: { ...SITTING, eN: [57, 25], hN: [47, 33] },
    dur: 3, gear: 'M44 68 H70 M56 68 V92 M48 68 V34', hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Cotovelo apontado para cima; desce atrás da cabeça e estica',
  },
  coice_triceps: {
    a: { ...BENT, eN: [70, 49], hN: [70, 62] },
    b: { ...BENT, eN: [70, 49], hN: [57, 54] },
    dur: 2.6, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Braço colado ao tronco; estica para trás e aperta',
  },
  mergulho_banco: {
    a: { head: [47, 31], neck: [44, 42], hip: [46, 69], kN: [67, 72], aN: [88, 90], eN: [42, 54], hN: [40, 66] },
    b: { head: [47, 43], neck: [44, 54], hip: [46, 80], kN: [68, 80], aN: [89, 90], eN: [32, 58], hN: [40, 66] },
    dur: 3, gear: 'M8 66 H42 M12 66 V92 M38 66 V92',
    cue: 'Desce até os cotovelos a 90°, costas perto do banco',
  },

  // ——— pernas ———
  agachamento_barra: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92], eN: [52, 36], hN: [58, 26] },
    b: { head: [68, 33], neck: [64, 43], hip: [46, 66], kN: [68, 71], aN: [60, 92], eN: [56, 52], hN: [62, 42] },
    dur: 3, hold: [{ at: 'neck', kind: 'bar' }],
    cue: 'Barra nas costas: desce até às coxas paralelas, sobe a empurrar o chão',
  },
  agachamento_goblet: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [61, 73], aN: [60, 92], eN: [64, 42], hN: [68, 33] },
    b: { head: [64, 33], neck: [61, 43], hip: [46, 66], kN: [68, 71], aN: [60, 92], eN: [65, 58], hN: [70, 49] },
    dur: 3, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Halter junto ao peito; desce com as costas direitas',
  },
  bulgaro: {
    a: { head: [57, 16], neck: [57, 27], hip: [56, 54], kN: [68, 70], aN: [70, 92], kF: [46, 70], aF: [30, 68], eN: [58, 41], hN: [60, 54] },
    b: { head: [56, 28], neck: [56, 39], hip: [54, 66], kN: [73, 74], aN: [70, 92], kF: [44, 84], aF: [30, 68], eN: [57, 53], hN: [59, 66] },
    dur: 3.2, gear: 'M12 70 H40 M16 70 V92 M36 70 V92', hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Pé de trás no banco: desce a direito, joelho da frente sobre o pé',
  },
  leg_press: {
    a: { head: [12, 47], neck: [18, 56], hip: [36, 76], kN: [50, 64], aN: [64, 50], eN: [26, 70], hN: [34, 77] },
    b: { head: [12, 47], neck: [18, 56], hip: [36, 76], kN: [39, 58], aN: [54, 62], eN: [26, 70], hN: [34, 77] },
    dur: 3.2, gear: 'M6 48 L32 82 H50 M40 82 V92', hold: [{ at: 'aN', kind: 'sled' }],
    cue: 'Desce até os joelhos a 90°, empurra com o pé todo, sem bloquear',
  },
  extensora: {
    a: { head: [42, 26], neck: [45, 37], hip: [50, 63], kN: [69, 63], aN: [70, 82], eN: [52, 50], hN: [58, 62] },
    b: { head: [42, 26], neck: [45, 37], hip: [50, 63], kN: [69, 63], aN: [87, 57], eN: [52, 50], hN: [58, 62] },
    dur: 2.8, gear: 'M40 67 H70 M60 67 V92 M42 67 L37 32', hold: [{ at: 'aN', kind: 'pad' }],
    cue: 'Estica as pernas, segura 1 s em cima, desce devagar',
  },
  flexora_sentada: {
    a: { head: [42, 26], neck: [45, 37], hip: [50, 63], kN: [69, 63], aN: [87, 60], eN: [52, 50], hN: [58, 62] },
    b: { head: [42, 26], neck: [45, 37], hip: [50, 63], kN: [69, 63], aN: [63, 80], eN: [52, 50], hN: [58, 62] },
    dur: 2.8, gear: 'M40 67 H70 M60 67 V92 M42 67 L37 32', hold: [{ at: 'aN', kind: 'pad' }],
    cue: 'Puxa os calcanhares para baixo e volta devagar',
  },
  mesa_flexora: {
    a: { head: [94, 61], neck: [84, 65], hip: [57, 66], kN: [38, 66], aN: [19, 66], eN: [88, 74], hN: [96, 69] },
    b: { head: [94, 61], neck: [84, 65], hip: [57, 66], kN: [38, 66], aN: [31, 48], eN: [88, 74], hN: [96, 69] },
    dur: 2.8, gear: 'M14 70 H100 M22 70 V92 M92 70 V92', hold: [{ at: 'aN', kind: 'pad' }],
    cue: 'Deitado: leva os calcanhares ao glúteo, anca colada ao banco',
  },
  flexora_pe: {
    a: { ...STAND, kN: [60, 73], aN: [59, 92], eN: [66, 40], hN: [76, 44] },
    b: { ...STAND, kN: [59, 73], aN: [44, 62], eN: [66, 40], hN: [76, 44] },
    dur: 2.6, gear: 'M80 40 V92',
    cue: 'Leva o calcanhar ao glúteo, joelho parado',
  },
  stiff: {
    a: { ...STAND, eN: [61, 41], hN: [63, 54] },
    b: { head: [84, 40], neck: [75, 45], hip: [51, 56], kN: [57, 74], aN: [58, 92], eN: [75, 58], hN: [75, 71] },
    dur: 3.4, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Leva a anca atrás, costas direitas, peso perto das pernas',
  },
  terra: {
    a: { head: [78, 37], neck: [71, 44], hip: [47, 61], kN: [65, 71], aN: [60, 92], eN: [68, 61], hN: [66, 76] },
    b: { ...STAND, eN: [61, 41], hN: [63, 54] },
    dur: 3.4, hold: [{ at: 'hN', kind: 'bar' }],
    cue: 'Costas direitas: empurra o chão e estica anca e joelhos juntos',
  },
  good_morning: {
    a: { ...STAND, eN: [52, 35], hN: [58, 27] },
    b: { head: [84, 40], neck: [75, 45], hip: [51, 56], kN: [57, 74], aN: [58, 92], eN: [67, 52], hN: [75, 46] },
    dur: 3.4, hold: [{ at: 'neck', kind: 'bar' }],
    cue: 'Barra nas costas: inclina o tronco com a anca atrás e volta',
  },
  hip_thrust: {
    a: { head: [22, 55], neck: [30, 62], hip: [46, 83], kN: [65, 72], aN: [70, 92], eN: [38, 74], hN: [46, 81] },
    b: { head: [22, 55], neck: [30, 62], hip: [56, 64], kN: [72, 73], aN: [70, 92], eN: [42, 60], hN: [55, 62] },
    dur: 3, gear: 'M2 64 H30 M6 64 V92 M26 64 V92', hold: [{ at: 'hip', kind: 'bar' }],
    cue: 'Costas no banco: sobe a anca, aperta 2 s, desce devagar',
  },
  coice_4apoios: {
    a: { ...QUAD, kF: [46, 91], aF: [28, 91] },
    b: { ...QUAD, kN: [20, 56], aN: [6, 44], kF: [46, 91], aF: [28, 91] },
    dur: 2.6, props: ['mat'],
    cue: 'Leva o calcanhar para cima e atrás, sem rodar a anca',
  },
  coice_polia: {
    a: { ...STAND, head: [64, 17], neck: [63, 28], eN: [70, 40], hN: [80, 44], kN: [60, 73], aN: [59, 92] },
    b: { ...STAND, head: [64, 17], neck: [63, 28], eN: [70, 40], hN: [80, 44], kN: [50, 71], aN: [39, 86] },
    dur: 2.6, gear: 'M84 40 V92', cable: { from: [10, 90], to: 'aN' },
    cue: 'Leva a perna atrás com o glúteo, tronco parado',
  },
  abdutora: {
    a: { head: [60, 22], neck: [60, 33], hip: [60, 60], kN: [50, 66], aN: [50, 88], kF: [70, 66], aF: [70, 88], eN: [52, 45], hN: [47, 57], eF: [68, 45], hF: [73, 57] },
    b: { head: [60, 22], neck: [60, 33], hip: [60, 60], kN: [46, 64], aN: [45, 88], kF: [74, 64], aF: [75, 88], eN: [52, 45], hN: [47, 57], eF: [68, 45], hF: [73, 57] },
    dur: 2.8, view: 'front', gear: 'M40 62 H80 M60 62 V92',
    cue: 'Abre as pernas com força, fecha devagar',
  },
  adutora: {
    a: { head: [60, 22], neck: [60, 33], hip: [60, 60], kN: [46, 64], aN: [45, 88], kF: [74, 64], aF: [75, 88], eN: [52, 45], hN: [47, 57], eF: [68, 45], hF: [73, 57] },
    b: { head: [60, 22], neck: [60, 33], hip: [60, 60], kN: [50, 66], aN: [50, 88], kF: [70, 66], aF: [70, 88], eN: [52, 45], hN: [47, 57], eF: [68, 45], hF: [73, 57] },
    dur: 2.8, view: 'front', gear: 'M40 62 H80 M60 62 V92',
    cue: 'Fecha as pernas com força, abre devagar',
  },
  agachamento_lateral: {
    a: { head: [60, 16], neck: [60, 27], hip: [60, 54], kN: [52, 72], aN: [44, 92], kF: [68, 72], aF: [76, 92], eN: [55, 40], hN: [60, 47], eF: [65, 40], hF: [60, 47] },
    b: { head: [52, 27], neck: [52, 38], hip: [50, 64], kN: [36, 76], aN: [44, 92], kF: [66, 77], aF: [76, 92], eN: [47, 50], hN: [53, 57], eF: [57, 50], hF: [53, 57] },
    dur: 3, view: 'front',
    cue: 'Passo largo: senta para um lado com a outra perna esticada',
  },
  subida_banco: {
    a: { head: [54, 16], neck: [54, 27], hip: [54, 54], kN: [70, 64], aN: [76, 82], kF: [55, 73], aF: [53, 92], eN: [56, 40], hN: [58, 52] },
    b: { head: [74, 6], neck: [74, 17], hip: [74, 44], kN: [75, 63], aN: [76, 82], kF: [70, 62], aF: [62, 78], eN: [75, 30], hN: [77, 42] },
    dur: 3, gear: 'M60 92 V82 H98 V92',
    cue: 'Sobe com o pé todo no banco, desce controlado',
  },
  parede: {
    a: { head: [36, 29], neck: [36, 40], hip: [38, 66], kN: [58, 66], aN: [58, 92], eN: [44, 52], hN: [46, 64] },
    b: { head: [36, 28], neck: [36, 39], hip: [38, 66], kN: [58, 66], aN: [58, 92], eN: [44, 51], hN: [46, 63] },
    dur: 4, gear: 'M29 4 V92',
    cue: 'Costas na parede, joelhos a 90°, segura e respira',
  },
  sentar_levantar: {
    a: { head: [60, 32], neck: [57, 43], hip: [52, 69], kN: [70, 70], aN: [71, 92], eN: [66, 49], hN: [70, 43] },
    b: { head: [62, 16], neck: [62, 27], hip: [62, 54], kN: [67, 72], aN: [71, 92], eN: [70, 36], hN: [74, 30] },
    dur: 3.2, gear: 'M40 72 H62 M42 72 V92 M60 72 V92 M41 72 V42',
    cue: 'Levanta sem usar as mãos e senta devagar',
  },
  panturrilha: {
    a: { ...STAND, eN: [61, 41], hN: [62, 54] },
    b: { head: [60, 10], neck: [60, 21], hip: [60, 48], kN: [61, 67], aN: [61, 86], eN: [61, 35], hN: [62, 48] },
    dur: 2.4, gear: 'M48 92 H78',
    cue: 'Sobe na ponta dos pés, segura 1 s, desce até ao fim',
  },
  panturrilha_sentada: {
    a: { ...SITTING, kN: [77, 66], aN: [78, 90], eN: [64, 52], hN: [74, 62] },
    b: { ...SITTING, kN: [77, 60], aN: [78, 84], eN: [64, 50], hN: [74, 56] },
    dur: 2.4, gear: SEAT, hold: [{ at: 'kN', kind: 'pad' }],
    cue: 'Sobe os calcanhares, segura 1 s, desce devagar',
  },

  // ——— abdómen ———
  crunch: {
    a: crunchA,
    b: { ...crunchA, head: [34, 68], neck: [40, 77], mid: [47, 84], eN: [42, 67], hN: [33, 69] },
    dur: 2.6, props: ['mat'],
    cue: 'Sobe só os ombros, expira a subir, sem puxar o pescoço',
  },
  infra: {
    a: { ...SUPINE, kN: [77, 85], aN: [96, 84], eN: [45, 90], hN: [57, 91] },
    b: { ...SUPINE, kN: [65, 71], aN: [70, 53], eN: [45, 90], hN: [57, 91] },
    dur: 3, props: ['mat'],
    cue: 'Sobe as pernas sem tirar a lombar do chão, desce devagar',
  },
  abdominal_polia: {
    a: { head: [62, 29], neck: [60, 40], hip: [56, 66], kN: [56, 91], aN: [36, 91], eN: [68, 36], hN: [64, 27] },
    b: { head: [84, 62], neck: [76, 55], mid: [66, 56], hip: [56, 66], kN: [56, 91], aN: [36, 91], eN: [82, 46], hN: [83, 58] },
    dur: 3, cable: { from: [62, 3], to: 'hN' }, props: ['mat'],
    cue: 'De joelhos: enrola o tronco para baixo com o abdómen',
  },
  abdominal_bicicleta: {
    a: { head: [30, 74], neck: [37, 81], hip: [58, 88], kN: [65, 70], aN: [83, 74], kF: [76, 81], aF: [95, 82], eN: [41, 71], hN: [31, 70] },
    b: { head: [30, 74], neck: [37, 81], hip: [58, 88], kN: [76, 81], aN: [95, 82], kF: [65, 70], aF: [83, 74], eN: [44, 72], hN: [33, 69] },
    dur: 1.6, props: ['mat'],
    cue: 'Cotovelo ao joelho oposto, alterna devagar',
  },
  bird_dog: {
    a: { ...QUAD, kF: [46, 91], aF: [28, 91], eF: [80, 78], hF: [80, 91] },
    b: { ...QUAD, kN: [19, 62], aN: [2, 61], kF: [46, 91], aF: [28, 91], eF: [93, 63], hF: [106, 61] },
    dur: 3.4, props: ['mat'],
    cue: 'Estica braço e perna opostos, segura 2 s, troca',
  },
  russian_twist: {
    a: { head: [33, 53], neck: [38, 63], hip: [50, 86], kN: [66, 72], aN: [82, 78], eN: [48, 70], hN: [58, 66] },
    b: { head: [35, 52], neck: [39, 63], hip: [50, 86], kN: [66, 72], aN: [82, 78], eN: [44, 76], hN: [42, 88] },
    dur: 1.8, props: ['mat'], hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Tronco inclinado: roda de um lado para o outro',
  },
  roda: {
    a: { head: [70, 46], neck: [64, 54], hip: [44, 68], kN: [42, 91], aN: [22, 91], eN: [66, 71], hN: [68, 86] },
    b: { head: [85, 69], neck: [76, 74], hip: [50, 72], kN: [42, 91], aN: [22, 91], eN: [89, 80], hN: [102, 86] },
    dur: 3.4, props: ['mat'], hold: [{ at: 'hN', kind: 'wheel' }],
    cue: 'Rola à frente com o abdómen firme e volta sem arquear',
  },
  prancha_lateral: {
    a: { head: [89, 64], neck: [82, 72], hip: [56, 80], kN: [38, 85], aN: [20, 90], eN: [82, 91], hN: [95, 91], eF: [80, 59], hF: [80, 47] },
    b: { head: [89, 63], neck: [82, 71], hip: [56, 77], kN: [38, 84], aN: [20, 90], eN: [82, 91], hN: [95, 91], eF: [80, 58], hF: [80, 46] },
    dur: 3, view: 'front', props: ['mat'],
    cue: 'Corpo em linha, anca alta, respira',
  },
  pallof: {
    a: { ...STAND, kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [62, 41], hN: [72, 36] },
    b: { ...STAND, kN: [57, 73], aN: [56, 92], kF: [63, 73], aF: [64, 92], eN: [73, 36], hN: [86, 36] },
    dur: 3, cable: { from: [14, 38], to: 'hN' },
    cue: 'Empurra as mãos à frente sem deixar o tronco rodar',
  },

  // ——— cardio ———
  caminhada: { a: walkA, b: swapSides(walkA), dur: 1.2, cue: 'Passo natural, braços a acompanhar' },
  esteira: {
    a: walkA, b: swapSides(walkA), dur: 1.2, gear: 'M16 92 L22 86 H96 L100 92 M90 86 L98 42 M92 42 H104',
    cue: 'Postura direita, passada natural; sem se agarrar',
  },
  corrida: { a: runA, b: swapSides(runA), dur: 0.8, cue: 'Tronco ligeiramente à frente, braços a 90°' },
  esteira_corrida: {
    a: runA, b: swapSides(runA), dur: 0.8, gear: 'M16 92 L22 86 H96 L100 92 M90 86 L98 42 M92 42 H104',
    cue: 'Passada curta e leve, tronco ligeiramente à frente',
  },
  bicicleta: {
    a: { head: [77, 19], neck: [70, 28], hip: [52, 47], kN: [68, 55], aN: [70, 73], kF: [61, 64], aF: [54, 82], eN: [77, 36], hN: [82, 45], eF: [77, 36], hF: [82, 45] },
    b: { head: [77, 19], neck: [70, 28], hip: [52, 47], kN: [61, 64], aN: [54, 82], kF: [68, 55], aF: [70, 73], eN: [77, 37], hN: [82, 45], eF: [77, 37], hF: [82, 45] },
    dur: 1, gear: 'M44 50 H58 M52 50 L62 78 L80 50 M76 44 H88 M80 50 L80 44 M62 78 L50 92 M62 78 L76 92',
    cue: 'Pedala com ritmo constante, joelhos alinhados',
  },
  eliptica: {
    a: { head: [60, 10], neck: [60, 21], hip: [58, 47], kN: [66, 63], aN: [70, 81], kF: [52, 65], aF: [44, 82], eN: [70, 31], hN: [82, 31], eF: [64, 33], hF: [76, 37] },
    b: { head: [60, 10], neck: [60, 21], hip: [58, 47], kN: [52, 65], aN: [44, 82], kF: [66, 63], aF: [70, 81], eN: [64, 33], hN: [76, 37], eF: [70, 31], hF: [82, 31] },
    dur: 1.4, gear: 'M26 92 H96 M30 92 L42 84 M86 92 L80 26',
    cue: 'Empurra e puxa com braços e pernas, tronco direito',
  },
  remo: {
    a: { head: [72, 52], neck: [65, 61], hip: [50, 83], kN: [66, 67], aN: [82, 84], eN: [76, 67], hN: [88, 71] },
    b: { head: [27, 49], neck: [32, 59], hip: [36, 83], kN: [56, 80], aN: [78, 84], eN: [32, 72], hN: [44, 67] },
    dur: 2.4, gear: 'M8 90 H112 M88 90 V74 M100 90 V70', cable: { from: [98, 72], to: 'hN' },
    cue: 'Pernas, tronco e braços; volta pela ordem inversa',
  },
  escada: {
    a: { head: [60, 14], neck: [60, 25], hip: [60, 52], kN: [74, 56], aN: [72, 74], kF: [59, 71], aF: [58, 90], eN: [66, 38], hN: [72, 46], eF: [54, 38], hF: [50, 46] },
    b: { head: [60, 14], neck: [60, 25], hip: [60, 52], kN: [59, 71], aN: [58, 90], kF: [74, 56], aF: [72, 74], eN: [54, 38], hN: [50, 46], eF: [66, 38], hF: [72, 46] },
    dur: 1.2, gear: 'M40 92 V84 H62 V74 H86 V92',
    cue: 'Degrau a degrau, pé todo apoiado',
  },
  corda: {
    a: { ...STAND, kN: [62, 73], aN: [60, 91], eN: [64, 41], hN: [74, 50] },
    b: { head: [60, 10], neck: [60, 21], hip: [60, 48], kN: [62, 67], aN: [60, 85], eN: [64, 35], hN: [75, 42] },
    dur: 0.6,
    cue: 'Saltos baixos na ponta dos pés, pulsos a rodar',
  },
  burpee: {
    a: { ...STAND, eN: [62, 40], hN: [64, 53] },
    b: { head: [93, 52], neck: [85, 58], hip: [53, 69], kN: [36, 79], aN: [18, 89], eN: [86, 75], hN: [86, 91] },
    dur: 2.2, props: ['mat'],
    cue: 'Mãos ao chão, pés atrás, volta e salta',
  },
  natacao: {
    a: { head: [96, 57], neck: [86, 60], hip: [56, 62], kN: [37, 60], aN: [18, 63], kF: [37, 64], aF: [18, 60], eN: [99, 59], hN: [111, 60], eF: [74, 68], hF: [62, 70] },
    b: { head: [96, 59], neck: [86, 60], hip: [56, 62], kN: [37, 64], aN: [18, 60], kF: [37, 60], aF: [18, 63], eN: [74, 68], hN: [62, 70], eF: [99, 59], hF: [111, 60] },
    dur: 1.4, gear: 'M4 54 Q16 50 28 54 T52 54 T76 54 T100 54 T116 54',
    cue: 'Braçada longa, pernas a bater sem parar, respira de lado',
  },
  danca: {
    a: { head: [57, 16], neck: [58, 27], hip: [60, 54], kN: [54, 72], aN: [52, 92], kF: [66, 72], aF: [68, 92], eN: [48, 20], hN: [44, 8], eF: [70, 36], hF: [74, 48] },
    b: { head: [63, 16], neck: [62, 27], hip: [60, 54], kN: [54, 72], aN: [52, 92], kF: [66, 72], aF: [68, 92], eN: [50, 36], hN: [46, 48], eF: [72, 20], hF: [76, 8] },
    dur: 1, view: 'front',
    cue: 'Ao ritmo da música, com leveza',
  },

  // ——— mobilidade ———
  rotacao_toracica: {
    a: { ...QUAD, eN: [78, 60], hN: [70, 54], eF: [80, 78], hF: [80, 91], kF: [46, 91], aF: [28, 91] },
    b: { ...QUAD, head: [88, 66], eN: [82, 53], hN: [84, 40], eF: [80, 78], hF: [80, 91], kF: [46, 91], aF: [28, 91] },
    dur: 3.4, props: ['mat'],
    cue: 'Roda o peito para cima a seguir a mão, volta devagar',
  },
  aquecimento: {
    a: { ...STAND, eN: [61, 41], hN: [63, 54] },
    b: { head: [66, 33], neck: [63, 43], hip: [46, 66], kN: [68, 71], aN: [60, 92], eN: [69, 54], hN: [75, 64] },
    dur: 2.4, hold: [{ at: 'hN', kind: 'db' }],
    cue: 'Carga leve, movimento completo, sem cansar',
  },
};
