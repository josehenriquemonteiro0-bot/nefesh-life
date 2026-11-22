import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { applyProPlan, clearProPlan, codeLooksValid, workoutReport } from './pro';
import type { AppState } from './types';

const plan = { is_workout: true, per_week: 3, professional: 'Isabela', notes: '', workouts: [{ name: 'Treino A', focus: 'Inferior', day: 'seg', exercises: [{ name: 'Agachamento', sets: 3, reps: '10', load: '40 kg', rest: '90 s', notes: '' }, { name: 'Prancha', sets: 2, reps: '30 s', load: '', rest: '', notes: '' }] }] };

describe('NEFESH Life Pro na app', () => {
  it('o código carrega o plano no mesmo sítio do plano em PDF; desligar limpa', () => {
    const S = { ...blankState() } as AppState;
    applyProPlan(S, { code: 'NP-ABCD-EFGH', pro: 'Isabela', plan, version: 2 });
    expect(S.trainPlan?.workouts[0].name).toBe('Treino A');
    expect(S.plans?.treino).toMatchObject({ type: 'nefesh-pro', by: 'Isabela', name: S.trainPlan?.name });
    expect(S.proLink).toMatchObject({ code: 'NP-ABCD-EFGH', version: 2 });
    clearProPlan(S);
    expect(S.trainPlan).toBeNull();
    expect(S.plans?.treino).toBeUndefined();
    expect(S.proLink).toBeUndefined();
    expect(codeLooksValid(' np-abcd-efgh ')).toBe(true);
    expect(codeLooksValid('NP-ABC')).toBe(false);
  });

  it('resumo do treino para o personal: séries feitas, cargas e alterações', () => {
    const r = workoutReport(plan.workouts[0], { status: 'alterado', minutes: 50, note: 'Joelho bem', changes: ['Agachamento: 42,5 kg'], sets: [{ ex: 0, done: true, load: '42,5 kg', reps: '10' }, { ex: 0, done: true, load: '42,5 kg', reps: '10' }, { ex: 0, done: false }, { ex: 1, done: true, reps: '30 s' }] });
    expect(r).toMatchObject({ workout: 'Treino A', status: 'alterado', minutes: 50, note: 'Joelho bem' });
    expect(r.exercises).toEqual([{ name: 'Agachamento', sets: 2, of: 3, reps: '10', load: '42,5 kg' }, { name: 'Prancha', sets: 1, of: 2, reps: '30 s', load: '' }]);
  });
});
