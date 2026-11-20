import { describe, expect, it } from 'vitest';
import { keyDaysAgo } from './dates';
import { blankState } from './sample';
import { describeTrainChanges, lastPerformance, perSet, trainChanges, weekTrainAdherence } from './trainAdherence';
import type { AppState } from './types';

const NOW = new Date(2026, 10, 20, 18); // sexta-feira
const ex = (name: string, sets: number, reps: string, load: string) => ({ name, sets, reps, load, rest: '60 s', notes: '' });

function withPlan(): AppState {
  const S = blankState(NOW);
  S.trainPlan = { is_workout: true, per_week: 3, professional: 'Personal Teste', notes: '', at: '2026-11-15', name: 'treino.pdf', workouts: [
    { name: 'Treino A', focus: 'Peito e tríceps', day: '', exercises: [ex('Supino reto', 3, '10-12', '20 kg'), ex('Tríceps corda', 3, '12', '15 kg')] },
    { name: 'Treino B', focus: 'Costas', day: '', exercises: [ex('Puxada frontal', 3, '10', '35 kg')] },
  ] };
  return S;
}

describe('treino do personal vs execução', () => {
  it('mostra a última carga feita em cada exercício', () => {
    const S = withPlan();
    S.logs[keyDaysAgo(3, NOW)] = { trainLog: { 0: { status: 'alterado', sets: [{ ex: 0, set: 0, done: true, reps: '12', load: '20 kg' }, { ex: 0, set: 1, done: true, reps: '10', load: '22,5 kg' }] } } };
    expect(lastPerformance(S, 'Supino reto', NOW)).toMatchObject({ load: '22,5 kg', reps: '10', sets: 2 });
    expect(lastPerformance(S, 'Puxada frontal', NOW)).toBeNull();
  });
  it('conta os treinos da semana face aos previstos', () => {
    const S = withPlan();
    S.logs[keyDaysAgo(4, NOW)] = { trainLog: { 0: { status: 'seguido', sets: [] } } }; // segunda
    S.logs[keyDaysAgo(2, NOW)] = { trainLog: { 1: { status: 'alterado', sets: [] } } };
    S.logs[keyDaysAgo(6, NOW)] = { trainLog: { 0: { status: 'seguido', sets: [] } } }; // semana anterior
    expect(weekTrainAdherence(S, NOW)).toMatchObject({ planned: 3, done: 2, changed: 1, pct: 67 });
  });
  it('descreve séries a menos, cargas e repetições diferentes', () => {
    const exs = [ex('Supino reto', 3, '10-12', '20 kg'), ex('Tríceps corda', 3, '12', '15 kg'), ex('Flexões', 2, '15', '')];
    const sets = [
      { ex: 0, set: 0, done: true, reps: '10-12', load: '22,5 kg' }, { ex: 0, set: 1, done: true, reps: '10-12', load: '22,5 kg' }, { ex: 0, set: 2, done: true, reps: '8', load: '22,5 kg' },
      { ex: 1, set: 0, done: true, reps: '12', load: '15 kg' }, { ex: 1, set: 1, done: true, reps: '12', load: '15 kg' }, { ex: 1, set: 2, done: false },
      { ex: 2, set: 0, done: false }, { ex: 2, set: 1, done: false },
    ];
    expect(describeTrainChanges(exs, sets)).toEqual(['Supino reto: 22,5 kg, 10-12/8 reps', 'Tríceps corda: 2/3 séries', 'sem Flexões']);
  });
  it('lista o que foi feito para o relatório', () => {
    const S = withPlan();
    S.logs[keyDaysAgo(1, NOW)] = { trainLog: { 0: { status: 'alterado', sets: [], changes: ['Supino reto: 22,5 kg'], note: 'ombro sensível' }, 1: { status: 'saltado', sets: [] } } };
    expect(trainChanges(S, 7, NOW)).toEqual(['19/11 · Treino A: Supino reto: 22,5 kg (nota: ombro sensível)', '19/11 · Treino B: não fez']);
  });
});

describe('prescrição por série (formato MyFit)', () => {
  it('reparte pirâmides de repetições e cargas pelas séries', () => {
    expect([0, 1, 2].map((i) => perSet('12/10/8', 3, i))).toEqual(['12', '10', '8']);
    expect([0, 1, 2].map((i) => perSet('12-15', 3, i))).toEqual(['12-15', '12-15', '12-15']);
    expect(perSet('8/6 kg', 2, 1)).toBe('6 kg');
    expect(perSet('8/6 kg', 3, 1)).toBe('8/6 kg');
    expect(perSet('Diminuindo carga', 3, 0)).toBe('Diminuindo carga');
    expect(perSet('10 min', 1, 0)).toBe('10 min');
  });
  it('uma pirâmide feita à risca não conta como alteração', () => {
    const e = [ex('Puxada neutra triângulo', 3, '12/10/8', '50 kg')];
    const sets = [0, 1, 2].map((k) => ({ ex: 0, set: k, done: true, reps: perSet('12/10/8', 3, k), load: '50 kg' }));
    expect(describeTrainChanges(e, sets)).toEqual([]);
    sets[2].reps = '6';
    expect(describeTrainChanges(e, sets)).toEqual(['Puxada neutra triângulo: 12/10/6 reps']);
  });
});
