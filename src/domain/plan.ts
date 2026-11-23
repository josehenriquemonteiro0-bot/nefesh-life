import { mealPlan } from './fasting';
import { AREAS, GOAL_LABEL } from './content';
import { daysSince, fmtNum } from './dates';
import { DOSE_BASIS } from './science';
import { PRODUCTS, type ProductId } from './lots';
import type { Answers, AppState, Goal, Plan, ProDose, Scores, Slot, WhyStep } from './types';

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

export interface PlanOptions {
  format?: ProductId;
  /** dose indicada por um profissional de saúde, que substitui a sugestão */
  pro?: ProDose | null;
  /** a pessoa prefere seguir a recomendação geral do rótulo */
  followLabel?: boolean;
}

/**
 * Política de dose da app (decisão da NEFESH):
 * - 'estudos': sugere a dose personalizada baseada nos estudos, mesmo acima do rótulo,
 *   mostrando o rótulo como referência e permitindo à pessoa seguir o rótulo.
 * - 'rotulo': a dose nunca passa a recomendação do rótulo sem indicação profissional.
 * Rever com o departamento jurídico/regulatório antes do lançamento.
 */
export const DOSE_POLICY: 'estudos' | 'rotulo' = 'estudos';

/** Limite máximo absoluto, mesmo com indicação profissional. */
const ABS_MAX = 8;

/**
 * Dose diária de Spirulina e a justificação de cada passo.
 *
 * 1. Referência dos estudos, ajustada ao peso e ao treino (informativa).
 * 2. Aplica a política de dose (DOSE_POLICY), a preferência da pessoa
 *    e a indicação de um profissional, se existir.
 */
export function calcPlan(a: Answers, opts: PlanOptions = {}): Plan {
  const format: ProductId = opts.format ?? 'caps';
  const product = PRODUCTS[format];
  const goal: Goal = a.goal ?? 'energia';
  const base = BASE_DOSE[goal];
  const p = a.peso || 70;
  let g = base;
  const why: WhyStep[] = [
    { label: 'Referência dos estudos: ' + GOAL_LABEL[goal], value: fmtNum(base) + ' g', kind: 'evidencia', note: DOSE_BASIS[goal].text, studies: DOSE_BASIS[goal].studies },
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
  const gStudy = Math.max(1, Math.min(ABS_MAX, Math.round(g * 2) / 2));

  let final: number;
  let capped = false;
  const aboveLabel = gStudy > product.dailyMax;
  const followLabel = DOSE_POLICY === 'rotulo' || !!opts.followLabel;
  if (opts.pro) {
    final = Math.max(0.5, Math.min(ABS_MAX, Math.round(opts.pro.g * 2) / 2));
    why.push({
      label: `Indicação: ${opts.pro.by || 'profissional de saúde'}`,
      value: `${fmtNum(final)} g`,
      kind: 'profissional',
      note: 'A dose foi definida por um profissional de saúde para o seu caso e substitui a sugestão da NEFESH Life.',
    });
  } else if (followLabel) {
    final = Math.min(gStudy, product.dailyMax);
    capped = aboveLabel;
    why.push({
      label: 'Recomendação do rótulo',
      value: capped ? `${fmtNum(final)} g` : 'dentro',
      kind: 'rotulo',
      note: capped
        ? `Escolheu seguir o rótulo de ${product.name}: ${product.dailyText} por dia. A sugestão baseada nos estudos seria ${fmtNum(gStudy)} g.`
        : `Fica dentro da recomendação diária do rótulo de ${product.name} (${product.dailyText}).`,
    });
  } else {
    final = gStudy;
    why.push({
      label: 'Recomendação geral do rótulo',
      value: product.dailyText.replace(/ \(.*\)/, ''),
      kind: 'rotulo',
      note: aboveLabel
        ? `O rótulo indica ${product.dailyText} por dia como uso geral, igual para todos. A sua sugestão é personalizada e segue as doses usadas nos estudos para o seu objetivo e o seu perfil.`
        : `A sua sugestão fica dentro da recomendação geral do rótulo (${product.dailyText}).`,
    });
  }
  const units = Math.round(final * 2);
  return {
    g: final,
    gStudy,
    capped,
    aboveLabel: !opts.pro && !followLabel && aboveLabel,
    format,
    caps: units,
    gPerKg: Math.round((final / p) * 1000) / 1000,
    why,
    flags: (a.safe || []).filter((x) => x !== 'nenhuma'),
    start: a.prior !== 'regular',
    when: WHEN[goal],
    water: Math.round((p * 35) / 250),
  };
}

/** O plano da pessoa, com o formato e a indicação profissional guardados. */
export const planFor = (S: AppState) => calcPlan(S.ans ?? {}, { format: S.format, pro: S.proDose, followLabel: S.followLabel });

/** Divide a dose total em tomas, tendo em conta a semana de adaptação. */
export function splitDose(caps: number, goal: Goal | undefined, format: ProductId = 'caps'): Slot[] {
  if (caps < 6 || format !== 'caps') return [{ l: goal === 'peso' ? 'Antes do almoço' : 'Manhã', n: caps }];
  const second = ({ desporto: 'Pré-treino', nutricao: 'Jantar', peso: 'Antes do jantar' } as Partial<Record<Goal, string>>)[goal!] || 'Almoço';
  const m = Math.ceil(caps / 2);
  return [
    { l: goal === 'peso' ? 'Antes do almoço' : 'Manhã', n: m },
    { l: second, n: caps - m },
  ];
}

export const inAdaptation = (S: AppState, now = new Date()) =>
  !!S.ans && planFor(S).start && !!S.planStart && daysSince(S.planStart, now) < 7;

export function slotsFor(S: AppState, now = new Date()): Slot[] {
  if (!S.ans) return [];
  const c = planFor(S);
  const n = inAdaptation(S, now) ? Math.ceil(c.caps / 2) : c.caps;
  const slots = splitDose(n, S.ans.goal, c.format);
  // jejum: a Spirulina vai para dentro da janela (primeira e última refeição)
  const f = S.fasting;
  if (f?.on && f.protocol !== '5:2' && f.spirulinaInWindow !== false) {
    const meals = mealPlan(f, now);
    const name = { pa: 'pequeno-almoço', almoco: 'almoço', lanche: 'lanche', jantar: 'jantar' } as const;
    const first = meals[0];
    const last = meals[meals.length - 1];
    return slots.map((x, i) => ({ ...x, l: i === 0 ? `Na 1.ª refeição (${name[first.key]}, ${first.time})` : `Na última refeição (${name[last.key]})` }));
  }
  return slots;
}
