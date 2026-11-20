import { describe, expect, it } from 'vitest';
import { keyDaysAgo } from './dates';
import { activityStreak, dayScore, evolutionPoints, levelOf, weekPayload, weekStart } from './points';
import { blankState } from './sample';
import type { AppState } from './types';

const NOW = new Date(2026, 10, 20, 15); // sexta-feira
const sc = (v: number) => ({ energia: v, sono: v, nutricao: v, hidratacao: v, movimento: v });

function base(): AppState {
  return { ...blankState(NOW), ans: { goal: 'energia', peso: 70, altura: 170, idade: 35, sexo: 'f', ativ: '3-4', safe: ['nenhuma'] }, planStart: keyDaysAgo(40, NOW), evals: [{ date: keyDaysAgo(40, NOW), sc: sc(60) }] };
}
const fullDay = { doses: [true, true, true, true], water: 20, e: 4, steps: 9000, sleepH: 8, workouts: [{ sessionId: 'x', title: 'x', minutes: 30, mvpa: 30, strength: false }], meals: { pa: [{ id: '1', name: 'a', grams: 1, kcal: 1, p: 0, c: 0, f: 0 }], almoco: [{ id: '2', name: 'b', grams: 1, kcal: 1, p: 0, c: 0, f: 0 }], jantar: [{ id: '3', name: 'c', grams: 1, kcal: 1, p: 0, c: 0, f: 0 }] } };

describe('pontos NEFESH', () => {
  it('um dia completo vale 95 pontos e todas as letras', () => {
    const S = base();
    S.logs[keyDaysAgo(0, NOW)] = fullDay as never;
    const d = dayScore(S, keyDaysAgo(0, NOW), NOW);
    expect(d.points).toBe(95);
    expect(d.flags.split('').sort().join('')).toBe('acmnpst');
  });

  it('a Spirulina que entra sozinha no diário não conta como refeição', () => {
    const S = base();
    S.logs[keyDaysAgo(0, NOW)] = { meals: { pa: [{ id: 's', auto: 'spirulina-0', name: 's', grams: 1, kcal: 1, p: 0, c: 0, f: 0 }] } };
    expect(dayScore(S, keyDaysAgo(0, NOW), NOW).parts.m).toBe(0);
  });

  it('sequência com um dia de descanso por semana', () => {
    const S = base();
    for (let i = 1; i <= 10; i++) S.logs[keyDaysAgo(i, NOW)] = fullDay as never;
    expect(activityStreak(S, NOW)).toBe(10); // hoje ainda não conta
    delete S.logs[keyDaysAgo(3, NOW)]; // terça: descanso
    expect(activityStreak(S, NOW)).toBe(9);
    delete S.logs[keyDaysAgo(2, NOW)]; // quarta: segunda falha na mesma semana
    expect(activityStreak(S, NOW)).toBe(1);
  });

  it('evolução: subir o Índice dá mais pontos, manter alto também conta', () => {
    const S = base();
    expect(evolutionPoints(S, NOW).points).toBe(0);
    S.evals.push({ date: keyDaysAgo(1, NOW), sc: sc(80) });
    expect(evolutionPoints(S, NOW)).toMatchObject({ delta: 20, points: 120 });
    S.evals.push({ date: keyDaysAgo(0, NOW), sc: sc(79) });
    expect(evolutionPoints(S, NOW).points).toBe(50);
  });

  it('níveis e envio da semana', () => {
    expect(levelOf(0).name).toBe('Semente');
    expect(levelOf(1200)).toMatchObject({ name: 'Folha', next: 'Raiz', toNext: 1300 });
    const S = base();
    S.logs[keyDaysAgo(0, NOW)] = fullDay as never;
    S.logs[keyDaysAgo(10, NOW)] = fullDay as never; // semana passada: não vai
    const p = weekPayload(S, NOW);
    expect(Object.keys(p.days)).toEqual([keyDaysAgo(0, NOW)]);
    expect(weekStart(NOW)).toBe(keyDaysAgo(4, NOW));
    expect(p.idxFirst).toBe(p.idx);
  });
});
