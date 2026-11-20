import { describe, expect, it } from 'vitest';
import { targetsFor } from './body';
import { keyDaysAgo } from './dates';
import { bodySnapshot, compareEvals, mealForSlot, nextReassessment, spirulinaEntry, weeklySummary, workoutKcal } from './progress';
import { blankState } from './sample';
import type { AppState } from './types';

const NOW = new Date(2026, 10, 20, 12);
const sc = { energia: 50, sono: 60, nutricao: 60, hidratacao: 50, movimento: 50 };

function base(day = 0): AppState {
  return { ...blankState(NOW), ans: { goal: 'energia', peso: 80, altura: 180, idade: 35, sexo: 'm', ativ: '3-4', corpo: 'manter', prior: 'regular' }, planStart: keyDaysAgo(day, NOW), evals: [{ date: keyDaysAgo(day, NOW), sc }] };
}

describe('reavaliação aos 7, 15 e 30 dias', () => {
  it('marca os momentos certos', () => {
    expect(nextReassessment(base(3), NOW)).toMatchObject({ target: 7, due: false, inDays: 4 });
    expect(nextReassessment(base(7), NOW)).toMatchObject({ target: 7, due: true });
    // passou o dia 15 sem nenhuma reavaliação: pede a dos 15 dias, não a dos 7
    expect(nextReassessment(base(17), NOW)).toMatchObject({ target: 15, due: true });
    const S = base(16);
    S.evals.push({ date: keyDaysAgo(8, NOW), sc }); // reavaliou ao dia 8
    expect(nextReassessment(S, NOW)).toMatchObject({ target: 15, due: true });
    S.evals.push({ date: keyDaysAgo(0, NOW), sc });
    expect(nextReassessment(S, NOW)).toMatchObject({ target: 30, due: false, inDays: 14 });
  });
  it('compara o antes e o depois', () => {
    const S = base(30);
    S.evals[0].body = bodySnapshot({ ...S.ans!, peso: 84, cintura: 96 });
    S.evals.push({ date: keyDaysAgo(0, NOW), sc: { ...sc, energia: 80 }, body: bodySnapshot({ ...S.ans!, peso: 81.5, cintura: 92 }) });
    const c = compareEvals(S)!;
    expect(c.peso).toBe(-2.5);
    expect(c.cintura).toBe(-4);
    expect(c.index).toBe(6);
    expect(c.days).toBe(30);
  });
});

describe('resumo semanal', () => {
  it('conta Spirulina, água, check-ins e energia face à semana anterior', () => {
    const S = base(20);
    for (let i = 0; i < 5; i++) S.logs[keyDaysAgo(i, NOW)] = { doses: [true, true], water: 11, e: 4, sleepH: 7 }; // 80 kg: duas tomas
    for (let i = 7; i < 12; i++) S.logs[keyDaysAgo(i, NOW)] = { e: 3 };
    S.logs[keyDaysAgo(1, NOW)].workouts = [{ sessionId: 'caminhada', title: 'Caminhada', minutes: 30, mvpa: 30, strength: false }];
    const w = weeklySummary(S, NOW);
    expect(w).toMatchObject({ spirulina: 5, water: 5, checkins: 5, energy: 4, energyDelta: 1, sleep: 7, minutes: 30 });
  });
});

describe('Spirulina no diário', () => {
  it('escolhe a refeição pela toma e calcula as gramas', () => {
    expect(mealForSlot('Manhã')).toBe('pa');
    expect(mealForSlot('Antes do almoço')).toBe('almoco');
    expect(mealForSlot('Pré-treino')).toBe('lanche');
    const e = spirulinaEntry(base(), { l: 'Manhã', n: 6 }, 0);
    expect(e).toMatchObject({ grams: 3, auto: 'spirulina-0' });
    expect(e.p).toBeCloseTo(1.9, 1);
  });
});

describe('treino e calorias do dia', () => {
  it('estima o gasto e soma metade à meta da app', () => {
    const S = base();
    S.logs[keyDaysAgo(0, NOW)] = { workouts: [{ sessionId: 'plano-0', title: 'Treino A', minutes: 60, mvpa: 60, strength: true }] };
    const kcal = workoutKcal(S, keyDaysAgo(0, NOW));
    expect(kcal).toBe(320); // (5 - 1) MET × 80 kg × 1 h
    const t0 = targetsFor(S);
    const t1 = targetsFor(S, kcal);
    expect(t1.kcal - t0.kcal).toBe(160);
    expect(t1.exercise).toBe(160);
  });
  it('não mexe na meta definida pelo nutricionista', () => {
    const S = base();
    S.nutriPro = { kcal: 2400, by: 'Dra. Teste', at: '2026-11-20' };
    expect(targetsFor(S, 400).kcal).toBe(2400);
  });
});

describe('a Spirulina e você', async () => {
  const { spirulinaInsight } = await import('./progress');
  it('compara os dias com e sem ritual', () => {
    const S = base(30);
    S.followLabel = true;
    for (let i = 0; i < 4; i++) S.logs[keyDaysAgo(i, NOW)] = { doses: [true, true, true, true], e: 4, s: 4, d: 5 };
    for (let i = 4; i < 7; i++) S.logs[keyDaysAgo(i, NOW)] = { e: 2, s: 3, d: 3 };
    const r = spirulinaInsight(S, NOW);
    expect(r.comparable).toBe(true);
    expect(r.with).toMatchObject({ n: 4, e: 4 });
    expect(r.without).toMatchObject({ n: 3, e: 2 });
    expect(r.energyDiff).toBe(2);
  });
});
