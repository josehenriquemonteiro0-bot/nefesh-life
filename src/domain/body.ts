import type { Answers, AppState, BodyGoal, Goal } from './types';

export const BODY_GOALS: [BodyGoal, string][] = [
  ['perder-suave', 'Perder gordura, ritmo suave'],
  ['perder-moderado', 'Perder gordura, ritmo moderado'],
  ['manter', 'Manter o peso'],
  ['ganhar-suave', 'Ganhar massa muscular, ritmo suave'],
  ['ganhar-moderado', 'Ganhar massa muscular, ritmo moderado'],
];
export const BODY_GOAL_LABEL = Object.fromEntries(BODY_GOALS) as Record<BodyGoal, string>;

/** Objetivo para o corpo; avaliações antigas (sem a pergunta) deduzem-no do objetivo principal. */
export function bodyGoalOf(a: Answers, bmiLevel?: string): BodyGoal {
  if (a.corpo) return a.corpo;
  if (a.goal === 'peso') return bmiLevel === 'excesso' || bmiLevel === 'obesidade' ? 'perder-moderado' : 'perder-suave';
  return 'manter';
}

/**
 * Composição corporal e necessidades energéticas.
 *
 * - IMC e categorias da OMS.
 * - % de gordura: fórmula da Marinha dos EUA (Hodgdon & Beckett, 1984) quando há
 *   medidas de cintura e pescoço (e anca nas mulheres); sem medidas, estimativa
 *   de Deurenberg et al. (1991) a partir do IMC, da idade e do sexo.
 * - Metabolismo basal: Mifflin-St Jeor (1990).
 * - Gasto diário: metabolismo basal × fator de atividade.
 * São estimativas para orientar, não um diagnóstico.
 */

