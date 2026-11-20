import { describe, expect, it } from 'vitest';
import { applyHealthDays } from './healthSync';
import { blankState } from './sample';
import { setSource, sourceCount, sourceOf, sourceSummary } from './sources';
import { keyDaysAgo } from './dates';
import { report } from './stats';

const NOW = new Date('2026-11-20T12:00:00');

describe('origem dos dados', () => {
  it('o app Saúde marca medido; escrever à mão volta a declarado', () => {
    const S = blankState(NOW);
    const k = keyDaysAgo(0, NOW);
    S.logs[k] = { sleepH: 6 };
    applyHealthDays(S, { [k]: { steps: 8000, sleepH: 7.5, exMin: 30, at: 'x' } });
    const l = S.logs[k];
    expect(sourceOf(l, 'steps')).toBe('integration');
    expect(sourceOf(l, 'sleepH')).toBe('declared'); // o sono escrito manda
    expect(sourceOf(l, 'exMin')).toBe('integration');
    l.steps = 9000;
    setSource(l, 'steps', null);
    expect(sourceOf(l, 'steps')).toBe('declared');
    expect(l.src).toEqual({ exMin: 'integration' });
  });

  it('a captura do app Saúde fica como medida pelo aparelho', () => {
    const S = blankState(NOW);
    const k = keyDaysAgo(0, NOW);
    applyHealthDays(S, { [k]: { steps: 5000, at: 'x' } }, 'device');
    expect(sourceOf(S.logs[k], 'steps')).toBe('device');
    // receber o mesmo valor do atalho muda a origem para integração
    expect(applyHealthDays(S, { [k]: { steps: 5000, at: 'y' } })).toBe(true);
    expect(sourceOf(S.logs[k], 'steps')).toBe('integration');
  });

  it('o relatório distingue medido de declarado', () => {
    const S = blankState(NOW);
    S.ans = { goal: 'energia', peso: 70 };
    S.logs[keyDaysAgo(0, NOW)] = { steps: 8000, src: { steps: 'integration' } };
    S.logs[keyDaysAgo(1, NOW)] = { steps: 6000 };
    expect(sourceCount(S, 'steps', 7, NOW)).toEqual({ measured: 1, declared: 1 });
    expect(sourceSummary({ measured: 0, declared: 3 })).toBe('escrito por si');
    expect(sourceSummary({ measured: 3, declared: 0 })).toBe('medido pelo app Saúde');
    expect(report(S, NOW)).toMatch(/Passos médios \(7 dias\): 7.?000 \(medido em 1 de 2 dias, o resto escrito por si\)/);
  });
});
