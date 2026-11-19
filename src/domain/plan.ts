import { AREAS, GOAL_LABEL } from './content';
import { daysSince, fmtNum } from './dates';
import { DOSE_BASIS } from './science';
import type { Answers, AppState, Goal, Plan, Scores, Slot, WhyStep } from './types';

const scale = (v: number | undefined) => Math.round((((v ?? 3) || 3) - 1) / 4 * 100);
const pick = <T extends string>(map: Record<string, number>, k: T | undefined, def = 50) =>
  k !== undefined && k in map ? map[k] : def;

/** Pontuação 0–100 por área a partir das respostas da avaliação. */
export function scores(a: Answers): Scores {
  const energia = Math.round(scale(a.energia) * 0.7 + (100 - scale(a.stress)) * 0.3);
  const sono = Math.round(pick({ '<5': 20, '5-6': 55, '7-8': 100, '>8': 80 }, a.sonoh) * 0.5 + scale(a.sonoq) * 0.5);
  const nutricao = Math.round(
    pick({ '0-1': 30, '2-3': 65, '4+': 100 }, a.veg) * 0.6 + pick({ raro: 100, 'as-vezes': 60, diario: 25 }, a.proc) * 0.4,
  );
  const hidratacao = Math.max(0, pick({ '<4': 25, '4-6': 55, '7-9': 85, '10+': 100 }, a.agua) - (a.cafe === '3+' ? 10 : 0));
  const movimento = pick({ '0': 20, '1-2': 50, '3-4': 85, '5+': 100 }, a.ativ);
  return { energia, sono, nutricao, hidratacao, movimento };
}

/** Índice NEFESH: média simples das cinco áreas. */
export const indexOf = (s: Scores) => Math.round(AREAS.reduce((t, [k]) => t + s[k], 0) / AREAS.length);

const BASE_DOSE: Record<Goal, number> = { energia: 3, desporto: 5, imunidade: 3, foco: 3, nutricao: 3, peso: 4 };
const WHEN: Record<Goal, string> = {
  energia: 'De manhã, com o pequeno-almoço',
  desporto: 'Metade de manhã e metade 30 a 60 min antes do treino',
  imunidade: 'De manhã, com um copo de água',
  foco: 'De manhã ou a meio da manhã',
  nutricao: 'Dividida entre o almoço e o jantar',
  peso: 'Antes das duas maiores refeições',
};

/** Dose diária de Spirulina e a justificação de cada passo. */
export function calcPlan(a: Answers): Plan {
  const goal: Goal = a.goal ?? 'energia';
  const base = BASE_DOSE[goal];
  const p = a.peso || 70;
  let g = base;
  const why: WhyStep[] = [
    { label: 'Ponto de partida: ' + GOAL_LABEL[goal], value: fmtNum(base) + ' g', kind: 'evidencia', note: DOSE_BASIS[goal].text, studies: DOSE_BASIS[goal].studies },
  ];
  const weightNote = 'Os estudos usam doses fixas, iguais para todos. A NEFESH ajusta ao peso para que a dose por kg seja parecida entre pessoas diferentes.';
  if (p < 60) {
    g -= 0.5;
    why.push({ label: `Peso: ${p} kg`, value: '−0,5 g', kind: 'criterio', note: weightNote });
  } else if (p >= 100) {
    g += 2;
    why.push({ label: `Peso: ${p} kg`, value: '+2 g', kind: 'criterio', note: weightNote });
  } else if (p >= 80) {
    g += 1;
    why.push({ label: `Peso: ${p} kg`, value: '+1 g', kind: 'criterio', note: weightNote });
  } else why.push({ label: `Peso: ${p} kg`, value: 'sem ajuste', kind: 'criterio', note: 'Entre 60 e 79 kg é a faixa de referência da NEFESH, por isso não ajustamos. Acima ou abaixo, a dose sobe ou desce.' });
  if (goal === 'desporto' && a.ativ === '5+') {
    g += 1;
    why.push({ label: 'Treina 5 ou mais vezes por semana', value: '+1 g', kind: 'criterio', note: 'Com mais volume de treino aproximamo-nos dos 6 g/dia usados no ensaio com atletas.', studies: ['kalafati2010'] });
  }
  const raw = g;
  g = Math.max(2, Math.min(8, Math.round(g * 2) / 2));
  why.push({
    label: 'Limites de segurança',
    value: g === raw ? 'dentro' : `${fmtNum(g)} g`,
    kind: 'criterio',
    note: 'Arredondamos a 0,5 g (1 cápsula) e mantemos a dose entre 2 e 8 g/dia, dentro do intervalo usado nos ensaios clínicos.',
    studies: ['marles2011'],
  });
  return {
    g,
    caps: Math.round(g * 2),
    gPerKg: Math.round((g / p) * 1000) / 1000,
    why,
    flags: (a.safe || []).filter((x) => x !== 'nenhuma'),
    start: a.prior !== 'regular',
    when: WHEN[goal],
    water: Math.round((p * 35) / 250),
  };
}

/** Divide a dose total em tomas, tendo em conta a semana de adaptação. */
export function splitDose(caps: number, goal: Goal | undefined): Slot[] {
  if (caps < 6) return [{ l: 'Manhã', n: caps }];
  const second = ({ desporto: 'Pré-treino', nutricao: 'Jantar', peso: 'Antes do jantar' } as Partial<Record<Goal, string>>)[goal!] || 'Almoço';
  const m = Math.ceil(caps / 2);
  return [
    { l: goal === 'peso' ? 'Antes do almoço' : 'Manhã', n: m },
    { l: second, n: caps - m },
  ];
}

export const inAdaptation = (S: AppState, now = new Date()) =>
  !!S.ans && calcPlan(S.ans).start && !!S.planStart && daysSince(S.planStart, now) < 7;

export function slotsFor(S: AppState, now = new Date()): Slot[] {
  if (!S.ans) return [];
  const c = calcPlan(S.ans);
  const n = inAdaptation(S, now) ? Math.ceil(c.caps / 2) : c.caps;
  return splitDose(n, S.ans.goal);
}