export interface BodyResult {
  bmi: number;
  bmiLabel: string;
  bmiLevel: 'baixo' | 'normal' | 'excesso' | 'obesidade';
  fat: number;
  fatMethod: 'avaliacao' | 'medidas' | 'imc';
  /** quando o IMC sobe por causa da massa muscular (gordura medida não elevada) */
  muscleNote?: string;
  fatLabel: string;
  /** relação cintura/altura, se houver medida de cintura */
  whtr?: number;
  bmr: number;
  tdee: number;
  target: number;
  targetNote: string;
  /** objetivo para o corpo usado no cálculo */
  corpo: BodyGoal;
  /** se a meta foi travada por segurança, o motivo */
  safety?: string;
  protein: number;
  carbs: number;
  fatG: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Idade em anos: aceita o número exato ou os intervalos das versões anteriores. */
export function ageOf(a: Answers): number {
  if (typeof a.idade === 'number') return a.idade;
  return ({ '18-29': 25, '30-44': 37, '45-59': 52, '60+': 65 } as Record<string, number>)[a.idade ?? ''] ?? 35;
}

export function bmiOf(kg: number, cm: number) {
  return kg / (cm / 100) ** 2;
}

export function bmiCategory(bmi: number): [BodyResult['bmiLevel'], string] {
  if (bmi < 18.5) return ['baixo', 'Abaixo do peso'];
  if (bmi < 25) return ['normal', 'Peso adequado'];
  if (bmi < 30) return ['excesso', 'Excesso de peso'];
  return ['obesidade', 'Obesidade'];
}

/** % de gordura pela fórmula da Marinha dos EUA (medidas em cm). */
export function navyFat(sex: 'f' | 'm', heightCm: number, waist: number, neck: number, hip?: number): number | null {
  if (sex === 'm') {
    if (waist - neck <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  if (!hip || waist + hip - neck <= 0) return null;
  return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
}

/** % de gordura estimada pelo IMC (Deurenberg). */
export function bmiFat(bmi: number, age: number, sex: 'f' | 'm') {
  return 1.2 * bmi + 0.23 * age - 10.8 * (sex === 'm' ? 1 : 0) - 5.4;
}

function fatLabel(fat: number, sex: 'f' | 'm') {
  // faixas de referência do American Council on Exercise
  const [ess, ath, fit, avg] = sex === 'm' ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (fat < ess) return 'Muito baixa';
  if (fat < ath) return 'Atlética';
  if (fat < fit) return 'Boa forma';
  if (fat < avg) return 'Média';
  return 'Elevada';
}

const ACTIVITY: Record<string, number> = { '0': 1.2, '1-2': 1.375, '3-4': 1.55, '5+': 1.725 };

/** Metabolismo basal (Mifflin-St Jeor), em kcal/dia. */
export function mifflin(sex: 'f' | 'm', kg: number, cm: number, age: number) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161);
}

/** % de gordura medida (avaliação ou relatório) ainda válida: até 1 ano. */
export function measuredFat(a: Answers, now = new Date()): number | null {
  if (!a.gorduraMedida || !a.medidaData) return null;
  const age = (now.getTime() - new Date(`${a.medidaData}T00:00:00`).getTime()) / 864e5;
  return age >= -1 && age <= 365 ? a.gorduraMedida : null;
}

/** Composição corporal e metas diárias. Precisa de peso e altura. */
export function bodyOf(a: Answers): BodyResult | null {
  const kg = a.peso;
  const cm = a.altura;
  if (!kg || !cm) return null;
  const sex: 'f' | 'm' = a.sexo === 'm' ? 'm' : 'f';
  const age = ageOf(a);
  const bmi = bmiOf(kg, cm);
  const [bmiLevel, bmiLabel] = bmiCategory(bmi);

  const measured = measuredFat(a);
  const navy = !measured && a.cintura && a.pescoco ? navyFat(sex, cm, a.cintura, a.pescoco, a.anca) : null;
  const fat = Math.max(3, Math.min(60, measured ?? navy ?? bmiFat(bmi, age, sex)));
  const label = fatLabel(fat, sex);
  const muscleNote = measured !== null && (bmiLevel === 'excesso' || bmiLevel === 'obesidade') && label !== 'Elevada'
    ? `O IMC diz "${bmiLabel.toLowerCase()}", mas a sua gordura medida (${r1(fat).toString().replace('.', ',')}%) está ${label === 'Média' ? 'na média' : 'em boa forma'}: parte do peso é massa muscular. Para si, conta mais a % de gordura do que o IMC.`
    : undefined;

  // com a massa magra conhecida, o metabolismo basal é mais certo pela fórmula de Katch-McArdle
  const lean = measured !== null ? (a.magraMedida && Math.abs(a.magraMedida - kg * (1 - fat / 100)) < 8 ? a.magraMedida : kg * (1 - fat / 100)) : null;
  const bmr = lean ? 370 + 21.6 * lean : mifflin(sex, kg, cm, age);
  const tdee = bmr * (ACTIVITY[a.ativ ?? ''] ?? 1.375);
  const goal: Goal = a.goal ?? 'energia';
  const corpo = bodyGoalOf(a, bmiLevel);
  const [dir, pace] = corpo.split('-') as ['perder' | 'manter' | 'ganhar', 'suave' | 'moderado' | undefined];

  // travões de segurança: sem défice para menores, IMC baixo ou gravidez/amamentação
  const pregnant = (a.safe || []).includes('gravidez');
  let safety: string | undefined;
  if (dir === 'perder' && (age < 18 || bmiLevel === 'baixo' || pregnant)) {
    safety = age < 18
      ? 'Abaixo dos 18 anos não definimos défices calóricos. Fale com um nutricionista.'
      : pregnant
        ? 'Na gravidez e amamentação não se faz défice calórico. A meta deve ser definida pelo seu médico ou nutricionista.'
        : 'Com o IMC abaixo de 18,5 não é recomendado perder peso. Fale com um nutricionista.';
  }

  let target = tdee;
  let targetNote = 'Para manter o peso atual, com o seu nível de atividade.';
  if (dir === 'perder' && !safety) {
    const deficit = Math.min(500, tdee * (pace === 'moderado' ? 0.2 : 0.1));
    target = Math.max(tdee - deficit, bmr, sex === 'm' ? 1500 : 1200);
    targetNote = `Um défice ${pace === 'moderado' ? 'moderado' : 'suave'} (cerca de ${Math.round((tdee - target) / 10) * 10} kcal) para perder gordura de forma sustentável, sem descer abaixo do metabolismo basal.`;
  } else if (dir === 'ganhar') {
    target = tdee + (pace === 'moderado' ? 300 : 200);
    targetNote = `Um pequeno excedente (+${pace === 'moderado' ? 300 : 200} kcal) para ganhar massa muscular, junto com treino de força. Excedentes maiores acrescentam sobretudo gordura.`;
  } else if (safety) {
    targetNote = safety;
  }
  // proteína (g/kg): mais alta para perder gordura sem perder músculo e para ganhar massa
  const protein = kg * (dir === 'ganhar' ? 2 : dir === 'perder' ? 1.8 : goal === 'desporto' ? 1.6 : 1.4);
  const fatG = (target * 0.3) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fatG * 9) / 4);

  return {
    bmi: r1(bmi),
    bmiLabel,
    bmiLevel,
    fat: r1(fat),
    fatMethod: measured !== null ? 'avaliacao' : navy !== null ? 'medidas' : 'imc',
    fatLabel: label,
    muscleNote,
    whtr: a.cintura ? Math.round((a.cintura / cm) * 100) / 100 : undefined,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target / 10) * 10,
    targetNote,
    corpo,
    safety,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fatG: Math.round(fatG),
  };
}

export interface NutritionTargets {
  kcal: number;
  /** calorias acrescentadas pelo treino do dia (metade do gasto estimado) */
  exercise?: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'app' | 'pro' | 'padrao';
  by?: string;
}

/** Metas do diário: as do nutricionista, se existirem; senão as calculadas pela app. */
export function targetsFor(S: AppState, exerciseKcal = 0): NutritionTargets {
  const b = S.ans ? bodyOf(S.ans) : null;
  // a meta já conta com a atividade habitual; num dia de treino somamos metade do gasto estimado (abordagem conservadora)
  const extra = Math.round((exerciseKcal * 0.5) / 10) * 10;
  const pro = S.nutriPro;
  if (pro && (pro.kcal || pro.protein)) {
    const kcal = pro.kcal ?? b?.target ?? 2000;
    const protein = pro.protein ?? b?.protein ?? 90;
    const fat = Math.round((kcal * 0.3) / 9);
    return { kcal, protein, fat, carbs: Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)), source: 'pro', by: pro.by };
  }
  if (b) return { kcal: b.target + extra, exercise: extra || undefined, protein: b.protein, carbs: b.carbs + Math.round(extra / 4), fat: b.fatG, source: 'app' };
  return { kcal: 2000, protein: 90, carbs: 250, fat: 65, source: 'padrao' };
}
