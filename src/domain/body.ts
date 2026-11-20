import type { Answers, Goal } from './types';

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
  fatMethod: 'medidas' | 'imc';
  fatLabel: string;
  /** relação cintura/altura, se houver medida de cintura */
  whtr?: number;
  bmr: number;
  tdee: number;
  target: number;
  targetNote: string;
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

/** Composição corporal e metas diárias. Precisa de peso e altura. */
export function bodyOf(a: Answers): BodyResult | null {
  const kg = a.peso;
  const cm = a.altura;
  if (!kg || !cm) return null;
  const sex: 'f' | 'm' = a.sexo === 'm' ? 'm' : 'f';
  const age = ageOf(a);
  const bmi = bmiOf(kg, cm);
  const [bmiLevel, bmiLabel] = bmiCategory(bmi);

  const navy = a.cintura && a.pescoco ? navyFat(sex, cm, a.cintura, a.pescoco, a.anca) : null;
  const fat = Math.max(3, Math.min(60, navy ?? bmiFat(bmi, age, sex)));

  const bmr = mifflin(sex, kg, cm, age);
  const tdee = bmr * (ACTIVITY[a.ativ ?? ''] ?? 1.375);
  const goal: Goal = a.goal ?? 'energia';
  let target = tdee;
  let targetNote = 'Para manter o peso atual, com o seu nível de atividade.';
  if (goal === 'peso' && bmiLevel !== 'baixo' && bmiLevel !== 'normal') {
    target = Math.max(tdee - 500, bmr, sex === 'm' ? 1500 : 1200);
    targetNote = 'Um défice moderado (cerca de 500 kcal) para perder peso de forma sustentável, sem descer abaixo do metabolismo basal.';
  } else if (goal === 'peso') {
    target = Math.max(tdee - 250, bmr);
    targetNote = 'O seu IMC está adequado: um défice ligeiro, só para controlo e saciedade.';
  } else if (goal === 'desporto') {
    target = tdee + 150;
    targetNote = 'Um pequeno excedente para apoiar o treino e a recuperação.';
  }
  const protein = kg * (goal === 'desporto' || goal === 'peso' ? 1.6 : 1.2);
  const fatG = (target * 0.3) / 9;
  const carbs = Math.max(0, (target - protein * 4 - fatG * 9) / 4);

  return {
    bmi: r1(bmi),
    bmiLabel,
    bmiLevel,
    fat: r1(fat),
    fatMethod: navy !== null ? 'medidas' : 'imc',
    fatLabel: fatLabel(fat, sex),
    whtr: a.cintura ? Math.round((a.cintura / cm) * 100) / 100 : undefined,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target: Math.round(target / 10) * 10,
    targetNote,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fatG: Math.round(fatG),
  };
}
