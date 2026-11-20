import { describe, expect, it } from 'vitest';
import { blankState } from './sample';
import { keyDaysAgo } from './dates';
import { memoryContext, patternsOf, recentNotes } from './patterns';
import type { AppState } from './types';

const NOW = new Date('2026-11-20T12:00:00'); // sexta-feira

function build(f: (wd: number, i: number) => object) {
  const S = { ...blankState(NOW), ans: { goal: 'energia', peso: 70 }, planStart: '2026-09-01', followLabel: true } as unknown as AppState;
  for (let i = 1; i <= 56; i++) {
    const k = keyDaysAgo(i, NOW);
    S.logs[k] = f(new Date(`${k}T12:00:00`).getDay(), i);
  }
  return S;
}

describe('o que o assistente sabe sobre si', () => {
  it('encontra o dia em que costuma falhar o treino e a Spirulina', () => {
    const S = build((wd) => ({ doses: wd === 0 ? [] : [true, true], workouts: wd === 3 ? [] : [{ sessionId: 'x', title: 'Treino', minutes: 30, mvpa: 30, strength: false }], water: 1 }));
    const ids = patternsOf(S, NOW).map((p) => p.text);
    expect(ids).toContain('Costuma falhar o treino às quartas-feiras.');
    expect(ids).toContain('Esquece mais a Spirulina aos domingos.');
  });
  it('sono ao fim de semana, água abaixo da meta e alimentos frequentes', () => {
    const S = build((wd, i) => ({ sleepH: wd === 0 || wd === 6 ? 6 : 7.5, water: 3, meals: i <= 10 ? { pa: [{ id: `o${i}`, name: 'Ovo cozido (100 g)', grams: 100, kcal: 155, p: 13, c: 1, f: 11 }] } : {} }));
    const t = patternsOf(S, NOW).map((p) => p.text);
    expect(t).toContain('Dorme menos ao fim de semana (6 h contra 7,5 h durante a semana).');
    expect(t.some((x) => /A água fica muitas vezes abaixo da meta/.test(x))).toBe(true);
    expect(t).toContain('Come com frequência: ovo cozido.');
  });
  it('a pessoa pode esconder um padrão; factos e relatos vão para o assistente', () => {
    const S = build((wd) => ({ sleepH: wd === 0 || wd === 6 ? 6 : 7.5 }));
    S.memory = { hidden: ['sono-fds'], facts: [{ id: 'f', text: 'É vegetariana', at: '2026-11-01' }] };
    S.logs[keyDaysAgo(2, NOW)] = { notes: ['Dificuldade em recuperar dos treinos'] };
    expect(patternsOf(S, NOW).find((p) => p.id === 'sono-fds')).toBeUndefined();
    const c = memoryContext(S, NOW);
    expect(c).toMatch(/- É vegetariana/);
    expect(c).toMatch(/Dificuldade em recuperar dos treinos/);
    expect(recentNotes(S, 21, NOW)).toHaveLength(1);
  });
  it('sem histórico suficiente não inventa padrões', () => {
    const S = { ...blankState(NOW), ans: { goal: 'energia', peso: 70 } } as unknown as AppState;
    expect(patternsOf(S, NOW)).toEqual([]);
  });
});
