import { describe, expect, it } from 'vitest';
import { keyDaysAgo } from './dates';
import { dayAdherence, describeChanges, weekAdherence, weekChanges } from './planAdherence';
import { blankState } from './sample';
import type { AppState } from './types';

const NOW = new Date(2026, 10, 20, 12);
const meal = (label: string) => ({ meal: 'almoco' as const, label, time: '', options: [{ name: 'Única', items: [] }] });

function withPlan(): AppState {
  const S = blankState(NOW);
  S.nutriPlan = { is_plan: true, meals: [meal('Pequeno-almoço'), meal('Almoço'), meal('Lanche'), meal('Jantar')], daily_kcal: 0, daily_protein_g: 0, professional: '', notes: '', at: '2026-11-18', name: 'plano.pdf' };
  return S;
}

describe('plano vs execução', () => {
  it('calcula a adesão do dia: seguido conta inteiro, alterado metade', () => {
    const S = withPlan();
    S.logs[keyDaysAgo(0, NOW)] = { planLog: { 0: { status: 'seguido', option: 0 }, 1: { status: 'alterado', option: 0, changes: ['sem arroz'] }, 3: { status: 'saltado', option: 0 } } };
    expect(dayAdherence(S, keyDaysAgo(0, NOW))).toMatchObject({ total: 4, done: 3, followed: 1, changed: 1, skipped: 1, pct: 38 });
  });
  it('faz a média da semana só com os dias registados', () => {
    const S = withPlan();
    const all = { 0: { status: 'seguido', option: 0 }, 1: { status: 'seguido', option: 0 }, 2: { status: 'seguido', option: 0 }, 3: { status: 'seguido', option: 0 } } as const;
    S.logs[keyDaysAgo(0, NOW)] = { planLog: { ...all } };
    S.logs[keyDaysAgo(2, NOW)] = { planLog: { 0: { status: 'seguido', option: 0 }, 1: { status: 'saltado', option: 0 } } };
    const w = weekAdherence(S, 7, NOW);
    expect(w.loggedDays).toBe(2);
    expect(w.pct).toBe(63);
    expect(w.days).toHaveLength(7);
  });
  it('lista as alterações para o nutricionista', () => {
    const S = withPlan();
    S.logs[keyDaysAgo(1, NOW)] = { planLog: { 1: { status: 'alterado', option: 0, changes: ['sem arroz', '+ batata cozida'], note: 'jantar fora' }, 3: { status: 'saltado', option: 0 } } };
    const c = weekChanges(S, 7, NOW);
    expect(c).toHaveLength(2);
    expect(c[0]).toMatch(/Almoço: sem arroz; \+ batata cozida \(nota: jantar fora\)/);
    expect(c[1]).toMatch(/Jantar: não fez/);
  });
  it('descreve as alterações a partir das escolhas', () => {
    expect(describeChanges([{ name: 'Arroz', eaten: false, factor: 1 }, { name: 'Frango', eaten: true, factor: 1.5 }, { name: 'Salada', eaten: true, factor: 1 }], ['Batata cozida']))
      .toEqual(['sem Arroz', 'Frango ×1,5', '+ Batata cozida']);
  });
});
